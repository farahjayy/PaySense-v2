# Execution — P7c Existing BNPL plans, the pond theme, and the agreed ledger polish

> Plan: `refdocs/plans/2026-10-19-p7c-existing-plans-and-theme.md`. Tasks run top to bottom; each has a **Verify**. Edit this doc if reality diverges (CLAUDE.md rule 4).

## Before starting

- Read `CLAUDE.md`, `refdocs/STATUS.md`, ADR D-28 to D-30, D-41, D-43 to D-46.
- Every backend change starts with a failing test. `progress_material/` stays out of the repo, tests and docs.
- Phases are ordered by dependency: A and B change behaviour and need no theme; C changes only tokens and shared pieces; D to F are independent of each other.

---

## Phase A: existing plans (backend) — done (ADR D-47)

Reality differs from the first draft of this phase: after the author walked through the Plans mockup, the design became **a snapshot taken when a plan is added, with no "check again"**, so there is no `POST /api/plans/{id}/risk-check` and no migration. Tasks P1 to P4 became:

- **P1/P4 Snapshot on add.** `POST /api/plans` runs the risk check *before* saving (so a plan is never counted against itself), freezes it, links it (`risk_check_id`, `risk_check_type`, `risk_score_at_creation`); `PlanOut` also carries `risk_band` and `added_on`. A plan whose check cannot run is saved without a link. Per-person lock and a 120-second repeat guard (409 `duplicate_plan`), as for "Go ahead". No snapshot for a purchase dated beyond the check's reach.
- **P2 Remaining schedule.** A plan with instalments already due is checked as `current_state` over what is still owed (overdue ones count as due today, fee 0, no suggestion). Nothing owed means no check.
- **P1 Past instalments.** `paid_seqs` (exact integers 1 to 36, only instalments already due) are stored paid on their due day; `log_payments` (exact boolean, default off) also adds BNPL expense transactions.
- **P3 Report type.** `RiskCheckOut.check_type`; old reports read as `before_purchase`. `npm run gen:api` run; `check:api` exits 0.
- **Verify:** `backend/tests/api/test_plan_snapshot_api.py` (34 tests: snapshot, same answer as checking first, frozen report, locked ledger, no model, failing check, orphan cleanup, report kept when the plan did commit, not counted against itself, isolation, delete erases the snapshot, paid_seqs rules, logging, repeat refused, exact types, far-future purchase, remaining schedule, nothing owed); `risk_checks.bands` isolation test.

## Phase B: plan card and form (frontend) — done

- **P5 Past-instalments section.** `PastInstalments.tsx` in `PlanForm`: shown when the previewed schedule has instalments due today or earlier (not the part paid at checkout); each ticked paid by default; an untick belongs to that instalment on that day, so a schedule change starts paid again; "also add these payments to my transactions" off by default; the section stays (dimmed) while the preview catches up and Save waits for a current preview.
- **P6 The plan keeps its analysis.** `PlanRisk.tsx` on each plan card: collapsed "Analysis from <date>", the report fetched only when opened; face, band, chance, up to three reasons, the smallest change, a "covers only what was left to pay" note for `current_state`, and the link to the full report. `RiskReportScreen` titles itself by `check_type`. `Face.tsx` is the shared face (the login page still has its own copy; unify in T1).
- **Verify:** `tests/unit/PlanSnapshot.test.tsx` (9), `plans.test.ts`, `RiskScreen.test.tsx`, axe test for the section; Playwright "a plan that has already started keeps a check of what is left" on desktop and phone.

## Phase C: pond theme

### Task T1: Tokens, fonts, radii, shared Face
- **Files:** `app/globals.css`, `app/layout.tsx`, `app/login/login.css` and `layout.tsx` (use the shared tokens), `components/ui/Face.tsx`, `components/layout/AppShell.tsx`, `components/ui/*`, `lib/colours.ts` (category colours).
- **Verify:** `scripts/contrast` output for every text, border and chart colour is kept in the changelog; axe test passes; screenshots read on desktop and 390px.

### Task T2: Screens
- **Files:** dashboard, transactions, categories, recurring, plans, risk, import, model screens and their components.
- **Verify:** unit, accessibility and Playwright suites pass.

## Phase D: agreed ledger polish

### Task L1: Category overview bar (option A2, with category icons), "Coming up", income-vs-expense bars, ↻ badge
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
- [ ] ADRs: D-47 (existing plans: record-only past instalments, current-state check, an approximation), D-48 (pond theme, written), D-49 (sidebar, written), D-50 (recurring matching), D-51 (template and date order); PRD §7 one-liners
- [ ] Reviews: security, python/fastapi, react (user-scoped routes, a check that excludes a plan, a new form)
