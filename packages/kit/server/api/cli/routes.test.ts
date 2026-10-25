import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConvexError } from "convex/values";
import { getFunctionName } from "convex/server";
import type { Context } from "hono";
import { assertVerificationSource } from "../../../convex/purchases/verificationSource";
import {
  assertCliStartSource,
  withCliStartSource,
} from "../../../convex/cli/source";
import { APP_ERROR_SCOPE } from "../../../convex/utils/errors";

const transport = vi.hoisted(() => ({
  action: vi.fn(),
  mutation: vi.fn(),
  query: vi.fn(),
  error: vi.fn(),
  sourceLimited: false,
  ip: undefined as string | undefined,
}));
vi.mock("convex/browser", () => ({
  ConvexHttpClient: class {
    token?: string;
    setAuth(token: string) {
      this.token = token;
    }
    query(reference: unknown, args: unknown) {
      return transport.query(reference, args, this.token);
    }
    action = transport.action;
    mutation = transport.mutation;
  },
}));

vi.mock("../../convex", () => ({
  resolveServerConvexUrl: () => "https://test.convex.cloud",
  handleConvexError: transport.error,
}));
vi.mock("../v1/rate-limit", () => ({
  sourceRateLimitMiddleware:
    (options: {
      respond: (ctx: Context, result: { retryAfterSec: number }) => Response;
    }) =>
    async (ctx: Context, next: () => Promise<void>) =>
      transport.sourceLimited
        ? options.respond(ctx, { retryAfterSec: 3 })
        : next(),
  getRequestIp: () => transport.ip,
}));
import { prepareArguments, cliRoutes } from "./routes";
import operations from "../../../../cli/src/kit/operations.json";

