from typing import Optional
from pydantic import BaseModel, EmailStr


class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "agent"


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    organization_name: str
    plan: str = "growth"
    billing_cycle: str = "monthly"
    ref_token: Optional[str] = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    organization_id: Optional[str] = None
    organization_name: Optional[str] = None
    plan: Optional[str] = None
    logo_url: Optional[str] = None
    has_completed_onboarding: bool = False

    class Config:
        from_attributes = True
