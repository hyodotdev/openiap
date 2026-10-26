"use node";

import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";
import { ConvexError, v } from "convex/values";
import { ReceiptVerificationError } from "./errors";

type VerificationScope =
  | "apple"
  | "google"
  | "amazon"
  | "horizon"
  | "enqueue"
  | "read";
interface SourceAuthentication {
  issuedAt: number;
  mac: string;
}

export const verificationSourceValidator = v.optional(
  v.object({
    issuedAt: v.number(),
    mac: v.string(),
  }),
);

function unavailable(scope: VerificationScope): never {
  if (scope === "enqueue" || scope === "read")
    throw new ConvexError({
      code: "UNKNOWN_ERROR",
      message: "Verification is temporarily unavailable.",
      retryAfterSec: 5,
    });
  throw new ReceiptSourceUnavailableError();
}

class ReceiptSourceUnavailableError extends ReceiptVerificationError {
  constructor() {
    super(
      "UNKNOWN_ERROR",
      "Verification is temporarily unavailable. Retry later.",
      undefined,
      5,
    );
  }
}

export function verificationSourceConfigured(
  secret: string | undefined,
): boolean {
  return Boolean(secret && /^[a-f0-9]{64}$/.test(secret));
}

export function verificationSourceSecret(scope: VerificationScope): string {
  const secret = process.env.IAPKIT_VERIFICATION_SOURCE_SECRET;
  if (!secret || !verificationSourceConfigured(secret)) unavailable(scope);
  return secret;
}

function signature(
  scope: VerificationScope,
  args: Record<string, unknown>,
  issuedAt: number,
  secret: string,
): string {
  const fields = Object.keys(args)
    .filter((key) => args[key] !== undefined)
    .sort()
    .map((key) => [key, args[key]]);
  return createHmac("sha256", secret)
    .update(
      JSON.stringify([
        scope === "enqueue" || scope === "read"
          ? "iapkit-verification-job-v1"
          : "iapkit-verification-v1",
        scope,
        issuedAt,
        fields,
      ]),
    )
    .digest("hex");
}

/** Called only after Bun has admitted the exact verification request. */
export function withVerificationSource<T extends Record<string, unknown>>(
  scope: VerificationScope,
  args: T,
): T & { sourceAuth: SourceAuthentication } {
  const issuedAt = Date.now();
  return {
    ...args,
    sourceAuth: {
      issuedAt,
      mac: signature(scope, args, issuedAt, verificationSourceSecret(scope)),
    },
  };
}

/** Convex repeats the source check before issues, quota, database or store work. */
export function assertVerificationSource(
  scope: VerificationScope,
  args: Record<string, unknown>,
  sourceAuth: SourceAuthentication | undefined,
): void {
  const secret = verificationSourceSecret(scope);
  const now = Date.now();
  if (
    !sourceAuth ||
    !Number.isSafeInteger(sourceAuth.issuedAt) ||
    sourceAuth.issuedAt > now + 30_000 ||
    now - sourceAuth.issuedAt > 120_000 ||
    sourceAuth.mac.length !== 64 ||
    !/^[a-f0-9]{64}$/.test(sourceAuth.mac)
  )
    unavailable(scope);
  const expected = signature(scope, args, sourceAuth.issuedAt, secret);
  if (
    !timingSafeEqual(
      Buffer.from(sourceAuth.mac, "hex"),
      Buffer.from(expected, "hex"),
    )
  )
    unavailable(scope);
}
