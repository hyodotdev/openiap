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
  });
});
