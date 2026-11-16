import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/** An organization's GitHub sponsorship link, if the maintainer made one. */
export async function getLink(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
): Promise<Doc<"sponsorshipLinks"> | null> {
  return ctx.db
    .query("sponsorshipLinks")
    .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
    .unique();
}
