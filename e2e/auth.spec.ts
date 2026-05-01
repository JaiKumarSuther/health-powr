import { test, expect } from "@playwright/test";

test.describe("auth", () => {
  test("Community member can reach /client", async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/client`);
    await expect(page).toHaveURL(/\/client/);
  });

  test("Organization can reach /cbo", async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/cbo`);
    await expect(page).toHaveURL(/\/cbo/);
  });

  test("Invalid credentials show error, do not navigate", async ({ page, baseURL }) => {
    // This is a UI-level auth check and does not rely on seeded state.
    await page.goto(`${baseURL}/auth?mode=signin`);
    await page.getByPlaceholder("your@email.com").fill("invalid@example.com");
    await page.getByPlaceholder("••••••••").fill("wrong-password");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByText(/incorrect email or password/i)).toBeVisible();
  });

  test("Admin passkey gate blocks /admin without correct passkey", async ({ page, baseURL }) => {
    await page.goto(`${baseURL}/admin`);
    // Expected redirect to admin-passkey (or admin-login depending on auth state).
    await expect(page).toHaveURL(/\/admin-(passkey|login)/);
  });
});

