# Plan — Settings: download my data, clear my data, factory reset

> Execution: `refdocs/execution/2026-10-20-settings-and-reset.md`. Scope source: the author's request ("a settings page, a place to reset the account and clear all the data, without deleting every transaction and plan by hand"), and her answers: a link by her name rather than a new menu item; tick boxes **and** a factory-reset button; download before deleting; name it Settings.

## 1. Why this exists

A tester (and the author, while building) ends up with data they want gone: a ledger full of experiments, test plans, wrong recurring items. Today the only way out is deleting rows one at a time, or asking the author to touch the database. There is also nowhere to put the small things that belong to the person rather than to a page (bringing back the Getting started checklist, a copy of their data).

## 2. What's already covered

- Every repository function is user-scoped (D-03); deleting one transaction, plan, recurring item, category or limit already works, with the plan delete offering to keep or remove the payments it logged (D-21 style flag).
- Foreign keys: instalments cascade with their plan; transactions, plans and reports are linked with `on delete set null`, so removing one kind never fails on another.
- The importer's template (`type,date,item,amount,category`) is a ready, re-importable format for a transaction export.

## 3. Scope

**In**
1. **Settings page** (`/settings`), reached from a "Settings" link beside the signed-in name (sidebar footer on desktop, top bar on a phone). Not a sidebar menu item.
2. **Download my data**, before anything is deleted: all transactions as a CSV in the import template's format (so it can be imported back), and everything as one JSON file (transactions, plans with their instalments, recurring items, limits, categories).
3. **Clear selected data**: tick boxes for Transactions, BNPL plans (with their saved risk reports), Recurring items, BNPL limits, My own categories; each shows how many there are. A plan's logged payments stay as ordinary transactions unless Transactions is ticked too.
4. **Factory reset** ("Reset everything"): every box above, plus the Getting started checklist and onboarding state back to new. The account and username stay.
5. Both destructive paths show what will go, remind the person to download first, and need the word RESET typed. There is no undo.
6. A small "Show the getting started checklist again" row.

**Out**
- Deleting the account or changing the username (accounts are seeded by the author; login is username-only, D-03).
- Per-row export formats beyond CSV and JSON; scheduled backups.
- Undo or a recycle bin.

## 4. Design

- **Backend** `app/api/account.py`: `GET /api/account/summary` (counts), `POST /api/account/reset` (`scopes` 1 to 5 unique names, `confirm: "RESET"`), `GET /api/account/export?format=csv|json`. Repository `app/db/account_data.py` with `ScopedTable.delete_all(user_id)`, which pages the caller's ids and deletes in batches (never a table-wide delete). Order: transactions, instalments, plans, reports, recurring items, limits, categories, so nothing depends on a cascade to be tidy; running it again finishes a partial run (idempotent). One reset at a time per person; rate limited.
- **Money** stays integer sen in the database and in JSON; the CSV writes RM with two decimals from integer arithmetic, never floats.
- **Frontend**: `SettingsScreen`, a link by the name, confirm dialogs with the typed word, all queries refreshed after a reset. The frontend computes no money.

## 5. Risks

- **The worst failure is deleting the wrong person's data.** Mitigation: `delete_all` always carries `user_id`, has no unscoped form, and is covered by a two-user isolation test for every scope.
- **A reset that fails halfway** leaves a mixed state. Mitigation: ordered, idempotent, and the response lists what was removed; the page says to run it again.
- **An accidental tap.** Mitigation: typed word, counts shown, red styling, and the download offered first.
- `ASSUMED:` an export of a very large ledger is read into memory in one request. Fine for a student's data (thousands of rows); revisit if it ever is not.
