import { describe, expect, it, beforeEach, vi } from "vitest";
import { __TESTING__ } from "../../contexts/NotificationContext";

function makeNotification(ts: Date, id: string) {
  return {
    id,
    type: "info" as const,
    title: "t",
    message: "m",
    timestamp: ts.toISOString(),
    read: false,
  };
}

describe("Notification storage hygiene", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useRealTimers();
  });

  it("prunes notifications older than 30 days on load", () => {
    const now = Date.now();
    const fresh = new Date(now - (__TESTING__.TTL_MS - 1000));
    const stale = new Date(now - (__TESTING__.TTL_MS + 1000));

    localStorage.setItem(
      __TESTING__.STORAGE_KEY,
      JSON.stringify([makeNotification(stale, "old"), makeNotification(fresh, "new")]),
    );

    const loaded = __TESTING__.safeLoadFromStorage();
    expect(loaded.map((n) => n.id)).toEqual(["new"]);
  });

  it("caps at 200 notifications", () => {
    const now = new Date();
    const many = Array.from({ length: __TESTING__.MAX_NOTIFICATIONS + 25 }).map((_, i) =>
      makeNotification(now, `n${i}`),
    );
    localStorage.setItem(__TESTING__.STORAGE_KEY, JSON.stringify(many));

    const loaded = __TESTING__.safeLoadFromStorage();
    expect(loaded.length).toBe(__TESTING__.MAX_NOTIFICATIONS);
  });

  it("persists to localStorage correctly", () => {
    const notifications = [
      {
        id: "a",
        type: "success" as const,
        title: "A",
        message: "M",
        timestamp: new Date("2020-01-01T00:00:00.000Z"),
        read: false,
      },
    ];

    __TESTING__.safeSaveToStorage(notifications);
    const raw = localStorage.getItem(__TESTING__.STORAGE_KEY);
    expect(raw).toContain('"id":"a"');
    expect(raw).toContain('"timestamp":"2020-01-01T00:00:00.000Z"');
  });
});

