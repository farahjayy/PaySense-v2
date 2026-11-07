# UAT kit

Everything needed to run a short, **self-guided** usability and decision study with a handful of testers on **synthetic persona data**. Nothing here collects real financial information. Each tester gets a link, a username, one page of instructions and one statement file, and fills in two forms; nobody sits with them.

The study measures usability (SUS), how clear the explanations are, and whether the risk check changes a decision. The pack gives testers **context and goals, never explanations or expected results** (D-67): a pack that taught the answer would measure the pack, not the app.

| File | What it is |
|---|---|
| `booklet-template.html` | The text of the tester's page; `ml.uat.booklet` fills it in per tester |
| `forms.md` | The two forms (Form A before, Form B after), ready to paste into Microsoft Forms or Google Forms, every question with a code |
| `participant-information.md` | The information and consent note (also pasted into Form A) |
| `instruments.md` | SUS, explanation-clarity items, vignette questions, debrief: what each is and where it is asked |
| `vignettes.yaml` | The three decision scenarios, their options and the risk ordering the analysis uses |
| `purchase-cards.yaml` | Per persona: the one BNPL limit to record and three purchases to check. The answer key for a session is `reports/uat/purchase_cards_session_<date>.md`, for you only (see "Persona dates") |
| `templates/` | Blank response files the analysis reads: `sus.csv`, `clarity.csv`, `vignettes.csv` |
| `testers.template.csv` | Roster format: `participant,username,display,persona` |
| `data/example/` | **Invented** answers for six imaginary testers, to try the analysis script |

## Running a study

