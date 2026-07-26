import { Doc } from "../_generated/dataModel";
import { MutationCtx, QueryCtx } from "../_generated/server";
import { ConvexError } from "convex/values";

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

export async function getApiKeyByKey(
  ctx: QueryCtx | MutationCtx,
  key: string,
): Promise<Doc<"apiKeys"> | null> {
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
