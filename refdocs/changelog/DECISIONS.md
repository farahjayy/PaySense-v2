# Architectural Decisions — PaySense v2

> Record decisions here so they aren't re-debated in future sessions.
> Format: **Decision** → **Why** → **Trade-offs / what was rejected**.
> Canonical one-line list lives in `refdocs/paysense-v2-PRD.md` §7; this file expands the load-bearing ones under the same id.

An ADR is worth writing when the decision (a) is expensive to reverse, (b) will look arbitrary to a future reader, or (c) had a real alternative someone will propose again. Everything else is just a commit message.

---

## D-01 — New public repo; v1 frozen; port proven modules with their tests
*2026-10-08 · author decision (scaffold interview)*

**Decision.** PaySense v2 lives in its own public repo. v1 (`../PaySense/`) is a read-only reference. Domain modules that are correct and tested in v1 (schedule, providers, ledger, plans, bills, categorize, CSV import, the Engine 2 CV harness, the frontend UI kit) are ported together with their tests; the engines, seed script and model artefacts are not.
**Why.** v1 was the experiment and accumulated 19 concept-document revisions of patches. Its domain code survived real use; its engines did not (see `context/v1-lessons.md`).
**Rejected.** Evolving v1 in place (drags the single-user schema, the personal-data history and the patched engines along); rewriting everything from scratch (re-learns solved problems such as sen rounding and provider start dates).

## D-03 — Username-only login, user-scoped repository layer
*2026-10-08 · supervisor decision, implementation by Claude*

**Decision.** `POST /api/auth/login {username}` looks up a pre-seeded user and returns a signed HS256 bearer token (secret from `SESSION_SECRET`, expiry 12 h). The frontend keeps it in `sessionStorage` and sends `Authorization: Bearer`. Every repository function takes `user_id` as its first argument; no query exists without it. The backend alone talks to Supabase (service key); RLS is enabled on every table with no policies for `anon`/`authenticated`, so a leaked anon key reads nothing.
**Why.** The supervisor ruled passwords and sign-up out of scope; each tester still needs isolated data. A bearer header avoids third-party-cookie problems between a Vercel origin and a Render origin.
**Trade-off.** Anyone who knows a username can log in as that user. Acceptable for a 5–7-person UAT on synthetic persona data; stated as a limitation and in the model card. Rejected: Supabase Auth (needs email/password or OAuth — out of scope), a profile picker with no login (supervisor asked for a username entry).

## D-04 — Engine 1 is a component forecaster with Monte Carlo uncertainty
*2026-10-08 · approved by author*

**Decision.** Known flows (confirmed recurring income and bills, BNPL instalments, dated savings goals) are placed on their exact dates. Only weekly discretionary spend is forecast. A residual-bootstrap Monte Carlo (1,000 paths, daily resolution, day-of-week spreading) produces P10/P50/P90 balances and P(shortfall). Everything is anchored to today.
**Why.** v1 forecast monthly *net* cash flow as one series: it decayed to zero, back-derived income bars from the net, collapsed to a flat line after one one-off entry, ignored stale logs, and lost to naive baselines. Banks split fixed and variable flows in production (BBVA, Monzo, Yodlee) and alert on P(negative balance) (BBVA, Intuit Mint ODEWS) — research §A.
**Rejected.** Daily discretionary forecasting (too noisy for a few months of data); per-category forecasting (too few points per category; possible future work); conformal intervals (residual bootstrap gives full paths, which the daily balance and P(shortfall) need).

## D-05 — Candidate algorithms stay within the literature review
*2026-10-08 · author asked for a recommendation; Claude recommended, author's earlier "full v2" choice of Chronos + EBM superseded*

**Decision.**
- Financial health forecasting candidates: **ARIMA, Prophet, LSTM** — plus **naive** and **moving-average** benchmarks. The LSTM is trained **globally** across many series (Berka / MoneyData / synthetic cohort) and applied per user.
- BNPL risk classification candidates: **Random Forest, XGBoost, LightGBM**, each with **monotonic constraints** — plus a **logistic-regression** benchmark.
- XAI: **SHAP**, plus counterfactual search.
**Why.** The literature review (supervisor-reviewed) selected these candidates; the methodology must follow from it, and Chapter 2 should not need new sections. Benchmarks are standard evaluation practice (fpp3; M4/M5), monotonic constraints are a model *configuration* (one methodology citation), and a global LSTM is how recurrent networks are normally applied to many short series. v1's failures were in design (target, label, features, evaluation), not in the choice of algorithms.
**Rejected (recorded as future work in the sources doc):** ETS/Theta, Chronos-2 / TimesFM / Moirai foundation models, Explainable Boosting Machines, WoE scorecards. Each would need new literature to justify.

