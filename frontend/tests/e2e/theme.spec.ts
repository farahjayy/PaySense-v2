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
