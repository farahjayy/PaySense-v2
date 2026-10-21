# Plan — P7d: the Second-Opinion Check, a calmer result, and a guided start

> Execution: `refdocs/execution/2026-10-21-p7d-second-opinion-and-guided-start.md`. Scope source: the author's review of PaySense v3 (the FinTechathon build, `github.com/farahjayy/PaySense-v3`, which was cloned from v2 at commit `cdd43cf` and then grew on its own). She asked which v3 features help the user, fit v2's objectives and look good, and asked that v2 keep its calmer layout.

## 1. Why this exists

v3 was built for a competition and added a lot (assistant, budgets, Google sign-in, an on-screen security drill). Most of it is outside v2's brief. A few parts are exactly on it and were checked by running v3 and reading its code: a view of **everything the student already owes across providers, stacked by month, and what one more purchase adds** (PRD §4 Dashboard: "BNPL stack"), a **guided tour**, and a **honest-limits model page**. v3's pages are also crowded; v2 should take the ideas and none of the clutter.

Login is not part of this plan: the UAT runs on seeded username-only accounts with synthetic data (D-54).

## 2. What's already covered

- The risk response already carries `probability_without_purchase`, `simulated_probability` and both margin curves (`app/api/risk.py`), so "without / with / adds" needs **no engine or model change**.
- Plans, instalments and provider limits are read by `db/plans.py` and `db/provider_limits.py`; the unpaid-instalment stack is arithmetic over them.
- A theme, `Face`, `Card`, `Banner` and the Getting started checklist exist (D-48, P7b). The sidebar and phone bar already follow D-49.
- The counterfactual search (D-41) already judges waiting by direct simulation.

## 3. Scope

**In — Batch A (no retraining, no migration)**
1. **Second-Opinion block** on the risk result: three tiles (without, with, adds in points), an "already At Risk without this purchase" note, the month-by-month stack of every unpaid instalment with this plan added and the confirmed income that month, and the exposure before and after (unpaid total, providers, plans; the RM1,500 Bank Negara line only when the person recorded limits, shown as information). New pure module `domain/second_opinion.py` ported from v3 and re-tested; new `second_opinion` object on `POST /api/risk/check`, stored with the frozen report (absent on older reports).
2. **A calmer, layered result** (the author's point: too long is crowded, too short is not believed). Always visible: score and band, the one-line meaning, the three tiles, the Why list, the smallest change, and "Going ahead?". Folded, each with a one-line summary that carries its key numbers: *Month by month*, *Your BNPL exposure*, *Instalment schedule and cost*, *Margin with and without*, *Repayment history*, *How the two numbers differ*. An "Open all" switch. The detail is one tap away, so it still reads as thorough.
3. ~~Start-date candidates from income dates~~ **Not built (found already covered):** D-41's search already tries buying the day after the next confirmed income, judged by direct simulation. A second income date would add one candidate to a grid capped at 60 evaluations. No separate "Find a better time" card; a student already At Risk without the purchase is told so beside the tiles.
4. **A one-line alert** on the dashboard, only when something needs attention, from **three** rules over what the person has recorded: an instalment overdue, two or more payments within a week of each other in the next two weeks, a provider limit 80% used. (The plan named four; the chance of running short and a locked forecast are already said by the dashboard's main card and are not repeated.) One slim line that opens the list; no new dashboard cards.
5. **Intro and tour**: three short intro slides on first sign-in (what it does, how to read the answer, you stay in control) and a six-stop spotlight tour (forecast, Transactions, Risk check, Plans, About the model, Settings), skippable, replayable from Settings ("Show the intro again", beside the checklist row). Reduced motion respected; a phone has its own stops.
6. **About the model**: add "What it never looks at" and "Where it is weak" in plain words; every figure comes from `GET /api/model-info` or a report, none typed in.

**In — Batch B (separate plan, only if a measurement says it is needed)**
7. **Savings buffer, forecast-band widening for short histories, "purchase adds nothing" benchmark.** These change Engine 1's simulation and so Engine 2's labels: they mean a retrain, a re-export, regenerated reports and an ml-auditor pass. First task is a **measurement** (`backend/ml/buffer_check.py`, no engine file changed): the three persona statements with and without a RM1,000 and a RM3,000 buffer, and how many of 10 purchases reach Safe. **Result (reports/buffer_check/README.md): with no buffer none of the 10 purchases reaches Safe for any of the three personas (0 of 10 each, and two personas are At Risk before buying anything); with RM1,000, 24 of 30 do.** So the buffer round is worth planning, as its own plan, before the UAT. (v3 found that on its demo personas no purchase reached Safe without a buffer.)

**Out**
- **Google sign-in, self sign-up and a tester passphrase** (see §5 and D-54).
- The assistant and its consent notice, budgets and suggested budget, spending insights, ranked recommendations, the security drill, "Try this", the "New to BNPL in Malaysia?" box, v3's dashboard layout. They are outside the PRD's modules or belong to the optional P10 (LLM phrasing), and they are what made v3 crowded.
- Any new candidate algorithm (D-05).

## 4. Design

- **Backend.** `app/domain/second_opinion.py` (pure, integer sen), `app/domain/alerts.py` (pure), additive fields on `RiskCheckOut`, a `GET /api/alerts` read route. All repository reads take `user_id` first; each new route gets a two-user isolation test and an unauthenticated test (D-03). Money stays in sen to the API boundary (D-16).
- **Frontend.** `components/risk/SecondOpinion*.tsx`, a small `Fold` (button with `aria-expanded`, a one-line summary, a body) used by the result, `components/dashboard/AlertLine.tsx`, `components/onboarding/{Intro,Tour}.tsx`, `lib/introTour.ts` (localStorage in try/catch, as v3). The browser computes no money. After any route change run `npm run gen:api`.
- **Words.** "Chance of running short" is used as it is today. The result already shows an estimate and a direct simulation; the Second-Opinion tiles use the simulation for both "without" and "with" so they add up, and say so in one line.

## 5. Login and the UAT (D-54)

Login stays username-only. The UAT uses accounts the author seeds with unguessable usernames and a synthetic persona; each account sees only its own rows (D-03). Between testers an account goes back to its start by re-seeding it or by Settings' factory reset (D-50), so there is no throwaway-session mode to build. Google sign-in (a Google Cloud project, consent screen, secret, redirect URIs on two hosts, and a real email and name per user against D-14), self sign-up and a per-tester passphrase were considered and not added; they stay available in v3.

## 6. Risks

- **A longer result page is still long.** Mitigation: layered folds, with a test that the folded result contains no more than a set number of visible cards, and a phone screenshot review.
- **A number shown twice that disagrees.** The risk result already shows an estimate and a simulation. Mitigation: tiles use the simulation for both sides; one line says why they can differ from the headline.
- **Old stored reports lack `second_opinion`.** The field is optional and the block is hidden when absent; a test opens a report saved before the change.
- `ASSUMED:` (D-54) testers use seeded accounts with synthetic data only. If one enters their own real data, login and consent need revisiting.
- **The author's uncommitted Settings work** touches `AppShell.tsx`, `queries.ts` and `schema.d.ts`. Start only after it is committed, to keep the changes separate.
- `ASSUMED:` the RM1,500 Bank Negara line is shown only as information from the person's own recorded limits, as v3 does and as `research-2026-10-08.md` cites it.
