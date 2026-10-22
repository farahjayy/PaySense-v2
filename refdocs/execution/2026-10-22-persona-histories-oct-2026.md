# Execution — Persona histories that end in October 2026

> Plan: `refdocs/plans/2026-10-22-persona-histories-oct-2026.md`. Each task carries its own **Verify**.

### Task H1 — Test first
- **Files:** `backend/tests/ml/test_personas.py`.
- **Steps:** add a test that each persona profile's `as_of` is 2026-10-31, that its first transaction is in June 2026 and its last in October 2026.
- **Verify:** the test fails before H2 (the profiles end on 28 Dec 2025).

### Task H2 — Persona end date
- **Files:** `backend/ml/datagen/personas.py`.
- **Steps:** `PERSONA_AS_OF = date(2026, 10, 31)`; pass `as_of` through `build_persona_profile` and `write_personas`.
- **Verify:** the full persona test file passes, including determinism and forecast unlock.

### Task H3 — Regenerate and look
- **Steps:** `cd backend && uv run python -m ml.datagen.personas` (twice, compare SHA-256); read each file's head and tail; run each through the real importer and forecast service and a risk check on one small and one large purchase.
- **Verify:** hashes identical across runs; forecast `status == ok`; results recorded as measured.

### Task H4 — Added during H3 (deviation from the plan)
- **Why:** the plain regeneration was unusable (budget_conscious 100% At Risk for every purchase, frequent_bnpl Safe for every purchase); see the changelog.
- **Done:** `MIN_BNPL_SHARE` and `CHECK_DAY_OFFSETS` in `personas.py`; `measure_ledger` in `buffer_check.py`; two tests; `reports/buffer_check/` regenerated.
- **Also found:** the Playwright backend pinned its clock to 29 Dec 2025 (`tests/e2e_server.py`); it now follows `PERSONA_AS_OF`, and the "already started" journey buys on 2026-06-01.

## Wrap-up
- [x] `refdocs/STATUS.md`
- [x] `refdocs/changelog/CHANGELOG.md`
- [x] `uat/README.md` "Persona dates" wording
- [x] This doc matches what happened
