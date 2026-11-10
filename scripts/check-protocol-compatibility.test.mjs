import assert from "node:assert/strict";
import { test } from "node:test";

import {
  isBreakingRelease,
  removedExportPaths,
} from "./check-protocol-compatibility.mjs";

const released = {
  version: "1.3.3",
  exports: {
    ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
    "./purchase-flow": "./dist/purchase-flow.js",
    "./purchase-flow-vectors": "./src/purchase-flow.vectors.json",
  },
};

test("a subpath a released version published must stay exported", () => {
  const current = structuredClone(released);
  delete current.exports["./purchase-flow-vectors"];
  assert.deepEqual(removedExportPaths(released, current), [
    "./purchase-flow-vectors",
  ]);
});

test("added subpaths and changed targets are not removals", () => {
  const current = structuredClone(released);
  current.exports["./purchase-flow"] = { default: "./dist/flow.js" };
  current.exports["./new"] = "./dist/new.js";
  assert.deepEqual(removedExportPaths(released, current), []);
});

test("a null or types-only target no longer serves a published subpath", () => {
  for (const target of [null, { types: "./dist/purchase-flow.d.ts" }]) {
    const current = structuredClone(released);
    current.exports["./purchase-flow"] = target;
    assert.deepEqual(removedExportPaths(released, current), [
      "./purchase-flow",
    ]);
  }
});

test("a condition-only or string export publishes the root subpath", () => {
  assert.deepEqual(
    removedExportPaths(
      { exports: "./index.js" },
      { exports: { import: "./index.js" } },
    ),
    [],
  );
  assert.deepEqual(
    removedExportPaths({}, { exports: { "./only": "./only.js" } }),
    ["."],
  );
});

test("only a breaking version may drop a published subpath", () => {
  assert.equal(isBreakingRelease("1.3.3", "1.4.0"), false);
  assert.equal(isBreakingRelease("1.3.3", "2.0.0"), true);
  assert.equal(isBreakingRelease("0.3.1", "0.3.9"), false);
  assert.equal(isBreakingRelease("0.3.1", "0.4.0"), true);
});
