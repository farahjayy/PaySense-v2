# Plan — P7c Existing BNPL plans, the pond theme, and the agreed ledger polish

> Execution: `refdocs/execution/2026-10-19-p7c-existing-plans-and-theme.md`. Scope source: the author's discussions of 2026-10-15 to 2026-10-19 (mockup canvas, her own plans, her own ledger). Builds on P7b (`2026-10-15-p7b-ledger-polish.md`), ADR D-28, D-29, D-30, D-41, D-43 to D-46.

## 1. Why this exists

The product's end point is "is this BNPL purchase safe, and what would make it safe?" (supervisor's aim). Walking through her own use, four gaps showed up:

1. **A plan loses its risk story.** The statistics (score, reasons, with/without chart, smallest change) exist only on the check screen. Once a plan is added, the Plans screen shows none of it, and the saved report is reachable only from the one-off "Plan added" page. A plan added with the plain "Add a plan" button never gets a report.
2. **An existing plan cannot be checked.** The risk check accepts a purchase date from 31 days back (`DAYS_BACK`, `api/risk.py`). A BNPL bought four months ago, with three instalments left, cannot be risk-checked, although those three instalments will still take money.
3. **Adding a past plan is clumsy.** Every instalment is created unpaid, so the past ones show as overdue (the forecast treats overdue as due now, and the repayment warning fires), and marking them paid logs an expense each, which duplicates any payment already in an imported statement.
4. **The app does not look like the login page**, which she designed, and several small things were agreed in discussion (a category overview bar, recurring-item matching, the import template).

## 2. What's already covered

- A saved report is frozen and linked to its plan (`bnpl_plans.risk_check_id`, `risk_score_at_creation`); the table already allows `risk_check_type = 'current_state'`, unused until now.
- The engine already takes a proposed schedule plus the other plans (`engines/risk/check.py: run_check`), the Monte Carlo already excludes nothing it is not told to, and an unpaid overdue instalment is already handled (`flows.known_flows`).
- Plan payments are already left out of the weekly variable series (`series._is_plan_payment`), so logging or not logging a past instalment never changes the forecast, only the month totals.
- The mockup canvas (`PaySense Pond Theme Mockup`) fixed the look: teal sidebar, Bricolage Grotesque and Figtree, the three result faces used widely, bubbly corners, overview bar option A.

## 3. Scope

**In**

A. **Existing plans (the author's three points)**
1. *Record-only past instalments.* When a plan being added has instalments dated before today, the form shows "Instalments already due": each past instalment with a Paid checkbox (default ticked) and a choice, default **off**, "Also add these payments to my transactions" (turn on only if they are not already in a statement). A ticked instalment is stored paid with its due date as the paid date, and with no transaction unless the choice is on. An unticked one stays unpaid and overdue, because it genuinely is. Nothing before today changes the forecast or the check.
2. *A "current state" check of the whole remaining schedule.* The remaining unpaid instalments are the proposal; the plan itself is left out of the known flows for that run, so nothing is counted twice. The result is frozen as a report with `risk_check_type = 'current_state'` and linked to the plan. It runs automatically when an existing plan with instalments left is added, and from a **Check now** button on any plan.
3. *The 31-day rule applies to new purchases only.* An existing plan may have any past purchase date.

B. **Statistics stay with the plan.** The plan card shows the face, band and score of its latest report, when it was made ("as at 16 Oct"), a link to the full report and Check again. The report page says which kind it is ("before you bought" or "your remaining instalments, as at …").

C. **The pond theme** across the app, with the login page sharing the same tokens: teal sidebar, new fonts, bubbly corners, the faces on the health score, risk result, instalments and plan cards, the chart and category colours checked to 3:1 or better.

D. **Ledger polish agreed in discussion:** the category overview bar (option A: dots, small categories grouped into "Others"); income-vs-expense bars; a "Coming up" list (confirmed recurring items and BNPL instalments in date order); a ↻ badge on transactions matched to a recurring item.

E. **Recurring-item matching:** whole words only, the payment's amount within about 15% of the item's amount, and a "matches N transactions" count on the Recurring page; a shorter page description.

F. **Import template:** generic sample rows (Expense 1, Expense 2, Income 1) with dd/mm/yyyy dates, an Excel template with real date cells, and a check that warns when a file's dates could be read either way.

**Out, with reasons**
- Budgets, balances, accounts, a calendar, pie charts: not the project's end point (decided 2026-10-15); listed under Future work.
- PDF import: supervisor decision (D-13).
- Retraining either model: the current-state check uses the trained model as it is; the report says what it is.
- Changing how savings count (D-45 stays `ASSUMED`).

## 4. Approach

- **Existing plan creation.** `PlanIn` gains optional `paid_seqs` and `log_payments` (default false). `store_plan` writes those instalments paid with `paid_date` = due date, and logs a payment only when asked. No migration: the columns exist.
- **Current-state check.** `POST /api/plans/{plan_id}/risk-check` builds the remaining schedule from the stored unpaid instalments, evaluates it with that plan excluded from the plans passed to the engine, freezes the report with type `current_state`, links it to the plan and keeps `risk_score_at_creation` as it was. A locked ledger (under four months) saves the plan and says why there is no check.
- **Plan out.** `PlanOut` gains `risk_check_id`, `risk_check_type` and `risk_checked_at` so the screen can link and label; `RiskCheckOut` gains `check_type`.
- **Theme.** The tokens in `globals.css` change (the components hold no hard-coded colours); the login's own variables point at the shared tokens; fonts move to the root layout (self-hosted, so `font-src 'self'` holds); radius tokens change; a small `Face` component is shared by every screen that uses the faces.
- **Contrast** is checked by a script on the final palette, because the unit tests cannot measure it.

## 5. Risks & unknowns

| Risk | Confidence | Mitigation |
|---|---|---|
| The scoring model was trained on whole new purchases, not "the rest of a plan"; applying it to remaining instalments is an approximation | Certain it is an approximation; the size of the error is unmeasured | The report states what it is; the direct simulation figure is shown beside the model's; ADR D-47 records it as `ASSUMED`; a serving check on synthetic plans compares the two |
| A plan left in the forecast while its check runs would be counted twice | High if forgotten | The plan is excluded from the plans passed to the engine, with a test that the result equals the check of the same schedule with no plan |
| Past instalments ticked paid without a transaction leave the month totals lower than the bank | Certain | The choice and its helper text say so; default off because plan payments never enter the forecast |
| A rename of fonts, colours and radii touches every screen | Medium | Tokens only; full unit, accessibility and Playwright runs; screenshots read |
| Whole-word matching with an amount tolerance still swallows a one-off | Low | The match count makes it visible; ±15% mirrors detection |
| Excel on a month-first PC re-writes dates | Certain | Real date cells in an `.xlsx` template; the file-level date-order check warns before import |

## 6. Definition of done

- Her case works end to end: a plan bought four months ago with six instalments, the four past ones recorded as paid, shows only its remaining instalments as owed; the forecast counts only those; a report for the remaining schedule is on the plan card with its face, band, score, date and link.
- A plan added with the plain button gets a report on creation when instalments remain and the ledger is long enough; any plan can be re-checked.
- A past instalment ticked paid creates no transaction unless asked; one left unticked stays overdue.
- The check of an existing plan equals the check of the same remaining schedule with the plan absent from the ledger (tested).
- The app uses the pond tokens and fonts, the faces appear on the score, risk result, instalments and plans, and every colour that carries meaning passes its contrast bar (script output kept in the changelog).
- Backend and frontend suites, lint, types, build and the Playwright journeys pass, with commands and results in the changelog; migration state stated.
