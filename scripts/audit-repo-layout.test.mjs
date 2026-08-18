import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { auditRepositoryLayout } from "./audit-repo-layout.mjs";

function withTemporaryRepository(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "openiap-layout-"));

  try {
    run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("accepts canonical owned directories", () => {
  withTemporaryRepository((root) => {
    fs.mkdirSync(path.join(root, "packages", "docs"), { recursive: true });
    fs.mkdirSync(path.join(root, "packages", "gql"), { recursive: true });
    fs.mkdirSync(path.join(root, "libraries", "react-native-iap"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(root, "plugins", "openiap"), { recursive: true });

    assert.deepEqual(auditRepositoryLayout(root), []);
  });
});

test("rejects root directories with canonical owners", () => {
  withTemporaryRepository((root) => {
    fs.mkdirSync(path.join(root, "packages", "docs"), { recursive: true });
    fs.mkdirSync(path.join(root, "libraries", "react-native-iap"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(root, "plugins", "openiap"), { recursive: true });
    fs.mkdirSync(path.join(root, "docs"));
    fs.mkdirSync(path.join(root, "react-native-iap"));
    fs.mkdirSync(path.join(root, "openiap"));

    assert.deepEqual(auditRepositoryLayout(root), [
      "remove duplicate root react-native-iap/; use libraries/react-native-iap/ instead",
      "remove duplicate root docs/; use packages/docs/ instead",
      "remove duplicate root openiap/; use plugins/openiap/ instead",
    ]);
  });
});
