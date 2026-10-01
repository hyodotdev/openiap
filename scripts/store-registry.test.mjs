import assert from "node:assert/strict";
import { DART_KEYWORDS } from "../specs/client/codegen/core/dart-keywords.mjs";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  maintenanceStatus,
  validateProviderReport,
  validateStoreRegistry,
} from "../specs/client/store-registry.mjs";
import { requiredProviderBehaviors } from "../packages/conformance/src/spec/android-provider-profile.mjs";
import { SUITE_VERSION } from "../packages/conformance/src/spec/suite-version.mjs";

const registry = () =>
  JSON.parse(
    readFileSync(
      new URL("../specs/client/src/store-registry.json", import.meta.url),
      "utf8",
    ),
  );
const report = (capabilities = ["pendingPurchases"]) => {
  const required = requiredProviderBehaviors(capabilities);
  return {
    suiteVersion: SUITE_VERSION,
    clientProtocolVersion: "0.1.1",
    store: "unknown",
    storeId: "community-fixture",
    capabilities,
    conformant: true,
    scope: {
      kind: "android-provider",
      complete: true,
      requiredBehaviors: required,
    },
    results: required.map((id) => ({ id, outcome: "pass" })),
  };
};
const community = () => ({
  id: "community-fixture",
  platform: "android",
  displayName: "Fixture",
  tier: "community",
  aliases: ["fixture"],
  maintainers: ["example"],
  repo: "https://github.com/example/provider",
  coordinates: "dev.example:provider:1.0.0",
  capabilities: ["pendingPurchases"],
  latestReport: {
    url: "https://github.com/example/provider/actions/runs/1",
    report: report(),
  },
});

test("the official registry matches the existing capability matrix", () =>
  validateStoreRegistry(registry()));
test("registration accepts a passing independent provider or an experimental entry", () => {
  const data = registry();
  data.stores.push(community());
  assert.equal(validateStoreRegistry(data), data);
  data.stores.at(-1).tier = "experimental";
  data.stores.at(-1).latestReport = null;
  assert.equal(validateStoreRegistry(data), data);
});
test("registered aliases and generated member names cannot collide", () => {
  for (const mutate of [
    (store) => {
      store.id = "play";
    },
    (store) => {
      store.aliases = ["google"];
    },
    (store) => {
      store.aliases = ["fixture", "fixture"];
    },
    (store) => {
      store.id = undefined;
    },
    (store) => {
      store.aliases = [undefined];
    },
    (store) => {
      store.id = "to-string";
    },
  ]) {
    const data = registry();
    const store = community();
    mutate(store);
    data.stores.push(store);
    assert.throws(
      () => validateStoreRegistry(data),
      /Invalid|duplicate|collide/,
    );
  }
  const data = registry();
  data.stores.push(community(), {
    ...community(),
    id: "community.fixture",
    aliases: [],
  });
  assert.throws(() => validateStoreRegistry(data), /constants collide/);
});
test("community coordinates and declared capabilities are validated", () => {
  for (const mutate of [
    (store) => {
      store.coordinates = "dev.example:provider:+";
    },
    (store) => {
      store.coordinates = "io.github.hyochan.openiap:openiap-google:3.6.2";
    },
    (store) => {
      store.capabilities = ["made-up"];
    },
    (store) => {
      store.latestReport = null;
    },
    (store) => {
      store.latestReport.report.storeId = "different";
    },
  ]) {
    const data = registry();
    const store = community();
    mutate(store);
    data.stores.push(store);
    assert.throws(() => validateStoreRegistry(data));
  }
});
test("a passing claim cannot omit, skip or duplicate required behavior results", () => {
  for (const mutate of [
    (value) => {
      value.results.pop();
    },
    (value) => {
      value.results[0].outcome = "not-applicable";
    },
    (value) => {
      value.results.push({ ...value.results[0] });
    },
    (value) => {
      value.scope.kind = "android-mapping";
    },
    (value) => {
      value.scope.requiredBehaviors.pop();
    },
    (value) => {
      value.capabilities = [];
    },
  ]) {
    const value = report();
    mutate(value);
    assert.throws(() => validateProviderReport(value, ["pendingPurchases"]));
  }
});
test("a complete failed report remains experimental", () => {
  const value = report();
  value.results[0].outcome = "fail";
  value.conformant = false;
  assert.equal(validateProviderReport(value, ["pendingPurchases"]), false);
  const data = registry();
  const store = community();
  store.tier = "experimental";
  store.latestReport.report = value;
  data.stores.push(store);
  validateStoreRegistry(data);
});
test("declaring another capability makes its behavior mandatory", () => {
  const value = report();
  value.capabilities.push("subscriptionBillingIssue");
  assert.throws(
    () => validateProviderReport(value, value.capabilities),
    /required suite/,
  );
});
test("historical reports must use a published provider profile and its actual behaviors", () => {
  const value = report();
  value.suiteVersion = "3.0.0";
  assert.throws(
    () => validateProviderReport(value, value.capabilities),
    /Unsupported provider suite major/,
  );
  value.suiteVersion = SUITE_VERSION;
  assert.equal(
    validateProviderReport(value, value.capabilities, {
      suiteVersion: "5.0.0",
    }),
    true,
  );
  value.scope.requiredBehaviors = ["bogus"];
  value.results = [{ id: "bogus", outcome: "pass" }];
  assert.throws(
    () =>
      validateProviderReport(value, value.capabilities, {
        suiteVersion: "5.0.0",
      }),
    /required suite/,
  );
});
test("an older passing major becomes unmaintained after the grace window", () => {
  const store = community();
  const options = { suiteVersion: "5.0.0", majorReleaseDate: "2026-10-01" };
  assert.equal(
    maintenanceStatus(store, 90, { ...options, now: new Date("2026-10-15") }),
    "outdated",
  );
  assert.equal(
    maintenanceStatus(store, 90, { ...options, now: new Date("2027-01-01") }),
    "unmaintained",
  );
  store.latestReport.report.suiteVersion = "5.0.0";
  assert.equal(
    maintenanceStatus(store, 90, { ...options, now: new Date("2027-01-01") }),
    "community",
  );
});

