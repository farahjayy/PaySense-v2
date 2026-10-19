# Execution — P7c Existing BNPL plans, the pond theme, and the agreed ledger polish

> Plan: `refdocs/plans/2026-10-19-p7c-existing-plans-and-theme.md`. Tasks run top to bottom; each has a **Verify**. Edit this doc if reality diverges (CLAUDE.md rule 4).

## Before starting

- Read `CLAUDE.md`, `refdocs/STATUS.md`, ADR D-28 to D-30, D-41, D-43 to D-46.
- Every backend change starts with a failing test. `progress_material/` stays out of the repo, tests and docs.
- Phases are ordered by dependency: A and B change behaviour and need no theme; C changes only tokens and shared pieces; D to F are independent of each other.

---

## Phase A: existing plans (backend)

### Task P1: Past instalments recorded as paid (tests first)
- **Files:** `app/api/plans.py` (`PlanIn.paid_seqs`, `log_payments`), `app/db/plans.py` (`store_plan`, a `mark_paid` that does not log), `tests/api/test_plans_api.py`, `tests/test_plans_repo.py`.
- **Steps:** instalments in `paid_seqs` are stored paid with `paid_date` = due date; a transaction is logged only when `log_payments` is true; a `seq` that is not in the plan, or is after today, is a 422; an instalment not listed stays unpaid and overdue.
- **Verify:** her case (purchase four months back, six instalments, four recorded) leaves two owed and no transactions; with `log_payments` four linked payments exist and none is duplicated on a retry; two-user isolation test.

### Task P2: Current-state check of the remaining schedule (tests first)
- **Files:** `app/api/risk.py` or `app/api/plans.py` (`POST /api/plans/{plan_id}/risk-check`), `app/engines/risk/check.py` (accept plans to leave out), `app/db/plans.py` (link and type), `tests/api/test_risk_api.py`, `tests/engines/test_check.py`.
- **Steps:** build the remaining schedule from unpaid instalments (provider-less manual proposal: first date = the next unpaid due date, count = remaining, total = their sum); run with the plan excluded from the plans passed in; freeze as `current_state`; link to the plan, keep `risk_score_at_creation`; a plan with nothing unpaid is refused with a clear message; a locked ledger returns the locked result and stores nothing.
- **Verify:** the result equals the check of the same schedule with the plan absent (the double-count test); a different user's plan is a 404; the old report link is replaced and the previous report is kept in `risk_checks` unreferenced only if it was a creation report.

### Task P3: Report type and plan fields
- **Files:** `app/api/plans.py` (`PlanOut.risk_check_id`, `risk_check_type`, `risk_checked_at`), `app/api/risk.py` (`RiskCheckOut.check_type`, `_from_row`), tests; then `npm run gen:api`.
- **Verify:** `check:api` exits 0; an old saved report still reads (back-filled, as D-46 did); money fields still pass the integer-sen walk.

### Task P4: Run the check when an existing plan is added
- **Files:** `app/api/plans.py` create route, tests.
- **Steps:** after creation, if instalments remain and the ledger is long enough, run P2 and link it; never fail the creation because the check could not run.
- **Verify:** created plan carries a report; a short ledger creates the plan with `risk_check_id` null.

## Phase B: plan card and form (frontend)

### Task P5: Past-instalments section in the plan form (tests first)
- **Files:** `frontend/components/plans/PlanForm.tsx`, new `PastInstalments.tsx`, `lib/plans.ts`, tests.
- **Steps:** the section appears only when the previewed schedule has dates before today; one Paid checkbox per past instalment (default ticked), the "also add to transactions" switch (default off) with its helper text, and the sentence that past instalments are a record and do not change the forecast.
- **Verify:** unit tests for both defaults and for sending `paid_seqs` and `log_payments`.

### Task P6: The plan keeps its statistics
- **Files:** `frontend/components/screens/PlansScreen.tsx`, new `PlanRisk.tsx`, `app/(app)/risk/[id]/page.tsx`, `components/screens/RiskReportScreen.tsx`, tests.
- **Steps:** face, band, score, "as at" date, View report, Check again; the report screen titles itself by `check_type` and hides "Going ahead?".
- **Verify:** unit tests; Playwright: add an existing plan, see its card carry a report, open it.

## Phase C: pond theme

### Task T1: Tokens, fonts, radii, shared Face
- **Files:** `app/globals.css`, `app/layout.tsx`, `app/login/login.css` and `layout.tsx` (use the shared tokens), `components/ui/Face.tsx`, `components/layout/AppShell.tsx`, `components/ui/*`, `lib/colours.ts` (category colours).
- **Verify:** `scripts/contrast` output for every text, border and chart colour is kept in the changelog; axe test passes; screenshots read on desktop and 390px.

### Task T2: Screens
- **Files:** dashboard, transactions, categories, recurring, plans, risk, import, model screens and their components.
- **Verify:** unit, accessibility and Playwright suites pass.

## Phase D: agreed ledger polish

### Task L1: Category overview bar (option A), "Coming up", income-vs-expense bars, ↻ badge
- **Verify:** unit tests; the "Coming up" list equals the server's recurring occurrences and unpaid instalments for the window (a backend endpoint with its own tests); the bar's segments add up to the panel's gross spend.

## Phase E: recurring matching

### Task R1: Whole words, amount within 15%, match count (tests first)
- **Files:** `app/domain/merchants.py` or a new matcher, `engines/forecasting/{flows,series,service}.py`, `app/api/recurring.py` (`matches` count), `RecurringScreen.tsx`, tests.
- **Verify:** "Rent" matches "Rent - bilik sewa" and not "Parent gift"; a RM20 "rent" deposit does not count as a RM450 rent payment; the full backend suite and serving checks do not move on synthetic profiles.

## Phase F: import template and dates

### Task I1: Template, Excel template, date-order check (tests first)
- **Files:** `frontend/public/paysense-import-template.csv`, a generated `.xlsx` template, `app/domain/csv_import.py` (file-level day-first or month-first detection with a note when it cannot tell), tests.
- **Verify:** both templates import with no notes; a month-first file is read correctly or warned about.

## Wrap-up

- [ ] CHANGELOG entry, STATUS rows and verification ledger
- [ ] ADRs: D-47 (existing plans: record-only past instalments, current-state check, an approximation), D-48 (pond theme), D-49 (recurring matching), D-50 (template and date order); PRD §7 one-liners
- [ ] Reviews: security, python/fastapi, react (user-scoped routes, a check that excludes a plan, a new form)
