#!/usr/bin/env node
// Waits until Maven Central serves the openiap-google version that
// openiap-versions.json pins. A google release pushes that version to main
// minutes before the artifacts reach Maven Central, so jobs that resolve it
// from Maven wait here instead of failing.
import { readFileSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

const MAVEN = "https://repo1.maven.org/maven2/io/github/hyochan/openiap";
// The react-native-iap compatibility fixture resolves only these (Play is the
// default store). Add an artifact here before gating a job that needs another.
export const ARTIFACTS = ["openiap-core", "openiap-google"];

const pom = (artifact, version) =>
  `${MAVEN}/${artifact}/${version}/${artifact}-${version}.pom`;

export async function waitForOpenIapGoogle(
  version,
  {
    fetchImpl = fetch,
    sleep = (ms) => new Promise((done) => setTimeout(done, ms)),
    now = Date.now,
    timeoutMs = 45 * 60 * 1000,
    intervalMs = 30 * 1000,
    log = console.log,
  } = {},
) {
  if (!/^\d+\.\d+\.\d+(?:-rc\.\d+)?$/u.test(version))
    throw new Error(`Not an openiap-google release version: ${version}`);
  const deadline = now() + timeoutMs;
  for (;;) {
    const missing = [];
    for (const artifact of ARTIFACTS) {
      const status = await fetchImpl(pom(artifact, version), {
        method: "HEAD",
        signal: AbortSignal.timeout(15_000),
      }).then(
        (response) => (response.ok ? null : `HTTP ${response.status}`),
        (error) => error.cause?.code ?? error.name ?? "fetch failed",
      );
      if (status) missing.push(`${artifact} (${status})`);
    }
    if (missing.length === 0) return;
    const summary = `${missing.join(", ")} for ${version}`;
    if (now() >= deadline)
      throw new Error(`Maven Central still does not serve ${summary}`);
    log(`Waiting for Maven Central: ${summary}`);
    await sleep(intervalMs);
  }
}

if (
  process.argv[1] &&
  realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))
) {
  const { google } = JSON.parse(
    readFileSync(
      new URL("../../openiap-versions.json", import.meta.url),
      "utf8",
    ),
  );
  await waitForOpenIapGoogle(google);
  console.log(`openiap-google ${google} is on Maven Central.`);
}
