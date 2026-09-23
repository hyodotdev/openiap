import { query } from "../_generated/server";
import { v } from "convex/values";
import { isEmailSignInOpen } from "../authWindow";
import { hasAnyResendAccount } from "./internal";

/**
 * Pre-sign-in gate: whether a user with this email exists. The AuthModal asks
 * before sending an OTP, so Resend credit is not spent on a signup that must
 * use GitHub (new signups since 2026-04). It exists only until email-only
 * accounts are retired.
 *
 * Public, because anonymous visitors call it from the sign-in form. It returns
 * only a boolean; the enumeration risk is accepted at this scale (<200 users).
 */
export const canSignInWithEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const normalized = args.email.trim().toLowerCase();
    if (normalized.length === 0) return false;
    if (!isEmailSignInOpen()) return false;
    const user = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", normalized))
      .first();
    if (!user) return false;
    // OTP stays limited to accounts that already used it; GitHub-created
    // accounts keep using GitHub even during the grace period.
    return hasAnyResendAccount((provider) =>
      ctx.db
        .query("authAccounts")
        .withIndex("userIdAndProvider", (q) =>
          q.eq("userId", user._id).eq("provider", provider),
        )
        .first(),
    );
  },
});
