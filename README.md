# Inventory Management System

Multi-tenant inventory tracking. FastAPI + PostgreSQL + Next.js.

## Architecture

| Layer | Choice |
| --- | --- |
| Backend | FastAPI, raw asyncpg (no ORM), Pydantic v2 |
| Database | PostgreSQL 15+, trigger-derived stock levels, append-only movement ledger |
| Frontend | Next.js App Router (TypeScript), Tailwind |
| Auth | JWT bearer tokens, argon2 password hashing |

The central design rule: **`stock_movements` is append-only and `stock_levels` is
derived from it by trigger.** Nothing writes stock levels directly, so the
ledger and the derived state can never drift.

## Quick start

From a fresh clone:

```bash
# 0. Environment files — never committed, copy the examples
cp .env.example .env                     # PowerShell: Copy-Item .env.example .env
cp backend/.env.example backend/.env     # PowerShell: Copy-Item .env.example .env
```

Generate a real `JWT_SECRET` for anything shared (must be >= 32 characters):

```bash
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Then:

```bash
# 1. Start Postgres (published on host port 5433 — see Ports below)
docker compose up -d db

# 2. Backend
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # Windows
pip install -r requirements.txt
python scripts/migrate.py
python scripts/seed.py                # optional demo data
uvicorn main:app --reload

# 3. Frontend (second terminal)
cd frontend
npm install
npm run dev
```

API docs at <http://localhost:8000/docs>. Seeded login: `demo@example.com` /
`demo1234` (override via `DEMO_EMAIL` / `DEMO_PASSWORD`).

### Ports

| Service | Host port | Override |
| --- | --- | --- |
| PostgreSQL (container 5432 published to host) | **5433** | `POSTGRES_HOST_PORT` |
| FastAPI | 8000 | `API_HOST_PORT` |
| Next.js | 3000 | `npm run dev -- -p <port>` |

Compose reads the root `.env`. The backend reads `DATABASE_URL`, `JWT_SECRET`
and `CORS_ORIGINS` from `backend/.env`. `.env.example` documents every variable.

### Note on the database port

The container listens on 5432 but is published on **host 5433**, because a local
PostgreSQL install commonly already owns 5432. If your machine has 5432 free,
set `POSTGRES_HOST_PORT=5432` in `.env` and update `DATABASE_URL` in
`backend/.env` to match.

### Gotchas

**`npm run build` breaks a running dev server.** A production build overwrites
the `.next` directory that `npm run dev` is serving from, and the dev server then
fails with `Cannot find module './571.js'`. Stop the dev server before building,
or delete `frontend/.next` and restart it afterwards.

**Background dev servers drop out.** The shell runner in this environment
intermittently kills long-running dev processes. Start them detached instead:

```powershell
# backend
cd backend
Start-Process -FilePath ".\.venv\Scripts\python.exe" `
  -ArgumentList "-m","uvicorn","main:app","--host","127.0.0.1","--port","8000","--log-level","warning" `
  -WindowStyle Hidden

# frontend
cd frontend
Start-Process -FilePath "cmd.exe" -ArgumentList "/c","npm run dev > dev.log 2>&1" `
  -WindowStyle Hidden
```

`dev.log` is gitignored via `*.log`.

## Tests

```bash
cd backend
docker compose exec -T db psql -U inventory -d postgres -c "CREATE DATABASE inventory_test;"
export DATABASE_URL="postgresql://inventory:inventory@localhost:5433/inventory_test"
python scripts/migrate.py
python -m pytest tests -q
python -m ruff check app main.py scripts tests
```

PowerShell: `$env:DATABASE_URL="postgresql://inventory:inventory@localhost:5433/inventory_test"`

The suite runs against a real Postgres, not mocks — the trigger behaviour and
the append-only guarantee are the things most worth testing, and neither can be
verified against a fake. **46 tests** cover auth, products, the movement ledger,
tenancy isolation, locations, categories, suppliers, purchase orders and
reports.

