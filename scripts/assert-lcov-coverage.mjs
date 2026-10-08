#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(fileURLToPath(import.meta.url), "../..");

function yamlBlock(source, key, indent) {
  const lines = source.split(/\r?\n/);
  const starts = lines.flatMap((line, index) =>
    line === `${" ".repeat(indent)}${key}:` ? [index] : [],
  );
  if (starts.length !== 1)
    throw new Error(`Coverage policy requires exactly one block: ${key}`);
  const start = starts[0];
  const end = lines.findIndex(
    (line, index) =>
      index > start &&
      line.trim() &&
      !line.trimStart().startsWith("#") &&
      line.match(/^ */)[0].length <= indent,
  );
  return lines.slice(start + 1, end < 0 ? undefined : end).join("\n");
}

function yamlStrings(source, key, indent) {
  return yamlBlock(source, key, indent)
    .split("\n")
    .filter((line) => line.trimStart().startsWith("- "))
    .map((line) => {
      const value = line.trim().slice(2);
      return value.startsWith('"') ? JSON.parse(value) : value;
    });
}

export function readCoveragePolicy(source, component) {
  if (!/^[a-z0-9-]+$/u.test(component)) {
    throw new Error(`Invalid coverage component: ${component}`);
  }
  const parser = yamlBlock(yamlBlock(source, "parsers", 0), "lcov", 2);
  const partials = parser
    .split("\n")
    .filter((line) => line.startsWith("    partials_as_hits:"));
  if (partials.length !== 1 || partials[0] !== "    partials_as_hits: true") {
    throw new Error("Local coverage requires partials_as_hits: true");
  }
  // The parity audit constrains this Codecov YAML shape.
  const status = yamlBlock(yamlBlock(source, "coverage", 0), "status", 2);
  const rules = ["project", "patch"].map((kind) => {
    const block = yamlBlock(yamlBlock(status, kind, 4), component, 6);
    const targets = [
      ...block.matchAll(/^        target: (\d+(?:\.\d+)?)%$/gmu),
    ];
    const fields = block.split("\n");
    if (
      targets.length !== 1 ||
      fields.filter((line) => line.startsWith("        target:")).length !==
        1 ||
      fields.filter((line) => line.startsWith("        threshold:")).length !==
        1 ||
      !fields.includes("        threshold: 0%")
    ) {
      throw new Error(`Invalid ${kind} coverage target for ${component}`);
    }
    const minimum = Number(targets[0][1]);
    if (minimum < 0 || minimum > 100) {
      throw new Error(`Invalid ${kind} coverage minimum: ${minimum}`);
    }
    const paths = block.includes("        paths:")
      ? yamlStrings(block, "paths", 8)
      : yamlStrings(block, "flags", 8).flatMap((flag) =>
          yamlStrings(
            yamlBlock(yamlBlock(source, "flags", 0), flag, 2),
            "paths",
            4,
          ),
        );
    if (!paths.length) throw new Error(`Empty coverage scope for ${component}`);
    return { minimum, paths };
  });
  if (JSON.stringify(rules[0].paths) !== JSON.stringify(rules[1].paths)) {
    throw new Error(`Project and patch scopes differ for ${component}`);
  }
  return {
    projectMinimum: rules[0].minimum,
    patchMinimum: rules[1].minimum,
    paths: rules[0].paths,
    ignore: yamlStrings(source, "ignore", 0),
  };
}

function matchesGlob(filename, pattern) {
  let expression = "";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (pattern.slice(index, index + 3) === "**/") {
      expression += "(?:.*/)?";
      index += 2;
    } else if (pattern.slice(index, index + 2) === "**") {
      expression += ".*";
      index += 1;
    } else if (character === "*") {
      expression += "[^/]*";
    } else {
      expression += character.replace(/[.+?^${}()|[\]\\]/gu, "\\$&");
    }
  }
  return new RegExp(`^${expression}$`, "u").test(filename);
}

export function readChangedLines(patch) {
  const files = new Map();
  let filename;
  let nextLine;
  let deleted = false;
  for (const line of patch.split(/\r?\n/)) {
    if (line.startsWith("diff --git ")) {
      filename = undefined;
      nextLine = undefined;
      deleted = false;
    } else if (nextLine === undefined && line.startsWith("+++ ")) {
      const value = line.slice(4).split("\t")[0];
      const decoded = value.startsWith('"') ? JSON.parse(value) : value;
      deleted = decoded === "/dev/null";
      if (decoded !== "/dev/null") {
        filename = decoded.replace(/^b\//u, "");
        files.set(filename, new Set());
      }
    } else if (line.startsWith("@@ ")) {
      if (deleted) continue;
      const match = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/u);
      if (!match || !filename) throw new Error("Invalid coverage diff hunk");
      nextLine = Number(match[1]);
    } else if (nextLine !== undefined && line.startsWith("+")) {
      files.get(filename).add(nextLine++);
    } else if (nextLine !== undefined && line.startsWith(" ")) {
      nextLine += 1;
    }
  }
  return files;
}

