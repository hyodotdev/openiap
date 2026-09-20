import assert from "node:assert/strict";
import Ajv from "ajv/dist/2020.js";
import {
  createGraphqlAdapter,
  createRestAdapter,
  operationVectors,
  runConformance,
} from "../conformance/index.mjs";
import { createMockProvider } from "../conformance/mock-provider.mjs";

// Fixture data only. The injected fetch never opens a network connection.
const provider = createMockProvider();
const baseUrl = "https://mock.provider.example";
const rest = createRestAdapter({
  baseUrl,
  fetch: provider.fetch,
  credentials: provider.credentials,
});
const graphql = createGraphqlAdapter({
  url: `${baseUrl}/commerce/v1/graphql`,
  fetch: provider.fetch,
  credentials: provider.credentials,
});
const { userId, googlePurchaseToken } = operationVectors.fixtures;
const evidence = {
  store: "google",
  google: { purchaseToken: googlePurchaseToken },
};

const capabilities = await rest.request({
  operation: "providerCapabilities",
  input: null,
  credential: null,
});
assert.equal(capabilities.kind, "result");
console.log("Declared profiles:", Object.keys(capabilities.data.profiles));

const verdict = await rest.request({
  operation: "verifyPurchase",
  input: evidence,
  credential: "verification",
});
assert.equal(verdict.kind, "result");
assert.equal(verdict.data.isValid, true);
console.log("Fixture verdict:", verdict.data.isValid);

const forbidden = await rest.request({
  operation: "entitlements",
  input: { userId },
  credential: "verification",
});
assert.equal(forbidden.kind, "error");
assert.equal(forbidden.code, "FORBIDDEN");
console.log("Account read with verification role:", forbidden.code);

// The mock seeds this purchase as already bound to the fixture user.
const binding = await rest.request({
  operation: "bindPurchase",
  input: { userId, ...evidence },
  credential: "server",
});
assert.equal(binding.kind, "result");
assert.equal(binding.data.bound, true);
const repeated = await rest.request({
  operation: "bindPurchase",
  input: { userId, ...evidence },
  credential: "server",
});
assert.deepEqual(repeated, binding);

const foreign = await rest.request({
  operation: "bindPurchase",
  input: { userId: operationVectors.fixtures.unknownUserId, ...evidence },
  credential: "server",
});
assert.equal(foreign.kind, "result");
assert.equal(foreign.data.bound, false);
console.log("Same-user binding repeats; another user cannot take it.");

const access = await rest.request({
  operation: "entitlements",
  input: { userId },
  credential: "server",
});
const graphqlAccess = await graphql.request({
  operation: "entitlements",
  input: { userId },
  credential: "server",
});
assert.equal(access.kind, "result");
assert.equal(graphqlAccess.kind, "result");
assert.deepEqual(graphqlAccess.data, access.data);
console.log("REST and GraphQL products:", access.data.productIds);

const report = await runConformance({
  adapters: [rest, graphql],
  Ajv,
  credentials: provider.credentials,
});
assert.equal(
  report.ok,
  true,
  JSON.stringify({
    failures: report.results.filter((result) => !result.ok),
    parityFailures: report.parityFailures,
  }),
);
console.log(
  `Conformance: ${report.results.length} checks passed; parity passed.`,
);
