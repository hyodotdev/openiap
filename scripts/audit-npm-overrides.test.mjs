import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { auditNpmOverrides, manifestPaths } from "./audit-npm-overrides.mjs";

function withTemporaryRepository(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "npm-overrides-"));
  try {
    run(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

const writeManifest = (root, relative, manifest) => {
  const target = path.join(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(manifest, null, 2));
};

test("accepts an override that references its direct dependency", () => {
  withTemporaryRepository((root) => {
    writeManifest(root, "package.json", {
      dependencies: { "fast-uri": "^3.1.7" },
      overrides: { "fast-uri": "$fast-uri" },
    });

    assert.deepEqual(auditNpmOverrides(root), []);
  });
});

test("accepts an override that repeats the dependency spec verbatim", () => {
  withTemporaryRepository((root) => {
    writeManifest(root, "package.json", {
      dependencies: { qs: "6.16.0" },
      overrides: { qs: "6.16.0" },
    });

    assert.deepEqual(auditNpmOverrides(root), []);
  });
});

test("accepts an override for a package that is not a direct dependency", () => {
  withTemporaryRepository((root) => {
    writeManifest(root, "package.json", {
      dependencies: { hono: "4.13.2" },
      overrides: { csstype: "3.2.3" },
    });

    assert.deepEqual(auditNpmOverrides(root), []);
  });
});

test("rejects the mismatch npm refuses to install", () => {
  withTemporaryRepository((root) => {
    writeManifest(root, "package.json", {
      dependencies: { "fast-uri": "^3.1.7" },
      overrides: { "fast-uri": "3.1.7" },
    });

    assert.deepEqual(auditNpmOverrides(root), [
      'package.json: override "fast-uri": "3.1.7" conflicts with its direct dependency "^3.1.7" — use "$fast-uri"',
    ]);
  });
});

test("checks devDependencies too", () => {
  withTemporaryRepository((root) => {
    writeManifest(root, "package.json", {
      devDependencies: { prettier: "^3.6.2" },
      overrides: { prettier: "3.6.2" },
    });

    assert.deepEqual(auditNpmOverrides(root), [
      'package.json: override "prettier": "3.6.2" conflicts with its direct dependency "^3.6.2" — use "$prettier"',
    ]);
  });
});

test("checks workspace manifests, not just the root", () => {
  withTemporaryRepository((root) => {
    writeManifest(root, "package.json", {});
    writeManifest(root, "scripts/agent/package.json", {
      dependencies: { uuid: "^11.0.0" },
      overrides: { uuid: "11.1.1" },
    });

    assert.deepEqual(auditNpmOverrides(root), [
      'scripts/agent/package.json: override "uuid": "11.1.1" conflicts with its direct dependency "^11.0.0" — use "$uuid"',
    ]);
  });
});

test("finds a conflict in a nested example project", () => {
  withTemporaryRepository((root) => {
    writeManifest(root, "package.json", {});
    // CI installs libraries/expo-iap/example/vega on its own, so a conflict
    // there breaks npm just as thoroughly as one in the root.
    writeManifest(root, "libraries/expo-iap/example/vega/package.json", {
      dependencies: { "fast-uri": "^3.1.7" },
      overrides: { "fast-uri": "3.1.7" },
    });

    assert.deepEqual(auditNpmOverrides(root), [
      'libraries/expo-iap/example/vega/package.json: override "fast-uri": "3.1.7" conflicts with its direct dependency "^3.1.7" — use "$fast-uri"',
    ]);
  });
});

test("ignores manifests inside installed dependencies", () => {
  withTemporaryRepository((root) => {
    writeManifest(root, "package.json", {});
    writeManifest(root, "node_modules/some-dep/package.json", {
      dependencies: { qs: "^6.16.0" },
      overrides: { qs: "6.16.0" },
    });

    assert.deepEqual(auditNpmOverrides(root), []);
  });
});

test("covers every independently installed project in this repository", () => {
  const root = path.resolve(import.meta.dirname, "..");
  const seen = manifestPaths(root);

  for (const project of [
    "package.json",
    "libraries/expo-iap/package.json",
    "libraries/expo-iap/example/package.json",
    "libraries/expo-iap/example/vega/package.json",
    "libraries/react-native-iap/example/vega/package.json",
  ]) {
    assert.ok(seen.includes(project), `${project} is not audited`);
  }
});

test("the repository's own manifests are npm-installable", () => {
  assert.deepEqual(auditNpmOverrides(), []);
});
