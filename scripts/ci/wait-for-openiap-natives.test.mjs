import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { main, waitForOpenIapNatives } from "./wait-for-openiap-natives.mjs";

const MAVEN = "https://repo1.maven.org/maven2/io/github/hyochan/openiap";
const pom = (artifact, version) =>
  `${MAVEN}/${artifact}/${version}/${artifact}-${version}.pom`;
const INDEX = "https://cdn.cocoapods.org/all_pods_versions_8_5_e.txt";
const GOOGLE_ARTIFACTS = [
  "openiap-core",
  "openiap-google",
  "openiap-google-horizon",
  "openiap-google-amazon",
  "openiap-gradle-plugin",
  "io.github.hyochan.openiap.gradle.plugin",
];
const googlePoms = (version) =>
  Object.fromEntries(
    GOOGLE_ARTIFACTS.map((artifact) => [pom(artifact, version), {}]),
  );
// Another pod's line lists 4.0.3 too, so only the openiap line may count.
const index = (...versions) => ({
  body: () => `openiap-sdk/4.0.3\nopeniap/4.0.1/${versions.join("/")}\n`,
});

// A fake registry on a fake clock that each sleep advances. `served` maps a
// URL to the round `from` which it answers 200 with `body(round)` (Infinity =
// never; `status` is the error until then); any other URL is a 404.
// `fetchError` is thrown by every request.
function fakeRegistry(served, { fetchError } = {}) {
  let time = 0;
  let round = 0;
  const requests = [];
  return {
    requests,
    options: {
      fetchImpl: async (url, init) => {
        requests.push({
          url,
          method: init.method,
          timed: init.signal instanceof AbortSignal,
        });
        if (fetchError !== undefined) throw fetchError;
        const entry = served[url];
        const ok = entry !== undefined && round >= (entry.from ?? 0);
        const status = ok ? 200 : (entry?.status ?? 404);
        return {
          ok,
          status,
          text: async () => entry?.body?.(round) ?? "",
        };
      },
      sleep: async (ms) => {
        time += ms;
        round += 1;
      },
      now: () => time,
      log: () => {},
    },
  };
}

test("returns at once when every pinned native is published", async () => {
  const registry = fakeRegistry({
    ...googlePoms("4.0.4"),
    [INDEX]: index("4.0.3"),
  });
  await waitForOpenIapNatives(
    { google: "4.0.4", apple: "4.0.3" },
    registry.options,
  );
  assert.deepEqual(registry.requests, [
    ...GOOGLE_ARTIFACTS.map((artifact) => ({
      url: pom(artifact, "4.0.4"),
      method: "HEAD",
      timed: true,
    })),
    { url: INDEX, method: "GET", timed: true },
  ]);
});

test("polls a prerelease's own artifacts", async () => {
  const registry = fakeRegistry({
    ...googlePoms("4.1.0-rc.2"),
    [INDEX]: index("4.0.3", "4.1.0-rc.1"),
  });
  await waitForOpenIapNatives(
    { google: "4.1.0-rc.2", apple: "4.1.0-rc.1" },
    registry.options,
  );
  assert.deepEqual(
    registry.requests.map(({ url }) => url),
    [...GOOGLE_ARTIFACTS.map((artifact) => pom(artifact, "4.1.0-rc.2")), INDEX],
  );
});

test("rejects an unknown native or a malformed version before any request", async () => {
  const registry = fakeRegistry({});
  await assert.rejects(
    waitForOpenIapNatives({ amazon: "4.0.4" }, registry.options),
    /Unknown native 'amazon'/u,
  );
  for (const version of [undefined, "", "4.0", "..", "4.0.4-rc.1/../x"])
    await assert.rejects(
      waitForOpenIapNatives({ apple: version }, registry.options),
      /Invalid openiap-apple version/u,
    );
  assert.deepEqual(registry.requests, []);
});

