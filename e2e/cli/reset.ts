import { seedE2E, teardownE2E } from "../seedTeardown";

await teardownE2E({ log: true });
await seedE2E({ log: true });

