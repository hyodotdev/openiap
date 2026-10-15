import type { Infer } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { purchaseRequestDataValidator } from "../schema";
import { buildHorizonRemoteId } from "../purchases/identity";
import { randomHex } from "../utils/helpers";
import { hmacSha256Hex } from "../utils/sha256";

export type PurchaseEvidence = Infer<typeof purchaseRequestDataValidator>;

/** The store evidence a request carries, as the fingerprint hashes it. */
export function purchaseEvidence(evidence: PurchaseEvidence): string {
  switch (evidence.store) {
    case "apple":
      return evidence.jws;
    case "google":
      return evidence.purchaseToken;
    case "amazon":
      return evidence.receiptId;
    case "horizon":
      return buildHorizonRemoteId(evidence.userId, evidence.sku);
  }
}

/**
 * What members see in place of evidence: an HMAC of the evidence's SHA-256
 * under the project's secret salt, so a short identifier such as an Apple
 * transaction id or a Horizon user and SKU cannot be recovered by guessing.
 * Only the unsalted digest crosses the scheduler, never the token.
 */
export function evidenceFingerprint(
  salt: string,
  digest: string,
): Promise<string> {
  return hmacSha256Hex(salt, digest);
}

/** The project's fingerprint salt, created on first use. */
export async function fingerprintSalt(
  ctx: MutationCtx,
  project: Doc<"projects">,
): Promise<string> {
  if (project.fingerprintSalt) return project.fingerprintSalt;
  const salt = randomHex();
  await ctx.db.patch(project._id, { fingerprintSalt: salt });
  return salt;
}

const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

export function isSha256Hex(value: string): boolean {
  return SHA256_HEX_PATTERN.test(value);
}
