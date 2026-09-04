import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  NOTICE_REQUIRING_LICENSES,
  collectEmbeddedComponents,
  collectNoticeFailures,
  renderNotices,
} from "./generate-third-party-notices.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("the godot component's embedded binaries are notice-ready", () => {
  assert.deepEqual(collectNoticeFailures(repoRoot, "godot"), []);
});

test("the rendered notice carries the upstream text verbatim", () => {
  const notices = renderNotices(repoRoot, "godot");
  const upstream = fs
    .readFileSync(
      path.join(repoRoot, "libraries/godot-iap/third-party/SwiftGodot-LICENSE"),
      "utf8",
    )
    .trim();
  assert.ok(
    notices.includes(upstream),
    "upstream licence text is not verbatim",
  );
  assert.match(notices, /SPDX-License-Identifier: MIT/);
});

test("every embedded component declares a licence the audit knows", () => {
  for (const component of collectEmbeddedComponents("godot")) {
    assert.ok(component.spdxLicense, `${component.name} has no SPDX licence`);
    if (NOTICE_REQUIRING_LICENSES.has(component.spdxLicense)) {
      assert.ok(
        component.licenseFile,
        `${component.name} needs its notice to ship but has no licenseFile`,
      );
    }
  }
});

test("an empty licence file is refused, not rendered as a blank section", () => {
  // The generator exists to fail rather than emit an empty notice, and a file
  // that exists but holds nothing defeats that just as surely as a missing one.
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "notices-"));
  try {
    const target = path.join(
      scratch,
      "libraries/godot-iap/third-party/SwiftGodot-LICENSE",
    );
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "   \n\t\n");
    const failures = collectNoticeFailures(scratch, "godot");
    assert.ok(failures.length > 0, "an empty licence file was accepted");
    for (const failure of failures) assert.match(failure, /is empty$/);
    assert.throws(() => renderNotices(scratch, "godot"), /is empty/);
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});

test("a missing licence file is refused", () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), "notices-missing-"));
  try {
    const failures = collectNoticeFailures(empty, "godot");
    assert.ok(failures.length > 0);
    for (const failure of failures) assert.match(failure, /does not exist$/);
  } finally {
    fs.rmSync(empty, { recursive: true, force: true });
  }
});
