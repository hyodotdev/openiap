import { describe, expect, it, vi } from "vitest";

import { testableFunction } from "../test.setup";
import { hmacSha256Hex, sha256Hex } from "../utils/sha256";
import {
  bindUserAsServer as registeredBindUserAsServer,
  rebindUser as registeredRebindUser,
  requestUserErasure as registeredRequestUserErasure,
} from "./mutation";

const rebindUser = testableFunction(registeredRebindUser);
const requestUserErasure = testableFunction(registeredRequestUserErasure);
const bindUserAsServer = testableFunction(registeredBindUserAsServer);

// rebindUser moves who owns a purchase, so it is secret-key only. The check
// lives in the mutation, not in the HTTP layer, because Convex functions are
// publicly callable with a key alone.
describe("rebindUser authorization", () => {
  const project = {
    _id: "projects_1",
    _creationTime: 0,
    organizationId: "organizations_1",
    userErasureHashKey: "test-erasure-hash-key",
  };
  const organization = { _id: "organizations_1", _creationTime: 0 };

  const dbWith = (
    keyType?: "publishable" | "secret",
    erasureJob?: Record<string, unknown>,
  ) => ({
    rows: {
      apiKeys: keyType
        ? [
            {
              _id: "apiKeys_1",
              key: "k",
              keyType,
              isActive: true,
              projectId: project._id,
              organizationId: organization._id,
            },
          ]
        : [],
      projects: [project],
      organizations: [organization],
      subscriptions: [],
      subscriptionUserErasureJobs: erasureJob ? [erasureJob] : [],
    } as Record<string, Record<string, unknown>[]>,
    async get(id: string) {
      return (
        Object.values(this.rows)
          .flat()
          .find((r) => r._id === id) ?? null
      );
    },
    query(table: string) {
      const rows = this.rows[table] ?? [];
      const api = {
        withIndex: (_n: string, fn: (q: unknown) => unknown) => {
          const captured: Record<string, unknown> = {};
          const q: Record<string, (f: string, v: unknown) => unknown> = {};
          q.eq = (f, v) => {
            captured[f] = v;
            return q;
          };
          fn(q);
          return {
            first: async () =>
              rows.find((r) =>
                Object.entries(captured).every(([k, v]) => r[k] === v),
              ) ?? null,
            unique: async () =>
              rows.find((r) =>
                Object.entries(captured).every(([k, v]) => r[k] === v),
              ) ?? null,
            collect: async () => [],
          };
        },
      };
      return api;
    },
    async patch(id: string, value: Record<string, unknown>) {
      const row = Object.values(this.rows)
        .flat()
        .find((candidate) => candidate._id === id);
      if (row) Object.assign(row, value);
    },
    async insert(table: string, value: Record<string, unknown>) {
      const id = `${table}_${(this.rows[table]?.length ?? 0) + 1}`;
      const row = { _id: id, ...value };
      (this.rows[table] ??= []).push(row);
      return id;
    },
  });

  it("rejects a publishable key", async () => {
    await expect(
      rebindUser._handler(dbWithCtx("publishable"), {
        apiKey: "k",
        purchaseToken: "t",
        userId: "u",
      }),
    ).rejects.toSatisfy(
      (e: unknown) =>
        (e as { data?: { code?: string } }).data?.code === "INSUFFICIENT_SCOPE",
    );
  });

  it("accepts a secret key", async () => {
    await expect(
      rebindUser._handler(dbWithCtx("secret"), {
        apiKey: "k",
        purchaseToken: "t",
        userId: "u",
      }),
    ).resolves.toEqual({ ok: true, rebound: false, notified: true });
  });

  it("rejects a publishable key for user erasure inside Convex", async () => {
    await expect(
      requestUserErasure._handler(dbWithCtx("publishable"), {
        apiKey: "k",
        userId: "user-1",
      }),
    ).rejects.toSatisfy(
      (e: unknown) =>
        (e as { data?: { code?: string } }).data?.code === "INSUFFICIENT_SCOPE",
    );
  });

  it("rejects an unknown secret-shaped key for user erasure", async () => {
    await expect(
      requestUserErasure._handler(
        { db: dbWith() },
        {
          apiKey: "openiap-kit_sk_unknown",
          userId: "user-1",
        },
      ),
    ).rejects.toSatisfy(
      (error: unknown) =>
        (error as { data?: { code?: string } }).data?.code ===
        "INVALID_API_KEY",
    );
  });

  it("returns the completed erasure job instead of reopening it", async () => {
    const userId = "user-1";
    const completed = {
      _id: "subscriptionUserErasureJobs_1",
      projectId: project._id,
      userIdHash: await hmacSha256Hex(project.userErasureHashKey, userId),
      status: "completed",
    };
    const scheduler = { runAfter: vi.fn() };

    await expect(
      requestUserErasure._handler(
        { db: dbWith("secret", completed), scheduler },
        { apiKey: "k", userId },
      ),
    ).resolves.toEqual({
      ok: true,
      jobId: completed._id,
      status: "completed",
    });
    expect(scheduler.runAfter).not.toHaveBeenCalled();
  });

  it("rekeys a legacy completed job on an idempotent request", async () => {
    const userId = "legacy-user";
    const completed = {
      _id: "subscriptionUserErasureJobs_legacy",
      projectId: project._id,
      userIdHash: await sha256Hex(userId),
      status: "completed",
    };
    const db = dbWith("secret", completed);
    const scheduler = { runAfter: vi.fn() };

    await expect(
      requestUserErasure._handler(
        { db, scheduler },
        {
          apiKey: "k",
          userId,
        },
      ),
    ).resolves.toMatchObject({ jobId: completed._id, status: "completed" });
    expect(completed.userIdHash).toBe(
      await hmacSha256Hex(project.userErasureHashKey, userId),
    );
    expect(scheduler.runAfter).not.toHaveBeenCalled();
  });

  it("stores a keyed erasure lookup instead of a plain userId digest", async () => {
    const userId = "guessable-user@example.com";
    const db = dbWith("secret");
    const scheduler = { runAfter: vi.fn() };

    await requestUserErasure._handler(
      { db, scheduler },
      {
        apiKey: "k",
        userId,
      },
    );

    const [job] = db.rows.subscriptionUserErasureJobs;
    expect(job.userIdHash).toBe(
      await hmacSha256Hex(project.userErasureHashKey, userId),
    );
    expect(job.userIdHash).not.toBe(await sha256Hex(userId));
  });

  it("creates a project erasure key on first use", async () => {
    const userId = "first-erasure-user";
    const db = dbWith("secret");
    db.rows.projects = [{ ...project, userErasureHashKey: undefined }];
    const scheduler = { runAfter: vi.fn() };

    await requestUserErasure._handler(
      { db, scheduler },
      {
        apiKey: "k",
        userId,
      },
    );

    const [projectRow] = db.rows.projects;
    const key = projectRow.userErasureHashKey;
    expect(key).toEqual(expect.any(String));
    expect(String(key)).toHaveLength(64);
    expect(db.rows.subscriptionUserErasureJobs[0].userIdHash).toBe(
      await hmacSha256Hex(String(key), userId),
    );
  });

  // bindPurchase (server role) must distinguish an unknown key from an
  // under-scoped one: unknown/inactive is INVALID_API_KEY (UNAUTHORIZED at the
  // edge), only a real publishable key is INSUFFICIENT_SCOPE (FORBIDDEN).
  it("rejects an unknown key with INVALID_API_KEY, not INSUFFICIENT_SCOPE", async () => {
    await expect(
      bindUserAsServer._handler(
        { db: dbWith() },
        {
          apiKey: "openiap-kit_sk_unknown",
          purchaseToken: "t",
          userId: "u",
        },
      ),
    ).rejects.toSatisfy(
      (error: unknown) =>
        (error as { data?: { code?: string } }).data?.code ===
        "INVALID_API_KEY",
    );
  });

  it("rejects a valid publishable key with INSUFFICIENT_SCOPE", async () => {
    await expect(
      bindUserAsServer._handler(dbWithCtx("publishable"), {
        apiKey: "k",
        purchaseToken: "t",
        userId: "u",
      }),
    ).rejects.toSatisfy(
      (error: unknown) =>
        (error as { data?: { code?: string } }).data?.code ===
        "INSUFFICIENT_SCOPE",
    );
  });

  it("accepts a secret key", async () => {
    await expect(
      bindUserAsServer._handler(dbWithCtx("secret"), {
        apiKey: "k",
        purchaseToken: "t",
        userId: "u",
      }),
    ).resolves.toEqual({ ok: true, bound: false });
  });

  function dbWithCtx(keyType: "publishable" | "secret") {
    return { db: dbWith(keyType) } as never;
  }
});
