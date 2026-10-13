import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({ getAuthUserId: vi.fn() }));
vi.mock("@convex-dev/auth/server", () => ({
  getAuthUserId: authMocks.getAuthUserId,
}));

import {
  normalizeAndroidPackageName,
  normalizeAppAppleId,
  updateProject as registeredUpdateProject,
} from "./mutation";
import type { Id } from "../_generated/dataModel";
import { testableFunction } from "../test.setup";

const updateProject = testableFunction(registeredUpdateProject);
const PROJECT_ID = "projects_a" as Id<"projects">;

describe("updateProject role boundary", () => {
  type Row = Record<string, unknown> & { _id: string };

  function makeCtx(role: "owner" | "admin" | "member") {
    const rows: Row[] = [
      { _id: "organizations_a" },
      { _id: "projects_a", organizationId: "organizations_a", name: "App" },
      {
        _id: "members_a",
        organizationId: "organizations_a",
        userId: "users_a",
        role,
      },
    ];
    const db = {
      get: async (id: string) => rows.find((row) => row._id === id) ?? null,
      query: () => ({
        withIndex: () => ({
          first: async () => rows.find((row) => row._id === "members_a"),
        }),
      }),
      patch: vi.fn(async (id: string, value: Record<string, unknown>) => {
        Object.assign(rows.find((row) => row._id === id) ?? {}, value);
      }),
    };
    return { ctx: { db }, db };
  }

  beforeEach(() => {
    authMocks.getAuthUserId.mockResolvedValue("users_a");
  });

  it.each([
    { amazonSharedSecret: "shared-secret" },
    { horizonAppSecret: "0123456789abcdef0123" },
    { iosBundleId: "com.example.other" },
    { androidPackageName: "com.example.other" },
    { iosAppStoreKeyId: "ABCDE12345" },
    { amazonSandboxEnabled: true },
  ])("rejects a member changing %o", async (field) => {
    const { ctx, db } = makeCtx("member");

    await expect(
      updateProject._handler(ctx, { projectId: PROJECT_ID, ...field }),
    ).rejects.toThrow();
    expect(db.patch).not.toHaveBeenCalled();
  });

  it("still lets a member rename the project", async () => {
    const { ctx, db } = makeCtx("member");

    await updateProject._handler(ctx, {
      projectId: PROJECT_ID,
      name: "Renamed",
    });

    expect(db.patch).toHaveBeenCalledWith(
      "projects_a",
      expect.objectContaining({ name: "Renamed" }),
    );
  });

  it("lets an admin change store credentials", async () => {
    const { ctx, db } = makeCtx("admin");

    await updateProject._handler(ctx, {
      projectId: PROJECT_ID,
      amazonSharedSecret: "shared-secret",
    });

    expect(db.patch).toHaveBeenCalledOnce();
  });
});

describe("normalizeAndroidPackageName", () => {
  it("trims whitespace without changing capitalization", () => {
    expect(normalizeAndroidPackageName("  com.markhub.Markly  ")).toBe(
      "com.markhub.Markly",
    );
  });

  it("allows correcting capitalization for a saved package name", () => {
    expect(
      normalizeAndroidPackageName("com.markhub.Markly", "com.markhub.markly"),
    ).toBe("com.markhub.Markly");
  });

  it("rejects changing a saved project to a different package name", () => {
    expect(() =>
      normalizeAndroidPackageName("com.example.Other", "com.markhub.markly"),
    ).toThrow(
      "Android package name can only be updated to correct capitalization once saved.",
    );
  });
});

describe("normalizeAppAppleId", () => {
  it("accepts positive safe integers", () => {
    expect(normalizeAppAppleId(1234567890)).toBe(1_234_567_890);
  });

  it("rejects fractional, unsafe, and non-positive values", () => {
    expect(() => normalizeAppAppleId(123.45)).toThrow(
      "App Apple ID must be a positive safe integer.",
    );
    expect(() => normalizeAppAppleId(Number.MAX_SAFE_INTEGER + 1)).toThrow(
      "App Apple ID must be a positive safe integer.",
    );
    expect(() => normalizeAppAppleId(0)).toThrow(
      "App Apple ID must be a positive safe integer.",
    );
  });
});
