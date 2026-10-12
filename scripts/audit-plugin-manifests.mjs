// An installed plugin stays on its manifest version, so a skills edit without
// a version bump never reaches existing installs (AGENTS.md "Claude Code
// Compatibility"). Both manifests must carry the same version, and when skills
// differ from the base ref the version must be higher than the base's.
// Offline: it needs only the base commit, never history or a fetch.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN = "plugins/openiap";
export const MANIFESTS = [
  `${PLUGIN}/.codex-plugin/plugin.json`,
  `${PLUGIN}/.claude-plugin/plugin.json`,
];
export const SKILLS = `${PLUGIN}/skills`;

function git(root, args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}

// True when `a` is a higher x.y.z than `b`.
function isNewer(a, b) {
  const parts = (version) => String(version).split(".").map(Number);
  const [left, right] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i += 1) {
    if ((left[i] || 0) !== (right[i] || 0))
      return (left[i] || 0) > (right[i] || 0);
  }
  return false;
}

function versionAt(root, revision, file) {
  try {
    return JSON.parse(git(root, ["show", `${revision}:${file}`])).version;
  } catch {
    return null;
  }
}

/** Returns the problems found; an empty list means the manifests are in order. */
export function auditPluginManifests({ root, base = "origin/main" }) {
  const versions = MANIFESTS.map(
    (file) =>
      JSON.parse(readFileSync(path.join(root, file), "utf8")).version ?? null,
  );
  if (versions[0] !== versions[1]) {
    return [
      `${MANIFESTS[0]} (${versions[0]}) and ${MANIFESTS[1]} (${versions[1]}) must carry the same version`,
    ];
  }

  try {
    git(root, ["rev-parse", "--verify", "--quiet", `${base}^{commit}`]);
  } catch {
    return [
      `base ref ${base} is not available locally; fetch it or pass another ref`,
    ];
  }
  const changed = [
    ...git(root, ["diff", "--name-only", base, "--", SKILLS]).split("\n"),
    ...git(root, [
      "ls-files",
      "--others",
      "--exclude-standard",
      "--",
      SKILLS,
    ]).split("\n"),
  ].filter(Boolean);
  const released = versionAt(root, base, MANIFESTS[0]);
  if (changed.length && !isNewer(versions[0], released)) {
    return [
      `${SKILLS} changed since ${base} (${released}); bump the version in both manifests:\n${changed.map((file) => `- ${file}`).join("\n")}`,
    ];
  }
  return [];
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const problems = auditPluginManifests({ root, base: process.argv[2] });
  for (const problem of problems) console.error(`::error::${problem}`);
  if (problems.length) process.exitCode = 1;
  else console.log("Plugin manifest audit: clean.");
}
