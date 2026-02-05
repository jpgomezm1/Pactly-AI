# Architecture Overview

## System Components

### Backend (FastAPI)
- **Routers**: REST API endpoints for auth, deals, contracts, change requests, versions, timeline, jobs
- **Services**: Business logic layer (ingestion, contract intelligence, diffing, versioning, RBAC, timeline)
- **Models**: SQLModel ORM models (User, Deal, ContractVersion, ChangeRequest, NegotiationCycle, AuditEvent, JobRecord)
- **LLM**: Anthropic SDK wrapper with JSON schema enforcement and retries
- **Workers**: Celery background tasks for parse, analyze, generate operations

### Frontend (Next.js)
- App Router with protected routes
- TanStack Query for server state
- shadcn/ui component library
- Job polling for background task status

### Infrastructure
- PostgreSQL: Primary database
- Redis: Celery broker/backend
- Docker Compose: Local development orchestration

## Data Flow

1. **Ingestion**: Upload/paste → ContractVersion v0 → background parse → extracted fields
2. **Change Request**: User submits text → AI analyzes → structured JSON result
3. **Version Generation**: Deterministic field apply → Constrained LLM text generation → ContractVersion vN
4. **Diff**: Computed deterministically in Python between any two versions

## Security
- JWT auth with role-based access control
- API key from environment only, never logged
- CORS restricted to localhost:3000
