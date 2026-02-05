from pydantic import BaseModel, field_validator
from typing import Optional


class PropertyLookupRequest(BaseModel):
    address: str  # Full address string


class PropertyLookupResponse(BaseModel):
    # Identifiers
    parcel_id: Optional[str] = None
    county: Optional[str] = None
    county_code: Optional[int] = None

    # Physical address (verified)
    property_address: Optional[str] = None
    property_city: Optional[str] = None
    property_zip: Optional[str] = None

    # Owner info (potential seller)
    owner_name: Optional[str] = None
    owner_address: Optional[str] = None
    owner_city: Optional[str] = None
    owner_state: Optional[str] = None
    owner_zip: Optional[str] = None

    @field_validator("property_zip", "owner_zip", mode="before")
    @classmethod
    def coerce_zip_to_str(cls, v):
        if v is None:
            return None
        return str(v) if v else None

    # Legal
    legal_description: Optional[str] = None

    # Property details
    property_type: Optional[str] = None
    living_area_sqft: Optional[float] = None
    year_built: Optional[int] = None
    num_buildings: Optional[int] = None
    num_units: Optional[int] = None

    # Values
    land_value: Optional[float] = None
    just_value: Optional[float] = None
    assessed_value: Optional[float] = None

    # Last sale
    last_sale_price: Optional[float] = None
    last_sale_year: Optional[int] = None

    # Geocoding result
    geocoded_coordinates: Optional[dict] = None
