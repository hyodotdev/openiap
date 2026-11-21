import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { randomHex, verificationSourceConfigured } from "../utils/helpers";
import type { OauthScope } from "./clients";
import { hmacSha256Hex, sha256Hex, verifyHmacSha256Hex } from "../utils/sha256";

export const CODE_TTL_MS = 60 * 1000;
export const ACCESS_TTL_MS = 60 * 60 * 1000;
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const USE_RECORD_INTERVAL_MS = 10 * 60 * 1000;
// Bound what removing a member and listing a project's connections read.
export const MAX_GRANTS_PER_USER = 50;
export const MAX_GRANTS_PER_PROJECT = 200;

const GRANT_KEY_PREFIX = "openiap-kit_sk_oauth_";
const GRANT_KEY = /^openiap-kit_sk_oauth_([^_]+)_(r|w)_([a-f0-9]{64})$/;
const REFRESH_TOKEN_PREFIX = "iapkit_ort_";
const REFRESH_TOKEN = new RegExp(
  `^${REFRESH_TOKEN_PREFIX}([a-f0-9]{32})_[a-f0-9]{64}$`,
);
const PROOF_MAX_AGE_MS = 2 * 60 * 1000;
const PROOF_MAX_SKEW_MS = 30 * 1000;

function secret(): string | null {
  const value = process.env.IAPKIT_VERIFICATION_SOURCE_SECRET;
  return verificationSourceConfigured(value) ? value : null;
}

function signedGrant(grantId: string, scope: OauthScope): string {
  return JSON.stringify(["iapkit-oauth-grant-key-v2", grantId, scope]);
}

/**
 * The credential the hosted MCP server presents to `/v1` for a grant. Only a
 * holder of the server secret can build one, so an OAuth access token is
 * useless anywhere but `/mcp`. It names its scope so the server can refuse a
 * read-only grant's writes before they reach Convex.
 */
export async function grantApiKey(grant: {
  grantId: string;
  scope: OauthScope;
}): Promise<string | null> {
  const key = secret();
  if (!key) return null;
  const mac = await hmacSha256Hex(key, signedGrant(grant.grantId, grant.scope));
  return `${GRANT_KEY_PREFIX}${grant.grantId}_${grant.scope[0]}_${mac}`;
}

export function isGrantApiKey(apiKey: string): boolean {
  return apiKey.startsWith(GRANT_KEY_PREFIX);
}

/** True for a read-only grant's credential, by its form alone. */
export function isReadOnlyGrantApiKey(apiKey: string): boolean {
  return GRANT_KEY.exec(apiKey)?.[2] === "r";
}

export const oauthServerProofValidator = v.object({
  issuedAt: v.number(),
  mac: v.string(),
});
type OauthServerProof = Infer<typeof oauthServerProofValidator>;

function signedProof(issuedAt: number): string {
  return JSON.stringify(["iapkit-oauth-server-v1", issuedAt]);
}

/** Lets the token endpoints and `/mcp` call the OAuth functions; null when unconfigured. */
export async function oauthServerProof(
  issuedAt = Date.now(),
): Promise<OauthServerProof | null> {
  const key = secret();
  return key
    ? { issuedAt, mac: await hmacSha256Hex(key, signedProof(issuedAt)) }
    : null;
}

/**
 * Refuses callers other than the IAPKit server, which applies the HTTP rate
 * limits. Returns the proof's time, which queries use as "now" so a cached
 * result never outlives a token.
 */
export async function assertOauthServer(
  proof: OauthServerProof,
): Promise<number> {
  const key = secret();
  const now = Date.now();
  if (
    !key ||
    !Number.isSafeInteger(proof.issuedAt) ||
    proof.issuedAt > now + PROOF_MAX_SKEW_MS ||
    now - proof.issuedAt > PROOF_MAX_AGE_MS ||
    !(await verifyHmacSha256Hex(key, signedProof(proof.issuedAt), proof.mac))
  )
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Call OAuth endpoints through the IAPKit server.",
    });
  return proof.issuedAt;
}

/** The project, if the user owns or administers its live organization. */
export async function adminProject(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  projectId: Id<"projects">,
): Promise<Doc<"projects"> | null> {
  if (!(await ctx.db.get(userId))) return null;
  const project = await ctx.db.get(projectId);
  if (!project || project.pendingDeletion) return null;
  const organization = await ctx.db.get(project.organizationId);
  if (!organization || organization.pendingDeletion) return null;
  const membership = await ctx.db
    .query("organizationMembers")
    .withIndex("by_org_and_user", (q) =>
      q.eq("organizationId", project.organizationId).eq("userId", userId),
    )
    .first();
  return membership && membership.role !== "member" ? project : null;
}

