# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered real estate contract negotiation system. Frontend is Next.js 14 (TypeScript), backend is FastAPI (Python), with PostgreSQL, Redis, and Celery for background jobs. Anthropic Claude is the sole LLM provider.

## Development Commands

### Running the full stack
```bash
docker-compose up --build        # Build and start all services
docker-compose up                # Start all services (postgres:5432, redis:6379, api:8000, web:3000, worker)
```

### Backend (API)
```bash
docker-compose exec api python -m pytest tests/ -v                    # Run all tests
docker-compose exec api python -m pytest tests/test_diffing.py -v     # Run single test file
docker-compose exec api python scripts/qa_smoke_test.py               # API smoke tests
docker-compose exec api alembic upgrade head                          # Run migrations
docker-compose exec api python seed.py                                # Seed demo data
```

### Frontend (Web)
```bash
cd apps/web && npm run dev       # Dev server (standalone, needs API running)
cd apps/web && npm run build     # Production build
cd apps/web && npm run lint      # ESLint
```

### Infrastructure
```bash
bash infra/migrate.sh            # Run migrations via script
bash infra/seed.sh               # Seed via script
curl http://localhost:8000/health # Health check
```

## Architecture

### Backend (`apps/api/`)

Layered architecture: **Routers → Schemas → Services → Models → Database**

- `routers/` — HTTP endpoints (auth, deals, contracts, change_requests, versions, timeline, jobs, settings, etc.)
- `schemas/` — Pydantic request/response models
- `services/` — Business logic (contract_intelligence, diffing, versioning, ingestion, rbac, tenant, auth)
- `models/` — SQLModel ORM definitions (async SQLAlchemy + asyncpg)
- `llm/anthropic_client.py` — Anthropic wrapper; falls back to mock mode when `ANTHROPIC_API_KEY` missing or `LLM_MOCK_MODE=true`. Uses `claude-sonnet-4-20250514`. Has JSON retry logic (2 retries).
- `workers/` — Celery tasks: `parse_contract`, `analyze_change_request`, `generate_version`. `inline_runner.py` provides non-Celery fallback.
- `prompts/` — Versioned markdown prompt templates. All AI outputs include `prompt_version` for audit trail.
- `migrations/` — Alembic migrations (9 versions)

### Frontend (`apps/web/`)

Next.js 14 App Router with TanStack Query for server state, shadcn/ui components, Tailwind CSS.

- `src/app/` — Pages: login, signup, deals, deals/[id], settings, users, super-admin, review/[token]
- `src/components/` — UI components (contract-builder, ai-analysis-panel, version-diff-viewer, timeline-view, change-request-composer, onboarding-wizard)
- `src/hooks/` — use-auth (JWT in localStorage), use-poll-job (background job polling), use-media-query
- `src/lib/api.ts` — Fetch wrapper pointing to `NEXT_PUBLIC_API_URL`

### Data Flow

1. **Ingestion**: Upload DOCX/PDF or paste text → Celery worker parses with Claude → extracted fields stored in `contract_state` JSON on ContractVersion
2. **Change Requests**: Natural language request → Claude analyzes against current state → returns field changes, confidence scores, recommendation
3. **Version Generation**: Approved changes applied deterministically → constrained LLM generation → new ContractVersion with computed diff (diff-match-patch)
4. **Job Polling**: Frontend polls `/jobs/:id` until background task completes

### Auth & Multi-tenancy

JWT (HS256) with roles: admin, transaction_coordinator, buyer_agent, seller_agent. RBAC via `require_roles()`. Organization-based multi-tenancy.

## Environment Variables

Backend requires: `JWT_SECRET`, `DATABASE_URL`, `DATABASE_URL_SYNC`, `REDIS_URL`, `ANTHROPIC_API_KEY` (optional for mock mode). See `apps/api/.env.example`.

Frontend requires: `NEXT_PUBLIC_API_URL=http://localhost:8000`. See `apps/web/.env.example`.
