import os
import logging
from pathlib import Path
from pydantic_settings import BaseSettings

_ENV_FILE = Path(__file__).resolve().parent / ".env"

# Guard: never log secrets
_SENSITIVE_KEYS = {"ANTHROPIC_API_KEY", "JWT_SECRET", "DATABASE_URL", "DATABASE_URL_SYNC", "RESEND_API_KEY", "OPENAI_API_KEY"}


def _mask(value: str) -> str:
    if len(value) <= 8:
        return "****"
    return value[:4] + "****" + value[-4:]


class Settings(BaseSettings):
    # Auth
    jwt_secret: str = "change-me-to-a-random-secret"
    jwt_algorithm: str = "HS256"
    jwt_expiration_minutes: int = 1440

    # Database
    database_url: str = "postgresql+asyncpg://contract_user:contract_pass@localhost:5432/contract_db"
    database_url_sync: str = "postgresql://contract_user:contract_pass@localhost:5432/contract_db"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Anthropic
    anthropic_api_key: str = ""

    # LLM
    llm_mock_mode: bool = False

    # OpenAI (optional — voice transcription disabled if OPENAI_API_KEY is empty)
    openai_api_key: str = ""

    # Resend (optional — email notifications disabled if RESEND_API_KEY is empty)
    resend_api_key: str = ""
    resend_from_email: str = "Pactly <notifications@updates.stayirrelevant.com>"

    # Frontend URL (for magic links)
    frontend_url: str = "http://localhost:3000"

    # App
    log_level: str = "INFO"
    environment: str = "development"
    storage_path: str = "/app/storage"

    class Config:
        env_file = str(_ENV_FILE)
        extra = "ignore"

    def validate_secrets(self) -> None:
        if not self.anthropic_api_key:
            logging.warning("ANTHROPIC_API_KEY is not set. LLM features will fail.")
        if self.jwt_secret == "change-me-to-a-random-secret":
            logging.warning("JWT_SECRET is using the default value. Change in production.")

    def safe_dict(self) -> dict:
        d = {}
        for k, v in self.model_dump().items():
            if k.upper() in _SENSITIVE_KEYS or "secret" in k.lower() or "key" in k.lower() or "password" in k.lower():
                d[k] = _mask(str(v)) if v else "(not set)"
            else:
                d[k] = v
        return d


settings = Settings()
settings.validate_secrets()
