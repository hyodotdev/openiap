#!/usr/bin/env node
// Waits until the registries serve the native versions openiap-versions.json
// pins. A native release pushes its version and tag minutes before Maven
// Central or CocoaPods serve it, and can fail in between, so CI jobs that
// resolve a pin from a registry and library releases that ship one wait here.
// Usage: wait-for-openiap-natives.mjs <google|apple>...
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  readPackageVersion,
  validateVersion,
} from "../release-branch-policy.mjs";

const MAVEN = "https://repo1.maven.org/maven2/io/github/hyochan/openiap";
// cdn.cocoapods.org, which `pod install` reads, shards by md5("openiap").
const COCOAPODS = "https://cdn.cocoapods.org/Specs/8/5/e/openiap";

// What a published library makes its consumers resolve for each native.
export const REGISTRIES = {
  google: [
    "openiap-core",
    "openiap-google",
    "openiap-google-horizon",
    "openiap-google-amazon",
  ].map((artifact) => ({
    name: `Maven Central ${artifact}`,
    url: (version) =>
      `${MAVEN}/${artifact}/${version}/${artifact}-${version}.pom`,
  })),
  apple: [
    {
      name: "CocoaPods openiap",
      url: (version) => `${COCOAPODS}/${version}/openiap.podspec.json`,
    },
  ],
};

export async function waitForOpenIapNatives(
  pins,
  {
    fetchImpl = fetch,
    sleep = (ms) => new Promise((done) => setTimeout(done, ms)),
    now = Date.now,
    timeoutMs = 45 * 60 * 1000,
    intervalMs = 30 * 1000,
    log = console.log,
  } = {},
) {
  const checks = Object.entries(pins).flatMap(([native, pinned]) => {
    if (!Object.hasOwn(REGISTRIES, native))
      throw new Error(`Unknown native '${native}'; expected google or apple`);
    const version = validateVersion(pinned, `openiap-${native} version`);
    return REGISTRIES[native].map(({ name, url }) => ({
      label: `${name} ${version}`,
      url: url(version),
    }));
  });
  const deadline = now() + timeoutMs;
  for (;;) {
    const missing = [];
    for (const { label, url } of checks) {
      const status = await fetchImpl(url, {
        method: "HEAD",
        signal: AbortSignal.timeout(15_000),
      }).then(
        (response) => (response.ok ? null : `HTTP ${response.status}`),
        (error) => error.cause?.code ?? error.name ?? "fetch failed",
      );
      if (status) missing.push(`${label} (${status})`);
    }
    if (missing.length === 0) return;
    const summary = missing.join(", ");
    if (now() >= deadline) throw new Error(`Still not published: ${summary}`);
    log(`Waiting for ${summary}`);
    await sleep(intervalMs);
  }
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  const natives = process.argv.slice(2);
  if (natives.length === 0)
    throw new Error("Usage: wait-for-openiap-natives.mjs <google|apple>...");
  const pins = Object.fromEntries(
    natives.map((native) => [native, readPackageVersion(native)]),
  );
  await waitForOpenIapNatives(pins);
  console.log(
    `Published: ${natives.map((native) => `openiap-${native} ${pins[native]}`).join(", ")}.`,
  );
}
