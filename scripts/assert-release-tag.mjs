#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  libraryReleaseTags,
  isPrereleaseVersion,
  nativeReleaseGates,
  openiapNpmPackages,
  validateVersion,
  versionSources,
} from "./release-branch-policy.mjs";

export const historicalNextArchive = Object.freeze({
  tag: "archive/next-2026-10-15",
  commit: "4197922b5f71f1ebe0d7b95aaae13b625b25ab94",
});

const releaseTags = {
  ...Object.fromEntries(
    Object.entries(openiapNpmPackages).map(([id, config]) => [
      id,
      (version) => [`${config.tagPrefix}-${version}`],
    ]),
  ),
  ...Object.fromEntries(
    Object.entries(libraryReleaseTags).map(([id, tag]) => [
      id,
      (version) => [tag(version)],
    ]),
  ),
  apple: (version) => [
    nativeReleaseGates.apple.tag(version),
    `apple-v${version}`,
  ],
  conformance: (version) => [`openiap-conformance-${version}`],
  "commerce-protocol": (version) => [
    `${openiapNpmPackages["commerce-protocol"].tagPrefix}-${version}`,
    `openiap-commerce-protocol-${version}`,
  ],
  google: (version) => [
    nativeReleaseGates.google.tag(version),
    `google-v${version}`,
  ],
};

// Each release's tag aliases, plus where its version lives (versionSources).
export const PACKAGE_CONFIG = Object.fromEntries(
  Object.entries(releaseTags).map(([id, tags]) => [
    id,
    { ...versionSources[id], tags },
  ]),
);

function defaultRunGit(args) {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    // Historical manifest probes are expected to miss on old tags, so git's
    // stderr only surfaces through the error that finally propagates.
    const stderr = String(error.stderr ?? "").trim();
    throw new Error(
      stderr ? `git ${args.join(" ")}: ${stderr}` : error.message,
    );
  }
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
  { packageId, source, tag, expectedVersion, expectedName },
  runGit = defaultRunGit,
) {
  const config = PACKAGE_CONFIG[packageId];
  if (!config) {
    throw new Error(`Unsupported release package: ${packageId}`);
  }
  if (!new Set(["main", "archive-next"]).has(source)) {
    throw new Error(
      `Release tag source must be main or archive-next, received ${source}`,
    );
  }

  const version = validateVersion(expectedVersion, `${packageId} version`);
  if (source === "archive-next" && !isPrereleaseVersion(version)) {
    throw new Error("The historical archive only verifies prereleases");
  }
  if (!config.tags(version).includes(tag)) {
    throw new Error(
      `Unexpected ${packageId} release tag ${tag} for ${version}`,
    );
  }

  let metadata;
  const metadataErrors = [];
  for (const manifestPath of [config.path, ...config.historicalPaths]) {
    try {
      metadata = runGit(["show", `${tag}:${manifestPath}`]);
      break;
    } catch (error) {
      metadataErrors.push(error.message);
    }
  }
  if (metadata === undefined) {
    throw new Error(
      `${tag} carries no release manifest:\n${metadataErrors.join("\n")}`,
    );
  }
  const tagVersion = config.parse(metadata);
  if (expectedName && JSON.parse(metadata).name !== expectedName) {
    throw new Error(
      `${tag} belongs to a different npm package. Release a new version instead of retrying current.`,
    );
  }
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

  const archived = source === "archive-next";
  const remoteRef = archived
    ? `refs/tags/${historicalNextArchive.tag}`
    : "refs/heads/main";
  const localRef = archived ? remoteRef : "refs/remotes/origin/main";
  runGit(["fetch", "--no-tags", "origin", `${remoteRef}:${localRef}`]);
  const sourceCommit = runGit([
    "rev-parse",
    archived ? `${localRef}^{commit}` : localRef,
  ]);
  if (archived && sourceCommit !== historicalNextArchive.commit) {
    throw new Error(
      `${historicalNextArchive.tag} must point to ${historicalNextArchive.commit}, received ${sourceCommit}`,
    );
  }
  const sourceLabel = archived ? historicalNextArchive.tag : "origin/main";
  try {
    runGit(["merge-base", "--is-ancestor", localTagCommit, sourceCommit]);
  } catch {
    throw new Error(
      `${tag} at ${localTagCommit} is not reachable from ${sourceLabel} at ${sourceCommit}`,
    );
  }

  console.log(
    `Release tag verified: ${tag} (${version}) is reachable from ${sourceLabel}`,
  );
}

async function main() {
  const [packageId, source, tag, expectedVersion, expectedName] =
    process.argv.slice(2);
  if (!packageId || !source || !tag || !expectedVersion) {
    throw new Error(
      "Usage: node scripts/assert-release-tag.mjs <package> <source> <tag> <version> [npm-package-name]",
    );
  }
  assertReleaseTag({ packageId, source, tag, expectedVersion, expectedName });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`Release tag verification failed: ${error.message}`);
    process.exitCode = 1;
  });
}
