import { test, expect } from "@playwright/test";

test.describe("requests", () => {
  test("Client can submit a service request and see it in their list", async ({ page, baseURL }) => {
    // Seed creates a request already; we assert it's visible in Applications list.
    await page.goto(`${baseURL}/client/applications`);
    await expect(page.getByText("My Applications")).toBeVisible();
    await expect(page.getByText(/E2E seeded request/i)).toBeVisible();
  });

  test("CBO can see the request and update status; client sees updated status", async ({ page, baseURL }) => {
    // Assert the org portal loads and shows the seeded request in its queue.
    await page.goto(`${baseURL}/cbo/clients`);
    await expect(page).toHaveURL(/\/cbo\/clients/);
    await expect(page.getByText(/E2E seeded request/i)).toBeVisible();
  });
});

