# The two forms

Text to paste into a form tool (Microsoft Forms or Google Forms). **Build two separate forms, not one**, so a tester cannot go back and change their "before" answer after seeing the app. Every question starts with a **code** (the first column); put it at the front of the question title, for example `[S3] I thought the system was easy to use.` The codes are how the exported spreadsheet is turned into the three CSV files the analysis reads, so do not reword or drop them. `tests/ml/uat/test_forms_doc.py` checks this file against `vignettes.yaml`, `instruments.md` and the CSV templates.

**Settings for both forms:** do not record names or email addresses; one response per person is not needed; do not show the other tester's answers; turn on a thank-you message. Options in the scenario choice questions may be shuffled, because the letters (`A.` to `E.`) are part of the option text and are what the converter reads.

**Scales used below:** *agree* = 1 Strongly disagree, 2 Disagree, 3 Neither, 4 Agree, 5 Strongly agree. *sure* = 1 Not at all sure, 2, 3, 4, 5 Completely sure.

---

## Form A — before you open the website

**Title:** PaySense practice session: before you start

**Description (paste in full):**

> PaySense is a student project: a website that helps a student think about whether a "buy now, pay later" (BNPL) purchase is a good idea. We want to find out whether it is easy to use and whether it makes sense. This is a test of the website, not of you. There are no right or wrong answers.
>
> Everything in the session is made up. Please do not enter any of your own bank, e-wallet or BNPL details anywhere.
>
> Taking part is voluntary. You can skip any question and stop at any time, and nothing happens if you do. Your answers are kept under your code (for example P03), never your name, and are used only in this project's report, together with other people's answers. The report may quote a short comment without anything that identifies you. To have your answers removed, tell the project author your code before the report is written.

| Code | Question | Type | Required |
|---|---|---|---|
| `A-CODE` | Your code (it is at the top of your page, for example P03) | Short text | Yes |
| `A-CONSENT` | I have read the above and I am happy to take part. | Choice: Yes | Yes |
| `A-SCEN` | Which item is **Purchase 1** on your page? | Choice: Wireless headphones / Laptop repair / Shoes | Yes |

Then three blocks, one per scenario. Put this line above each: **"Answer only the block for your Purchase 1 item. Skip the other two."** Make every question in the blocks optional.

### Block: Wireless headphones

> You get RM 1,000 a month (allowance and part-time work). Rent, food and transport come to about RM 850. You already pay RM 150 a month on another BNPL plan. You want headphones priced at RM 600 and can pay on SPayLater in 3 monthly instalments, the first due next month.

| Code | Question | Type |
|---|---|---|
| `V1-pre` | Which would you do? | Choice (below) |
| `V1-pre-conf` | How sure are you of that choice? | Choice: sure, 1 to 5 |

- A. Buy them on SPayLater in 3 instalments, as offered
- B. Buy them but spread over 6 instalments
- C. Buy a cheaper pair at about half the price
- D. Wait a month and decide then
- E. Do not buy them

### Block: Laptop repair

> Your income varies: RM 400 in a quiet month and RM 1,600 in a busy one, about RM 1,000 on average. Your fixed costs are about RM 700 a month. Your laptop needs a RM 1,200 repair. Atome offers 4 payments, the first at checkout.

| Code | Question | Type |
|---|---|---|
| `V2-pre` | Which would you do? | Choice (below) |
| `V2-pre-conf` | How sure are you of that choice? | Choice: sure, 1 to 5 |

- A. Repair it on Atome in 4 payments, as offered
- B. Repair it but ask for a longer plan elsewhere
- C. Choose a cheaper repair or a second-hand part
- D. Borrow a laptop for a month and decide then
- E. Do not repair it

### Block: Shoes

> You live on RM 700 a month and spend nearly all of it on rent, food and transport. A pair of shoes you like costs RM 250. TikTok PayLater lets you pay in 2 monthly instalments, the first due next month.

| Code | Question | Type |
|---|---|---|
| `V3-pre` | Which would you do? | Choice (below) |
| `V3-pre-conf` | How sure are you of that choice? | Choice: sure, 1 to 5 |

- A. Buy them on TikTok PayLater in 2 instalments, as offered
- B. Buy them but spread over 4 instalments
- C. Buy cheaper shoes
- D. Wait until you have saved part of the price
- E. Do not buy them

**Thank-you message:** "Thank you. Now go back to your page and carry on with the next step."

---

## Form B — while you use the website, and at the end

**Title:** PaySense practice session: your answers

**Description:** "Keep this open in a second tab or window while you work through your page, and answer each part when your page tells you to. Submit it at the end. There are no right or wrong answers; we want to know what you actually thought. If something was unclear, please say so."

| Code | Question | Type | Required |
|---|---|---|---|
| `B-CODE` | Your code (the same as in Form A) | Short text | Yes |

### Part 1 — The student's money (after the dashboard step)

| Code | Question | Type | Required |
|---|---|---|---|
| `M1` | In your own words, what does PaySense say about this student's money over the next few months? | Long text | Yes |

### Part 2 — Purchase 1, then Purchase 2, then Purchase 3

Repeat this block three times, with the questions' codes starting `P1-`, `P2-` and `P3-`, in the order of the purchases on your page. Start each block with the heading "Purchase 1" (or 2, or 3).

