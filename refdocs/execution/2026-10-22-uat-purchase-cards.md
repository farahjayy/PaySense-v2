# Execution — UAT purchase cards and provider limits

> Plan: `refdocs/plans/2026-10-22-uat-purchase-cards.md`. Each task carries its own **Verify**.

### Task C1 — Measure what the tester sees (tests first)
- **Files:** `backend/ml/uat/shown_check.py`, `backend/tests/ml/uat/test_shown_check.py`.
- **Steps:** `confirmed_items` (what pressing Confirm on every Recurring suggestion gives), `check_card` and `shown_bands` over the real `run_check` with the trained model and a provider-limit map.
- **Verify:** tests failed before the module existed; 3 passed after.

### Task C2 — Persona pick on the shown band
- **Files:** `backend/ml/datagen/personas.py`, `backend/tests/ml/test_personas.py`.
- **Steps:** `spreads`, `SHOWN_PRICES_SEN`, `SHOWN_LIMITS_SEN`; a candidate must spread on the shown band on every study day with the suggestions left alone and with all confirmed; one whose simulation also spreads is preferred. The simulation test now applies to `budget_conscious` and `irregular_income` only.
- **Verify:** `python -m ml.datagen.personas` run twice, hashes identical; `budget_conscious.csv` and `irregular_income.csv` byte-identical to before, `frequent_bnpl.csv` replaced.

### Task C3 — Cards file, loader, measurement, answer key (tests first)
- **Files:** `uat/purchase-cards.yaml`, `backend/ml/uat/purchase_cards.py`, `backend/tests/ml/uat/test_purchase_cards.py`, `reports/uat/purchase_cards.md` (generated), `.gitignore` exception.
- **Steps:** three cards per persona (Safe, Caution, At Risk on the instructed path), one limit per persona, validated on load; every card measured on 25-31 October, five seeds, both paths.
- **Verify:** 16 tests pass, including that each card shows its answer-key band on every day and seed and that a price over the limit is split between provider and checkout.

### Deviation from the plan (found while doing C1)
The persona pick had been measuring the direct simulation, not the band the tester is shown. `frequent_bnpl` read Caution on the simulation yet At Risk for every purchase from RM 200 to RM 2,500 on the model. Fixed in C2; recorded in ADR D-63 and the changelog.

## Wrap-up
- [x] `refdocs/STATUS.md`
- [x] `refdocs/changelog/CHANGELOG.md`
- [x] `refdocs/changelog/DECISIONS.md` (D-63) and PRD one-liner
- [x] `uat/README.md` mentions the cards file and the instructed path
- [x] This doc matches what happened