function readLcovRecords(source) {
  const records = [];
  let record;
  for (const line of source.split(/\r?\n/)) {
    if (line.startsWith("SF:")) {
      if (record) throw new Error("Unterminated LCOV record");
      record = { filename: line.slice(3), lines: new Map() };
    } else if (line.startsWith("DA:")) {
      const match = line.match(/^DA:(\d+),(\d+)(?:,[^,]+)?$/u);
      if (!record || !match || Number(match[1]) < 1) {
        throw new Error(`Invalid LCOV line data: ${line}`);
      }
      const number = Number(match[1]);
      const hits = Number(match[2]);
      if (!Number.isSafeInteger(number) || !Number.isSafeInteger(hits)) {
        throw new Error(`Invalid LCOV line data: ${line}`);
      }
      record.lines.set(number, Math.max(record.lines.get(number) ?? 0, hits));
    } else if (/^(LF|LH):/u.test(line)) {
      const match = line.match(/^(LF|LH):(\d+)$/u);
      if (!record || !match)
        throw new Error(`Invalid LCOV line total: ${line}`);
      record[match[1]] = Number(match[2]);
    } else if (line === "end_of_record") {
      if (
        !record ||
        record.LF !== record.lines.size ||
        record.LH !==
          [...record.lines.values()].filter((hits) => hits > 0).length
      ) {
        throw new Error("LCOV LF/LH totals disagree with executable line data");
      }
      records.push(record);
      record = undefined;
    }
  }
  if (record || !records.length)
    throw new Error("Missing complete LCOV records");
  return records;
}

export function readComponentCoverage(
  source,
  patch,
  policy,
  sourceDirectory,
  root = repositoryRoot,
) {
  const changed = readChangedLines(patch);
  const measured = new Map();
  for (const record of readLcovRecords(source)) {
    const absolute = path.resolve(sourceDirectory, record.filename);
    const filename = path.relative(root, absolute).replaceAll("\\", "/");
    if (
      !record.filename.trim() ||
      filename === ".." ||
      filename.startsWith("../")
    ) {
      throw new Error(
        `LCOV source is outside the workspace: ${record.filename}`,
      );
    }
    if (
      !policy.paths.some((pattern) => matchesGlob(filename, pattern)) ||
      policy.ignore.some((pattern) => matchesGlob(filename, pattern))
    ) {
      continue;
    }
    const lines = measured.get(filename) ?? new Map();
    for (const [number, hits] of record.lines) {
      lines.set(number, Math.max(lines.get(number) ?? 0, hits));
    }
    measured.set(filename, lines);
  }
  const project = { found: 0, hit: 0 };
  const diff = { found: 0, hit: 0 };
  for (const [filename, lines] of measured) {
    for (const [number, hits] of lines) {
      project.found += 1;
      project.hit += Number(hits > 0);
      if (changed.get(filename)?.has(number)) {
        diff.found += 1;
        diff.hit += Number(hits > 0);
      }
    }
  }
  if (project.found === 0)
    throw new Error("No executable lines in coverage scope");
  project.percentage = (project.hit / project.found) * 100;
  diff.percentage = diff.found ? (diff.hit / diff.found) * 100 : null;
  for (const [kind, coverage, minimum] of [
    ["Project", project, policy.projectMinimum],
    ["Patch", diff, policy.patchMinimum],
  ]) {
    if (coverage.percentage !== null && coverage.percentage < minimum) {
      throw new Error(
        `${kind} coverage ${coverage.percentage.toFixed(2)}% (${coverage.hit}/${coverage.found}) is below ${minimum.toFixed(2)}%`,
      );
    }
  }
  return { project, patch: diff };
}

export function normalizeCoverageBase(base) {
  if (!base)
    throw new Error("COVERAGE_BASE_REF is required for patch coverage");
  return /^0{40}$/u.test(base) ? "HEAD^" : base;
}

function assertComponentCoverage(reportPath, component, base) {
  const resolvedBase = execFileSync(
    "git",
    [
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${normalizeCoverageBase(base)}^{commit}`,
    ],
    { cwd: repositoryRoot, encoding: "utf8" },
  ).trim();
  const patch = execFileSync(
    "git",
    [
      "-c",
      "core.quotePath=false",
      "diff",
      "--no-ext-diff",
      "--no-textconv",
      "--find-renames",
      "--unified=0",
      "--inter-hunk-context=0",
      resolvedBase,
      "HEAD",
      "--",
    ],
    { cwd: repositoryRoot, encoding: "utf8", maxBuffer: 32 * 1024 * 1024 },
  );
  const policy = readCoveragePolicy(
    fs.readFileSync(path.join(repositoryRoot, "codecov.yml"), "utf8"),
    component,
  );
  return readComponentCoverage(
    fs.readFileSync(reportPath, "utf8"),
    patch,
    policy,
    process.cwd(),
  );
}

function sourcePathSegments(sourcePath) {
  return path.posix
    .normalize(sourcePath.replaceAll("\\", "/"))
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
      "Usage: node scripts/assert-lcov-coverage.mjs <lcov.info> <minimum-percent> [source-prefix] | <lcov.info> --component <name>",
    );
    process.exit(2);
  }

  try {
    if (minimumInput === "--component") {
      const coverage = assertComponentCoverage(
        reportPath,
        sourcePrefix,
        process.env.COVERAGE_BASE_REF,
      );
      console.log(
        `${sourcePrefix} project coverage: ${coverage.project.percentage.toFixed(2)}% (${coverage.project.hit}/${coverage.project.found})`,
      );
      console.log(
        coverage.patch.percentage === null
          ? `${sourcePrefix} patch coverage: N/A (no changed executable lines)`
          : `${sourcePrefix} patch coverage: ${coverage.patch.percentage.toFixed(2)}% (${coverage.patch.hit}/${coverage.patch.found})`,
      );
      process.exit(0);
    }
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
