import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
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

const FIXTURE_COMMAND = "printf '%s\\n' \"$FIXTURE\" >&2";

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

test("retries an SDK component AGP failed to install", () => {
  withCounterTest((counter) => {
    const command = incrementScript(
      counter,
      `if [ "$count" -eq 1 ]; then printf '%s\\n' "Caused by: java.util.zip.ZipException: Archive is not a ZIP archive" "> com.android.builder.sdk.InstallFailedException: Failed to install the following SDK components:" "      ndk;27.1.12297006 NDK (Side by side) 27.1.12297006" >&2; exit 1; fi; printf 'recovered'`,
    );
    const result = runRetry(command);

    assert.equal(result.status, 0);
    assert.equal(readFileSync(counter, "utf8"), "2");
    assert.match(result.stdout, /recovered/);
  });
});

const NDK_INSTALL_FAILURE = [
  "Caused by: java.util.zip.ZipException: Archive is not a ZIP archive",
  "Failed to install the following SDK components:",
  "  ndk;27.1.12297006 NDK (Side by side) 27.1.12297006",
].join("\n");

function withNdkTest(callback) {
  withCounterTest((counter) => {
    const sdk = path.join(path.dirname(counter), "sdk");
    const ndk = path.join(sdk, "ndk/27.1.12297006");
    mkdirSync(sdk);
    callback({
      counter,
      sdk,
      ndk,
      env: {
        ANDROID_HOME: sdk,
        GITHUB_ACTIONS: "true",
        RUNNER_ENVIRONMENT: "github-hosted",
        RUNNER_OS: "Linux",
        GRADLE_NETWORK_RETRY_NDK_VERSION: "27.1.12297006",
        FIXTURE_NDK: ndk,
        FIXTURE: NDK_INSTALL_FAILURE,
      },
    });
  });
}

function partialNdkCommand(counter, beforeFailure = "") {
  return incrementScript(
    counter,
    `if [ "$count" -eq 1 ]; then mkdir -p "$FIXTURE_NDK/.installer"; printf 'stale' > "$FIXTURE_NDK/.installer/.installData"; ${beforeFailure} printf '%s\\n' "$FIXTURE" >&2; exit 17; fi; if [ -e "$FIXTURE_NDK" ] || [ -L "$FIXTURE_NDK" ]; then echo '[CXX1101] NDK missing source.properties' >&2; exit 19; fi; mkdir -p "$FIXTURE_NDK"; printf 'Pkg.Revision=27.1.12297006' > "$FIXTURE_NDK/source.properties"; printf 'recovered'`,
  );
}

test("recovers only the new incomplete NDK before an existing hosted CI retry", () => {
  withNdkTest(({ counter, ndk, sdk, env }) => {
    const other = path.join(sdk, "ndk/28.0.0/source.properties");
    mkdirSync(path.dirname(other), { recursive: true });
    writeFileSync(other, "preserve");
    const result = runRetry(partialNdkCommand(counter), env);

    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(readFileSync(counter, "utf8"), "2");
    assert.equal(
      readFileSync(path.join(ndk, "source.properties"), "utf8"),
      "Pkg.Revision=27.1.12297006",
    );
    assert.equal(existsSync(path.join(ndk, ".installer/.installData")), false);
    assert.equal(readFileSync(other, "utf8"), "preserve");
  });
});

for (const [name, overrides] of [
  ["local execution", { GITHUB_ACTIONS: "false" }],
  ["self-hosted CI", { RUNNER_ENVIRONMENT: "self-hosted" }],
  ["macOS CI", { RUNNER_OS: "macOS" }],
  ["an ordinary wrapper caller", { GRADLE_NETWORK_RETRY_NDK_VERSION: "" }],
  [
    "another component",
    { FIXTURE: NDK_INSTALL_FAILURE.replace("ndk;27.1.12297006", "ndk;28.0.0") },
  ],
  [
    "a lookalike component",
    {
      FIXTURE: NDK_INSTALL_FAILURE.replace(
        "ndk;27.1.12297006",
        "ndk;27x1x12297006",
      ),
    },
  ],
  [
    "a platform install",
    {
      FIXTURE: NDK_INSTALL_FAILURE.replace(
        "ndk;27.1.12297006",
        "platforms;android-36",
      ),
    },
  ],
  ["the final failed attempt", { GRADLE_NETWORK_RETRY_ATTEMPTS: "1" }],
]) {
  test(`preserves a partial NDK during ${name}`, () => {
    withNdkTest(({ counter, ndk, env }) => {
      const result = runRetry(partialNdkCommand(counter), {
        ...env,
        ...overrides,
      });
      assert.equal(
        result.status,
        overrides.GRADLE_NETWORK_RETRY_ATTEMPTS === "1" ? 17 : 19,
      );
      assert.equal(
        readFileSync(path.join(ndk, ".installer/.installData"), "utf8"),
        "stale",
      );
    });
  });
}

