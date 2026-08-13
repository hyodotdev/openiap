import { describe, expect, it, vi } from "vitest";

import { BoundedSessionStore } from "../src/session-store";

describe("BoundedSessionStore", () => {
  it("expires idle sessions and refreshes active sessions", async () => {
    let now = 0;
    const dispose = vi.fn(async () => undefined);
    const store = new BoundedSessionStore<string>({
      maxSize: 2,
      idleTtlMs: 100,
      now: () => now,
      dispose,
    });

    store.set("active", "active-transport");
    now = 50;
    expect(store.get("active")).toBe("active-transport");
    now = 120;
    store.set("next", "next-transport");
    expect(store.get("active")).toBe("active-transport");

    now = 221;
    expect(store.get("active")).toBeUndefined();
    await vi.waitFor(() =>
      expect(dispose).toHaveBeenCalledWith("active-transport"),
    );
  });

  it("evicts the least recently used session at the cap", async () => {
    let now = 0;
    const dispose = vi.fn(async () => undefined);
    const store = new BoundedSessionStore<string>({
      maxSize: 2,
      idleTtlMs: 1_000,
      now: () => now,
      dispose,
    });

    store.set("oldest", "oldest-transport");
    now = 1;
    store.set("recent", "recent-transport");
    now = 2;
    expect(store.get("oldest")).toBe("oldest-transport");
    now = 3;
    store.set("new", "new-transport");

    expect(store.get("recent")).toBeUndefined();
    expect(store.get("oldest")).toBe("oldest-transport");
    expect(store.get("new")).toBe("new-transport");
    await vi.waitFor(() =>
      expect(dispose).toHaveBeenCalledWith("recent-transport"),
    );
  });

  it("closes every remaining session during shutdown", async () => {
    const dispose = vi.fn(async () => undefined);
    const store = new BoundedSessionStore<string>({
      maxSize: 2,
      idleTtlMs: 100,
      dispose,
    });
    store.set("one", "transport-one");
    store.set("two", "transport-two");

    await store.closeAll();

    expect(store.size).toBe(0);
    expect(dispose).toHaveBeenCalledTimes(2);
    expect(dispose).toHaveBeenCalledWith("transport-one");
    expect(dispose).toHaveBeenCalledWith("transport-two");
  });
});
