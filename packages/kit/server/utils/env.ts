// Defensive parsers for server-side environment variables. Centralized
// because the Bun server and the rate-limit middleware both need to
// reject the same three classes of misconfiguration:
//
//   1. unset / empty string → return fallback
//   2. non-numeric strings  → `Number("pineapple") === NaN` silently
//                             breaks `Math.min`, `Bun.serve({port})`,
//                             anything downstream. Treat as fallback.
//   3. out-of-range         → a 0 or -1 capacity would let every
//                             request through; a port of 0 would tell
//                             Bun to bind a random port, making the
//                             deployment unpredictable.

/**
 * Parse a positive number from an env var string, falling back when
 * the value is unset, not finite, or below the caller-supplied `min`.
 */
export function parsePositiveNumber(
  raw: string | undefined,
  fallback: number,
  min: number,
): number {
  if (raw === undefined || raw === "") return fallback;
  const value = raw.trim();
  if (!/^\d+(?:\.\d+)?$/.test(value)) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || n < min) return fallback;
  return n;
}

/**
 * Parse a TCP port (1–65535) from an env var. Rejects non-integers and
 * out-of-range values so `Bun.serve({ port })` never binds to 0
 * (random) or throws on NaN.
 */
export function parsePort(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === "") return fallback;
  const value = raw.trim();
  if (!/^\d+$/.test(value)) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1 || n > 65_535) {
    return fallback;
  }
  return n;
}
