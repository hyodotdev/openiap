import assert from "node:assert/strict";
import test from "node:test";
import {
  collectContractFailures,
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
  assert.deepEqual(parseValibotLiteralUnion(RESPONSE_SCHEMA, "format: "), [
    "toml",
    "json",
  ]);
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
