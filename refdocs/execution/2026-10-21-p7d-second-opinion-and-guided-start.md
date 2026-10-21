# Execution — P7d: the Second-Opinion Check, a calmer result, and a guided start

> Plan: `refdocs/plans/2026-10-21-p7d-second-opinion-and-guided-start.md`. Tasks run top to bottom; each has a **Verify**. Failing test first for every task. Edit this doc if reality diverges (CLAUDE.md rule 4). **Status (see CHANGELOG 2026-10-21, second entry):** A1, A2, A4, B1 to B6 and the measurement are done and verified; A3 was not built (already covered); reviews are recorded in the CHANGELOG.

## Before starting
- The Settings work (D-50) is committed, so P7d changes arrive as their own commits.
- Read `CLAUDE.md`, ADR D-03 (user scoping), D-07 (the label), D-41 (the counterfactual search), D-48 (theme), D-49 (sidebar) and D-50 (Settings, and its impersonation trade-off).
- The v3 reference is read-only: a scratch clone of `github.com/farahjayy/PaySense-v3`. Port by reading; do not copy a file without re-testing it, and never copy a figure from its reports (CLAUDE.md hard constraint 5).

## Phase A — backend, no retraining and no migration

### A1. The Second-Opinion arithmetic
- **Files:** new `backend/app/domain/second_opinion.py`, `backend/tests/domain/test_second_opinion.py`.
- **Steps:** from v3's `domain/second_opinion.py`: `stack_dues`, `exposure`, `added_probability`; an unpaid instalment whose due date has passed counts in the current month.
- **Verify:** two plans on different providers stack in the right months; an overdue instalment sits in this month; a paid instalment is ignored; amounts are exact sen (three instalments of RM799 sum to 79,900); `added_probability` is never negative and is `None` when either side is `None`; the Bank Negara flag is `None` with no recorded limits.

### A2. Wire it into the risk check
- **Files:** `backend/app/api/risk.py`, `backend/app/engines/risk/check.py` if the plan list is not already in hand, `backend/tests/api/test_risk_api.py`.
- **Steps:** build `second_opinion` from the same plans, limits and confirmed income the check already reads (one ledger read, as in the P6 performance fix); "without" and "with" come from the same simulation and seed; store it in the frozen report; optional field on read.
- **Verify:** the response carries `second_opinion` and `with - without` equals `added_probability` within rounding; a report saved before this change still opens; two-user isolation (user B's plans never appear in A's stack); the p95 of a check on the 200-student serving set stays within the P6 figure (`reports/engine2/serving_check.md`), run and the number recorded.

### A3. Start dates after income dates — NOT BUILT (deviation)
> D-41's search already tries buying the day after the next confirmed income, judged by direct simulation; a second income date adds one candidate to a grid capped at 60 evaluations. Nothing to do.
- **Files:** `backend/app/engines/risk/counterfactual.py` (or where D-41 lives), its tests.
- **Steps:** read v3's `engines/risk/schedule.py` and add only its candidate start dates (the day after each of the next two confirmed income dates) to the existing grid; keep judging by direct simulation, the "no better than doing nothing" rule and the effort order.
- **Verify:** a student with a confirmed income date gets a candidate that starts the day after it; a student already At Risk without the purchase gets no timing suggestion and a stated reason; existing counterfactual tests still pass; the count of simulations per check is unchanged or reported.

### A4. Alerts
- **Files:** new `backend/app/domain/alerts.py`, `backend/app/api/alerts.py`, `backend/app/main.py`, tests.
- **Steps (as built):** three rules: overdue instalments; two or more payments within a week in the next two weeks; a provider limit 80% used. The forecast's own warning and a locked forecast are not repeated (the dashboard's main card says them). At most one overdue and one collision alert, one limit alert per provider. Domain stays pure (no engine import): the route turns confirmed bills into dated payments.
- **Verify:** a table test per rule (fires, does not fire, boundary); a limit exactly at 80% fires; two-user isolation and an unauthenticated 401 for `GET /api/alerts`; `npm run gen:api` and `check:api` pass.

