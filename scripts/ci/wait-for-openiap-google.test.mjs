import assert from "node:assert/strict";
import test from "node:test";
import { ARTIFACTS, waitForOpenIapGoogle } from "./wait-for-openiap-google.mjs";

const pom = (artifact) =>
  `https://repo1.maven.org/maven2/io/github/hyochan/openiap/${artifact}/4.0.4/${artifact}-4.0.4.pom`;

// A fake Maven Central on a fake clock that each sleep advances. `readyAfter`
// maps an artifact to the round from which it is served (Infinity = never);
// `failFetch` makes every request throw like a network error.
function fakeMaven({ readyAfter = {}, failFetch = false } = {}) {
  let time = 0;
  let round = 0;
  const requests = [];
  return {
    requests,
    options: {
      fetchImpl: async (url, init) => {
        requests.push({ url, method: init.method });
        if (failFetch)
          throw Object.assign(new TypeError("fetch failed"), {
            cause: { code: "ENOTFOUND" },
          });
        const artifact = ARTIFACTS.find((name) => url === pom(name));
        const ok = round >= (readyAfter[artifact] ?? 0);
        return { ok, status: ok ? 200 : 404 };
      },
      sleep: async (ms) => {
        time += ms;
        round += 1;
      },
      now: () => time,
      timeoutMs: 120_000,
      intervalMs: 30_000,
      log: () => {},
    },
  };
}

test("returns at once when the pinned version is already published", async () => {
  const maven = fakeMaven();
  await waitForOpenIapGoogle("4.0.4", maven.options);
  assert.deepEqual(maven.requests, [
    { url: pom("openiap-core"), method: "HEAD" },
    { url: pom("openiap-google"), method: "HEAD" },
  ]);
});

test("waits while only some artifacts are published", async () => {
  const maven = fakeMaven({ readyAfter: { "openiap-google": 3 } });
  await waitForOpenIapGoogle("4.0.4", maven.options);
  assert.equal(maven.requests.length, ARTIFACTS.length * 4);
});

test("fails naming only the missing artifact and its status", async () => {
  const maven = fakeMaven({ readyAfter: { "openiap-google": Infinity } });
  await assert.rejects(
    waitForOpenIapGoogle("4.0.4", maven.options),
    (error) =>
      error.message ===
      "Maven Central still does not serve openiap-google (HTTP 404) for 4.0.4",
  );
  assert.equal(maven.requests.length, ARTIFACTS.length * 5);
});

test("reports a network error instead of a missing release", async () => {
  const maven = fakeMaven({ failFetch: true });
  await assert.rejects(
    waitForOpenIapGoogle("4.0.4", maven.options),
    /openiap-core \(ENOTFOUND\), openiap-google \(ENOTFOUND\) for 4\.0\.4/u,
  );
  assert.equal(maven.requests.length, ARTIFACTS.length * 5);
});
