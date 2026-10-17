import { ErrorCode } from "../../convex/utils/errors";

/** Reads the code from `ConvexError.data`; production redacts plain Errors. */
export function appErrorCode(error: unknown): ErrorCode | undefined {
  const data = (error as { data?: unknown } | null | undefined)?.data;
  if (!data || typeof data !== "object" || !("code" in data)) return undefined;

  const { code } = data as { code?: unknown };
  return Object.values(ErrorCode).find((declared) => declared === code);
}

/**
 * The sentence a Convex function wrote, from `{ code, message }` data or a
 * JSON `{ message }` string. `error.message` carries Convex's wrapper text.
 */
export function convexErrorMessage(error: unknown): string {
  const data = (error as { data?: unknown } | null | undefined)?.data;
  const fromObject = (value: unknown): string | undefined => {
    const message = (value as { message?: unknown } | null)?.message;
    return typeof message === "string" ? message : undefined;
  };
  if (typeof data === "string") {
    try {
      return fromObject(JSON.parse(data)) ?? data;
    } catch {
      return data;
    }
  }
  return (
    fromObject(data) ?? (error instanceof Error ? error.message : String(error))
  );
}
