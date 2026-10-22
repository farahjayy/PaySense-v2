# UAT kit

Everything needed to run a short usability and decision study with a handful of testers on **synthetic persona data**. Nothing here collects real financial information.

| File | What it is |
|---|---|
| `participant-information.md` | One-page note handed to each tester |
| `task-script.md` | The facilitator's script for a session |
| `instruments.md` | SUS, explanation-clarity items, vignette questions, debrief |
| `vignettes.yaml` | The three decision scenarios, their options and the risk ordering the analysis uses |
| `templates/` | Blank response files: `sus.csv`, `clarity.csv`, `vignettes.csv` |
| `testers.template.csv` | Roster format: `participant,username,display,persona` |
| `data/example/` | **Invented** answers for six imaginary testers, to try the analysis script |

## Running a study

1. Copy `testers.template.csv` to `testers.csv` (gitignored), list your testers with participant codes and a persona each. **Make every username unguessable** (a participant code plus a few random characters, like the template's `p01-k7q2xm`): login takes only a username, so a guessable one lets anyone who finds the URL sign in as that tester. The roster check rejects plain `tester01`-style names. Delete the accounts when the study ends (`frequent_bnpl`, `budget_conscious`, `irregular_income`).
2. `cd backend && uv run python scripts/seed_testers.py --roster ../uat/testers.csv --dry-run`, then again without `--dry-run`. This needs `backend/.env` (see `refdocs/guides/env_setup.md`).
3. Run each session with `task-script.md`. The persona CSVs are in `data/personas/`.
4. Copy `templates/*.csv` into `uat/data/<run>/` and type each tester's answers in. This folder is gitignored; real answers never leave your machine unless you decide so.
5. `cd backend && uv run python -m ml.uat.analyse --data ../uat/data/<run> --out ../reports/uat/<run>.md`

The report gives mean SUS with a 95% confidence interval, the mean of each clarity item, and a before/after table per scenario showing how many testers chose a safer, the same or a riskier option (against the ordering in `vignettes.yaml`). With five to seven testers these are descriptive only, and the report says so.

## Persona dates

The committed persona files run from 1 June to 24 October 2026, built for a study held 25-31 October 2026: every row is in the past on every study day, and the forecast (which calls a ledger stale after 14 days without a transaction) never flags it. Each persona was checked, with no savings, on each of those days (`ml.datagen.personas`: `CHECK_DAY_OFFSETS`, `PERSONA_AS_OF`). For a study on other dates, move the persona forward so it ends just before that day (the purchase outcomes were checked only for 25-31 October, so look at them again after shifting):

```
cd backend && uv run python -m ml.uat.shift_persona --persona budget_conscious     --session <the session date, YYYY-MM-DD> --out ../uat/data/budget_conscious_shifted.csv
```

Every date moves by the same whole number of weeks, so weekday patterns and the gaps between payments survive. Give the tester that file (not the original) for the import task. Do this on the day: a file shifted for one day is stale a fortnight later.

## Dry run

Run one full session with a friend before the real ones. Read the report it produces and check that every number matches what you recorded. Change `task-script.md` wherever the tester was confused by the script rather than by the app.

## Try the script without any data

`cd backend && uv run python -m ml.uat.analyse --data ../uat/data/example` prints a report marked **invented**. The marking comes from the first line of each example file; remove that line from a file and the banner goes with it, so never do that to the example.