## D-06 — Engine 1 selection rule
*2026-10-08 · Claude decision*

**Decision.** Rolling-origin evaluation on the weekly discretionary series (minimum training 26 weeks, step 4 weeks, horizons 4/8/13). Primary metric: MASE pooled across series. Also RMSSE, 80% interval coverage, end-of-horizon balance MAE. Significance: Harvey–Leybourne–Newbold-corrected Diebold–Mariano on pooled losses, Wilcoxon on per-series MASE, Friedman/Nemenyi across all five. Objective 1's "best model" = the best of ARIMA / Prophet / LSTM. The **served** model is that model unless it is significantly worse than the best benchmark; then the benchmark is served and the finding is reported.
**Why.** v1 selected on RMSE from one split without baselines, then lost to naive in production. MAPE is undefined near zero.
**Trade-off.** If a benchmark wins, the dissertation must say so plainly; the system's value then rests on decomposition and simulation, which is still a defensible contribution.

## D-07 — Engine 2's target is Engine 1's simulated shortfall probability
*2026-10-08 · approved by author*

**Decision.** For each synthetic profile with a proposed purchase, run the served Engine 1 with the proposed plan added and take P(balance < RM0 after any instalment due date within the horizon) as the target.
**Why.** v1's label was a hand-written formula the model simply re-learned (oracle F1 0.836, every model within 0.02), and the Engine 1 feature carried ≈1.5% of label variance. A simulation-derived label (a) has published precedent — Bijak, Thomas & Mues' dynamic affordability assessment; (b) mirrors BNM's financial-margin stress test; (c) matches the CCA 2025 affordability standard ("repay … without undue financial hardship over the duration"); (d) answers the supervisor's demand to justify how the label is assigned; and (e) makes the forecast genuinely load-bearing.
**Rejected.** Expert-rule labels and weak supervision (re-encode the author's opinion), transfer from public default datasets (wrong population, no schedule features — used only as a directional sanity check).
**Open.** Recommend the author shows this design to the supervisor / faculty consultants before P5 (PRD §8 Q8).

## D-08 — One synthetic population generator
*2026-10-08 · Claude decision*

**Decision.** `ml/datagen` generates transaction-level student histories from one cited parameter file (`ml/datagen/params.yaml`). Sources: Tan et al. 2026 and Osman et al. 2024 (demographics, income brackets), PTPTN 2026 rates (lump-sum disbursements), Tok & Cheah 2024 (monthly spend), DOSM HES 2022 (category shares), BNM / CCOB repayment statistics (~88% always on time, ~12% late-but-paid, < 0.5% unable to pay), provider fee schedules. The same generator produces the Engine 2 training profiles, the Engine 1 synthetic cohort and the three UAT persona CSVs.
**Why.** One set of assumptions to justify and document; the persona CSVs are statistically the same population the models learned from.
**Trade-off.** Parameters without a source are marked `assumed` in the file and listed in the dissertation's limitations.

## D-09 — One feature module, enforced by a schema hash
*2026-10-08 · Claude decision*

**Decision.** `backend/app/engines/risk/features.py` is the only place Engine 2 features are computed. `ml/engine2_train` imports it; it never re-implements a feature. Each artefact's `metadata.json` stores the ordered feature list and its hash; the server refuses to start on a mismatch.
**Why.** v1 trained `bnpl_income_ratio` as total debt/income and served it as monthly burden/income, and `forecasted_cash_flow` meant different things in training and serving.

## D-10 — Engine 2 training & selection protocol
*2026-10-08 · Claude decision*

**Decision.** Soft-label training by duplicate-and-weight; 5×5 repeated CV stratified by target decile and grouped by profile; Optuna tuning in an inner loop with the budget written to metadata; Brier primary, log-loss / ROC-AUC (p ≥ 0.30) / calibration slope / ECE secondary; Nadeau–Bengio corrected t-tests; calibration (none / Platt / isotonic) by nested CV; ablation without Engine-1 features; stress scenarios (income −20%, delayed PTPTN).
**Why.** Ports v1's proven harness and fixes its gaps (untuned defaults, single split, unreported tuning).

## D-11 — Repayment history is a flag, not a feature
*2026-10-08 · Claude decision*

**Decision.** Overdue instalments in the last 6 months are shown as a separate, rule-based flag citing BNM's suspension after 3 consecutive missed payments. They are not a model feature.
**Why.** The simulation label is about cash flow; a synthetic missed-payment variable would have to be wired into it by hand, recreating v1's distortion (synthetic users averaged ~3 misses, so "0 missed" dominated). Regulators require repayment history to be *checked*, which the flag does visibly.
**Trade-off.** The model score alone ignores repayment behaviour; the UI always shows both.

## D-15 — Hosting with a measured escape hatch
*2026-10-08 · supervisor plan + Claude fallback*

**Decision.** Vercel (frontend), Render (backend), Supabase Singapore (DB). P0 measures the backend's resident memory with the full served stack. If it exceeds ~450 MB: serve the LSTM via ONNX Runtime instead of PyTorch, and if still too large, move the backend to Google Cloud Run at 1 GiB.
**Why.** Render free is 512 MB / 0.1 CPU and sleeps after 15 minutes; PyTorch + Prophet + SHAP can exceed that.

## D-19 — Running-ledger balance by default
*2026-10-08 · Claude decision*

**Decision.** Every transaction create/edit/delete and every instalment marked paid moves the balance; balance sync records a correction. The persona onboarding sets an opening balance.
**Why.** v1's manually synced balance went stale and its ledger mode was never switched on; Engine 1's simulation starts from this number.

## D-23 — Python version pinned by uv
*2026-10-08 · Claude decision, pending P0 verification*

**Decision.** Use `uv` with a `.python-version` pin. Expected: 3.12. The P0 dependency spike installs the full stack (FastAPI, statsforecast, prophet, torch CPU, onnxruntime, scikit-learn, xgboost, lightgbm, shap, optuna) and records the result.
**Why.** The dev machine only has 3.14; wheel availability for Prophet/cmdstan and PyTorch on 3.14 (Windows and Render) is unconfirmed.

## D-24 — Two provider tiers: verified rules vs manual entry
*2026-10-08 · author decision*

**Decision.** SPayLater, TikTok PayLater and Atome are **verified** providers: their billing rules come from real users' checkouts (SPayLater and TikTok PayLater: nothing at checkout, first payment one month after the purchase; Atome: first payment charged on the purchase date) and drive the auto-filled schedule. Grab PayLater, Boost PayFlex and "Other" are **unverified**: they appear in the provider list, but the user must enter the first payment date and fee themselves — the app guesses nothing — and the plan shows a small "provider rules not verified" note. A provider moves to verified only when a real checkout example is recorded in `refdocs/context/bnpl-billing-rules-my.md` and a test pins the schedule.
**Why.** The author has first-hand information only for these three. A guessed first due date creates phantom missed payments and shifts instalments into the wrong weeks of the simulation — which now *is* Engine 2's label (D-07).
**Rejected.** Encoding Grab/Boost rules from secondary web sources (research §C tagged them [M]/[H] but unconfirmed against a real schedule); hiding unverified providers (students do use them, and the stack view must include every plan).

## D-25 — Berka is a benchmark, not the population
*2026-10-08 · author approved its use*

**Decision.** The Berka / PKDD'99 Czech bank dataset is used only (a) as a real multi-account benchmark for comparing Engine 1's forecasters — its payment-type codes give ground truth for the fixed/variable split — and (b) as extra series for pre-training the global LSTM. It is never used to describe or represent the target users.
**Why.** PaySense targets Malaysian university students with a bank/debit account and e-wallets and usually no credit card. Berka is real, account-level, transaction-level data — rare and valuable for evaluating forecasting — but its account holders are Czech adults in the 1990s. The student population is represented by the cited synthetic generator (D-08).
**Trade-off.** Engine 1 results on Berka show how the methods behave on real household series, not on students; the dissertation reports them separately from the synthetic-student cohort.

---

## Working assumptions (`ASSUMED:`)

Not decisions — guesses made to keep moving. Each one must be confirmed or killed before anything load-bearing is built on it. When one is resolved, delete it here and write a real ADR above.

1. `ASSUMED:` Python 3.12 supports the full dependency set (resolve in P0 → D-23).
2. `ASSUMED:` The served stack fits Render's 512 MB, or the D-15 fallback works (resolve in P0).
3. `ASSUMED:` Berka is obtainable as CSV without a paid account (resolve in P3; fallback in PRD §8 Q3; usage scope fixed by D-25).
4. `ASSUMED:` 52-week horizon cap for risk checks (resolve in P4).
5. `ASSUMED:` ~10,000 synthetic profiles suffice (resolve in P5 with learning curves).
