import type { Infer } from "convex/values";

import type { purchaseRequestDataValidator } from "../schema";
import { buildHorizonRemoteId } from "../purchases/identity";
import { sha256Hex } from "../utils/sha256";

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
 * SHA-256 hex of the evidence, so the dashboard and the issue log can point at
 * a purchase without holding its token. For Apple, Google and Amazon the first
 * 16 characters equal the `sha256Prefix` of the debug verify log.
 */
export function evidenceFingerprint(
  evidence: PurchaseEvidence,
): Promise<string> {
  return sha256Hex(purchaseEvidence(evidence));
}

const FINGERPRINT_PATTERN = /^[0-9a-f]{64}$/;

export function isEvidenceFingerprint(value: string): boolean {
  return FINGERPRINT_PATTERN.test(value);
}
