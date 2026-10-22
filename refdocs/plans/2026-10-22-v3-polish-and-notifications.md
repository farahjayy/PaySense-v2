# Plan — P7e: v3's look and guidance, a Notifications page, and a calmer start

> Execution: `refdocs/execution/2026-10-22-v3-polish-and-notifications.md`. Scope source: the author's second review of PaySense v3 (`github.com/farahjayy/PaySense-v3`, read from the local copy) and her answers in the same conversation. Builds on D-48, D-49, D-52, D-53, D-56, D-57 and D-58. Frontend only: no backend route, no migration, no engine or model change.

## 1. Why this exists

v3's screens read a little more clearly than v2's in a few places the author named: a heavier page title, a "Why?" toggle for background text, a sidebar split into labelled sections, a profile card with plain text links, and a Getting started box that explains each step. She also found two real problems in v2: the same "four months" message appears in three places, and a "looks incomplete" warning for a month the student can do nothing about can only be read, never closed.

## 2. Scope

**In**
1. **Page title** 32px bold (was 28px semibold). A `more` slot on the page header shows a "Why?" toggle under the intro. Recurring uses it with v3's wording; the dashboard intro becomes "Where your money is heading, what you owe, and whether the next buy-now-pay-later plan fits."
2. **Getting started** opens long (v3's descriptions, the "n of 4 months" counter and the links), can be shortened to a plain checklist whose unfinished titles are links, and can still be hidden entirely. The long/short choice is kept in this browser.
3. **Sidebar sections** (Overview, Your money, Buy now pay later, How it works; Admin below for admins only). **Import** gets its own entry under Your money and keeps its button on Transactions. Categories stays a button on Transactions. The phone's bottom bar keeps its four pages; Import and Notifications go in "More pages".
4. **Profile card** at the foot of the sidebar: initials, display name only (never the username, which is the whole credential under D-54), **Your data** and **Log out** as text links, **Show the intro again** for everyone. The tagline paragraph goes, and the section list scrolls on a short window.
5. **User view** (Admin page): a switch that hides the Admin entry in this browser so the author sees what a normal user sees, with a slim bar to switch back. Display only, like the role itself (D-56).
6. **About the model**: "Where PaySense comes from" (a UTP final-year prototype, not a bank's product) and "New to BNPL in Malaysia?", both from v3 and rewritten for this project.
7. **Notices.** Each month that looks incomplete becomes **one** notice listing its reasons (it was one per reason). A notice about a month has an **Import** link and a **close** button. Closed notices are not lost: a new **Notifications** page (Overview section) lists everything, current and closed, with **Restore**. The dashboard says how many are closed and links there.
8. **The "four months" box** moves to Transactions, where the fix is. The dashboard and risk check keep a one-line note with an Import link, so neither is blank.

**Held back (the author asked to wait):** a "What can I do?" fold that explains the cases where a month cannot be fixed.

**Out**
- v3's assistant, Insights page and security drill; the "Try this" box (assistant-only); the delete-plan default (kept: payments stay unless unticked); any change to the forecast, which still uses an incomplete month as logged.
- Closing a notice in the account (it needs a table and a migration): kept in this browser only, per person.

## 3. Design

- `PageHeader` gains `more`. `Fold`-style `details`, no new dependency.
- `lib/checklistStore.ts` gains a second flag (short view); `GettingStarted` renders from it.
- `lib/notices.ts`: the dismissed-notice store (localStorage per person, in try/catch, in-memory fallback, as `introTour`). A notice id carries its reasons, so a new reason on a closed month brings it back.
- `lib/forecast.ts` `notices()` merges suspect months by month and tags each notice `dismissible` and with an optional `action` link. Stale-ledger, rough-range and capped notes are not closable: they qualify the number.
- `lib/viewAs.ts`: a `sessionStorage` flag read by the shell.
- `AppShell` is rebuilt around `NAV_GROUPS`; `lib/nav.ts` loses `/import` from the Transactions group.
- The browser still computes no money.

## 4. Risks

- **Closing hides a warning that qualifies a number.** Mitigation: a closed notice stays on the Notifications page, the dashboard keeps "n closed", and the forecast's own range is unchanged. Only data-quality notes about a month are closable.
- **Intro replay for everyone** reverses D-56's UAT reasoning (a replay mid-session is observation noise). The author chose it; recorded as an amendment, and the Admin page keeps its own launch button.
- **A taller sidebar clips on short windows.** Mitigation: the section list scrolls, the tagline is dropped, a test checks the list is a scroll container.
- `ASSUMED:` the long/short Getting started choice and closed notices are per browser, as the hide choice already is.