test("registered constants reject Dart keywords and Object members before generation", () => {
  for (const id of [...DART_KEYWORDS]
    .filter((name) => /^[a-z]+$/.test(name))
    .concat(["hash-code", "runtime-type", "no-such-method"])) {
    const data = registry();
    data.stores.push({
      ...community(),
      id,
      tier: "experimental",
      latestReport: null,
    });
    assert.throws(
      () => validateStoreRegistry(data),
      /Invalid or duplicate|constants collide or are reserved/,
      id,
    );
  }
});

test("Apple providers use the shared behavior profile and fixed Swift package coordinates", () => {
  const data = registry();
  const store = community();
  store.platform = "ios";
  store.coordinates = {
    package: "https://github.com/example/provider",
    product: "StoreProvider",
    version: "1.0.0",
  };
  const required = requiredProviderBehaviors(
    store.capabilities,
    undefined,
    "ios",
  );
  store.latestReport.report = {
    ...report(),
    scope: {
      kind: "apple-provider",
      complete: true,
      requiredBehaviors: required,
    },
    results: required.map((id) => ({ id, outcome: "pass" })),
  };
  data.stores.push(store);
  assert.equal(validateStoreRegistry(data), data);
  store.latestReport.report.scope.kind = "android-provider";
  assert.throws(() => validateStoreRegistry(data), /apple-provider/);
  store.latestReport.report.scope.kind = "apple-provider";
  for (const coordinate of [
    "dev.example:provider:1.0.0",
    { ...store.coordinates, version: "+" },
    { ...store.coordinates, product: "" },
    { ...store.coordinates, package: undefined },
  ]) {
    store.coordinates = coordinate;
    assert.throws(() => validateStoreRegistry(data), /coordinates/);
  }
});

test("one community store id can bind to both platforms without duplicate metadata", () => {
  const store = community();
  const android = {
    coordinates: store.coordinates,
    capabilities: store.capabilities,
    latestReport: store.latestReport,
  };
  const appleReport = { ...report([]), capabilities: [] };
  const required = requiredProviderBehaviors([], undefined, "ios");
  appleReport.scope = {
    kind: "apple-provider",
    complete: true,
    requiredBehaviors: required,
  };
  appleReport.results = required.map((id) => ({ id, outcome: "pass" }));
  const ios = {
    coordinates: {
      package: "https://github.com/example/provider",
      product: "StoreProvider",
      version: "1.0.0",
    },
    capabilities: [],
    latestReport: {
      url: "https://github.com/example/provider/actions/runs/2",
      report: appleReport,
    },
  };
  delete store.platform;
  delete store.coordinates;
  delete store.capabilities;
  delete store.latestReport;
  store.bindings = { android, ios };
  const data = registry();
  data.stores.push(store);
  assert.equal(validateStoreRegistry(data), data);
  assert.equal(maintenanceStatus(store, 90), "community");
  store.bindings.ios.latestReport = null;
  store.tier = "experimental";
  assert.equal(validateStoreRegistry(data), data);
  store.tier = "community";
  assert.throws(() => validateStoreRegistry(data), /Tier disagrees/);
  store.tier = "experimental";
  store.bindings.ios.latestReport = ios.latestReport;
  store.platform = "ios";
  assert.throws(() => validateStoreRegistry(data), /two owners/);
});
