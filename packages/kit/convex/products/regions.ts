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

// ISO 3166-1 reserves these for private/user assignment, and CLDR maps
// `ZZ` to "Unknown Region", so `Intl` happily resolves several of them.
// They are never a Play sales region. `XK` (Kosovo) sits in the
// user-assigned range but is a real territory CLDR names, so it is not
// listed here — whether Play prices it is answered by the sync, which
// reports any requested region Play returns no price for.
const RESERVED_REGION_CODES = new Set(["AA", "ZZ"]);
const RESERVED_REGION_PREFIXES = ["Q", "X"];

/**
 * Whether a code names a real territory.
 *
 * `Intl.DisplayNames` echoes the input back when it cannot resolve a
 * region, which catches ordinary typos ("QQ"). It does not catch the
 * reserved ranges, so those are excluded explicitly rather than by
 * shipping a hardcoded country list that would go stale.
 */
function isAssignedRegion(code: string): boolean {
  if (RESERVED_REGION_CODES.has(code)) return false;
  if (
    code !== "XK" &&
    RESERVED_REGION_PREFIXES.includes(code[0]) &&
    code[1] >= "A" &&
    code[1] <= "Z"
  ) {
    return code[0] === "Q" ? code[1] < "M" : false;
  }
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) !== code;
  } catch {
    return false;
  }
}

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
    if (!REGION_PATTERN.test(code) || !isAssignedRegion(code)) {
      // Structured so REST/MCP surface a 400 rather than a generic 500.
      throw new ConvexError({
        code: "INVALID_INPUT",
        message: `Invalid sales region "${raw}". Use an assigned two-letter ISO 3166-1 country code such as "US" or "KR".`,
      });
    }
    seen.add(code);
  }
  return Array.from(seen).sort();
}
