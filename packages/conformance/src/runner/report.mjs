/** Formats a runConformance result for humans and for CI artifacts. */

const ORDER = ["fail", "warn", "pass", "skip", "not-applicable"];

const SYMBOL = {
  pass: "PASS",
  fail: "FAIL",
  warn: "WARN",
  skip: "SKIP",
  "not-applicable": "N/A ",
};

export function formatReport(report) {
  const lines = [
    `OpenIAP Conformance Report`,
    `  implementation : ${report.implementation}`,
    `  store          : ${report.store}`,
    `  suite version  : ${report.suiteVersion}`,
    `  spec version   : ${report.specVersion}`,
    `  scope          : ${report.scope.complete ? "full" : "partial"} (${report.results.length}/${report.scope.totalBehaviorCount})`,
    "",
  ];

  const byCategory = new Map();
  for (const result of report.results) {
    if (!byCategory.has(result.category)) byCategory.set(result.category, []);
    byCategory.get(result.category).push(result);
  }

  for (const [category, results] of byCategory) {
    lines.push(`  ${category}`);
    for (const result of results) {
      const reason = result.reason ? `  — ${result.reason}` : "";
      lines.push(`    ${SYMBOL[result.outcome]}  ${result.id}${reason}`);
    }
    lines.push("");
  }

  const summary =
    ORDER.filter((outcome) => report.counts[outcome])
      .map((outcome) => `${report.counts[outcome]} ${outcome}`)
      .join(", ") || "0 evaluated";
  lines.push(`  ${summary}`);
  if (!report.scope.complete) {
    lines.push(
      `  RESULT: PARTIAL evaluation — ${report.results.length}/${report.scope.totalBehaviorCount} behaviors; not a conformance verdict`,
    );
  } else if (report.conformant) {
    lines.push(
      `  RESULT: conformant with OpenIAP ${report.specVersion} (suite ${report.suiteVersion})`,
    );
  } else {
    lines.push(
      `  RESULT: NOT conformant — ${report.counts.fail} failing behavior(s)`,
    );
  }

  return lines.join("\n");
}

/** Stable JSON artifact for CI upload and cross-run comparison. */
export function toJsonReport(report) {
  return JSON.stringify(
    {
      suiteVersion: report.suiteVersion,
      specVersion: report.specVersion,
      implementation: report.implementation,
      store: report.store,
      conformant: report.conformant,
      scope: report.scope,
      counts: report.counts,
      results: report.results.map(
        ({ id, outcome, category, level, capabilityLevel, reason }) => ({
          id,
          outcome,
          category,
          level,
          capabilityLevel,
          ...(reason ? { reason } : {}),
        }),
      ),
    },
    null,
    2,
  );
}
