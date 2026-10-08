# Plan — P0 Foundation

> Phase P0 of `refdocs/paysense-v2-PRD.md` §6. Execution doc: `refdocs/execution/2026-10-08-p0-foundation.md`.
> A plan says **what and why**. The execution doc says **how and in what order**. Keep them separate — when they merge, both stop being read.

## Why this exists

Every later phase needs four things that v1 either lacked or bolted on late: (1) a dependency set that actually installs and fits the host's memory, (2) per-user data isolation (v1 was single-user, and UAT needs 5–7 separate testers), (3) a frontend whose API types cannot drift from the backend (v1 hand-mirrored `types.ts` and `providers.ts`), and (4) test tooling on both sides (v1's frontend had none). Getting these right before any domain code means P1–P9 build on ground that won't move.

## What's already covered (no work needed)

- Stack choice (D-02), auth model (D-03), hosting plan (D-15) — decided.
- Design tokens and UI kit exist in v1 (`../PaySense/frontend/components/ui/`, `docs/UI_SPEC.md`); P0 copies only the tokens and the login/shell, the rest is P7.
- The data model is specified in PRD §3.2.

## Scope

**In:**
- `uv` installed; Python version pinned after a dependency spike.
- Dependency & memory spike: the full ML stack installed in a throwaway env; versions and resident memory recorded.
- `backend/`: uv project, FastAPI app factory, settings with fail-fast validation, `/api/health`, structured error envelope, Ruff, pytest.
- `backend/migrations/0001_init.sql`: every PRD §3.2 table with `user_id`, constraints, indexes, RLS enabled.
- Username login: `POST /api/auth/login`, `GET /api/auth/me`, HS256 bearer tokens, `current_user` dependency, `scripts/seed_users.py` admin script.
- User-scoped repository base + a two-user isolation test.
- `frontend/`: Next.js (App Router, TS strict, Tailwind 4) with v1's design tokens, login page, authed layout shell (sidebar / bottom nav), TanStack Query provider.
- Generated API client: `openapi-typescript` + `openapi-fetch`, `npm run gen:api`, and a drift check script.
- Test tooling: pytest + httpx (backend), Vitest + Testing Library (frontend), Playwright with one smoke test (login → shell).

**Out (and why):**
- Any domain endpoint (transactions, plans…) — P1; P0 proves the plumbing with `auth` and `health` only.
- ML code — P2 onward; the spike only *installs* and *imports* the stack.
- Deployment — P8; P0 only keeps every URL env-driven.
- CI service (GitHub Actions) — optional later; local scripts first.

## Approach

1. Spike first, because its result (Python version, whether PyTorch/Prophet fit) changes `pyproject.toml` and possibly D-15.
2. Backend before frontend, because the frontend's client is generated from the backend's OpenAPI.
3. The repository layer is the isolation boundary: route handlers never build queries; they call repository functions whose first parameter is `user_id`. One test logs in as two users and proves neither sees the other's rows.
4. The DB is accessed only by the backend with the service key; RLS is turned on with no policies so the public anon key can read nothing.

## Risks & unknowns

| Risk / unknown | Confidence | Mitigation |
|---|---|---|
| Prophet (cmdstan) or PyTorch has no wheel for the pinned Python on Windows or Linux | Medium — unverified | The spike tries 3.12 first, then 3.11; records the outcome in an ADR update to D-23 |
| Full served stack exceeds Render's 512 MB | Medium — PyTorch + SHAP are heavy | Spike measures RSS of a process importing the served set; D-15 fallback (ONNX Runtime, then Cloud Run 1 GiB) |
| supabase-py API differs from what v1 used | High that it works (v1 used it) | Read the installed version's docs/types before writing the client wrapper |
| `openapi-fetch` + Next.js App Router server/client boundary | Medium | Use the client only in client components / TanStack Query hooks in P0; read the library docs first |
| Tailwind 4 + Next.js setup differences from v1 | High (v1 already ran Tailwind 4 + Next 16) | Copy v1's `postcss.config.mjs` / `globals.css` token pattern |
| The author has not created the Supabase project yet | Known | The one allowed pause: ask for `SUPABASE_URL` + service key; build everything else meanwhile |

## Definition of done

This phase is done when every line below is true and has been *observed*, not assumed:

- `reports/spikes/p0-dependency-spike.md` exists with the Python version used, every package version installed, and the measured RSS; D-23 and D-15 are updated from `ASSUMED` to decided.
- `cd backend && uv run pytest` passes, including `test_user_isolation` (two seeded users, each sees only their own rows) and login tests (unknown username → 401 with the error envelope; valid → token; expired/forged token → 401).
- `cd backend && uv run ruff check .` is clean.
- The backend refuses to start with a missing `SESSION_SECRET` and names the variable.
- `0001_init.sql` has been applied to the real Supabase project and `select` with the anon key returns no rows from any table.
- `cd frontend && npm run gen:api && npx tsc --noEmit && npm run lint && npm run test && npm run build` all pass.
- `npx playwright test` passes the smoke test: open `/`, redirected to `/login`, log in as a seeded user, land on the shell showing the display name.
