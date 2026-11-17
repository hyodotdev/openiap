// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import {
  UNRECOGNIZED_PURCHASE_RETENTION_MS,
  pruneUnrecognizedPurchasesHandler,
} from "./cleanup";
import { amazonSubscriptionToken } from "../subscriptions/amazon";
import { HarmonizedPurchaseState } from "./purchaseState";

// Vite keys this directory's files as "./x.ts"; convex-test needs one root.
const modules = Object.fromEntries(
  Object.entries(import.meta.glob("../**/*.ts")).map(([path, load]) => [
    path.startsWith("./") ? `../purchases/${path.slice(2)}` : path,
    load,
  ]),
);
const START = 1_800_000_000_000;
const DAY_MS = 24 * 60 * 60 * 1_000;
const { INAUTHENTIC, ENTITLED } = HarmonizedPurchaseState;

async function setup(projectCount = 1) {
  vi.useFakeTimers({ now: START });
  const t = convexTest({ schema, modules, transactionLimits: true });
  const projects = await t.run(async (ctx) => {
    const ids: Id<"projects">[] = [];
    for (let index = 0; index < projectCount; index += 1) {
      const organizationId = await ctx.db.insert("organizations", {
        name: `Org ${index}`,
        slug: `org-${index}`,
        createdAt: START,
        updatedAt: START,
      });
      ids.push(
        await ctx.db.insert("projects", {
          organizationId,
          name: `Project ${index}`,
          slug: `project-${index}`,
          apiKey: `key-${index}`,
          createdAt: START,
          updatedAt: START,
        }),
      );
    }
    return ids;
  });
  const verify = (
    projectId: Id<"projects">,
    purchaseToken: string,
    state: HarmonizedPurchaseState,
    persistIfChanged?: boolean,
  ) =>
    t.mutation(internal.purchases.internal.saveReceiptInternal, {
      projectId,
      store: "google",
      applicationId: "dev.example",
      remoteId: purchaseToken,
      requestData: { store: "google", purchaseToken },
      state,
      isValid: state === ENTITLED,
      persistIfChanged,
    });
  const prune = (batchSize?: number) =>
    t.mutation(internal.purchases.cleanup.pruneUnrecognizedPurchases, {
      olderThanMs: UNRECOGNIZED_PURCHASE_RETENTION_MS,
      batchSize,
    });
  const rows = () => t.run((ctx) => ctx.db.query("purchases").collect());
  const stats = (projectId: Id<"projects">) =>
    t.run((ctx) =>
      ctx.db
        .query("purchaseStats")
        .withIndex("by_project", (q) => q.eq("projectId", projectId))
        .unique(),
    );
  return { t, projects, verify, prune, rows, stats };
}

afterEach(() => vi.useRealTimers());

