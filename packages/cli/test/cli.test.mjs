import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const BIN = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "bin",
  "openiap.mjs",
);

/** The published surface is the process, so exercise the process. */
function run(args, options = {}) {
  try {
    const stdout = execFileSync(process.execPath, [BIN, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      ...options,
    });
    return { code: 0, stdout };
  } catch (error) {
    return {
      code: error.status,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? "",
    };
  }
}

function project(files) {
  const root = mkdtempSync(path.join(tmpdir(), "openiap-cli-"));
  for (const [name, body] of Object.entries(files)) {
    const file = path.join(root, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, body);
  }
  return root;
}

const EXPO = {
  "package.json": JSON.stringify({ dependencies: { expo: "51" } }),
};
const SECRET = `openiap-kit_sk_${"4f2a9c1e".repeat(8)}`;

test("--version prints only the version", () => {
  const { code, stdout } = run(["--version"]);
  assert.equal(code, 0);
  assert.match(stdout, /^\d+\.\d+\.\d+\n$/);
  assert.equal(run(["-v"]).stdout, stdout);
});

test("no arguments and --help both explain the command", () => {
  assert.equal(run(["--help"]).code, 0);
  assert.match(run(["--help"]).stdout, /openiap doctor/);
  assert.equal(run([]).code, 0);
  assert.match(run([]).stdout, /openiap init/);
  assert.equal(run(["init", "--help"]).code, 0);
});

