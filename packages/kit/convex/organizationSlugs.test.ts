// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ getAuthUserId: vi.fn() }));
vi.mock("@convex-dev/auth/server", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getAuthUserId: authMocks.getAuthUserId,
}));

import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

describe("createOrganization", () => {
  it("never takes a slug the app routes as a site page", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", { email: "owner@acme.test" }),
    );
    authMocks.getAuthUserId.mockResolvedValue(userId);
    const { slug } = await t.mutation(
      api.organizations.mutation.createOrganization,
      { name: "Pricing" },
    );
    expect(slug).toMatch(/^pricing-[a-z0-9]+$/);
  });
});
