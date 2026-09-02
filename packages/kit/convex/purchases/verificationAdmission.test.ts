import { afterEach, describe, expect, it, vi } from "vitest";

import {
  consume,
  evaluateVerificationAdmission,
  VERIFICATION_ADMISSION_CAPACITY,
} from "./verificationAdmission";
import { getVerificationProjectByApiKey } from "./shared";
import { testableFunction } from "../test.setup";

afterEach(() => vi.useRealTimers());

describe("verification admission", () => {
  it("starts with a full bucket and consumes one token", () => {
    expect(
      evaluateVerificationAdmission({
        tokens: undefined,
        refilledAt: undefined,
        now: 1_000,
      }),
    ).toEqual({
      admitted: true,
      tokens: VERIFICATION_ADMISSION_CAPACITY - 1,
    });
  });

  it("rejects an empty bucket with a retry hint", () => {
    expect(
      evaluateVerificationAdmission({
        tokens: 0,
        refilledAt: 1_000,
        now: 1_000,
      }),
    ).toEqual({ admitted: false, retryAfterSec: 1 });
  });

  it("refills over time without exceeding capacity", () => {
    expect(
      evaluateVerificationAdmission({
        tokens: 0,
        refilledAt: 1_000,
        now: 1_100,
      }),
    ).toEqual({ admitted: true, tokens: 0 });
    expect(
      evaluateVerificationAdmission({
        tokens: VERIFICATION_ADMISSION_CAPACITY,
        refilledAt: 1_000,
        now: 2_000,
      }),
    ).toEqual({
      admitted: true,
      tokens: VERIFICATION_ADMISSION_CAPACITY - 1,
    });
  });

  it("admits a project immediately after authoritative key lookup", async () => {
    const project = { _id: "projects_1" };
    const ctx = {
      runQuery: vi.fn().mockResolvedValue(project),
      runMutation: vi.fn().mockResolvedValue(null),
    };

    await expect(
      getVerificationProjectByApiKey(ctx as never, "openiap-kit_pk_project"),
    ).resolves.toBe(project);
    expect(ctx.runMutation).toHaveBeenCalledWith(expect.anything(), {
      projectId: "projects_1",
    });
    expect(ctx.runQuery.mock.invocationCallOrder[0]).toBeLessThan(
      ctx.runMutation.mock.invocationCallOrder[0],
    );
  });

  it("rejects before a store call when the persistent bucket is empty", async () => {
    vi.useFakeTimers({ now: 1_000 });
    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue({
          verificationAdmissionTokens: 0,
          verificationAdmissionRefilledAt: 1_000,
        }),
        patch: vi.fn(),
      },
    };

    await expect(
      testableFunction(consume)._handler(ctx as never, {
        projectId: "projects_1" as never,
      }),
    ).rejects.toMatchObject({
      data: {
        code: "RATE_LIMITED",
        retryAfterSec: 1,
      },
    });
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });
});
