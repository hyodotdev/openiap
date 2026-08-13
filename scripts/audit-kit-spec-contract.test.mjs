import assert from "node:assert/strict";
import test from "node:test";
import {
  collectContractFailures,
  runAudit,
  parseDocumentedStates,
  parseGraphqlEnum,
  parseTypescriptEnum,
  parseValibotLiteralUnion,
} from "./audit-kit-spec-contract.mjs";

const SCHEMA = `
enum IapStore {
  Unknown
  Apple
  Google
}

"""
Unified purchase states from IAPKit verification response.
"""
enum IapkitPurchaseState {
  """
  User is entitled to the product.
  """
  ENTITLED
  # trailing comment
  EXPIRED
}

enum IapkitClientPayloadFormat {
  Toml
  Json
}
`;

const CONVEX_STATE = `
export enum HarmonizedPurchaseState {
  // Purchase is complete and valid
  ENTITLED = "ENTITLED",
  EXPIRED = "EXPIRED",
}
`;

const RESPONSE_SCHEMA = `
const unifiedPurchaseStates = [
  { name: "ENTITLED", description: "Purchase is complete and active." },
  { name: "EXPIRED", description: "Entitlement has expired." },
] as const;

const verifyStoreSchema = v.union([v.literal("apple"), v.literal("google")]);

const clientPayloadSchema = v.object({
  format: v.union([v.literal("toml"), v.literal("json")]),
  body: v.string(),
});
`;

const CLIENT_PAYLOAD_FORMAT_ANCHOR =
  "clientPayloadSchema = v\\.object\\(\\{\\s*format:\\s*";

const sources = (overrides = {}) => ({
  schema: SCHEMA,
  convexState: CONVEX_STATE,
  responseSchema: RESPONSE_SCHEMA,
  ...overrides,
});

test("parsers read each declaration style", () => {
  assert.deepEqual(parseGraphqlEnum(SCHEMA, "IapkitPurchaseState"), [
    "ENTITLED",
    "EXPIRED",
  ]);
  assert.deepEqual(
    parseTypescriptEnum(CONVEX_STATE, "HarmonizedPurchaseState"),
    ["ENTITLED", "EXPIRED"],
  );
  assert.deepEqual(parseDocumentedStates(RESPONSE_SCHEMA), [
    "ENTITLED",
    "EXPIRED",
  ]);
  assert.deepEqual(
    parseValibotLiteralUnion(RESPONSE_SCHEMA, "const verifyStoreSchema = "),
    ["apple", "google"],
  );
  assert.deepEqual(
    parseValibotLiteralUnion(RESPONSE_SCHEMA, CLIENT_PAYLOAD_FORMAT_ANCHOR),
    ["toml", "json"],
  );
});

// The dangerous failure is agreeing over a drifted repo; both cases below
// returned no failures before the anchors were qualified.

test("a second format union cannot be mistaken for the contract", () => {
  const withDecoy = RESPONSE_SCHEMA.replace(
    "const unifiedPurchaseStates",
    'const decoySchema = v.object({\n  format: v.union([v.literal("toml"), v.literal("json")]),\n});\n\nconst unifiedPurchaseStates',
  ).replace(
    'v.literal("json")]),\n  body:',
    'v.literal("json"), v.literal("yaml")]),\n  body:',
  );

  const failures = collectContractFailures(
    sources({ responseSchema: withDecoy }),
  );
  assert.equal(failures.length, 1);
  assert.match(failures[0], /clientPayload format.*unexpected.*yaml/);
});

test("an ambiguous anchor throws instead of picking a declaration", () => {
  const twice = `${RESPONSE_SCHEMA}\nconst verifyStoreSchema = v.union([v.literal("apple")]);\n`;
  assert.throws(
    () => parseValibotLiteralUnion(twice, "const verifyStoreSchema = "),
    /matched 2 times/,
  );
});

test("a commented-out documented state is not counted", () => {
  const failures = collectContractFailures(
    sources({
      responseSchema: RESPONSE_SCHEMA.replace(
        '  { name: "EXPIRED", description: "Entitlement has expired." },',
        '  // { name: "EXPIRED", description: "Entitlement has expired." },',
      ),
    }),
  );
  assert.equal(failures.length, 1);
  assert.match(failures[0], /unifiedPurchaseStates.*missing.*EXPIRED/);
});

