import { describe, expect, it } from "vitest";

import { testableFunction } from "../test.setup";
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
  };
  const organization = { _id: "organizations_1", _creationTime: 0 };

  const dbWith = (keyType?: "publishable" | "secret") => ({
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
            unique: async () => null,
            collect: async () => [],
          };
        },
      };
      return api;
    },
    async patch() {},
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
