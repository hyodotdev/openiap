import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const suiteSource = new URL(
  "../../apple/Tests/OpenIapTests/StoreConformanceTests.swift",
  import.meta.url,
);

// XCTest runs every instance `func test…()` without parameters, whatever its
// indentation or modifiers, so discovery must not depend on either.
export function appleConformanceMethods(source) {
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  return [
    ...code.matchAll(
      /^[ \t]*(?:(?:@\w+(?:\([^)\n]*\))?|public|internal|private|fileprivate|final|override|open|nonisolated)[ \t]+)*func[ \t]+(test[A-Z]\w*)[ \t]*\([ \t]*\)/gm,
    ),
  ].map(([, method]) => method);
}

/**
 * Reads XCTest's sequential result lines. SwiftPM's parallel xUnit report can
 * omit skips; these lines distinguish passed, skipped, and failed cases.
 */
export function appleTestOutcomes(log) {
  return [
    ...log.matchAll(
      /^Test Case '-\[(?:\w+\.)?(\w+) (test\w+)\]' (passed|skipped|failed)\b/gm,
    ),
  ].map(([, suite, method, status]) => ({ suite, method, status }));
}

export function assertAppleConformanceRun(methods, log) {
  const outcomes = new Map();
  for (const { suite, method, status } of appleTestOutcomes(log)) {
    if (suite !== "StoreConformanceTests") continue;
    const results = outcomes.get(method) ?? [];
    results.push(status);
    outcomes.set(method, results);
  }

  if (methods.length === 0)
    throw new Error("No Apple conformance tests declared");
  // A case XCTest ran that discovery missed means the declared list is wrong.
  const undiscovered = [...outcomes.keys()].filter(
    (method) => !methods.includes(method),
  );
  if (undiscovered.length) {
    throw new Error(
      `Apple conformance tests ran but were not discovered in the suite: ${undiscovered.join(", ")}`,
    );
  }
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
