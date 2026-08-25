import { ErrorCode } from "../../convex/utils/errors";

/** Reads the code from `ConvexError.data`; production redacts plain Errors. */
export function appErrorCode(error: unknown): ErrorCode | undefined {
  const data = (error as { data?: unknown } | null | undefined)?.data;
  if (!data || typeof data !== "object" || !("code" in data)) return undefined;

  const { code } = data as { code?: unknown };
  return Object.values(ErrorCode).find((declared) => declared === code);
}
