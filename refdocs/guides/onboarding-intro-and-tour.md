# Guide — a first-run intro and spotlight tour, for another project

> What PaySense v2 calls "the intro and the tour" (ADR D-53; code in `frontend/components/onboarding/`, `frontend/lib/introTour.ts`). This guide is written so it can be copied into another React or Next.js project and followed without this repository. It describes what was built and the faults found while building it, so the next project does not repeat them.

## 1. What it is called

There is no single standard name. The pieces are:

| Piece | Common names | In this project |
|---|---|---|
| The full-screen slides shown once, on first sign-in | **welcome carousel**, welcome modal, onboarding slides, "what's new" splash | `Intro.tsx` ("Welcome to PaySense", 3 slides) |
| The dimmed page with one real control lit at a time and a speech bubble | **spotlight product tour**, guided tour, feature tour, coach marks, walkthrough | `Tour.tsx` ("Tour of PaySense", one stop per control) |
| The whole sequence, remembered per person | **first-run onboarding flow** | `OnboardingGate.tsx` + `lib/introTour.ts` |

Search terms that find libraries for the same thing: "product tour", "onboarding tour", "coach marks", "react-joyride", "driver.js", "intro.js", "shepherd.js". We wrote it by hand (no dependency) because it is about 600 lines, needs to follow the app's own design tokens, and the Content-Security-Policy forbids `eval` and scripts without the request's nonce. If your project has none of those constraints, a library is a reasonable shortcut for the Tour half.

## 2. How the pieces fit

```
OnboardingGate  (mounted once, inside the signed-in layout)
 ├─ reads the stage for this person: "intro" | "tour" | "done"      <- lib/introTour.ts (localStorage)
 ├─ stage "intro": <Intro onTour onSkip />  -> onTour marks intro seen; onSkip marks both seen
 ├─ stage "tour":  <Tour onDone />          -> onDone marks the tour seen
 └─ the page behind is rendered with `inert` while either shows
```

Rules that shaped it:
- **Per person, per browser.** Keys are `paysense.intro.seen.<userId>` and `paysense.tour.seen.<userId>` so testers sharing a device each get their own.
- **Nothing is drawn before hydration.** The server snapshot is "done", so a person who has seen it never gets a flash of the slides.
- **Storage can fail** (private window, blocked cookies). Every read and write is in try/catch, and what was marked is also kept in memory so the slides never show twice in one visit.
- **Replay is a first-class action.** `replayIntro(userId)` clears both flags; the gate, subscribed to the store, shows the slides again. In PaySense it is a link in the profile card ("Show the intro again") and a button on the admin page.

## 3. Step by step

### 3.1 The store (`lib/introTour.ts`)

Use `useSyncExternalStore` so the gate, the tour and any "replay" control stay in step.

```ts
export type Stage = "intro" | "tour" | "done";
const INTRO_KEY = "app.intro.seen";
const TOUR_KEY = "app.tour.seen";
const subscribers = new Set<() => void>();
const memory = new Set<string>();                       // survives blocked storage, for this visit
const keyFor = (base: string, userId: string) => `${base}.${userId}`;

function seen(base: string, userId: string): boolean {
  const key = keyFor(base, userId);
  if (memory.has(key)) return true;
  try { return window.localStorage.getItem(key) === "1"; } catch { return false; }
}
function mark(base: string, userId: string) {
  const key = keyFor(base, userId);
  memory.add(key);
  try { window.localStorage.setItem(key, "1"); } catch { /* the memory mark covers this visit */ }
  subscribers.forEach((notify) => notify());
}
export function stageFor(userId: string): Stage {
  if (!seen(INTRO_KEY, userId)) return "intro";
  return seen(TOUR_KEY, userId) ? "done" : "tour";
}
export const markIntroSeen = (id: string) => mark(INTRO_KEY, id);
export const markTourSeen = (id: string) => mark(TOUR_KEY, id);
export function replayIntro(userId: string) {            // clear both flags, then tell everyone
  for (const base of [INTRO_KEY, TOUR_KEY]) {
    memory.delete(keyFor(base, userId));
    try { window.localStorage.removeItem(keyFor(base, userId)); } catch { /* nothing stored */ }
  }
  subscribers.forEach((notify) => notify());
}
export function subscribeToIntro(notify: () => void) {
  subscribers.add(notify);
  window.addEventListener("storage", notify);            // another tab replaying
  return () => { subscribers.delete(notify); window.removeEventListener("storage", notify); };
}
export const forgetForTests = () => memory.clear();      // a reload drops the memory copy
```

