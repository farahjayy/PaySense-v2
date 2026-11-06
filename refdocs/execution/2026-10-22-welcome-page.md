# Execution — A public welcome page

> Plan: `refdocs/plans/2026-10-22-welcome-page.md`. **Status: built and verified (see CHANGELOG 2026-10-22).** Tasks run top to bottom; each has a **Verify**. Failing test first for every task. Edit this doc if reality diverges (CLAUDE.md rule 4).

## Before starting
- Read ADR D-54 (login stays username-only, no sign-up) and D-55 (this page). The v3 page is the visual reference, in a scratch clone of `github.com/farahjayy/PaySense-v3`; port by reading and re-testing.

## Phase A — routing
### A1. A signed-out visitor to `/` lands on `/welcome`
- **Files:** `frontend/components/auth/AuthGate.tsx`, `frontend/tests/unit/AppShell.test.tsx` (its AuthGate tests), `frontend/tests/e2e/*.spec.ts`.
- **Steps:** use `usePathname`; anonymous at `/` replaces with `/welcome`, anywhere else with `/login`.
- **Verify:** unit: `/` goes to `/welcome`, `/plans` goes to `/login`, a signed-in visitor is not redirected, the session-revoked case still ends on `/login` from a deep page. Playwright: opening `/` shows the welcome page; opening `/plans` shows the login; log out still lands on `/login`.

## Phase B — the page
### B1. Content and structure
- **Files:** `frontend/app/welcome/{layout,page}.tsx`, `welcome.css`, `frontend/tests/unit/WelcomePage.test.tsx`.
- **Verify:** one `h1`; the section headings in order (small instalments, how it works, control, ready; the three answers and the providers line sit inside how it works, 2026-11-05); exactly three steps and three answers; every button and link goes to `/login` or an in-page anchor; no text mentions an account, email or sign-up; "See how it works" targets the `#how` section; axe finds no violations.

### B2. Look and motion
- **Verify:** the stylesheet gives reduced-motion users finished content (a test reads the CSS); screenshots at 375, 768 and 1440 px reviewed by the author; the production build serves it with no CSP violation (Playwright watches the console).

## Phase C — browser journeys
- **Verify:** Playwright on desktop and phone: `/` shows the welcome page; **Get started** opens the login; a deep link still opens the login; signing in from the welcome page reaches the dashboard.

## Wrap-up
- [ ] ADR D-55; PRD §7 one-liner; CHANGELOG; STATUS; the plans index
- [ ] `cd frontend && npx tsc --noEmit && npx eslint . && npx vitest run && npm run build && npx playwright test` named with results
- [ ] react and security review of the routing change
