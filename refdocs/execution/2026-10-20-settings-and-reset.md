# Execution — Settings: download my data, clear my data, factory reset

> Plan: `refdocs/plans/2026-10-20-settings-and-reset.md`. Tasks run top to bottom; each has a **Verify**. Failing test first for every task. Edit this doc if reality diverges (CLAUDE.md rule 4).

## Before starting
- Read `CLAUDE.md`, ADR D-03 (user scoping) and D-47 (what a plan owns).

## Phase A — backend
### A1. `ScopedTable.delete_all` and the erase repository
- **Files:** `app/db/base.py`, new `app/db/account_data.py`, `tests/test_account_data_repo.py`.
- **Steps:** `delete_all(user_id, **equals)` pages the caller's ids then deletes in batches; `counts(db, uid)`; `erase(db, uid, scopes)` in the order transactions, instalments, plans, risk reports, recurring items, limits, categories; unknown scope is a `ValueError`.
- **Verify:** for each scope, two users with data: only the caller's rows go; the other user's counts are unchanged; a second run removes nothing and does not fail; plans erased with transactions kept leaves the payments as transactions with no plan link.

### A2. Export
- **Files:** `app/db/account_data.py` (`export`), `app/domain/export.py` (CSV and RM formatting from sen).
- **Verify:** CSV header is `type,date,item,amount,category`; amounts are exact (RM 1,000.00 is `1000.00`, 5 sen is `0.05`); a description with a comma, quote or newline round-trips through the importer; a spreadsheet formula prefix (`=`, `+`, `-`, `@`) is neutralised; JSON carries plans with their instalments and holds integer sen.

### A3. Routes
- **Files:** `app/api/account.py`, `app/main.py`, `tests/api/test_account_api.py`.
- **Steps:** summary, reset (typed `RESET`, scopes 1 to 5 unique, per-person lock, rate limit), export (`Content-Disposition` attachment). Reset of everything also sets onboarding back to `new`.
- **Verify:** wrong or missing confirmation is 422 and deletes nothing; no scopes is 422; duplicate scopes are 422; two-user isolation on summary, reset and export; a concurrent second reset gets 409; `npm run gen:api` and `check:api` pass.

## Phase B — frontend
### B1. Settings screen
- **Files:** `app/(app)/settings/page.tsx`, `components/screens/SettingsScreen.tsx`, `components/settings/*`, `lib/api/queries.ts` hooks, tests.
- **Steps:** downloads (blob through the authenticated client), tick boxes with counts, "Select all", a factory reset card, typed-word dialogs, refresh all queries after, the checklist row (exported helper from `GettingStarted`).
- **Verify:** the button stays disabled until the word is exactly `RESET`; selecting nothing disables Clear; the request carries exactly the ticked scopes; Factory reset sends all five; counts and the dashboard refresh after; axe clean.

### B2. The link by the name
- **Files:** `components/layout/AppShell.tsx`, tests.
- **Verify:** the sidebar footer and the phone top bar each link to `/settings`; the sidebar menu is unchanged; Settings is highlighted on its page.

### B3. Browser journey
- **Verify:** Playwright: import a persona statement, open Settings, clear transactions only, see the counts and the dashboard fall back to the locked forecast; a second journey resets everything.

## Wrap-up
- [ ] ADR D-50; PRD §7 one-liner; CHANGELOG; STATUS; verification ledger
- [ ] security-reviewer (a destructive, user-scoped route) and fastapi/react review
