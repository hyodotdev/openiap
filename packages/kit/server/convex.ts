import { ConvexHttpClient } from "convex/browser";
import { ConvexError } from "convex/values";
import * as v from "valibot";

// Prefer VITE_KIT_CONVEX_URL (managed by the Convex CLI / build args)
// and fall back to CONVEX_URL for environments that only export the
// plain name.
const convexUrl = process.env.VITE_KIT_CONVEX_URL ?? process.env.CONVEX_URL;
if (!convexUrl) {
  throw new Error(
    "Set VITE_KIT_CONVEX_URL (or CONVEX_URL) before starting the server.",
  );
}
export const client = new ConvexHttpClient(convexUrl);

// Used by the SSE webhook stream to subscribe to live query updates
// instead of polling. The reactive client is exported lazily so unit
// tests that only need `client` (the HTTP client) don't pay for a
// WebSocket dial when no subscription is opened.
export const convexUrlForRealtime = convexUrl;

interface ApiError {
  code: string;
  message: string;
}

export function handleConvexError(error: unknown): ApiError | null {
  if (error instanceof ConvexError === false) {
    return null;
  }

  return getConvexError(error);
}

function getConvexError(error: ConvexError<string>): ApiError | null {
  if (typeof error.data !== "string") {
    return null;
  }

  // Structured error — the mutation/action threw
  // `new ConvexError(JSON.stringify({ error, message }))`.
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
  // `new ConvexError("some message")`. Return a generic mapping so the
  // API surface responds with the original message + a stable code
  // rather than a 500 / "UNKNOWN_ERROR".
  return {
    code: "CONVEX_ERROR",
    message: error.data,
  };
}
