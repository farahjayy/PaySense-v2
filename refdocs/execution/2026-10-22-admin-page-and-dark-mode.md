# Execution — An Admin page in the sidebar, and a dark mode

> Plan: `refdocs/plans/2026-10-22-admin-page-and-dark-mode.md`. **Status: built and verified (see CHANGELOG 2026-10-22).** Tasks run top to bottom; each has a **Verify**. Failing test first for every task. Edit this doc if reality diverges (CLAUDE.md rule 4).

## Part A — the Admin page
### A1. The sidebar item and the page
- **Files:** `frontend/components/layout/AppShell.tsx`, `frontend/app/(app)/admin/page.tsx`, `frontend/components/screens/AdminScreen.tsx`, `frontend/lib/nav.ts` (if needed), tests: `AppShell.test.tsx`, new `AdminScreen.test.tsx`.
- **Verify:** an admin's sidebar and phone "More pages" row have an Admin link to `/admin`, marked current on that page; a normal user's navigation has none; the page shows the **Quick tour** card with **Launch the quick tour**, which plays the intro from the first slide and goes to the dashboard; a normal user opening the page sees the "for admins" message and no button; axe finds no violations.

### A2. Settings loses the Admin card
- **Files:** `SettingsScreen.tsx`, `SettingsScreen.test.tsx`.
- **Verify:** Settings shows no Admin card and no replay button to anyone.

### A3. Browser journeys
- **Verify:** Playwright: the admin tester sees Admin in the sidebar, opens it and launches the tour, which plays; an ordinary tester has no Admin link and `/admin` shows the message.

## Part B — dark mode
### B1. The palette, held to contrast
- **Files:** `frontend/app/globals.css`, `frontend/tests/unit/theme.test.ts`.
- **Steps:** write the dark pairings into the contrast test first (every light pairing, plus on-accent text on accent and danger); then define the palette under `[data-theme="dark"]` and tune until it passes.
- **Verify:** every text pairing reaches 4.5:1 (7:1 for body text) and every border or chart line that must be seen reaches 3:1, in dark as in light.

### B2. The theme logic
- **Files:** new `frontend/lib/theme.ts`, `frontend/tests/unit/theme.logic.test.ts`.
- **Verify:** a stored choice wins over the device setting; no stored choice follows the device; a bad stored value is ignored; blocked storage does not throw; the init script, executed in jsdom, sets `data-theme` from storage and from `prefers-color-scheme`.

### B3. The toggle and the no-flash script
- **Files:** `frontend/app/layout.tsx` (nonce, script, `suppressHydrationWarning`), `frontend/components/layout/ThemeToggle.tsx`, `AppShell.tsx`, tests.
- **Verify:** a button named "Dark mode" with `aria-pressed`, in the top bar on desktop and phone; clicking it flips `data-theme`, stores the choice, and flips back; the choice survives a reload; the first paint already has the right attribute.

### B4. Buttons and fixed colours
- **Files:** `Button.tsx`, `States.tsx`, `ImportScreen.tsx`, `RiskScreen.tsx`, `globals.css` (`--color-on-accent`).
- **Verify:** no component uses `text-white` on a themed background (a test greps); buttons are readable in both modes.

### B5. Every screen, looked at
- **Verify:** Playwright screenshots of every signed-in screen in dark on desktop and a phone, reviewed by the author; no CSP violation; the welcome and login pages still look as before.

## Wrap-up
- [ ] ADR D-57 (Admin page, amends D-56 and D-53) and D-58 (dark mode, extends D-48); PRD §7 lines; CHANGELOG; STATUS; the plans index
- [ ] `cd frontend && npx tsc --noEmit && npx eslint . && npx vitest run && npm run build && npx playwright test`, named with results
- [ ] react and accessibility review of the new components
