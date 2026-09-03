#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[0-9A-Za-z-]*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;

// Manifests that have carried the Commerce Protocol version, canonical first.
// Release retries, provenance checks, and SBOM recovery for tags cut before the
// specs/ move read the historical entry.
export const commerceProtocolManifest = {
  path: "specs/commerce-protocol/package.json",
  historicalPaths: ["specs/openiap-kit/package.json"],
};

const readCommerceProtocolVersion = (root) => {
  const candidates = [
    commerceProtocolManifest.path,
    ...commerceProtocolManifest.historicalPaths,
  ];
  const manifest =
    candidates.find((candidate) => existsSync(resolve(root, candidate))) ??
    commerceProtocolManifest.path;
  return readJson(root, manifest).version;
};

export const versionSources = {
  apple: {
    label: "openiap-apple",
    read: (root) => readJson(root, "openiap-versions.json").apple,
  },
  conformance: {
    label: "openiap-conformance",
    read: (root) => readJson(root, "packages/conformance/package.json").version,
  },
  "commerce-protocol": {
    label: "openiap-commerce-protocol",
    read: readCommerceProtocolVersion,
  },
  docs: {
    label: "OpenIAP Spec",
    read: (root) => readJson(root, "openiap-versions.json").spec,
  },
  expo: {
    label: "expo-iap",
    read: (root) => readJson(root, "libraries/expo-iap/package.json").version,
  },
  flutter: {
    label: "flutter_inapp_purchase",
    read: (root) =>
      matchVersion(
        readText(root, "libraries/flutter_inapp_purchase/pubspec.yaml"),
        /^version:\s*([^\s]+)$/m,
        "Flutter version",
      ),
  },
  godot: {
    label: "godot-iap",
    read: (root) =>
      matchVersion(
        readText(root, "libraries/godot-iap/addons/godot-iap/plugin.cfg"),
        /^version="([^"]+)"$/m,
        "Godot version",
      ),
  },
  google: {
    label: "openiap-google",
    read: (root) => readJson(root, "openiap-versions.json").google,
  },
  kmp: {
    label: "kmp-iap",
    read: (root) =>
      matchVersion(
        readText(root, "libraries/kmp-iap/gradle.properties"),
        /^libraryVersion=(.+)$/m,
        "KMP version",
      ),
  },
  maui: {
    label: "OpenIap.Maui",
    read: (root) =>
      matchVersion(
        readText(
          root,
          "libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj",
        ),
        /<PackageVersion>([^<]+)<\/PackageVersion>/,
        "MAUI version",
      ),
  },
  "react-native": {
    label: "react-native-iap",
    read: (root) =>
      readJson(root, "libraries/react-native-iap/package.json").version,
  },
};

function readText(root, relativePath) {
  return readFileSync(resolve(root, relativePath), "utf8");
}

function readJson(root, relativePath) {
  return JSON.parse(readText(root, relativePath));
}

function matchVersion(content, pattern, label) {
  const match = content.match(pattern);
  if (!match) {
    throw new Error(`Unable to read ${label}`);
  }
  return match[1].trim();
}

export function validateVersion(version, label) {
  const normalizedVersion = String(version ?? "").trim();
  if (!semverPattern.test(normalizedVersion)) {
    throw new Error(`Invalid ${label}: '${normalizedVersion || "(missing)"}'`);
  }
  return normalizedVersion;
}

function parseSemVer(version, label) {
  const normalizedVersion = validateVersion(version, label);
  const match = normalizedVersion.match(semverPattern);
  return {
    major: BigInt(match[1]),
    minor: BigInt(match[2]),
    patch: BigInt(match[3]),
    prerelease: match[4]?.split(".") ?? [],
  };
}

function comparePrereleaseIdentifier(left, right) {
  const leftIsNumeric = /^\d+$/.test(left);
  const rightIsNumeric = /^\d+$/.test(right);
  if (leftIsNumeric && rightIsNumeric) {
    const leftNumber = BigInt(left);
    const rightNumber = BigInt(right);
    return leftNumber < rightNumber ? -1 : leftNumber > rightNumber ? 1 : 0;
  }
  if (leftIsNumeric !== rightIsNumeric) {
    return leftIsNumeric ? -1 : 1;
  }
  return left < right ? -1 : left > right ? 1 : 0;
}