/**
 * The grant and project an internal grant credential stands for. A read-only
 * grant's credential never resolves inside a mutation; the server also
 * refuses its requests that are not reads.
 */
export async function resolveGrantApiKey(
  ctx: QueryCtx | MutationCtx,
  apiKey: string,
): Promise<{ grant: Doc<"oauthGrants">; project: Doc<"projects"> } | null> {
  const key = secret();
  const [, rawId, scopeLetter, mac] = GRANT_KEY.exec(apiKey) ?? [];
  const grantId = rawId ? ctx.db.normalizeId("oauthGrants", rawId) : null;
  const scope: OauthScope = scopeLetter === "w" ? "write" : "read";
  if (
    !key ||
    !grantId ||
    !(await verifyHmacSha256Hex(key, signedGrant(grantId, scope), mac))
  )
    return null;
  const grant = await ctx.db.get(grantId);
  if (!grant || (grant.scope === "read" && "insert" in ctx.db)) return null;
  const project = await adminProject(ctx, grant.userId, grant.projectId);
  return project ? { grant, project } : null;
}

export async function grantByAccessToken(
  ctx: QueryCtx | MutationCtx,
  accessToken: string,
): Promise<Doc<"oauthGrants"> | null> {
  if (accessToken.length > 128) return null;
  const accessTokenHash = await sha256Hex(accessToken);
  return ctx.db
    .query("oauthGrants")
    .withIndex("by_access_token_hash", (q) =>
      q.eq("accessTokenHash", accessTokenHash),
    )
    .unique();
}

/** The grant a refresh token was issued for, current or rotated away. */
export async function refreshTokenGrant(
  ctx: QueryCtx | MutationCtx,
  refreshToken: string,
): Promise<Doc<"oauthGrants"> | null> {
  const family = REFRESH_TOKEN.exec(refreshToken)?.[1];
  return family
    ? ctx.db
        .query("oauthGrants")
        .withIndex("by_refresh_family", (q) => q.eq("refreshFamily", family))
        .unique()
    : null;
}

/** Ends a member's connections, and unspent codes, to an organization they left. */
export async function revokeMemberGrants(
  ctx: MutationCtx,
  userId: Id<"users">,
  organizationId: Id<"organizations">,
): Promise<void> {
  const grants = await ctx.db
    .query("oauthGrants")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .collect();
  for (const grant of grants)
    if (grant.organizationId === organizationId) await ctx.db.delete(grant._id);
  const codes = await ctx.db
    .query("oauthCodes")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .collect();
  for (const code of codes)
    if ((await ctx.db.get(code.projectId))?.organizationId === organizationId)
      await ctx.db.delete(code._id);
}

/** Makes room for one more grant by ending the least recently used over a cap. */
export async function makeRoomForGrant(
  ctx: MutationCtx,
  userId: Id<"users">,
  projectId: Id<"projects">,
): Promise<void> {
  const byUser = await ctx.db
    .query("oauthGrants")
    .withIndex("by_user_id", (q) => q.eq("userId", userId))
    .take(MAX_GRANTS_PER_USER);
  if (byUser.length >= MAX_GRANTS_PER_USER)
    await ctx.db.delete(leastRecentlyUsed(byUser)._id);
  // Read after that delete, which this mutation already sees.
  const byProject = await ctx.db
    .query("oauthGrants")
    .withIndex("by_project", (q) => q.eq("projectId", projectId))
    .take(MAX_GRANTS_PER_PROJECT);
  if (byProject.length >= MAX_GRANTS_PER_PROJECT)
    await ctx.db.delete(leastRecentlyUsed(byProject)._id);
}

function leastRecentlyUsed(grants: Doc<"oauthGrants">[]): Doc<"oauthGrants"> {
  return grants.reduce((a, b) => (b.lastUsedAt < a.lastUsedAt ? b : a));
}

/** New tokens for a grant; a new grant also gets its refresh family here. */
export async function newTokens(now: number, refreshFamily = randomHex(16)) {
  const accessToken = `iapkit_oat_${randomHex(32)}`;
  const refreshToken = `${REFRESH_TOKEN_PREFIX}${refreshFamily}_${randomHex(32)}`;
  return {
    accessToken,
    refreshToken,
    stored: {
      accessTokenHash: await sha256Hex(accessToken),
      accessExpiresAt: now + ACCESS_TTL_MS,
      refreshFamily,
      refreshTokenHash: await sha256Hex(refreshToken),
      refreshExpiresAt: now + REFRESH_TTL_MS,
    },
  };
}
