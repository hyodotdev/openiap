import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  copyFileSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { afterEach, test } from "node:test";
import { GENERATED_SYNC_MANIFEST } from "../generated-sync-manifest.mjs";

const repositoryRoot = resolve(import.meta.dirname, "../../..");
const FIXTURE_SPEC_VERSION = "9.8.7";
const generatedHeaderSource = readFileSync(
  resolve(repositoryRoot, "specs/client/codegen/core/generated-header.ts"),
  "utf8",
);
const headerGuidance = [
  ...generatedHeaderSource.matchAll(/`\$\{commentPrefix\} ([^`\r\n]+)`/g),
]
  .map((match) => match[1])
  .find((line) => line.includes("generated-types workflow"));
assert.ok(headerGuidance, "canonical generated header guidance is missing");
const temporaryRoots = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

const refreshers = [
  {
    groupName: "typescript",
    targetName: "reactNative",
    scriptPath: "libraries/react-native-iap/scripts/update-types.mjs",
    runtime: "node",
    fixture: `// ============================================================================
// AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY
// Run \`npm run generate\` after updating any *.graphql schema file.
// ============================================================================

export interface ProductRequest {}
`,
  },
  {
    groupName: "typescript",
    targetName: "expo",
    scriptPath: "libraries/expo-iap/scripts/update-types.mjs",
    runtime: "node",
    fixture: `// ============================================================================
// AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY
// Run \`npm run generate\` after updating any *.graphql schema file.
// ============================================================================

export interface ProductRequest {}
`,
  },
  {
    groupName: "dart",
    targetName: "flutter",
    scriptPath: "libraries/flutter_inapp_purchase/scripts/generate-type.sh",
    runtime: "shell",
    fixture: `// ============================================================================
// AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY
// Run \`bun run generate\` after updating any *.graphql schema file.
// ============================================================================

class ProductRequest {}
`,
  },
  {
    groupName: "gdscript",
    targetName: "godot",
    scriptPath: "libraries/godot-iap/scripts/generate-types.sh",
    runtime: "shell",
    fixture: `# ============================================================================
# AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY
# Generated from OpenIAP GraphQL schema (https://openiap.dev)
# Run \`bun run generate\` to regenerate this file.
# ============================================================================

class ProductRequest:
\tpass
`,
  },
  {
    groupName: "kotlin",
    targetName: "kmp",
    scriptPath: "libraries/kmp-iap/scripts/generate-types.sh",
    runtime: "shell",
    fixture: `// ============================================================================
// AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY
// Run \`bun run generate\` after updating any *.graphql schema file.
// ============================================================================

package io.github.hyochan.kmpiap.openiap

public data class ProductRequest(
    val ids: List<String>,
)
`,
  },
];

const manifestTargetFor = ({ groupName, targetName }) => {
  const target = GENERATED_SYNC_MANIFEST[groupName]?.targets[targetName]?.path;
  assert.ok(target, `missing manifest target ${groupName}.${targetName}`);
  return target;
};

const packageRootFor = ({ scriptPath }) =>
  scriptPath.slice(0, scriptPath.indexOf("/scripts/"));

const normalizeFixtureHeader = (fixture, commentPrefix) => {
  const lines = fixture.split("\n");
  const separator = `${commentPrefix} ${"=".repeat(76)}`;
  const closingIndex = lines.indexOf(separator, 2);
  assert.ok(closingIndex > 2, "fixture generated header is unterminated");
  const candidates = lines
    .slice(2, closingIndex)
    .map((line, index) => ({ index: index + 2, line }))
    .filter(({ line }) => line.startsWith(`${commentPrefix} Run \``));
  assert.equal(candidates.length, 1);
  lines[candidates[0].index] = `${commentPrefix} ${headerGuidance}`;
  return lines.join("\n");
};

const fakeCurlSource = `#!/usr/bin/env bash
set -euo pipefail
if [[ "\${FAKE_CURL_EXIT:-0}" != "0" ]]; then
  exit "\${FAKE_CURL_EXIT}"
fi
output=""
url=""
while [[ "$#" -gt 0 ]]; do
  case "$1" in
    -o)
      output="$2"
      shift 2
      ;;
    -fL)
      shift
      ;;
    *)
      url="$1"
      shift
      ;;
  esac
done
printf '%s' "\${FAKE_CURL_BODY}" > "$output"
printf '%s' "$url" > "\${FAKE_CURL_LOG}"
`;