### 3.2 The gate (`OnboardingGate.tsx`)

```tsx
export function OnboardingGate({ userId, children }: { userId: string; children?: ReactNode }) {
  const stage = useSyncExternalStore(subscribeToIntro, () => stageFor(userId), () => "done" as const);
  const active = stage !== "done";
  const wasActive = useRef(active);
  useEffect(() => {                                       // give focus back to the page when it ends
    if (wasActive.current && !active) document.getElementById("main")?.focus();
    wasActive.current = active;
  }, [active]);
  return (
    <>
      {children !== undefined && <div inert={active}>{children}</div>}   {/* nothing behind is focusable */}
      {stage === "intro" && <Intro onTour={() => markIntroSeen(userId)} onSkip={() => { markIntroSeen(userId); markTourSeen(userId); }} />}
      {stage === "tour" && <Tour onDone={() => markTourSeen(userId)} />}
    </>
  );
}
```

Mount it once in the signed-in layout, around the page. The Tour must mount **after** the page it points at (it is a child sibling of the page, so it is).

### 3.3 The intro (`Intro.tsx`)

- Data first: `const SLIDES = [{ title, text, picture: <JSX/> }, ...]`. Three slides is enough: what it does, how to read an answer, what the person controls.
- Layout: a two-column card (`sm:grid-cols-[0.9fr_1.1fr]`). Left: a brand-coloured panel with the logo and the picture on a white card. Right: progress segments + Skip, "Step n of N", title, words, Back / Next. The last slide offers "Skip the tour" and "Take a quick tour".
- Accessibility: `role="dialog" aria-modal="true" aria-label="Welcome to <App>"`, `tabIndex={-1}` on the dialog and focus it on open and on every slide (`useEffect(() => panel.current?.focus(), [index])`), Escape skips, Tab and Shift+Tab loop inside (query `button:not([disabled]), [href]`, wrap at the ends).
- Direction: keep `dir` in state (`"next" | "back"`), set it in a `go(to)` helper, and give the slide containers `key={index}` and `className={`ob-in-${dir}`}` so a new slide slides in from the side you are moving towards. The `key` is what restarts the animation.

### 3.4 The motion (`globals.css`)

```css
@keyframes intro-draw { to { stroke-dashoffset: 0; } }
@keyframes intro-rise { from { opacity: 0; transform: translateY(8px); } }
@keyframes intro-pop  { from { opacity: 0; transform: scale(.6); } 70% { transform: scale(1.08); } }
.intro-draw { stroke-dasharray: 1; stroke-dashoffset: 1; animation: intro-draw 1.1s ease-out both; }
.intro-rise { animation: intro-rise .45s ease-out both; }
.intro-pop  { display: inline-block; animation: intro-pop .4s ease-out both; }
@keyframes ob-in-next { from { opacity: 0; transform: translateX(24px); } }
@keyframes ob-in-back { from { opacity: 0; transform: translateX(-24px); } }
@keyframes ob-float   { 50% { transform: translateY(-6px); } }
.ob-in-next { animation: ob-in-next .45s cubic-bezier(.2,.8,.2,1) both; }
.ob-in-back { animation: ob-in-back .45s cubic-bezier(.2,.8,.2,1) both; }
.ob-float   { animation: ob-float 5s ease-in-out .6s infinite; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-delay: 0s !important;            /* see 5.1 */
    animation-iteration-count: 1 !important;   /* see 5.1 */
    transition-duration: .01ms !important;
  }
}
```