1. **Roster.** Copy `testers.template.csv` to `testers.csv` (gitignored) and list your testers, one persona each. Login takes only a username, so a guessable one lets anyone who types it sign in as that tester (and reset their data). Random usernames (a participant code plus six random characters) avoid that; **the author chose the testers' own names instead (D-68)**, accepting it because the data is synthetic and a spoiled session can be redone. The template's example names are in this public repository, so the roster check and the seeding script refuse them, as well as plain `tester01`-style names. Keep the real names only in this file: it is gitignored.
2. **Seed the accounts** against the live database: `cd backend && uv run python scripts/seed_testers.py --roster ../uat/testers.csv --dry-run`, then again without `--dry-run` (needs `backend/.env`, see `refdocs/guides/env_setup.md`). Delete the accounts when the study ends.
3. **Build the forms** from `forms.md` (two separate forms) and note their links.
4. **Build the packs:**
   ```
   cd backend && uv run python -m ml.uat.booklet --roster ../uat/testers.csv --session <YYYY-MM-DD> \
     --app-url https://<app>.vercel.app --form-a <Form A link> --form-b <Form B link> --out ../uat/data/pack
   ```
   For each tester this writes `uat/data/pack/<code>/PaySense-UAT-<code>.html` and `student-statement.csv` (their persona's history moved forward to end just before `--session`, see below). **Send each tester only their own `.html` file**: the statement is inside it as a download link, so it is the only file they need. The separate `.csv` is for your own checking.
5. **Check before sending.** Open one page; sign in as that tester in the live app; do the steps yourself, including each purchase card, and compare the bands with `reports/uat/purchase_cards.md` (see "Persona dates").
6. **After the answers come in,** export each form's responses to a spreadsheet and type or paste them into copies of `templates/*.csv` in `uat/data/<run>/` (gitignored). The codes in `forms.md` say which question feeds which column.
7. `cd backend && uv run python -m ml.uat.analyse --data ../uat/data/<run> --out ../reports/uat/<run>.md`

The report gives mean SUS with a 95% confidence interval, the mean of each clarity item, and a before/after table per scenario showing how many testers chose a safer, the same or a riskier option (against the ordering in `vignettes.yaml`). With five to eight testers these are descriptive only, and the report says so. It does not read `R1` (the forecast felt realistic) or `W1` (would the warning have changed your decision); report those by hand until it does. The own-words answers (`M1`, `P#-WHY`, `P#-DO`) and each tester's chosen band (`P#-BAND`, to compare with the answer key) are also read by hand.

## Who is seeded

Eight testers are seeded: P01, P02 and P08 `budget_conscious`, P03-P04 `frequent_bnpl`, P05-P07 `irregular_income`. The table, and what is still open for each, is in `refdocs/STATUS.md` ("P9 — UAT testers"). Names and usernames are kept out of the repository on purpose and live only in your gitignored `uat/testers.csv`. When you add or change a tester, edit that file and run the seeding command again (it skips accounts that exist). To get a tester's tour back after you have opened it yourself, delete the account in the Supabase SQL editor and seed again; nothing else is needed, since the "seen" flags are kept in the browser against the account's id.

## What each tester does

One scenario each: **V1 headphones** with `frequent_bnpl`, **V2 laptop repair** with `irregular_income`, **V3 shoes** with `budget_conscious`. It is the first purchase card on their page, so their "after" answer follows the check it refers to. They answer their own scenario in Form A before opening the app and again in Form B after the first purchase; the other two scenarios are not asked of them. The order of the three purchases is fixed rather than counterbalanced (with eight testers a counterbalance would leave two or three per cell); the report should say so. The persona is never named to the tester and the statement file has a neutral name.

## Persona dates

The committed persona files in `data/personas/` run from 1 June to 24 October 2026. The forecast calls a ledger stale after 14 days without a transaction, so `ml.uat.booklet` moves each tester's file forward by whole weeks so that it ends just before `--session` (weekday patterns and the gaps between payments survive; a payment on the 1st may land on another day of the month). Each tester's page states the last day their file stays current (the file's last transaction plus 14 days); after that the app says the history is out of date, so testers must finish by then. To shift a file by hand: `uv run python -m ml.uat.shift_persona --persona <name> --session <YYYY-MM-DD> --out <file>`.

The bands in `purchase-cards.yaml` and the tests are pinned to the files a tester gets for the **8 November 2026** session, on 8-14 November. `reports/uat/purchase_cards.md` is the same measurement on the unshifted committed files on 25-31 October (`ml.datagen.personas`: `CHECK_DAY_OFFSETS`, `PERSONA_AS_OF`), kept for reference: it differs where a card sits near a band edge. A different session date moves the data to different calendar days, so re-measure and re-pin the bands before using it. For a session, run `cd backend && uv run python -m ml.uat.purchase_cards --session <YYYY-MM-DD>`: it measures the file a tester gets for that date, on the week from that day, and writes `reports/uat/purchase_cards_session_<date>.md`. Then run each card on the pack's `student-statement.csv` (not on `data/personas/` itself) in the live app, with every Recurring suggestion confirmed, and compare with that file. A card whose band differs is a finding to record, not something to hide. Each result in the key is written as the screen shows it: the band, the score out of 100 and the chance of running short.

## Dry run

Give the pack to a friend, not a tester, and watch for where the **pack** confuses them rather than the app; change `booklet-template.html` for that. Then read the report their answers produce and check that every number matches what they entered.

## Try the analysis without any data

`cd backend && uv run python -m ml.uat.analyse --data ../uat/data/example` prints a report marked **invented**. The marking comes from the first line of each example file; remove that line from a file and the banner goes with it, so never do that to the example.

## Purchase cards and the instructed path

Testers never type their own BNPL limit or need a provider account: `purchase-cards.yaml` gives each persona one limit and three purchases (provider, item, price, instalments, fee), and the pack prints them from that file. The pack tells testers to **confirm every suggestion on the Recurring page** before the risk check: the cards are measured on that path (D-63). If a tester skips it the forecast does not know the standing bills or instalments and some answers change (the answer key lists both). Regenerate the key with `cd backend && uv run python -m ml.uat.purchase_cards`.
