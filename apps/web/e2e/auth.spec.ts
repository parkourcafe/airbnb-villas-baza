import { expect, test } from "@playwright/test";

test("unauthenticated access to /app is redirected to login (AUTH-01)", async ({
  page,
}) => {
  await page.goto("/app/overview");
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(
    page.getByRole("heading", { name: "Sign in to BAI" }),
  ).toBeVisible();
});

test("unauthenticated access to /app/collections and /app/snapshots is redirected", async ({
  page,
}) => {
  await page.goto("/app/collections");
  await expect(page).toHaveURL(/\/login\?next=/);
  await page.goto("/app/snapshots");
  await expect(page).toHaveURL(/\/login\?next=/);
});

test("the login page renders the credentials form", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});