Frontend checks:

```bash
cd frontend
npm run typecheck
npm run build     # stop the dev server first — see Gotchas
```

## Layout

```
backend/
  main.py               FastAPI app, middleware, error handlers
  migrations/           Plain .sql, applied in filename order and tracked
  scripts/migrate.py    Migration runner
  scripts/seed.py       Demo organization
  app/
    config.py           Settings (pydantic-settings)
    db.py               asyncpg pool + connection/transaction helper
    auth.py             JWT encode/decode, password hashing
    deps.py             Current-user, role gates, pagination, connection DI
    errors.py           ApiError -> {"error", "code"}
    sql.py              Parameterised UPDATE/INSERT builders
    models/             Pydantic request/response schemas
    routes/             HTTP layer only; no business logic
    services/           Business logic and SQL
  tests/                Service-level and HTTP-level tests
frontend/
  app/                  App Router pages
  components/           Forms, toasts, print, shared field primitives
  lib/                  Typed API client, domain types, formatters, scan
docs/                   API and database reference
scripts/smoke.ps1       End-to-end API smoke test against a running server
```

### Frontend structure

Forms follow one contract: each takes `editing` (the row being edited, or
`null`), `onCancelEdit` and `onSaved`, and handles both create and edit from a
single set of fields. Clicking **Edit** on a table row populates the form above
it; saving resets it to create mode and refreshes the list.

Shared pieces live in `components/form/Primitives.tsx` — `Field`,
`FormActions`, `FormError`, `FormSection` — so validation, busy states and
layout stay consistent without each form reinventing them.

## Conventions

- **No ORM.** Raw asyncpg with bound parameters throughout.
- **Every query is scoped by `org_id`.** Tenant isolation is enforced in the
  service layer (see `docs/database.md` for the RLS option that layers on top).
- **Type hints everywhere**, and no `any` in TypeScript.
- **Files stay under 300 lines**; split when they grow past it.
- Comments only where logic is non-obvious.

## Configuration

| Variable | Where | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | `backend/.env` | asyncpg DSN (no `+asyncpg` prefix) |
| `JWT_SECRET` | `backend/.env` | Token signing key, >= 32 chars |
| `ACCESS_TOKEN_TTL_MINUTES` | `backend/.env` | Default 10080 (7 days) |
| `CORS_ORIGINS` | `backend/.env` | JSON list; must include the exact frontend origin |
| `POSTGRES_*`, `API_HOST_PORT` | `.env` | Compose variables |
| `DEMO_EMAIL`, `DEMO_PASSWORD` | env | Seeded demo login |

## Printing reports

`/reports` has a **Print / Save as PDF** button. It uses the browser's print
pipeline rather than server-side PDF generation — no extra dependency, it works
offline, and it respects the user's own paper size, orientation and margins
(chrome's dialog offers "Save as PDF" as a destination).

Print styling lives in `frontend/app/globals.css` under `@media print` and
follows three rules:

- App chrome (sidebar, nav, buttons) is dropped via Tailwind's `print:hidden`.
- A print-only header prints the organization name and the time the data was
  fetched, so a filed report can be traced to a snapshot.
- Tables are compacted to 10px with tighter padding, and headings/rows use
  `break-inside: avoid` so a section header never strands at a page bottom and
  a row never splits across pages.

To add printing to another screen, reuse `components/PrintButton.tsx`.

## Known gaps

- Serial/batch tracking is recorded on a product but not enforced when
  recording movements.
- API keys are generated client-side as a placeholder; there is no real
  key-based auth path yet.
- Logout clears the client token but does not revoke it server-side (tokens are
  stateless).

Every other entity — products, movements, locations, categories, suppliers and
purchase orders — has both read and write UI.

## Documentation

- [`docs/api.md`](docs/api.md) — endpoint reference
- [`docs/database.md`](docs/database.md) — schema, triggers, design decisions
- [`agent.md`](agent.md) — the original product brief