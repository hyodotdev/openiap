// Direct JSON imports embed the generated artifacts into the compiled
// binary; the spec package's runtime loader reads files that do not exist
// inside a single-file build.
import HTTP_BINDING from "openiap-commerce-protocol/generated/bindings/http-binding.json";

/**
 * One protocol operation failure. Messages cross the trust boundary, so they
 * carry no credentials, store evidence, stack traces, or source paths.
 */
export class ProtocolOperationError extends Error {
  readonly code: string;
  readonly retryAfterSec?: number;

  constructor(code: string, message: string, retryAfterSec?: number) {
    super(message);
    this.code = code;
    this.retryAfterSec = retryAfterSec;
  }
}

export function protocolErrorStatus(code: string): number {
  return (
    (HTTP_BINDING.errorStatus as Record<string, number>)[code] ??
    HTTP_BINDING.errorStatus.INTERNAL_ERROR
  );
}

/**
 * Maps a Convex-reported error code onto the portable code space, or returns
 * null when the code is not one of the transport-level classes (auth, input,
 * rate limit). A null lets the caller fall back to the operation's own default
 * — VERIFICATION_FAILED on the verify path — so a structured store/provider
 * verification error surfaces as 502, not a generic 500.
 */
export function protocolCodeForConvexError(code: string): string | null {
  switch (code) {
    case "INVALID_API_KEY":
    case "MISSING_API_KEY":
      return "UNAUTHORIZED";
    case "INSUFFICIENT_SCOPE":
      return "FORBIDDEN";
    case "INVALID_INPUT":
      return "INVALID_REQUEST";
    case "RATE_LIMITED":
      return "RATE_LIMITED";
    default:
      return null;
  }
}
