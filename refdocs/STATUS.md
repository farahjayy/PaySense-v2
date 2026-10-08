# PaySense v2 — Build Status

> **Read this first to know where we are.** Updated at the end of every build session. Phases and scope come from `refdocs/paysense-v2-PRD.md` §6. Don't reorder phases without updating this file and saying why (CLAUDE.md "keep docs current").

**Build philosophy:** dependency order, no dates. Each phase ends green — tested and actually run — before the next one starts. Port what v1 proved, rebuild what v1 got wrong, and never ship a number that doesn't trace to a model, a simulation or the user's data.

**Right now:** Nothing is built. This project was scaffolded on 2026-10-08 — the docs, agent config, and the P0 plan exist; no code does. The next session starts at `refdocs/plans/2026-10-08-p0-foundation.md`.

---

## Phase checklist

| Phase | Scope | Status |
|---|---|---|
| P0 Foundation | Monorepo skeleton, tooling, Supabase migrations, username login + user scoping, OpenAPI→TS client, dependency & memory spike | ⬜ Not started |
| P1 Ledger & BNPL domain | Port v1 domain + tests, transactions/plans/balance/providers APIs, CSV import, recurring items, provider limits | ⬜ Not started |
| P2 Synthetic population | `ml/datagen`, cited params, persona CSVs, Engine 2 profiles, Engine 1 cohort | ⬜ Not started |
| P3 Engine 1 evaluation | 5 forecasters × 4 datasets, rolling-origin, MASE + significance, reports | ⬜ Not started |
| P4 Engine 1 serving | Recurring detection, component forecaster, Monte Carlo, `/api/forecast`, health score | ⬜ Not started |
| P5 Engine 2 training | Simulation labels, shared features, 4 classifiers, tuning, CV, calibration, ablation | ⬜ Not started |
| P6 Engine 2 serving | Risk check, SHAP, counterfactuals, repayment flag, confirm, frozen report | ⬜ Not started |
| P7 Frontend | All screens on the v1 design system, all states, Playwright journey | ⬜ Not started |
| P8 Deployment | Vercel + Render + Supabase SG, live functional checklist | ⬜ Not started |
| P9 UAT kit | Tester seeding, persona CSVs, instruments, consent, analysis script | ⬜ Not started |
| P10 Optional | LLM-phrased explanations, figure pack | ⬜ Not started |

Status vocabulary — use these exactly, and never round up:
- ⬜ **Not started**
- 🔶 **In progress** — say precisely what works and what doesn't
- ✅ **Done** — built *and* verified. If it compiles but was never run, it is not done.
- ⛔ **Blocked** — name the blocker and who/what unblocks it

---

## P0 — Foundation (current phase)

| Item | Approach | Status |
|---|---|---|
| Toolchain | Install `uv`; pin Python via `.python-version` (D-23) | ⬜ |
| Dependency & memory spike | Install the full ML stack in a throwaway env, record versions + RSS in `reports/spikes/p0-dependency-spike.md` | ⬜ |
| Backend skeleton | `backend/` uv project, FastAPI app factory, settings with fail-fast env validation, `/api/health`, Ruff + pytest | ⬜ |
| Database | Supabase project (Singapore), `backend/migrations/0001_init.sql` (users, user_settings, transactions, recurring_items, bnpl_plans, bnpl_installments, provider_limits, risk_checks), RLS on | ⬜ |
| Auth | `POST /api/auth/login`, `GET /api/auth/me`, HS256 bearer token, `current_user` dependency, admin seeding script | ⬜ |
| User-scoped repository layer | Every function takes `user_id`; isolation test with two users | ⬜ |
| Frontend skeleton | `frontend/` Next.js + TS + Tailwind 4, v1 design tokens, login page, authed layout shell | ⬜ |
| Typed client | `openapi-typescript` + `openapi-fetch`, `npm run gen:api`, drift check | ⬜ |
| Test tooling | pytest (backend), Vitest + Testing Library (frontend), Playwright installed with one smoke test | ⬜ |

---

## Verification ledger

What has actually been run, not what has been written. A row here needs a real command and a real result.

| Date | What was verified | How | Result |
|---|---|---|---|
| — | — | — | nothing verified yet |

---

## Known gaps

- No code exists yet; a file-structure doc will be written once there is a tree to describe (README §Project layout carries the planned layout until then).
- Five working assumptions are open (`changelog/DECISIONS.md` bottom) — the first two are resolved by the P0 spike.
- Grab PayLater and Boost PayFlex rules are unverified — manual first-payment entry until a real checkout is recorded (D-24).
- The simulation-label design should be shown to the supervisor before P5 (PRD §8 Q7).
- `gh` (GitHub CLI) is not installed; the author creates GitHub repos and pushes herself.
