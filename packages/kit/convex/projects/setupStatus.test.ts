import { beforeEach, describe, expect, it, vi } from "vitest";

const projectMocks = vi.hoisted(() => ({
  byApiKey: vi.fn(),
  byProjectId: vi.fn(),
}));

vi.mock("./helpers", () => ({
  resolveProjectByApiKeyFromDb: projectMocks.byApiKey,
  resolveProjectByIdForCurrentUserFromDb: projectMocks.byProjectId,
}));

import { getSetupStatus as registeredGetSetupStatus } from "./setupStatus";
import { testableFunction } from "../test.setup";

const getSetupStatus = testableFunction(registeredGetSetupStatus);

const ctx = {
  db: {
    get: vi.fn(),
    query: vi.fn(() => ({
      withIndex: vi.fn(() => ({
        collect: vi.fn().mockResolvedValue([]),
      })),
    })),
  },
};

function project(overrides: Record<string, unknown> = {}) {
  return {
    _id: "projects_test",
    organizationId: "organizations_test",
    iosBundleId: "com.example.app",
    iosAppAppleId: "123456789",
    iosAppStoreIssuerId: "issuer_test",
    iosAppStoreKeyId: "key_test",
    androidPackageName: "com.example.app",
    googlePlayServiceAccountFileId: null,
    horizonEnabled: true,
    horizonAppId: "horizon_app",
    horizonAppSecret: "horizon_secret",
    ...overrides,
  };
}

describe("getSetupStatus Amazon readiness", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ctx.db.get.mockResolvedValue(null);
  });

  it("treats an explicit sandbox-only project as configured", async () => {
    projectMocks.byProjectId.mockResolvedValue({
      project: project({
        amazonSandboxEnabled: true,
        amazonSharedSecret: undefined,
      }),
    });

    const result = await getSetupStatus._handler(ctx, {
      projectId: "projects_test" as never,
    });

    expect(result.amazon).toEqual({ configured: true, missing: [] });
  });

  it("keeps Amazon unconfigured when neither readiness path is enabled", async () => {
    projectMocks.byProjectId.mockResolvedValue({
      project: project({
        amazonSandboxEnabled: undefined,
        amazonSharedSecret: undefined,
      }),
    });

    const result = await getSetupStatus._handler(ctx, {
      projectId: "projects_test" as never,
    });

    expect(result.amazon).toEqual({
      configured: false,
      missing: ["amazonSharedSecret"],
    });
  });

  it("requires the Play service account before Android is ready", async () => {
    projectMocks.byProjectId.mockResolvedValue({ project: project() });

    const result = await getSetupStatus._handler(ctx, {
      projectId: "projects_test" as never,
    });
    expect(result.android).toEqual({
      configured: false,
      missing: ["googleServiceAccount"],
    });
  });

  it("marks Android ready when package name and Play credentials exist", async () => {
    projectMocks.byProjectId.mockResolvedValue({
      project: project({ googlePlayServiceAccountFileId: "files_google" }),
    });
    ctx.db.get.mockResolvedValueOnce({
      _id: "files_google",
      projectId: "projects_test",
      purpose: "android_service_account",
    });
    ctx.db.query.mockReturnValueOnce({
      withIndex: vi.fn(() => ({
        collect: vi.fn().mockResolvedValue([]),
      })),
    });

    const result = await getSetupStatus._handler(ctx, {
      projectId: "projects_test" as never,
    });
    expect(result.android).toEqual({ configured: true, missing: [] });
  });

  it("ignores stale credential rows after the active pointer is revoked", async () => {
    projectMocks.byProjectId.mockResolvedValue({ project: project() });
    ctx.db.query.mockReturnValueOnce({
      withIndex: vi.fn(() => ({
        collect: vi
          .fn()
          .mockResolvedValue([{ purpose: "android_service_account" }]),
      })),
    });

    const result = await getSetupStatus._handler(ctx, {
      projectId: "projects_test" as never,
    });
    expect(result.googleServiceAccountUploaded).toBe(false);
    expect(result.android.configured).toBe(false);
  });
});
