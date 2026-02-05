"""Florida Property Lookup Service using Cadastral API"""
import re
import httpx
import logging
from typing import Optional, Dict, Any, Tuple

logger = logging.getLogger(__name__)

# US Census Geocoder — "geographies" endpoint returns county name directly
CENSUS_GEOCODER_URL = "https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress"

# Florida Statewide Cadastral API
FLORIDA_CADASTRAL_URL = "https://services9.arcgis.com/Gh9awoU677aKree0/arcgis/rest/services/Florida_Statewide_Cadastral/FeatureServer/0/query"


class PropertyLookupError(Exception):
    """Raised when property lookup fails"""
    pass


def _is_blank(value) -> bool:
    """Check if a cadastral field value is effectively empty."""
    if value is None:
        return True
    if isinstance(value, str) and value.strip() == "":
        return True
    if isinstance(value, (int, float)) and value == 0:
        return True
    return False


def _clean_str(val) -> Optional[str]:
    """Clean string values — cadastral API returns whitespace-only strings for empty fields."""
    if val is None:
        return None
    if isinstance(val, str):
        val = val.strip()
        return val if val else None
    return str(val)


def _extract_unit(address: str) -> Tuple[str, Optional[str]]:
    """
    Extract unit/apt number from address string.
    Returns (address_without_unit, unit_number).
    """
    pattern = r',?\s*(?:apt|unit|#|ste|suite|no\.?)\s*([A-Za-z0-9-]+)'
    match = re.search(pattern, address, re.IGNORECASE)
    if match:
        unit = match.group(1)
        clean_address = address[:match.start()] + address[match.end():]
        return clean_address.strip().rstrip(',').strip(), unit
    return address, None


async def geocode_address(address: str) -> Optional[Dict[str, Any]]:
    """
    Geocode address using US Census Geocoder (geographies endpoint).
    Returns coordinates + county name, or None if not found.
    """
    params = {
        "address": address,
        "benchmark": "Public_AR_Current",
        "vintage": "Current_Current",
        "format": "json",
    }

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(CENSUS_GEOCODER_URL, params=params)
            response.raise_for_status()
            data = response.json()

            matches = data.get("result", {}).get("addressMatches", [])
            if not matches:
                logger.warning(f"No geocode match for: {address}")
                return None

            best = matches[0]
            coords = best.get("coordinates", {})

            # Extract county from geographies
            county_name = None
            geos = best.get("geographies", {})
            counties = geos.get("Counties", [])
            if counties:
                county_name = counties[0].get("BASENAME")

            return {
                "x": coords.get("x"),
                "y": coords.get("y"),
                "matched_address": best.get("matchedAddress", ""),
                "county": county_name,
            }
    except Exception as e:
        logger.exception(f"Geocoding failed for {address}")
        return None


