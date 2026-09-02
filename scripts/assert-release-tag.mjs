#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { validateVersion } from "./release-branch-policy.mjs";

export const PACKAGE_CONFIG = {
  apple: {
    path: "openiap-versions.json",
    tags: (version) => [version, `apple-v${version}`],
    version: (content) => JSON.parse(content).apple,
  },
  conformance: {
    path: "packages/conformance/package.json",
    tags: (version) => [`openiap-conformance-${version}`],
    version: (content) => JSON.parse(content).version,
  },
  "commerce-protocol": {
    path: "specs/openiap-kit/package.json",
    tags: (version) => [`openiap-commerce-protocol-${version}`],
    version: (content) => JSON.parse(content).version,
  },
  docs: {
    path: "openiap-versions.json",
    tags: (version) => [`docs-${version}`],
    version: (content) => JSON.parse(content).spec,
  },
  expo: {
    path: "libraries/expo-iap/package.json",
    tags: (version) => [`expo-iap-${version}`],
    version: (content) => JSON.parse(content).version,
  },
  flutter: {
    path: "libraries/flutter_inapp_purchase/pubspec.yaml",
    tags: (version) => [`flutter-iap-${version}`],
    version: (content) => content.match(/^version:\s*([^\s#]+)/mu)?.[1],
  },
  godot: {
    path: "libraries/godot-iap/addons/godot-iap/plugin.cfg",
    tags: (version) => [`godot-iap-${version}`],
    version: (content) => content.match(/^version="([^"]+)"/mu)?.[1],
  },
  google: {
    path: "openiap-versions.json",
    tags: (version) => [`google-${version}`, `google-v${version}`],
    version: (content) => JSON.parse(content).google,
  },
  kmp: {
    path: "libraries/kmp-iap/gradle.properties",
    tags: (version) => [`kmp-iap-${version}`],
    version: (content) => content.match(/^libraryVersion=(.+)$/mu)?.[1]?.trim(),
  },
  maui: {
    path: "libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj",
    tags: (version) => [`maui-iap-${version}`],
    version: (content) =>
      content.match(/<PackageVersion>([^<]+)<\/PackageVersion>/u)?.[1] ??
      content.match(/<Version>([^<]+)<\/Version>/u)?.[1],
  },
  "react-native": {
    path: "libraries/react-native-iap/package.json",
    tags: (version) => [`react-native-iap-${version}`],
    version: (content) => JSON.parse(content).version,
  },
};

function defaultRunGit(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  }).trim();
}

function parseRemoteTagCommit(output, tag) {
  const refs = new Map(
    output
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [sha, ref] = line.trim().split(/\s+/u);
        return [ref, sha];
      }),
  );
  return refs.get(`refs/tags/${tag}^{}`) ?? refs.get(`refs/tags/${tag}`) ?? "";
}

export function assertReleaseTag(
  { packageId, branch, tag, expectedVersion },
  runGit = defaultRunGit,
) {
  const config = PACKAGE_CONFIG[packageId];
  if (!config) {
    throw new Error(`Unsupported release package: ${packageId}`);
  }
  if (!new Set(["main", "next"]).has(branch)) {
    throw new Error(
      `Release tag branch must be main or next, received ${branch}`,
    );
  }

  const version = validateVersion(expectedVersion, `${packageId} version`);
  if (!config.tags(version).includes(tag)) {
    throw new Error(
      `Unexpected ${packageId} release tag ${tag} for ${version}`,
    );
  }

  const metadata = runGit(["show", `${tag}:${config.path}`]);
  const tagVersion = config.version(metadata);
  if (tagVersion !== version) {
    throw new Error(
      `${tag} metadata version is ${tagVersion || "missing"}, expected ${version}`,
    );
  }

  const localTagCommit = runGit(["rev-parse", `${tag}^{commit}`]);
  const remoteTagCommit = parseRemoteTagCommit(
    runGit([
      "ls-remote",
      "--exit-code",
      "origin",
      `refs/tags/${tag}`,
      `refs/tags/${tag}^{}`,
    ]),
    tag,
  );
  if (!remoteTagCommit || remoteTagCommit !== localTagCommit) {
    throw new Error(
      `${tag} does not match its origin tag commit at verification time (${localTagCommit})`,
    );
  }

  const remoteBranch = `refs/remotes/origin/${branch}`;
  runGit([
    "fetch",
    "--no-tags",
    "origin",
    `refs/heads/${branch}:${remoteBranch}`,
  ]);
  const remoteHead = runGit(["rev-parse", remoteBranch]);
  try {
    runGit(["merge-base", "--is-ancestor", localTagCommit, remoteHead]);
  } catch {
    throw new Error(
      `${tag} at ${localTagCommit} is not reachable from origin/${branch} at ${remoteHead}`,
    );
  }

  console.log(
    `Release tag verified: ${tag} (${version}) is reachable from origin/${branch}`,
  );
}

async function main() {
  const [packageId, branch, tag, expectedVersion] = process.argv.slice(2);
  if (!packageId || !branch || !tag || !expectedVersion) {
    throw new Error(
      "Usage: node scripts/assert-release-tag.mjs <package> <branch> <tag> <version>",
    );
  }
  assertReleaseTag({ packageId, branch, tag, expectedVersion });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Release tag verification failed: ${error.message}`);
    process.exitCode = 1;
  });
}