test("waits until the pod index lists the version, not only for the POMs", async () => {
  const registry = fakeRegistry({
    ...googlePoms("4.0.4"),
    [pom("openiap-google", "4.0.4")]: { from: 2 },
    [INDEX]: {
      body: (round) => `openiap/4.0.2${round >= 3 ? "/4.0.3" : ""}\n`,
    },
  });
  await waitForOpenIapNatives(
    { google: "4.0.4", apple: "4.0.3" },
    registry.options,
  );
  assert.equal(registry.requests.length, (GOOGLE_ARTIFACTS.length + 1) * 4);
});

test("counts only the exact version on the openiap line", async () => {
  for (const [body, version, listed] of [
    ["openiap/4.0.30/4.1.0-rc.1\n", "4.0.3", false],
    ["openiap/4.0.30/4.1.0-rc.1\n", "4.1.0", false],
    ["openiap/4.0.2/4.0.3\r\nopeniap-sdk/1.0.0\r\n", "4.0.3", true],
  ]) {
    const registry = fakeRegistry({ [INDEX]: { body: () => body } });
    const wait = waitForOpenIapNatives(
      { apple: version },
      { ...registry.options, timeoutMs: 0 },
    );
    if (listed) await wait;
    else await assert.rejects(wait, /CocoaPods openiap \S+ \(not listed\)/u);
  }
});

test("polls every 30 seconds for 45 minutes by default", async () => {
  const registry = fakeRegistry({
    ...googlePoms("4.0.4"),
    [pom("openiap-google", "4.0.4")]: { from: Infinity },
  });
  await assert.rejects(
    waitForOpenIapNatives({ google: "4.0.4" }, registry.options),
  );
  assert.equal(registry.options.now(), 45 * 60 * 1000);
  assert.equal(registry.requests.length, GOOGLE_ARTIFACTS.length * 91);
});

test("fails naming only what is missing and why", async () => {
  const registry = fakeRegistry({
    ...googlePoms("4.0.4"),
    [pom("openiap-gradle-plugin", "4.0.4")]: { from: Infinity, status: 503 },
    [INDEX]: index("4.0.2"),
  });
  await assert.rejects(
    waitForOpenIapNatives(
      { google: "4.0.4", apple: "4.0.3" },
      { ...registry.options, timeoutMs: 120_000 },
    ),
    {
      message:
        "Still not published: Maven Central openiap-gradle-plugin 4.0.4 (HTTP 503), CocoaPods openiap 4.0.3 (not listed)",
    },
  );
  assert.equal(registry.requests.length, (GOOGLE_ARTIFACTS.length + 1) * 5);
});

test("reports a network error instead of a missing release", async () => {
  const lookupError = Object.assign(new TypeError("fetch failed"), {
    cause: { code: "ENOTFOUND" },
  });
  for (const [fetchError, status] of [
    [lookupError, "ENOTFOUND"],
    [new DOMException("timed out", "TimeoutError"), "TimeoutError"],
    [{}, "fetch failed"],
  ]) {
    const registry = fakeRegistry({ [INDEX]: index("4.0.3") }, { fetchError });
    await assert.rejects(
      waitForOpenIapNatives(
        { apple: "4.0.3" },
        { ...registry.options, timeoutMs: 120_000 },
      ),
      { message: `Still not published: CocoaPods openiap 4.0.3 (${status})` },
    );
    assert.equal(registry.requests.length, 5);
  }
});

test("main reads each native's pin from --root", async (t) => {
  const root = mkdtempSync(join(tmpdir(), "openiap-natives-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(
    join(root, "openiap-versions.json"),
    JSON.stringify({ google: "4.0.5", apple: "4.0.3" }),
  );
  const registry = fakeRegistry({
    ...googlePoms("4.0.5"),
    [INDEX]: index("4.0.3"),
  });
  assert.equal(
    await main(["--root", root, "google", "apple"], registry.options),
    "Published: openiap-google 4.0.5, openiap-apple 4.0.3.",
  );
  assert.equal(registry.requests.length, GOOGLE_ARTIFACTS.length + 1);
  for (const args of [[], ["--root", root], ["--root", root, "kmp"]])
    await assert.rejects(main(args, registry.options), /^Error: Usage:/u);
});
