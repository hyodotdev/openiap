import { ConvexError, v, type Infer } from "convex/values";
import { hmacSha256Hex, verifyHmacSha256Hex } from "../utils/sha256";

export const verificationJobSource = v.optional(
  v.object({ issuedAt: v.number(), mac: v.string() }),
);
type Source = NonNullable<Infer<typeof verificationJobSource>>;

export function verificationJobSecret(): string {
  const secret = process.env.IAPKIT_VERIFICATION_SOURCE_SECRET;
  if (!secret || !/^[a-f0-9]{64}$/.test(secret)) {
    throw new ConvexError({
      code: "UNKNOWN_ERROR",
      message: "Verification is temporarily unavailable.",
      retryAfterSec: 5,
    });
  }
  return secret;
}

function signedRequest(
  operation: "enqueue" | "read",
  args: Record<string, unknown>,
  issuedAt: number,
): string {
  return JSON.stringify([
    "iapkit-verification-job-v1",
    operation,
    issuedAt,
    Object.keys(args)
      .filter((key) => args[key] !== undefined)
      .sort()
      .map((key) => [key, args[key]]),
  ]);
}

export async function withVerificationJobSource<
  T extends Record<string, unknown>,
>(operation: "enqueue" | "read", args: T): Promise<T & { sourceAuth: Source }> {
  const issuedAt = Date.now();
  return {
    ...args,
    sourceAuth: {
      issuedAt,
      mac: await hmacSha256Hex(
        verificationJobSecret(),
        signedRequest(operation, args, issuedAt),
      ),
    },
  };
}

export async function assertVerificationJobSource(
  operation: "enqueue" | "read",
  args: Record<string, unknown>,
  source: Source | undefined,
): Promise<void> {
  const now = Date.now();
  if (
    !source ||
    !Number.isSafeInteger(source.issuedAt) ||
    source.issuedAt > now + 30_000 ||
    now - source.issuedAt > 120_000 ||
    !(await verifyHmacSha256Hex(
      verificationJobSecret(),
      signedRequest(operation, args, source.issuedAt),
      source.mac,
    ))
  ) {
    throw new ConvexError({
      code: "UNKNOWN_ERROR",
      message: "Verification is temporarily unavailable.",
      retryAfterSec: 5,
    });
  }
}
