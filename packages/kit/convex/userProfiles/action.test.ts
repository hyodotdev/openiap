import { getFunctionName } from "convex/server";
import { describe, expect, it, vi } from "vitest";

import type { Id } from "../_generated/dataModel";
import { testableFunction } from "../test.setup";
import { finalizeAccountDeletion } from "./action";

const userId = "user1" as Id<"users">;
const finalize = testableFunction(finalizeAccountDeletion)._handler;

function context(runMutation: () => Promise<{ done: boolean }>) {
  const runAfter = vi.fn().mockResolvedValue(undefined);
  return { ctx: { runMutation, scheduler: { runAfter } }, runAfter };
}

describe("finalizeAccountDeletion", () => {
  it("stops scheduling once the drain reports done", async () => {
    const { ctx, runAfter } = context(async () => ({ done: true }));
    await finalize(ctx, { userId });
    expect(runAfter).not.toHaveBeenCalled();
  });

  it("reschedules a failed batch with a growing delay and still reports the error", async () => {
    const { ctx, runAfter } = context(async () => {
      throw new Error("batch failed");
    });

    await expect(finalize(ctx, { userId })).rejects.toThrow("batch failed");
    await expect(finalize(ctx, { userId, failures: 2 })).rejects.toThrow(
      "batch failed",
    );

    expect(
      runAfter.mock.calls.map(([delay, fn, args]) => [
        delay,
        getFunctionName(fn),
        args,
      ]),
    ).toEqual([
      [
        60_000,
        "userProfiles/action:finalizeAccountDeletion",
        { userId, failures: 1 },
      ],
      [
        240_000,
        "userProfiles/action:finalizeAccountDeletion",
        { userId, failures: 3 },
      ],
    ]);
  });

  it("counts only failures in a row once a batch succeeds", async () => {
    const runMutation = vi
      .fn()
      .mockResolvedValueOnce({ done: false })
      .mockRejectedValueOnce(new Error("batch failed"));
    const { ctx, runAfter } = context(runMutation);

    await expect(finalize(ctx, { userId, failures: 6 })).rejects.toThrow(
      "batch failed",
    );
    expect(runAfter.mock.calls.map(([delay, , args]) => [delay, args])).toEqual(
      [[60_000, { userId, failures: 1 }]],
    );
  });

  it("keeps retrying hourly once the delay reaches its cap", async () => {
    const { ctx, runAfter } = context(async () => {
      throw new Error("batch failed");
    });
    await expect(finalize(ctx, { userId, failures: 6 })).rejects.toThrow(
      "batch failed",
    );
    expect(runAfter.mock.calls.map(([delay, , args]) => [delay, args])).toEqual(
      [[3_600_000, { userId, failures: 7 }]],
    );
  });
});
