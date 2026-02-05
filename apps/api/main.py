import logging
import os
import structlog
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from config import settings
from database import init_db
from routers import auth, deals, contracts, change_requests, versions, timeline, jobs
from routers import settings as settings_router
from routers import public, share_links, notifications
from routers import super_admin, users, usage
from routers import plg
from routers import deliverables
from routers import offer_letters
from routers import property

# Structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.BoundLogger,
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("starting_app", environment=settings.environment)
    await init_db()
    yield
    logger.info("shutting_down")


app = FastAPI(
    title="Contract Negotiation System",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        os.environ.get("FRONTEND_URL", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(deals.router)
app.include_router(contracts.router)
app.include_router(contracts.templates_router)
app.include_router(change_requests.router)
app.include_router(versions.router)
app.include_router(timeline.router)
app.include_router(jobs.router)
app.include_router(settings_router.router)
app.include_router(public.router)
app.include_router(share_links.router)
app.include_router(notifications.router)
app.include_router(super_admin.router)
app.include_router(users.router)
app.include_router(usage.router)
app.include_router(plg.router)
app.include_router(deliverables.router)
app.include_router(offer_letters.router)
app.include_router(property.router)

# Mount storage for serving uploaded logos
import os
os.makedirs(settings.storage_path, exist_ok=True)
app.mount("/storage", StaticFiles(directory=settings.storage_path), name="storage")


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("unhandled_error", error=str(exc), path=request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


@app.get("/health")
async def health():
    from llm.anthropic_client import is_mock_mode
    return {"status": "ok", "version": "0.1.0", "llm_mock_mode": is_mock_mode()}


@app.get("/llm-usage")
async def llm_usage():
    """Placeholder for LLM usage costs tracking."""
    return {
        "note": "LLM Usage Costs — placeholder for future billing integration",
        "columns": ["timestamp", "model", "prompt_version", "input_tokens", "output_tokens", "estimated_cost_usd"],
        "data": [],
        "total_estimated_cost_usd": 0.0,
    }
