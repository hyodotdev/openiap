// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { HarmonizedPurchaseState } from "./purchases/purchaseState";
import { sha256Hex } from "./utils/sha256";
import { withVerificationSource } from "./purchases/verificationSource";
import { decryptVerificationJob } from "./purchases/verificationJobCrypto";
import {
  VERIFICATION_JOB_DEADLINE_MS,
  VERIFICATION_JOB_LEASE_MS,
  VERIFICATION_JOB_RETENTION_MS,
} from "./purchases/verificationJobModel";
import { deleteProjectWithData } from "./projects/helpers";

const modules = import.meta.glob("./**/*.ts");
const makeTest = () => convexTest(schema, modules);
const request = {
  store: "google",
  purchaseToken: "test_purchase_token_123456789",
};
const idem = (n: number) => n.toString(16).padStart(64, "0");

async function fixture(shared?: ReturnType<typeof makeTest>, suffix = "") {
  const t = shared ?? makeTest();
  const apiKey = `openiap-kit_sk_queue_test${suffix}`;
  const { projectId, keyId } = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { name: "Queue fixture" });
    const orgId = await ctx.db.insert("organizations", {
      name: "Queue fixture",
      slug: "queue-fixture",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const projectId = await ctx.db.insert("projects", {
      organizationId: orgId,
      name: "Queue fixture",
      slug: "queue-fixture",
      apiKey: "legacy",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    const keyId = await ctx.db.insert("apiKeys", {
      projectId,
      organizationId: orgId,
      keyHash: await sha256Hex(apiKey),
      keyType: "secret",
      name: "Queue fixture",
      isActive: true,
      createdBy: userId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    return { projectId, keyId };
  });
  async function add(n = 1, input: object = request) {
    return t.action(
      api.purchases.verificationJobs.enqueue,
      withVerificationSource("enqueue", {
        apiKey,
        idempotencyKey: idem(n),
        inputJson: JSON.stringify(input),
        correlationId: "fixture",
      }),
    );
  }
  async function read(jobId: string, n = 1, key = apiKey) {
    return t.action(
      api.purchases.verificationJobs.read,
      withVerificationSource("read", {
        apiKey: key,
        idempotencyKey: idem(n),
        jobId,
      }),
    );
  }
  async function dispatch() {
    const queue = await t.run((ctx) =>
      ctx.db
        .query("verificationJobQueues")
        .withIndex("by_scope", (q) => q.eq("scope", "global"))
        .unique(),
    );
    await t.mutation(internal.purchases.verificationJobQueue.dispatch, {
      generation: queue!.generation!,
    });
  }
  return { t, apiKey, projectId, keyId, add, read, dispatch };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-26T09:00:00Z"));
  vi.stubEnv("IAPKIT_VERIFICATION_SOURCE_SECRET", "a".repeat(64));
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("durable purchase verification admission", () => {
  it("persists encrypted evidence and a scheduled dispatcher before acknowledging; lost acknowledgments deduplicate", async () => {
    const f = await fixture();
    const first = await f.add();
    expect(await f.add()).toEqual({ ...first, deduped: true });
    const row = await f.t.run((ctx) => ctx.db.get(first.jobId));
    expect(JSON.stringify(row)).not.toContain(f.apiKey);
    expect(JSON.stringify(row)).not.toContain(request.purchaseToken);
    const decoded = decryptVerificationJob(
      row!.payload!,
      JSON.stringify([row!.apiKeyHash, row!.idempotencyHash, row!.requestHash]),
    );
    expect(JSON.parse(decoded).input).toEqual(request);
    const scheduled = await f.t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect(),
    );
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0].args).not.toContain(f.apiKey);
    expect(await f.read(first.jobId)).toMatchObject({ status: "queued" });
  });

  it("rejects changed evidence on the same key without modifying accepted work", async () => {
    const f = await fixture();
    const first = await f.add();
    await expect(
      f.add(1, { ...request, purchaseToken: "other_purchase_token_123456" }),
    ).rejects.toThrow("IDEMPOTENCY_CONFLICT");
    expect(await f.read(first.jobId)).toMatchObject({ status: "queued" });
  });

  it("keys stored purchase fingerprints while keeping acknowledgment retries deterministic", async () => {
    const f = await fixture();
    const input = { store: "horizon", userId: "123456789", sku: "premium" };
    const first = await f.add(1, input);
    const before = (await f.t.run((ctx) => ctx.db.get(first.jobId)))!;
    vi.stubEnv("IAPKIT_VERIFICATION_SOURCE_SECRET", "b".repeat(64));
    expect(await f.add(1, input)).toEqual({ ...first, deduped: true });
    expect(await f.read(first.jobId)).toMatchObject({ status: "queued" });
    const second = await f.add(2, input);
    const after = (await f.t.run((ctx) => ctx.db.get(second.jobId)))!;
    for (const field of ["verdictHash", "evidenceHash"] as const)
      expect(after[field]).not.toBe(before[field]);
    const third = await f.add(3, input);
    const sameSource = (await f.t.run((ctx) => ctx.db.get(third.jobId)))!;
    expect(sameSource.requestHash).not.toBe(after.requestHash);
    expect(sameSource.verdictHash).toBe(after.verdictHash);
    expect(sameSource.evidenceHash).toBe(after.evidenceHash);
    expect(after.apiKeyHash).toBe(before.apiKeyHash);
    expect(before.idempotencyHash).toBe(await sha256Hex(idem(1)));
    expect(after.idempotencyHash).toBe(await sha256Hex(idem(2)));
    expect(await f.add(2, input)).toEqual({ ...second, deduped: true });
  });

  it("rejects missing/tampered source proof and malformed receipts before writing", async () => {
    const f = await fixture();
    await expect(
      f.t.action(api.purchases.verificationJobs.enqueue, {
        apiKey: f.apiKey,
        idempotencyKey: idem(1),
        inputJson: JSON.stringify(request),
        correlationId: "fixture",
      }),
    ).rejects.toThrow("UNKNOWN_ERROR");
    await expect(
      f.add(1, { store: "google", purchaseToken: "short" }),
    ).rejects.toThrow("INVALID_INPUT");
    expect(
      await f.t.run((ctx) => ctx.db.query("verificationJobs").collect()),
    ).toEqual([]);
  });

  it("requires the same API credential and secret random idempotency key for reads", async () => {
    const f = await fixture();
    const first = await f.add();
    await expect(f.read(first.jobId, 2)).rejects.toThrow("NOT_FOUND");
    await expect(f.read(first.jobId, 1, "other_key")).rejects.toThrow(
      "NOT_FOUND",
    );
    await expect(f.read("not-a-convex-id")).rejects.toThrow("NOT_FOUND");
    await f.t.run((ctx) => ctx.db.patch(f.keyId, { isActive: false }));
    await expect(f.read(first.jobId)).rejects.toThrow("NOT_FOUND");
    await expect(f.add(2)).rejects.toThrow("INVALID_API_KEY");
  });

  it("caps active work per project and preserves acknowledgment retries when the queue is full", async () => {
    const f = await fixture();
    const first = await f.add();
    for (let n = 2; n <= 128; n++)
      await f.add(n, { ...request, purchaseToken: request.purchaseToken + n });
    await expect(f.add(129)).rejects.toThrow("SERVICE_BUSY");
    expect(await f.add()).toEqual({ ...first, deduped: true });
    expect(
      await f.t.run((ctx) => ctx.db.query("verificationJobs").collect()),
    ).toHaveLength(128);
  });

  it("limits repeated evidence even with fresh idempotency keys and changed output flags", async () => {
    const f = await fixture();
    for (let n = 1; n <= 30; n++) await f.add(n);
    await expect(
      f.add(31, { ...request, includeTransactionDetails: true }),
    ).rejects.toThrow("RATE_LIMITED");
    expect(await f.add(1)).toMatchObject({ deduped: true });
  });

  it("admits no more than eight workers globally across projects", async () => {
    const first = await fixture();
    const fixtures = [first];
    for (let n = 1; n <= 4; n++)
      fixtures.push(await fixture(first.t, String(n)));
    for (const f of fixtures) {
      await f.add(1);
      await f.add(2);
    }
    await first.dispatch();
    const jobs = await first.t.run((ctx) =>
      ctx.db.query("verificationJobs").collect(),
    );
    expect(jobs.filter((j) => j.status === "running")).toHaveLength(8);
    expect(jobs.filter((j) => j.status === "queued")).toHaveLength(2);
    for (const f of fixtures)
      expect(
        jobs.filter(
          (j) => j.projectId === f.projectId && j.status === "running",
        ).length,
      ).toBeLessThanOrEqual(2);
  });

  it("treats a logically expired idempotency row like a pruned row", async () => {
    const f = await fixture();
    const first = await f.add();
    await f.dispatch();
    const job = (await f.t.run((ctx) => ctx.db.get(first.jobId)))!;
    await f.t.mutation(internal.purchases.verificationJobQueue.complete, {
      jobId: job._id,
      lease: job.lease!,
      receipt: { isValid: false, state: HarmonizedPurchaseState.INAUTHENTIC },
    });
    vi.setSystemTime(Date.now() + VERIFICATION_JOB_RETENTION_MS + 1_000);
    const next = await f.add();
    expect(next.jobId).not.toBe(first.jobId);
    expect(await f.read(next.jobId)).toMatchObject({ status: "queued" });
  });
});

describe("verification worker ownership and recovery", () => {
  it("renews the lease at actual worker startup and refuses duplicate starts", async () => {
    const f = await fixture();
    const { jobId } = await f.add();
    await f.dispatch();
    const claimed = (await f.t.run((ctx) => ctx.db.get(jobId)))!;
    vi.setSystemTime(Date.now() + 11 * 60_000);
    const started = await f.t.mutation(
      internal.purchases.verificationJobQueue.forWorker,
      { jobId, lease: claimed.lease! },
    );
    expect(started!.leaseUntil).toBeGreaterThan(claimed.leaseUntil!);
    expect(
      await f.t.mutation(internal.purchases.verificationJobQueue.forWorker, {
        jobId,
        lease: claimed.lease!,
      }),
    ).toBeNull();
    vi.setSystemTime(Date.now() + 61_000);
    await f.t.mutation(internal.purchases.verificationJobQueue.maintain, {});
    expect(await f.read(jobId)).toMatchObject({ status: "running" });
    const global = await f.t.run((ctx) =>
      ctx.db
        .query("verificationJobQueues")
        .withIndex("by_scope", (q) => q.eq("scope", "global"))
        .unique(),
    );
    expect(global).toMatchObject({ active: 1, running: 1 });
  });

  it("a refused duplicate startup cannot release a deleted worker that already began", async () => {
    const f = await fixture();
    const { jobId } = await f.add();
    await f.dispatch();
    const claimed = (await f.t.run((ctx) => ctx.db.get(jobId)))!;
    await f.t.mutation(internal.purchases.verificationJobQueue.forWorker, {
      jobId,
      lease: claimed.lease!,
    });
    await f.t.run((ctx) =>
      ctx.db.patch(f.projectId, { pendingDeletion: true }),
    );
    await f.t.run((ctx) => deleteProjectWithData(ctx, f.projectId));
    expect(
      await f.t.mutation(internal.purchases.verificationJobQueue.forWorker, {
        jobId,
        lease: claimed.lease!,
      }),
    ).toBeNull();
    const held = await f.t.run((ctx) =>
      ctx.db
        .query("verificationJobQueues")
        .withIndex("by_scope", (q) => q.eq("scope", "global"))
        .unique(),
    );
    expect(held).toMatchObject({ active: 0, running: 1 });
    await f.t.mutation(internal.purchases.verificationJobQueue.complete, {
      jobId,
      lease: claimed.lease!,
    });
    const released = await f.t.run((ctx) =>
      ctx.db
        .query("verificationJobQueues")
        .withIndex("by_scope", (q) => q.eq("scope", "global"))
        .unique(),
    );
    expect(released).toMatchObject({ active: 0, running: 0 });
  });
  it("bounds project concurrency and stores invalid receipts as completed verifications, erasing evidence", async () => {
    const f = await fixture();
    const jobs = [await f.add(1), await f.add(2), await f.add(3)];
    await f.dispatch();
    const running = await f.t.run((ctx) =>
      ctx.db
        .query("verificationJobs")
        .withIndex("by_status_expiry", (q) => q.eq("status", "running"))
        .collect(),
    );
    expect(running).toHaveLength(2);
    const job = running[0];
    await f.t.mutation(internal.purchases.verificationJobQueue.complete, {
      jobId: job._id,
      lease: job.lease!,
      receipt: { isValid: false, state: HarmonizedPurchaseState.INAUTHENTIC },
    });
    const complete = await f.t.run((ctx) => ctx.db.get(job._id));
    expect(complete).toMatchObject({
      status: "succeeded",
      receipt: { isValid: false },
    });
    expect(complete!.payload).toBeUndefined();
    expect(jobs).toHaveLength(3);
    const queues = await f.t.run((ctx) =>
      ctx.db.query("verificationJobQueues").collect(),
    );
    expect(queues.every((q) => q.active === 2 && q.running === 1)).toBe(true);
  });

  it("delays transient failures and prevents stale attempts from completing a reclaimed job", async () => {
    const f = await fixture();
    const { jobId } = await f.add();
    await f.dispatch();
    const old = (await f.t.run((ctx) => ctx.db.get(jobId)))!;
    await f.t.mutation(internal.purchases.verificationJobQueue.complete, {
      jobId,
      lease: old.lease!,
      error: { code: "STORE_UNAVAILABLE", message: "Retry" },
      retryAfterSec: 5,
    });
    expect(await f.read(jobId)).toMatchObject({ status: "queued" });
    vi.setSystemTime(Date.now() + 6_000);
    await f.dispatch();
    const next = (await f.t.run((ctx) => ctx.db.get(jobId)))!;
    expect(next.status).toBe("running");
    expect(next.lease).not.toBe(old.lease);
    await f.t.mutation(internal.purchases.verificationJobQueue.complete, {
      jobId,
      lease: old.lease!,
      receipt: { isValid: true, state: HarmonizedPurchaseState.ENTITLED },
    });
    expect(await f.read(jobId)).toMatchObject({ status: "running" });
    await f.t.mutation(internal.purchases.verificationJobQueue.complete, {
      jobId,
      lease: next.lease!,
      receipt: { isValid: true, state: HarmonizedPurchaseState.ENTITLED },
    });
    expect(await f.read(jobId)).toMatchObject({ status: "succeeded" });
  });

  it("recovers a dead worker after its lease, expires abandoned work and prunes retained results", async () => {
    const f = await fixture();
    const { jobId } = await f.add();
    await f.dispatch();
    vi.setSystemTime(Date.now() + VERIFICATION_JOB_LEASE_MS + 1);
    await f.t.mutation(internal.purchases.verificationJobQueue.maintain, {});
    expect(await f.read(jobId)).toMatchObject({ status: "queued" });
    vi.setSystemTime(Date.now() + VERIFICATION_JOB_DEADLINE_MS);
    await f.t.mutation(internal.purchases.verificationJobQueue.maintain, {});
    expect(await f.read(jobId)).toMatchObject({ status: "expired" });
    expect(
      (await f.t.run((ctx) => ctx.db.get(jobId)))!.payload,
    ).toBeUndefined();
    vi.setSystemTime(Date.now() + VERIFICATION_JOB_RETENTION_MS + 1);
    await expect(f.read(jobId)).rejects.toThrow("NOT_FOUND");
    await f.t.mutation(internal.purchases.verificationJobQueue.maintain, {});
    expect(await f.t.run((ctx) => ctx.db.get(jobId))).toBeNull();
  });

  it("releases capacity when project deletion removes queued and running work", async () => {
    const f = await fixture();
    await f.add(1);
    await f.add(2);
    await f.add(3);
    await f.dispatch();
    const running = await f.t.run((ctx) =>
      ctx.db
        .query("verificationJobs")
        .withIndex("by_status_expiry", (q) => q.eq("status", "running"))
        .collect(),
    );
    await f.t.run((ctx) =>
      ctx.db.patch(f.projectId, { pendingDeletion: true }),
    );
    await f.t.run((ctx) => deleteProjectWithData(ctx, f.projectId));
    expect(
      await f.t.run((ctx) => ctx.db.query("verificationJobs").collect()),
    ).toEqual([]);
    const global = await f.t.run((ctx) =>
      ctx.db
        .query("verificationJobQueues")
        .withIndex("by_scope", (q) => q.eq("scope", "global"))
        .unique(),
    );
    expect(global).toMatchObject({ active: 0, running: 2 });
    expect(global!.detachedLeases).toHaveLength(2);
    for (const job of running)
      await f.t.mutation(internal.purchases.verificationJobQueue.forWorker, {
        jobId: job._id,
        lease: job.lease!,
      });
    const after = await f.t.run((ctx) =>
      ctx.db
        .query("verificationJobQueues")
        .withIndex("by_scope", (q) => q.eq("scope", "global"))
        .unique(),
    );
    expect(after).toMatchObject({ active: 0, running: 0, detachedLeases: [] });
  });

  it("keeps the settled rejection cooldown without charging acknowledgment retries", async () => {
    const f = await fixture();
    const { jobId } = await f.add();
    await f.dispatch();
    const job = (await f.t.run((ctx) => ctx.db.get(jobId)))!;
    await f.t.mutation(internal.purchases.verificationJobQueue.complete, {
      jobId,
      lease: job.lease!,
      receipt: { isValid: false, state: HarmonizedPurchaseState.EXPIRED },
    });
    await expect(f.add(2)).rejects.toThrow("RATE_LIMITED");
    expect(await f.add()).toMatchObject({ jobId, deduped: true });
    vi.setSystemTime(Date.now() + 301_000);
    expect(await f.add(2)).toMatchObject({ deduped: false });
  });

  it("preserves each live rejection cooldown when callers alternate product match guards", async () => {
    const f = await fixture();
    for (const [n, expectedProductId] of [
      [1, "product.a"],
      [2, "product.b"],
    ] as const) {
      const { jobId } = await f.add(n, { ...request, expectedProductId });
      await f.dispatch();
      const job = (await f.t.run((ctx) => ctx.db.get(jobId)))!;
      await f.t.mutation(internal.purchases.verificationJobQueue.complete, {
        jobId,
        lease: job.lease!,
        receipt: { isValid: false, state: HarmonizedPurchaseState.EXPIRED },
      });
    }
    await expect(
      f.add(3, {
        ...request,
        expectedProductId: "product.a",
        includeTransactionDetails: true,
      }),
    ).rejects.toThrow("RATE_LIMITED");
    await expect(
      f.add(4, { ...request, expectedProductId: "product.b" }),
    ).rejects.toThrow("RATE_LIMITED");
  });

  it("releases an old expired lease before replacing its retained idempotency record", async () => {
    const f = await fixture();
    const { jobId } = await f.add();
    await f.dispatch();
    vi.setSystemTime(Date.now() + VERIFICATION_JOB_DEADLINE_MS + 1_000);
    expect(await f.read(jobId)).toMatchObject({ status: "expired" });
    vi.setSystemTime(Date.now() + VERIFICATION_JOB_RETENTION_MS + 1_000);
    const replacement = await f.add();
    expect(replacement.jobId).not.toBe(jobId);
    const global = await f.t.run((ctx) =>
      ctx.db
        .query("verificationJobQueues")
        .withIndex("by_scope", (q) => q.eq("scope", "global"))
        .unique(),
    );
    expect(global).toMatchObject({ active: 1, running: 0 });
  });

  it("drains more than one expiry batch without waiting for another cron tick", async () => {
    const f = await fixture();
    for (let n = 1; n <= 70; n++)
      await f.add(n, {
        ...request,
        purchaseToken: `${request.purchaseToken}${n}`,
      });
    vi.setSystemTime(Date.now() + VERIFICATION_JOB_DEADLINE_MS + 1_000);
    await f.t.mutation(internal.purchases.verificationJobQueue.maintain, {});
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const jobs = await f.t.run((ctx) =>
      ctx.db.query("verificationJobs").collect(),
    );
    expect(jobs).toHaveLength(70);
    expect(
      jobs.every((j) => j.status === "expired" && j.payload === undefined),
    ).toBe(true);
    const global = await f.t.run((ctx) =>
      ctx.db
        .query("verificationJobQueues")
        .withIndex("by_scope", (q) => q.eq("scope", "global"))
        .unique(),
    );
    expect(global).toMatchObject({ active: 0, running: 0 });
  });

  it("erases expired evidence immediately but holds the executing lease until acknowledgment", async () => {
    const f = await fixture();
    const { jobId } = await f.add();
    vi.setSystemTime(Date.now() + VERIFICATION_JOB_DEADLINE_MS - 60_000);
    await f.dispatch();
    const running = (await f.t.run((ctx) => ctx.db.get(jobId)))!;
    expect(running.status).toBe("running");
    vi.setSystemTime(Date.now() + 61_000);
    expect(await f.read(jobId)).toMatchObject({ status: "expired" });
    const expired = (await f.t.run((ctx) => ctx.db.get(jobId)))!;
    expect(expired.payload).toBeUndefined();
    expect(expired.lease).toBe(running.lease);
    const before = await f.t.run((ctx) =>
      ctx.db
        .query("verificationJobQueues")
        .withIndex("by_scope", (q) => q.eq("scope", "global"))
        .unique(),
    );
    expect(before).toMatchObject({ active: 0, running: 1 });
    await f.t.mutation(internal.purchases.verificationJobQueue.complete, {
      jobId,
      lease: running.lease!,
      receipt: { isValid: true, state: HarmonizedPurchaseState.ENTITLED },
    });
    expect(await f.read(jobId)).toMatchObject({ status: "expired" });
    const after = await f.t.run((ctx) =>
      ctx.db
        .query("verificationJobQueues")
        .withIndex("by_scope", (q) => q.eq("scope", "global"))
        .unique(),
    );
    expect(after).toMatchObject({ active: 0, running: 0 });
  });

  it("drains a retention backlog in bounded scheduled batches", async () => {
    const f = await fixture();
    const completedAt = Date.now() - VERIFICATION_JOB_RETENTION_MS - 1_000;
    await f.t.run(async (ctx) => {
      for (let n = 0; n < 140; n++)
        await ctx.db.insert("verificationJobs", {
          projectId: f.projectId,
          apiKeyHash: "key-hash",
          idempotencyHash: idem(n),
          requestHash: "request-hash",
          evidenceHash: "evidence-hash",
          verdictHash: "verdict-hash",
          replayTokens: 0,
          replayRefilledAt: completedAt,
          store: "google",
          correlationId: "fixture",
          status: "failed",
          attempts: 1,
          nextAttemptAt: completedAt,
          createdAt: completedAt - 1_000,
          expiresAt: completedAt,
          completedAt,
          error: { code: "VERIFICATION_FAILED", message: "Fixture" },
        });
    });
    await f.t.mutation(internal.purchases.verificationJobQueue.prune, {});
    expect(
      await f.t.run((ctx) => ctx.db.query("verificationJobs").collect()),
    ).toHaveLength(76);
    await f.t.finishAllScheduledFunctions(() => vi.runAllTimers());
    expect(
      await f.t.run((ctx) => ctx.db.query("verificationJobs").collect()),
    ).toEqual([]);
  });
});
