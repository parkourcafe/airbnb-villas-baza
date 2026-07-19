import { expect, test } from "@playwright/test";

// Milestone 8: the cron endpoint must reject unauthorized callers (8.5).
test("cron endpoint rejects an unauthenticated POST with 401", async ({
  request,
}) => {
  const response = await request.post("/api/cron");
  expect(response.status()).toBe(401);
});

test("cron endpoint rejects a wrong secret with 401", async ({ request }) => {
  const response = await request.post("/api/cron", {
    headers: { authorization: "Bearer wrong-secret" },
  });
  expect(response.status()).toBe(401);
});

test("cron endpoint does not authorize GET", async ({ request }) => {
  const response = await request.get("/api/cron");
  expect(response.status()).toBe(405);
});
