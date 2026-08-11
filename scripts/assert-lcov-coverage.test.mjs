import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";

import {
  assertLcovLineCoverage,
  readLcovLineCoverage,
} from "./assert-lcov-coverage.mjs";

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
