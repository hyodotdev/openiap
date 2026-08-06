import { ConvexError, v } from "convex/values";

// Where a product is sold. Leaving this unset keeps the default that
// fixes issue #288 — price the product in every region Play converts
// into, matching Play Console's own bulk-pricing flow — while an
// explicit list lets an operator who only ships to a few markets say so
// instead of having kit decide for them.
//
// Note this is product-level. An app is only installable in the
// countries it is distributed to, so regions beyond that are inert
// either way; the list matters for operators who want the catalog to
// state their footprint rather than inherit Play's whole map, and for
// keeping a product out of regions Play adds in future.

/** ISO 3166-1 alpha-2, which is what Play's `regionCode` accepts. */
const REGION_PATTERN = /^[A-Z]{2}$/;

export const productRegionsValidator = v.array(v.string());

/**
 * Normalizes and validates an operator-supplied sales-region list.
 *
 * @param regions Raw codes from the dashboard / MCP / REST.
 * @returns Sorted, de-duplicated codes, or undefined when unset.
 * @throws When a code is not a two-letter ISO 3166-1 alpha-2 region.
 */
export function normalizeProductRegions(
  regions: string[] | undefined,
): string[] | undefined {
  if (!regions || regions.length === 0) return undefined;

  const seen = new Set<string>();
  for (const raw of regions) {
    const code = raw.trim().toUpperCase();
    if (!REGION_PATTERN.test(code)) {
      // Structured so REST/MCP surface a 400 rather than a generic 500.
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: `Invalid sales region "${raw}". Use a two-letter ISO 3166-1 code such as "US" or "KR".`,
      });
    }
    seen.add(code);
  }
  return Array.from(seen).sort();
}