describe("CLI HTTP contract", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    transport.sourceLimited = false;
    transport.ip = undefined;
    vi.stubEnv("IAPKIT_VERIFICATION_SOURCE_SECRET", "a".repeat(64));
    transport.error.mockReturnValue(null);
    transport.query.mockResolvedValue({ user: { _id: "fixture-user" } });
  });
  afterEach(() => vi.unstubAllEnvs());

  async function post(path: string, body: unknown, token = "fixture") {
    return await cliRoutes.request(path, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  }

  it("publishes the allowlisted schema without caching credentials", async () => {
    const response = await cliRoutes.request("/schema");
    expect(await response.json()).toEqual({ ok: true, data: operations });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("returns structured source-throttle metadata before authentication", async () => {
    transport.sourceLimited = true;
    const response = await post("/auth/device", {});
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "RATE_LIMITED", retryAfterSec: 3 },
    });
    expect(transport.mutation).not.toHaveBeenCalled();
  });

  it("starts browser approval at the configured site and preserves the user code", async () => {
    vi.stubEnv("SITE_URL", "https://kit.example.test/path");
    transport.ip = "203.0.113.7";
    transport.mutation.mockResolvedValue({
      userCode: "ABCD1234",
      deviceCode: "private",
    });
    const response = await post("/auth/device", {
      name: "CI setup",
      scope: "read",
      sourceKey: "caller-selected",
    });
    expect(response.status).toBe(200);
    expect(transport.mutation.mock.lastCall?.[1]).toMatchObject({
      name: "CI setup",
      scope: "read",
    });
    const sent = transport.mutation.mock.lastCall?.[1];
    const expected = await withCliStartSource(
      { name: "CI setup", scope: "read" },
      transport.ip,
    );
    expect(await assertCliStartSource(sent)).toBe(
      expected.sourceAuth.sourceKey,
    );
    const body = await response.json();
    expect(body).toMatchObject({
      data: {
        verificationUrl:
          "https://kit.example.test/cli/authorize?user_code=ABCD1234",
      },
    });
    expect(body.data.sourceAuth).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain(sent.sourceAuth.mac);
  });

  it("defaults browser approval to the request origin and admin scope", async () => {
    vi.stubEnv("SITE_URL", undefined);
    transport.mutation.mockResolvedValue({ userCode: "ABCD1234" });
    const response = await post("https://local.example.test/auth/device", {});
    expect(transport.mutation.mock.lastCall?.[1]).toMatchObject({
      name: "OpenIAP CLI",
      scope: "admin",
    });
    const expected = await withCliStartSource(
      { name: "OpenIAP CLI", scope: "admin" },
      "unknown",
    );
    expect(
      await assertCliStartSource(transport.mutation.mock.lastCall?.[1]),
    ).toBe(expected.sourceAuth.sourceKey);
    expect(await response.json()).toMatchObject({
      data: {
        verificationUrl:
          "https://local.example.test/cli/authorize?user_code=ABCD1234",
      },
    });
  });

  it("fails closed before starting a device login when source signing is unavailable", async () => {
    vi.stubEnv("IAPKIT_VERIFICATION_SOURCE_SECRET", undefined);
    const response = await post("/auth/device", {});
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "REQUEST_FAILED" },
    });
    expect(transport.mutation).not.toHaveBeenCalled();
  });

  it.each([
    ["/auth/device", [], "INVALID_INPUT"],
    ["/auth/device", { scope: "owner" }, "INVALID_INPUT"],
    ["/auth/token", {}, "INVALID_INPUT"],
    ["/auth/refresh", {}, "INVALID_INPUT"],
    ["/auth/unknown", {}, "NOT_FOUND"],
    ["/run", { command: "projects list" }, "INVALID_INPUT"],
  ])("validates %s before reaching Convex (%j)", async (path, body, code) => {
    const response = await post(path, body);
    expect(response.status).toBe(code === "NOT_FOUND" ? 404 : 400);
    expect(await response.json()).toMatchObject({ ok: false, error: { code } });
    expect(transport.action).not.toHaveBeenCalled();
    expect(transport.query).not.toHaveBeenCalled();
    expect(transport.mutation).not.toHaveBeenCalled();
  });

  it.each([
    [
      "/auth/token",
      { token: "automation" },
      { provider: "cli", params: { token: "automation" } },
    ],
    [
      "/auth/token",
      { deviceCode: "approved" },
      { provider: "cli", params: { deviceCode: "approved" } },
    ],
    ["/auth/refresh", { refreshToken: "refresh" }, { refreshToken: "refresh" }],
  ])("exchanges credentials through %s", async (path, body, expected) => {
    transport.action.mockResolvedValue({
      tokens: { token: "access", refreshToken: "next" },
    });
    const response = await post(path, body);
    expect(response.status).toBe(200);
    expect(transport.action.mock.lastCall?.[1]).toEqual(expected);
    expect(await response.json()).toEqual({
      ok: true,
      data: { token: "access", refreshToken: "next" },
    });
  });

  it("rejects a refresh that no longer resolves to a session", async () => {
    transport.action.mockResolvedValue({ tokens: null });
    const response = await post("/auth/refresh", { refreshToken: "revoked" });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: { code: "UNAUTHENTICATED" },
    });
  });

  it("keeps simultaneous requests on separate authenticated clients", async () => {
    const responses = await Promise.all(
      ["first", "second"].map((token) =>
        post(
          "/run",
          { command: "projects list", args: { organizationId: "org" } },
          token,
        ),
      ),
    );
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const calls = transport.query.mock.calls.filter(
      ([reference]) =>
        getFunctionName(reference) ===
        "projects/query:listOrganizationProjects",
    );
    expect(calls.map(([, args, token]) => ({ args, token }))).toEqual([
      { args: { organizationId: "org" }, token: "first" },
      { args: { organizationId: "org" }, token: "second" },
    ]);
  });

  it("dispatches a mutation only after session validation", async () => {
    transport.mutation.mockResolvedValue({ key: "one-time-secret" });
    const args = { projectId: "project", name: "Backend", keyType: "secret" };
    const response = await post("/run", { command: "keys create", args });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      data: { key: "one-time-secret" },
    });
    expect(transport.mutation.mock.lastCall?.[1]).toEqual(args);
  });

  it.each([{ user: null }, { user: { _id: "user" }, expiresAt: 0 }])(
    "rejects an inactive CLI session before writes (%j)",
    async (session) => {
      transport.query.mockResolvedValue(session);
      const response = await post("/run", { command: "keys create", args: {} });
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({
        error: { code: "SESSION_EXPIRED" },
      });
      expect(transport.mutation).not.toHaveBeenCalled();
    },
  );

  it.each(["apple", "google", "amazon", "horizon"] as const)(
    "signs %s verification arguments and derives the source IP on the server",
    async (store) => {
      vi.stubEnv("IAPKIT_VERIFICATION_SOURCE_SECRET", "a".repeat(64));
      transport.ip = "192.0.2.10";
      transport.action.mockResolvedValue({ isValid: true });
      const response = await post("/run", {
        command: `purchases verify ${store}`,
        args: { projectId: "project" },
      });
      expect(response.status).toBe(200);
      const signed = transport.action.mock.lastCall?.[1];
      const { sourceAuth, ...args } = signed;
      expect(args).toEqual({
        apiKey: "session-project:project",
        requestIp: "192.0.2.10",
      });
      expect(() =>
        assertVerificationSource(store, args, sourceAuth),
      ).not.toThrow();
    },
  );

  it.each([
    [new ConvexError("Not authenticated"), 401, "UNAUTHENTICATED"],
    [
      new ConvexError("Insufficient permissions for this operation"),
      403,
      "INSUFFICIENT_PERMISSIONS",
    ],
    [
      new ConvexError("Not a member of this organization"),
      403,
      "NOT_ORGANIZATION_MEMBER",
    ],
    [
      new ConvexError({
        scope: APP_ERROR_SCOPE,
        code: "PROJECT_NOT_FOUND",
        message: "Project missing",
      }),
      404,
      "PROJECT_NOT_FOUND",
    ],
    [
      new ConvexError({
        scope: APP_ERROR_SCOPE,
        code: "NOT_AUTHENTICATED",
        message: "Session missing",
      }),
      401,
      "UNAUTHENTICATED",
    ],
    [
      new ConvexError({
        scope: APP_ERROR_SCOPE,
        code: "RATE_LIMIT_EXCEEDED",
        message: "Wait",
      }),
      429,
      "RATE_LIMITED",
    ],
    [new Error("private backend detail"), 500, "REQUEST_FAILED"],
    [null, 500, "REQUEST_FAILED"],
  ])(
    "normalizes backend errors without disclosing unexpected details",
    async (error, status, code) => {
      transport.action.mockRejectedValue(error);
      const response = await post("/auth/token", { deviceCode: "device" });
      expect(response.status).toBe(status);
      const result = await response.json();
      expect(result).toMatchObject({ ok: false, error: { code } });
      expect(JSON.stringify(result)).not.toContain("private backend detail");
    },
  );

  it("preserves retry guidance from the shared Convex error mapper", async () => {
    transport.error.mockReturnValue({
      code: "RATE_LIMIT_EXCEEDED",
      message: "Wait",
      retryAfterSec: 7,
    });
    transport.action.mockRejectedValue(new Error("backend"));
    const response = await post("/auth/token", { deviceCode: "device" });
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      error: { code: "RATE_LIMITED", retryAfterSec: 7 },
    });
  });

  it("distinguishes invalid automation tokens from pending browser approval", async () => {
    transport.action.mockResolvedValue({ tokens: null });
    const invalid = await cliRoutes.request("/auth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: "fixture-invalid" }),
    });
    expect(invalid.status).toBe(401);
    expect(await invalid.json()).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
    const pending = await cliRoutes.request("/auth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceCode: "fixture-pending" }),
    });
    expect(pending.status).toBe(428);
    expect(await pending.json()).toMatchObject({
      ok: false,
      error: { code: "AUTHORIZATION_PENDING" },
    });
  });

  it("normalizes component throttling into CLI retry metadata", async () => {
    transport.action.mockRejectedValue(
      new ConvexError({ kind: "RateLimited", retryAfter: 1500 }),
    );
    const response = await cliRoutes.request("/auth/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceCode: "fixture-rate" }),
    });
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "RATE_LIMITED", retryAfterSec: 2 },
    });
  });
  it("rejects a caller-selected Convex function and missing authentication", async () => {
    const response = await cliRoutes.request("/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ command: "internal.drain", args: {} }),
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
    const unknown = await cliRoutes.request("/run", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer fixture",
      },
      body: JSON.stringify({ command: "internal.drain", args: {} }),
    });
    expect(await unknown.json()).toMatchObject({
      ok: false,
      error: { code: "UNKNOWN_COMMAND" },
    });
  });

  it("supplies session project access and strips the transport-only project selector", () => {
    const op = operations.find((entry) => entry.command === "products list")!;
    expect(prepareArguments(op, { projectId: "p", limit: 20 }, false)).toEqual({
      apiKey: "session-project:p",
      limit: 20,
    });
    expect(() => prepareArguments(op, { limit: 20 }, false)).toThrow(
      "Select a project",
    );
    expect(() =>
      prepareArguments(op, { projectId: "p", sourceAuth: {} }, false),
    ).toThrow("reserved");
  });

  it("checks destructive confirmation and defaults sync to a dry run on the server", () => {
    const revoke = operations.find((entry) => entry.command === "keys revoke")!;
    expect(() => prepareArguments(revoke, { keyId: "k" }, false)).toThrow(
      "--yes",
    );
    const sync = operations.find((entry) => entry.command === "sync products")!;
    expect(
      prepareArguments(sync, { projectId: "p", platform: "IOS" }, false),
    ).toMatchObject({ dryRun: true });
    expect(() =>
      prepareArguments(
        sync,
        { projectId: "p", platform: "IOS", dryRun: false },
        false,
      ),
    ).toThrow("--apply --yes");
  });

  it("uses account authorization for member-readable operations", () => {
    const op = operations.find((entry) => entry.command === "issues list")!;
    const paginationOpts = { numItems: 25, cursor: null };
    expect(
      prepareArguments(op, { projectId: "p", paginationOpts }, false),
    ).toEqual({ projectId: "p", paginationOpts });
  });
});
