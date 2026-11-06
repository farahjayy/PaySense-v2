# Plan — The self-guided UAT pack

> Execution: `refdocs/execution/2026-11-06-uat-self-guided-pack.md`. Part of P9 (UAT kit). Builds on `2026-10-22-uat-purchase-cards.md` (ADR D-63) and `2026-10-22-persona-histories-oct-2026.md` (ADR D-60). Decisions: D-66 (intro replay moves into Settings), D-67 (the pack's design).

## 1. Why this exists

The UAT is self-guided: the author hands each tester a link, a username and a pack, and there is no facilitator in the room. The study evaluates **usability and perceived usefulness of the dashboard and its explainable-AI features** (objective 3, `refdocs/context/academic-constraints.md` §1). `uat/task-script.md` was written for a facilitator and cannot be handed over.

The risk is the opposite of a bare link: a pack that explains every feature, says what to look at and what the output "should" be teaches the tester the answer. Two measures would then be contaminated: SUS (testers would rate the instructions, not the interface) and explanation clarity (testers would repeat the pack's explanation, not show whether the app's own explanation works). The pack therefore gives **context and goals, never explanations or expected results**.

## 2. What's already covered

- The three persona CSVs (D-60), shifted by `ml.uat.shift_persona`; the purchase cards and given limits (D-63, `uat/purchase-cards.yaml`, answer key `reports/uat/purchase_cards.md`).
- The instruments (`uat/instruments.md`: clarity C1-C4, SUS S1-S10, debrief), the vignettes (`uat/vignettes.yaml`) and the analysis (`ml.uat.analyse`: mean SUS with CI, decision-switch table). The CSV shapes it reads are fixed.
- The roster and seeding (`ml.uat.roster`, `scripts/seed_testers.py`): unguessable usernames enforced.
- The app's own onboarding (welcome slides, tour, Getting started): it is part of what is being tested, so the pack does not duplicate it.

## 3. Scope

**In**
- A **per-tester pack** generated from one template, the roster and the cards file, so a number, username or persona file cannot be mistyped: `ml/uat/booklet.py`. Each tester gets one self-contained HTML page (readable on a phone or laptop, printable) and their own shifted statement file under a neutral name. Tasks are goals ("Get the student's history into PaySense"), never button names or expected results. A "stuck" section holds graded hints the tester opens only after trying, and records that they did.
- **Two forms**, text ready to paste into Microsoft Forms (`uat/forms.md`): Form A *before* the app (consent, participant code, the tester's one scenario, choice and confidence); Form B *after* (what the app said and why in the tester's own words per purchase, the second vignette answer, clarity C1-C4, usefulness items, SUS, debrief, hints used). Two forms so the "before" answers cannot be revised after seeing the app. Every question title starts with a stable code (`V1-pre`, `C2`, `S7`...) so the exported spreadsheet can be turned into the three CSVs the analysis reads.
- Updated `participant-information.md` and `instruments.md` for a self-guided study; `uat/README.md` rewritten; `uat/task-script.md` removed.
- D-66: "Show the intro again" moves from the sidebar into Settings, reached through the name on the profile card.

**Out, with reasons**
- The form-export-to-CSV converter: its column names depend on the form as it is built; written after the forms exist.
- Facilitated sessions and observation notes (the study is self-guided, D-63).
- Showing testers any expected band (D-63: it would prime the "after" answers).
- Real data or real provider accounts (D-54).

## 4. Approach

**One scenario per tester.** The existing pairing stands: V1 headphones with `frequent_bnpl`, V2 laptop repair with `irregular_income`, V3 shoes with `budget_conscious`, each being one purchase card (F1, I3, B1). The tester answers only their own vignette before and after, which is what `switch_table` pairs; the other two would never be paired. Form A asks "which item is Purchase 1 on your page" and has one optional block per scenario marked "answer only your own", rather than relying on a form tool's branching.

**Card order.** The vignette's card is presented first so the "after" vignette answer follows the check it refers to; the other two follow in the cards file's order. The order is fixed, not counterbalanced: with 7 testers a counterbalance would leave 2-3 per cell. This is stated as a limitation.

**The one place the pack prescribes a path:** confirm every suggestion on the Recurring page before the risk check, because the cards were measured on that path (D-63). The pack says what to do, not what it will do.

**Self-guidance without leaking.** Per task, an "in your own words" question in Form B (what did it say, why, what would you do) measures whether the explanation works; the tester's chosen band is recorded so a misreading is visible against the answer key. Hints are graded (where to look, then which page) and each use is recorded; a tester stuck for good is not blocked.

## 5. Risks & unknowns

| Risk | Confidence | Mitigation |
|---|---|---|
| Purchase-card bands were verified for 25-31 October 2026 only; a different session date shifts the data by whole weeks | Certain | The pack takes the session date; before the pack goes out the author runs each card on the shifted file in the live app and compares with the answer key; recorded in the changelog |
| The forecast calls a ledger stale after 14 days; a file shifted for one day goes stale | Certain | The pack states the last day the file can be used; the generator computes it from the file |
| Roster usernames copied from the public template are guessable by anyone who reads the repo | Confirmed by the author's roster | The roster check rejects plain names but not the template's own example names; add a check, and tell the author |
| Forms allow going back and editing the "before" answers | High | Two forms; Form B asks for the participant code only |
| Hints used and "stuck" are self-reported | Medium | Reported as such |
| 7 testers across 3 personas: 2-3 per vignette | Certain | The report is descriptive only (README, analysis) |

## 6. Definition of done

- `ml.uat.booklet` and its tests exist and pass; a sample pack from a throwaway roster was read by eye (HTML renders, every card number comes from the cards file, no expected band or "expected" word appears in it).
- `uat/forms.md` carries both forms with codes covering every column the three CSV templates need.
- Intro replay: tests failed first, then passed; `lint`, `tsc` and the unit suite green; the e2e step updated (the Playwright suite needs the backend and was not run, and the changelog says so).
- README, participant information, instruments, STATUS, CHANGELOG, DECISIONS and PRD §7 updated; no schedule language beyond the session date being a parameter.
