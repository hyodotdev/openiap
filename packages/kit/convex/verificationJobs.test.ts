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
  async function queue() {
    return t.run((ctx) =>
      ctx.db
        .query("verificationJobQueues")
        .withIndex("by_scope", (q) => q.eq("scope", "global"))
        .unique(),
    );
  }
  async function dispatch() {
    const global = await queue();
    await t.mutation(internal.purchases.verificationJobQueue.dispatch, {
      generation: global!.generation!,
    });
  }
  async function workers() {
    return (await queue())?.workers ?? [];
  }
  async function worker(jobId: string) {
    const found = (await workers()).find((item) => item.jobId === jobId);
    if (!found) throw new Error("Expected a claimed verification worker");
    return found;
  }
  return {
    t,
    apiKey,
    projectId,
    keyId,
    add,
    read,
    dispatch,
    queue,
    workers,
    worker,
  };
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
      lease: (await f.worker(job._id)).lease,
      receipt: { isValid: false, state: HarmonizedPurchaseState.INAUTHENTIC },
    });
    vi.setSystemTime(Date.now() + VERIFICATION_JOB_RETENTION_MS + 1_000);
    const next = await f.add();
    expect(next.jobId).not.toBe(first.jobId);
    expect(await f.read(next.jobId)).toMatchObject({ status: "queued" });
  });
});

