import { Doc } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { ConvexError } from "convex/values";
import { sha256Hex } from "../utils/sha256";

export type ApiKeyType = "publishable" | "secret";
export type ApiKeyAccess = "client" | "admin";

/**
 * Existing keys predate scoped credentials and were documented for use inside
 * mobile apps. Fail closed by treating an unclassified key as publishable.
 */
export function effectiveApiKeyType(
  keyType: ApiKeyType | undefined,
): ApiKeyType {
  return keyType ?? "publishable";
}

export function assertApiKeyAccess(
  keyType: ApiKeyType,
  requiredAccess: ApiKeyAccess,
): void {
  if (requiredAccess === "client" || keyType === "secret") return;

  throw new ConvexError({
    code: "INSUFFICIENT_SCOPE",
    message:
      "This operation requires a secret admin key. Publishable mobile keys cannot access administrative operations.",
  });
}

export async function hashApiKeyForStorage(apiKey: string): Promise<string> {
  return sha256Hex(apiKey);
}

export function apiKeyPreview(apiKey: string): string {
  const suffix = apiKey.slice(-4);
  return apiKey.startsWith("openiap-kit_")
    ? `openiap-kit_...${suffix}`
    : `...${suffix}`;
}

export async function apiKeyStorageFields(
  apiKey: string,
  keyType: ApiKeyType,
): Promise<
  | { key: string; keyHash?: never; keyPreview: string }
  | { key?: never; keyHash: string; keyPreview: string }
> {
  const keyPreview = apiKeyPreview(apiKey);
  return keyType === "secret"
    ? { keyHash: await hashApiKeyForStorage(apiKey), keyPreview }
    : { key: apiKey, keyPreview };
}

/**
 * Patch that finishes hashing one stored secret key, or null when the row
 * needs no work. The migrations component applies the return value with
 * `db.patch`, so the plaintext column must be cleared with an explicit
 * `key: undefined` — omitting the field would keep the plaintext forever.
 * Rows an earlier half-run already hashed still get the plaintext stripped.
 */
export async function hashStoredSecretApiKeyPatch(doc: {
  key?: string;
  keyHash?: string;
  keyType?: ApiKeyType;
}): Promise<{ key: undefined; keyHash?: string; keyPreview?: string } | null> {
  if (effectiveApiKeyType(doc.keyType) !== "secret" || !doc.key) return null;
  if (doc.keyHash) return { key: undefined };
  const { keyHash, keyPreview } = await apiKeyStorageFields(doc.key, "secret");
  return { key: undefined, keyHash, keyPreview };
}

export async function getApiKeyByKey(
  ctx: QueryCtx | MutationCtx,
  key: string,
): Promise<Doc<"apiKeys"> | null> {
  const keyHash = await hashApiKeyForStorage(key);
  const hashed = await ctx.db
    .query("apiKeys")
    .withIndex("by_key_hash", (q) => q.eq("keyHash", keyHash))
    .first();
  if (hashed) return hashed;

  return ctx.db
    .query("apiKeys")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
}

/**
 * Legacy projects may authenticate through projects.apiKey only until their
 * first scoped key is issued. Checking for existing rows protects deployments
 * before the project marker migration has finished; the durable marker keeps
 * the fallback disabled even if the final scoped key is later deleted.
 */
export async function allowsLegacyProjectApiKeyFallback(
  ctx: QueryCtx | MutationCtx,
  project: Doc<"projects">,
): Promise<boolean> {
  if (project.legacyApiKeyFallbackDisabledAt !== undefined) {
    return false;
  }

  const scopedKey = await ctx.db
    .query("apiKeys")
    .withIndex("by_project", (q) => q.eq("projectId", project._id))
    .first();
  return scopedKey === null;
}
