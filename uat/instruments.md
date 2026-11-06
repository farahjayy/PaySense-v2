# Instruments

All are answered in two forms (`forms.md`: Form A before the app, Form B during and after) and copied into the CSV templates in `templates/`. Participant ids are `P01`, `P02`, …; names are never written next to answers. Each item's code in `forms.md` is the item number below (`C1`, `S3`, ...).

## 1. Decision vignettes (before and after)

The three scenarios and their options are in `vignettes.yaml`. Each tester answers **one**: the one that matches the first purchase on their page (V1 headphones, V2 laptop repair, V3 shoes), because only that purchase is checked in the app. The other two have no "after" and would never be paired.

- **Before** (Form A, before the app is shown): "Which would you do?" Choose one option. "How sure are you, from 1 (not at all) to 5 (completely)?"
- **After** (Form B, right after the tester has run the risk check for the same purchase): the same two questions again.

Record `pre` and `post` rows in `templates/vignettes.csv`.

## 2. Explanation clarity (after the three purchases)

Alongside the ratings, each purchase carries three questions in the tester's own words: what result PaySense gave (`P#-BAND`), why they think it said that (`P#-WHY`) and what they would do (`P#-DO`). These are the check on whether an explanation works without anyone explaining it: the chosen band is compared with the answer key, and the wording of the "why" is read against the reasons the app actually showed. Two further items the supervisor accepted are asked once, after the purchases: **R1** "The forecast of this student's money felt realistic." (1-5) and **W1** "If a result had warned you about a purchase, would it have changed your decision?" (Yes / Maybe / No / I did not see a warning).

Answer each of C1-C4 from 1 (strongly disagree) to 5 (strongly agree):

| Item | Statement |
|---|---|
| C1 | I understood why the risk check gave the result it did. |
| C2 | The reasons it listed matched my own sense of my money. |
| C3 | The suggested change (or the message that nothing helps) was clear. |
| C4 | I could explain the result to a friend in my own words. |

## 3. System Usability Scale (at the end)

Answer each from 1 (strongly disagree) to 5 (strongly agree). Scoring is done by the analysis script.

| Item | Statement |
|---|---|
| S1 | I think that I would like to use this system frequently. |
| S2 | I found the system unnecessarily complex. |
| S3 | I thought the system was easy to use. |
| S4 | I think that I would need the support of a technical person to be able to use this system. |
| S5 | I found the various functions in this system were well integrated. |
| S6 | I thought there was too much inconsistency in this system. |
| S7 | I would imagine that most people would learn to use this system very quickly. |
| S8 | I found the system very cumbersome to use. |
| S9 | I felt very confident using the system. |
| S10 | I needed to learn a lot of things before I could get going with this system. |

The System Usability Scale is by John Brooke (1996).

## 4. Debrief questions (not scored)

1. What, if anything, would you have wanted the risk check to say that it did not?
2. Was there anything it said that you did not believe? Why?
3. Would you use something like this before a real purchase?

These are free-text questions in Form B (`D1`-`D3`, plus `D4` for anything else). Form B also asks which steps the tester opened a hint for (`H1`); both are read by hand and kept against the participant code.
