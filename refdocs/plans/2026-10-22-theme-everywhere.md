# Plan — Dark mode on the public pages, a new theme switch, and the contrast fixes from the audit

> Execution: `refdocs/execution/2026-10-22-theme-everywhere.md`. Scope source: the author's requests: "the login and welcome page does not have dark mode. also include the button to change mode"; "the button i want to change into the image i attached" (a two-sided Dark | Light switch with a black sliding pill); and a pasted contrast-audit brief for the colour tokens. Amends D-58, which left the public pages light.

## 1. Why this exists
D-58 kept the welcome and login pages light on purpose. In practice a person who picks dark meets a light front door, and the author wants the choice to carry everywhere and to be reachable from the first screen. A contrast audit also found the red danger line on the chart band is only about 2:1 (WCAG 1.4.11 asks 3:1), the dark divider is very faint, and selected rows that rely on a tint alone.

## 2. What's already covered
- The theme mechanism (`data-theme` on `<html>`, set before first paint under the CSP nonce, `lib/theme.ts`, `ThemeToggle`) works on every page already; only the public pages' own tokens ignore it.
- The public pages are wrapped in `.login-theme` and style themselves from `--lg-*` tokens in `login.css`; their teal is used three ways (a panel fill with cream text, a button fill, and text/links/strokes), which is why it cannot simply be swapped.

## 3. Scope
**In**
1. **Contrast fixes (from the audit):** dark `--color-chart-red` `#f06a69` -> `#f89c9b`; dark `--color-line` `#2b4642` -> `#35544f`; light `--color-chart-red` `#e24b4a` -> `#b92a2a`. Tests: chart-red against the chart band and against the card is at least 3:1 in both themes; the dark divider is held at 1.8:1 on a card. No other token changes. The Safe / Caution / At Risk **face tokens are left as they are** (same in both modes).
2. **Selected states that rely on a tint alone** get a second cue (a 3px accent bar on the left, or bold text, or a check). Components found using `accent-bg` for selection are listed in the execution doc.
3. **Dark mode for the welcome and login pages:** `--lg-*` dark values; three new roles so the teal can be a fill, a text colour and a label-on-fill separately (`--lg-teal`, `--lg-teal-text`, `--lg-on-teal`); tokens for the three hard-coded colours (input, placeholder, disabled button); result chips and faces use the face tokens (pastel in both modes). The `.login-theme` block that forced light (D-58 (6)) is removed.
4. **A new theme switch**, replacing the round moon button: one pill with **DARK** and **LIGHT** sides and a black sliding thumb on the current mode (moon and sun icons; icons only on a phone). Still one button named "Dark mode" with `aria-pressed`. Placed in the app's top bar (as now), in the welcome page's top bar beside Sign in, and fixed top-right on the login page.

**Out**
- A third "follow my device" option, per-account theme on the server, theming the 404 page, the glassy 3D look of the second reference image beyond a soft highlight on the thumb (the first image's layout is followed).

## 4. Design
- Dark public pages use the same dark values as the app wherever a role matches (page, card, ink, field), plus `--lg-teal` as a deep teal fill (`#17606f`) with a cream label (`--lg-on-teal` `#f1eecf`, 6.1:1), and `--lg-teal-text` as the light accent (`#6cc4d3`) for links, strokes and borders on the dark page.
- Light values of the new tokens equal the old ones (`--lg-teal-text` = `--lg-teal` = `#105666`; `--lg-on-teal` = `--lg-page` = `#f7f4d5`), so the light public pages do not change; a test pins that.
- The switch takes its colours from the app tokens, which follow the theme on every page, so it needs no per-page styling.

## 5. Risks
- **A teal left unseparated** makes a bright panel or an invisible link in dark. Mitigation: the three roles above, contrast tests for each pairing, and a screenshot review of both pages in both themes at 375 and 1440 px.
- **A light page changing by accident.** Mitigation: the pinned equality of the new light values.
- **The switch's name.** It stays "Dark mode" (`aria-label`, visible labels hidden from assistive technology) so existing tests and screen-reader behaviour hold.
