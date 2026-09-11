#!/usr/bin/env node

import { appendFileSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertSpecMatchesNativeFloor,
  openiapNpmPackages,
  validateVersion,
} from "./release-branch-policy.mjs";

export function releasePackage(packageId, root = process.cwd()) {
  if (!Object.hasOwn(openiapNpmPackages, packageId)) {
    throw new Error(`Unknown OpenIAP npm package '${packageId}'`);
  }
  const config = openiapNpmPackages[packageId];
  const manifest = JSON.parse(readFileSync(resolve(root, config.path), "utf8"));
  if (manifest.name !== config.name || manifest.private) {
    throw new Error(`${config.path} must publish ${config.name}`);
  }
  const version = validateVersion(manifest.version, config.name);
  if (packageId === "client-protocol") {
    const versions = JSON.parse(
      readFileSync(resolve(root, "openiap-versions.json"), "utf8"),
    );
    assertSpecMatchesNativeFloor(versions);
  }
  return { ...config, directory: dirname(config.path), version };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const config = releasePackage(process.argv[2]);
    const values = {
      PACKAGE_NAME: config.name,
      PACKAGE_DIR: config.directory,
      PACKAGE_MANIFEST: config.path,
      TAG_PREFIX: config.tagPrefix,
    };
    const output =
      Object.entries(values)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n") + "\n";
    if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, output);
    process.stdout.write(output);
  } catch (error) {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  }
}
