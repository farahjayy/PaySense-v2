import path from "node:path";

import { expect, test, type Page } from "@playwright/test";

const PERSONA_CSV = path.resolve(__dirname, "../../../data/personas/budget_conscious.csv");

/** Fail the journey if the browser reports a Content-Security-Policy violation. */
function watchForCspViolations(page: Page): string[] {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/content security policy|refused to (load|execute|connect)/i.test(message.text())) {
      violations.push(message.text());
    }
  });
  return violations;
}

/** Each browser project signs in as its own seeded tester, so parallel runs keep separate ledgers.
 * A first sign-in plays the welcome slides (ADR D-53); most journeys skip them, one walks through. */
async function signIn(page: Page, journey: string, { skipIntro = true } = {}) {
  await page.goto("/");
  // the front door is the welcome page (ADR D-55); signing in starts from it
  await expect(page).toHaveURL(/\/welcome$/);
  await page.getByRole("link", { name: "Sign in" }).first().click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Username").fill(`e2e-${test.info().project.name}-${journey}`);
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("dialog", { name: /welcome to paysense/i })).toBeVisible();
  if (skipIntro) {
    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await expect(page.getByRole("heading", { level: 1, name: /hi, e2e tester/i })).toBeVisible();
}

/** Import has no sidebar entry: it is a button on Transactions. */
async function openImport(page: Page) {
  await page.getByRole("link", { name: "Transactions" }).first().click();
  // wait for the page to change: the dashboard checklist has an Import link of its own
  await expect(page.getByRole("heading", { level: 1, name: "Transactions" })).toBeVisible();
  await page.getByRole("link", { name: "Import", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Import" })).toBeVisible();
}

test("a new tester signs in, imports a persona statement and sees a forecast", async ({ page }) => {
  const violations = watchForCspViolations(page);
  await signIn(page, "import");

  // Nothing imported yet: the forecast is locked and says why.
  await expect(page.getByText(/unlocks with four months/i)).toBeVisible();

  await openImport(page);
  await expect(page).toHaveURL(/\/import/);
  await page.getByLabel("Choose a statement file").setInputFiles(PERSONA_CSV);

  const add = page.getByRole("button", { name: /^add \d+ transactions?$/i });
  await expect(add).toBeEnabled();
  await add.click();
  await expect(page.getByText(/transactions added/i)).toBeVisible();

  await page.getByRole("link", { name: /see your dashboard/i }).click();
  await expect(page.getByRole("img", { name: /score \d+ out of 100/i })).toBeVisible();
  await expect(page.getByText("Show the numbers")).toBeVisible();

  expect(violations).toEqual([]);
});

test("every screen loads for a signed-in tester with its own title", async ({ page }) => {
  const violations = watchForCspViolations(page);
  await signIn(page, "screens");

  const screens: [string, RegExp][] = [
    ["/transactions", /transactions/i],
    ["/categories", /categories/i],
    ["/recurring", /recurring items/i],
    ["/plans", /bnpl plans/i],
    ["/import", /import/i],
    ["/model", /about the model/i],
  ];
  for (const [route, heading] of screens) {
    await page.goto(route);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page).toHaveTitle(/· PaySense$/);
  }
  expect(violations).toEqual([]);
});

test("a visitor without a session is sent to the login page", async ({ page }) => {
  await page.goto("/plans");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByLabel("Username")).toBeVisible();
});

