# Plan — A public welcome page

> Execution: `refdocs/execution/2026-10-22-welcome-page.md`. Scope source: the author's review of PaySense v3 (which has a public `/welcome` page) and her observation that v2 has none, then "proceed".

## 1. Why this exists

A person who opens the app today lands on a username box. A UAT tester, a supervisor or an examiner sees no explanation of what PaySense is before signing in. v3's welcome page does that well, and it already uses v2's own look (the login page's pond theme), so it costs little. It supports the supervisor's "professionally presented" and "tangible product" criteria.

## 2. What's already covered

- The login page's theme and every token the page needs (`--lg-*`), the band faces (`BandFace`), `BrandMark` and `ArrowIcon` in `components/auth/LoginArt.tsx`.
- The three-slide intro (D-53) covers "see where your money is heading", "check before you split" and "you stay in control" for someone already signed in; it is not a substitute for a page before sign-in.

## 3. Scope

**In**
1. `/welcome`, a public page (outside the signed-in layout): top bar with a Sign in button; a hero ("Think before you split", one sentence, **Get started** and **See how it works**) with an animated forecast-and-faces picture; "Small instalments add up"; **How it works** (three steps, then "Every check ends in one of three answers" (Safe, Caution, At Risk) and one line on the built-in providers, all inside the same section: revised 2026-11-05, the page had too many sections); **You stay in control**; a closing "Ready when you are" with a Sign in button.
2. **Routing:** a signed-out visitor who opens `/` is sent to `/welcome`; any other signed-in page still sends a signed-out visitor to `/login`, and logging out still ends on `/login`. Every button on the page leads to `/login`.
3. Motion: the hero entrance plays once; the sections below reveal on scroll where the browser supports scroll-driven animation and are simply shown elsewhere; reduced motion shows everything finished.

**Out**
- Create-account buttons and email wording (v3's), the "New to BNPL in Malaysia?" box (written for readers outside Malaysia), and the assistant line in "You stay in control" (v2 has no assistant). There is no sign-up (D-54).
- Any new component library, tracking or third-party script.

## 4. Design

- **Page.** `app/welcome/page.tsx` (a server component, no client JS beyond what Next adds), `app/welcome/layout.tsx` (wraps in `.login-theme` and loads `login.css`, as the login page does), `app/welcome/welcome.css`.
- **Copy** states only what v2 does: import a statement file or add spending by hand and check every line before it is saved; the forecast; the three answers; SPayLater, TikTok PayLater and Atome built in and any other provider entered by hand; download or clear your data from Settings; estimates from your own records, not financial advice.
- **Routing** in `AuthGate`: on an anonymous session, `/` goes to `/welcome` and anything else to `/login`.
- **Security.** Static content; the nonce CSP is unchanged (the page uses inline `style` attributes for animation delays, which `style-src 'unsafe-inline'` already allows, as the login page does).

## 5. Risks

- **Changing where `/` sends a visitor** breaks the tests that expect `/login`. Mitigation: update them deliberately (unit and Playwright) and add one that proves other pages still go to `/login`.
- **Copy that over-promises.** Mitigation: each sentence is checked against what v2 does (above), and a test pins the sign-in-only buttons so nothing points at a sign-up that does not exist.
- **Contrast and motion.** Mitigation: an axe test on the page; reduced motion verified in the stylesheet by a test; checked at 375, 768 and 1440 px.