test("a commented-out literal is not counted", () => {
  const failures = collectContractFailures(
    sources({
      responseSchema: RESPONSE_SCHEMA.replace(
        'v.union([v.literal("toml"), v.literal("json")])',
        'v.union([v.literal("toml") /* , v.literal("json") */])',
      ),
    }),
  );
  assert.equal(failures.length, 1);
  assert.match(failures[0], /clientPayload format.*missing.*json/);
});

test("a comment above the anchored field does not break the audit", () => {
  // The audit gates the kit deploy; a doc edit must not block a release.
  assert.deepEqual(
    collectContractFailures(
      sources({
        responseSchema: RESPONSE_SCHEMA.replace(
          "const clientPayloadSchema = v.object({\n  format:",
          "const clientPayloadSchema = v.object({\n  // public app data\n  format:",
        ),
      }),
    ),
    [],
  );
});

test("an unreadable declaration is reported, not thrown", () => {
  // deploy-kit.yml gates on this, so the operator has to see the guidance.
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => errors.push(args.join(" "));
  try {
    assert.equal(
      runAudit(sources({ responseSchema: "const nothing = 1;\n" })),
      false,
    );
  } finally {
    console.error = originalError;
  }
  assert.match(errors.join("\n"), /could not read a declaration/);
  assert.match(errors.join("\n"), /type\.graphql/);
});

test("a declaration that parses to nothing is a failure, not agreement", () => {
  assert.throws(
    () =>
      parseTypescriptEnum("export enum Empty {\n  // nothing\n}\n", "Empty"),
    /parsed to an empty list/,
  );
});

test("aligned declarations produce no failures", () => {
  assert.deepEqual(collectContractFailures(sources()), []);
});

test("a state added only to kit's persisted enum fails", () => {
  const failures = collectContractFailures(
    sources({
      convexState: CONVEX_STATE.replace(
        `EXPIRED = "EXPIRED",`,
        `EXPIRED = "EXPIRED",\n  REFUNDED = "REFUNDED",`,
      ),
    }),
  );
  assert.equal(failures.length, 1);
  assert.match(failures[0], /HarmonizedPurchaseState.*unexpected.*REFUNDED/);
});

test("a state added to the spec but not to kit fails", () => {
  const failures = collectContractFailures(
    sources({
      schema: SCHEMA.replace("  EXPIRED\n", "  EXPIRED\n  PENDING\n"),
    }),
  );
  assert.equal(failures.length, 2);
  for (const failure of failures) assert.match(failure, /missing.*PENDING/);
});

test("a documented state kit cannot emit fails", () => {
  const failures = collectContractFailures(
    sources({
      responseSchema: RESPONSE_SCHEMA.replace(
        `{ name: "EXPIRED", description: "Entitlement has expired." },`,
        `{ name: "EXPIRED", description: "Entitlement has expired." },\n  { name: "CONSUMED", description: "Fulfilled." },`,
      ),
    }),
  );
  assert.equal(failures.length, 1);
  assert.match(failures[0], /unifiedPurchaseStates.*unexpected.*CONSUMED/);
});

test("a client payload format the SDKs cannot decode fails", () => {
  const failures = collectContractFailures(
    sources({
      responseSchema: RESPONSE_SCHEMA.replace(
        `v.union([v.literal("toml"), v.literal("json")])`,
        `v.union([v.literal("toml"), v.literal("json"), v.literal("yaml")])`,
      ),
    }),
  );
  assert.equal(failures.length, 1);
  assert.match(failures[0], /clientPayload format.*unexpected.*yaml/);
});

test("a verify store the spec does not name fails", () => {
  const failures = collectContractFailures(
    sources({
      responseSchema: RESPONSE_SCHEMA.replace(
        `v.literal("google")]`,
        `v.literal("google"), v.literal("steam")]`,
      ),
    }),
  );
  assert.equal(failures.length, 1);
  assert.match(failures[0], /verifyStoreSchema.*"steam".*IapStore/);
});

test("kit may verify fewer stores than the spec names", () => {
  assert.deepEqual(
    collectContractFailures(
      sources({
        responseSchema: RESPONSE_SCHEMA.replace(`, v.literal("google")]`, "]"),
      }),
    ),
    [],
  );
});