test("a tester checks a purchase, tries the suggestion, adds the plan and reads the saved report", async ({
  page,
}) => {
  test.setTimeout(90_000); // two full checks run the forecast simulations several times
  const violations = watchForCspViolations(page);
  await signIn(page, "risk");

  // history first: the check refuses to give a number without it
  await openImport(page);
  await page.getByLabel("Choose a statement file").setInputFiles(PERSONA_CSV);
  await page.getByRole("button", { name: /^add \d+ transactions?$/i }).click();
  await expect(page.getByText(/transactions added/i)).toBeVisible();

  await page.goto("/risk");
  await page.getByLabel("What are you buying?").fill("Laptop");
  await page.getByLabel("Number of instalments").fill("2");
  await page.getByLabel(/^price/i).fill("300");
  await page.getByRole("button", { name: "Check this purchase" }).click();

  await expect(page.getByRole("img", { name: /score \d+ out of 100/i })).toBeVisible();
  // what the purchase adds is up front; the working is folded, each fold stating its figure
  await expect(page.getByRole("heading", { name: "What this purchase adds" })).toBeVisible();
  const monthByMonth = page.getByRole("button", { name: /month by month/i });
  await expect(monthByMonth).toHaveAttribute("aria-expanded", "false");
  await expect(monthByMonth).toContainText(/most owed: rm/i);
  await monthByMonth.click();
  await expect(page.getByRole("table", { name: "What you owe each month" })).toBeVisible();
  await page.getByRole("button", { name: /repayment history/i }).click();
  await expect(page.getByText(/shown beside the result, never part of it/i)).toBeVisible();
  await page.getByRole("button", { name: /margin with and without/i }).click();
  await expect(page.getByText("Show the numbers")).toBeVisible();

  // an unaffordable purchase comes with a change that works; trying it re-runs the check
  const trySuggestion = page.getByRole("button", { name: "Try this" });
  await expect(trySuggestion).toBeVisible();
  await trySuggestion.click();
  await expect(page.getByRole("img", { name: /score \d+ out of 100, safe/i })).toBeVisible();

  await page.getByRole("button", { name: "Add this as a plan" }).click();
  await expect(page.getByText("Plan added")).toBeVisible();

  await page.getByRole("link", { name: /saved report/i }).click();
  await expect(page).toHaveURL(/\/risk\/[0-9a-f-]{36}/);
  await expect(page.getByRole("heading", { level: 1, name: "Saved risk check" })).toBeVisible();
  await expect(page.getByRole("img", { name: /score \d+ out of 100, safe/i })).toBeVisible();
  await expect(page.getByRole("button", { name: "Try this" })).toHaveCount(0);

  await page.goto("/plans");
  await expect(page.getByRole("heading", { name: "Laptop" })).toBeVisible();
  expect(violations).toEqual([]);
});

