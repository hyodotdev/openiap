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
const prereleaseIdentifier =
  "(?:0|[1-9]\\d*|(?=[0-9A-Za-z-]*[A-Za-z-])[0-9A-Za-z-]+)";
const semverPattern = new RegExp(
  `^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-(${prereleaseIdentifier}(?:\\.${prereleaseIdentifier})*))?(?:\\+([0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*))?$`,
);

// Manifests that have carried the Commerce Protocol version, canonical first.
// Release retries, provenance checks, and SBOM recovery for tags cut before the
// specs/ move read the historical entry.
export const commerceProtocolManifest = {
  path: "specs/commerce-protocol/package.json",
  historicalPaths: ["specs/openiap-kit/package.json"],
};

export const openiapNpmPackages = {
  "client-protocol": {
    name: "@hyodotdev/openiap-client-protocol",
    path: "specs/client/package.json",
    tagPrefix: "openiap-client-protocol",
  },
  "commerce-protocol": {
    name: "@hyodotdev/openiap-commerce-protocol",
    path: commerceProtocolManifest.path,
    tagPrefix: "hyodotdev-openiap-commerce-protocol",
  },
  cli: {
    name: "@hyodotdev/openiap",
    path: "packages/cli/package.json",
    tagPrefix: "openiap",
  },
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
  ...Object.fromEntries(
    Object.entries(openiapNpmPackages).map(([id, config]) => [
      id,
      {
        label: config.name,
        read: (root) => readJson(root, config.path).version,
      },
    ]),
  ),
  apple: {
    label: "openiap-apple",
    read: (root) => readJson(root, "openiap-versions.json").apple,
  },
  conformance: {
    label: "openiap-conformance",
    read: (root) => readJson(root, "packages/conformance/package.json").version,
  },
  "commerce-protocol": {
    label: "@hyodotdev/openiap-commerce-protocol",
    read: readCommerceProtocolVersion,
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

/** The contract's own version, from the package that publishes it. */
export function clientProtocolVersion(root = repoRoot) {
  return validateVersion(
    readJson(root, "specs/client/package.json").version,
    "client protocol version",
  );
}

export function assertClientProtocol(versions, root = repoRoot) {
  const declared = validateVersion(
    versions?.clientProtocol,
    "client protocol version",
  );
  const published = clientProtocolVersion(root);
  if (declared !== published) {
    throw new Error(
      `openiap-versions.json clientProtocol ${declared} must equal ` +
        `specs/client/package.json ${published}`,
    );
  }
  return declared;
}

export function withUpdatedNativeVersion(versions, packageId, targetVersion) {
  if (packageId !== "apple" && packageId !== "google") {
    throw new Error(
      `Only native package versions live in this manifest; expected 'apple' or 'google', got '${packageId}'`,
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
  const expectedBranch = "main";
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

// What each published package ships. A change here needs a release card
// (audit-release-notes.mjs), and a framework library release waits until the
// native packages have released theirs (native-gate below). Manifests stay out
// so dependency bumps pass.
export const publishedSources = {
  google: [
    /^packages\/google\/openiap\/src\/(main|play|horizon|amazon)\//,
    /^packages\/google\/openiap\/(build\.gradle\.kts|consumer-rules[\w-]*\.pro)$/,
    // openiap-core ships its own manifest, keep rules, and build script; its
    // classes come from openiap/src/main, already listed above.
    /^packages\/google\/core\/src\/main\//,
    /^packages\/google\/core\/(build\.gradle\.kts|consumer-rules[\w-]*\.pro)$/,
    // The google release also publishes the openiap-conformance artifact.
    /^packages\/conformance\/android\/src\/main\//,
    /^packages\/conformance\/android\/build\.gradle\.kts$/,
    /^packages\/google\/gradle\/[^/]+\.gradle$/,
    /^packages\/google\/gradle-plugin\/(src\/main\/|build\.gradle\.kts$)/,
  ],
  apple: [
    /^packages\/apple\/Sources\//,
    /^packages\/apple\/(Package\.swift|openiap\.podspec)$/,
    // Every Apple tag ships the OpenIapConformance product too.
    /^packages\/conformance\/apple\/Sources\//,
    // SwiftPM and CocoaPods git sources resolve openiap-apple from the root.
    /^(Package\.swift|openiap\.podspec)$/,
  ],
  "client-protocol": [
    /^specs\/client\/src\/(generated\/|[^/]+\.graphql$|kit-api\.ts$)/,
  ],
  cli: [/^packages\/cli\/(src|bin)\//],
  "react-native": [
    /^libraries\/react-native-iap\/(src|ios|android\/src\/main)\//,
    /^libraries\/react-native-iap\/(android\/([^/]+\.gradle|consumer-rules[\w-]*\.pro|CMakeLists\.txt)|NitroIap\.podspec|nitro\.json)$/,
  ],
  expo: [
    /^libraries\/expo-iap\/(src|ios|onside|plugin\/src|android\/src\/main)\//,
    /^libraries\/expo-iap\/(android\/[^/]+\.gradle|app\.plugin\.js|expo-module\.config\.json)$/,
  ],
  flutter: [
    /^libraries\/flutter_inapp_purchase\/(lib|ios|macos|android\/src\/(main|none|store))\//,
    /^libraries\/flutter_inapp_purchase\/android\/[^/]+\.gradle$/,
  ],
  godot: [
    /^libraries\/godot-iap\/(addons\/godot-iap|android\/src\/main|ios-gdextension)\//,
    /^libraries\/godot-iap\/android\/[^/]+\.gradle\.kts$/,
    // The release zip carries the embed fix, and the .gdap is written from this script.
    /^libraries\/godot-iap\/scripts\/(fix_ios_embed|write-gdap)\.sh$/,
  ],
  kmp: [
    /^libraries\/kmp-iap\/library\/src\/(commonMain|androidMain|iosMain)\//,
    /^libraries\/kmp-iap\/library\/(build\.gradle\.kts|consumer-rules[\w-]*\.pro)$/,
  ],
  maui: [
    /^libraries\/maui-iap\/(src|android\/openiap)\//,
    /^libraries\/maui-iap\/android\/[^/]+\.gradle\.kts$/,
  ],
};

const isTest = (file) =>
  /(^|\/)(__tests__|__mocks__|[Tt]ests?)\//.test(file) ||
  /\.(test|spec)\.[^./]+$/.test(file);

export function shipsIn(packageId, file) {
  return (
    !isTest(file) &&
    publishedSources[packageId].some((pattern) => pattern.test(file))
  );
}

export function shipsInAnyPackage(file) {
  return Object.keys(publishedSources).some((packageId) =>
    shipsIn(packageId, file),
  );
}

// Framework libraries pin the released native packages, so a library released
// while one of them has unreleased source ships without that change (an Expo
// release once went out 93 minutes before the natives it needed). `roots`
// only narrows the log; publishedSources decides what counts.
export const nativeReleaseGates = {
  google: {
    tag: (version) => `google-${version}`,
    roots: ["packages/google", "packages/conformance/android"],
  },
  apple: {
    tag: (version) => version,
    roots: [
      "packages/apple",
      "packages/conformance/apple",
      "Package.swift",
      "openiap.podspec",
    ],
  },
};

// The tags the framework library release workflows cut.
export const libraryReleaseTags = {
  "react-native": (version) => `react-native-iap-${version}`,
  expo: (version) => `expo-iap-${version}`,
  flutter: (version) => `flutter-iap-${version}`,
  godot: (version) => `godot-iap-${version}`,
  kmp: (version) => `kmp-iap-${version}`,
  maui: (version) => `maui-iap-${version}`,
};

function runGit(args, root = repoRoot) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8" });
}

// Source commits since each native package's release tag; version bumps excluded.
export function findUnreleasedNativeChanges(
  versions,
  { git = runGit, gates = nativeReleaseGates } = {},
) {
  const pending = [];
  for (const [id, gate] of Object.entries(gates)) {
    const tag = gate.tag(versions[id]);
    let log;
    try {
      log = git([
        "log",
        "--format=%x00%h %s",
        "--name-only",
        `${tag}..HEAD`,
        "--",
        ...gate.roots,
      ]);
    } catch {
      throw new Error(
        `Cannot compare with release tag '${tag}'; check out with full history and tags (fetch-depth: 0)`,
      );
    }
    const commits = log
      .split("\0")
      .map((entry) => entry.split("\n").filter(Boolean))
      .filter(
        ([subject, ...files]) =>
          subject &&
          !/^\S+ chore\(release\):/.test(subject) &&
          files.some((file) => shipsIn(id, file)),
      )
      .map(([subject]) => subject);
    if (commits.length > 0) {
      pending.push({ label: versionSources[id].label, tag, commits });
    }
  }
  return pending;
}

export function assertNativesReleased(versions, options) {
  const pending = findUnreleasedNativeChanges(versions, options);
  if (pending.length === 0) return;
  const details = pending
    .map(
      ({ label, tag, commits }) =>
        `${label} since ${tag}: ${commits.join("; ")}`,
    )
    .join(" | ");
  throw new Error(
    `Native gate: release the native packages first, or rerun with allow_unreleased_native when this library must not wait. ${details}`,
  );
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
  assertClientProtocol(versionManifest);
  const currentVersion = validateVersion(source.read(repoRoot), source.label);
  if (Object.hasOwn(openiapNpmPackages, packageId)) {
    if (
      !["current", "patch", "minor", "major", "rc-bump", "exact"].includes(
        versionMode,
      )
    ) {
      throw new Error(`Unknown npm version mode '${versionMode}'`);
    }
    if ((versionMode === "exact") !== Boolean(targetVersion)) {
      throw new Error(
        "An exact release requires target-version; other modes must omit it",
      );
    }
  }
  if (packageId === "conformance") {
    throw new Error("The standalone conformance npm package is retired");
  }
  const validatedTargetVersion = targetVersion
    ? validateVersion(targetVersion, `${source.label} target version`)
    : "";
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

// Why a library release may skip the native gate, or null when it may not.
export function nativeGateSkipReason(
  library,
  versionMode,
  prerelease,
  { root = repoRoot, git = runGit } = {},
) {
  const releaseTag = libraryReleaseTags[library];
  if (!releaseTag) {
    throw new Error(
      `Unknown framework library '${library}'. Expected one of: ${Object.keys(libraryReleaseTags).join(", ")}`,
    );
  }
  if (versionMode === "rc-bump" || String(prerelease) === "true") {
    return "a prerelease may precede the native packages";
  }
  if (versionMode !== "current") return null;
  // version=current without its tag is a first release, so it is gated too.
  const tag = releaseTag(versionSources[library].read(root));
  return hasReleaseTag(tag, { root, git })
    ? `${tag} exists, so this republishes it`
    : null;
}

// Needs a checkout that fetched tags; a shallow one reads every tag as missing.
export function hasReleaseTag(tag, { root = repoRoot, git = runGit } = {}) {
  try {
    git(["rev-parse", "--verify", "--quiet", `refs/tags/${tag}`], root);
    return true;
  } catch {
    return false;
  }
}

// Run once per framework library release, from a full-history checkout.
function runNativeGate(args) {
  const [library, versionMode, prerelease] = args;
  if (!library || !versionMode) {
    throw new Error(
      "Usage: release-branch-policy.mjs native-gate <library> <version-mode> <prerelease>",
    );
  }
  const skipReason = nativeGateSkipReason(library, versionMode, prerelease);
  if (skipReason) {
    console.log(`Native gate: not needed; ${skipReason}.`);
    return;
  }
  if (process.env.OPENIAP_ALLOW_UNRELEASED_NATIVE === "true") {
    console.log("::warning::Native gate skipped by allow_unreleased_native.");
    return;
  }
  assertNativesReleased(readVersionManifest());
  console.log(
    "Native gate: openiap-google and openiap-apple have no unreleased source changes.",
  );
}

function runAssertClientProtocol() {
  const version = assertClientProtocol(readVersionManifest());
  console.log(`Release version policy: client protocol ${version}.`);
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
    `Updated ${versionSources[packageId].label} to ${updatedVersions[packageId]}.`,
  );
}

function runAudit(args) {
  if (args.length) throw new Error("Usage: release-branch-policy.mjs audit");
  assertClientProtocol(readVersionManifest());
  const versions = readAllVersions();
  console.log(
    `Release metadata audit: versions are valid and synchronized; ${findPrereleaseVersions(versions).length} prerelease package(s).`,
  );
}

function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "assert-client-protocol") {
    runAssertClientProtocol();
    return;
  }
  if (command === "guard") {
    runGuard(args);
    return;
  }
  if (command === "native-gate") {
    runNativeGate(args);
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
    "Usage: release-branch-policy.mjs <assert-client-protocol|audit|guard|native-gate|update-native> [arguments]",
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
