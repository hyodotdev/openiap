#!/usr/bin/env node

// IAPKit deploys from `main` on its own workflow, while the native SDKs that
// decode its `/v1` responses are frozen inside already-published apps. The
// enums below are declared three times — kit's persisted Convex state, kit's
// OpenAPI response documentation, and the GraphQL schema that generates every
// SDK type. Nothing else in the repo compares them, so a kit-only change could
// put a value on the wire that shipped SDKs and published docs know nothing
// about. This audit is that comparison.
//
// Scope: the /v1 verify RESPONSE contract only. kit's write path declares the
// client-payload format set again in convex/schema.ts (twice),
// convex/products/{query,mutation}.ts and server/api/v1/products.ts, and the
// environment pair again in convex/schema.ts and convex/purchases/shared.ts.
// Those live on the other side of kit's server/convex tsconfig split, so they
// cannot share a constant without moving a module; until they do, a format
// accepted on write but absent from the response schema is silently dropped by
// enforceVerifyResponseContract rather than caught here.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const SCHEMA_FILE = "packages/gql/src/type.graphql";
export const CONVEX_STATE_FILE =
  "packages/kit/convex/purchases/purchaseState.ts";
export const RESPONSE_SCHEMA_FILE =
  "packages/kit/server/api/v1/route-response-schemas.ts";

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

// These are source-text parsers, so the two ways they can lie are worse than
// the ways they can fail: matching the wrong declaration, or reading a value
// that is commented out. Both would report agreement over a drifted repo.
// `matchExactlyOnce` closes the first, `stripComments` the second, and every
// parser rejects an empty result rather than comparing two empty lists.

const matchExactlyOnce = (source, pattern, label) => {
  const matches = [...source.matchAll(new RegExp(pattern, "g"))];
  if (matches.length === 0) throw new Error(`${label} not found`);
  if (matches.length > 1) {
    throw new Error(
      `${label} matched ${matches.length} times — the anchor is ambiguous, so the audit cannot tell which declaration is the contract`,
    );
  }
  return matches[0];
};

const stripComments = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "$1");

const nonEmpty = (values, label) => {
  if (values.length === 0) throw new Error(`${label} parsed to an empty list`);
  return values;
};

/** GraphQL enum members, with docstrings and comments stripped. */
export const parseGraphqlEnum = (source, name) => {
  const block = matchExactlyOnce(
    source,
    `\\benum\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`,
    `enum ${name}`,
  );
  return nonEmpty(
    block[1]
      .replace(/"""[\s\S]*?"""/g, "")
      .split("\n")
      .map((line) => line.replace(/#.*$/, "").trim())
      .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(line)),
    `enum ${name}`,
  );
};

/** `export enum Name { KEY = "VALUE" }` — the string values reach the wire. */
export const parseTypescriptEnum = (source, name) => {
  const block = matchExactlyOnce(
    source,
    `\\bexport enum\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`,
    `enum ${name}`,
  );
  return nonEmpty(
    [...stripComments(block[1]).matchAll(/=\s*"([^"]+)"/g)].map(
      (match) => match[1],
    ),
    `enum ${name}`,
  );
};

/** The `unifiedPurchaseStates` table documenting `/v1/purchase/verify`. */
export const parseDocumentedStates = (source) => {
  const block = matchExactlyOnce(
    source,
    `const unifiedPurchaseStates = \\[([\\s\\S]*?)\\n\\] as const;`,
    "unifiedPurchaseStates table",
  );
  return nonEmpty(
    [...stripComments(block[1]).matchAll(/name:\s*"([^"]+)"/g)].map(
      (match) => match[1],
    ),
    "unifiedPurchaseStates table",
  );
};

/**
 * Literal members of a valibot union. `anchor` must name the owning
 * declaration, not just the field, so a second field of the same name
 * elsewhere in the file is a loud failure rather than a wrong answer.
 */
export const parseValibotLiteralUnion = (source, anchor) => {
  const block = matchExactlyOnce(
    source,
    `${anchor}v\\.union\\(\\[([\\s\\S]*?)\\]\\)`,
    `valibot union after ${anchor.trim()}`,
  );
  return nonEmpty(
    [...stripComments(block[1]).matchAll(/v\.literal\("([^"]+)"\)/g)].map(
      (match) => match[1],
    ),
    `valibot union after ${anchor.trim()}`,
  );
};

const compare = (label, expected, actual) => {
  const failures = [];
  const missing = expected.filter((value) => !actual.includes(value));
  const extra = actual.filter((value) => !expected.includes(value));
  if (missing.length > 0) {
    failures.push(`${label}: missing ${JSON.stringify(missing)}`);
  }
  if (extra.length > 0) {
    failures.push(`${label}: unexpected ${JSON.stringify(extra)}`);
  }
  return failures;
};

export const collectContractFailures = ({
  schema = read(SCHEMA_FILE),
  convexState = read(CONVEX_STATE_FILE),
  responseSchema: rawResponseSchema = read(RESPONSE_SCHEMA_FILE),
} = {}) => {
  // Anchors match raw text, so comments are removed before anchoring too:
  // otherwise a comment added between `v.object({` and `format:` would make an
  // anchor miss and block the deploy gate over a documentation edit.
  const responseSchema = stripComments(rawResponseSchema);
  const specStates = parseGraphqlEnum(schema, "IapkitPurchaseState");
  // GraphQL members are PascalCase for these two; the wire values are lowercase.
  const specFormats = parseGraphqlEnum(schema, "IapkitClientPayloadFormat").map(
    (member) => member.toLowerCase(),
  );
  const specStores = parseGraphqlEnum(schema, "IapStore").map((member) =>
    member.toLowerCase(),
  );

  return [
    ...compare(
      `${CONVEX_STATE_FILE} HarmonizedPurchaseState vs ${SCHEMA_FILE} IapkitPurchaseState`,
      specStates,
      parseTypescriptEnum(convexState, "HarmonizedPurchaseState"),
    ),
    ...compare(
      `${RESPONSE_SCHEMA_FILE} unifiedPurchaseStates vs ${SCHEMA_FILE} IapkitPurchaseState`,
      specStates,
      parseDocumentedStates(responseSchema),
    ),
    ...compare(
      `${RESPONSE_SCHEMA_FILE} clientPayload format vs ${SCHEMA_FILE} IapkitClientPayloadFormat`,
      specFormats,
      // Anchored on the owning declaration: `format:` alone would silently
      // read a different schema's field if one were added above this one.
      parseValibotLiteralUnion(
        responseSchema,
        "clientPayloadSchema = v\\.object\\(\\{\\s*format:\\s*",
      ),
    ),
    // Stores are one-directional: kit may verify fewer stores than the spec
    // names, but never one the spec omits — no SDK could ask for it.
    ...parseValibotLiteralUnion(responseSchema, "const verifyStoreSchema = ")
      .filter((store) => !specStores.includes(store))
      .map(
        (store) =>
          `${RESPONSE_SCHEMA_FILE} verifyStoreSchema: ${JSON.stringify(store)} is not in ${SCHEMA_FILE} IapStore`,
      ),
  ];
};

export const runAudit = () => {
  // The hardened parsers signal drift by throwing, so those cases have to reach
  // the guidance below rather than surfacing as a bare stack trace — in
  // deploy-kit.yml this message is what a blocked operator reads.
  let failures;
  try {
    failures = collectContractFailures();
  } catch (error) {
    failures = [`could not read a declaration: ${error.message}`];
  }
  if (failures.length > 0) {
    console.error("IAPKit spec contract audit failed:\n");
    for (const failure of failures) console.error(`- ${failure}`);
    console.error(
      "\nThe /v1 verify response carries enums that already-published SDKs decode.",
    );
    console.error(
      "Change packages/gql/src/type.graphql first, regenerate, and confirm every",
    );
    console.error(
      "SDK degrades unknown values instead of failing the receipt.",
    );
    return false;
  }

  console.log(
    "IAPKit spec contract audit passed (purchase states, client payload formats, verify stores).",
  );
  return true;
};

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain && !runAudit()) process.exitCode = 1;
