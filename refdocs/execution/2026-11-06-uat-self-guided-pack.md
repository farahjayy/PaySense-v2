# Execution — The self-guided UAT pack

> Plan: `refdocs/plans/2026-11-06-uat-self-guided-pack.md`. Each task carries its own **Verify**. Tick when done; edit to match reality if it deviates.

### Task U1 — Intro replay moves into Settings (D-66), tests first
- **Files:** `frontend/components/layout/ProfileCard.tsx`, `AppShell.tsx`, `frontend/components/screens/SettingsScreen.tsx`, `frontend/tests/unit/AppShell.test.tsx`, `SettingsScreen.test.tsx`, `frontend/tests/e2e/journey.spec.ts`.
- **Steps:** the name and initials on the profile card link to `/settings`; the card and the phone's "More pages" row lose "Show the intro again"; the tablet top-bar name becomes a link; Settings' "Other" card gains "Show the intro again" (replays the intro and tour, goes to the dashboard). The old Settings test that said "no replay here" now says "no admin content, replay present".
- **Verify:** three new tests failed first (`vitest` on the two files: 3 failed, 40 passed); then the whole unit suite 739 passed, `tsc --noEmit` clean, `eslint` on `components`, `tests/unit`, `tests/e2e` clean. The e2e step is edited but the Playwright suite was not run (needs a backend).
- [x]

### Task U2 — Pack generator (tests first)
- **Files:** `backend/ml/uat/booklet.py`, `backend/ml/uat/roster.py` (`refuse_example_usernames`), `backend/scripts/seed_testers.py`, `uat/booklet-template.html`, `backend/tests/ml/uat/test_booklet.py`, `test_roster.py`.
- **Steps:** `render_pack(tester, persona_cards, links, last_transaction)` puts the tester's username, the three cards (the scenario's card first) and the last usable day into the template; `build_packs(testers, out_dir, session, links)` also writes each tester's shifted statement as `student-statement.csv`, and refuses the template's example usernames, as does `seed_testers.py`. Tests: every number and name on a card comes from the cards file; the username appears; no `expected_band` value is attached to a card and the word "expected" does not appear; the persona name does not appear; the file's last row is the day before the session; a roster with a template-example username is refused.
- **Verify:** tests failed first (import error), then 36 passed with the roster tests; a sample pack from a throwaway roster in the scratchpad was generated and read.
- [x]

### Task U3 — Forms text
- **Files:** `uat/forms.md`.
- **Steps:** Form A (consent, code, which scenario, then three optional blocks, one per scenario, each marked "answer only the block for your Purchase 1 item"; no branching, so it works in any form tool), Form B (per-card own-words questions, post vignette, C1-C4, usefulness items, S1-S10, debrief, hints used). Question titles start with a code; every column of `templates/sus.csv`, `clarity.csv` and `vignettes.csv` has a source question.
- **Files (also):** `backend/tests/ml/uat/test_forms_doc.py`.
- **Verify:** `test_forms_doc.py` checks that every SUS and clarity column has a coded question, each vignette has pre, post and confidence codes, the scenario and option text and the SUS and clarity wording match `vignettes.yaml` and `instruments.md`, the scenario choice names the item on each scenario card, and no `risk_rank` or `expected_band` appears; it failed first (no `forms.md`), then 117 passed with the rest of `tests/ml/uat`.
- [x]

### Task U4 — Supporting docs
- **Files:** `uat/README.md`, `uat/participant-information.md`, `uat/instruments.md`, `uat/task-script.md` (deleted), `uat/vignettes.yaml` (one comment), `refdocs/guides/onboarding-intro-and-tour.md` and `deployment.md` (persona-file and replay wording only; `checklist.md` needed no change).
- **Steps:** describe the self-guided flow; drop every mention of a facilitator and `task-script.md`; the information note says "on your own, about 40 minutes, two forms".
- **Verify:** `grep -rn "task-script\|facilitator" uat refdocs/guides` finds nothing that describes the current flow.
- [x]

### Task U5 — Records
- **Files:** `refdocs/changelog/DECISIONS.md` (D-66, D-67), `refdocs/paysense-v2-PRD.md` §7, `refdocs/changelog/CHANGELOG.md`, `refdocs/STATUS.md`.
- [x]

## Deviations from the plan
- The forms use "answer only the block for your item" in place of branching, so they do not depend on a form tool's branching feature (untried: the forms do not exist yet).
- The usefulness items are the two the supervisor accepted (`R1`, `W1`), not a new scale; the analysis script does not read them yet, so they are reported by hand.
- Task U1 also changed the tablet top-bar name into a link, which the plan did not list.

## Wrap-up
- [x] `refdocs/STATUS.md`
- [x] `refdocs/changelog/CHANGELOG.md`
