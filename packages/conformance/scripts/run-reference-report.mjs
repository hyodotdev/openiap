#!/usr/bin/env node
/**
 * Runs the reference adapter and prints a conformance report.
 *
 * Demonstrates the report a real implementation produces. Pass --json to emit
 * the machine-readable artifact instead.
 */
import { createReferenceAdapter } from "../src/adapters/reference-adapter.mjs";
import { BEHAVIORS } from "../src/spec/behaviors.mjs";
import { formatReport, toJsonReport } from "../src/runner/report.mjs";
import { runConformance } from "../src/runner/runner.mjs";

// Lifecycle behaviors are server-side; the reference client adapter does not
// implement them. IAPKit's suite covers them against real code.
const behaviors = BEHAVIORS.filter(
  (behavior) => behavior.category !== "lifecycle",
);

const report = await runConformance(createReferenceAdapter(), { behaviors });

console.log(
  process.argv.includes("--json") ? toJsonReport(report) : formatReport(report),
);

if (report.counts.fail) process.exit(1);
