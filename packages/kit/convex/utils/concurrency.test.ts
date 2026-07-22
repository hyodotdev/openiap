import { describe, expect, it } from "vitest";

import { mapWithConcurrency } from "./concurrency";

describe("mapWithConcurrency", () => {
  it("waits for in-flight cleanup and starts no new work after a failure", async () => {
    const events: string[] = [];
    let releaseCleanup!: () => void;
    const cleanup = new Promise<void>((resolve) => {
      releaseCleanup = resolve;
    });

    const running = mapWithConcurrency([0, 1, 2, 3], 2, async (item) => {
      events.push(`start:${item}`);
      if (item === 0) throw new Error("stop");
      await cleanup;
      events.push(`cleanup:${item}`);
      return item;
    });

    await Promise.resolve();
    expect(events).toEqual(["start:0", "start:1"]);
    releaseCleanup();
    await expect(running).rejects.toThrow("stop");
    expect(events).toEqual(["start:0", "start:1", "cleanup:1"]);
  });

  it("rejects when a worker rejects with undefined", async () => {
    const running = mapWithConcurrency([0], 1, () =>
      // Deliberately exercise a malformed third-party rejection value.
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      Promise.reject(undefined),
    );

    await expect(running).rejects.toThrow(
      "Concurrent worker failed with a non-Error rejection",
    );
  });
});
