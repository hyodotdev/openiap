import type { Infer } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import {
  buildAmazonRemoteId,
  buildHorizonRemoteId,
} from "../purchases/identity";
import type { ReceiptResponse } from "../purchases/shared";
import type {
  purchaseRequestDataValidator,
  purchaseStoreValidator,
} from "../schema";
import { randomHex } from "../utils/helpers";
import { hmacSha256Hex, sha256Hex } from "../utils/sha256";

export type PurchaseEvidence = Infer<typeof purchaseRequestDataValidator>;

/**
 * What a per-purchase fingerprint hashes: the store and the id the purchase
 * row is saved under, never the evidence. Apple accepts several encodings of
 * one signature, so hashing the JWS would split one purchase into many rows.
 */
export function purchaseDigest(
  store: Infer<typeof purchaseStoreValidator>,
  remoteId: string,
): Promise<string> {
  return sha256Hex(`${store}:${remoteId}`);
}

/** The `remoteId` the verify save path gives the purchase a verdict is about. */
export function verifiedRemoteId(
  evidence: PurchaseEvidence,
  verdict: Pick<ReceiptResponse, "transactionDetails">,
): string | undefined {
  switch (evidence.store) {
    case "apple":
      // The JWS is caller input; these ids are Apple's answer.
      return (
        verdict.transactionDetails?.originalTransactionId ??
        verdict.transactionDetails?.transactionId
      );
    case "google":
      return evidence.purchaseToken;
    case "amazon":
      return buildAmazonRemoteId({
        userId: evidence.userId,
        receiptId: evidence.receiptId,
        sandbox: evidence.sandbox === true,
      });
    case "horizon":
      return buildHorizonRemoteId(evidence.userId, evidence.sku);
  }
}

/**
 * What members see in place of a purchase id: an HMAC of its digest under the
 * project's secret salt, so a short identifier such as an Apple transaction id
 * or a Horizon user and SKU cannot be recovered by guessing. Only the unsalted
 * digest crosses the scheduler.
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