| Code | Question | Type | Required |
|---|---|---|---|
| `P1-BAND` | What result did PaySense give for this purchase? | Choice: Safe / Caution / At Risk / I could not get a result | Yes |
| `P1-WHY` | In your own words, why do you think PaySense gave that result? | Long text | Yes |
| `P1-DO` | What would you do about this purchase now, and why? | Long text | Yes |
| `P1-SAFER` | Did PaySense offer a way to make this purchase safer? | Choice: Yes, and I tried it / Yes, but I did not try it / No / It was not needed | Yes |
| `P1-SAFER-NOTE` | If it did, what did you think of it? | Long text | No |

(`P2-BAND`, `P2-WHY`, `P2-DO`, `P2-SAFER`, `P2-SAFER-NOTE` and `P3-...` are the same questions.)

### Part 3 — Back to the scenario (right after Purchase 1)

| Code | Question | Type | Required |
|---|---|---|---|
| `B-SCEN` | Which item was **Purchase 1** on your page? | Choice: Wireless headphones / Laptop repair / Shoes | Yes |

Then the three scenario blocks again, each worded exactly as in Form A, with the line above them **"Answer only the block for your Purchase 1 item. Skip the other two."** Every question in the blocks is optional. Use the same options, with the same letters. Introduce each block with **"Think back to this scenario and answer again. It is fine if your answer has not changed."**

| Code | Question | Type |
|---|---|---|
| `V1-post` | Which would you do? (Wireless headphones) | Choice, options A to E as in Form A |
| `V1-post-conf` | How sure are you of that choice? | Choice: sure, 1 to 5 |
| `V2-post` | Which would you do? (Laptop repair) | Choice, options A to E as in Form A |
| `V2-post-conf` | How sure are you of that choice? | Choice: sure, 1 to 5 |
| `V3-post` | Which would you do? (Shoes) | Choice, options A to E as in Form A |
| `V3-post-conf` | How sure are you of that choice? | Choice: sure, 1 to 5 |

### Part 4 — Looking around (optional step)

| Code | Question | Type | Required |
|---|---|---|---|
| `L1` | Did anything in PaySense catch your eye, or confuse you? | Long text | No |

### Part 5 — The explanations

Introduce with: **"Think about the results PaySense gave for the three purchases."** All questions use the *agree* scale and are required.

| Code | Question |
|---|---|
| `C1` | I understood why the risk check gave the result it did. |
| `C2` | The reasons it listed matched my own sense of my money. |
| `C3` | The suggested change (or the message that nothing helps) was clear. |
| `C4` | I could explain the result to a friend in my own words. |

### Part 6 — The forecast and the warnings

| Code | Question | Type | Required |
|---|---|---|---|
| `R1` | The forecast of this student's money felt realistic. | *agree* scale | Yes |
| `W1` | If a result had warned you about a purchase, would it have changed your decision? | Choice: Yes / Maybe / No / I did not see a warning | Yes |

### Part 7 — Using the website

Introduce with: **"Please answer for the PaySense website you have just used."** All use the *agree* scale and are required. These ten statements are the System Usability Scale (John Brooke, 1996): keep the wording and order exactly.

| Code | Statement |
|---|---|
| `S1` | I think that I would like to use this system frequently. |
| `S2` | I found the system unnecessarily complex. |
| `S3` | I thought the system was easy to use. |
| `S4` | I think that I would need the support of a technical person to be able to use this system. |
| `S5` | I found the various functions in this system were well integrated. |
| `S6` | I thought there was too much inconsistency in this system. |
| `S7` | I would imagine that most people would learn to use this system very quickly. |
| `S8` | I found the system very cumbersome to use. |
| `S9` | I felt very confident using the system. |
| `S10` | I needed to learn a lot of things before I could get going with this system. |

### Part 8 — Where you needed help, and last thoughts

| Code | Question | Type | Required |
|---|---|---|---|
| `H1` | Which steps did you open a hint for? Tick all that apply. | Multiple choice: Sign in / Get the history in / See what PaySense says about the money / Regular monthly payments / The BNPL limit / Checking a purchase / None: I did not use any hints | Yes |
| `D1` | What, if anything, would you have wanted the risk check to say that it did not? | Long text | No |
| `D2` | Was there anything it said that you did not believe? Why? | Long text | No |
| `D3` | Would you use something like this before a real purchase? Why, or why not? | Long text | No |
| `D4` | Anything else you would like to tell us? | Long text | No |

**Thank-you message:** "Thank you for taking part. You can close this page."

---

## Turning the answers into the analysis files

Export each form's responses to a spreadsheet. The analysis reads three files (`templates/sus.csv`, `clarity.csv`, `vignettes.csv`): `S1`-`S10` and `C1`-`C4` go in as the 1-5 numbers, one row per participant code; for each vignette `V1`-`V3`, the letter before the full stop in `Vn-pre` / `Vn-post` and the number in the matching `-conf` column become a `pre` and a `post` row (only the vignette that tester answered has values). `M1`, `P#-WHY`, `P#-DO`, `L1` and `D1`-`D4` are read by hand, and `P#-BAND` is compared with the answer key in `reports/uat/purchase_cards.md`. `R1` and `W1` are reported by hand, because the analysis script does not read them yet.