for (const complete of [false, true]) {
  test(`preserves a preexisting ${complete ? "complete" : "incomplete"} NDK`, () => {
    withNdkTest(({ counter, ndk, env }) => {
      mkdirSync(ndk, { recursive: true });
      writeFileSync(path.join(ndk, "keep"), "preserve");
      if (complete)
        writeFileSync(path.join(ndk, "source.properties"), "preserve");
      const result = runRetry(partialNdkCommand(counter), env);
      assert.equal(result.status, 19);
      assert.equal(readFileSync(path.join(ndk, "keep"), "utf8"), "preserve");
    });
  });
}

test("preserves an NDK that completed before cleanup", () => {
  withNdkTest(({ counter, ndk, env }) => {
    const result = runRetry(
      partialNdkCommand(
        counter,
        "printf 'complete' > \"$FIXTURE_NDK/source.properties\";",
      ),
      env,
    );
    assert.equal(result.status, 19);
    assert.equal(
      readFileSync(path.join(ndk, "source.properties"), "utf8"),
      "complete",
    );
  });
});

test("preserves any source.properties entry, including a dangling symlink", () => {
  withNdkTest(({ counter, ndk, env }) => {
    const result = runRetry(
      partialNdkCommand(
        counter,
        'ln -s missing "$FIXTURE_NDK/source.properties";',
      ),
      env,
    );
    assert.equal(result.status, 19);
    assert.equal(existsSync(path.join(ndk, ".installer/.installData")), true);
  });
});

test("does not follow an NDK slot replaced with a symlink", () => {
  withNdkTest(({ counter, ndk, sdk, env }) => {
    const outside = path.join(sdk, "outside");
    mkdirSync(outside);
    writeFileSync(path.join(outside, "keep"), "preserve");
    const command = incrementScript(
      counter,
      `if [ "$count" -eq 1 ]; then mkdir -p "${path.dirname(ndk)}"; ln -s "${outside}" "$FIXTURE_NDK"; printf '%s\\n' "$FIXTURE" >&2; exit 17; fi; exit 19`,
    );
    const result = runRetry(command, env);
    assert.equal(result.status, 19);
    assert.equal(readFileSync(path.join(outside, "keep"), "utf8"), "preserve");
  });
});

test("does not follow a preexisting SDK ndk parent symlink", () => {
  withNdkTest(({ counter, sdk, ndk, env }) => {
    const outside = path.join(sdk, "outside");
    mkdirSync(outside);
    symlinkSync(outside, path.join(sdk, "ndk"));
    const result = runRetry(partialNdkCommand(counter), env);
    assert.equal(result.status, 19);
    assert.equal(
      readFileSync(path.join(ndk, ".installer/.installData"), "utf8"),
      "stale",
    );
  });
});

test("removes an incomplete slot at most once and preserves the final failure", () => {
  withNdkTest(({ counter, ndk, env }) => {
    const command = incrementScript(
      counter,
      `if [ "$count" -le 2 ]; then mkdir -p "$FIXTURE_NDK/.installer"; printf '%s' "$count" > "$FIXTURE_NDK/.installer/.installData"; printf '%s\\n' "$FIXTURE" >&2; exit 17; fi; echo '[CXX1101] missing source.properties' >&2; exit 19`,
    );
    const result = runRetry(command, env);
    assert.equal(result.status, 19);
    assert.equal(readFileSync(counter, "utf8"), "3");
    assert.equal(
      readFileSync(path.join(ndk, ".installer/.installData"), "utf8"),
      "2",
    );
    assert.equal(
      result.stderr.match(/Removed job-created incomplete NDK/g)?.length,
      1,
    );
  });
});

