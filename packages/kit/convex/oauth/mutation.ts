import { getAuthUserId } from "@convex-dev/auth/server";
import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { mutation } from "../_generated/server";
import { assertCliScope } from "../cli/scope";
import { randomHex } from "../utils/helpers";
import { sha256Hex } from "../utils/sha256";
import {
  type OauthScope,
  oauthIssuer,
  oauthResource,
  oauthScopeValidator,
  scopeString,
} from "./clients";
import {
  ACCESS_TTL_MS,
  CODE_TTL_MS,
  USE_RECORD_INTERVAL_MS,
  adminProject,
  assertOauthServer,
  makeRoomForGrant,
  grantByAccessToken,
  newTokens,
  oauthServerProofValidator,
  refreshTokenGrant,
} from "./grants";
import { oauthLimiter } from "./internal";
import {
  BROWSER_ONLY,
  authorizationRequestValidator,
  checkAuthorizationRequest,
  isCliIdentity,
} from "./request";

// RFC 7636: 43 to 128 unreserved characters.
const PKCE_VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;

/** Base64url SHA-256, the PKCE S256 transform. */
async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function tokenResponse(
  tokens: { accessToken: string; refreshToken: string },
  granted: OauthScope,
) {
  return {
    access_token: tokens.accessToken,
    token_type: "Bearer" as const,
    expires_in: ACCESS_TTL_MS / 1000,
    refresh_token: tokens.refreshToken,
    scope: scopeString(granted),
  };
}

/**
 * Records the user's answer on the consent page and returns where to send the
 * browser: back to the connector with a code, or with `access_denied`.
 */
export const approve = mutation({
  args: {
    request: authorizationRequestValidator,
    state: v.optional(v.string()),
    allow: v.boolean(),
    projectId: v.optional(v.id("projects")),
    scope: v.optional(oauthScopeValidator),
  },
  handler: async (ctx, args) => {
    if (await isCliIdentity(ctx))
      throw new ConvexError({
        code: "INSUFFICIENT_SCOPE",
        message: BROWSER_ONLY,
      });
    const userId = await getAuthUserId(ctx);
    if (!userId)
      throw new ConvexError({
        code: "UNAUTHENTICATED",
        message: "Sign in to IAPKit first.",
      });
    await oauthLimiter.limit(ctx, "approve", { key: userId, throws: true });
    const checked = checkAuthorizationRequest(args.request);
    if (!checked.ok || (args.state !== undefined && args.state.length > 2048))
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: checked.ok ? "state is too long." : checked.error,
      });

    const redirectTo = new URL(checked.redirectUri);
    if (args.state !== undefined)
      redirectTo.searchParams.set("state", args.state);
    redirectTo.searchParams.set("iss", oauthIssuer());
    if (!args.allow) {
      redirectTo.searchParams.set("error", "access_denied");
      return { redirectTo: redirectTo.toString() };
    }

    if (!args.projectId || !(await adminProject(ctx, userId, args.projectId)))
      throw new ConvexError({
        code: "INSUFFICIENT_SCOPE",
        message: "Choose a project you own or administer.",
      });
    const code = `iapkit_oac_${randomHex(32)}`;
    const expiresAt = Date.now() + CODE_TTL_MS;
    const codeId = await ctx.db.insert("oauthCodes", {
      codeHash: await sha256Hex(code),
      userId,
      projectId: args.projectId,
      scope: args.scope ?? "read",
      clientId: checked.clientId,
      clientName: checked.clientName,
      redirectUri: checked.redirectUri,
      codeChallenge: checked.codeChallenge,
      expiresAt,
    });
    await ctx.scheduler.runAt(expiresAt, internal.oauth.internal.expireCode, {
      codeId,
    });
    redirectTo.searchParams.set("code", code);
    return { redirectTo: redirectTo.toString() };
  },
});