async def query_florida_cadastral(
    lng: float, lat: float, unit: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Query Florida Cadastral API with a bounding box around the point.
    Uses an envelope instead of a single point to capture condo units.
    If a unit number is provided, tries to match the specific unit.
    """
    # Bounding box ~110m around the point to capture stacked condo parcels
    buffer = 0.0005
    envelope = f"{lng - buffer},{lat - buffer},{lng + buffer},{lat + buffer}"

    params = {
        "where": "1=1",
        "geometry": envelope,
        "geometryType": "esriGeometryEnvelope",
        "spatialRel": "esriSpatialRelIntersects",
        "inSR": "4326",  # WGS84
        "outFields": ",".join([
            "PARCEL_ID", "PARCELNO", "CO_NO",
            "PHY_ADDR1", "PHY_ADDR2", "PHY_CITY", "PHY_ZIPCD",
            "OWN_NAME", "OWN_ADDR1", "OWN_CITY", "OWN_STATE", "OWN_ZIPCD",
            "S_LEGAL",
            "TOT_LVG_AR", "NO_BULDNG", "NO_RES_UNT",
            "EFF_YR_BLT", "ACT_YR_BLT",
            "LND_VAL", "JV", "AV_SD",
            "SALE_PRC1", "SALE_YR1",
            "DOR_UC",
        ]),
        "returnGeometry": "false",
        "resultRecordCount": "100",
        "f": "json",
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.get(FLORIDA_CADASTRAL_URL, params=params)
            response.raise_for_status()
            data = response.json()

            features = data.get("features", [])
            if not features:
                logger.warning(f"No parcels found near {lng}, {lat}")
                return None

            # Filter out blank entries
            valid = []
            for feature in features:
                attrs = feature.get("attributes", {})
                if not _is_blank(attrs.get("PARCEL_ID")) and not _is_blank(attrs.get("CO_NO")):
                    valid.append(attrs)

            if not valid:
                logger.warning(f"All parcels near {lng}, {lat} have blank data")
                return None

            # If unit number provided, try to match the specific unit
            if unit:
                unit_upper = unit.upper()
                for attrs in valid:
                    addr = str(attrs.get("PHY_ADDR1", "")).upper()
                    if f"#{unit_upper}" in addr or f"# {unit_upper}" in addr:
                        logger.info(f"Matched unit {unit} at {addr}")
                        return attrs

                # Try PHY_ADDR2 field too
                for attrs in valid:
                    addr2 = str(attrs.get("PHY_ADDR2", "")).upper()
                    if unit_upper in addr2:
                        logger.info(f"Matched unit {unit} in ADDR2")
                        return attrs

                logger.warning(f"Unit {unit} not found among {len(valid)} parcels")

            # No unit or unit not found: pick best non-condo or first valid
            # Prefer residential parcels (DOR_UC starting with 00, 01)
            for attrs in valid:
                dor = str(attrs.get("DOR_UC", "")).strip()
                if dor.startswith("00") or dor.startswith("01"):
                    return attrs

            return valid[0]

    except Exception as e:
        logger.exception(f"Cadastral query failed")
        return None


def map_cadastral_to_response(
    attrs: Dict[str, Any], county_from_geocoder: Optional[str] = None
) -> Dict[str, Any]:
    """Map Florida Cadastral attributes to our response format."""
    # Use county from geocoder (reliable) over cadastral CO_NO
    county_name = county_from_geocoder

    # Map DOR Use Code to property type
    dor_uc = str(attrs.get("DOR_UC", "")).strip()
    property_type = "Single Family"
    if dor_uc.startswith("04"):
        property_type = "Condo"
    elif dor_uc.startswith("02"):
        property_type = "Multi-Family"
    elif dor_uc.startswith("03"):
        property_type = "Townhouse"

    return {
        "parcel_id": _clean_str(attrs.get("PARCEL_ID")) or _clean_str(attrs.get("PARCELNO")),
        "county": county_name,
        "county_code": int(attrs.get("CO_NO", 0)) if attrs.get("CO_NO") else None,

        # Physical address
        "property_address": " ".join(filter(None, [
            _clean_str(attrs.get("PHY_ADDR1")),
            _clean_str(attrs.get("PHY_ADDR2")),
        ])) or None,
        "property_city": _clean_str(attrs.get("PHY_CITY")),
        "property_zip": attrs.get("PHY_ZIPCD"),

        # Owner info (potential seller)
        "owner_name": _clean_str(attrs.get("OWN_NAME")),
        "owner_address": _clean_str(attrs.get("OWN_ADDR1")),
        "owner_city": _clean_str(attrs.get("OWN_CITY")),
        "owner_state": _clean_str(attrs.get("OWN_STATE")),
        "owner_zip": attrs.get("OWN_ZIPCD"),

        # Legal
        "legal_description": _clean_str(attrs.get("S_LEGAL")),

        # Property details
        "property_type": property_type,
        "living_area_sqft": attrs.get("TOT_LVG_AR"),
        "year_built": attrs.get("EFF_YR_BLT") or attrs.get("ACT_YR_BLT"),
        "num_buildings": attrs.get("NO_BULDNG"),
        "num_units": attrs.get("NO_RES_UNT"),

        # Values
        "land_value": attrs.get("LND_VAL"),
        "just_value": attrs.get("JV"),
        "assessed_value": attrs.get("AV_SD"),

        # Last sale
        "last_sale_price": attrs.get("SALE_PRC1"),
        "last_sale_year": attrs.get("SALE_YR1"),
    }


async def lookup_property(address: str) -> Dict[str, Any]:
    """
    Full property lookup: geocode address, then query Cadastral API.

    Supports condos/units by:
    1. Extracting unit number from address
    2. Using bounding box query to find all parcels in area
    3. Matching specific unit from results

    Raises PropertyLookupError if lookup fails.
    """
    # Step 0: Extract unit number if present
    clean_address, unit = _extract_unit(address)
    if unit:
        logger.info(f"Extracted unit '{unit}' from address, searching: {clean_address}")

    # Step 1: Geocode
    coords = await geocode_address(clean_address if unit else address)
    if not coords:
        raise PropertyLookupError(f"Could not geocode address: {address}")

    logger.info(f"Geocoded to {coords['x']}, {coords['y']} — {coords.get('matched_address')}, County: {coords.get('county')}")

    # Step 2: Query Cadastral with bounding box
    attrs = await query_florida_cadastral(coords["x"], coords["y"], unit=unit)
    if not attrs:
        msg = "No property parcel data found at this location."
        if unit:
            msg += f" Unit {unit} was not found in cadastral records. Try without the unit number, or fill in details manually."
        raise PropertyLookupError(msg)

    # Step 3: Map to response format
    result = map_cadastral_to_response(attrs, county_from_geocoder=coords.get("county"))
    result["geocoded_coordinates"] = {"x": coords["x"], "y": coords["y"]}

    return result