test("does not treat CXX1101 alone as a retryable installation failure", () => {
  withNdkTest(({ counter, ndk, env }) => {
    const command = incrementScript(
      counter,
      "mkdir -p \"$FIXTURE_NDK\"; echo '[CXX1101] NDK missing source.properties' >&2; exit 19",
    );
    const result = runRetry(command, env);
    assert.equal(result.status, 19);
    assert.equal(readFileSync(counter, "utf8"), "1");
    assert.equal(existsSync(ndk), true);
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

// These fixtures carry quotes, which the table-driven loop's double-quoted
// printf would strip — leaving an anchor that can never match and a test that
// passes no matter what the pattern says. Pass them through the environment.
for (const [name, fixture] of [
  [
    "a wrapper download rejected for a client error",
    'Exception in thread "main" java.io.IOException: Server returned HTTP response code: 404 for URL: https://services.example/gradle.zip',
  ],
  [
    "a wrapper download whose checksum did not match",
    'Exception in thread "main" java.lang.RuntimeException: Verification of Gradle distribution failed!',
  ],
  [
    "a test that prints a socket timeout from its own thread",
    'Exception in thread "pool-1" java.net.SocketTimeoutException: fixture',
  ],
  [
    "a test that asserts on a gateway status",
    "expected status 200 but was 503",
  ],
]) {
  test(`does not retry ${name}`, () => {
    withCounterTest((counter) => {
      const command = incrementScript(counter, FIXTURE_COMMAND + "; exit 31");
      const result = runRetry(command, { FIXTURE: fixture });

      assert.equal(result.status, 31);
      assert.equal(readFileSync(counter, "utf8"), "1");
    });
  });
}

test("retries a wrapper distribution download that hits a gateway error", () => {
  // The wrapper fetches Gradle before Gradle exists, so this failure carries
  // none of the paired "could not get ... <cause>" lines the matcher wants.
  withCounterTest((counter) => {
    const command = incrementScript(
      counter,
      "printf '%s\\n' 'Exception in thread \"main\" java.io.IOException: Server returned HTTP response code: 504 for URL: https://services.example/gradle-9.1.0-all.zip' >&2; exit 1",
    );
    const result = runRetry(command);

    assert.equal(result.status, 1);
    assert.equal(readFileSync(counter, "utf8"), "3");
  });
});

test("retries a wrapper download the wrapper itself timed out on", () => {
  // The wrapper catches the socket timeout and rethrows this, so the plain
  // SocketTimeoutException never reaches the main thread's own stack line.
  withCounterTest((counter) => {
    const command = incrementScript(counter, FIXTURE_COMMAND + "; exit 1");
    const result = runRetry(command, {
      FIXTURE:
        'Exception in thread "main" java.lang.RuntimeException: Downloading from https://services.example/gradle.zip failed: timeout (30000ms)',
    });

    assert.equal(result.status, 1);
    assert.equal(readFileSync(counter, "utf8"), "3");
  });
});

test("retries a wrapper download that timed out as an IOException", () => {
  // Gradle 9's wrapper reports the read timeout as java.io.IOException, not the
  // RuntimeException above, and CI lost a job to exactly this line.
  withCounterTest((counter) => {
    const command = incrementScript(counter, FIXTURE_COMMAND + "; exit 1");
    const result = runRetry(command, {
      FIXTURE:
        'Exception in thread "main" java.io.IOException: Downloading from https://services.gradle.org/distributions/gradle-9.3.0-all.zip failed: timeout (10000ms)',
    });

    assert.equal(result.status, 1);
    assert.equal(readFileSync(counter, "utf8"), "3");
  });
});

test("retries a wrapper download that cannot resolve its host", () => {
  withCounterTest((counter) => {
    const command = incrementScript(
      counter,
      "printf '%s\\n' 'Exception in thread \"main\" java.net.UnknownHostException: services.example' >&2; exit 1",
    );
    const result = runRetry(command);

    assert.equal(result.status, 1);
    assert.equal(readFileSync(counter, "utf8"), "3");
  });
});

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
