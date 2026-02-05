import uuid
import secrets
from datetime import datetime, timedelta
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
import bcrypt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from config import settings
from database import get_session
from models.user import User
from models.magic_link import MagicLink

security = HTTPBearer()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.jwt_expiration_minutes)
    payload = {"sub": user_id, "role": role, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    session: AsyncSession = Depends(get_session),
) -> User:
    payload = decode_token(credentials.credentials)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    result = await session.exec(select(User).where(User.id == uuid.UUID(user_id)))
    user = result.first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


async def create_magic_link(
    session: AsyncSession,
    user_id: str,
    deal_id: Optional[str] = None,
    redirect_path: Optional[str] = None,
) -> str:
    """Create a magic link token and return the full URL."""
    token = secrets.token_urlsafe(32)
    ml = MagicLink(
        user_id=uuid.UUID(user_id),
        token=token,
        deal_id=uuid.UUID(deal_id) if deal_id else None,
        redirect_path=redirect_path,
        expires_at=datetime.utcnow() + timedelta(minutes=60),
    )
    session.add(ml)
    await session.commit()
    return f"{settings.frontend_url}/auth/magic?token={token}"
