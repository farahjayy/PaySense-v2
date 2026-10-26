# PaySense v2 — Local setup

How to run the backend (FastAPI) and the frontend (Next.js) on your own machine, and what to do when they will not start. The full list of environment variables, and where to get each, is in [`refdocs/guides/env_setup.md`](refdocs/guides/env_setup.md).

> **This repository is public.** Never put a real key in a file that is committed. `backend/.env` and `frontend/.env.local` are gitignored; keep it that way.

## 1. What you need

| Tool | Version | Check with |
|---|---|---|
| [uv](https://docs.astral.sh/uv/) (installs and pins Python) | any recent | `uv --version` |
| Python | 3.12 (pinned in `backend/.python-version`, uv fetches it) | `uv run python --version` |
| Node.js | 20 or newer (developed on 24) | `node -v` |
| A Supabase project | free tier, Singapore region | — |

## 2. One-time setup

```bash
# from the repository root
cd backend
cp .env.example .env            # then fill it in (section 3)
uv sync                         # creates backend/.venv and installs the pinned packages

cd ../frontend
cp .env.example .env.local      # then fill it in (section 3)
npm install
```

Apply the SQL files in `backend/migrations/` to your Supabase project **in order** (`0001_init.sql`, `0002_user_categories.sql`, `0003_user_roles.sql`) using the Supabase SQL editor.

## 3. Environment files

**`backend/.env`** (the server stops at start-up if a required one is missing):

| Variable | Needed | Value |
|---|---|---|
| `SUPABASE_URL` | yes | Supabase dashboard → Project Settings → API → Project URL |
| `SUPABASE_SERVICE_KEY` | yes | the **secret / service_role** key from the same page. Server only: never in the frontend |
| `SESSION_SECRET` | yes | `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `CORS_ORIGINS` | yes | `http://localhost:3000` (comma-separated, no trailing slash) |

**`frontend/.env.local`**:

| Variable | Needed | Value |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | yes | `http://localhost:8000` |

## 4. Start it (two terminals)

**Terminal 1: backend**

```bash
cd backend
uv run uvicorn app.main:app --reload --port 8000
```

It is up when it prints `Uvicorn running on http://127.0.0.1:8000`. Check it:

```bash
curl http://127.0.0.1:8000/api/health        # → {"status":"ok"}
```

The interactive API documentation is at <http://127.0.0.1:8000/docs>.

**Terminal 2: frontend**

```bash
cd frontend
npm run dev
```

Open <http://localhost:3000>. It shows the welcome page; sign in with a username you have seeded (next section).

**Order matters a little:** start the backend first. The frontend starts without it, but every page that needs data will show an error until the backend answers.

**Stopping:** press `Ctrl+C` in each terminal.

## 5. Create a user to sign in with

Sign-in is by username only; accounts are created by a script, never by the app.

```bash
cd backend
uv run python scripts/seed_users.py --username demo --display "Demo" --persona budget_conscious
```

- `--persona` loads synthetic data. Choices: `budget_conscious`, `frequent_bnpl`, `irregular_income`. Leave it out for an empty account.
- `--role admin` makes an admin (adds the Admin page and "View as a user").
- Running it again is safe (it is idempotent). Change an existing account's role or name with `scripts/set_role.py`.

## 6. Everyday commands

| What | Command (run in the folder shown) |
|---|---|
| Backend tests | `backend`: `uv run pytest` (the `-m integration` tests hit the real Supabase) |
| Backend lint and format check | `backend`: `uv run ruff check . && uv run ruff format --check .` |
| Frontend lint | `frontend`: `npm run lint` |
| Frontend type check | `frontend`: `npx tsc --noEmit` |
| Frontend unit tests | `frontend`: `npm run test` (with coverage: `npm run test:cov`) |
| Production build | `frontend`: `npm run build` |
| End-to-end tests | `frontend`: `npx playwright test` (starts its own backend on 8100 and frontend on 3100, so it does not clash with the two above) |
| Regenerate API types | `frontend`: `npm run gen:api` — **after any backend route or schema change**; the generated types are the contract between the two |

## 7. When it will not start

| Symptom | Cause and fix |
|---|---|
| Backend exits at once, naming a missing setting | A required variable in `backend/.env` is empty. Fill it in (section 3). |
| `Address already in use` / `EADDRINUSE` on 8000 or 3000 | Something already holds the port. Windows: `netstat -ano \| findstr :8000`, then `taskkill /PID <pid> /F`. Or use another port (`--port 8001`; `npm run dev -- --port 3001`) and update `CORS_ORIGINS` and `NEXT_PUBLIC_API_BASE_URL` to match. |
| The pages load but every request fails ("Failed to fetch", a CORS message) | `CORS_ORIGINS` must contain exactly the frontend's address (`http://localhost:3000`), and `NEXT_PUBLIC_API_BASE_URL` the backend's. `NEXT_PUBLIC_*` values are read when the frontend starts, so restart `npm run dev` after changing one. |
| Sign-in says the username is not found | Seed it (section 5). Usernames are exact. |
| You changed the code and the page looks the same | Hard-refresh (`Ctrl+Shift+R`); if it still does, stop and restart `npm run dev`. |
| `npm run dev` or `npm run build` stops once with a "known security vulnerability" notice and exit code 1 | The installed Next.js (16.4.0) is flagged by the npm advisory database. The command stops once to show the notice; run the same command again and it carries on. `npm audit` lists the advisories and a fixed version (16.4.2). Upgrading is a decision for the project owner. |
| `npm run lint` reports thousands of problems under `frontend/.next-devcheck/` | A leftover build folder from a test run. Delete it; it is build output. |
| The backend refuses to start with a model or feature-schema message | The files under `backend/models/` do not match the code's feature schema (a deliberate guard). Restore the matching artefacts; do not edit the check. |

## 8. Where things are

```
backend/   FastAPI app (app/), offline ML (ml/), model artefacts (models/), SQL migrations, scripts
frontend/  Next.js app (app/, components/, lib/), unit tests (tests/unit), end-to-end tests (tests/e2e)
refdocs/   the PRD, STATUS, decisions (ADRs), plans, execution docs and guides
```

The project's operating rules (plan before building, tests first, update the changelog, never push) are in [`CLAUDE.md`](CLAUDE.md); where the build has got to is in [`refdocs/STATUS.md`](refdocs/STATUS.md).