export function compareSemVer(leftVersion, rightVersion) {
  const left = parseSemVer(leftVersion, "left version");
  const right = parseSemVer(rightVersion, "right version");

  for (const key of ["major", "minor", "patch"]) {
    if (left[key] < right[key]) return -1;
    if (left[key] > right[key]) return 1;
  }

  if (left.prerelease.length === 0 || right.prerelease.length === 0) {
    if (left.prerelease.length === right.prerelease.length) return 0;
    return left.prerelease.length === 0 ? 1 : -1;
  }

  const identifierCount = Math.max(
    left.prerelease.length,
    right.prerelease.length,
  );
  for (let index = 0; index < identifierCount; index += 1) {
    const leftIdentifier = left.prerelease[index];
    const rightIdentifier = right.prerelease[index];
    if (leftIdentifier === undefined) return -1;
    if (rightIdentifier === undefined) return 1;
    const comparison = comparePrereleaseIdentifier(
      leftIdentifier,
      rightIdentifier,
    );
    if (comparison !== 0) return comparison;
  }
  return 0;
}

export function nativeSpecFloor(versions) {
  const google = validateVersion(versions?.google, "openiap-google version");
  const apple = validateVersion(versions?.apple, "openiap-apple version");
  const comparison = compareSemVer(google, apple);
  if (comparison < 0) return google;
  if (comparison > 0) return apple;

  // Build metadata does not affect SemVer precedence. Pick one native version
  // deterministically so the derived spec remains an exact native value.
  return google <= apple ? google : apple;
}

export function assertSpecMatchesNativeFloor(versions) {
  const spec = validateVersion(versions?.spec, "OpenIAP Spec version");
  const floor = nativeSpecFloor(versions);
  if (spec !== floor) {
    throw new Error(
      `OpenIAP Spec ${spec} must equal the native version floor ` +
        `min(openiap-google ${versions.google}, openiap-apple ${versions.apple}) = ${floor}`,
    );
  }
  return floor;
}

export function withUpdatedNativeVersion(versions, packageId, targetVersion) {
  if (packageId !== "apple" && packageId !== "google") {
    throw new Error(
      `Only native versions can derive the spec; expected 'apple' or 'google', got '${packageId}'`,
    );
  }
  const currentVersion = validateVersion(
    versions?.[packageId],
    `${versionSources[packageId].label} current version`,
  );
  const validatedTargetVersion = validateVersion(
    targetVersion,
    `${versionSources[packageId].label} target version`,
  );
  if (compareSemVer(validatedTargetVersion, currentVersion) < 0) {
    throw new Error(
      `${versionSources[packageId].label} target ${validatedTargetVersion} ` +
        `must not be lower than current version ${currentVersion}`,
    );
  }
  const updatedVersions = {
    ...versions,
    [packageId]: validatedTargetVersion,
  };
  updatedVersions.spec = nativeSpecFloor(updatedVersions);
  assertSpecMatchesNativeFloor(updatedVersions);
  return updatedVersions;
}

export function isPrereleaseVersion(version) {
  return String(version).split("+", 1)[0].includes("-");
}