function createIsolatedCheckout(definition, { withVersions = true } = {}) {
  const root = mkdtempSync(join(tmpdir(), "openiap-type-refresh-"));
  temporaryRoots.push(root);

  const packageRootRelative = packageRootFor(definition);
  const packageRoot = join(root, packageRootRelative);
  const isolatedScript = join(
    packageRoot,
    "scripts",
    basename(definition.scriptPath),
  );
  const manifestTarget = manifestTargetFor(definition);
  const targetRelative = relative(packageRootRelative, manifestTarget);
  const isolatedTarget = join(packageRoot, targetRelative);
  const binDirectory = join(root, "bin");
  const otherCwd = join(root, "unrelated-cwd");
  const curlLog = join(root, "curl-url.txt");

  mkdirSync(dirname(isolatedScript), { recursive: true });
  mkdirSync(dirname(isolatedTarget), { recursive: true });
  mkdirSync(binDirectory, { recursive: true });
  mkdirSync(otherCwd, { recursive: true });
  copyFileSync(resolve(repositoryRoot, definition.scriptPath), isolatedScript);
  writeFileSync(join(binDirectory, "curl"), fakeCurlSource);
  chmodSync(join(binDirectory, "curl"), 0o755);
  if (withVersions) {
    writeFileSync(
      join(packageRoot, "openiap-versions.json"),
      `${JSON.stringify({ spec: FIXTURE_SPEC_VERSION }, null, 2)}\n`,
    );
  }

  return {
    curlLog,
    isolatedScript,
    isolatedTarget,
    manifestTarget,
    otherCwd,
    root,
  };
}

function runRefresher(
  definition,
  checkout,
  { args = [], body = definition.fixture, curlExit = "0" } = {},
) {
  const command = definition.runtime === "node" ? process.execPath : "bash";
  const commandArgs = [checkout.isolatedScript, ...args];
  return spawnSync(command, commandArgs, {
    cwd: checkout.otherCwd,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${join(checkout.root, "bin")}:${process.env.PATH}`,
      FAKE_CURL_BODY: body,
      FAKE_CURL_EXIT: curlExit,
      FAKE_CURL_LOG: checkout.curlLog,
    },
  });
}

function assertNoRefreshTemps(checkout) {
  const parentEntries = readdirSync(dirname(checkout.isolatedTarget));
  assert.equal(
    parentEntries.some(
      (entry) => entry.includes(".tmp.") || entry.startsWith(".openiap-types-"),
    ),
    false,
  );
}

test("standalone generated refreshers stay linked to manifest targets", () => {
  for (const definition of refreshers) {
    const source = readFileSync(
      resolve(repositoryRoot, definition.scriptPath),
      "utf8",
    );
    assert.match(source, /raw\.githubusercontent\.com\/hyodotdev\/openiap\//);
    assert.match(source, /docs-/);
    assert.ok(source.includes(manifestTargetFor(definition)));
    assert.ok(source.includes(headerGuidance));
    assert.doesNotMatch(source, /github\.com\/hyodotdev\/openiap\/releases/);
    assert.doesNotMatch(source, /\.zip|unzip/);
    assert.doesNotMatch(source, /packages\/gql\/scripts\//);

    if (definition.runtime === "node") {
      assert.ok(source.includes("dirname(TARGET_FILE)"));
      assert.ok(source.includes("renameSync(tempFile, TARGET_FILE)"));
      assert.ok(source.includes("versionOverride ?? readPinnedSpecVersion()"));
      assert.ok(source.includes("--tag requires a version"));
      assert.ok(source.includes("Unknown argument"));
      assert.doesNotMatch(source, /process\.cwd\(\)/);
    } else {
      assert.ok(source.includes('mktemp "${TARGET_FILE}.tmp.XXXXXX"'));
      assert.match(source, /chmod 0644/);
      assert.ok(source.includes('mv -f "$TEMP_FILE" "$TARGET_FILE"'));
    }
  }

  const exampleAddons = resolve(
    repositoryRoot,
    "libraries/godot-iap/Example/addons",
  );
  assert.equal(lstatSync(exampleAddons).isSymbolicLink(), true);
  assert.equal(readlinkSync(exampleAddons), "../addons");
  assert.doesNotMatch(
    readFileSync(
      resolve(repositoryRoot, "libraries/godot-iap/scripts/generate-types.sh"),
      "utf8",
    ),
    /Example\/addons|EXAMPLE_ADDON_DIR/,
  );
});

test("standalone refreshers replace the target and leave it 0644", () => {
  // The mode is recorded per replacement and asserted after the loop, so no
  // stat of one target sits between the writes to another. Splitting the
  // later cases into their own test keeps this assertion on the mode the
  // first replacement produced, which a second successful run would overwrite.
  const replaced = [];

  for (const definition of refreshers) {
    const checkout = createIsolatedCheckout(definition);
    // Seed 0600 so 0644 below proves the refresher set it rather than
    // inheriting it from the file it replaced.
    writeFileSync(checkout.isolatedTarget, "preserve-me\n", { mode: 0o600 });

    const success = runRefresher(definition, checkout);
    assert.equal(
      success.status,
      0,
      `${definition.scriptPath}\n${success.stderr}`,
    );
    const commentPrefix = definition.groupName === "gdscript" ? "#" : "//";
    const expected = normalizeFixtureHeader(definition.fixture, commentPrefix);
    assert.equal(readFileSync(checkout.isolatedTarget, "utf8"), expected);
    assert.equal(
      readFileSync(checkout.curlLog, "utf8"),
      `https://raw.githubusercontent.com/hyodotdev/openiap/docs-${FIXTURE_SPEC_VERSION}/${checkout.manifestTarget}`,
    );
    assertNoRefreshTemps(checkout);
    replaced.push([definition.scriptPath, checkout.isolatedTarget]);
  }

  for (const [scriptPath, target] of replaced) {
    assert.equal(statSync(target).mode & 0o777, 0o644, scriptPath);
  }
});

