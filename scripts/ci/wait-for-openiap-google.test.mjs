import assert from "node:assert/strict";
import test from "node:test";
import { ARTIFACTS, waitForOpenIapGoogle } from "./wait-for-openiap-google.mjs";

const pom = (artifact, version = "4.0.4") =>
  `https://repo1.maven.org/maven2/io/github/hyochan/openiap/${artifact}/${version}/${artifact}-${version}.pom`;

// A fake Maven Central serving `version` on a fake clock that each sleep
// advances. `readyAfter` maps an artifact to the round from which it is served
// (Infinity = never); `fetchError` is thrown by every request, like a network
// error. Any other URL is a 404.
function fakeMaven({ version = "4.0.4", readyAfter = {}, fetchError } = {}) {
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
        const artifact = ARTIFACTS.find((name) => url === pom(name, version));
        const ok =
          artifact !== undefined && round >= (readyAfter[artifact] ?? 0);
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

test("returns at once when the pinned version is already published", async () => {
  const maven = fakeMaven();
  await waitForOpenIapGoogle("4.0.4", maven.options);
  assert.deepEqual(maven.requests, [
    { url: pom("openiap-core"), method: "HEAD", timed: true },
    { url: pom("openiap-google"), method: "HEAD", timed: true },
  ]);
});

test("polls a prerelease's own POMs", async () => {
  const maven = fakeMaven({ version: "4.1.0-rc.2" });
  await waitForOpenIapGoogle("4.1.0-rc.2", maven.options);
  assert.deepEqual(
    maven.requests.map(({ url }) => url),
    ARTIFACTS.map((name) => pom(name, "4.1.0-rc.2")),
  );
});

test("rejects anything but a version before any request", async () => {
  const maven = fakeMaven();
  for (const version of [undefined, "", "4.0", "..", "4.0.4-rc.1/../x"])
    await assert.rejects(
      waitForOpenIapGoogle(version, maven.options),
      /Invalid openiap-google version/u,
    );
  assert.deepEqual(maven.requests, []);
});

test("waits while only some artifacts are published", async () => {
  const maven = fakeMaven({ readyAfter: { "openiap-google": 3 } });
  await waitForOpenIapGoogle("4.0.4", maven.options);
  assert.equal(maven.requests.length, ARTIFACTS.length * 4);
});

test("polls every 30 seconds for 45 minutes by default", async () => {
  const maven = fakeMaven({ readyAfter: { "openiap-google": Infinity } });
  await assert.rejects(waitForOpenIapGoogle("4.0.4", maven.options));
  assert.equal(maven.options.now(), 45 * 60 * 1000);
  assert.equal(maven.requests.length, ARTIFACTS.length * 91);
});

test("fails naming only the missing artifact and its status", async () => {
  const maven = fakeMaven({ readyAfter: { "openiap-google": Infinity } });
  await assert.rejects(
    waitForOpenIapGoogle("4.0.4", { ...maven.options, timeoutMs: 120_000 }),
    {
      message:
        "Maven Central still does not serve openiap-google (HTTP 404) for 4.0.4",
    },
  );
  assert.equal(maven.requests.length, ARTIFACTS.length * 5);
});

test("reports a network error instead of a missing release", async () => {
  const lookupError = Object.assign(new TypeError("fetch failed"), {
    cause: { code: "ENOTFOUND" },
  });
  for (const [fetchError, status] of [
    [lookupError, "ENOTFOUND"],
    [{}, "fetch failed"],
  ]) {
    const maven = fakeMaven({ fetchError });
    await assert.rejects(
      waitForOpenIapGoogle("4.0.4", { ...maven.options, timeoutMs: 120_000 }),
      {
        message: `Maven Central still does not serve openiap-core (${status}), openiap-google (${status}) for 4.0.4`,
      },
    );
    assert.equal(maven.requests.length, ARTIFACTS.length * 5);
  }
});
