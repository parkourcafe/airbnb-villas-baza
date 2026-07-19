import { expect, test } from "@playwright/test";

test("home page renders the product name and demo marker", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Bali Accommodation Intelligence",
    }),
  ).toBeVisible();
  await expect(page.getByText("Demo data only")).toBeVisible();
});

test("health endpoint reports ok", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { status: string };
  expect(body.status).toBe("ok");
});
