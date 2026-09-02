import { ConvexError, v } from "convex/values";

import { internalMutation } from "../_generated/server";

export const VERIFICATION_ADMISSION_CAPACITY = 600;
export const VERIFICATION_ADMISSION_REFILL_PER_SECOND = 10;

export function evaluateVerificationAdmission(args: {
  tokens: number | undefined;
  refilledAt: number | undefined;
  now: number;
}):
  | { admitted: true; tokens: number }
  | { admitted: false; retryAfterSec: number } {
  const elapsedSeconds = Math.max(
    0,
    (args.now - (args.refilledAt ?? args.now)) / 1_000,
  );
  const available = Math.min(
    VERIFICATION_ADMISSION_CAPACITY,
    (args.tokens ?? VERIFICATION_ADMISSION_CAPACITY) +
      elapsedSeconds * VERIFICATION_ADMISSION_REFILL_PER_SECOND,
  );
  if (available < 1) {
    return {
      admitted: false,
      retryAfterSec: Math.max(
        1,
        Math.ceil((1 - available) / VERIFICATION_ADMISSION_REFILL_PER_SECOND),
      ),
    };
  }
  return { admitted: true, tokens: available - 1 };
}

export const consume = internalMutation({
  args: { projectId: v.id("projects") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const now = Date.now();
    const result = evaluateVerificationAdmission({
      tokens: project.verificationAdmissionTokens,
      refilledAt: project.verificationAdmissionRefilledAt,
      now,
    });
    if (!result.admitted) {
      throw new ConvexError({
        code: "RATE_LIMITED",
        message: "Too many verification requests",
        retryAfterSec: result.retryAfterSec,
      });
    }

    await ctx.db.patch(args.projectId, {
      verificationAdmissionTokens: result.tokens,
      verificationAdmissionRefilledAt: now,
    });
    return null;
  },
});
