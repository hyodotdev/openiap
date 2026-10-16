// The plugin version lives in openiap-versions.json ("plugin"), and both
// manifests carry it: an installed plugin updates only when it rises. The
// plugin release workflow bumps it with `bump`; feature work never edits it.

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN = "plugins/openiap";
export const VERSIONS = "openiap-versions.json";
export const MANIFESTS = [
  `${PLUGIN}/.codex-plugin/plugin.json`,
  `${PLUGIN}/.claude-plugin/plugin.json`,
];
const BUMPS = ["patch", "minor", "major"];

function read(root, file) {
  return readFileSync(path.join(root, file), "utf8");
}

/** Returns the problems found; an empty list means the manifests are in order. */
export function auditPluginManifests({ root }) {
  const expected = JSON.parse(read(root, VERSIONS)).plugin;
  if (!expected) return [`${VERSIONS} is missing the "plugin" version`];
  return MANIFESTS.flatMap((file) => {
    const version = JSON.parse(read(root, file)).version;
    return version === expected
      ? []
      : [
          `${file} (${version}) must carry ${VERSIONS} "plugin" (${expected}); the plugin release workflow sets both`,
        ];
  });
}

export function nextVersion(version, bump) {
  const [major, minor, patch] = version.split(".").map(Number);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

// Rewrites only the version strings, so the files keep their formatting.
export function bumpPluginVersion({ root, bump }) {
  if (!BUMPS.includes(bump)) {
    throw new Error(`bump must be one of ${BUMPS.join(", ")}`);
  }
  const version = nextVersion(JSON.parse(read(root, VERSIONS)).plugin, bump);
  const edits = [
    [VERSIONS, /("plugin":\s*)"[^"]*"/],
    ...MANIFESTS.map((file) => [file, /("version":\s*)"[^"]*"/]),
  ];
  for (const [file, pattern] of edits) {
    writeFileSync(
      path.join(root, file),
      read(root, file).replace(pattern, `$1"${version}"`),
    );
  }
  return version;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  if (process.argv[2] === "bump") {
    console.log(bumpPluginVersion({ root, bump: process.argv[3] }));
  } else {
    const problems = auditPluginManifests({ root });
    for (const problem of problems) console.error(`::error::${problem}`);
    if (problems.length) process.exitCode = 1;
    else console.log("Plugin manifest audit: clean.");
  }
}
