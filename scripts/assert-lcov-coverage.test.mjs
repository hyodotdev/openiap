import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  assertLcovLineCoverage,
  normalizeCoverageBase,
  readChangedLines,
  readComponentCoverage,
  readCoveragePolicy,
  readLcovLineCoverage,
} from "./assert-lcov-coverage.mjs";

describe("local project and patch coverage", () => {
  const root = "/workspace/openiap";
  const directory = `${root}/libraries/expo-iap`;
  const config = readFileSync(
    new URL("../codecov.yml", import.meta.url),
    "utf8",
  );
  const policy = readCoveragePolicy(config, "expo-iap");
  function record(filename, hits) {
    return [
      `SF:${filename}`,
      ...hits.map((count, index) => `DA:${index + 1},${count}`),
      `LF:${hits.length}`,
      `LH:${hits.filter((count) => count > 0).length}`,
      "end_of_record",
    ].join("\n");
  }
  function patch(filename, start, count) {
    return [
      `diff --git a/${filename} b/${filename}`,
      `--- a/${filename}`,
      `+++ b/${filename}`,
      `@@ -${start},${count} +${start},${count} @@`,
      ...Array.from({ length: count }, () => "+changed"),
    ].join("\n");
  }
  const filename = "libraries/expo-iap/src/index.ts";

  it("uses canonical project and patch targets, flag scopes and ignores", () => {
    assert.equal(policy.projectMinimum, 90);
    assert.equal(policy.patchMinimum, 90);
    assert.deepEqual(policy.paths, ["libraries/expo-iap/src/**"]);
    assert.ok(policy.ignore.includes("libraries/expo-iap/src/types.ts"));
    const convex = readCoveragePolicy(config, "iapkit-convex");
    assert.equal(convex.patchMinimum, 48);
    assert.deepEqual(convex.paths, ["packages/kit/convex/**"]);
  });

  it("rejects changed uncovered lines even when project coverage passes", () => {
    const source = record("src/index.ts", [...Array(9).fill(1), 0]);
    assert.throws(
      () =>
        readComponentCoverage(
          source,
          patch(filename, 10, 1),
          policy,
          directory,
          root,
        ),
      /Patch coverage 0\.00%.*below 90\.00%/,
    );
  });

  it("enforces project coverage when every changed line is covered", () => {
    assert.throws(
      () =>
        readComponentCoverage(
          record("src/index.ts", [1, 0]),
          patch(filename, 1, 1),
          policy,
          directory,
          root,
        ),
      /Project coverage 50\.00%.*below 90\.00%/,
    );
  });

  it("accepts exact thresholds and positive partial hits", () => {
    const coverage = readComponentCoverage(
      record("src/index.ts", [...Array(9).fill(1), 0]),
      patch(filename, 1, 10),
      policy,
      directory,
      root,
    );
    assert.deepEqual(coverage.project, { found: 10, hit: 9, percentage: 90 });
    assert.deepEqual(coverage.patch, { found: 10, hit: 9, percentage: 90 });
  });

  it("excludes generated files from project and patch totals", () => {
    const coverage = readComponentCoverage(
      `${record("src/index.ts", [1])}\n${record("src/types.ts", [0, 0])}`,
      `${patch(filename, 1, 1)}\n${patch("libraries/expo-iap/src/types.ts", 1, 2)}`,
      policy,
      directory,
      root,
    );
    assert.deepEqual(coverage.patch, { found: 1, hit: 1, percentage: 100 });
    assert.equal(coverage.project.found, 1);
  });

  it("reports no executable diff explicitly without exempting the project gate", () => {
    const coverage = readComponentCoverage(
      record("src/index.ts", [1]),
      patch(filename, 2, 1),
      policy,
      directory,
      root,
    );
    assert.deepEqual(coverage.patch, { found: 0, hit: 0, percentage: null });
    assert.throws(
      () =>
        readComponentCoverage(
          record("src/index.ts", [0]),
          "",
          policy,
          directory,
          root,
        ),
      /Project coverage/,
    );
  });

  it("counts only added new-side lines, including spaced and Unicode paths", () => {
    const diff = [
      "diff --git a/source ü.ts b/source ü.ts",
      "--- a/source ü.ts",
      "+++ b/source ü.ts",
      "@@ -1,3 +1,3 @@",
      " same",
      "-removed",
      "+added",
      " same",
      "@@ -10,2 +10,0 @@",
      "-removed",
      "-removed",
    ].join("\n");
    assert.deepEqual([...readChangedLines(diff).get("source ü.ts")], [2]);
  });

  it("merges repeated line records using positive hits", () => {
    const coverage = readComponentCoverage(
      `${record("src/index.ts", [0])}\n${record("src/index.ts", [2])}`,
      patch(filename, 1, 1),
      policy,
      directory,
      root,
    );
    assert.deepEqual(coverage.project, { found: 1, hit: 1, percentage: 100 });
  });

  it("excludes deleted files from the new-side diff", () => {
    const deleted =
      "diff --git a/old.ts b/old.ts\n--- a/old.ts\n+++ /dev/null\n@@ -1 +0,0 @@\n-old\n";
    assert.equal(readChangedLines(deleted).size, 0);
  });

  it("fails malformed, empty, unterminated or unmapped reports", () => {
    for (const source of [
      "",
      record("src/index.ts", [1]).replace("DA:1,1", "DA:0,1"),
      record("src/index.ts", [1]).replace("DA:1,1", "DA:1,-1"),
      record("src/index.ts", [1]).replace("LF:1", "LF:2"),
      record("src/index.ts", [1]).replace("end_of_record", ""),
      record("/another/repo/src/index.ts", [1]),
    ]) {
      assert.throws(() =>
        readComponentCoverage(source, "", policy, directory, root),
      );
    }
  });

  it("fails missing targets and unsupported policy changes", () => {
    assert.throws(() => readCoveragePolicy(config, "unknown-component"));
    assert.throws(() =>
      readCoveragePolicy(
        config.replaceAll("threshold: 0%", "threshold: 1%"),
        "expo-iap",
      ),
    );
    assert.throws(() =>
      readCoveragePolicy(
        config.replace("partials_as_hits: true", "partials_as_hits: false"),
        "expo-iap",
      ),
    );
  });

  it("rejects duplicate blocks and malformed or duplicate policy fields", () => {
    for (const source of [
      config.replace(
        "      react-native-iap:",
        "      react-native-iap:\n        target: 10%\n        threshold: 0%\n        flags:\n          - react-native-iap\n      react-native-iap:",
      ),
      config.replace("        threshold: 0%", "        threshold: 0%not-valid"),
      config.replace(
        "        target: 90%",
        "        target: 10%\n        target: 90%",
      ),
      config.replace(
        "        threshold: 0%",
        "        threshold: 0%\n        threshold: 1%",
      ),
      config.replace(
        "    partials_as_hits: true",
        "    partials_as_hits: true\n    partials_as_hits: false",
      ),
    ]) {
      assert.throws(() => readCoveragePolicy(source, "react-native-iap"));
    }
  });

  it("rejects outside-workspace and empty sources even alongside valid records", () => {
    for (const filename of [
      "/another/repo/src/index.ts",
      "../../../outside.ts",
      "",
    ]) {
      assert.throws(
        () =>
          readComponentCoverage(
            `${record("src/index.ts", [1])}\n${record(filename, [1])}`,
            "",
            policy,
            directory,
            root,
          ),
        /outside the workspace/,
      );
    }
  });

  it("normalizes initial branch pushes without weakening missing-base checks", () => {
    assert.equal(normalizeCoverageBase("0".repeat(40)), "HEAD^");
    assert.equal(normalizeCoverageBase("a".repeat(40)), "a".repeat(40));
    assert.throws(() => normalizeCoverageBase(""), /required/);
    assert.throws(() => normalizeCoverageBase(undefined), /required/);
  });
});

