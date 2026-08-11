#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function sourcePathSegments(sourcePath) {
  return sourcePath
    .replaceAll("\\", "/")
    .split("/")
    .filter((segment) => segment !== "" && segment !== ".");
}

function sourcePathMatchesPrefix(sourcePath, sourcePrefix) {
  const sourceSegments = sourcePathSegments(sourcePath);
  const prefixSegments = sourcePathSegments(sourcePrefix);
  if (prefixSegments.length === 0) return true;

  for (
    let start = 0;
    start <= sourceSegments.length - prefixSegments.length;
    start += 1
  ) {
    if (
      prefixSegments.every(
        (prefixSegment, offset) =>
          sourceSegments[start + offset] === prefixSegment,
      )
    ) {
      return true;
    }
  }
  return false;
}

export function readLcovLineCoverage(source, sourcePrefix) {
  let found = 0;
  let hit = 0;
  const displayedPrefix =
    sourcePrefix === undefined ? undefined : sourcePrefix.replaceAll("\\", "/");
  let includeRecord = sourcePrefix === undefined;

  for (const line of source.split(/\r?\n/)) {
    if (line.startsWith("SF:")) {
      includeRecord =
        sourcePrefix === undefined ||
        sourcePathMatchesPrefix(line.slice(3), sourcePrefix);
      continue;
    }
    if (!includeRecord) continue;
    if (line.startsWith("LF:")) found += Number(line.slice(3));
    if (line.startsWith("LH:")) hit += Number(line.slice(3));
  }
  if (!Number.isFinite(found) || !Number.isFinite(hit) || found <= 0) {
    const scope =
      displayedPrefix === undefined
        ? ""
        : ` for source prefix ${JSON.stringify(displayedPrefix)}`;
    throw new Error(
      `LCOV report does not contain valid LF/LH line totals${scope}`,
    );
  }
  if (hit < 0 || hit > found) {
    throw new Error(`LCOV line totals are invalid: ${hit}/${found}`);
  }

  return { found, hit, percentage: (hit / found) * 100 };
}

export function assertLcovLineCoverage(reportPath, minimum, sourcePrefix) {
  if (!Number.isFinite(minimum) || minimum < 0 || minimum > 100) {
    throw new Error(`Coverage minimum must be between 0 and 100: ${minimum}`);
  }
  const coverage = readLcovLineCoverage(
    fs.readFileSync(reportPath, "utf8"),
    sourcePrefix,
  );
  if (coverage.percentage < minimum) {
    throw new Error(
      `Line coverage ${coverage.percentage.toFixed(2)}% (${coverage.hit}/${coverage.found}) is below ${minimum.toFixed(2)}%`,
    );
  }
  return coverage;
}

const isMain =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const [reportPath, minimumInput, sourcePrefix] = process.argv.slice(2);
  if (!reportPath || minimumInput === undefined) {
    console.error(
      "Usage: node scripts/assert-lcov-coverage.mjs <lcov.info> <minimum-percent> [source-prefix]",
    );
    process.exit(2);
  }

  try {
    const minimum = Number(minimumInput);
    const coverage = assertLcovLineCoverage(reportPath, minimum, sourcePrefix);
    const scope =
      sourcePrefix === undefined ? "" : ` for ${JSON.stringify(sourcePrefix)}`;
    console.log(
      `Line coverage${scope} ${coverage.percentage.toFixed(2)}% (${coverage.hit}/${coverage.found}) meets ${minimum.toFixed(2)}%`,
    );
  } catch (error) {
    console.error(`::error::${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}
