import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const suiteSource = new URL(
  "../../apple/Tests/OpenIapTests/StoreConformanceTests.swift",
  import.meta.url,
);

export function appleConformanceMethods(source) {
  return [...source.matchAll(/^    func (test[A-Z]\w*)\(\)/gm)].map(
    ([, method]) => method,
  );
}

export function assertAppleConformanceRun(methods, log) {
  const outcomes = new Map();
  // SwiftPM's parallel xUnit report can omit XCTest skips. Read the sequential
  // XCTest result lines that distinguish passed, skipped, and failed cases.
  for (const [, method, status] of log.matchAll(
    /^Test Case '-\[(?:\w+\.)?StoreConformanceTests (test\w+)\]' (passed|skipped|failed)\b/gm,
  )) {
    const results = outcomes.get(method) ?? [];
    results.push(status);
    outcomes.set(method, results);
  }

  if (methods.length === 0)
    throw new Error("No Apple conformance tests declared");
  const incomplete = methods.filter(
    (method) => outcomes.get(method)?.join(",") !== "passed",
  );
  if (incomplete.length) {
    throw new Error(
      `Apple conformance tests must each pass once: ${incomplete
        .map(
          (method) =>
            `${method} (${outcomes.get(method)?.join(", ") ?? "missing"})`,
        )
        .join("; ")}`,
    );
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  const logPath = process.argv[2];
  if (!logPath) throw new Error("Pass the sequential swift test log path");
  const methods = appleConformanceMethods(readFileSync(suiteSource, "utf8"));
  assertAppleConformanceRun(methods, readFileSync(logPath, "utf8"));
  console.log(`All ${methods.length} Apple conformance tests passed.`);
}
