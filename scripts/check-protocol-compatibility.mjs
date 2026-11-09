import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compareSemVer, openiapNpmPackages } from "./release-branch-policy.mjs";

// Whether a target loads at runtime; `null` blocks a subpath and a
// types-only target serves no module.
const loadable = (target) =>
  typeof target === "string" ||
  (Array.isArray(target) && target.some(loadable)) ||
  (target !== null &&
    typeof target === "object" &&
    Object.entries(target).some(
      ([condition, value]) => condition !== "types" && loadable(value),
    ));

const subpaths = ({ exports }) => {
  if (
    exports &&
    typeof exports === "object" &&
    !Array.isArray(exports) &&
    Object.keys(exports).some((key) => key.startsWith("."))
  ) {
    return Object.entries(exports)
      .filter(([, target]) => loadable(target))
      .map(([path]) => path);
  }
  // A root target, or no field at all, publishes only the root.
  return exports === undefined || loadable(exports) ? ["."] : [];
};

/**
 * Package subpaths a supported release published that the current manifest
 * no longer serves. A consumer importing one fails with
 * ERR_PACKAGE_PATH_NOT_EXPORTED, so removal needs a breaking version.
 */
export function removedExportPaths(released, current) {
  const served = new Set(subpaths(current));
  return subpaths(released).filter((path) => !served.has(path));
}

/** Whether `current` may break `released` under semver (0.x breaks on minor). */
export function isBreakingRelease(released, current) {
  const [releasedMajor, releasedMinor] = released.split(".").map(Number);
  const [currentMajor, currentMinor] = current.split(".").map(Number);
  return releasedMajor === 0 && currentMajor === 0
    ? currentMinor > releasedMinor
    : currentMajor > releasedMajor;
}

function main() {
  const [protocol, ...extra] = process.argv.slice(2);
  if (
    !["client-protocol", "commerce-protocol"].includes(protocol) ||
    extra.length
  ) {
    throw new Error(
      "Usage: node scripts/check-protocol-compatibility.mjs <client-protocol|commerce-protocol>",
    );
  }
  const root = fileURLToPath(new URL("../", import.meta.url));
  const git = (...args) =>
    execFileSync("git", args, { cwd: root, encoding: "utf8" });
  const { tagPrefix, path } = openiapNpmPackages[protocol];
  const prefix = `refs/tags/${tagPrefix}-`;
  const minimum = JSON.parse(
    readFileSync(
      new URL(
        `../${path.replace(/package\.json$/, "compatibility.json")}`,
        import.meta.url,
      ),
      "utf8",
    ),
  ).minimumStableRelease;
  if (typeof minimum !== "string" || !/^\d+\.\d+\.\d+$/.test(minimum)) {
    throw new Error(`Invalid minimum stable release for ${protocol}`);
  }
  const refs = git("ls-remote", "--tags", "--refs", "origin", `${prefix}*`)
    .trim()
    .split("\n")
    .map((line) => line.split("\t")[1])
    .filter((ref) => ref?.startsWith(prefix))
    .filter((ref) => {
      const version = ref.slice(prefix.length);
      return (
        /^\d+\.\d+\.\d+$/.test(version) && compareSemVer(version, minimum) >= 0
      );
    })
    .sort((left, right) =>
      compareSemVer(left.slice(prefix.length), right.slice(prefix.length)),
    );
  if (!refs.includes(`${prefix}${minimum}`)) {
    throw new Error(`Missing supported release tag ${tagPrefix}-${minimum}`);
  }

  const depth =
    git("rev-parse", "--is-shallow-repository").trim() === "true"
      ? ["--depth=1"]
      : [];
  git(
    "fetch",
    "--no-tags",
    ...depth,
    "origin",
    ...refs.map((ref) => `${ref}:${ref}`),
  );
  const audit =
    protocol === "client-protocol"
      ? "specs/client/scripts/audit-schema-semver.mjs"
      : "specs/commerce-protocol/scripts/audit-compatibility.mjs";
  const current = JSON.parse(
    readFileSync(new URL(`../${path}`, import.meta.url), "utf8"),
  );
  const removals = [];
  for (const ref of refs) {
    console.log(`Checking ${ref.slice("refs/tags/".length)}`);
    execFileSync(process.execPath, [audit, "--base", ref], {
      cwd: root,
      stdio: "inherit",
    });
    // The tag holds the manifest that release published, so a PR cannot
    // rewrite the expectation it is compared against.
    const released = JSON.parse(git("show", `${ref}:${path}`));
    const removed = removedExportPaths(released, current);
    if (
      removed.length &&
      !isBreakingRelease(released.version, current.version)
    ) {
      removals.push(`${released.version}: ${removed.join(", ")}`);
    }
  }
  if (removals.length) {
    throw new Error(
      `${protocol} no longer exports subpaths a supported release published (${removals.join("; ")}). Keep them or ship a breaking version.`,
    );
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main();
}
