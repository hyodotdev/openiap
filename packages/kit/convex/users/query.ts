import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * Pre-sign-in gate: returns true if a user with the given email
 * already exists. Called from the AuthModal before firing the OTP
 * email so we don't burn Resend credit on a send that would end in
 * "new signups are GitHub-only" anyway. New signups are expected to
 * go through GitHub OAuth from 2026-04 onward; this query only
 * exists so existing email-only accounts keep working until the
 * Resend provider is fully retired.
 *
 * Publicly callable (no auth guard) — anonymous visitors need to be
 * able to call this from the sign-in form. Email enumeration risk
 * is real but low-value given product scale (<200 users) and we
 * return a boolean-only answer, not timing-sensitive detail.
 */
export const canSignInWithEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.email.trim().toLowerCase();
    if (normalized.length === 0) return false;
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalized))
      .first();
    return user !== null;
  },
});
