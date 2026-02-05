import ssl
import re

from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel.ext.asyncio.session import AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine
from sqlmodel import SQLModel

from config import settings

# asyncpg doesn't understand ?sslmode=require — strip it and pass SSL context instead
_async_url = re.sub(r"[?&]sslmode=[^&]*", "", settings.database_url)
_async_kwargs: dict = {}
if "neon.tech" in settings.database_url or "sslmode" in settings.database_url:
    ssl_ctx = ssl.create_default_context()
    _async_kwargs["connect_args"] = {"ssl": ssl_ctx}

async_engine = create_async_engine(
    _async_url,
    echo=False,
    pool_pre_ping=True,
    pool_recycle=300,
    **_async_kwargs,
)
async_session_factory = sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)

# psycopg2 picks up sslmode=require from the URL automatically — no extra connect_args needed
sync_engine = create_engine(settings.database_url_sync, echo=False)


async def get_session():
    async with async_session_factory() as session:
        yield session


async def init_db():
    async with async_engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
