# QA Plan — Contract Negotiation System MVP

## Environment Setup
- docker-compose up --build
- Services: postgres (5432), redis (6379), api (8000), worker (celery), web (3000)
- Env: apps/api/.env (from .env.example), apps/web/.env (from .env.example)

## Test Execution
1. `docker-compose exec api alembic upgrade head` — run migrations
2. `docker-compose exec api python seed.py` — seed demo data
3. `docker-compose exec api python -m pytest tests/ -v` — unit tests
4. `docker-compose exec api python scripts/qa_smoke_test.py` — API smoke tests
5. Manual E2E via browser at http://localhost:3000

## Acceptance Criteria Checklist
- [ ] AC1: User can signup/login
- [ ] AC2: Admin/TC can create a deal and assign users
- [ ] AC3: Upload or paste contract creates v0 and shows contract text
- [ ] AC4: AI parses contract → field summary appears (even if partial)
- [ ] AC5: Agent or TC can create a change request
- [ ] AC6: AI analyzes request → shows parsed JSON + questions/recommendation
- [ ] AC7: TC generates a new version (v1) and views diff vs v0
- [ ] AC8: Timeline shows events and current deal state changes
- [ ] AC9: Audit log records key actions
- [ ] AC10: No secrets in repo; key only in env

## Mock Mode
- When ANTHROPIC_API_KEY is missing or LLM_MOCK_MODE=true:
  - All LLM calls return deterministic sample data
  - Logs warn about mock mode
  - UI shows mock mode banner
  - All acceptance criteria can still be verified end-to-end

## Security Checks
- No sk-ant- patterns in source (README placeholder excluded)
- .env in .gitignore
- Logs never print API key or JWT secret
- File upload limited to 10MB