test("standalone refreshers stay idempotent and preserve invalid results", () => {
  for (const definition of refreshers) {
    const checkout = createIsolatedCheckout(definition);
    writeFileSync(checkout.isolatedTarget, "preserve-me\n", { mode: 0o644 });

    const success = runRefresher(definition, checkout);
    assert.equal(
      success.status,
      0,
      `${definition.scriptPath}\n${success.stderr}`,
    );
    const commentPrefix = definition.groupName === "gdscript" ? "#" : "//";
    const expected = normalizeFixtureHeader(definition.fixture, commentPrefix);

    const idempotent = runRefresher(definition, checkout, { body: expected });
    assert.equal(
      idempotent.status,
      0,
      `${definition.scriptPath}\n${idempotent.stderr}`,
    );
    assert.equal(readFileSync(checkout.isolatedTarget, "utf8"), expected);

    writeFileSync(checkout.isolatedTarget, "preserve-invalid\n", {
      mode: 0o644,
    });
    const invalid = runRefresher(definition, checkout, {
      body: "<!doctype html>not generated\n",
    });
    assert.notEqual(invalid.status, 0, definition.scriptPath);
    assert.equal(
      readFileSync(checkout.isolatedTarget, "utf8"),
      "preserve-invalid\n",
    );
    assertNoRefreshTemps(checkout);

    writeFileSync(checkout.isolatedTarget, "preserve-download\n", {
      mode: 0o644,
    });
    const downloadFailure = runRefresher(definition, checkout, {
      curlExit: "22",
    });
    assert.notEqual(downloadFailure.status, 0, definition.scriptPath);
    assert.equal(
      readFileSync(checkout.isolatedTarget, "utf8"),
      "preserve-download\n",
    );
    assertNoRefreshTemps(checkout);
  }
});

test("Node refreshers keep explicit tag overrides independent of metadata", () => {
  for (const definition of refreshers.filter(
    ({ runtime }) => runtime === "node",
  )) {
    const checkout = createIsolatedCheckout(definition, {
      withVersions: false,
    });
    writeFileSync(checkout.isolatedTarget, "preserve-me\n", { mode: 0o644 });

    const override = runRefresher(definition, checkout, {
      args: ["--tag", `gql-v${FIXTURE_SPEC_VERSION}`],
    });
    assert.equal(
      override.status,
      0,
      `${definition.scriptPath}\n${override.stderr}`,
    );
    assert.equal(
      readFileSync(checkout.curlLog, "utf8"),
      `https://raw.githubusercontent.com/hyodotdev/openiap/docs-${FIXTURE_SPEC_VERSION}/${checkout.manifestTarget}`,
    );

    const expected = readFileSync(checkout.isolatedTarget, "utf8");
    for (const args of [[], ["--tag"], ["--unknown"]]) {
      const failure = runRefresher(definition, checkout, { args });
      assert.notEqual(failure.status, 0, `${definition.scriptPath} ${args}`);
      assert.equal(readFileSync(checkout.isolatedTarget, "utf8"), expected);
    }
  }
});
