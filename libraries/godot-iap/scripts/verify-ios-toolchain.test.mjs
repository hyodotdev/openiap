import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const verifier = path.join(import.meta.dirname, "verify-ios-toolchain.sh");

function verifyFixture(overrides = {}) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "godot-toolchain-"));
  try {
    const bin = path.join(scratch, "bin");
    fs.mkdirSync(bin);
    for (const name of ["GodotIap", "SwiftGodotRuntime"]) {
      const framework = path.join(scratch, `${name}.framework`);
      fs.mkdirSync(framework);
      fs.writeFileSync(path.join(framework, name), "");
      const {
        sdk = "27.0",
        linker = "27037.1",
        coverage = false,
      } = overrides[name] ?? {};
      fs.writeFileSync(
        path.join(scratch, `${name}.build`),
        `cmd LC_BUILD_VERSION\nplatform IOS\nminos 17.0\nsdk ${sdk}\ntool LD\nversion ${linker}\n`,
      );
      fs.writeFileSync(
        path.join(scratch, `${name}.sections`),
        coverage ? "sectname __llvm_prf_cnts\n" : "sectname __text\n",
      );
    }
    fs.writeFileSync(
      path.join(bin, "xcrun"),
      '#!/bin/sh\ncat "$GODOT_TOOLCHAIN_FIXTURE/${3##*/}.build"\n',
      { mode: 0o755 },
    );
    fs.writeFileSync(
      path.join(bin, "otool"),
      '#!/bin/sh\ncat "$GODOT_TOOLCHAIN_FIXTURE/${2##*/}.sections"\n',
      { mode: 0o755 },
    );
    const env = { ...process.env };
    delete env.APP_STORE_SDK_VERSION;
    delete env.APP_STORE_LD_VERSION;
    return spawnSync("bash", [verifier, scratch], {
      encoding: "utf8",
      env: {
        ...env,
        PATH: `${bin}${path.delimiter}${env.PATH}`,
        GODOT_TOOLCHAIN_FIXTURE: scratch,
      },
    });
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

test("accepts the matched stable SDK and linker pair", () => {
  const result = verifyFixture();
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

for (const name of ["GodotIap", "SwiftGodotRuntime"]) {
  test(`rejects deployment-target SDK metadata in ${name}`, () => {
    const result = verifyFixture({ [name]: { sdk: "17.0" } });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /expected App Store SDK 27\.0/);
  });
}

test("rejects a different linker even with the correct SDK", () => {
  const result = verifyFixture({ GodotIap: { linker: "1267.0" } });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /expected stable linker 27037\.1/);
});

test("rejects release frameworks carrying coverage instrumentation", () => {
  const result = verifyFixture({ SwiftGodotRuntime: { coverage: true } });
  assert.equal(result.status, 1);
  assert.match(result.stdout, /contains code-coverage instrumentation/);
});
