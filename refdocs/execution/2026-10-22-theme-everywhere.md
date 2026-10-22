# Execution — Dark mode on the public pages, a new theme switch, and the contrast fixes

> Plan: `refdocs/plans/2026-10-22-theme-everywhere.md`. Tasks run top to bottom; each has a **Verify**. Failing test first for every task. Edit this doc if reality diverges (CLAUDE.md rule 4).

## Phase A — the audit's contrast fixes
### A1. Tokens and tests
- **Files:** `frontend/app/globals.css`, `frontend/tests/unit/theme.test.ts`, `frontend/tests/unit/themeDark.test.ts`.
- **Verify:** chart-red on chart-blue and on surface is at least 3:1 in light and in dark; the dark line on surface is at least 1.8:1; the three changed hex values are exactly as listed in the plan; no other token value changed; the face tokens are still equal in both modes.

### A2. Selected states
- **Files:** found by searching the components for `accent-bg`; changed ones listed under "Done" below.
- **Verify:** each selected state has a cue besides the tint, asserted in its unit test.

## Phase B — the public pages in dark
### B1. Tokens and CSS
- **Files:** `frontend/app/login/login.css`, `frontend/app/welcome/welcome.css`, `frontend/app/globals.css` (the light-forcing block removed), `frontend/tests/unit/themePublic.test.ts` (new), `frontend/tests/unit/themeDark.test.ts` (the three tests for the removed block go).
- **Verify:** every `--lg-*` colour has a dark value; each text, fill and border pairing reaches its target in dark (ink on page and card 7:1, secondary text 4.5:1, teal text 4.5:1, cream on teal fill 4.5:1, field borders 3:1, placeholder on input 4.5:1); the light values of the new tokens equal the old ones; no component or stylesheet uses a hard-coded white, grey or disabled colour on the public pages.

## Phase C — the switch
### C1. The component
- **Files:** `frontend/components/layout/ThemeToggle.tsx`, `frontend/tests/unit/ThemeToggle.test.tsx`.
- **Verify:** one button named "Dark mode" with `aria-pressed`; both labels (DARK, LIGHT) and both icons are drawn and hidden from assistive technology; the thumb sits on the current mode; clicking flips the page and the choice; axe is clean in both states.

### C2. Where it appears
- **Files:** `frontend/app/welcome/page.tsx`, `frontend/app/login/page.tsx`, their tests.
- **Verify:** the welcome page and the login page each have the switch; the welcome page's links are still only the login, itself and the in-page anchor.

## Phase D — looked at, and run
- **Verify:** both public pages and the signed-in app, in both themes, on desktop and a phone width, viewed in a browser; `tsc`, `eslint`, `vitest`, `playwright` (a new journey toggles the theme on the welcome page and the login page and the choice survives signing in).

## Wrap-up
- [x] ADR D-59 (amends D-58); PRD §7 line; CHANGELOG; STATUS; plans index

## Done
- **A2, components given a second selected cue (found by searching `accent-bg`):** `components/transactions/TypeButtons.tsx` (bottom bar), `components/transactions/CategorySpending.tsx` (left bar), `components/layout/AppShell.tsx` current page (left bar). Not changed: `DropZone` (a drag state, not a selection), `Banner` and `BnplBox` (static fills), `PlansScreen` status pill (text says the status), the old `ThemeToggle` (replaced).
- **Deviations:** the teal fill in dark is `#135664` (not `#17606f`) so the rosy words on the panel keep 3:1; the light placeholder moved to 4.9:1; the top bar hides the display name below 640 px; the switch is at the top right of the login page, not fixed.
