// Transport-independent admission for verifyPurchase. Both the REST route and
// the GraphQL resolver run store-hitting verification through here, so the
// per-(key, payload) replay guard, the process-wide in-flight cap, and the
// stable-failure cooldown apply identically on both bindings — they were a
// REST-only middleware before, which the GraphQL binding bypassed entirely.

import { hashApiKey } from "../v1/rate-limit";
import { acquireInFlightSlot } from "../v1/in-flight-limit";
import {
  hashPayload,
  isStableRejection,
  markPayloadFailure,
  REPLAY_GUARD,
  tryConsumeReplay,
  type ReplayPayload,
} from "../v1/replay-guard";

export interface VerificationVerdict {
  isValid: boolean;
  state: string;
  stableRejection?: boolean;
}

type Admission =
  | { admitted: false; code: "RATE_LIMITED"; retryAfterSec: number }
  | {
      admitted: true;
      run: <T extends VerificationVerdict>(
        verify: () => Promise<T>,
      ) => Promise<T>;
    };

// Maps the protocol's discriminated evidence onto the flat shape the shared
// replay guard hashes, so the same receipt keys the same bucket as /v1. Amazon
// includes `sandbox` in the key so a sandbox failure cannot block a production
// request for the same receipt id (matching /v1's hashPayload).
export function verificationReplayPayload(input: unknown): ReplayPayload {
  const evidence = (input ?? {}) as {
    store?: string;
    apple?: { jws?: string };
    google?: { purchaseToken?: string };
    horizon?: { userId?: string; sku?: string };
    amazon?: { userId?: string; receiptId?: string; sandbox?: boolean };
  };
  switch (evidence.store) {
    case "apple":
      return { store: "apple", jws: evidence.apple?.jws ?? "" };
    case "google":
      return {
        store: "google",
        purchaseToken: evidence.google?.purchaseToken ?? "",
      };
    case "horizon":
      return {
        store: "horizon",
        userId: evidence.horizon?.userId ?? "",
        sku: evidence.horizon?.sku ?? "",
      };
    default:
      return {
        store: "amazon",
        userId: evidence.amazon?.userId ?? "",
        receiptId: evidence.amazon?.receiptId ?? "",
        sandbox: evidence.amazon?.sandbox === true,
      };
  }
}

/**
 * Admits one verification. On success returns a `run(verify)` that executes the
 * verification while holding an in-flight slot and, afterwards, records a stable
 * rejection so a replayed already-rejected receipt hits the cooldown. On
 * rejection returns the protocol code and retry hint for the caller's envelope.
 */
export function admitVerification({
  apiKey,
  requestIp,
  input,
  now = Date.now(),
}: {
  apiKey: string;
  requestIp: string | undefined;
  input: unknown;
  now?: number;
}): Admission {
  const apiKeyHash = hashApiKey(apiKey);
  const ipHash = hashApiKey(`ip:${requestIp ?? "unknown"}`);
  const store = (input as { store?: string } | null)?.store;
  const bucketKey = `${apiKeyHash}:${hashPayload(verificationReplayPayload(input))}`;

  const replay = tryConsumeReplay(
    REPLAY_GUARD.store,
    bucketKey,
    REPLAY_GUARD.capacity,
    REPLAY_GUARD.refillPerSecond,
    now,
    REPLAY_GUARD.maxStoreSize,
    REPLAY_GUARD.failureCooldownMs,
  );
  if (!replay.allowed) {
    return {
      admitted: false,
      code: "RATE_LIMITED",
      retryAfterSec: replay.retryAfterSec,
    };
  }

  const slot = acquireInFlightSlot({ apiKeyHash, ipHash });
  if (slot.scope !== null) {
    // The replay token was spent on an attempt that never got a slot; refund it
    // so backoff retries are not miscounted as duplicate-payload rejections.
    refundReplayToken(bucketKey);
    return { admitted: false, code: "RATE_LIMITED", retryAfterSec: 1 };
  }

  return {
    admitted: true,
    run: async (verify) => {
      try {
        const verdict = await verify();
        // Match /v1: arm the negative cooldown only for a stable INVALID
        // verdict, and never for Horizon — its (userId, sku) ownership can flip
        // the moment the user buys again, so a `false` must stay retryable. An
        // `isValid: true` verdict never arms the cooldown.
        if (
          store !== "horizon" &&
          verdict.isValid === false &&
          isStableRejection(verdict.state, verdict.stableRejection === true)
        ) {
          markPayloadFailure(
            REPLAY_GUARD.store,
            bucketKey,
            REPLAY_GUARD.capacity,
            Date.now(),
            REPLAY_GUARD.maxStoreSize,
          );
        }
        return verdict;
      } finally {
        slot.release();
      }
    },
  };
}

function refundReplayToken(bucketKey: string): void {
  const bucket = REPLAY_GUARD.store.get(bucketKey);
  if (!bucket) return;
  REPLAY_GUARD.store.delete(bucketKey);
  bucket.tokens = Math.min(REPLAY_GUARD.capacity, bucket.tokens + 1);
  REPLAY_GUARD.store.set(bucketKey, bucket);
}