describe("LCOV line coverage guard", () => {
  const temporaryPaths = [];

  afterEach(() => {
    for (const temporaryPath of temporaryPaths.splice(0)) {
      rmSync(temporaryPath, { force: true, recursive: true });
    }
  });

  function report(source) {
    const directory = mkdtempSync(join(tmpdir(), "openiap-lcov-"));
    temporaryPaths.push(directory);
    const reportPath = join(directory, "lcov.info");
    writeFileSync(reportPath, source);
    return reportPath;
  }

  it("sums line totals across source records", () => {
    assert.deepEqual(
      readLcovLineCoverage("SF:a.ts\nLF:6\nLH:5\nSF:b.ts\nLF:4\nLH:4\n"),
      { found: 10, hit: 9, percentage: 90 },
    );
  });

  it("scopes line totals to matching source paths", () => {
    const source = [
      "SF:server/api.ts",
      "LF:10",
      "LH:9",
      "end_of_record",
      "SF:convex/purchases/amazon.ts",
      "LF:8",
      "LH:4",
      "end_of_record",
      "SF:convex\\purchases\\horizon.ts",
      "LF:2",
      "LH:2",
      "end_of_record",
    ].join("\n");

    assert.deepEqual(readLcovLineCoverage(source, "server/"), {
      found: 10,
      hit: 9,
      percentage: 90,
    });
    assert.deepEqual(readLcovLineCoverage(source, "./convex/"), {
      found: 10,
      hit: 6,
      percentage: 60,
    });
    const reportPath = report(source);
    assert.doesNotThrow(() =>
      assertLcovLineCoverage(reportPath, 60, "convex/"),
    );
    assert.throws(
      () => assertLcovLineCoverage(reportPath, 61, "convex/"),
      /60\.00%.*below 61\.00%/,
    );
  });

  it("matches relative and absolute paths on directory boundaries", () => {
    const source = [
      "SF:convex/purchases/amazon.ts",
      "LF:4",
      "LH:2",
      "end_of_record",
      "SF:/workspace/openiap/packages/kit/convex/purchases/horizon.ts",
      "LF:3",
      "LH:3",
      "end_of_record",
      "SF:C:\\workspace\\openiap\\packages\\kit\\convex\\purchases\\ios.ts",
      "LF:3",
      "LH:1",
      "end_of_record",
      "SF:/workspace/openiap/packages/kit/convexity/not-convex.ts",
      "LF:100",
      "LH:0",
      "end_of_record",
    ].join("\n");

    assert.deepEqual(readLcovLineCoverage(source, "convex"), {
      found: 10,
      hit: 6,
      percentage: 60,
    });
    assert.deepEqual(readLcovLineCoverage(source, "./convex/"), {
      found: 10,
      hit: 6,
      percentage: 60,
    });
  });

  it("does not match a source directory that only shares the prefix", () => {
    assert.throws(
      () =>
        readLcovLineCoverage(
          "SF:/workspace/packages/kit/convexity/file.ts\nLF:1\nLH:1\n",
          "convex",
        ),
      /source prefix "convex"/,
    );
  });

  it("resolves parent-directory segments before prefix matching", () => {
    const source = [
      "SF:convex/../server/api.ts",
      "LF:4",
      "LH:4",
      "end_of_record",
      "SF:convex/purchases/amazon.ts",
      "LF:6",
      "LH:3",
      "end_of_record",
    ].join("\n");

    assert.deepEqual(readLcovLineCoverage(source, "convex/"), {
      found: 6,
      hit: 3,
      percentage: 50,
    });
    assert.deepEqual(readLcovLineCoverage(source, "server/"), {
      found: 4,
      hit: 4,
      percentage: 100,
    });
  });

  it("accepts the exact minimum and rejects lower coverage", () => {
    assert.doesNotThrow(() =>
      assertLcovLineCoverage(report("LF:10\nLH:9\n"), 90),
    );
    assert.throws(
      () => assertLcovLineCoverage(report("LF:1000\nLH:899\n"), 90),
      /89\.90%.*below 90\.00%/,
    );
  });

  it("rejects malformed reports and invalid minimums", () => {
    assert.throws(
      () => readLcovLineCoverage("TN:\n"),
      /valid LF\/LH line totals/,
    );
    assert.throws(
      () => assertLcovLineCoverage(report("LF:1\nLH:1\n"), 101),
      /between 0 and 100/,
    );
    assert.throws(
      () =>
        readLcovLineCoverage(
          "SF:server/api.ts\nLF:1\nLH:1\nend_of_record\n",
          "convex/",
        ),
      /source prefix "convex\/"/,
    );
  });
});
