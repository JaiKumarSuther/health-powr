import type { FullConfig } from "@playwright/test";
import { seedE2E } from "./seedTeardown";

export default async function globalSetup(config: FullConfig) {
  const baseURL =
    process.env.E2E_APP_BASE_URL ??
    config.projects[0]?.use?.baseURL?.toString() ??
    "http://localhost:5000";

  await seedE2E({ baseURL, log: true });
}

