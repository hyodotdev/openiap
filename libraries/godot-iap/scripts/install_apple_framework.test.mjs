import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";

const installer = path.join(import.meta.dirname, "install_apple_framework.sh");

test("refreshes actual build provenance while preserving the bundle contract", () => {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "godot-framework-"));
  try {
    const source = path.join(scratch, "source/GodotIap.framework");
    const destination = path.join(scratch, "installed/GodotIap.framework");
    fs.mkdirSync(source, { recursive: true });
    fs.mkdirSync(destination, { recursive: true });
    fs.writeFileSync(path.join(source, "GodotIap"), "current binary");
    fs.writeFileSync(path.join(destination, "GodotIap"), "old binary");
    for (const [directory, entries] of [
      [
        source,
        {
          CFBundleIdentifier: "generated.GodotIap",
          CFBundleVersion: "1",
          DTSDKName: "iphoneos27.0",
          DTXcodeBuild: "27A266a",
          BuildMachineOSBuild: "actual-build",
        },
      ],
      [
        destination,
        {
          CFBundleIdentifier: "stable.GodotIap",
          CFBundleVersion: "9",
          DTSDKName: "iphoneos26.5",
          DTXcodeBuild: "17F113",
          DTObsoleteBuildKey: "stale",
          BuildMachineOSBuild: "old-build",
        },
      ],
    ]) {
      const values = Object.entries(entries)
        .map(([key, value]) => `<key>${key}</key><string>${value}</string>`)
        .join("\n");
      fs.writeFileSync(
        path.join(directory, "Info.plist"),
        `<?xml version="1.0"?><plist version="1.0"><dict>${values}</dict></plist>`,
      );
    }
    execFileSync("sh", [installer, source, destination, "ios"]);
    const info = JSON.parse(
      execFileSync(
        "plutil",
        ["-convert", "json", "-o", "-", path.join(destination, "Info.plist")],
        {
          encoding: "utf8",
        },
      ),
    );
    assert.equal(info.CFBundleIdentifier, "stable.GodotIap");
    assert.equal(info.CFBundleVersion, "9");
    assert.equal(info.DTSDKName, "iphoneos27.0");
    assert.equal(info.DTXcodeBuild, "27A266a");
    assert.equal(info.BuildMachineOSBuild, "actual-build");
    assert.equal("DTObsoleteBuildKey" in info, false);
    assert.equal(
      fs.readFileSync(path.join(destination, "GodotIap"), "utf8"),
      "current binary",
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
});