describe("pruneUnrecognizedPurchases on convex-test", () => {
  it("reads only marked rows past the cutoff from the real index", async () => {
    const { t, projects, verify, prune, rows, stats } = await setup();
    const [project] = projects;
    await t.run(async (ctx) => {
      await ctx.db.insert("purchases", {
        projectId: project,
        store: "google",
        applicationId: "dev.example",
        remoteId: "legacy",
        requestData: { store: "google", purchaseToken: "legacy" },
        state: INAUTHENTIC,
        isValid: false,
      });
    });
    await verify(project, "valid", ENTITLED);
    await verify(project, "expired", INAUTHENTIC);
    vi.advanceTimersByTime(29 * DAY_MS);
    await verify(project, "fresh", INAUTHENTIC);
    vi.advanceTimersByTime(2 * DAY_MS);

    await expect(prune()).resolves.toEqual({ deleted: 1 });
    expect((await rows()).map((row) => row.remoteId)).toEqual([
      "legacy",
      "valid",
      "fresh",
    ]);
    expect(await stats(project)).toMatchObject({
      total: 2,
      valid: 1,
      invalid: 1,
    });
  });

  it("removes the marker field with patch(undefined)", async () => {
    const { t, projects, verify, prune, rows } = await setup();
    const [project] = projects;
    await verify(project, "subscribed", INAUTHENTIC);
    await verify(project, "late-buyer", INAUTHENTIC);
    await verify(project, "late-buyer", ENTITLED);
    await verify(project, "late-buyer", INAUTHENTIC);
    await verify(project, "rechecked", INAUTHENTIC);
    await t.run(async (ctx) => {
      await ctx.db.insert("subscriptions", {
        projectId: project,
        purchaseToken: "subscribed",
        productId: "monthly",
        platform: "Android",
        state: "Expired",
        startedAt: START,
        updatedAt: START,
      });
    });
    vi.advanceTimersByTime(29 * DAY_MS);
    await verify(project, "rechecked", INAUTHENTIC, true);
    vi.advanceTimersByTime(2 * DAY_MS);

    await expect(prune()).resolves.toEqual({ deleted: 0 });
    const after = await rows();
    expect(after.map((row) => [row.remoteId, "unrecognizedAt" in row])).toEqual(
      [
        ["subscribed", false],
        ["late-buyer", false],
        ["rechecked", true],
      ],
    );
    const marked = await t.run((ctx) =>
      ctx.db
        .query("purchases")
        .withIndex("by_unrecognizedAt", (q) => q.gt("unrecognizedAt", 0))
        .collect(),
    );
    expect(marked.map((row) => row.remoteId)).toEqual(["rechecked"]);
  });

  it("keeps and unmarks every referenced row, and one whose lookup throws", async () => {
    const { t, projects, verify, prune, rows, stats } = await setup();
    const [project] = projects;
    await t.run(async (ctx) => {
      const marked = (fields: {
        remoteId: string;
        store?: "amazon";
        appUserId?: string;
        accountErased?: boolean;
        orderId?: string;
      }) =>
        ctx.db.insert("purchases", {
          projectId: project,
          store: "google",
          applicationId: "dev.example",
          requestData: { store: "google", purchaseToken: "token" },
          state: INAUTHENTIC,
          isValid: false,
          statsCounted: true,
          storeStatsCounted: true,
          unrecognizedAt: START,
          ...fields,
        });
      const subscription = (purchaseToken: string, productId = "monthly") =>
        ctx.db.insert("subscriptions", {
          projectId: project,
          purchaseToken,
          productId,
          platform: "Android",
          state: "Expired",
          startedAt: START,
          updatedAt: START,
        });
      await marked({ remoteId: "owned", appUserId: "user-1" });
      await marked({ remoteId: "erased", accountErased: true });
      await marked({ remoteId: "ordered", orderId: "GPA.1" });
      await marked({ remoteId: "replaced" });
      await ctx.db.insert("subscriptionTokenAliases", {
        projectId: project,
        purchaseToken: "replaced",
        successorPurchaseToken: "successor",
        createdAt: START,
        updatedAt: START,
      });
      await marked({ remoteId: "amazon-receipt", store: "amazon" });
      await subscription(amazonSubscriptionToken("amazon-receipt"));
      await marked({ remoteId: "twice-subscribed" });
      await subscription("twice-subscribed");
      await subscription("twice-subscribed", "yearly");
    });
    await verify(project, "unknown-token", INAUTHENTIC);
    vi.advanceTimersByTime(UNRECOGNIZED_PURCHASE_RETENTION_MS + DAY_MS);

    await expect(prune()).resolves.toEqual({ deleted: 1 });
    const after = await rows();
    expect(after.map((row) => row.remoteId)).toEqual([
      "owned",
      "erased",
      "ordered",
      "replaced",
      "amazon-receipt",
      "twice-subscribed",
    ]);
    expect(after.filter((row) => "unrecognizedAt" in row)).toEqual([]);
    expect(await stats(project)).toMatchObject({ total: 0, invalid: 0 });
  });

  it("drains a backlog through the scheduler and stops", async () => {
    const { t, projects, verify, prune, rows, stats } = await setup(3);
    for (let index = 0; index < 250; index += 1) {
      await verify(projects[index % 3], `token-${index}`, INAUTHENTIC);
    }
    await verify(projects[0], "owner", ENTITLED);
    vi.advanceTimersByTime(UNRECOGNIZED_PURCHASE_RETENTION_MS + DAY_MS);

    await expect(prune()).resolves.toEqual({ deleted: 100 });
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());

    expect((await rows()).map((row) => row.remoteId)).toEqual(["owner"]);
    expect(await stats(projects[0])).toMatchObject({
      total: 1,
      valid: 1,
      invalid: 0,
    });
    expect(await stats(projects[1])).toMatchObject({ total: 0, invalid: 0 });
    const scheduled = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect(),
    );
    expect(
      scheduled
        .filter((job) => job.name.includes("pruneUnrecognizedPurchases"))
        .map((job) => job.state.kind),
    ).toEqual(["success", "success"]);
  });

  it("keeps one full batch across 100 projects inside the transaction limits", async () => {
    const { t, projects, verify } = await setup(100);
    for (const [index, project] of projects.entries()) {
      await verify(project, `token-${index}`, INAUTHENTIC);
    }
    vi.advanceTimersByTime(UNRECOGNIZED_PURCHASE_RETENTION_MS + DAY_MS);

    const metrics = await t.run(async (ctx) => {
      await pruneUnrecognizedPurchasesHandler(
        ctx,
        UNRECOGNIZED_PURCHASE_RETENTION_MS,
        100,
      );
      return await ctx.meta.getTransactionMetrics();
    });
    expect(metrics.databaseQueries.used).toBeLessThan(1_000);
    expect(metrics.documentsRead.used).toBeLessThan(1_000);
    expect(metrics.documentsWritten.used).toBeLessThan(1_000);
  });
});
