import { getAuthSessionId } from "@convex-dev/auth/server";
import { ConvexError } from "convex/values";
import type { ActionCtx, MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";

export type CliScope = "read" | "write" | "admin";
const LEVELS = { read: 0, write: 1, admin: 2 };

export async function assertCliScope(
  ctx: QueryCtx | MutationCtx | ActionCtx,
  required: CliScope,
): Promise<void> {
  const identity = await ctx.auth?.getUserIdentity();
  if (identity?.iapkitCli !== true) return;
  const sessionId = await getAuthSessionId(ctx);
  if (!sessionId)
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "Invalid CLI session.",
    });
  const session =
    "db" in ctx
      ? await ctx.db
          .query("cliSessions")
          .withIndex("by_session_id", (q) => q.eq("sessionId", sessionId))
          .unique()
      : await ctx.runQuery(internal.cli.internal.currentSession, {});
  if (
    !session ||
    session.revoked ||
    ("db" in ctx &&
      (!(await ctx.db.get(sessionId)) || !(await ctx.db.get(session.userId))))
  ) {
    throw new ConvexError({
      code: "UNAUTHENTICATED",
      message: "CLI session was revoked. Run openiap kit login.",
    });
  }
  if (LEVELS[session.scope] < LEVELS[required]) {
    throw new ConvexError({
      code: "INSUFFICIENT_SCOPE",
      message: `This command requires ${required} scope.`,
    });
  }
  if (
    (!("db" in ctx) || "scheduler" in ctx) &&
    session.expiresAt <= Date.now()
  ) {
    throw new ConvexError({
      code: "SESSION_EXPIRED",
      message: "CLI session expired. Run openiap kit login.",
    });
  }
}
