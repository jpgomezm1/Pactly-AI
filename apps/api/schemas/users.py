from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel


class UserCreateRequest(BaseModel):
    email: str
    full_name: str
    password: str
    role: str = "agent"


class UserUpdateRequest(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None
    full_name: Optional[str] = None


class UserListResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime
