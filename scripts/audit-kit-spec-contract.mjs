#!/usr/bin/env node

// IAPKit deploys from `main` on its own workflow, while the native SDKs that
// decode its `/v1` responses are frozen inside already-published apps. The
// enums below are declared three times — kit's persisted Convex state, kit's
// OpenAPI response documentation, and the GraphQL schema that generates every
// SDK type. Nothing else in the repo compares them, so a kit-only change could
// put a value on the wire that shipped SDKs and published docs know nothing
// about. This audit is that comparison.

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

/** GraphQL enum members, with docstrings and comments stripped. */
export const parseGraphqlEnum = (source, name) => {
  const block = new RegExp(`\\benum\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`).exec(
    source,
  );
  if (!block) throw new Error(`enum ${name} not found`);
  return block[1]
    .replace(/"""[\s\S]*?"""/g, "")
    .split("\n")
    .map((line) => line.replace(/#.*$/, "").trim())
    .filter((line) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(line));
};

/** `export enum Name { KEY = "VALUE" }` — the string values reach the wire. */
export const parseTypescriptEnum = (source, name) => {
  const block = new RegExp(
    `\\bexport enum\\s+${name}\\s*\\{([\\s\\S]*?)\\n\\}`,
  ).exec(source);
  if (!block) throw new Error(`enum ${name} not found`);
  return [...block[1].matchAll(/=\s*"([^"]+)"/g)].map((match) => match[1]);
};

/** The `unifiedPurchaseStates` table documenting `/v1/purchase/verify`. */
export const parseDocumentedStates = (source) => {
  const block = /const unifiedPurchaseStates = \[([\s\S]*?)\n\] as const;/.exec(
    source,
  );
  if (!block) throw new Error("unifiedPurchaseStates table not found");
  return [...block[1].matchAll(/name:\s*"([^"]+)"/g)].map((match) => match[1]);
};

/** Literal members of a valibot union, located by the text preceding it. */
export const parseValibotLiteralUnion = (source, anchor) => {
  const block = new RegExp(`${anchor}v\\.union\\(\\[([\\s\\S]*?)\\]\\)`).exec(
    source,
  );
  if (!block) throw new Error(`valibot union after ${anchor.trim()} not found`);
  return [...block[1].matchAll(/v\.literal\("([^"]+)"\)/g)].map(
    (match) => match[1],
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
  responseSchema = read(RESPONSE_SCHEMA_FILE),
} = {}) => {
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
      parseValibotLiteralUnion(responseSchema, "format: "),
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
  const failures = collectContractFailures();
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
