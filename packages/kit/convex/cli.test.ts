// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import rateLimiter from "@convex-dev/rate-limiter/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { sha256Hex } from "./utils/sha256";
import { generateKeyPairSync } from "node:crypto";

const modules = import.meta.glob("./**/*.ts");

async function fixture() {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", {
      name: "CLI Test",
      email: "cli-test@example.invalid",
    }),
  );
  const browser = t.withIdentity({
    subject: `${userId}|browser`,
    issuer: "https://test.convex.site",
  });
  const org = await browser.mutation(
    api.organizations.mutation.createOrganization,
    { name: "CLI test" },
  );
  return { t, userId, browser, org };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("IAPKit CLI authentication", () => {
  it("issues and refreshes scoped Convex JWTs after browser approval", async () => {
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" },
    });
    vi.stubEnv("JWT_PRIVATE_KEY", privateKey);
    vi.stubEnv("CONVEX_SITE_URL", "https://test.convex.site");
    const { t, browser, userId } = await fixture();
    const device = await t.mutation(api.cli.mutation.start, {
      name: "JWT test",
      scope: "read",
    });
    await browser.mutation(api.cli.mutation.approve, {
      userCode: device.userCode,
      allow: true,
    });
    const result = await t.action(api.auth.signIn, {
      provider: "cli",
      params: { deviceCode: device.deviceCode },
    });
    expect(result.tokens).not.toBeNull();
    const claims = JSON.parse(
      Buffer.from(result.tokens!.token.split(".")[1], "base64url").toString(),
    );
    expect(claims.iapkitCli).toBe(true);
    expect(claims.sub).toMatch(new RegExp(`^${userId}\\|`));
    const refreshed = await t.action(api.auth.signIn, {
      refreshToken: result.tokens!.refreshToken,
    });
    const next = JSON.parse(
      Buffer.from(
        refreshed.tokens!.token.split(".")[1],
        "base64url",
      ).toString(),
    );
    expect(next.iapkitCli).toBe(true);
    expect(next.sub).toBe(claims.sub);
  });
  it("requires browser approval, consumes a device code once and stores hashes", async () => {
    const { t, browser, userId } = await fixture();
    const device = await t.mutation(api.cli.mutation.start, {
      name: "test terminal",
      scope: "admin",
    });
    expect(
      await t.mutation(internal.cli.internal.consume, {
        deviceCode: device.deviceCode,
      }),
    ).toBeNull();
    await browser.mutation(api.cli.mutation.approve, {
      userCode: device.userCode,
      allow: true,
    });
    const credentials = await t.mutation(internal.cli.internal.consume, {
      deviceCode: device.deviceCode,
    });
    expect(credentials?.userId).toBe(userId);
    const grants = await t.run((ctx) => ctx.db.query("cliSessions").collect());
    expect(grants[0].scope).toBe("admin");
    expect(JSON.stringify(grants)).not.toContain(device.deviceCode);
    await expect(
      t.mutation(internal.cli.internal.consume, {
        deviceCode: device.deviceCode,
      }),
    ).rejects.toThrow();
  });

  it("denied and expired login codes never issue a session", async () => {
    const { t, browser } = await fixture();
    const denied = await t.mutation(api.cli.mutation.start, {
      name: "denied",
      scope: "read",
    });
    await browser.mutation(api.cli.mutation.approve, {
      userCode: denied.userCode,
      allow: false,
    });
    await expect(
      t.mutation(internal.cli.internal.consume, {
        deviceCode: denied.deviceCode,
      }),
    ).rejects.toThrow("ACCESS_DENIED");
    const expired = await t.mutation(api.cli.mutation.start, {
      name: "expired",
      scope: "read",
    });
    vi.useFakeTimers();
    vi.setSystemTime(expired.expiresAt + 1);
    await expect(
      t.mutation(internal.cli.internal.consume, {
        deviceCode: expired.deviceCode,
      }),
    ).rejects.toThrow("EXPIRED_TOKEN");
  });

  it("invalid approval attempts consume the per-user rate limit", async () => {
    const { browser } = await fixture();
    for (let index = 0; index < 10; index++) {
      const result = await browser.mutation(api.cli.mutation.approve, {
        userCode: "not-valid",
        allow: true,
      });
      expect(result.approved).toBe(false);
    }
    await expect(
      browser.mutation(api.cli.mutation.approve, {
        userCode: "not-valid",
        allow: true,
      }),
    ).rejects.toThrow();
  });

  it("read scope is enforced on direct Convex writes and cannot mint stronger tokens", async () => {
    const { t, browser, userId } = await fixture();
    const token = await browser.mutation(api.cli.mutation.createToken, {
      name: "Read CI",
      scope: "read",
      expiresInDays: 1,
    });
    const credentials = await t.mutation(internal.cli.internal.consume, {
      token: token.token,
    });
    expect(credentials).not.toBeNull();
    const cli = t.withIdentity({
      subject: `${userId}|${credentials!.sessionId}`,
      issuer: "https://test.convex.site",
      iapkitCli: true,
    });
    expect(
      await cli.query(api.organizations.query.getUserOrganizations),
    ).toHaveLength(1);
    await expect(
      cli.mutation(api.organizations.mutation.createOrganization, {
        name: "Forbidden",
      }),
    ).rejects.toThrow("INSUFFICIENT_SCOPE");
    await expect(
      cli.mutation(api.cli.mutation.createToken, {
        name: "Escalation",
        scope: "admin",
        expiresInDays: 1,
      }),
    ).rejects.toThrow("INSUFFICIENT_SCOPE");
    const grant = await t.run((ctx) => ctx.db.get(token.id));
    expect(grant?.tokenHash).toBe(await sha256Hex(token.token));
    expect(JSON.stringify(grant)).not.toContain(token.token);
  });

  it("revocation immediately rejects existing access identities and token exchange", async () => {
    const { t, browser, userId } = await fixture();
    const token = await browser.mutation(api.cli.mutation.createToken, {
      name: "CI",
      scope: "admin",
      expiresInDays: 7,
    });
    const credentials = await t.mutation(internal.cli.internal.consume, {
      token: token.token,
    });
    const cli = t.withIdentity({
      subject: `${userId}|${credentials!.sessionId}`,
      issuer: "https://test.convex.site",
      iapkitCli: true,
    });
    await browser.mutation(api.cli.mutation.revoke, { id: token.id });
    await expect(cli.query(api.cli.query.session)).rejects.toThrow(
      "UNAUTHENTICATED",
    );
    expect(
      await t.mutation(internal.cli.internal.consume, { token: token.token }),
    ).toBeNull();
    expect(await t.run((ctx) => ctx.db.get(credentials!.sessionId))).toBeNull();
  });

  it("session project references require an authenticated member and preserve key roles", async () => {
    const { t, browser, org } = await fixture();
    const project = await browser.mutation(
      api.projects.mutation.createProject,
      { organizationId: org.organizationId, name: "CLI app" },
    );
    const projectId = project.projectId;
    const result = await browser.query(api.products.query.listProductsPage, {
      apiKey: `session-project:${projectId}`,
    });
    expect(result.products).toEqual([]);
    const anonymous = await t.query(api.products.query.listProductsPage, {
      apiKey: `session-project:${projectId}`,
    });
    expect(anonymous.products).toEqual([]);
  });

  it("expired grants reject direct mutations before the expiration worker runs", async () => {
    const { t, browser, userId } = await fixture();
    const token = await browser.mutation(api.cli.mutation.createToken, {
      name: "Expiring",
      scope: "admin",
      expiresInDays: 1,
    });
    const credentials = await t.mutation(internal.cli.internal.consume, {
      token: token.token,
    });
    await t.run((ctx) => ctx.db.patch(token.id, { expiresAt: Date.now() - 1 }));
    const cli = t.withIdentity({
      subject: `${userId}|${credentials!.sessionId}`,
      issuer: "https://test.convex.site",
      iapkitCli: true,
    });
    await expect(
      cli.mutation(api.organizations.mutation.createOrganization, {
        name: "Too late",
      }),
    ).rejects.toThrow("SESSION_EXPIRED");
  });

  it("a missing auth session rejects both actions and automation token exchange", async () => {
    const { t, browser, userId, org } = await fixture();
    const project = await browser.mutation(
      api.projects.mutation.createProject,
      { organizationId: org.organizationId, name: "Test" },
    );
    const token = await browser.mutation(api.cli.mutation.createToken, {
      name: "Signed out",
      scope: "admin",
      expiresInDays: 1,
    });
    const credentials = await t.mutation(internal.cli.internal.consume, {
      token: token.token,
    });
    await t.run((ctx) => ctx.db.delete(credentials!.sessionId));
    const cli = t.withIdentity({
      subject: `${userId}|${credentials!.sessionId}`,
      issuer: "https://test.convex.site",
      iapkitCli: true,
    });
    await expect(
      cli.action(api.orders.action.lookupOrder, {
        projectId: project.projectId,
        store: "apple",
        orderId: "fixture-order",
      }),
    ).rejects.toThrow("UNAUTHENTICATED");
    expect(
      await t.mutation(internal.cli.internal.consume, { token: token.token }),
    ).toBeNull();
  });

  it("purge dry runs retain catalog rows and report planned deletions", async () => {
    const { t, browser, org } = await fixture();
    const { projectId } = await browser.mutation(
      api.projects.mutation.createProject,
      { organizationId: org.organizationId, name: "Purge preview" },
    );
    await browser.mutation(api.products.mutation.upsertProduct, {
      projectId,
      productId: "premium",
      platform: "IOS",
      type: "NonConsumable",
      title: "Premium",
    });
    const { jobId } = await browser.mutation(
      api.products.jobs.enqueueProductSync,
      { projectId, platform: "IOS", direction: "purge-local", dryRun: true },
    );
    await t.finishAllScheduledFunctions(() => vi.runAllTimers());
    const result = await browser.query(api.products.query.listProductsPage, {
      apiKey: `session-project:${projectId}`,
    });
    expect(result.products).toHaveLength(1);
    const job = await browser.query(api.products.jobs.getSyncJobById, {
      apiKey: `session-project:${projectId}`,
      jobId,
    });
    expect(job?.result?.deleted).toBe(0);
    expect(job?.result?.plannedWrites).toEqual([
      { productId: "premium", step: "purge-local" },
    ]);
  });

  it("read-only CLI members retain the dashboard's redacted operations reads", async () => {
    const { t, browser, org } = await fixture();
    const { projectId } = await browser.mutation(
      api.projects.mutation.createProject,
      { organizationId: org.organizationId, name: "Member reads" },
    );
    const memberId = await t.run(async (ctx) => {
      const id = await ctx.db.insert("users", { name: "Member" });
      await ctx.db.insert("organizationMembers", {
        organizationId: org.organizationId,
        userId: id,
        role: "member",
        joinedAt: Date.now(),
        updatedAt: Date.now(),
      });
      return id;
    });
    const memberBrowser = t.withIdentity({
      subject: `${memberId}|browser`,
      issuer: "https://test.convex.site",
    });
    const token = await memberBrowser.mutation(api.cli.mutation.createToken, {
      name: "Member CI",
      scope: "read",
      expiresInDays: 1,
    });
    const credentials = await t.mutation(internal.cli.internal.consume, {
      token: token.token,
    });
    const cli = t.withIdentity({
      subject: `${memberId}|${credentials!.sessionId}`,
      issuer: "https://test.convex.site",
      iapkitCli: true,
    });
    const result = await cli.query(
      api.purchaseIssues.query.listPurchaseIssues,
      { projectId, paginationOpts: { numItems: 25, cursor: null } },
    );
    expect(result.page).toEqual([]);
    const deliveries = await cli.query(
      api.commerce.deliveryState.listDeliveries,
      { projectId, paginationOpts: { numItems: 25, cursor: null } },
    );
    expect(deliveries.page).toEqual([]);
  });
});
