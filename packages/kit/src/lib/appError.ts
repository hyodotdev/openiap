import { ErrorCode } from "../../convex/utils/errors";

/**
 * Reads the error code a Convex mutation reports on `ConvexError.data`.
 *
 * Production deployments redact plain Errors to "Server Error", so the code
 * only survives as application-error data.
 */
export function appErrorCode(error: unknown): ErrorCode | undefined {
  const data = (error as { data?: unknown } | null | undefined)?.data;
  if (!data || typeof data !== "object" || !("code" in data)) return undefined;

  const { code } = data as { code?: unknown };
  return Object.values(ErrorCode).find((declared) => declared === code);
}
