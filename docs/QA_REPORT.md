# QA Report — Contract Negotiation System MVP

## Environment
- **API**: FastAPI on port 8000
- **Web**: Next.js on port 3000
- **PostgreSQL**: port 5432
- **Redis**: port 6379
- **Worker**: Celery (same Docker image as API)

## Issues Found & Fixes Applied

### FIX 1: LLM Mock Mode (CRITICAL)
**File**: `apps/api/llm/anthropic_client.py`
**Issue**: No mock mode existed. Without ANTHROPIC_API_KEY, all LLM calls would crash (RuntimeError), making the entire E2E flow impossible without a real key.
**Fix**: Added `is_mock_mode()` function and deterministic mock responses for all three LLM operations (parse, analyze, generate). Mock activates when `ANTHROPIC_API_KEY` is empty or `LLM_MOCK_MODE=true`.

### FIX 2: JobRecord Primary Key Violation (CRITICAL)
**Files**: `apps/api/routers/contracts.py`, `apps/api/routers/change_requests.py`, `apps/api/routers/versions.py`
**Issue**: `JobRecord` was created with `id=""` (empty string), committed to DB, then updated with the Celery task ID. This causes a PK violation on the initial insert since `""` is not a valid PK for concurrent requests, and the UPDATE pattern is fragile.
**Fix**: Reordered to call `task.delay()` first, get the task ID, then create the `JobRecord` with the real ID in a single insert.

### FIX 3: Missing Python Dependencies
**File**: `apps/api/requirements.txt`
**Issue**: `email-validator` (required by Pydantic `EmailStr`) and `pytest` / `pytest-asyncio` were missing.
**Fix**: Added `email-validator==2.2.0`, `pytest==8.3.4`, `pytest-asyncio==0.24.0`.

### FIX 4: docker-compose env_file Fragility
**File**: `docker-compose.yml`
**Issue**: `env_file: ./apps/api/.env` would fail if `.env` not yet copied from `.env.example`. Also `env_file` for web was similarly fragile.
**Fix**: Removed `env_file` references. All required vars are now set directly via `environment` block with `${VAR:-default}` syntax for passthrough from host environment. This means `docker-compose up` works without any `.env` file (mock mode auto-activates).

### FIX 5: Celery Worker Command
**File**: `docker-compose.yml`
**Issue**: Worker command `celery -A workers.celery_app worker` might not resolve the celery instance correctly.
**Fix**: Changed to explicit `celery -A workers.celery_app:celery_app worker --loglevel=info`.

### FIX 6: File Upload Size Limit
**File**: `apps/api/routers/contracts.py`
**Issue**: No upload size limit — potential abuse vector.
**Fix**: Added `MAX_UPLOAD_SIZE = 10 * 1024 * 1024` (10 MB) check before processing.

### FIX 7: Mock Mode UI Banner
**File**: `apps/web/src/app/deals/layout.tsx`
**Issue**: No UI indicator when LLM mock mode is active. Users wouldn't know AI responses are simulated.
**Fix**: Added `/health` polling on layout mount. When `llm_mock_mode: true`, shows an orange banner: "LLM Mock Mode Active — AI responses are simulated."

### FIX 8: Health Endpoint Mock Status
**File**: `apps/api/main.py`
**Issue**: `/health` didn't expose whether mock mode was active.
**Fix**: Added `llm_mock_mode` field to health response.

### FIX 9: LLM_MOCK_MODE in .env.example
**File**: `apps/api/.env.example`
**Issue**: Missing `LLM_MOCK_MODE` config option.
**Fix**: Added with default `false` and comment.

### FIX 10: Missing conftest.py for pytest
**File**: `apps/api/conftest.py`
**Issue**: `pytest` run from project root couldn't find module imports.
**Fix**: Added `conftest.py` that adds the api directory to `sys.path`.

### FIX 11: Missing QA Smoke Test
**File**: `apps/api/scripts/qa_smoke_test.py`
**Issue**: No automated E2E API test existed.
**Fix**: Created comprehensive smoke test covering all endpoints, auth, RBAC, ingestion, analysis, version generation, diffs, timeline, and audit access control.

### FIX 12: Missing LLM Mock Unit Tests
**File**: `apps/api/tests/test_llm_mock.py`
**Issue**: No tests for mock mode behavior.
**Fix**: Added 5 tests covering mock activation logic and deterministic response validation.

## Test Commands

```bash
# Unit tests
docker-compose exec api python -m pytest tests/ -v

# API smoke test (requires running services)
docker-compose exec api python scripts/qa_smoke_test.py http://localhost:8000

# Frontend build verification
docker-compose exec web npm run build
```

## Security Verification
- [x] No `sk-ant-` patterns in source code (only README placeholder `sk-ant-...`)
- [x] `.env` in `.gitignore`
- [x] `config.py` masks all sensitive keys in `safe_dict()`
- [x] Logs never include `ANTHROPIC_API_KEY` or `JWT_SECRET` values
- [x] File upload limited to 10 MB
- [x] No real secrets committed to repo

## Acceptance Criteria — Final Status

| # | Criteria | Status |
|---|---------|--------|
| AC1 | User can signup/login | PASS |
| AC2 | Admin/TC can create a deal and assign users | PASS |
| AC3 | Upload or paste contract creates v0 and shows contract text | PASS |
| AC4 | AI parses contract → field summary appears | PASS (mock or real) |
| AC5 | Agent or TC can create a change request | PASS |
| AC6 | AI analyzes request → parsed JSON + questions + recommendation | PASS (mock or real) |
| AC7 | TC generates new version (v1) and views diff vs v0 | PASS |
| AC8 | Timeline shows events and current deal state changes | PASS |
| AC9 | Audit log records key actions | PASS |
| AC10 | No secrets in repo; key only in env | PASS |

## Known Limitations (MVP scope)
- Export only supports `.txt` (PDF/DOCX export stubbed)
- Negotiation state machine transitions are manual (no automatic state changes on CR/version creation)
- No real-time WebSocket updates (frontend polls job status every 2s)
- No password reset flow
- No pagination on list endpoints
- Mock mode data is static (same fields regardless of input text)

## Overall Status: PASS
All 10 acceptance criteria pass. The system runs end-to-end via `docker-compose up` with or without an Anthropic API key.
