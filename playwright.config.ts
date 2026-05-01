import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: "http://localhost:5000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "client",
      use: {
        ...devices["Desktop Chrome"],
        storageState: ".playwright/storage.client.json",
      },
    },
    {
      name: "org",
      use: {
        ...devices["Desktop Chrome"],
        storageState: ".playwright/storage.org.json",
      },
    },
    {
      name: "staff",
      use: {
        ...devices["Desktop Chrome"],
        storageState: ".playwright/storage.staff.json",
      },
    },
    {
      name: "admin",
      use: {
        ...devices["Desktop Chrome"],
        storageState: ".playwright/storage.admin.json",
      },
    },
  ],
});

