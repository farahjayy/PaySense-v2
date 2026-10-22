# Execution — A simple admin role, and the intro replay as an admin tool

> Plan: `refdocs/plans/2026-10-22-admin-role.md`. **Status: Phases A and B built and verified (see CHANGELOG 2026-10-22); Phase C is the author's.** Tasks run top to bottom; each has a **Verify**. Failing test first for every task. Edit this doc if reality diverges (CLAUDE.md rule 4).

## Before starting
- Read ADR D-03 (user scoping, seeded accounts), D-53 (the intro and tour), D-54 (login) and D-56 (this).

## Phase A — backend
### A1. The role on the user
- **Files:** `backend/migrations/0003_user_roles.sql`, `backend/migrations/README.md`, `backend/app/db/users.py`, `backend/app/seed.py`, `backend/tests/fakes.py` (the fake's default), `backend/tests/test_users_repo.py`.
- **Verify:** a new user defaults to `"user"`; `create(role="admin")` stores it; `set_role` changes it and refuses anything but `user` or `admin`; a user row with no `role` key (a database before the migration) still reads as `"user"` where it is read.

### A2. The role in the API, and `require_admin`
- **Files:** `backend/app/api/schemas.py`, `backend/app/api/deps.py`, `backend/app/api/auth.py`, `backend/tests/test_auth.py`.
- **Verify:** sign-in and `/api/auth/me` return the role; a normal user is refused by an admin-only route with 403 `forbidden`; an admin passes; an unauthenticated request is still 401; demoting an admin takes effect on their next request with the same token (the role is read from the database, not the token).

### A3. The scripts
- **Files:** `backend/scripts/set_role.py`, `backend/scripts/seed_users.py`, tests alongside the existing seed tests.
- **Verify:** `set_role` on an existing username sets the role and, if given, the display name, and is idempotent; an unknown username is a clear error; a bad role is refused; `seed_users --role admin` creates an admin.

## Phase B — frontend
### B1. The session keeps the role
- **Files:** `frontend/lib/session.ts`, `frontend/lib/api/schema.d.ts` (`npm run gen:api`), `frontend/tests/unit/session.test.ts`.
- **Verify:** a stored session with a role keeps it; one without reads as `"user"`; an unknown role string is kept and does not log the person out.

### B2. The Admin card in Settings
- **Files:** `frontend/components/screens/SettingsScreen.tsx`, `frontend/tests/unit/SettingsScreen.test.tsx`, `frontend/tests/e2e/journey.spec.ts`.
- **Verify:** an admin sees the Admin card and **Show the intro again** plays the slides from the first one; a normal user sees no Admin card and no replay button; "Other" no longer holds the replay; the Playwright journey that replays the intro signs in as an admin.

## Phase C — the author's account (done by the author)
1. Paste `0003_user_roles.sql` into the Supabase SQL editor and run it.
2. `cd backend && uv run python scripts/set_role.py --username <your-username> --role admin --display Farah`
3. Sign out and back in; Settings shows the Admin card, and the greeting says Farah.

## Wrap-up
- [ ] ADR D-56 (and a note on D-53); PRD §7 one-liner; CHANGELOG; STATUS; the plans index; `migrations/README.md`
- [ ] `cd backend && uv run ruff check . && uv run ruff format --check . && uv run pytest -q`; `cd frontend && npx tsc --noEmit && npx eslint . && npx vitest run && npm run build && npx playwright test`, named with results
- [ ] security-reviewer (a new authorisation check)
