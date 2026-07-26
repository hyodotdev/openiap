import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import * as v from "valibot";

export function resolveServerConvexUrl(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  const convexUrl = [
    env.VITE_KIT_CONVEX_URL,
    env.CONVEX_URL,
    env.VITE_CONVEX_URL,
  ].find(
    (value): value is string =>
      typeof value === "string" && value.trim().length > 0,
  );

  if (convexUrl) return convexUrl.trim();

  throw new Error(
    "Set VITE_KIT_CONVEX_URL or CONVEX_URL, or run `convex dev` to generate VITE_CONVEX_URL.",
  );
}

// Production uses the dedicated build/runtime names. A fresh `convex dev`
// checkout writes VITE_CONVEX_URL, so keep that standard CLI value as the
// final local-development fallback.
const convexUrl = resolveServerConvexUrl();
export const client = new ConvexHttpClient(convexUrl);

interface ApiError {
  code: string;
  message: string;
  actualVersion?: number | null;
  expectedVersion?: number;
  byteLength?: number;
  maxBytes?: number;
}

export function handleConvexError(error: unknown): ApiError | null {
  if (error instanceof ConvexError === false) {
    return null;
  }

  return getConvexError(error);
}

function getConvexError(error: ConvexError<string>): ApiError | null {
  // Structured object-shaped error — the mutation/action threw
  // `new ConvexError({ code, message })`. Convex preserves the object
  // shape across the wire (data isn't always a string).
  if (typeof error.data === "object" && error.data !== null) {
    const objectResult = v.safeParse(
      v.object({
        code: v.string(),
        message: v.string(),
        actualVersion: v.optional(v.nullable(v.number())),
        expectedVersion: v.optional(v.number()),
        byteLength: v.optional(v.number()),
        maxBytes: v.optional(v.number()),
      }),
      error.data,
    );
    if (objectResult.success) {
      return {
        code: objectResult.output.code,
        message: objectResult.output.message,
        ...(objectResult.output.actualVersion !== undefined
          ? { actualVersion: objectResult.output.actualVersion }
          : {}),
        ...(objectResult.output.expectedVersion !== undefined
          ? { expectedVersion: objectResult.output.expectedVersion }
          : {}),
        ...(objectResult.output.byteLength !== undefined
          ? { byteLength: objectResult.output.byteLength }
          : {}),
        ...(objectResult.output.maxBytes !== undefined
          ? { maxBytes: objectResult.output.maxBytes }
          : {}),
      };
    }
    // Fall through to legacy `{ error, message }` shape for backward
    // compat with any callers that didn't migrate to `{ code, message }`.
    const legacyResult = v.safeParse(
      v.object({
        error: v.string(),
        message: v.string(),
      }),
      error.data,
    );
    if (legacyResult.success) {
      return {
        code: legacyResult.output.error,
        message: legacyResult.output.message,
      };
    }
    return null;
  }

  if (typeof error.data !== "string") {
    return null;
  }

  // Legacy structured error — `new ConvexError(JSON.stringify({ error, message }))`.
  try {
    const data = JSON.parse(error.data);

    const result = v.safeParse(
      v.object({
        error: v.string(),
        message: v.string(),
      }),
      data,
    );

    if (result.success) {
      return {
        code: result.output.error,
        message: result.output.message,
      };
    }
  } catch {
    // Fall through to the plain-string fallback below.
  }

  // Unstructured error — the mutation/action threw
  // `new ConvexError("some message")`. Treat it as internal so public
  // route layers use their generic 500 fallback instead of exposing
  // arbitrary backend details as client-safe text.
  return null;
}
