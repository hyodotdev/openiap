import { ConvexError, v } from "convex/values";

// Where a product is sold. Leaving this unset uses Play's sell-everywhere
// default for a new product, while an existing product inherits its
// current footprint. An explicit list lets an operator who only ships to
// a few markets say so, and `"all"` requests a deliberate expansion.
//
// Note this is product-level. An app is only installable in the
// countries it is distributed to, so regions beyond that are inert
// either way; the list matters for operators who want the catalog to
// state their footprint rather than inherit Play's whole map, and for
// keeping a product out of regions Play adds in future.

// The current ISO 3166-1 alpha-2 assignment table, plus XK (Kosovo),
// which Play and CLDR commonly expose even though ISO reserves it for
// user assignment. Keep this explicit: Intl.DisplayNames also recognizes
// macroregions, compatibility aliases, deleted assignments, and CLDR
// pseudo-regions that Play does not accept as country sales regions.
const ASSIGNED_REGION_CODES = new Set(
  `
AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ
BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ
CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ
DE DJ DK DM DO DZ
EC EE EG EH ER ES ET
FI FJ FK FM FO FR
GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY
HK HM HN HR HT HU
ID IE IL IM IN IO IQ IR IS IT
JE JM JO JP
KE KG KH KI KM KN KP KR KW KY KZ
LA LB LC LI LK LR LS LT LU LV LY
MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ
NA NC NE NF NG NI NL NO NP NR NU NZ
OM
PA PE PF PG PH PK PL PM PN PR PS PT PW PY
QA
RE RO RS RU RW
SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ
TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ
UA UG UM US UY UZ
VA VC VE VG VI VN VU
WF WS
XK
YE YT
ZA ZM ZW
  `
    .trim()
    .split(/\s+/),
);

/**
 * Whether a code names a current country or territory Play may price.
 */
function isAssignedRegion(code: string): boolean {
  return ASSIGNED_REGION_CODES.has(code);
}

/**
 * A product's sales footprint, as three distinct states:
 *
 * - `["US","KR"]` — exactly these regions; anything else is withdrawn.
 * - `"all"` — wherever Play prices the product, including markets it
 *   launches later. An expansion the operator asked for.
 * - unset — inherit. New products go everywhere (Play Console's own
 *   default); a product Play already knows keeps the regions it has.
 *
 * The third state exists because "unset" used to mean "all", which
 * turned a price edit on a US-only product into a push to 173 markets.
 */
export const productRegionsValidator = v.union(
  v.literal("all"),
  v.array(v.string()),
);

export type ProductRegions = "all" | string[];

/**
 * Normalizes and validates an operator-supplied sales-region list.
 *
 * @param regions Raw codes from the dashboard / MCP / REST.
 * @returns Sorted, de-duplicated codes, or undefined when unset.
 * @throws When a code is not a two-letter ISO 3166-1 alpha-2 region.
 */
export function normalizeProductRegions(
  regions: ProductRegions | undefined,
): ProductRegions | undefined {
  if (regions === "all") return "all";
  // An empty list is not a footprint of zero regions — Play has no way
  // to express "sold nowhere", and a product that reaches the write with
  // one would be silently unbuyable. Treat it as unset, the same way a
  // cleared field in the dashboard means "stop restricting".
  if (!regions || regions.length === 0) return undefined;

  const seen = new Set<string>();
  for (const raw of regions) {
    const code = raw.trim().toUpperCase();
    if (!isAssignedRegion(code)) {
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
