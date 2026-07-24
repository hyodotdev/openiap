import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "retry-gradle.sh",
);

function runRetry(command, env = {}) {
  return spawnSync(script, ["bash", "-c", command], {
    encoding: "utf8",
    env: {
      ...process.env,
      GRADLE_NETWORK_RETRY_DELAY_SECONDS: "0",
      ...env,
    },
  });
}

function withCounterTest(callback) {
  const directory = mkdtempSync(path.join(tmpdir(), "openiap-retry-test-"));
  const counter = path.join(directory, "counter");
  writeFileSync(counter, "0");

  try {
    callback(counter);
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function incrementScript(counter, body) {
  return [
    `count=$(cat "${counter}")`,
    `count=$((count + 1))`,
    `printf '%s' "$count" > "${counter}"`,
    body,
  ].join("; ");
}

test("passes a successful command through once", () => {
  const result = runRetry("printf 'ok'");

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "ok");
});

test("retries a recognized transient network failure", () => {
  withCounterTest((counter) => {
    const command = incrementScript(
      counter,
      `if [ "$count" -eq 1 ]; then printf '%s\\n' "Could not get resource 'https://repo.example/artifact'." "> Could not GET 'https://repo.example/artifact'." "> Read timed out" >&2; exit 17; fi; printf 'recovered'`,
    );
    const result = runRetry(command);

    assert.equal(result.status, 0);
    assert.equal(readFileSync(counter, "utf8"), "2");
    assert.match(result.stdout, /recovered/);
    assert.match(result.stderr, /Transient Gradle dependency-network failure/);
  });
});

test("retries a fetch that receives a retryable HTTP status", () => {
  withCounterTest((counter) => {
    const command = incrementScript(
      counter,
      `if [ "$count" -eq 1 ]; then echo 'Could not GET https://repo.example/artifact: status code 503' >&2; exit 19; fi; printf 'recovered'`,
    );
    const result = runRetry(command);

    assert.equal(result.status, 0);
    assert.equal(readFileSync(counter, "utf8"), "2");
  });
});

test("does not retry deterministic compile or test failures", () => {
  withCounterTest((counter) => {
    const command = incrementScript(
      counter,
      "echo 'Compilation failed: unresolved reference' >&2; exit 23",
    );
    const result = runRetry(command);

    assert.equal(result.status, 23);
    assert.equal(readFileSync(counter, "utf8"), "1");
    assert.match(result.stderr, /not retrying/);
  });
});

for (const [name, output] of [
  [
    "a missing artifact",
    "Could not GET https://repo.example/missing.jar: status code 404",
  ],
  [
    "an authorization failure",
    "Could not HEAD https://repo.example/private.jar: status code 403",
  ],
  [
    "an invalid plugin version",
    "Could not resolve plugin artifact 'example:missing:99.0.0'",
  ],
  [
    "a non-fetch timeout message",
    [
      "Test failed: local fixture Connection refused",
      "Get more help at https://help.gradle.org",
    ].join("\n"),
  ],
  [
    "unrelated fetch and transport messages",
    [
      "Could not GET https://repo.example/missing.jar: status code 404",
      "unrelated output 1",
      "unrelated output 2",
      "unrelated output 3",
      "unrelated output 4",
      "Test failed: local fixture Connection refused",
    ].join("\n"),
  ],
]) {
  test(`does not retry ${name}`, () => {
    withCounterTest((counter) => {
      const command = incrementScript(
        counter,
        `printf '%s\\n' "${output}" >&2; exit 31`,
      );
      const result = runRetry(command);

      assert.equal(result.status, 31);
      assert.equal(readFileSync(counter, "utf8"), "1");
    });
  });
}

test("stops after the configured number of transient attempts", () => {
  withCounterTest((counter) => {
    const command = incrementScript(
      counter,
      "echo \"Could not HEAD 'https://repo.example/plugin': Connection reset\" >&2; exit 29",
    );
    const result = runRetry(command, {
      GRADLE_NETWORK_RETRY_ATTEMPTS: "2",
    });

    assert.equal(result.status, 29);
    assert.equal(readFileSync(counter, "utf8"), "2");
  });
});