The drawing trick: give the SVG path `pathLength={1}` so `stroke-dasharray: 1` means "the whole line" whatever its real length; the animation moves the dash offset from 1 to 0. Stagger the other parts with an inline `style={{ animationDelay: "1s" }}` (the range rises at 1 s, the marker pops at 0.9 s). Colour every part from design tokens, never hex, so dark mode follows.

### 3.5 The tour (`Tour.tsx`)

1. **Mark the real controls.** Put `data-tour="forecast"` (and so on) on the elements to point at. Mark the sidebar item *and* the phone's bottom-bar item with the same name; the tour picks whichever is actually on screen:
   ```ts
   function find(target: string) {
     for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${target}"]`)) {
       const box = el.getBoundingClientRect();
       if (box.width > 0 && box.height > 0) return el;        // the visible one
     }
     return null;
   }
   ```
2. **List the stops** as `{ target, title, text }`. Build the list once on mount with `STOPS.filter((s) => find(s.target))`, so a stop whose control is not on this screen is left out; if none remain, call `onDone()` at once.
3. **Track the target's box** with `useSyncExternalStore`: subscribe to `resize`, `scroll` (capture phase) and a `ResizeObserver` on `document.body`, read `getBoundingClientRect()`, and **return the same object until the numbers change** (cache the last box) or React loops. Scroll the target into view when the stop changes.
4. **Draw the spotlight** as one absolutely positioned box over the target (padded 6 px) whose box-shadow does the dimming, the ring and the glow in one declaration:
   ```tsx
   className="pointer-events-none absolute rounded-2xl transition-all duration-200 motion-reduce:transition-none
     shadow-[0_0_0_3px_var(--color-rosy),0_0_22px_6px_rgba(211,150,140,0.55),0_0_0_9999px_rgba(4,24,30,0.7)]"
   style={{ top: box.top - 6, left: box.left - 6, width: box.width + 12, height: box.height + 12 }}
   ```
   Because the huge spread shadow dims everything outside the box, the lit control keeps its own colours and nothing is clipped or cloned.
5. **Place the bubble**: to the right of a narrow target near the left edge (a sidebar item), else below it, else above; clamp to 16 px from the window's edge; draw a small rotated square as the arrow, clamped inside the bubble.
6. **Bubble content**: "n of N", title, one sentence, "Skip tour", Back, Next / Done. `role="dialog" aria-modal="true" aria-describedby`, focus the Next button on each stop, Escape ends the tour, Tab loops inside the bubble.

### 3.6 Writing the words

- Slide 1: what it does, in one sentence, without hedging language that would worry a first-time user.
- Slide 2: name the thing the person will actually do ("Check a buy-now-pay-later plan before you commit") and what they get back.
- Slide 3: what they control ("Nothing is saved until you add it"). Keep legal disclaimers on a page built for them, not on the welcome slides.
- Tour stops: one sentence each, from the person's side ("Everything you've spent"), not the feature's.

## 4. Tests worth writing first

Vitest and Testing Library (jsdom has no layout, so give marked targets a box by mocking `getBoundingClientRect` for `[data-tour]`; set `ResponsiveContainer`-style sizes the same way in chart tests).

- Intro: opens as a dialog on slide 1 with focus inside; Next/Back move one slide; the last slide offers the tour or a way out; Escape skips; Tab loops; no axe violations.
- Intro copy: the exact sentences you decided on (cheap, and stops a later edit undoing them).
- Intro motion: the picture has the animated classes; `globals.css` contains the keyframes and the reduced-motion block (read the file in the test and match with a regex).
- Slide direction: after Next the slide containers carry `ob-in-next`; after Back, `ob-in-back`.
- Layout: the progress bar, title, words and buttons carry the classes that pin them (see 5.3).
- Tour: a stop whose control is absent is skipped; Next/Back/Done/Skip; Escape; spotlight present; the spotlight class does not use the page colour (see 5.2).
- Store: mark, replay, per person, survives a remount, in-memory fallback when `setItem` throws.
- Gate: the page behind is `inert` while either shows; focus returns to `#main` after.
- End to end (Playwright): a first sign-in plays the slides and the tour, neither returns on reload, and replay brings them back. Run it at desktop and phone widths.

