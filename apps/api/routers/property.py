from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_session
from models.user import User
from schemas.property import PropertyLookupResponse
from services.auth import get_current_user
from services.property_lookup import lookup_property, PropertyLookupError

router = APIRouter(prefix="/property", tags=["property"])


@router.get("/lookup", response_model=PropertyLookupResponse)
async def property_lookup(
    address: str = Query(..., description="Full property address"),
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user),
):
    """
    Lookup property details from Florida Cadastral API.

    Geocodes the address and returns property data including:
    - Parcel ID (Tax ID)
    - County
    - Legal description
    - Owner information
    - Property details (sqft, year built, etc.)
    - Assessment values
    - Last sale info
    """
    try:
        result = await lookup_property(address)
        return PropertyLookupResponse(**result)
    except PropertyLookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Property lookup failed: {str(e)}")