test("init returns a role-specific brief without modifying or executing project files", () => {
  const root = project({
    ...EXPO,
    "app.config.js":
      "require('node:fs').writeFileSync('executed.txt', 'bad'); throw new Error('config executed');",
    ".env": `PRIVATE_KEY=${SECRET}\n`,
  });
  const before = readdirSync(root).map((file) => [
    file,
    readFileSync(path.join(root, file), "utf8"),
  ]);
  try {
    for (const [role, guide] of [
      ["app", "/docs/guides/ai-assistants"],
      ["experience", "/commerce-protocol/ecosystem#experience"],
      ["commerce", "/commerce-protocol/implementation"],
      ["data", "/commerce-protocol/getting-started#receive-events"],
    ]) {
      const result = run(["init", root, "--role", role], { cwd: root });
      assert.equal(result.code, 0);
      assert.ok(result.stdout.includes(`https://openiap.dev${guide}`));
      assert.match(result.stdout, /Framework hint: expo/);
      assert.ok(result.stdout.includes(JSON.stringify(root)));
      assert.ok(!result.stdout.includes(SECRET));
    }
    assert.equal(existsSync(path.join(root, "executed.txt")), false);
    assert.deepEqual(
      readdirSync(root).map((file) => [
        file,
        readFileSync(path.join(root, file), "utf8"),
      ]),
      before,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("init supports unknown stacks and a path after the separator", () => {
  const root = project({ "-v/README.md": "An existing backend" });
  try {
    const result = run(["init", "--role=commerce", "--", "-v"], { cwd: root });
    assert.equal(result.code, 0);
    assert.match(result.stdout, /Framework hint: not detected/);
    assert.ok(
      result.stdout.includes(
        JSON.stringify(path.join(realpathSync(root), "-v")),
      ),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("init rejects missing roles, invalid roles, and invalid roots", () => {
  assert.match(run(["init"]).stderr, /Choose a role with --role/);
  for (const args of [
    ["--role"],
    ["--role="],
    ["--role", "--json"],
    ["--role=app", "--role=data"],
  ]) {
    const result = run(["init", ...args]);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Expected one --role value/);
  }
  assert.match(run(["init", "--role=other"]).stderr, /Unknown role: other/);
  const root = project({ "README.md": "A file" });
  try {
    for (const file of ["missing", "README.md"]) {
      const result = run(["init", path.join(root, file), "--role=app"]);
      assert.equal(result.code, 1);
      assert.match(result.stderr, /Cannot read project directory/);
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
  assert.equal(run(["init", "--json"]).code, 1);
  assert.equal(run(["doctor", "--role=app"]).code, 1);
});

test("an unknown option fails rather than being ignored", () => {
  const { code, stderr } = run(["doctor", "--jsonn"]);
  assert.equal(code, 1);
  assert.match(stderr, /Unknown option: --jsonn/);
});

test("more than one path is an error, not a silently ignored argument", () => {
  const { code, stderr } = run(["doctor", ".", "./elsewhere"]);
  assert.equal(code, 1);
  assert.match(stderr, /Expected one path/);
});

test("everything after -- is a path", () => {
  // A directory named `-x` is otherwise unreachable.
  const { code, stderr } = run(["doctor", "--", "-x", "-y"]);
  assert.equal(code, 1);
  assert.match(stderr, /Expected one path/);
});

test("an unknown command names itself", () => {
  const { code, stderr } = run(["diagnose"]);
  assert.equal(code, 1);
  assert.match(stderr, /Unknown command: diagnose/);
});

test("--json emits the documented shape and the text mode agrees with it", () => {
  const root = project({
    ...EXPO,
    ".env": `EXPO_PUBLIC_IAPKIT_API_KEY=${SECRET}\n`,
  });
  try {
    const json = run(["doctor", root, "--json"]);
    assert.equal(json.code, 1);
    const result = JSON.parse(json.stdout);
    assert.deepEqual(Object.keys(result).sort(), [
      "errors",
      "findings",
      "framework",
      "notCheckedLocally",
      "warnings",
    ]);
    assert.equal(result.framework, "expo");
    assert.equal(result.errors, 1);
    assert.ok(!json.stdout.includes(SECRET));

    const text = run(["doctor", root]);
    assert.equal(text.code, 1);
    assert.match(text.stdout, /iapkit-secret-key-in-client/);
    assert.ok(!text.stdout.includes(SECRET));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a clean project exits 0 and a warning does not change that", () => {
  const clean = project(EXPO);
  const warned = project({
    ...EXPO,
    ".env": "IAPKIT_API_KEY=openiap-kit_pk_1\n",
  });
  try {
    assert.equal(run(["doctor", clean]).code, 0);
    const warning = run(["doctor", warned]);
    assert.equal(warning.code, 0);
    assert.match(warning.stdout, /warn /);
  } finally {
    rmSync(clean, { recursive: true, force: true });
    rmSync(warned, { recursive: true, force: true });
  }
});

test("a reader that stops early is not a failed run", () => {
  // The write is async, so a closed pipe lands as EPIPE mid-write. The fixture
  // must exceed the pipe buffer or EPIPE never happens, and the assertion must
  // read the producer's status rather than the reader's.
  const root = project({
    ...EXPO,
    ".env": "IAPKIT_API_KEY=openiap-kit_pk_1\n",
    ...Object.fromEntries(
      Array.from({ length: 900 }, (_, index) => [
        `ios/App${index}/Info.plist`,
        "<plist><dict><key>UISceneDelegateClassName</key><string>Ghost</string></dict></plist>",
      ]),
    ),
  });
  try {
    const size = run(["doctor", root, "--json"]).stdout.length;
    assert.ok(
      size > 200_000,
      `fixture is ${size} bytes, under the pipe buffer`,
    );
    const script = `node ${JSON.stringify(BIN)} doctor ${JSON.stringify(root)} --json | head -1 > /dev/null; echo \${PIPESTATUS[0]}`;
    const code = execFileSync("bash", ["-c", script], {
      encoding: "utf8",
    }).trim();
    assert.equal(code, "0");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a FIFO where a config file belongs does not hang the command", () => {
  // `readFileSync` on a FIFO blocks until someone writes. Only a subprocess
  // can prove the guard holds; an in-process timeout cannot preempt it.
  const root = project(EXPO);
  try {
    execFileSync("mkfifo", [path.join(root, ".env")]);
    const started = run(["doctor", root], { timeout: 20_000 });
    assert.equal(started.code, 1);
    assert.match(started.stdout, /project-file-unreadable/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a file replaced with a FIFO during a read cannot block doctor", () => {
  const root = project({ ...EXPO, ".env": "SAFE=value\n" });
  try {
    const hook = path.join(root, "swap.cjs");
    writeFileSync(
      hook,
      `
      const fs = require('node:fs');
      const { execFileSync } = require('node:child_process');
      const { syncBuiltinESMExports } = require('node:module');
      const target = ${JSON.stringify(path.join(root, ".env"))};
      let swapped = false;
      const swap = (file) => {
        if (String(file) !== target || swapped) return;
        swapped = true;
        fs.unlinkSync(target);
        execFileSync('mkfifo', [target]);
      };
      const stat = fs.statSync;
      fs.statSync = function(file, ...args) {
        const value = stat.call(this, file, ...args);
        swap(file);
        return value;
      };
      const open = fs.openSync;
      fs.openSync = function(file, ...args) {
        swap(file);
        return open.call(this, file, ...args);
      };
      syncBuiltinESMExports();
    `,
    );
    const result = run(["doctor", root], {
      timeout: 10_000,
      env: {
        ...process.env,
        NODE_OPTIONS: `--require=${JSON.stringify(hook)}`,
      },
    });
    assert.equal(result.code, 1);
    assert.match(result.stdout, /project-file-unreadable/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
