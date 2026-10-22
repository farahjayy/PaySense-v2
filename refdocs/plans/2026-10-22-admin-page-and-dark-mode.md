# Plan — An Admin page in the sidebar, and a dark mode

> Execution: `refdocs/execution/2026-10-22-admin-page-and-dark-mode.md`. Scope source: the author's request: "a admin page and user page. the only difference is that, for admin page, on the sidebar there will be an additional page [...] in that page, i want to add a button to launch the 'quick tour' simulation", and "light/night mode. current is light mode [...] you have to create a dark mode".

## Part A — The Admin page

### A1. Why
The admin role (D-56) currently shows its one tool inside Settings. The author wants a home for author-only tools, reachable like any other page, with the quick tour as its first tool.

### A2. Scope
**In**
1. An **Admin** item in the sidebar (and in the phone's "More pages" row), shown **only to an admin**. A normal user's sidebar is unchanged.
2. `/admin`: a page titled **Admin**, with one card, **Quick tour**, and a button **Launch the quick tour** that plays the welcome slides and the tour from the start, then lands on the dashboard. This replaces the Admin card in Settings (the button moves; Settings keeps no admin content).
3. A normal user who opens `/admin` sees a plain "This page is for admins" message with a link back, and none of the tools.

**Out**
- Any admin tool other than the quick tour (the author will add more later), a server route for the page (it shows no data), changing who is admin.

### A3. Design
- The sidebar item is decided from the session's role, as the Settings card was. That is display only: the page holds no data and the replay clears two browser flags. Anything that does hold data must use `require_admin` on the server (D-56).

## Part B — Dark mode

### B1. Why
A second look for low-light use and for people who prefer it, on every signed-in screen, with the same care for contrast that the light theme has (D-48).

### B2. Scope
**In**
1. A **dark palette** for the signed-in app, defined as overrides of the same design tokens, so every screen follows without being rewritten. Safe, Caution and At Risk keep their meaning (colour, face, icon and word); each pairing is held to WCAG AA by the existing contrast test, extended to the dark palette.
2. A **toggle in the top bar** (a moon/sun button, "Dark mode", pressed when on). The first visit follows the device's setting; the choice is then kept in this browser. No flash of the wrong theme on load.
3. Buttons and the few fixed colours (white text on teal, the chart band, form controls' own widgets such as the date picker) are made to work in both modes.

**Out**
- The **welcome and login pages** keep their own brand look in both modes (they are the public front door, with their own tokens); a follow-up if wanted.
- A third "follow the device always" setting, per-account theme stored on the server, scheduled switching, and a high-contrast mode.

### B3. Design
- **Mechanism.** `data-theme="dark"` on `<html>`; the tokens in `globals.css` are redefined under `[data-theme="dark"]` and `color-scheme: dark` is set so native controls follow. A tiny inline script in `<head>` (carrying the page's CSP nonce) sets the attribute before first paint from the stored choice or `prefers-color-scheme`; the same logic lives in `lib/theme.ts` (tested), and the script is generated from it so they cannot drift.
- **Buttons.** A new `--color-on-accent` token (white in light, near-black in dark) replaces fixed white text on accent, danger and ink buttons, because the dark accent is light.
- **Verification.** The contrast test reads the dark block from `globals.css` and checks every pairing the light test checks; every screen is looked at in dark on desktop and phone.

## Risks
- **A fixed light colour left behind** (a white card, dark text on dark). Mitigation: grep for fixed colours (done: six files), a test that no component sets a fixed text colour on a themed background, and a screenshot review of every screen in dark.
- **Flash of light on load.** Mitigation: the inline script, tested to set the attribute from storage and from the device setting; Playwright checks the attribute is set before hydration.
- **The CSP.** The inline script needs the request's nonce; Playwright watches the console for violations.
- **Contrast.** A pleasing dark palette can still fail AA; the test is written first and the palette is tuned to it.
