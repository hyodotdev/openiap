import {
  getFunctionName,
  type SchedulableFunctionReference,
} from "convex/server";
import { internalMutation } from "../_generated/server";
import { v } from "convex/values";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MemoryDb, seedProject } from "../test.memoryDb";
import { testableFunction } from "../test.setup";
import { discoverLegacyRevenueProjects } from "./revenueDiscovery";
import {
  continueRevenueDiscovery,
  recomputeAllRevenueMetrics,
  seedRevenueMetricsProject,
} from "./revenueMetrics";

const discover = testableFunction(
  internalMutation({
    args: { now: v.number() },
    handler: (ctx, { now }) => discoverLegacyRevenueProjects(ctx, now),
  }),
)._handler;

const NOW = Date.UTC(2026, 9, 18, 8);
type Call = { name: string; args: Record<string, unknown> };
function fixture() {
  const db = new MemoryDb();
  seedProject(db, "owner");
  const queue: Call[] = [];
  const context = {
    db,
    scheduler: {
      runAfter: async (
        _delay: number,
        fn: SchedulableFunctionReference,
        args: Record<string, unknown>,
      ) => {
        queue.push({ name: getFunctionName(fn), args });
      },
    },
  };
  const ctx = context;
  const continuation = testableFunction(continueRevenueDiscovery);
  return {
    db,
    ctx,
    queue,
    async step(call = queue.shift()) {
      if (!call) return;
      if (call.name.endsWith(":continueRevenueDiscovery")) {
        await continuation._handler(
          ctx,
          call.args as Parameters<typeof continuation._handler>[1],
        );
      } else if (call.name.endsWith(":seedRevenueMetricsProject")) {
        const seed = testableFunction(seedRevenueMetricsProject);
        await seed._handler(
          ctx,
          call.args as Parameters<typeof seed._handler>[1],
        );
      } else throw new Error("Discovery must not schedule actual rollups");
    },
  };
}
beforeEach(() => vi.useFakeTimers({ toFake: ["Date"] }).setSystemTime(NOW));
afterEach(() => vi.useRealTimers());

it("finishes events and stats from one kickoff despite new inputs and a deleted equal-time cursor row", async () => {
  const f = fixture();
  for (let i = 0; i < 351; i++)
    f.db.seed("webhookEvents", {
      projectId: "projects_1",
      source: "Apple",
      receivedAt: NOW,
    });
  f.db.seed("projects", {
    _id: "projects_stats",
    organizationId: "organizations_1",
  });
  f.db.seed("subscriptionStats", { projectId: "projects_stats" });
  await testableFunction(recomputeAllRevenueMetrics)._handler(f.ctx, {});
  expect(
    f.queue.every(
      (call) => !call.name.endsWith(":recomputeRevenueMetricsForProject"),
    ),
  ).toBe(true);
  const firstBoundary = f.db.rows("webhookEvents")[99]._id;
  await f.db.delete(firstBoundary);
  let steps = 0;
  while (f.queue.length) {
    if (++steps > 30) throw new Error("Unbounded discovery chain");
    f.db.seed("webhookEvents", {
      projectId: "projects_new",
      source: "Apple",
      receivedAt: NOW + 1,
    });
    f.db.seed("subscriptionStats", { projectId: "projects_new" });
    // New stats have creation times after the fixed bootstrap cutoff.
    f.db.rows("subscriptionStats").at(-1)!._creationTime = NOW + 1;
    await f.step();
  }
  expect(await f.db.query("revenueMetricsDiscovery").unique()).toMatchObject({
    phase: "done",
    cursor: null,
    through: NOW,
  });
  expect(
    f.db
      .rows("revenueMetricsRunStatus")
      .map((row) => row.projectId)
      .sort(),
  ).toEqual(["projects_1", "projects_stats"]);
  const query = vi.spyOn(f.db, "query");
  await discover(f.ctx, { now: NOW + 60_000 });
  expect(query.mock.calls.map(([table]) => table)).toEqual([
    "revenueMetricsDiscovery",
  ]);
});