describe("verification worker ownership and recovery", () => {
  it("renews the single worker entry at actual startup", async () => {
    const f = await fixture();
    const { jobId } = await f.add();
    await f.dispatch();
    const claimed = await f.worker(jobId);
    vi.setSystemTime(Date.now() + 11 * 60_000);
    await f.t.mutation(internal.purchases.verificationJobQueue.forWorker, {
      jobId,
      lease: claimed.lease,
    });
    expect((await f.worker(jobId)).until).toBeGreaterThan(claimed.until);
    vi.setSystemTime(Date.now() + 61_000);
    await f.t.mutation(internal.purchases.verificationJobQueue.maintain, {});
    expect(await f.read(jobId)).toMatchObject({ status: "running" });
    expect(await f.workers()).toHaveLength(1);
  });

  it("fences late starts and completions after a lease is reaped", async () => {
    const f = await fixture();
    const { jobId } = await f.add();
    await f.dispatch();
    const old = await f.worker(jobId);
    vi.setSystemTime(Date.now() + VERIFICATION_JOB_LEASE_MS + 1);
    await f.t.mutation(internal.purchases.verificationJobQueue.maintain, {});
    expect(await f.read(jobId)).toMatchObject({ status: "queued" });
    await f.dispatch();
    const replacement = await f.worker(jobId);
    expect(replacement.lease).not.toBe(old.lease);
    expect(
      await f.t.mutation(internal.purchases.verificationJobQueue.forWorker, {
        jobId,
        lease: old.lease,
      }),
    ).toBeNull();
    await f.t.mutation(internal.purchases.verificationJobQueue.complete, {
      jobId,
      lease: old.lease,
      receipt: { isValid: true, state: HarmonizedPurchaseState.ENTITLED },
    });
    expect(await f.workers()).toEqual([replacement]);
    expect(await f.read(jobId)).toMatchObject({ status: "running" });
  });

  it("anonymizes an executing worker on project deletion until acknowledgment", async () => {
    const f = await fixture();
    const { jobId } = await f.add();
    await f.dispatch();
    const claimed = await f.worker(jobId);
    await f.t.mutation(internal.purchases.verificationJobQueue.forWorker, {
      jobId,
      lease: claimed.lease,
    });
    const executing = await f.worker(jobId);
    await f.t.run((ctx) =>
      ctx.db.patch(f.projectId, { pendingDeletion: true }),
    );
    await f.t.run((ctx) => deleteProjectWithData(ctx, f.projectId));
    expect(await f.workers()).toEqual([
      { lease: executing.lease, until: executing.until },
    ]);
    await f.t.mutation(internal.purchases.verificationJobQueue.complete, {
      jobId,
      lease: executing.lease,
    });
    expect(await f.workers()).toEqual([]);
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
      lease: (await f.worker(job._id)).lease,
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
    expect(queues.every((q) => q.active === 2)).toBe(true);
    expect(await f.workers()).toHaveLength(1);
  });

  it("delays transient failures and prevents stale attempts from completing a reclaimed job", async () => {
    const f = await fixture();
    const { jobId } = await f.add();
    await f.dispatch();
    const old = await f.worker(jobId);
    await f.t.mutation(internal.purchases.verificationJobQueue.complete, {
      jobId,
      lease: old.lease,
      error: { code: "STORE_UNAVAILABLE", message: "Retry" },
      retryAfterSec: 5,
    });
    expect(await f.read(jobId)).toMatchObject({ status: "queued" });
    vi.setSystemTime(Date.now() + 6_000);
    await f.dispatch();
    const next = await f.worker(jobId);
    expect(await f.read(jobId)).toMatchObject({ status: "running" });
    expect(next.lease).not.toBe(old.lease);
    await f.t.mutation(internal.purchases.verificationJobQueue.complete, {
      jobId,
      lease: old.lease,
      receipt: { isValid: true, state: HarmonizedPurchaseState.ENTITLED },
    });
    expect(await f.read(jobId)).toMatchObject({ status: "running" });
    await f.t.mutation(internal.purchases.verificationJobQueue.complete, {
      jobId,
      lease: next.lease,
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
    const workers = await f.workers();
    await f.t.run((ctx) =>
      ctx.db.patch(f.projectId, { pendingDeletion: true }),
    );
    await f.t.run((ctx) => deleteProjectWithData(ctx, f.projectId));
    expect(
      await f.t.run((ctx) => ctx.db.query("verificationJobs").collect()),
    ).toEqual([]);
    const global = await f.queue();
    expect(global).toMatchObject({ active: 0 });
    expect(await f.workers()).toEqual(
      workers.map(({ lease, until }) => ({ lease, until })),
    );
    for (const worker of workers)
      await f.t.mutation(internal.purchases.verificationJobQueue.forWorker, {
        jobId: worker.jobId!,
        lease: worker.lease,
      });
    const after = await f.queue();
    expect(after).toMatchObject({ active: 0, workers: [] });
  });

  it("keeps the settled rejection cooldown without charging acknowledgment retries", async () => {
    const f = await fixture();
    const { jobId } = await f.add();
    await f.dispatch();
    const job = (await f.t.run((ctx) => ctx.db.get(jobId)))!;
    await f.t.mutation(internal.purchases.verificationJobQueue.complete, {
      jobId,
      lease: (await f.worker(job._id)).lease,
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
        lease: (await f.worker(job._id)).lease,
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
    const global = await f.queue();
    expect(global).toMatchObject({ active: 1, workers: [] });
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
    const global = await f.queue();
    expect(global).toMatchObject({ active: 0 });
    expect(await f.workers()).toEqual([]);
  });

  it("erases expired evidence immediately but holds the executing lease until acknowledgment", async () => {
    const f = await fixture();
    const { jobId } = await f.add();
    vi.setSystemTime(Date.now() + VERIFICATION_JOB_DEADLINE_MS - 60_000);
    await f.dispatch();
    const running = await f.worker(jobId);
    expect(await f.read(jobId)).toMatchObject({ status: "running" });
    vi.setSystemTime(Date.now() + 61_000);
    expect(await f.read(jobId)).toMatchObject({ status: "expired" });
    const expired = (await f.t.run((ctx) => ctx.db.get(jobId)))!;
    expect(expired.payload).toBeUndefined();
    expect(await f.workers()).toEqual([running]);
    const before = await f.queue();
    expect(before).toMatchObject({ active: 0 });
    expect(await f.workers()).toHaveLength(1);
    await f.t.mutation(internal.purchases.verificationJobQueue.complete, {
      jobId,
      lease: running.lease,
      receipt: { isValid: true, state: HarmonizedPurchaseState.ENTITLED },
    });
    expect(await f.read(jobId)).toMatchObject({ status: "expired" });
    const after = await f.queue();
    expect(after).toMatchObject({ active: 0, workers: [] });
  });

  it("keeps unresolved Google failures out of the rejection cooldown", async () => {
    const f = await fixture();
    const { jobId } = await f.add();
    await f.dispatch();
    await f.t.mutation(internal.purchases.verificationJobQueue.complete, {
      jobId,
      lease: (await f.worker(jobId)).lease,
      error: {
        code: "PLAY_STORE_VERIFICATION_ERROR",
        message: "Verification could not finish.",
      },
    });
    expect(await f.read(jobId)).toMatchObject({ status: "failed" });
    const job = await f.t.run((ctx) => ctx.db.get(jobId));
    expect(job?.receipt).toBeUndefined();
    expect(job?.rejectedAt).toBeUndefined();
    expect(await f.add(2)).toMatchObject({ deduped: false });
  });

  it("rate limits durable admissions after failures free active capacity", async () => {
    const f = await fixture();
    const { jobId } = await f.add();
    await f.dispatch();
    await f.t.mutation(internal.purchases.verificationJobQueue.complete, {
      jobId,
      lease: (await f.worker(jobId)).lease,
      error: {
        code: "PROJECT_ANDROID_PACKAGE_NAME_NOT_CONFIGURED",
        message: "Missing configuration.",
      },
    });
    expect(await f.workers()).toEqual([]);
    await f.t.run(async (ctx) => {
      const project = await ctx.db
        .query("verificationJobQueues")
        .withIndex("by_project", (q) => q.eq("projectId", f.projectId))
        .unique();
      expect(project?.active).toBe(0);
      await ctx.db.patch(project!._id, { tokens: 0, refilledAt: Date.now() });
    });
    await expect(
      f.add(2, {
        ...request,
        purchaseToken: "different_purchase_token_123456789",
      }),
    ).rejects.toThrow("RATE_LIMITED");
    expect(
      await f.t.run((ctx) => ctx.db.query("verificationJobs").collect()),
    ).toHaveLength(1);
  });

  it("counts expired workers against the project limit until acknowledgment", async () => {
    const f = await fixture();
    const a = await f.add(1),
      b = await f.add(2);
    vi.setSystemTime(Date.now() + VERIFICATION_JOB_DEADLINE_MS - 60_000);
    await f.dispatch();
    const old = await f.worker(a.jobId);
    vi.setSystemTime(Date.now() + 61_000);
    expect(await f.read(a.jobId, 1)).toMatchObject({ status: "expired" });
    expect(await f.read(b.jobId, 2)).toMatchObject({ status: "expired" });
    const next = await f.add(3);
    await f.dispatch();
    expect(await f.read(next.jobId, 3)).toMatchObject({ status: "queued" });
    expect(await f.workers()).toHaveLength(2);
    await f.t.mutation(internal.purchases.verificationJobQueue.complete, {
      jobId: a.jobId,
      lease: old.lease,
    });
    await f.dispatch();
    expect(await f.read(next.jobId, 3)).toMatchObject({ status: "running" });
    expect(await f.workers()).toHaveLength(2);
  });

  it("keeps anonymous deleted workers inside the global limit and fences other jobs", async () => {
    const first = await fixture();
    const fixtures = [first];
    for (let n = 1; n < 5; n++)
      fixtures.push(await fixture(first.t, `bound${n}`));
    const jobs = [];
    for (const f of fixtures.slice(0, 4))
      jobs.push([await f.add(1), await f.add(2)]);
    await first.dispatch();
    const reserved = await first.workers();
    expect(reserved).toHaveLength(8);
    const old = await first.worker(jobs[0][0].jobId);
    await first.t.run((ctx) =>
      ctx.db.patch(first.projectId, { pendingDeletion: true }),
    );
    await first.t.run((ctx) => deleteProjectWithData(ctx, first.projectId));
    expect(
      (await first.workers()).filter((worker) => !worker.jobId),
    ).toHaveLength(2);
    const other = fixtures[4];
    const next = await other.add();
    await other.dispatch();
    expect(await other.read(next.jobId)).toMatchObject({ status: "queued" });
    expect(await first.workers()).toHaveLength(8);
    await first.t.mutation(internal.purchases.verificationJobQueue.complete, {
      jobId: jobs[0][0].jobId,
      lease: old.lease,
    });
    await other.dispatch();
    expect(await other.read(next.jobId)).toMatchObject({ status: "running" });
    const anonymous = (await first.workers()).find((worker) => !worker.jobId)!;
    expect(
      await first.t.mutation(
        internal.purchases.verificationJobQueue.forWorker,
        { jobId: next.jobId, lease: anonymous.lease },
      ),
    ).toBeNull();
    await first.t.mutation(internal.purchases.verificationJobQueue.complete, {
      jobId: next.jobId,
      lease: anonymous.lease,
      receipt: { isValid: true, state: HarmonizedPurchaseState.ENTITLED },
    });
    expect(await other.read(next.jobId)).toMatchObject({ status: "running" });
    expect(await first.workers()).toHaveLength(8);
  });

  it("preempts a later scheduled retry when recovering a worker due now", async () => {
    const first = await fixture();
    const a = await first.add();
    await first.dispatch();
    vi.setSystemTime(Date.now() + 11 * 60_000);
    const other = await fixture(first.t, "recovery");
    const b = await other.add();
    await other.dispatch();
    await other.t.mutation(internal.purchases.verificationJobQueue.complete, {
      jobId: b.jobId,
      lease: (await other.worker(b.jobId)).lease,
      error: { code: "STORE_UNAVAILABLE", message: "Retry" },
      retryAfterSec: 300,
    });
    await other.dispatch();
    const later = await first.queue();
    expect(later?.dispatchAt).toBeGreaterThan(Date.now() + 299_000);
    vi.setSystemTime(Date.now() + 60_001);
    await first.t.mutation(
      internal.purchases.verificationJobQueue.maintain,
      {},
    );
    expect(await first.read(a.jobId)).toMatchObject({ status: "queued" });
    const recovered = await first.queue();
    expect(recovered!.dispatchAt!).toBeLessThanOrEqual(Date.now() + 1_000);
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
