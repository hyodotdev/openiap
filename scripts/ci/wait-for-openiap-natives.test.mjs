import assert from "node:assert/strict";
import test from "node:test";
import { waitForOpenIapNatives } from "./wait-for-openiap-natives.mjs";

const MAVEN = "https://repo1.maven.org/maven2/io/github/hyochan/openiap";
const pom = (artifact, version) =>
  `${MAVEN}/${artifact}/${version}/${artifact}-${version}.pom`;
const podspec = (version) =>
  `https://cdn.cocoapods.org/Specs/8/5/e/openiap/${version}/openiap.podspec.json`;
const GOOGLE_ARTIFACTS = [
  "openiap-core",
  "openiap-google",
  "openiap-google-horizon",
  "openiap-google-amazon",
];
const googleUrls = (version) =>
  GOOGLE_ARTIFACTS.map((artifact) => pom(artifact, version));

// A fake registry on a fake clock that each sleep advances. It serves `urls`,
// each from the round `readyAfter` gives it (Infinity = never), and answers 404
// for any other URL; `fetchError` is thrown by every request.
function fakeRegistry(urls, { readyAfter = {}, fetchError } = {}) {
  let time = 0;
  let round = 0;
  const served = new Map(urls.map((url) => [url, readyAfter[url] ?? 0]));
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
        const ok = served.has(url) && round >= served.get(url);
        return { ok, status: ok ? 200 : 404 };
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
  const urls = [...googleUrls("4.0.4"), podspec("4.0.3")];
  const registry = fakeRegistry(urls);
  await waitForOpenIapNatives(
    { google: "4.0.4", apple: "4.0.3" },
    registry.options,
  );
  assert.deepEqual(
    registry.requests,
    urls.map((url) => ({ url, method: "HEAD", timed: true })),
  );
});

test("polls a prerelease's own artifacts", async () => {
  const urls = [...googleUrls("4.1.0-rc.2"), podspec("4.1.0-rc.1")];
  const registry = fakeRegistry(urls);
  await waitForOpenIapNatives(
    { google: "4.1.0-rc.2", apple: "4.1.0-rc.1" },
    registry.options,
  );
  assert.deepEqual(
    registry.requests.map(({ url }) => url),
    urls,
  );
});

test("rejects an unknown native or a malformed version before any request", async () => {
  const registry = fakeRegistry([]);
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

test("waits while only some artifacts are published", async () => {
  const urls = [...googleUrls("4.0.4"), podspec("4.0.3")];
  const registry = fakeRegistry(urls, {
    readyAfter: { [pom("openiap-google", "4.0.4")]: 3, [podspec("4.0.3")]: 2 },
  });
  await waitForOpenIapNatives(
    { google: "4.0.4", apple: "4.0.3" },
    registry.options,
  );
  assert.equal(registry.requests.length, urls.length * 4);
});

test("polls every 30 seconds for 45 minutes by default", async () => {
  const urls = googleUrls("4.0.4");
  const registry = fakeRegistry(urls, {
    readyAfter: { [pom("openiap-google", "4.0.4")]: Infinity },
  });
  await assert.rejects(
    waitForOpenIapNatives({ google: "4.0.4" }, registry.options),
  );
  assert.equal(registry.options.now(), 45 * 60 * 1000);
  assert.equal(registry.requests.length, urls.length * 91);
});

test("fails naming only the missing artifacts and their status", async () => {
  const urls = [...googleUrls("4.0.4"), podspec("4.0.3")];
  const registry = fakeRegistry(urls, {
    readyAfter: {
      [pom("openiap-google-amazon", "4.0.4")]: Infinity,
      [podspec("4.0.3")]: Infinity,
    },
  });
  await assert.rejects(
    waitForOpenIapNatives(
      { google: "4.0.4", apple: "4.0.3" },
      { ...registry.options, timeoutMs: 120_000 },
    ),
    {
      message:
        "Still not published: Maven Central openiap-google-amazon 4.0.4 (HTTP 404), CocoaPods openiap 4.0.3 (HTTP 404)",
    },
  );
  assert.equal(registry.requests.length, urls.length * 5);
});

test("reports a network error instead of a missing release", async () => {
  const lookupError = Object.assign(new TypeError("fetch failed"), {
    cause: { code: "ENOTFOUND" },
  });
  for (const [fetchError, status] of [
    [lookupError, "ENOTFOUND"],
    [{}, "fetch failed"],
  ]) {
    const registry = fakeRegistry([podspec("4.0.3")], { fetchError });
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
