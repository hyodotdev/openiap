#!/usr/bin/env node

// Issue-mining pipeline for the IAP failure-mode taxonomy: documentation is
// the top API-learning obstacle and misuse catalogs are built from real
// reports (robillard2009apis, amann2016mubench in
// knowledge/research/bibliography.md; backlog R5).
//
// Exports each source repository's full issue history as JSONL plus a
// summary with keyword-seeded candidate categories for hand classification.
//
//   node scripts/mine-iap-issues.mjs [--out <dir>] [--limit <n>] [--repo <slug>]

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(import.meta.url);
const repositoryRoot = path.resolve(path.dirname(scriptPath), "..");

/** Standalone archives hold the pre-monorepo issue history. */
export const ISSUE_SOURCES = Object.freeze([
  { repo: "hyochan/react-native-iap", library: "react-native-iap" },
  { repo: "hyochan/expo-iap", library: "expo-iap" },
  { repo: "hyochan/flutter_inapp_purchase", library: "flutter_inapp_purchase" },
  { repo: "hyochan/kmp-iap", library: "kmp-iap" },
  { repo: "hyochan/godot-iap", library: "godot-iap" },
  { repo: "hyodotdev/openiap", library: "openiap-monorepo" },
]);

/**
 * Keyword-seeded candidate categories. This is a triage aid for the manual
 * classification pass, not the taxonomy itself; rules err toward recall.
 */
export const CATEGORY_RULES = Object.freeze([
  {
    category: "receipt-validation",
    pattern: /receipt|validat|verif|jws|signature|acknowledg/i,
  },
  {
    category: "purchase-flow",
    pattern:
      /purchase fail|requestpurchase|buy|payment|checkout|transaction fail/i,
  },
  {
    category: "pending-or-deferred",
    pattern: /pending|deferred|ask to buy|slow card/i,
  },
  {
    category: "restore-entitlement",
    pattern: /restore|available purchases|entitlement|re-?grant|owned/i,
  },
  {
    category: "subscription-state",
    pattern:
      /subscription|renew|expir|grace|billing retry|cancel|upgrade|downgrade|proration/i,
  },
  {
    category: "store-api-churn",
    pattern:
      /billing ?(client|library) ?[0-9]|storekit ?2|storekit2|deprecat|migrat|breaking/i,
  },
  {
    category: "sandbox-testing",
    pattern: /sandbox|test ?card|testflight|internal test|license tester/i,
  },
  {
    category: "build-integration",
    pattern:
      /build fail|gradle|cocoapods|pod install|proguard|xcode|linker|manifest|dependency conflict/i,
  },
  {
    category: "error-handling",
    pattern: /error code|e_[a-z_]+|crash|exception|unhandled|null ?pointer/i,
  },
  {
    category: "product-fetch",
    pattern:
      /fetchproducts|getproducts|sku|empty product|product not found|price/i,
  },
]);

/** @param {{title?: string, body?: string, labels?: Array<{name?: string}|string>}} issue */
export function candidateCategories(issue) {
  const labelText = (issue.labels ?? [])
    .map((label) => (typeof label === "string" ? label : (label?.name ?? "")))
    .join(" ");
  const haystack = `${issue.title ?? ""} ${labelText} ${issue.body ?? ""}`;
  const matched = CATEGORY_RULES.filter((rule) =>
    rule.pattern.test(haystack),
  ).map((rule) => rule.category);
  return matched.length > 0 ? matched : ["unclassified"];
}

/** Keep the record small and stable for hand classification. */
export function toRecord(library, issue) {
  return {
    library,
    number: issue.number,
    title: issue.title ?? "",
    state: issue.state,
    labels: (issue.labels ?? [])
      .map((label) => (typeof label === "string" ? label : (label?.name ?? "")))
      .filter(Boolean),
    createdAt: issue.created_at,
    closedAt: issue.closed_at ?? null,
    comments: issue.comments ?? 0,
    url: issue.html_url,
    candidateCategories: candidateCategories(issue),
    body: (issue.body ?? "").slice(0, 4000),
  };
}

function ghJson(args) {
  const stdout = execFileSync("gh", ["api", ...args], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

/** Issues only — the issues endpoint interleaves pull requests. */
export function isIssue(entry) {
  return !entry.pull_request;
}

function fetchIssues(repo, limit) {
  const collected = [];
  for (let page = 1; ; page += 1) {
    const batch = ghJson([
      `repos/${repo}/issues?state=all&per_page=100&page=${page}&direction=asc`,
    ]);
    collected.push(...batch.filter(isIssue));
    if (batch.length < 100) break;
    if (limit && collected.length >= limit) break;
  }
  return limit ? collected.slice(0, limit) : collected;
}

function parseArgs(argv) {
  const args = { out: undefined, limit: undefined, repo: undefined };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out") args.out = argv[++i];
    else if (argv[i] === "--limit") {
      args.limit = Number(argv[++i]);
      if (!Number.isInteger(args.limit) || args.limit <= 0) {
        throw new Error("--limit must be a positive integer");
      }
    } else if (argv[i] === "--repo") args.repo = argv[++i];
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  return args;
}

if (process.argv[1] && path.resolve(process.argv[1]) === scriptPath) {
  const { out, limit, repo } = parseArgs(process.argv.slice(2));
  const outDir =
    out ??
    path.join(repositoryRoot, "knowledge", "research", "_datasets", "issues");
  fs.mkdirSync(outDir, { recursive: true });

  const sources = repo
    ? ISSUE_SOURCES.filter((source) => source.repo === repo)
    : ISSUE_SOURCES;
  if (sources.length === 0) throw new Error(`unknown --repo: ${repo}`);

  const summary = { generatedAt: new Date().toISOString(), repos: [] };
  for (const source of sources) {
    const issues = fetchIssues(source.repo, limit);
    const records = issues.map((issue) => toRecord(source.library, issue));
    const file = path.join(outDir, `${source.library}.jsonl`);
    fs.writeFileSync(
      file,
      records.map((record) => JSON.stringify(record)).join("\n") + "\n",
    );

    const byCategory = {};
    for (const record of records) {
      for (const category of record.candidateCategories) {
        byCategory[category] = (byCategory[category] ?? 0) + 1;
      }
    }
    summary.repos.push({
      repo: source.repo,
      library: source.library,
      issueCount: records.length,
      open: records.filter((record) => record.state === "open").length,
      byCandidateCategory: byCategory,
    });
    console.log(
      `${source.repo}: ${records.length} issues -> ${path.relative(repositoryRoot, file)}`,
    );
  }

  fs.writeFileSync(
    path.join(outDir, "summary.json"),
    JSON.stringify(summary, null, 2) + "\n",
  );
  console.log(
    `summary -> ${path.relative(repositoryRoot, path.join(outDir, "summary.json"))}`,
  );
}
