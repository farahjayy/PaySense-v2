# PaySense v1 — What Was Built, What Broke, What v2 Reuses

> Founding context document for PaySense v2. Written 2026-10-08 from a full read of the v1 repository (local path `../PaySense/`, frozen reference — never edit it from a v2 session). This file is deliberately **sanitized**: v2 is a public repo, so no personal transaction amounts, balances or life details from the v1 author's own data appear here. Where a v1 finding depended on that data, it is described qualitatively.

v1 was the experiment. It was a working single-user app (Next.js + FastAPI + Supabase, 184 backend tests at its last recorded run) with two ML engines. Everything below is a lesson v2 must not have to re-learn.

---

## 1. What v1 built (and v2 keeps as the product shape)

- **Screens:** Dashboard (balance, month summary, health gauge, 6-month chart, BNPL summary, upcoming-payment alerts), Transactions (list, filters, add/edit, CSV import, category breakdown, Income / Expense / Savings tabs), BNPL Plans (cards, create with live schedule preview, plan detail timeline, mark-paid, rename, delete-with-transactions, By month "My bills" view), Risk Checker (form → staged loading → score, recommendation, with/without balance chart, "why" factors, schedule, confirm into a plan), frozen per-plan Risk Report.
- **Sequential pipeline:** forecast first, then score the proposed purchase in the context of the forecast. This is the project's core idea and stays.
- **Visual identity:** warm editorial light theme (`#F4F3EF` page, white cards, `#185FA5` accent, success/warning/danger pairs), dd/mm/yyyy display dates, `RM 1,234.56` currency. Reference: v1 `docs/UI_SPEC.md` and `paysense_dashboard_mockup.html`.

## 2. Engine 1 (forecasting) — what went wrong

| Finding | Evidence in v1 | v2 consequence |
|---|---|---|
| Model selection used MAPE-prone data and no naive baselines | Kaggle comparison: all three candidates (ARIMA / Prophet / LSTM) had MAPE > 250% because monthly net cash flow sits near zero; no naive/mean baseline was in the comparison | Scale-free metrics (MASE/RMSSE), naive baselines always included |
| The served ARIMA lost to trivial baselines on real data | Live check and a 15-month rolling backtest: ARIMA-on-net was beaten by naive and trailing-mean forecasts | A model only ships if it beats the baselines in a rolling-origin backtest |
| Forecasting **net** cash flow as one series is wrong-headed | ARIMA(1,0,0) decayed to ~0 within 3 months; income bars were back-derived from the net forecast, so a fixed allowance was shown as varying | Forecast components separately: known income and bills are *placed*, not *predicted* |
| Tiny series are fragile | One large one-off entry flipped `auto_arima` to ARIMA(0,0,0) → a flat zero forecast | Recurring/one-off separation; robust estimators; minimum-history fallback |
| Forecast anchored to the last logged month, curve anchored to today | Stale logs left the balance curve with no forecast and dropped instalments from the Engine 2 feature | Everything anchors to today's date |
| Point forecast only | No uncertainty; "will you go below RM0" was a yes/no on one line | Probabilistic: P10–P90 band and P(shortfall) per due date |

## 3. Engine 2 (risk classification) — what went wrong

