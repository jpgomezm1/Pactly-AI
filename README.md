# AI-Powered Real Estate Contract Negotiation System

A production-quality MVP for Florida-style back-and-forth contract revisions with AI-powered analysis and version management.

## Tech Stack

- **Frontend**: Next.js 14 (App Router) + React + TypeScript + shadcn/ui + TanStack Query
- **Backend**: FastAPI + SQLModel + PostgreSQL + Alembic
- **Background Jobs**: Celery + Redis
- **AI**: Anthropic Claude (only LLM provider)
- **Infrastructure**: Docker Compose

## Quick Start

### 1. Set up environment

```bash
# Copy env files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Edit apps/api/.env and add your Anthropic API key:
# ANTHROPIC_API_KEY=sk-ant-...
# Also set a strong JWT_SECRET
```

**Never commit real secrets. The `.env` files are gitignored.**

### 2. Start all services

```bash
docker-compose up --build
```

This starts: PostgreSQL, Redis, API (port 8000), Worker (Celery), Web (port 3000).

### 3. Run migrations

```bash
docker-compose exec api alembic upgrade head
```

### 4. Seed demo data

```bash
docker-compose exec api python seed.py
```

This creates demo users:
| Email | Password | Role |
|---|---|---|
| admin@example.com | admin123 | Admin |
| tc@example.com | tc123456 | Transaction Coordinator |
| buyer@example.com | buyer123 | Buyer Agent |
| seller@example.com | seller123 | Seller Agent |

### 5. Access the app

- **Web UI**: http://localhost:3000
- **API Docs**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

## End-to-End Flow

1. Log in as TC (tc@example.com / tc123456)
2. Create a new deal or use the seeded demo deal
3. Upload a DOCX/PDF or paste contract text → creates v0
4. AI parses the contract → field summary appears
5. Create a change request (e.g., "Reduce price to $340,000")
6. Click "Analyze with AI" → see parsed changes, confidence, recommendation
7. Click "Generate New Version" → creates v1
8. Go to Versions tab → click "View Diff" to compare v0 vs v1
9. Timeline tab shows all events

## Running Tests

```bash
docker-compose exec api python -m pytest tests/ -v
```

## Project Structure

```
/apps/api          FastAPI backend
  /models          SQLModel DB models
  /routers         API route handlers
  /services        Business logic
  /llm             Anthropic SDK wrapper
  /prompts         Versioned prompt templates
  /workers         Celery background tasks
  /schemas         Pydantic request/response schemas
  /migrations      Alembic migrations
  /tests           Python tests
/apps/web          Next.js frontend
  /src/app         App Router pages
  /src/components  React components
  /src/hooks       Custom hooks
  /src/lib         API client, utilities
/infra             Scripts (migrate, seed)
/docs              Architecture docs
```

## LLM Usage Costs

A placeholder endpoint exists at `GET /llm-usage`. Token usage (input/output) is stored per change request and audit event for future billing integration.

## API Endpoints

| Method | Path | Description |
|---|---|---|
| POST | /auth/signup | Create account |
| POST | /auth/login | Get JWT token |
| GET | /auth/me | Current user |
| POST | /deals | Create deal |
| GET | /deals | List deals |
| GET | /deals/:id | Get deal |
| POST | /deals/:id/assign | Assign user to deal |
| POST | /deals/:id/contract/upload | Upload DOCX/PDF |
| POST | /deals/:id/contract/paste | Paste contract text |
| GET | /deals/:id/contract/current | Current version |
| POST | /deals/:id/change-requests | Create change request |
| POST | /deals/:id/change-requests/:id/analyze | Analyze with AI |
| GET | /deals/:id/change-requests | List change requests |
| POST | /deals/:id/versions/generate | Generate new version |
| GET | /deals/:id/versions | List versions |
| GET | /deals/:id/versions/:id/diff | Get diff |
| GET | /deals/:id/timeline | Timeline events |
| GET | /deals/:id/audit | Audit log (TC/admin) |
| GET | /jobs/:id | Job status |
| GET | /health | Health check |
| GET | /llm-usage | LLM costs placeholder |
