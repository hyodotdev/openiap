import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scripts = path.dirname(fileURLToPath(import.meta.url));
const runner = path.join(scripts, "run-godot-suite.sh");

// The fake engine picks its behavior from the suite name and logs each call.
const fakeGodot = `#!/usr/bin/env bash
suite="\${@: -1}"
printf '%s\\n' "$*" >> "$FAKE_GODOT_LOG"
case "$suite" in
  *android_export*) printf '%s\\n' "\${FAKE_GODOT_EXPORT_OUTPUT-Results: 31 passed, 0 failed}" ;;
  *silent*) : ;;
  *parse_error*) echo 'SCRIPT ERROR: Parse Error: Expected parameter name.' ;;
  *preload_error*) echo 'ERROR: Failed to load script "res://addons/godot-iap/types.gd" with error "Parse error".' ;;
  *runtime_noise*) echo 'ERROR: Parse JSON failed. Error at line 0: Unknown error getting token' ;;
  *script_error*) echo 'SCRIPT ERROR: Trying to call an async function without "await".' ;;
  *failing*) echo 'FAIL: nothing worked'; exit 3 ;;
  *) echo "PASS $suite" ;;
esac
`;

function run(...suites) {
  return runWithEnvironment({}, ...suites);
}

function runWithEnvironment(environment, ...suites) {
  const directory = mkdtempSync(path.join(tmpdir(), "run-godot-suite-"));
  const godot = path.join(directory, "godot");
  const log = path.join(directory, "calls.log");
  writeFileSync(godot, fakeGodot);
  chmodSync(godot, 0o755);
  writeFileSync(log, "");
  try {
    const result = spawnSync("bash", [runner, ...suites], {
      encoding: "utf8",
      env: {
        ...process.env,
        GODOT: godot,
        FAKE_GODOT_LOG: log,
        ...environment,
      },
    });
    return {
      ...result,
      calls: readFileSync(log, "utf8").trim().split("\n").filter(Boolean),
    };
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

test("runs each suite in order and echoes the engine output", () => {
  const result = run("test_one", "test_two");

  assert.equal(result.status, 0);
  assert.equal(
    result.stdout,
    "== test_one\nPASS res://tests/test_one.gd\n== test_two\nPASS res://tests/test_two.gd\n",
  );
  assert.equal(result.calls.length, 2);
  assert.match(
    result.calls[0],
    /^--headless --path .*\/libraries\/godot-iap\/Example --script /u,
  );
});

test("passes the engine's failing exit code through and skips later suites", () => {
  const result = run("test_failing", "test_after");

  assert.equal(result.status, 3);
  assert.match(result.stdout, /::error::test_failing failed with exit code 3/u);
  assert.equal(result.calls.length, 1);
});

test("fails a suite that did not parse even though the engine exits 0", () => {
  for (const suite of ["test_parse_error", "test_preload_error"]) {
    const result = run(suite, "test_after");

    assert.equal(result.status, 1, suite);
    assert.match(
      result.stdout,
      new RegExp(`::error::${suite} did not load`, "u"),
    );
    assert.equal(result.calls.length, 1, suite);
  }
});

test("fails a suite whose test hit a script error even though the engine exits 0", () => {
  const result = run("test_script_error", "test_after");

  assert.equal(result.status, 1);
  assert.match(result.stdout, /::error::test_script_error hit a script error/u);
  assert.equal(result.calls.length, 1);
});

test("ignores error output that is not a script error", () => {
  const result = run("test_runtime_noise");

  assert.equal(result.status, 0);
});

test("rejects an engine that exits successfully without output", () => {
  const result = run("test_silent", "test_after");
  assert.equal(result.status, 1);
  assert.match(result.stdout, /produced no test output/u);
  assert.equal(result.calls.length, 1);
});

test("rejects an export run with only the engine banner", () => {
  const result = runWithEnvironment(
    { FAKE_GODOT_EXPORT_OUTPUT: "Godot Engine v4.7.1.stable.official" },
    "test_android_export",
    "test_after",
  );
  assert.equal(result.status, 1);
  assert.match(
    result.stdout,
    /did not complete its export checks successfully/u,
  );
  assert.equal(result.calls.length, 1);
});

test("rejects an export summary with no checks or reported failures", () => {
  for (const summary of [
    "Results: 0 passed, 0 failed",
    "Results: 31 passed, 1 failed",
  ]) {
    const result = runWithEnvironment(
      { FAKE_GODOT_EXPORT_OUTPUT: summary },
      "test_android_export",
    );
    assert.equal(result.status, 1, summary);
  }
});

test("accepts a completed export run and cleans its editor fixture", () => {
  const result = run("test_android_export");
  assert.equal(result.status, 0);
  assert.match(result.calls[0], /^--headless --editor --path /u);
  const fixture = /--path (\S+) --script /u.exec(result.calls[0])?.[1];
  assert.ok(fixture);
  assert.equal(existsSync(fixture), false);
});

test("needs at least one suite", () => {
  const result = run();

  assert.equal(result.status, 2);
  assert.match(result.stderr, /usage: run-godot-suite\.sh/u);
  assert.equal(result.calls.length, 0);
});
