import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  inspectMergedManifest,
  verifyMergedManifest,
} from "./verify-horizon-merged-manifest.mjs";

const merged = (value) =>
  `<manifest><application>
    <meta-data
        android:name="com.meta.horizon.platform.HORIZON_APP_ID"
        android:value="${value}" />
  </application></manifest>`;

test("a resolved app id passes", () => {
  assert.equal(inspectMergedManifest(merged("31705015229097839")), null);
});

test("an empty merged value is the defect this exists for", () => {
  // Reproduced against a real Gradle run: reverting the example's fallback and
  // clearing the local property merges "" here, and the app then throws inside
  // startConnection on the headset.
  assert.equal(
    inspectMergedManifest(merged("")),
    "the Horizon app id merged as empty, so startConnection will throw",
  );
});

test("an unresolved placeholder is reported as such", () => {
  assert.equal(
    inspectMergedManifest(merged("${HORIZON_APP_ID}")),
    "the Horizon app id merged unresolved as ${HORIZON_APP_ID}",
  );
});

test("a value that is not an app id is rejected", () => {
  assert.equal(
    inspectMergedManifest(merged("not-an-id")),
    'the Horizon app id merged as "not-an-id", which is not an app id',
  );
  assert.equal(
    inspectMergedManifest(merged("0")),
    'the Horizon app id merged as "0", which is not an app id',
  );
});

test("a manifest without the declaration is reported", () => {
  assert.match(
    String(inspectMergedManifest("<manifest><application/></manifest>")),
    /declares no com\.meta\.horizon\.platform\.HORIZON_APP_ID/,
  );
});

test("a missing manifest is reported instead of passing", () => {
  const missing = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "horizon-merged-")),
    "AndroidManifest.xml",
  );
  assert.match(String(verifyMergedManifest(missing)), /does not exist/);
});