## Phase B — frontend

### B1. The fold
- **Files:** `frontend/components/ui/Fold.tsx`, test.
- **Verify:** closed by default, Enter and Space toggle it, `aria-expanded` follows, the summary is read when closed, axe clean.

### B2. The layered result and the Second-Opinion tiles
- **Files:** `components/risk/RiskResult.tsx`, new `SecondOpinion.tsx`, `SecondOpinionTable.tsx`, `lib/risk.ts`, tests.
- **Steps:** visible: score and band, the line, the three tiles, the already-At-Risk note, Why, the suggestion, Going ahead. Folded: month by month, exposure, schedule and cost (the existing `PlanPreviewPanel`), margin chart, repayment, the two-numbers note. "Open all".
- **Verify:** the first view holds at most the cards listed; each fold's summary shows its figures (for example "Peak RM 266.33 in Nov 2026"); the table is a real `<table>` with a caption and header cells; a report without `second_opinion` renders without the block; tested at 375, 768 and 1440 px.

### B3. The alert line
- **Files:** `components/dashboard/AlertLine.tsx`, `DashboardScreen.tsx`, tests.
- **Verify:** renders nothing when there are no alerts; one slim line with a count that opens the list; no extra cards on a healthy account.

### B4. Intro and tour
- **Files:** `components/onboarding/Intro.tsx`, `Tour.tsx`, `lib/introTour.ts`, `data-tour` markers in `components/layout/AppShell.tsx`, a "Show the intro again" row in Settings, tests.
- **Steps:** three slides (no empty half-panel: the copy sits centred beside its picture), six stops, a stop with nothing visible is skipped; a phone's stops point at the bottom bar; `localStorage` access always in try/catch.
- **Verify:** first sign-in shows the intro once; Skip and Escape work and focus returns; blocked storage shows it again next visit but never twice in a visit; the replay row restarts it; reduced motion shows the finished state; axe clean.

### B5. About the model
- **Files:** `components/screens/ModelScreen.tsx`, tests.
- **Verify:** every number on the page comes from `/api/model-info` (a test fails on a typed digit string that is not in the payload); "What it never looks at" lists exactly the features' complement (`features.py` has no age, gender, ethnicity, nationality or employment).

### B6. Browser journeys
- **Verify:** Playwright, desktop and phone, on the production build with the nonce CSP: sign in, see intro, take the tour, run a risk check, open a fold, see the tiles; a second journey with an account that has a limit near 80% shows the alert line. Screenshots reviewed by the author at 375 and 1440 px.

## Phase C — measurement for Batch B (done)
> Built as `backend/ml/buffer_check.py` (a measurement script; it adds a buffer through the simulator's existing `month_to_date_sen`, so no engine file changed) and `reports/buffer_check/`. Result: with no buffer, 0 of 10 purchases reach Safe for each persona; with RM1,000, 24 of 30 do. The savings-buffer round is therefore worth its own plan.
- Run the five designed cases and the three personas with and without a RM1,000 buffer; write the table to `reports/` from a script. **Verify:** the script's command and output are in the CHANGELOG. Outcome decides whether plan C (engine round) is written.

## Wrap-up
- [ ] ADRs D-51 to D-54 confirmed or amended; PRD §7 lines match
- [ ] `/security-review` and the fastapi, react and python reviewers run; HIGH and MEDIUM findings fixed
- [ ] `cd backend && uv run ruff check . && uv run ruff format --check . && uv run pytest -q`; `cd frontend && npm run lint && npx tsc --noEmit && npm run test && npm run build && npx playwright test` — named with results in the CHANGELOG
- [ ] CHANGELOG, STATUS (P7d row and the verification ledger); UAT task script re-read against the new result screen
