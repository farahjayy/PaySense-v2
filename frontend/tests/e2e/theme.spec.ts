import { expect, test } from "@playwright/test";

// A device that prefers dark, and a person who has not chosen yet.
test.use({ colorScheme: "dark" });

const PAGE_LIGHT = "rgb(247, 244, 213)"; // --color-page, light
const PAGE_DARK = "rgb(14, 31, 29)"; // --color-page, dark

test("dark mode follows the device until the person chooses, then keeps their choice", async ({
  page,
}) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/content security policy|refused to (load|execute|connect)/i.test(message.text())) {
      violations.push(message.text());
    }
  });
  const html = page.locator("html");

  // the script in <head> ran under the CSP and set the theme before anything painted
  await page.goto("/login");
  await expect(html).toHaveAttribute("data-theme", "dark");

  await page.getByLabel("Username").fill("e2e");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Hi, / })).toBeVisible();

  const toggle = page.getByRole("button", { name: "Dark mode" });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
    PAGE_DARK,
  );

  await toggle.click();
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe(
    PAGE_LIGHT,
  );

  // the choice beats the device's setting, and survives a reload
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(page.getByRole("button", { name: "Dark mode" })).toHaveAttribute(
    "aria-pressed",
    "false",
  );

  await page.getByRole("button", { name: "Dark mode" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  expect(violations).toEqual([]);
});

test("the welcome and login pages follow the theme, and the switch there is kept after signing in (ADR D-59)", async ({
  page,
}) => {
  const html = page.locator("html");
  const wrapperBackground = () =>
    page.evaluate(
      () => getComputedStyle(document.querySelector(".login-theme") as Element).backgroundColor,
    );

  await page.goto("/welcome");
  await expect(html).toHaveAttribute("data-theme", "dark");
  expect(await wrapperBackground()).toBe(PAGE_DARK);

  await page.getByRole("button", { name: "Dark mode" }).click();
  await expect(html).toHaveAttribute("data-theme", "light");
  expect(await wrapperBackground()).toBe(PAGE_LIGHT);

  // the choice carries to the login page, which has its own switch
  await page.getByRole("banner").getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(html).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Dark mode" }).click();
  await expect(html).toHaveAttribute("data-theme", "dark");
  expect(await wrapperBackground()).toBe(PAGE_DARK);

  // and it is still dark inside the app
  await page.getByLabel("Username").fill("e2e");
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page.getByRole("heading", { name: /^Hi, / })).toBeVisible();
  await expect(html).toHaveAttribute("data-theme", "dark");

  // the wider switch must not push the top bar past the screen (it did on a phone once)
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
