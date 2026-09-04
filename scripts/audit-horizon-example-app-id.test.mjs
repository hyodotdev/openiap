import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  HORIZON_APP_ID_SOURCES,
  collectHorizonExampleAppIdFailures,
  inspectHorizonAppIdSource,
} from "./audit-horizon-example-app-id.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("every Horizon example in this repository resolves an app id", () => {
  assert.deepEqual(collectHorizonExampleAppIdFailures(repoRoot), []);
});

test("the audit covers every library that ships a Horizon example", () => {
  assert.deepEqual(
    HORIZON_APP_ID_SOURCES.map((source) => source.library).sort(),
    [
      "expo-iap",
      "flutter_inapp_purchase",
      "kmp-iap",
      "maui-iap",
      "react-native-iap",
    ],
  );
});

test("a manifest without the app id is rejected", () => {
  assert.equal(
    inspectHorizonAppIdSource(
      '<meta-data android:name="com.meta.horizon.platform.HORIZON_APP_ID" />',
    ),
    "declares no literal Horizon app id",
  );
});

test("an empty Gradle fallback is rejected even when a literal id is nearby", () => {
  const issue = inspectHorizonAppIdSource(
    'def id = localProperties.getProperty("HORIZON_APP_ID") ?: ""\n// 31705015229097839',
  );
  assert.match(String(issue), /falls back to an empty app id/);
});

test("a Gradle fallback to a literal id passes", () => {
  assert.equal(
    inspectHorizonAppIdSource(
      'localProperties.getProperty("HORIZON_APP_ID") ?: "31705015229097839"',
    ),
    null,
  );
});

test("a missing source file is reported instead of silently passing", () => {
  const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), "horizon-audit-"));
  try {
    const failures = collectHorizonExampleAppIdFailures(emptyRoot);
    assert.equal(failures.length, HORIZON_APP_ID_SOURCES.length);
    for (const failure of failures) {
      assert.match(failure, /is missing$/);
    }
  } finally {
    fs.rmSync(emptyRoot, { recursive: true, force: true });
  }
});
