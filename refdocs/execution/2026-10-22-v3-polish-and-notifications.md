# Execution — P7e: v3's look and guidance, a Notifications page, and a calmer start

> Plan: `refdocs/plans/2026-10-22-v3-polish-and-notifications.md`. Read ADR D-61 and D-62 first. The v3 copy at `Documents\Involvement\Competition\2026\11 FinTechaton 2026 Shenzen\PaySense_v3` is read-only: port by reading, re-test, never copy a figure from its reports.
> Test first for each task; run `cd frontend && npm run lint && npx tsc --noEmit && npm run test && npm run build` at the end of each batch and name the result in the changelog.

## Batch 1 — page header, Getting started, About the model

- [x] **T1 Page header.** Test: the title is 32px bold; `more` renders a "Why?" `details` that is closed to begin with. Files: `components/ui/PageHeader.tsx`, `components/screens/RecurringScreen.tsx` (v3's wording split into `intro` and `more`), `DashboardScreen.tsx` (new intro).
- [x] **T2 Getting started.** Test: opens long (descriptions visible); the toggle shortens it to titles; unfinished titles link to their page; the choice survives a remount; "Hide this" still hides it; with storage blocked it still works for the visit. Files: `lib/checklistStore.ts`, `components/dashboard/GettingStarted.tsx`.
- [x] **T3 About the model.** Test: the two sections are present with their headings. Files: `components/screens/ModelScreen.tsx`.

## Batch 2 — the shell

- [x] **T4 Navigation groups.** Test: `isActive("/import", "/transactions")` is now false and `/import` has its own entry; Categories still lights Transactions. Files: `lib/nav.ts`, `tests/unit/nav.test.ts`.
- [x] **T5 Sidebar.** Test: four section labels in order; Import under Your money; Admin only for an admin; the list scrolls; no tagline; phone "More pages" holds Import. Files: `components/layout/AppShell.tsx`.
- [x] **T6 Profile card.** Test: name shown, username not; "Your data" goes to `/settings`; "Log out" signs out; "Show the intro again" replays the intro for any role. Files: `AppShell.tsx`, `components/onboarding/Tour.tsx` (settings stop wording).
- [x] **T7 User view.** Test: the switch hides the Admin entry and shows a bar with "Back to admin view"; a non-admin never sees the switch. Files: `lib/viewAs.ts`, `AdminScreen.tsx`, `AppShell.tsx`.

## Batch 3 — notices and the Notifications page

- [x] **T8 Merge and tag.** Test: two reasons for one month give one notice; its id carries both reasons; it is dismissible and has an Import action; stale and range notes are not dismissible. Files: `lib/forecast.ts`, `lib/risk.ts` (same merge for the check's notices).
- [x] **T9 Dismissed store.** Test: dismiss, restore, per person, survives a remount, in-memory fallback when storage throws, a new reason on a closed month shows again. Files: `lib/notices.ts`.
- [x] **T10 Notices UI.** Test: a close button and an Import link on a month notice; closing removes it from the list and shows "n closed" with a link. Files: `components/forecast/Notices.tsx`, `components/ui/Banner.tsx` (optional action and close slots), `DashboardScreen.tsx`.
- [x] **T11 Notifications page.** Test: lists current notices and alerts; closed ones under "Closed" with Restore; empty state; a signed-out visit is gated like every page. Files: `app/(app)/notifications/page.tsx`, `components/screens/NotificationsScreen.tsx`, sidebar entry.
- [x] **T12 The "four months" box.** Test: Transactions shows the full box while the forecast is locked and not after; the dashboard and risk check show a one-line note with an Import link. Files: `components/ui/States.tsx`, `TransactionsScreen.tsx`, `DashboardScreen.tsx`, `RiskResult.tsx`.

## Batch 4 — close-out

- [x] **T13** Update the tour copy and `refdocs/guides/checklist.md` if it names the sidebar; add the changelog entry and STATUS line; run the full frontend checks and the Playwright journey; commit (never push).
