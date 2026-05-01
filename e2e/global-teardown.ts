import { teardownE2E } from "./seedTeardown";

export default async function globalTeardown() {
  await teardownE2E({ log: true });
}

