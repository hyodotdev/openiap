import { describe, expect, it, vi } from "vitest";

import { BoundedSessionStore } from "../src/session-store";

function addSession<T>(
  store: BoundedSessionStore<T>,
  sessionId: string,
  value: T,
): void {
  const reservation = store.reserve();
  expect(reservation).not.toBeNull();
  reservation?.commit(sessionId, value);
}

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

    addSession(store, "active", "active-transport");
    now = 50;
    expect(store.get("active")).toBe("active-transport");
    now = 120;
    addSession(store, "next", "next-transport");
    expect(store.get("active")).toBe("active-transport");

    now = 221;
    expect(store.get("active")).toBeUndefined();
    await vi.waitFor(() =>
      expect(dispose).toHaveBeenCalledWith("active-transport"),
    );
  });

  it("rejects admission at the cap without evicting active sessions", () => {
    let now = 0;
    const dispose = vi.fn(async () => undefined);
    const store = new BoundedSessionStore<string>({
      maxSize: 2,
      idleTtlMs: 1_000,
      now: () => now,
      dispose,
    });

    addSession(store, "oldest", "oldest-transport");
    now = 1;
    addSession(store, "recent", "recent-transport");
    now = 2;
    expect(store.get("oldest")).toBe("oldest-transport");
    now = 3;
    expect(store.reserve()).toBeNull();

    expect(store.get("recent")).toBe("recent-transport");
    expect(store.get("oldest")).toBe("oldest-transport");
    expect(dispose).not.toHaveBeenCalled();
  });

  it("counts pending reservations and releases unused capacity", () => {
    const store = new BoundedSessionStore<string>({
      maxSize: 1,
      idleTtlMs: 100,
      dispose: vi.fn(),
    });

    const reservation = store.reserve();
    expect(reservation).not.toBeNull();
    expect(store.reserve()).toBeNull();

    reservation?.release();
    expect(store.reserve()).not.toBeNull();
  });

  it("closes every remaining session during shutdown", async () => {
    const dispose = vi.fn(async () => undefined);
    const store = new BoundedSessionStore<string>({
      maxSize: 2,
      idleTtlMs: 100,
      dispose,
    });
    addSession(store, "one", "transport-one");
    addSession(store, "two", "transport-two");

    await store.closeAll();

    expect(store.size).toBe(0);
    expect(dispose).toHaveBeenCalledTimes(2);
    expect(dispose).toHaveBeenCalledWith("transport-one");
    expect(dispose).toHaveBeenCalledWith("transport-two");
  });
});