## 5. Faults we hit, so you do not

1. **Reduced motion left pictures blank or flickering.** The common rule `animation-duration: .01ms !important` leaves `animation-delay` alone, so an element with a 1 s delay and `animation-fill-mode: both` stays invisible for a second for exactly the people who asked for less motion. Add `animation-delay: 0s !important`. An endless animation (the float) at .01 ms would flicker, so also add `animation-iteration-count: 1 !important`.
2. **A spotlight ring in the "page" colour disappears in dark mode.** Page background is cream in light mode (the ring shows against the dim) and near black in dark mode (it does not). Use an accent that works on both and add a glow; make the dim darker.
3. **Slides jump between heights.** If the text column is centred on its content, a slide with a one-line title moves everything up. Pin it: progress bar at the top, buttons at the foot (`flex-1` on the text block), and reserve space for the longest case: title `min-h` for two lines beside the picture and three on a phone (`min-h-[3.75em] sm:min-h-[2.5em]`), words `min-h` for three lines. **Measure** it (see 6) rather than eyeballing: on the phone a three-line title had pushed slide 2 down 32 px.
4. **A picture that never looks animated** is usually one of: the keyframes are not in the loaded stylesheet (restart the dev server and hard refresh), the system has animations switched off (Windows "Show animations in Windows"), or the element is not remounted (no `key`). Check in the console: `getComputedStyle(document.querySelector('[data-intro-card] path')).animationName` prints `intro-draw` when the rules are loaded.
5. **A taller card needs a different shape, not just a different ratio.** The card's width is capped by its panel, so changing 4:3 to 5:4 barely moves it; make it square beside the text and keep 5:4 when stacked.
6. **Do not show the username or any credential in the profile that launches replay** if sign-in is by username alone: it ends up in screenshots.
7. **Intro replay for everyone has a cost**: a tester who replays it mid-session adds noise to observations. We accepted it (ADR D-61, amending D-56); decide deliberately.

## 6. Checking it in a real browser

Write a throwaway Playwright spec, run it, read the screenshots, then delete it (do not commit it):
- Sample a computed style over time to prove an animation runs, for example `getComputedStyle(path).strokeDashoffset` every 150 ms (it should fall from about 1 to 0 in about a second).
- Measure alignment: for each slide record `element.getBoundingClientRect().top - dialog.getBoundingClientRect().top` for the step label, title, words and buttons; the numbers must match on every slide, at desktop and at phone width.
- Screenshot every slide and a tour stop in light and dark mode.

## 7. Adapting it to a new project

- [ ] Decide the slides (three) and write the words (3.6) before any code.
- [ ] Add the store, the gate (mounted once in the signed-in layout) and the replay control.
- [ ] Add `data-tour` to the real controls, on every layout that shows them (sidebar and phone bar).
- [ ] Build the Intro, then the Tour; take colours from your tokens; add the keyframes and the reduced-motion block *together*.
- [ ] Write the tests in section 4 first; run the browser checks in section 6.
- [ ] Record the decision (what is shown, to whom, who may replay it) in your decision log.

## 8. A prompt to give Claude Code in the other project

> Add a first-run onboarding flow to this app, following `onboarding-intro-and-tour.md` (copy the file into the repo first). It is a three-slide welcome carousel followed by a spotlight tour of the real controls, remembered per signed-in user in localStorage with an in-memory fallback, mounted once in the signed-in layout, replayable from a "Show the intro again" link. Use our design tokens and our existing Button, dark mode and test setup. Write the tests in section 4 first, include the reduced-motion rules from 3.4 and 5.1, and check slide alignment and the animation in a real browser as in section 6. The slide copy is: <paste your three slides and your tour stops>. Plan first, and do not push.
