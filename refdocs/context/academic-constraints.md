# Academic Constraints — Supervisor Decisions & Examiner Expectations

> Founding context document. Paraphrased on 2026-10-08 from the FYP2 supervisor meeting (10 Sep 2026), the FYP2 meeting slides, and the supervisor's annotations on the FYP1 Interim Report. Personal details (grades, names of individual lecturers) are deliberately left out — v2 is a public repo. Original files live in the author's private FYP records repo, not here.
>
> These are **external decisions**, not engineering preferences. A v2 session that wants to contradict one needs an ADR and the author's sign-off with the supervisor.

---

## 1. Research framing (from the Interim Report review)

- **Aim (supervisor's wording):** *To develop and evaluate an AI-driven decision support system, PaySense, that integrates financial health forecasting and BNPL risk classification to assist Malaysian university students in making informed BNPL purchasing decisions.*
- **Objectives (supervisor's wording):**
  1. To evaluate and identify the best-performing time-series forecasting and BNPL risk classification models based on predefined performance metrics.
  2. To develop a Financial Health Forecasting Engine and a BNPL Risk Classification Engine for predicting financial health and assessing BNPL risk.
  3. To develop and evaluate the PaySense web dashboard with Explainable AI (XAI) features through User Acceptance Testing (UAT).
- **Terminology must stay consistent.** Use **"financial health forecasting"** and **"BNPL risk classification"** — not a mix of "cash flow forecasting" / "future balance prediction" / "affordability assessment". Code may say Engine 1 / Engine 2; user-facing text and anything that feeds the dissertation uses the two terms above.
- **Candidate models come from the literature review:** ARIMA, Prophet, LSTM (forecasting); Random Forest, XGBoost, LightGBM (classification); SHAP (XAI). See ADR D-05 for what v2 adds around them.

## 2. Methodology rigour the supervisor asked for

Each of these is a v1 gap the supervisor flagged. v2's ML harnesses must produce the evidence for them.

- **Justify the synthetic dataset** (her biggest concern): why no real BNPL data, why synthetic, its limitations, how representative it is of Malaysian BNPL users, and the generation process in detail — how each variable is sampled, how dependencies are kept, how the label is assigned.
- **Define the forecast → classifier link precisely.** v1's `forecasted_cash_flow` was ambiguous (a 3-month predicted balance? cumulative? monthly mean?). Every Engine-1-derived feature in v2 needs an exact definition.
- **Justify each feature's selection.**
- **Consistent, justified data splits.** v1 used 80/20 for one engine and 70/15/15 for the other with no reason given.
- **Report hyperparameter tuning** (method, search space, budget). v1 used untuned defaults.
- **Explain *why* the architecture is sequential** — why forecasting must run before risk classification, what the forecast adds over history alone.
- **Don't re-explain the algorithms** in methodology; describe configuration, preprocessing, training, tuning, selection.
- **Results go in a Results/Discussion chapter**, not Methodology — so harness outputs must be report-ready tables and figures.

## 3. Product scope decisions

- **Login:** full sign-up / passwords stay out of scope. Testers are **pre-seeded usernames in the database**; a tester types their username to log in. Each tester sees only their own data.
- **UAT:** 5–7 purposive testers across **3 personas**: (1) frequent BNPL users, (2) budget-conscious / fixed-income users, (3) irregular / gig-income users.
- **UAT data:** testers do **not** upload their own bank statements. They upload a pre-made, persona-matched CSV covering **4 months** of history. Flow: log in → blank dashboard → upload persona history → forecast and risk become visible.
- **Minimum history:** forecast and risk features need **at least 4 months** of transactions.
- **PDF statement parsing: out of scope.** Cite statement-conversion tools as the practical route. CSV import + manual entry are the input methods.
- **Bank integration: out of scope.**
- **UAT instruments:** task-based scenarios (transaction import, forecast review, BNPL risk check), the 10-item **System Usability Scale**, and qualitative feedback on **how clear the explanations are**. Cheap additions the supervisor accepted: "Does this forecast feel realistic?" and "Would this warning have changed your decision?"
- **Functional testing ≠ UAT.** Developer verification (all screens, schedule maths, import parsing, designed model-behaviour cases, deployed app on a fresh session, a phone browser) happens before any tester touches the app.
- **Deployment:** frontend on Vercel, backend on Render (see ADR D-15 for the memory caveat).
- **Contingency:** if live model integration hits a critical blocker, run the models offline on verified data and pipe real scenario outputs to the UI — **never fabricated values**.

## 4. What examiners weigh

- **Internal (university) examiners:** backend and algorithmic rigour — the model comparison, evaluation protocol, and justification.
- **External (industry) examiners:** UI aesthetics, usability, a cohesive working prototype.
- Both matter equally to v2's design: the ML harnesses are built for the first group, the frontend polish for the second.

## 5. Model-behaviour checks the author committed to (functional testing)

- High savings + small purchase → low risk.
- Forecast goes negative + large purchase → high risk.
- Explanations spot-checked against known cases.
- CSV import maps columns correctly; the 4-month history boundary is computed correctly; refunds and internal transfers have a defined representation.
- Instalment schedules correct for manual plan creation and for auto-creation from the risk check.
