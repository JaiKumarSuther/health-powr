import { describe, expect, it } from "vitest";
import { withTimeout } from "../../lib/withTimeout";

describe("withTimeout", () => {
  it("resolves when promise settles within timeout", async () => {
    const result = await withTimeout(Promise.resolve("ok"), 50);
    expect(result).toBe("ok");
  });

  it("returns null when promise exceeds timeout", async () => {
    const never = new Promise<string>(() => {});
    const result = await withTimeout(never, 10);
    expect(result).toBeNull();
  });
});