it("ignores duplicate and stale continuations when the cron advances the checkpoint", async () => {
  const f = fixture();
  for (let i = 0; i < 251; i++)
    f.db.seed("webhookEvents", {
      projectId: "projects_1",
      source: "Apple",
      receivedAt: NOW,
    });
  await discover(f.ctx, { now: NOW });
  const old = f.queue.find((call) =>
    call.name.endsWith(":continueRevenueDiscovery"),
  )!;
  await discover(f.ctx, { now: NOW + 60_000 });
  const saved = structuredClone(f.db.rows("revenueMetricsDiscovery"));
  const pending = f.queue.length;
  await f.step(old);
  await f.step({ ...old, args: { ...old.args, phase: "stats" } });
  await f.step({ ...old, args: { ...old.args, through: NOW - 1 } });
  expect(f.db.rows("revenueMetricsDiscovery")).toEqual(saved);
  expect(f.queue).toHaveLength(pending);
  while (f.queue.length) await f.step();
  expect(f.db.rows("revenueMetricsRunStatus")).toHaveLength(1);
  expect(await f.db.query("revenueMetricsDiscovery").unique()).toMatchObject({
    phase: "done",
  });
});

it("separates byte-limited source pages from large owner documents and each guarded seed", async () => {
  const f = fixture();
  const large = "x".repeat(700_000);
  for (let i = 0; i < 20; i++) {
    f.db.seed("organizations", { _id: `organizations_large${i}`, name: large });
    f.db.seed("projects", {
      _id: `projects_large${i}`,
      organizationId: `organizations_large${i}`,
      name: large,
    });
    f.db.seed("webhookEvents", {
      projectId: `projects_large${i}`,
      source: "Apple",
      receivedAt: NOW,
      rawSignedPayload: "x".repeat(600_000),
    });
  }
  const get = vi.spyOn(f.db, "get");
  await discover(f.ctx, { now: NOW });
  expect(get).not.toHaveBeenCalled();
  expect(
    f.queue.filter((call) => call.name.endsWith(":seedRevenueMetricsProject"))
      .length,
  ).toBeLessThan(20);
  while (f.queue.length) {
    get.mockClear();
    const call = f.queue[0];
    await f.step();
    if (call.name.endsWith(":continueRevenueDiscovery"))
      expect(get).not.toHaveBeenCalled();
    else expect(get.mock.calls.length).toBeLessThanOrEqual(3);
  }
  expect(f.db.rows("revenueMetricsRunStatus")).toHaveLength(20);
});

it("rolls back checkpoint and scheduling together on a failed page and resumes without omissions", async () => {
  const f = fixture();
  for (let i = 0; i < 151; i++)
    f.db.seed("webhookEvents", {
      projectId: "projects_1",
      source: "Apple",
      receivedAt: NOW,
    });
  const saved = structuredClone(f.db.tables);
  const original = f.ctx.scheduler.runAfter.bind(f.ctx.scheduler);
  f.ctx.scheduler.runAfter = async () => {
    throw new Error("schedule failed");
  };
  await expect(discover(f.ctx, { now: NOW })).rejects.toThrow(
    "schedule failed",
  );
  // Model Convex's transaction rollback; this fake is not runtime transaction proof.
  f.db.tables.clear();
  for (const [table, rows] of saved) f.db.tables.set(table, rows);
  f.queue.length = 0;
  f.ctx.scheduler.runAfter = original;
  await discover(f.ctx, { now: NOW });
  while (f.queue.length) await f.step();
  expect(f.db.rows("revenueMetricsRunStatus")).toHaveLength(1);
  expect(await f.db.query("revenueMetricsDiscovery").unique()).toMatchObject({
    phase: "done",
  });
});