/** Trades a one-time code for tokens. Null is `invalid_grant`. */
export const exchange = mutation({
  args: {
    server: oauthServerProofValidator,
    code: v.string(),
    codeVerifier: v.string(),
    clientId: v.string(),
    redirectUri: v.string(),
    resource: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertOauthServer(args.server);
    if (args.code.length > 128 || !PKCE_VERIFIER.test(args.codeVerifier))
      return null;
    const codeHash = await sha256Hex(args.code);
    const row = await ctx.db
      .query("oauthCodes")
      .withIndex("by_code_hash", (q) => q.eq("codeHash", codeHash))
      .unique();
    if (!row) return null;
    // One attempt per code, whatever the outcome.
    await ctx.db.delete(row._id);
    const now = Date.now();
    const project = await adminProject(ctx, row.userId, row.projectId);
    if (
      row.expiresAt <= now ||
      row.clientId !== args.clientId ||
      row.redirectUri !== args.redirectUri ||
      (args.resource !== undefined && args.resource !== oauthResource()) ||
      row.codeChallenge !== (await pkceChallenge(args.codeVerifier)) ||
      !project
    )
      return null;

    await makeRoomForGrant(ctx, row.userId, row.projectId);
    const tokens = await newTokens(now);
    const grantId = await ctx.db.insert("oauthGrants", {
      userId: row.userId,
      projectId: row.projectId,
      organizationId: project.organizationId,
      clientId: row.clientId,
      clientName: row.clientName,
      scope: row.scope,
      createdAt: now,
      lastUsedAt: now,
      ...tokens.stored,
    });
    await ctx.scheduler.runAt(
      tokens.stored.refreshExpiresAt,
      internal.oauth.internal.expireGrant,
      { grantId },
    );
    return tokenResponse(tokens, row.scope);
  },
});

/**
 * Rotates a grant's tokens. Null is `invalid_grant`. A refresh token of the
 * grant other than the current one leaked (RFC 9700 §4.14.2), so the grant
 * is revoked.
 */
export const refresh = mutation({
  args: {
    server: oauthServerProofValidator,
    refreshToken: v.string(),
    clientId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await assertOauthServer(args.server);
    const grant = await refreshTokenGrant(ctx, args.refreshToken);
    if (!grant) return null;
    const now = Date.now();
    // A rotated-away or misused token, a lapsed grant or lost access ends it.
    if (
      (await sha256Hex(args.refreshToken)) !== grant.refreshTokenHash ||
      (args.clientId !== undefined && args.clientId !== grant.clientId) ||
      grant.refreshExpiresAt <= now ||
      !(await adminProject(ctx, grant.userId, grant.projectId))
    ) {
      await ctx.db.delete(grant._id);
      return null;
    }
    const tokens = await newTokens(now, grant.refreshFamily);
    await ctx.db.patch(grant._id, tokens.stored);
    return tokenResponse(tokens, grant.scope);
  },
});

/** RFC 7009: revoking either token ends the grant. Unknown tokens are ignored. */
export const revoke = mutation({
  args: { server: oauthServerProofValidator, token: v.string() },
  handler: async (ctx, { server, token }) => {
    await assertOauthServer(server);
    const byRefresh = await refreshTokenGrant(ctx, token);
    const grant =
      byRefresh?.refreshTokenHash === (await sha256Hex(token))
        ? byRefresh
        : await grantByAccessToken(ctx, token);
    if (grant) await ctx.db.delete(grant._id);
    return null;
  },
});

/** Records connector activity, at most every ten minutes, for the dashboard. */
export const markUsed = mutation({
  args: { server: oauthServerProofValidator, accessToken: v.string() },
  handler: async (ctx, { server, accessToken }) => {
    await assertOauthServer(server);
    const grant = await grantByAccessToken(ctx, accessToken);
    const now = Date.now();
    if (grant && now - grant.lastUsedAt >= USE_RECORD_INTERVAL_MS)
      await ctx.db.patch(grant._id, { lastUsedAt: now });
    return null;
  },
});

/** Disconnects a connector from the project's dashboard. */
export const disconnect = mutation({
  args: { grantId: v.id("oauthGrants") },
  handler: async (ctx, { grantId }) => {
    await assertCliScope(ctx, "admin");
    const userId = await getAuthUserId(ctx);
    const grant = await ctx.db.get(grantId);
    if (
      !userId ||
      !grant ||
      !(await adminProject(ctx, userId, grant.projectId))
    )
      throw new ConvexError({
        code: "INSUFFICIENT_SCOPE",
        message: "Only owners and admins can disconnect an app.",
      });
    await ctx.db.delete(grantId);
    return null;
  },
});