test("a plan that has already started keeps a check of what is left, and the report says so", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const violations = watchForCspViolations(page);
  await signIn(page, "existing");

  await openImport(page);
  await page.getByLabel("Choose a statement file").setInputFiles(PERSONA_CSV);
  await page.getByRole("button", { name: /^add \d+ transactions?$/i }).click();
  await expect(page.getByText(/transactions added/i)).toBeVisible();

  // Bought months ago with three instalments: all three have already fallen due.
  await page.goto("/plans");
  await page.getByRole("button", { name: "Add a plan" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("What are you buying?").fill("Old tablet");
  await dialog.getByLabel("Purchase date").fill("2025-08-01");
  await dialog.getByLabel("Number of instalments").fill("3");
  await dialog.getByLabel(/^price/i).fill("300");

  const past = dialog.getByRole("group", { name: /already fell due/i });
  await expect(past).toBeVisible();
  await expect(past.getByRole("checkbox", { name: /paid$/i })).toHaveCount(3);
  // the last one was not paid, so it is the part still owed
  await past.getByRole("checkbox", { name: /instalment 3.*paid$/i }).uncheck();
  await dialog.getByRole("button", { name: "Save plan" }).click();

  await expect(page.getByRole("heading", { name: "Old tablet" })).toBeVisible();
  await expect(page.getByText(/2 of 3 paid/)).toBeVisible();
  await page.getByRole("button", { name: /analysis from/i }).click();
  await expect(page.getByText(/only what was still left to pay/i)).toBeVisible();

  await page.getByRole("link", { name: "Open the full report" }).click();
  await expect(page).toHaveURL(/\/risk\/[0-9a-f-]{36}/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Saved check of what was left to pay" }),
  ).toBeVisible();
  expect(violations).toEqual([]);
});

test("Settings: clear the transactions, then factory reset, after saving a copy", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const violations = watchForCspViolations(page);
  await signIn(page, "settings");
  await openImport(page);
  await page.getByLabel("Choose a statement file").setInputFiles(PERSONA_CSV);
  await page.getByRole("button", { name: /^add \d+ transactions?$/i }).click();
  await expect(page.getByText(/transactions added/i)).toBeVisible();

  // Settings is a link by the name, not a menu item
  await page.getByRole("link", { name: /settings/i }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();

  // a copy first: the CSV downloads
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download transactions (CSV)" }).first().click();
  expect((await download).suggestedFilename()).toMatch(/^paysense-transactions-.*\.csv$/);

  // clear only the transactions
  await page.getByRole("checkbox", { name: /transactions/i }).check();
  await page.getByRole("button", { name: /clear selected data/i }).click();
  const dialog = page.getByRole("dialog");
  const confirm = dialog.getByRole("button", { name: "Clear data" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(/type reset/i).fill("RESET");
  await confirm.click();
  await expect(page.getByText(/^Cleared \d+ transactions/)).toBeVisible();

  // the dashboard goes back to a new account's locked forecast
  await page.getByRole("link", { name: "Dashboard" }).first().click();
  await expect(page.getByText(/nothing to forecast|unlocks with four months/i)).toBeVisible();

  // a factory reset after that has nothing left to remove
  await page.getByRole("link", { name: /settings/i }).click();
  await page.getByRole("button", { name: /reset everything/i }).click();
  const factory = page.getByRole("dialog");
  await factory.getByLabel(/type reset/i).fill("RESET");
  await factory.getByRole("button", { name: "Reset everything" }).click();
  await expect(page.getByText("There was nothing to clear.")).toBeVisible();
  expect(violations).toEqual([]);
});

test("the transactions page shows where the month went, and picking a category filters the list", async ({
  page,
}) => {
  const violations = watchForCspViolations(page);
  await signIn(page, "spending");
  await openImport(page);
  await page.getByLabel("Choose a statement file").setInputFiles(PERSONA_CSV);
  await page.getByRole("button", { name: /^add \d+ transactions?$/i }).click();
  await expect(page.getByText(/transactions added/i)).toBeVisible();

  await page.goto("/transactions");
  await expect(page.getByRole("heading", { name: "Spending by category" })).toBeVisible();
  const panel = page.getByRole("complementary", { name: /spending this month/i });
  const first = panel.getByRole("button").first();
  await first.click();
  await expect(first).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Clear filters" }).first()).toBeVisible();

  expect(violations).toEqual([]);
});

test("a first sign-in plays the welcome slides and the tour, and Settings can play them again", async ({
  page,
}) => {
  const violations = watchForCspViolations(page);
  await signIn(page, "welcome", { skipIntro: false });

  const welcome = page.getByRole("dialog", { name: /welcome to paysense/i });
  await expect(welcome).toContainText("Step 1 of 3");
  await welcome.getByRole("button", { name: "Next" }).click();
  await welcome.getByRole("button", { name: "Next" }).click();
  await expect(welcome.getByRole("heading", { name: /you stay in control/i })).toBeVisible();
  await welcome.getByRole("button", { name: /take a quick tour/i }).click();

  // the tour lights real controls; step through it to the end
  const tour = page.getByRole("dialog", { name: "Tour of PaySense" });
  await expect(tour).toBeVisible();
  for (let stop = 0; stop < 8; stop++) {
    if ((await tour.count()) === 0) break;
    const last = tour.getByRole("button", { name: "Done" });
    if (await last.count()) {
      await last.click();
      break;
    }
    await tour.getByRole("button", { name: "Next" }).click();
  }
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // neither comes back on a reload: it is remembered for this person
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: /hi, e2e tester/i })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // ...until they ask for it again
  await page.goto("/settings");
  await page.getByRole("button", { name: "Show the intro again" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("dialog", { name: /welcome to paysense/i })).toBeVisible();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(violations).toEqual([]);
});
