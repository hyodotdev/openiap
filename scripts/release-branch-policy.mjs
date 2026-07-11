#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const versionSources = {
  apple: {
    label: "openiap-apple",
    read: (root) => readJson(root, "openiap-versions.json").apple,
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
  const semverPattern =
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
  if (!semverPattern.test(normalizedVersion)) {
    throw new Error(`Invalid ${label}: '${normalizedVersion || "(missing)"}'`);
  }
  return normalizedVersion;
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

  const currentVersion = validateVersion(source.read(repoRoot), source.label);
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

function runAudit(args) {
  const targetBranch = normalizeBranch(
    args[0] ||
      process.env.GITHUB_BASE_REF ||
      process.env.GITHUB_REF_NAME ||
      readCurrentBranch(),
  );
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
  if (command === "guard") {
    runGuard(args);
    return;
  }
  if (command === "audit") {
    runAudit(args);
    return;
  }
  throw new Error("Usage: release-branch-policy.mjs <guard|audit> [arguments]");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
