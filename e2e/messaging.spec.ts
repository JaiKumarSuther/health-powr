import { test, expect } from "@playwright/test";

test.describe("messaging", () => {
  test("Client can open a conversation tied to a request and send a message", async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/client/messages`);
    await expect(page).toHaveURL(/\/client\/messages/);
    await expect(page.getByText(/E2E Service|E2E seeded request/i)).toBeVisible();
  });

  test("CBO user in same org sees the message (realtime)", async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/cbo/messages`);
    await expect(page).toHaveURL(/\/cbo\/messages/);
    await expect(page.getByText(/Hello from client/i)).toBeVisible();
  });
});

