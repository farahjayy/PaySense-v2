# Plan — UAT purchase cards and provider limits

> Execution: `refdocs/execution/2026-10-22-uat-purchase-cards.md`. Part of P9 (UAT kit). Builds on `2026-10-22-persona-histories-oct-2026.md` (ADR D-60).

## 1. Why this exists

The UAT is self-guided (25-31 October 2026): there is no facilitator to say what to type. A tester who enters a random purchase gets a result they cannot judge, and one who types their own BNPL limit enters real financial data (D-54 allows synthetic data only). Each persona therefore gets **purchase cards** (provider, item, price, instalments, fee) and **one provider limit to record**, all supplied by us. The tester plays the persona's student, so owning a SPayLater or Atome account is irrelevant.

## 2. What's already covered

- The three persona CSVs (`data/personas/`, D-60) and the real check (`run_check` with the trained model) that the browser calls.
- Provider limits as data (`provider_limits`, split between financed and paid-at-checkout, D-28) and the Getting-started step "Record your BNPL limits".
- Research values for typical limits in `params.yaml` (`limit_median_sen`: SPayLater RM 1,500, TikTok PayLater RM 1,000, Atome RM 800; `ASSUMED`).

## 3. Scope

**In**
- `uat/purchase-cards.yaml`: per persona, one provider limit and a small set of cards, each with an intent (`comfortable` or `stretching`).
- `ml/uat/purchase_cards.py`: validates the file and measures every card through the real check on the study days, in the two ways a tester may arrive (suggestions on the Recurring page left alone, or all confirmed). Writes the answer key `reports/uat/purchase_cards.md` (for us, not for testers).
- Tests that the cards file is valid and that each card's measured **shown band** matches its intent on every study day.
- A correction to the persona pick if it turns out to measure something other than what the tester sees.

**Out, with reasons**
- The tester instructions and forms (a separate piece of work that will quote these cards).
- Showing testers the expected result: there is no ground truth, and showing it would bias the "after" answers.
- Existing-plan entry for `frequent_bnpl` (its past BNPL arrives only as transaction rows; re-entering plans adds work and no insight).

## 4. Approach

The band a tester sees is `band(probability)` from the trained model, not the direct simulation the persona pick measured. Cards are chosen and verified on the **shown** band, with the limit applied, for SPayLater first (everyone knows Shopee), with one Atome or TikTok card only where a vignette uses it. Fees follow the documented rule (0% at 3 months, 1.5% per month on longer plans) and are written on the card.

## 5. Risks & unknowns

| Risk | Confidence | Mitigation |
|---|---|---|
| The persona pick measured the simulation, so a persona may show one band for every purchase | Confirmed for `frequent_bnpl` (At Risk for RM 200 to RM 2,500) | Re-check on the shown band; regenerate the persona if needed and say so |
| Confirming the Recurring suggestions changes results a lot for `frequent_bnpl` (simulation 100%) | Confirmed | Measure both paths; tell testers which to follow; report both |
| Limits are `ASSUMED` (D-28; no real checkout example for the cap rule) | High | Say so in the instructions; one function carries the assumption |
| Cards verified only for 25-31 October and these paths | Certain | Test pins the study days; a later study needs a rerun |

## 6. Definition of done

- `uat/purchase-cards.yaml` and the generated answer key exist; the test passes on every study day for both paths.
- STATUS, CHANGELOG (and an ADR if the pick rule changes) updated; no schedule language beyond the study window already decided.