export function normalizeBranch(ref) {
  return String(ref ?? "")
    .replace(/^refs\/heads\//, "")
    .replace(/^origin\//, "");
}

export function resolveReleaseChannel({
  currentVersion,
  prerelease,
  targetVersion,
  versionMode,
}) {
  if (targetVersion) {
    return isPrereleaseVersion(targetVersion) ? "prerelease" : "stable";
  }
  if (versionMode === "current") {
    return isPrereleaseVersion(currentVersion) ? "prerelease" : "stable";
  }
  if (versionMode === "rc-bump" || String(prerelease) === "true") {
    return "prerelease";
  }
  return "stable";
}

export function assertReleaseBranch({ branch, channel, packageLabel }) {
  const normalizedBranch = normalizeBranch(branch);
  const expectedBranch = channel === "prerelease" ? "next" : "main";
  if (normalizedBranch !== expectedBranch) {
    throw new Error(
      `${packageLabel} ${channel} releases must run from '${expectedBranch}', ` +
        `not '${normalizedBranch || "(unknown)"}'`,
    );
  }
  return expectedBranch;
}

export function findPrereleaseVersions(versions) {
  return Object.entries(versions).filter(([, version]) =>
    isPrereleaseVersion(version),
  );
}

export function allowsPrereleaseMetadata(branch) {
  return normalizeBranch(branch) === "next";
}

function readAllVersions(root = repoRoot) {
  return Object.fromEntries(
    Object.entries(versionSources).map(([id, source]) => [
      id,
      validateVersion(source.read(root), source.label),
    ]),
  );
}

function readVersionManifest(root = repoRoot) {
  return readJson(root, "openiap-versions.json");
}

function writeVersionManifest(versions, root = repoRoot) {
  const versionsPath = resolve(root, "openiap-versions.json");
  const temporaryPath = `${versionsPath}.${process.pid}.tmp`;
  try {
    writeFileSync(temporaryPath, `${JSON.stringify(versions, null, 2)}\n`);
    renameSync(temporaryPath, versionsPath);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

export function updateNativeVersion(packageId, targetVersion, root = repoRoot) {
  const updatedVersions = withUpdatedNativeVersion(
    readVersionManifest(root),
    packageId,
    targetVersion,
  );
  writeVersionManifest(updatedVersions, root);
  return updatedVersions;
}

function readCurrentBranch() {
  try {
    return execFileSync("git", ["branch", "--show-current"], {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
  } catch {
    return "";
  }
}

function runGuard(args) {
  const [packageId, versionMode, prerelease, branch, targetVersion = ""] = args;
  const source = versionSources[packageId];
  if (!source) {
    throw new Error(
      `Unknown package '${packageId}'. Expected one of: ${Object.keys(versionSources).join(", ")}`,
    );
  }
  if (!versionMode || !branch) {
    throw new Error(
      "Usage: release-branch-policy.mjs guard <package> <version-mode> <prerelease> <branch> [target-version]",
    );
  }

  const versionManifest = readVersionManifest();
  const specFloor = assertSpecMatchesNativeFloor(versionManifest);
  const currentVersion = validateVersion(source.read(repoRoot), source.label);
  const validatedTargetVersion = targetVersion
    ? validateVersion(targetVersion, `${source.label} target version`)
    : "";
  if (packageId === "docs") {
    if (versionMode !== "current") {
      throw new Error(
        "OpenIAP Spec is derived from native package versions and cannot be bumped independently; use version mode 'current'",
      );
    }
    const requestedVersion = validatedTargetVersion || currentVersion;
    if (requestedVersion !== specFloor) {
      throw new Error(
        `Docs target ${requestedVersion} must equal the native version floor ${specFloor}`,
      );
    }
    if (isPrereleaseVersion(requestedVersion)) {
      throw new Error(
        "Production docs accept stable native-derived spec versions only",
      );
    }
  }
  const channel = resolveReleaseChannel({
    currentVersion,
    prerelease,
    targetVersion: validatedTargetVersion,
    versionMode,
  });
  const expectedBranch = assertReleaseBranch({
    branch,
    channel,
    packageLabel: source.label,
  });

  console.log(
    `Release branch policy: ${source.label} ${channel} release on '${expectedBranch}' ` +
      `(current ${currentVersion})`,
  );
}

function runAssertFloor() {
  const floor = assertSpecMatchesNativeFloor(readVersionManifest());
  console.log(
    `Release version policy: OpenIAP Spec matches native floor ${floor}.`,
  );
}

function runUpdateNative(args) {
  const [packageId, targetVersion] = args;
  if (!packageId || !targetVersion) {
    throw new Error(
      "Usage: release-branch-policy.mjs update-native <apple|google> <target-version>",
    );
  }
  const updatedVersions = updateNativeVersion(packageId, targetVersion);
  console.log(
    `Updated ${versionSources[packageId].label} to ${updatedVersions[packageId]}; ` +
      `derived OpenIAP Spec ${updatedVersions.spec}.`,
  );
}

function runAudit(args) {
  const targetBranch = normalizeBranch(
    args[0] ||
      process.env.GITHUB_BASE_REF ||
      process.env.GITHUB_REF_NAME ||
      readCurrentBranch(),
  );
  const versionManifest = readVersionManifest();
  assertSpecMatchesNativeFloor(versionManifest);
  const versions = readAllVersions();

  if (allowsPrereleaseMetadata(targetBranch)) {
    console.log(
      "Release state audit: 'next' may contain prerelease package versions.",
    );
    return;
  }

  const prereleases = findPrereleaseVersions(versions);
  if (prereleases.length > 0) {
    const details = prereleases
      .map(
        ([packageId, version]) =>
          `${versionSources[packageId].label}=${version}`,
      )
      .join(", ");
    throw new Error(
      `Only prerelease branch 'next' may contain prerelease package versions; ` +
        `'${targetBranch || "(unknown)"}' contains: ${details}`,
    );
  }

  const branchLabel = targetBranch || "(unknown)";
  console.log(
    `Release state audit: '${branchLabel}' contains stable versions only.`,
  );
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "assert-floor") {
    runAssertFloor();
    return;
  }
  if (command === "guard") {
    runGuard(args);
    return;
  }
  if (command === "update-native") {
    runUpdateNative(args);
    return;
  }
  if (command === "audit") {
    runAudit(args);
    return;
  }
  throw new Error(
    "Usage: release-branch-policy.mjs <assert-floor|audit|guard|update-native> [arguments]",
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
