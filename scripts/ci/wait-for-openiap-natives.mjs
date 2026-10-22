#!/usr/bin/env node
// Waits until the registries serve the native versions openiap-versions.json
// pins. A native release pushes its version and tag minutes before Maven
// Central or CocoaPods serve it, and can fail in between, so CI jobs that
// resolve a pin from a registry and library releases that ship one wait here.
// `--root` reads the pins of another checkout, such as a release tag.
import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import {
  readPackageVersion,
  validateVersion,
} from "../release-branch-policy.mjs";

const USAGE =
  "Usage: wait-for-openiap-natives.mjs [--root <checkout>] <google|apple>...";
const MAVEN = "https://repo1.maven.org/maven2/io/github/hyochan/openiap";
const pom = (artifact) => ({
  name: `Maven Central ${artifact}`,
  url: (version) =>
    `${MAVEN}/${artifact}/${version}/${artifact}-${version}.pom`,
});

// What a published library makes its consumers resolve for each native.
const REGISTRIES = {
  google: [
    "openiap-core",
    "openiap-google",
    "openiap-google-horizon",
    "openiap-google-amazon",
    // The KMP guide applies the store plugin at the google version.
    "openiap-gradle-plugin",
    "io.github.hyochan.openiap.gradle.plugin",
  ].map(pom),
  apple: [
    {
      name: "CocoaPods openiap",
      // `pod install` takes versions from this CDN index (sharded by
      // md5("openiap")), which lags the podspec by minutes and stays up after
      // trunk turns read-only.
      url: () => "https://cdn.cocoapods.org/all_pods_versions_8_5_e.txt",
      lists: (index, version) =>
        index.split("\n").some((line) => {
          const [pod, ...versions] = line.trim().split("/");
          return pod === "openiap" && versions.includes(version);
        }),
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
    return REGISTRIES[native].map(({ name, url, lists }) => ({
      label: `${name} ${version}`,
      url: url(version),
      listed: lists && ((body) => lists(body, version)),
    }));
  });
  const deadline = now() + timeoutMs;
  for (;;) {
    const missing = [];
    for (const { label, url, listed } of checks) {
      const status = await fetchImpl(url, {
        method: listed ? "GET" : "HEAD",
        signal: AbortSignal.timeout(15_000),
      })
        .then(async (response) => {
          if (!response.ok) return `HTTP ${response.status}`;
          return !listed || listed(await response.text()) ? null : "not listed";
        })
        .catch((error) => error.cause?.code ?? error.name ?? "fetch failed");
      if (status) missing.push(`${label} (${status})`);
    }
    if (missing.length === 0) return;
    const summary = missing.join(", ");
    if (now() >= deadline) throw new Error(`Still not published: ${summary}`);
    log(`Waiting for ${summary}`);
    await sleep(intervalMs);
  }
}

export async function main(args, options) {
  const { values, positionals: natives } = parseArgs({
    args,
    options: { root: { type: "string" } },
    allowPositionals: true,
  });
  if (
    natives.length === 0 ||
    natives.some((native) => !Object.hasOwn(REGISTRIES, native))
  )
    throw new Error(USAGE);
  const pins = Object.fromEntries(
    natives.map((native) => [native, readPackageVersion(native, values.root)]),
  );
  await waitForOpenIapNatives(pins, options);
  return `Published: ${natives.map((native) => `openiap-${native} ${pins[native]}`).join(", ")}.`;
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  console.log(await main(process.argv.slice(2)));
}