| Finding | Evidence in v1 | v2 consequence |
|---|---|---|
| The model re-learned a hand-written formula | Synthetic label = weighted sum of clipped terms → sigmoid → Bernoulli draw. An oracle scored with the true probability reached F1 0.836; all three models were within 0.02 of it | The label must come from something defensible and independent of the model: a forward cash-flow simulation (v2 ADR D-07) |
| Hard thresholds in the label caused a real misclassification | A purchase of ~115% of monthly income scored "Safe" (P=0.08) because `missed_payments` only counted at ≥2 | Monotonic constraints; label from simulation, not thresholds |
| The Engine 1 → Engine 2 link was nominal | `forecasted_cash_flow` explained ≈1.5% of label variance and was near-constant at serving time; in training it was a noisy copy of income − expenses | Engine 1 *generates the label* and supplies several features; an ablation proves its contribution |
| Train/serve feature mismatches | `bnpl_income_ratio` was served as monthly burden/income but trained as total debt/income — scores leaned too safe until fixed | One shared feature module used by data generation, training and serving; a feature-schema hash in model metadata |
| Unrealistic behavioural distribution | Synthetic `missed_payments` averaged ~3; real careful users have 0, so "0 missed" dominated as a safe signal | Ground repayment behaviour in BNM / task-force statistics (~88% always on time) |
| Model selection inside the noise | Single 300-row test split; candidates differed by ~1 row. 5×5 repeated CV with corrected t-tests later showed RF better on ROC-AUC/Brier | Repeated CV + corrected resampled t-tests from day one (port v1's harness) |
| Untuned hyperparameters | All candidates used hand-set defaults | Tuning with a recorded budget, nested inside CV |
| SHAP explains the raw model, not the calibrated probability | Platt calibration is monotone so ranking holds, but values don't sum to the displayed number | State it; prefer explanation methods consistent with the displayed quantity |
| Near-zero factors shown as reasons | Fixed late by a 0.02 SHAP cut-off | Keep the cut-off; allow "nothing stands out" |

## 4. Product / data lessons

- **Manually-synced balance goes stale.** v1 added a ledger mode late and never switched it on. v2: running ledger by default, balance sync is a correction tool (ADR D-19).
- **Provider billing rules matter to the model.** A wrong first due date creates phantom missed payments. v1's provider config (`checkout_instalments`, `start_rule`, `start_offset_months`, `monthly_fee_applies`) is correct and tested; it was mirrored by hand in TypeScript — v2 serves it from the API instead.
- **Money in integer sen.** v1's schedule maths (monthly fee rate, instalments rounded down, leftover sen in the last instalment) is correct and pinned by tests. Port it as-is.
- **Instalment ↔ transaction link by ID**, not text matching (v1 migration 002). Delete-plan asks keep/delete for logged payments; default keep.
- **Forgot-to-mark-paid inflates missed payments.** v1 documented it, never fixed it. v2 needs a reminder / bulk mark-paid flow.
- **Provider credit limits are real constraints.** A v1 test purchase was impossible because it exceeded the provider limit. v2 records an optional limit per provider.
- **Category matching needs word boundaries** ("parents" must not match "rent").
- **Excel/CSV imports:** income is dated to the month it covers; categories need normalisation; a preview-then-confirm flow is mandatory.

## 5. What v2 ports from v1 (with their tests)

| v1 file | Port as | Notes |
|---|---|---|
| `backend/app/services/schedule.py` | domain/schedule | Sen maths, provider-aware start dates, `add_months` clamping |
| `backend/app/providers.py` | domain/providers | Becomes the single source, exposed via `GET /api/providers` |
| `backend/app/services/ledger.py`, `transaction_ops.py`, `plan_transactions.py`, `plan_edit.py`, `plans.py`, `bills.py` | domain/* | Add `user_id` scoping everywhere |
| `backend/app/services/categorize.py` | domain/categorize | Word-boundary matching |
| `backend/app/routers/imports.py` (CSV path only) | api/imports | PDF path not ported (out of scope) |
| `backend/scripts/engine2_model_comparison.py` | ml/engine2 evaluation | Repeated CV, Nadeau–Bengio corrected t-test, calibration, oracle row |
| `backend/tests/test_schedule.py`, `test_plans.py`, `test_ledger.py`, `test_categorize.py`, `test_bills.py` | tests | Re-run green before building on them |
| `frontend/components/ui/*`, `lib/format.ts`, `lib/useApi.ts` | frontend | UI kit, formatting, masked dd/mm/yyyy `DateField` |
| `frontend/components/risk/OverlayChart.tsx`, `WhyThisScore.tsx`, `plans/*`, `dashboard/*` | frontend | Adapt the chart for a P10–P90 band |

**Not ported:** `forecasting.py`, `features.py`, `risk.py`, `pipeline.py`, `ml_models.py` (replaced by the v2 engines), `seed.py` (read a personal xlsx), PDF import, all `models v*/` artefacts (v2 trains its own; v1 results are cited as the prior baseline).
