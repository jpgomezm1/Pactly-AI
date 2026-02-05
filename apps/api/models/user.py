import enum
import uuid
from datetime import datetime
from typing import Optional
from sqlmodel import SQLModel, Field


class UserRole(str, enum.Enum):
    super_admin = "super_admin"
    admin = "admin"
    agent = "agent"

    @classmethod
    def normalize(cls, value: str) -> "UserRole":
        """Map legacy roles to the simplified set."""
        legacy_map = {
            "transaction_coordinator": cls.admin,
            "buyer_agent": cls.agent,
            "seller_agent": cls.agent,
        }
        try:
            return cls(value)
        except ValueError:
            return legacy_map.get(value, cls.agent)


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    email: str = Field(index=True, unique=True)
    hashed_password: str
    full_name: str
    role: UserRole = Field(default=UserRole.agent)
    has_completed_onboarding: bool = Field(default=False)
    is_active: bool = Field(default=True)
    organization_id: Optional[uuid.UUID] = Field(default=None, foreign_key="organizations.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    referred_by_share_link_id: Optional[uuid.UUID] = Field(default=None, foreign_key="share_links.id")
    updated_at: Optional[datetime] = None
