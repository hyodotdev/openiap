#!/usr/bin/env node

// Compares IAPKit's response enums against the spec every SDK generates from.
//
// Covers the /v1 verify response and kit's write path, which declares the same
// client-payload format set in four more files across a tsconfig split that
// stops them sharing a constant.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const SCHEMA_FILE = "specs/client/src/type.graphql";
export const CONVEX_STATE_FILE =
  "packages/kit/convex/purchases/purchaseState.ts";
export const RESPONSE_SCHEMA_FILE =
  "packages/kit/server/api/v1/route-response-schemas.ts";

// kit accepts a client-payload format on write and returns it on read. A format
// added to only one side is accepted then silently dropped by
// enforceVerifyResponseContract, so every declaration is compared to the spec.
export const WRITE_PATH_FORMAT_FILES = [
  "packages/kit/convex/schema.ts",
  "packages/kit/convex/products/query.ts",
  "packages/kit/convex/products/mutation.ts",
  "packages/kit/server/api/v1/products.ts",
];

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

// Source-text parsers can lie by matching the wrong declaration or reading a
// commented-out value, either of which reports agreement over a drifted repo.

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

const balancedGroupAt = (source, openIndex) => {
  const open = source[openIndex];
  const close = open === "(" ? ")" : "]";
  let level = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    if (source[i] === open) level += 1;
    else if (source[i] === close) {
      level -= 1;
      if (level === 0) return source.slice(openIndex, i + 1);
    }
  }
  return source.slice(openIndex);
};

/**
 * Client-payload format sets declared in a file, in each of the shapes kit uses:
 * a valibot union, a Set literal, and a TypeScript union type.
 */
export const parseFormatDeclarations = (source, knownFormat = "toml") => {
  const clean = stripComments(source);
  const groups = [];

  for (const opener of ["v.union(", "new Set<string>(", "= ["]) {
    let at = clean.indexOf(opener);
    while (at !== -1) {
      const openIndex = clean.indexOf(opener.endsWith("[") ? "[" : "(", at);
      groups.push(balancedGroupAt(clean, openIndex));
      at = clean.indexOf(opener, at + 1);
    }
  }
  for (const match of clean.matchAll(
    /"[a-z][a-z0-9_-]*"(?:\s*\|\s*"[a-z][a-z0-9_-]*")+/g,
  )) {
    groups.push(match[0]);
  }

  const declarations = groups
    .map((group) => [
      ...new Set(
        [...group.matchAll(/"([a-z][a-z0-9_-]*)"/g)].map((match) => match[1]),
      ),
    ])
    .filter((values) => values.includes(knownFormat));

  if (declarations.length === 0) {
    throw new Error("no client payload format declaration found");
  }
  return declarations;
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
  writePathFormatSources = Object.fromEntries(
    WRITE_PATH_FORMAT_FILES.map((file) => [file, read(file)]),
  ),
} = {}) => {
  // Anchors match raw text, so a comment inside a declaration would make one
  // miss and block the deploy gate.
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
      // Anchored on the owning declaration; `format:` alone is ambiguous.
      parseValibotLiteralUnion(
        responseSchema,
        "clientPayloadSchema = v\\.object\\(\\{\\s*format:\\s*",
      ),
    ),
    // Write path: a format kit accepts on write but the response schema omits
    // is silently dropped on read, so every declaration must match the spec.
    ...Object.entries(writePathFormatSources).flatMap(([file, source]) =>
      parseFormatDeclarations(source).flatMap((values, index) =>
        compare(
          `${file} client payload format declaration ${index + 1} vs ${SCHEMA_FILE} IapkitClientPayloadFormat`,
          specFormats,
          values,
        ),
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

export const runAudit = (sources) => {
  // Parsers signal drift by throwing; route that through the guidance below.
  let failures;
  try {
    failures = collectContractFailures(sources);
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
      "Change specs/client/src/type.graphql first, regenerate, and confirm every",
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
