import { Doc } from "../_generated/dataModel";
import { QueryCtx } from "../_generated/server";

export async function getApiKeyByKey(
  ctx: QueryCtx,
  key: string,
): Promise<Doc<"apiKeys"> | null> {
  return ctx.db
    .query("apiKeys")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
}
