import { expect, test } from "@playwright/test";

test("the welcome page explains the product, and every way in leads to the login", async ({
  page,
}) => {
  const violations: string[] = [];
  page.on("console", (message) => {
    if (/content security policy|refused to (load|execute|connect)/i.test(message.text())) {
      violations.push(message.text());
    }
  });

  await page.goto("/");
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Think before you split.");

  // "See how it works" goes to that section of the same page
  await page.getByRole("link", { name: "See how it works" }).click();
  await expect(page).toHaveURL(/\/welcome#how$/);
  await expect(page.getByRole("heading", { name: "How it works" })).toBeInViewport();
  await expect(page.getByRole("heading", { name: "One of three answers" })).toBeAttached();

  // the closing button leads to the login too
  await page.getByRole("link", { name: "Sign in" }).last().click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/welcome");
  await page.getByRole("link", { name: "Get started" }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect(violations).toEqual([]);
});

test("the welcome page has nothing that sticks out sideways on a phone", async ({ page }) => {
  await page.goto("/welcome");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
