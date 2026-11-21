// @vitest-environment edge-runtime
/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import rateLimiter from "@convex-dev/rate-limiter/test";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import { grantApiKey, oauthServerProof } from "./oauth/grants";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");
const proof = async () => (await oauthServerProof())!;

const VERIFIER = "v".repeat(64);
const CHALLENGE = createHash("sha256").update(VERIFIER).digest("base64url");
const CLAUDE = {
  clientId: "https://claude.ai/oauth/mcp-oauth-client-metadata",
  redirectUri: "https://claude.ai/api/mcp/auth_callback",
};
const REQUEST = {
  responseType: "code",
  ...CLAUDE,
  codeChallenge: CHALLENGE,
  codeChallengeMethod: "S256",
  resource: "https://kit.openiap.dev/mcp",
};

async function fixture() {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  const userId = await t.run((ctx) =>
    ctx.db.insert("users", { name: "Owner", email: "owner@example.invalid" }),
  );
  const owner = t.withIdentity({
    subject: `${userId}|browser`,
    issuer: "https://test.convex.site",
  });
  const org = await owner.mutation(
    api.organizations.mutation.createOrganization,
    { name: "OAuth test" },
  );
  const project = await owner.mutation(api.projects.mutation.createProject, {
    organizationId: org.organizationId,
    name: "App",
  });
  return {
    t,
    userId,
    owner,
    organizationId: org.organizationId,
    projectId: project.projectId,
  };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

async function code(
  f: Fixture,
  scope: "read" | "write" = "read",
): Promise<string> {
  const { redirectTo } = await f.owner.mutation(api.oauth.mutation.approve, {
    request: REQUEST,
    state: "s1",
    allow: true,
    projectId: f.projectId,
    scope,
  });
  return new URL(redirectTo).searchParams.get("code")!;
}

async function connect(f: Fixture, scope: "read" | "write" = "read") {
  const tokens = await f.t.mutation(api.oauth.mutation.exchange, {
    server: await proof(),
    code: await code(f, scope),
    codeVerifier: VERIFIER,
    ...CLAUDE,
  });
  if (!tokens) throw new Error("exchange failed");
  return tokens;
}

async function reaches(f: Fixture, accessToken: string): Promise<boolean> {
  const grant = await f.t.query(api.oauth.query.authenticate, {
    server: await proof(),
    accessToken,
  });
  if (!grant) return false;
  const status = await f.t.query(api.projects.setupStatus.getSetupStatus, {
    apiKey: (await grantApiKey(grant))!,
  });
  return status.found && status.projectId === f.projectId;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("IAPKIT_VERIFICATION_SOURCE_SECRET", "a".repeat(64));
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("OAuth connectors", () => {
  it("connects a project and returns to the connector with code, state and iss", async () => {
    const f = await fixture();
    const { redirectTo } = await f.owner.mutation(api.oauth.mutation.approve, {
      request: REQUEST,
      state: "s1",
      allow: true,
      projectId: f.projectId,
    });
    const url = new URL(redirectTo);
    expect(url.origin + url.pathname).toBe(CLAUDE.redirectUri);
    expect(url.searchParams.get("state")).toBe("s1");
    expect(url.searchParams.get("iss")).toBe("https://kit.openiap.dev");

    const tokens = await f.t.mutation(api.oauth.mutation.exchange, {
      server: await proof(),
      code: url.searchParams.get("code")!,
      codeVerifier: VERIFIER,
      ...CLAUDE,
    });
    expect(tokens).toMatchObject({
      token_type: "Bearer",
      expires_in: 3600,
      scope: "iapkit:read",
    });
    expect(await reaches(f, tokens!.access_token)).toBe(true);
    expect(
      await f.owner.query(api.oauth.query.listProjectGrants, {
        projectId: f.projectId,
      }),
    ).toMatchObject([{ clientName: "Claude", scope: "read" }]);
  });

  it("returns access_denied without a code when the user cancels", async () => {
    const f = await fixture();
    const { redirectTo } = await f.owner.mutation(api.oauth.mutation.approve, {
      request: REQUEST,
      allow: false,
    });
    const params = new URL(redirectTo).searchParams;
    expect(params.get("error")).toBe("access_denied");
    expect(params.has("code")).toBe(false);
  });

  it.each([
    ["an unlisted client", { clientId: "https://evil.example/client.json" }],
    [
      "an unlisted redirect",
      { redirectUri: "https://claude.ai.evil.example/api/mcp/auth_callback" },
    ],
    [
      "another client's redirect",
      { redirectUri: "https://chatgpt.com/connector_platform_oauth_redirect" },
    ],
    ["a plain PKCE challenge", { codeChallengeMethod: "plain" }],
    ["a missing challenge", { codeChallenge: undefined }],
    ["an implicit flow", { responseType: "token" }],
    ["another resource", { resource: "https://kit.openiap.dev/v1" }],
    ["another Claude document", { clientId: "https://claude.ai/oauth/other" }],
    ["a Claude ID with a suffix", { clientId: `${CLAUDE.clientId}?x` }],
    [
      "a Claude ID inside another URL",
      { clientId: `https://evil.example/?${CLAUDE.clientId}` },
    ],
    [
      "a Claude look-alike host",
      { clientId: "https://claudexai/oauth/mcp-oauth-client-metadata" },
    ],
    [
      "ChatGPT's shared ID with a suffix",
      {
        clientId: "https://chatgpt.com/oauth/client.json#x",
        redirectUri: "https://chatgpt.com/connector_platform_oauth_redirect",
      },
    ],
    [
      "ChatGPT's shared ID inside another URL",
      {
        clientId: "https://evil.example/https://chatgpt.com/oauth/client.json",
        redirectUri: "https://chatgpt.com/connector_platform_oauth_redirect",
      },
    ],
    [
      "a per-app ChatGPT ID with a suffix",
      {
        clientId: "https://chatgpt.com/oauth/abc/client.json.evil",
        redirectUri: "https://chatgpt.com/connector/oauth/abc",
      },
    ],
    [
      "a per-app ChatGPT ID inside another URL",
      {
        clientId:
          "https://evil.example/https://chatgpt.com/oauth/abc/client.json",
        redirectUri: "https://chatgpt.com/connector/oauth/abc",
      },
    ],
    [
      "a per-app ChatGPT ID that walks the callback path",
      {
        clientId: "https://chatgpt.com/oauth/a/../b/client.json",
        redirectUri: "https://chatgpt.com/connector/oauth/a/../b",
      },
    ],
    [
      "an overlong per-app ChatGPT ID",
      {
        clientId: `https://chatgpt.com/oauth/${"a".repeat(129)}/client.json`,
        redirectUri: `https://chatgpt.com/connector/oauth/${"a".repeat(129)}`,
      },
    ],
    ["a challenge with a stray prefix", { codeChallenge: `!${CHALLENGE}` }],
    ["an overlong challenge", { codeChallenge: `${CHALLENGE}A` }],
    [
      "ChatGPT's shared client with a per-app redirect",
      {
        clientId: "https://chatgpt.com/oauth/client.json",
        redirectUri: "https://chatgpt.com/connector/oauth/abc",
      },
    ],
    [
      "a per-app ChatGPT client with another app's redirect",
      {
        clientId: "https://chatgpt.com/oauth/abc/client.json",
        redirectUri: "https://chatgpt.com/connector/oauth/xyz",
      },
    ],
  ])("refuses %s", async (_name, override) => {
    const f = await fixture();
    await expect(
      f.owner.mutation(api.oauth.mutation.approve, {
        request: { ...REQUEST, ...override },
        allow: true,
        projectId: f.projectId,
      }),
    ).rejects.toThrow();
    expect(
      await f.owner.query(api.oauth.query.authorizationRequest, {
        request: { ...REQUEST, ...override },
      }),
    ).toMatchObject({ error: expect.any(String) });
  });

  it("accepts both ChatGPT redirect forms", async () => {
    const f = await fixture();
    for (const [clientId, redirectUri] of [
      [
        "https://chatgpt.com/oauth/client.json",
        "https://chatgpt.com/connector_platform_oauth_redirect",
      ],
      [
        "https://chatgpt.com/oauth/abc_123/client.json",
        "https://chatgpt.com/connector/oauth/abc_123",
      ],
    ]) {
      const details = await f.owner.query(
        api.oauth.query.authorizationRequest,
        {
          request: { ...REQUEST, clientId, redirectUri },
        },
      );
      expect(details).toMatchObject({ clientName: "ChatGPT" });
    }
  });

  it("lets only owners and admins connect, and only signed-in browsers", async () => {
    const f = await fixture();
    const memberId = await f.t.run(async (ctx) => {
      const id = await ctx.db.insert("users", { name: "Member" });
      await ctx.db.insert("organizationMembers", {
        organizationId: f.organizationId,
        userId: id,
        role: "member",
        joinedAt: 0,
        updatedAt: 0,
      });
      return id;
    });
    const member = f.t.withIdentity({
      subject: `${memberId}|browser`,
      issuer: "https://test.convex.site",
    });
    const args = { request: REQUEST, allow: true, projectId: f.projectId };
    await expect(
      member.mutation(api.oauth.mutation.approve, args),
    ).rejects.toThrow();
    await expect(
      f.t.mutation(api.oauth.mutation.approve, args),
    ).rejects.toThrow();
    expect(
      await member.query(api.oauth.query.authorizationRequest, {
        request: REQUEST,
      }),
    ).toMatchObject({ projects: [] });
    expect(
      await member.query(api.oauth.query.listProjectGrants, {
        projectId: f.projectId,
      }),
    ).toEqual([]);
  });

  it("spends a code once and checks verifier, client, redirect, resource and expiry", async () => {
    const f = await fixture();
    const good = { codeVerifier: VERIFIER, ...CLAUDE };
    const exchange = async (
      args: { code: string; resource?: string } & Partial<typeof good>,
    ) =>
      f.t.mutation(api.oauth.mutation.exchange, {
        server: await proof(),
        ...good,
        ...args,
      });

    const spent = await code(f);
    expect(await exchange({ code: spent })).not.toBeNull();
    expect(await exchange({ code: spent })).toBeNull();

    for (const wrong of [
      { codeVerifier: "w".repeat(64) },
      { clientId: "https://claude.ai/oauth/other" },
      { redirectUri: "https://chatgpt.com/connector_platform_oauth_redirect" },
      { resource: "https://example.com/mcp" },
    ]) {
      const fresh = await code(f);
      expect(await exchange({ code: fresh, ...wrong })).toBeNull();
      // The failed attempt spent it too.
      expect(await exchange({ code: fresh })).toBeNull();
    }

    const stale = await code(f);
    vi.advanceTimersByTime(61_000);
    expect(await exchange({ code: stale })).toBeNull();
  });

  it("rotates tokens on refresh and revokes the grant when any old one returns", async () => {
    const f = await fixture();
    const refresh = async (refreshToken: string) =>
      f.t.mutation(api.oauth.mutation.refresh, {
        server: await proof(),
        refreshToken,
      });
    const first = await connect(f, "write");
    const second = await f.t.mutation(api.oauth.mutation.refresh, {
      server: await proof(),
      refreshToken: first.refresh_token,
      clientId: CLAUDE.clientId,
    });
    expect(second).toMatchObject({ scope: "iapkit:read iapkit:write" });
    expect(await reaches(f, first.access_token)).toBe(false);
    expect(await reaches(f, second!.access_token)).toBe(true);
    // A thief rotates twice before the real client next refreshes.
    const third = await refresh(second!.refresh_token);
    expect(await reaches(f, third!.access_token)).toBe(true);

    expect(await refresh(first.refresh_token)).toBeNull();
    expect(await reaches(f, third!.access_token)).toBe(false);
    expect(await refresh(third!.refresh_token)).toBeNull();
  });

  it("ignores a refresh token it never issued", async () => {
    const f = await fixture();
    const tokens = await connect(f);
    const refresh = async (refreshToken: string) =>
      f.t.mutation(api.oauth.mutation.refresh, {
        server: await proof(),
        refreshToken,
      });
    expect(
      await refresh(`iapkit_ort_${"0".repeat(32)}_${"0".repeat(64)}`),
    ).toBeNull();
    expect(await refresh("iapkit_ort_short")).toBeNull();
    expect(await refresh("x".repeat(4096))).toBeNull();
    // Malformed tokens naming the real family neither refresh nor revoke.
    const family = tokens.refresh_token.slice(0, "iapkit_ort_".length + 32);
    for (const malformed of [
      ` ${tokens.refresh_token}`,
      `${tokens.refresh_token}x`,
      `${family}_short`,
    ])
      expect(await refresh(malformed)).toBeNull();
    expect(await reaches(f, tokens.access_token)).toBe(true);
  });

  it("records use at most every ten minutes, not on refresh", async () => {
    const f = await fixture();
    const tokens = await connect(f);
    const authenticate = async () =>
      f.t.query(api.oauth.query.authenticate, {
        server: await proof(),
        accessToken: tokens.access_token,
      });
    const lastUsedAt = async () =>
      (
        await f.owner.query(api.oauth.query.listProjectGrants, {
          projectId: f.projectId,
        })
      )[0].lastUsedAt;
    const connectedAt = await lastUsedAt();
    expect(await authenticate()).toMatchObject({ recordUse: false });
    vi.advanceTimersByTime(60 * 1000);
    await f.t.mutation(api.oauth.mutation.markUsed, {
      server: await proof(),
      accessToken: tokens.access_token,
    });
    expect(await lastUsedAt()).toBe(connectedAt);

    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(await authenticate()).toMatchObject({ recordUse: true });
    await f.t.mutation(api.oauth.mutation.markUsed, {
      server: await proof(),
      accessToken: tokens.access_token,
    });
    const usedAt = await lastUsedAt();
    expect(usedAt).toBeGreaterThan(connectedAt);
    expect(await authenticate()).toMatchObject({ recordUse: false });

    vi.advanceTimersByTime(30 * 60 * 1000);
    await f.t.mutation(api.oauth.mutation.refresh, {
      server: await proof(),
      refreshToken: tokens.refresh_token,
    });
    expect(await lastUsedAt()).toBe(usedAt);
  });

  it("revokes a grant whose refresh token another client presents", async () => {
    const f = await fixture();
    const tokens = await connect(f);
    expect(
      await f.t.mutation(api.oauth.mutation.refresh, {
        server: await proof(),
        refreshToken: tokens.refresh_token,
        clientId: "https://chatgpt.com/oauth/client.json",
      }),
    ).toBeNull();
    expect(await reaches(f, tokens.access_token)).toBe(false);
  });

  it("ends a grant whose refresh token lapsed even before cleanup runs", async () => {
    const f = await fixture();
    const tokens = await connect(f);
    await f.t.run(async (ctx) => {
      const grant = (await ctx.db.query("oauthGrants").first())!;
      await ctx.db.patch(grant._id, { refreshExpiresAt: Date.now() - 1 });
    });
    expect(
      await f.t.mutation(api.oauth.mutation.refresh, {
        server: await proof(),
        refreshToken: tokens.refresh_token,
      }),
    ).toBeNull();
    expect(
      await f.t.run((ctx) => ctx.db.query("oauthGrants").collect()),
    ).toEqual([]);
  });

  it("refuses a refresh after thirty days", async () => {
    const f = await fixture();
    const tokens = await connect(f);
    vi.advanceTimersByTime(30 * 24 * 60 * 60 * 1000);
    expect(
      await f.t.mutation(api.oauth.mutation.refresh, {
        server: await proof(),
        refreshToken: tokens.refresh_token,
      }),
    ).toBeNull();
  });

  it("stops an access token after an hour", async () => {
    const f = await fixture();
    const tokens = await connect(f);
    vi.advanceTimersByTime(59 * 60 * 1000);
    expect(await reaches(f, tokens.access_token)).toBe(true);
    vi.advanceTimersByTime(2 * 60 * 1000);
    expect(await reaches(f, tokens.access_token)).toBe(false);
  });

  it("ends access on revoke, disconnect, demotion and project deletion", async () => {
    const f = await fixture();
    const grantKey = async (accessToken: string) =>
      (await grantApiKey(
        (await f.t.query(api.oauth.query.authenticate, {
          server: await proof(),
          accessToken,
        }))!,
      ))!;
    const found = async (apiKey: string) =>
      (await f.t.query(api.projects.setupStatus.getSetupStatus, { apiKey }))
        .found;

    const revoked = await connect(f);
    const revokedKey = await grantKey(revoked.access_token);
    await f.t.mutation(api.oauth.mutation.revoke, {
      server: await proof(),
      token: revoked.refresh_token,
    });
    expect(await reaches(f, revoked.access_token)).toBe(false);
    expect(await found(revokedKey)).toBe(false);

    const disconnected = await connect(f);
    const [grant] = await f.owner.query(api.oauth.query.listProjectGrants, {
      projectId: f.projectId,
    });
    await expect(
      f.t.mutation(api.oauth.mutation.disconnect, { grantId: grant.id }),
    ).rejects.toThrow();
    await f.owner.mutation(api.oauth.mutation.disconnect, {
      grantId: grant.id,
    });
    expect(await reaches(f, disconnected.access_token)).toBe(false);

    const demoted = await connect(f);
    const demotedKey = await grantKey(demoted.access_token);
    await f.t.run(async (ctx) => {
      const membership = await ctx.db
        .query("organizationMembers")
        .withIndex("by_org_and_user", (q) =>
          q.eq("organizationId", f.organizationId).eq("userId", f.userId),
        )
        .unique();
      await ctx.db.patch(membership!._id, { role: "member" });
    });
    expect(await reaches(f, demoted.access_token)).toBe(false);
    expect(await found(demotedKey)).toBe(false);
    expect(
      await f.t.mutation(api.oauth.mutation.refresh, {
        server: await proof(),
        refreshToken: demoted.refresh_token,
      }),
    ).toBeNull();
    // Lost access is final: promoting the member back revives nothing.
    await f.t.run(async (ctx) => {
      const membership = await ctx.db
        .query("organizationMembers")
        .withIndex("by_org_and_user", (q) =>
          q.eq("organizationId", f.organizationId).eq("userId", f.userId),
        )
        .unique();
      await ctx.db.patch(membership!._id, { role: "owner" });
    });
    expect(await reaches(f, demoted.access_token)).toBe(false);
    expect(await found(demotedKey)).toBe(false);
  });

  it("serves the OAuth functions only to the IAPKit server", async () => {
    const f = await fixture();
    const tokens = await connect(f);
    const stale = await proof();
    vi.advanceTimersByTime(3 * 60 * 1000);
    const forged = { issuedAt: Date.now(), mac: "0".repeat(64) };
    const early = (await oauthServerProof(Date.now() + 60_000))!;
    for (const server of [forged, stale, early]) {
      await expect(
        f.t.query(api.oauth.query.authenticate, {
          server,
          accessToken: tokens.access_token,
        }),
      ).rejects.toThrow("UNAUTHENTICATED");
      await expect(
        f.t.mutation(api.oauth.mutation.refresh, {
          server,
          refreshToken: tokens.refresh_token,
        }),
      ).rejects.toThrow("UNAUTHENTICATED");
      await expect(
        f.t.mutation(api.oauth.mutation.exchange, {
          server,
          code: "iapkit_oac_x",
          codeVerifier: VERIFIER,
          ...CLAUDE,
        }),
      ).rejects.toThrow("UNAUTHENTICATED");
      await expect(
        f.t.mutation(api.oauth.mutation.revoke, {
          server,
          token: tokens.refresh_token,
        }),
      ).rejects.toThrow("UNAUTHENTICATED");
      await expect(
        f.t.mutation(api.oauth.mutation.markUsed, {
          server,
          accessToken: tokens.access_token,
        }),
      ).rejects.toThrow("UNAUTHENTICATED");
    }
    expect(await reaches(f, tokens.access_token)).toBe(true);
    vi.stubEnv("IAPKIT_VERIFICATION_SOURCE_SECRET", "");
    expect(await oauthServerProof()).toBeNull();
  });

  it("requires an RFC 7636 code verifier", async () => {
    const f = await fixture();
    for (const verifier of [
      "a",
      "v".repeat(42),
      "v".repeat(129),
      `${"v".repeat(42)}!`,
    ]) {
      const challenge = createHash("sha256")
        .update(verifier)
        .digest("base64url");
      const { redirectTo } = await f.owner.mutation(
        api.oauth.mutation.approve,
        {
          request: { ...REQUEST, codeChallenge: challenge },
          allow: true,
          projectId: f.projectId,
        },
      );
      expect(
        await f.t.mutation(api.oauth.mutation.exchange, {
          server: await proof(),
          code: new URL(redirectTo).searchParams.get("code")!,
          codeVerifier: verifier,
          ...CLAUDE,
        }),
      ).toBeNull();
    }
  });

  it("never lets a read-only grant's credential write", async () => {
    const f = await fixture();
    await f.t.run((ctx) =>
      ctx.db.insert("products", {
        projectId: f.projectId,
        platform: "IOS",
        productId: "premium",
        type: "NonConsumable",
        title: "Premium",
        state: "Active",
        updatedAt: 0,
      }),
    );
    const write = async (scope: "read" | "write") => {
      const tokens = await connect(f, scope);
      const grant = await f.t.query(api.oauth.query.authenticate, {
        server: await proof(),
        accessToken: tokens.access_token,
      });
      const apiKey = (await grantApiKey(grant!))!;
      // Reading still works.
      expect(
        (await f.t.query(api.projects.setupStatus.getSetupStatus, { apiKey }))
          .found,
      ).toBe(true);
      return f.t.mutation(
        api.products.mutation.upsertProductClientPayloadWithApiKey,
        {
          apiKey,
          platform: "IOS",
          productId: "premium",
          format: "json",
          body: "{}",
        },
      );
    };
    await expect(write("read")).rejects.toThrow();
    await expect(write("write")).resolves.toBeDefined();

    // Actions check write access through a query, which refuses it too.
    const operator = async (
      scope: "read" | "write",
      access: "read" | "write",
    ) => {
      const tokens = await connect(f, scope);
      const grant = await f.t.query(api.oauth.query.authenticate, {
        server: await proof(),
        accessToken: tokens.access_token,
      });
      return f.t.query(internal.projects.internal.getOperatorProject, {
        apiKey: (await grantApiKey(grant!))!,
        access,
      });
    };
    await expect(operator("read", "write")).rejects.toThrow("INVALID_API_KEY");
    await expect(operator("read", "read")).resolves.toMatchObject({
      _id: f.projectId,
    });
    await expect(operator("write", "write")).resolves.toMatchObject({
      _id: f.projectId,
    });
  });

  it("ends an admin's connections when they leave, even if they rejoin", async () => {
    const f = await fixture();
    const adminId = await f.t.run((ctx) =>
      ctx.db.insert("users", { name: "Admin" }),
    );
    const join = () =>
      f.t.run((ctx) =>
        ctx.db.insert("organizationMembers", {
          organizationId: f.organizationId,
          userId: adminId,
          role: "admin",
          joinedAt: 0,
          updatedAt: 0,
        }),
      );
    await join();
    const admin = f.t.withIdentity({
      subject: `${adminId}|browser`,
      issuer: "https://test.convex.site",
    });
    const { redirectTo } = await admin.mutation(api.oauth.mutation.approve, {
      request: REQUEST,
      allow: true,
      projectId: f.projectId,
    });
    const tokens = await f.t.mutation(api.oauth.mutation.exchange, {
      server: await proof(),
      code: new URL(redirectTo).searchParams.get("code")!,
      codeVerifier: VERIFIER,
      ...CLAUDE,
    });
    const ownerTokens = await connect(f);
    expect(await reaches(f, tokens!.access_token)).toBe(true);
    // The same admin's connection to their own organization stays.
    const own = await admin.mutation(
      api.organizations.mutation.createOrganization,
      { name: "Admin's own" },
    );
    const ownProject = await admin.mutation(
      api.projects.mutation.createProject,
      { organizationId: own.organizationId, name: "Side" },
    );
    const ownCode = await admin.mutation(api.oauth.mutation.approve, {
      request: REQUEST,
      allow: true,
      projectId: ownProject.projectId,
    });
    const ownTokens = await f.t.mutation(api.oauth.mutation.exchange, {
      server: await proof(),
      code: new URL(ownCode.redirectTo).searchParams.get("code")!,
      codeVerifier: VERIFIER,
      ...CLAUDE,
    });

    const unspent = await admin.mutation(api.oauth.mutation.approve, {
      request: REQUEST,
      allow: true,
      projectId: f.projectId,
      scope: "write",
    });

    await f.owner.mutation(api.organizations.mutation.removeMember, {
      organizationId: f.organizationId,
      userId: adminId,
    });
    await join();
    expect(await reaches(f, tokens!.access_token)).toBe(false);
    expect(
      await f.t.mutation(api.oauth.mutation.exchange, {
        server: await proof(),
        code: new URL(unspent.redirectTo).searchParams.get("code")!,
        codeVerifier: VERIFIER,
        ...CLAUDE,
      }),
    ).toBeNull();
    expect(await reaches(f, ownerTokens.access_token)).toBe(true);
    expect(
      await f.t.query(api.oauth.query.authenticate, {
        server: await proof(),
        accessToken: ownTokens!.access_token,
      }),
    ).toMatchObject({ projectId: ownProject.projectId });
  });

  it("keeps at most fifty connections per user, ending the least recently used", async () => {
    const f = await fixture();
    const ids = await f.t.run(async (ctx) => {
      const inserted = [];
      for (let index = 0; index < 50; index += 1) {
        const id = await ctx.db.insert("oauthGrants", {
          userId: f.userId,
          projectId: f.projectId,
          organizationId: f.organizationId,
          clientId: CLAUDE.clientId,
          clientName: "Claude",
          scope: "read",
          accessTokenHash: `a${index}`,
          accessExpiresAt: 0,
          refreshFamily: `f${index}`,
          refreshTokenHash: `r${index}`,
          refreshExpiresAt: Date.now() + 1000,
          createdAt: 0,
          // The tenth row was used longest ago.
          lastUsedAt: index === 10 ? 1 : 100 + index,
        });
        inserted.push(id);
      }
      return inserted;
    });
    const tokens = await connect(f);
    const grants = await f.t.run((ctx) =>
      ctx.db.query("oauthGrants").collect(),
    );
    expect(grants).toHaveLength(50);
    expect(grants.some((grant) => grant._id === ids[10])).toBe(false);
    expect(await reaches(f, tokens.access_token)).toBe(true);
  });

  it("keeps at most two hundred connections per project", async () => {
    const f = await fixture();
    const ids = await f.t.run(async (ctx) => {
      const inserted = [];
      // Five members with forty each, so only the project cap applies.
      for (let member = 0; member < 5; member += 1) {
        const userId = await ctx.db.insert("users", { name: `M${member}` });
        for (let index = 0; index < 40; index += 1) {
          const n = member * 40 + index;
          inserted.push(
            await ctx.db.insert("oauthGrants", {
              userId,
              projectId: f.projectId,
              organizationId: f.organizationId,
              clientId: CLAUDE.clientId,
              clientName: "Claude",
              scope: "read",
              accessTokenHash: `a${n}`,
              accessExpiresAt: 0,
              refreshFamily: `f${n}`,
              refreshTokenHash: `r${n}`,
              refreshExpiresAt: Date.now() + 1000,
              createdAt: 0,
              lastUsedAt: n === 77 ? 1 : 100 + n,
            }),
          );
        }
      }
      return inserted;
    });
    const tokens = await connect(f);
    const grants = await f.t.run((ctx) =>
      ctx.db.query("oauthGrants").collect(),
    );
    expect(grants).toHaveLength(200);
    expect(grants.some((grant) => grant._id === ids[77])).toBe(false);
    expect(await reaches(f, tokens.access_token)).toBe(true);
    expect(
      await f.owner.query(api.oauth.query.listProjectGrants, {
        projectId: f.projectId,
      }),
    ).toHaveLength(200);
    // Even past the cap, the listing reads no more than it.
    await f.t.run(async (ctx) => {
      const [grant] = await ctx.db.query("oauthGrants").take(1);
      const { _id, _creationTime, ...copy } = grant;
      await ctx.db.insert("oauthGrants", { ...copy, refreshFamily: "extra" });
    });
    expect(
      await f.owner.query(api.oauth.query.listProjectGrants, {
        projectId: f.projectId,
      }),
    ).toHaveLength(200);
  });

  it("lets a read-only CLI session list connections but not disconnect them", async () => {
    const f = await fixture();
    await connect(f);
    const token = await f.owner.mutation(api.cli.mutation.createToken, {
      name: "Read CI",
      scope: "read",
      expiresInDays: 1,
    });
    const credentials = await f.t.mutation(internal.cli.internal.consume, {
      token: token.token,
    });
    const cli = f.t.withIdentity({
      subject: `${f.userId}|${credentials!.sessionId}`,
      issuer: "https://test.convex.site",
      iapkitCli: true,
    });
    const [grant] = await cli.query(api.oauth.query.listProjectGrants, {
      projectId: f.projectId,
    });
    await expect(
      cli.mutation(api.oauth.mutation.disconnect, { grantId: grant.id }),
    ).rejects.toThrow("INSUFFICIENT_SCOPE");
    // The consent page lists projects to browsers only.
    expect(
      await cli.query(api.oauth.query.authorizationRequest, {
        request: REQUEST,
      }),
    ).toEqual({ error: expect.stringMatching(/browser/) });
    expect(
      await f.owner.query(api.oauth.query.listProjectGrants, {
        projectId: f.projectId,
      }),
    ).toHaveLength(1);
  });

  it("credits a connector's writes to the member who approved it", async () => {
    const f = await fixture();
    const tokens = await connect(f, "write");
    const grant = await f.t.query(api.oauth.query.authenticate, {
      server: await proof(),
      accessToken: tokens.access_token,
    });
    await f.t.run((ctx) =>
      ctx.db.insert("products", {
        projectId: f.projectId,
        platform: "IOS",
        productId: "premium",
        type: "NonConsumable",
        title: "Premium",
        state: "Active",
        updatedAt: 0,
      }),
    );
    await f.t.mutation(
      api.products.mutation.upsertProductClientPayloadWithApiKey,
      {
        apiKey: (await grantApiKey(grant!))!,
        platform: "IOS",
        productId: "premium",
        format: "json",
        body: "{}",
      },
    );
    const rows = await f.t.run((ctx) =>
      ctx.db.query("productClientPayloadVersions").collect(),
    );
    expect(rows.map((row) => row.authorUserId)).toEqual([f.userId]);
  });

  it("rejects a grant key that is forged or signed with another secret", async () => {
    const f = await fixture();
    const tokens = await connect(f);
    const grant = await f.t.query(api.oauth.query.authenticate, {
      server: await proof(),
      accessToken: tokens.access_token,
    });
    const key = (await grantApiKey(grant!))!;
    const found = async (apiKey: string) =>
      (await f.t.query(api.projects.setupStatus.getSetupStatus, { apiKey }))
        .found;
    expect(await found(key)).toBe(true);
    expect(await found(`${key.slice(0, -64)}${"0".repeat(64)}`)).toBe(false);
    expect(await found(`openiap-kit_sk_oauth_${grant!.grantId}`)).toBe(false);
    // The scope is signed: a read grant cannot claim write.
    expect(await found(key.replace("_r_", "_w_"))).toBe(false);
    // The access token itself is not a key.
    expect(await found(tokens.access_token)).toBe(false);
    vi.stubEnv("IAPKIT_VERIFICATION_SOURCE_SECRET", "b".repeat(64));
    expect(await found(key)).toBe(false);
    vi.stubEnv("IAPKIT_VERIFICATION_SOURCE_SECRET", "");
    expect(await grantApiKey(grant!)).toBeNull();
    expect(await found(key)).toBe(false);
    // A short secret is a misconfiguration, never a key.
    vi.stubEnv("IAPKIT_VERIFICATION_SOURCE_SECRET", "a".repeat(32));
    expect(await grantApiKey(grant!)).toBeNull();
  });
});
