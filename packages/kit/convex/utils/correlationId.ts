const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The /v1 edge issues a UUID per request (X-Correlation-Id). Anything else came
// from a direct Convex caller and is not stored.
export function correlationIdOrUndefined(
  value: string | undefined,
): string | undefined {
  return value !== undefined && UUID_PATTERN.test(value) ? value : undefined;
}
