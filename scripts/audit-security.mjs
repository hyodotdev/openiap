#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isAlias, parse as parseYaml, parseDocument, visit } from "yaml";

import { BUN_PROJECTS, OSV_LOCKFILES } from "./dependency-projects.mjs";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

export function findWorkflowRunInterpolations(
  source,
  filename = "workflow.yml",
) {
  const findings = [];
  const document = parseDocument(source);
  if (document.errors.length > 0) {
    return [`${filename}: invalid YAML (${document.errors[0].message})`];
  }
  visit(document, {
    Pair(_, pair) {
      const key = resolveYamlScalar(pair.key, document);
      const value = resolveYamlScalar(pair.value, document);
      if (key.value !== "run" || typeof value.value !== "string") return;
      const expression = value.value.indexOf("${{");
      if (expression < 0) return;
      const valueStart = pair.value.range?.[0] ?? 0;
      const rawExpression = value.aliased
        ? -1
        : source.indexOf("${{", valueStart);
      findings.push(
        sourceLineFinding(
          source,
          rawExpression >= 0 ? rawExpression : valueStart + expression,
          filename,
        ),
      );
    },
  });

  return findings;
}

function resolveYamlScalar(node, document) {
  let resolved = node;
  let aliased = false;
  const seen = new Set();
  while (isAlias(resolved)) {
    if (seen.has(resolved)) return { aliased: true, node: resolved };
    seen.add(resolved);
    aliased = true;
    resolved = resolved.resolve(document);
  }
  return { aliased, node: resolved, value: resolved?.value };
}

function sourceLineFinding(source, offset, filename) {
  const lineNumber = sourceLineNumber(source, offset);
  const lineStart = source.lastIndexOf("\n", offset - 1) + 1;
  const lineEnd = source.indexOf("\n", offset);
  const line = source.slice(lineStart, lineEnd < 0 ? undefined : lineEnd);
  return `${filename}:${lineNumber}: ${line.trim()}`;
}

function sourceLineNumber(source, offset) {
  return source.slice(0, offset).split("\n").length;
}

export function listWorkflowFiles(
  directory = resolve(repoRoot, ".github/workflows"),
  prefix = ".github/workflows",
) {
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/iu.test(entry.name))
    .map((entry) => `${prefix}/${entry.name}`)
    .sort();
}

export function findUnpinnedDockerBases(source) {
  const stages = new Set();
  const findings = [];
  for (const line of source.split("\n")) {
    const match = line.match(/^\s*FROM\s+(.+)$/iu);
    if (!match) continue;
    const tokens = match[1].trim().split(/\s+/u);
    while (tokens[0]?.startsWith("--")) tokens.shift();
    const image = tokens.shift();
    if (!image) {
      findings.push(line.trim());
      continue;
    }
    const alias = tokens[0]?.toLowerCase() === "as" ? tokens[1] : undefined;
    if (
      !stages.has(image.toLowerCase()) &&
      !/@sha256:[0-9a-f]{64}$/u.test(image)
    ) {
      findings.push(image);
    }
    if (alias) stages.add(alias.toLowerCase());
  }
  return findings;
}

export function findWorkflowDependencyFindings(
  source,
  filename = "workflow.yml",
) {
  const findings = [];
  let workflow;
  let document;
  try {
    workflow = parseYaml(source);
    document = parseDocument(source);
    if (document.errors.length > 0) throw document.errors[0];
  } catch (error) {
    return [`${filename}: invalid YAML (${error.message})`];
  }
  if (!Object.hasOwn(workflow ?? {}, "permissions")) {
    findings.push(`${filename}: missing top-level permissions`);
  } else {
    const permissions = workflow.permissions;
    const values =
      permissions && typeof permissions === "object"
        ? Object.values(permissions)
        : [permissions];
    if (values.some((value) => /^(?:write|write-all)$/iu.test(String(value)))) {
      findings.push(`${filename}: top-level permissions must be read-only`);
    } else if (
      permissions !== "read-all" &&
      (permissions === null || typeof permissions !== "object")
    ) {
      findings.push(`${filename}: invalid top-level permissions`);
    }
  }

  for (const [jobName, job] of Object.entries(workflow?.jobs ?? {})) {
    if (!Object.hasOwn(job ?? {}, "permissions")) continue;
    const permissions = job.permissions;
    if (permissions === "write-all") {
      findings.push(`${filename}: job ${jobName} must not use write-all`);
      continue;
    }
    if (permissions === "read-all") continue;
    if (
      permissions === null ||
      typeof permissions !== "object" ||
      Array.isArray(permissions) ||
      Object.values(permissions).some(
        (value) => !new Set(["none", "read", "write"]).has(String(value)),
      )
    ) {
      findings.push(`${filename}: invalid permissions for job ${jobName}`);
    }
  }

  for (const [jobName, job] of Object.entries(workflow?.jobs ?? {})) {
    for (const step of job?.steps ?? []) {
      const action = String(step?.uses ?? "").toLowerCase();
      if (!action.startsWith("actions/checkout@")) continue;
      if (String(step?.with?.["persist-credentials"]) !== "false") {
        findings.push(
          `${filename}: job ${jobName} checkout must disable persisted credentials`,
        );
      }
    }
  }

  visit(document, {
    Pair(_, pair) {
      const key = resolveYamlScalar(pair.key, document);
      const value = resolveYamlScalar(pair.value, document);
      if (key.value !== "uses" || typeof value.value !== "string") return;
      const action = value.value;
      if (action.startsWith("./")) return;
      const commentNodes = [pair.value, value.node];
      const hasVersionComment = commentNodes.some((node) => {
        const valueEnd = node?.range?.[1];
        if (valueEnd === undefined) return false;
        const lineEnd = source.indexOf("\n", valueEnd);
        return /#\s*\S+/u.test(
          source.slice(valueEnd, lineEnd < 0 ? undefined : lineEnd),
        );
      });
      const location = `${filename}:${sourceLineNumber(
        source,
        pair.value.range?.[0] ?? 0,
      )}`;
      const separator = action.lastIndexOf("@");
      if (separator < 0) {
        findings.push(`${location}: unpinned action ${action}`);
        return;
      }
      const ref = action.slice(separator + 1);
      if (!/^[0-9a-f]{40}$/u.test(ref)) {
        findings.push(`${location}: unpinned action ${action}`);
      } else if (!hasVersionComment) {
        findings.push(
          `${location}: pinned action is missing a version comment`,
        );
      }
    },
  });
  return findings;
}

export function extractExternalUrls(source) {
  const urls = [];
  for (const match of source.matchAll(/https?:\/\/[^\s<>"'`)\]}]+/gu)) {
    const nextCharacter = source[match.index + match[0].length];
    if (nextCharacter === "<" || nextCharacter === "{") continue;
    urls.push(match[0].replace(/[.,;:]+$/u, ""));
  }
  return urls;
}

export function parseBunAuditOutput(output) {
  const cleanOutput = output.replace(/\x1B\[[0-?]*[ -/]*[@-~]/gu, "");
  const jsonLine = cleanOutput
    .split("\n")
    .map((line) => line.trim())
    .findLast((line) => line.startsWith("{") && line.endsWith("}"));
  if (!jsonLine) throw new Error("bun audit returned no JSON result");
  return JSON.parse(jsonLine);
}

export function summarizeAdvisories(audit) {
  return Object.entries(audit)
    .flatMap(([packageName, advisories]) =>
      advisories.map(({ severity, title, url }) => ({
        id: url?.split("/").at(-1),
        packageName,
        severity,
        title,
      })),
    )
    .sort((left, right) => left.packageName.localeCompare(right.packageName));
}

export function parseOsvIgnoredVulnerabilities(source) {
  const ignored = new Map();
  for (const block of source.split("[[IgnoredVulns]]").slice(1)) {
    const id = block.match(/^id\s*=\s*"([^"]+)"/mu)?.[1];
    const ignoreUntil = block.match(
      /^ignoreUntil\s*=\s*"?(\d{4}-\d{2}-\d{2})"?/mu,
    )?.[1];
    const reason = block.match(/^reason\s*=\s*"([^"]+)"/mu)?.[1];
    if (!id || !ignoreUntil || !reason) {
      throw new Error(
        "every ignored vulnerability needs id, ignoreUntil, and reason",
      );
    }
    const expiry = new Date(`${ignoreUntil}T00:00:00Z`);
    if (
      Number.isNaN(expiry.getTime()) ||
      expiry.toISOString().slice(0, 10) !== ignoreUntil
    ) {
      throw new Error(`invalid ignored vulnerability expiry ${ignoreUntil}`);
    }
    if (ignored.has(id))
      throw new Error(`duplicate ignored vulnerability ${id}`);
    ignored.set(id, { ignoreUntil, reason });
  }
  return ignored;
}

// `bun audit` reaches a remote advisory service, and that call fails
// intermittently. The failure is a transport error rather than a verdict, so it
// is retried; anything else, including a real advisory, still fails the audit.
const TRANSPORT_FAILURE =
  /ConnectionClosed|ConnectionRefused|Timeout|ECONNRESET|ETIMEDOUT|socket hang up|audit request failed/i;

export const isTransportFailure = (result) =>
  TRANSPORT_FAILURE.test(`${result?.stdout ?? ""}${result?.stderr ?? ""}`);

const sleepSync = (milliseconds) => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
};

export const BUN_AUDIT_ATTEMPTS = 4;
// Exponential rather than linear: the first CI failure this retry was written
// for came back within seconds, but a later one outlasted a 2s/4s window. This
// spans about a minute while costing nothing on the normal path, which
// succeeds on the first attempt and never sleeps. It does not make the audit
// immune to a real outage — that still fails closed, and is re-run.
export const BUN_AUDIT_BACKOFF_MS = [5_000, 15_000, 40_000];

export function runBunAudit(
  run,
  directory,
  { attempts = BUN_AUDIT_ATTEMPTS, sleep = sleepSync } = {},
) {
  let result;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    result = run("bun", ["audit", "--json"], {
      cwd: directory,
      encoding: "utf8",
    });
    // Only a transport error is worth repeating. A non-zero status carrying a
    // verdict, or any other output, is the answer.
    if (!isTransportFailure(result) || attempt === attempts) return result;
    sleep(BUN_AUDIT_BACKOFF_MS[attempt - 1] ?? 40_000);
  }
  return result;
}

export function auditDependencies(
  run = spawnSync,
  projects = BUN_PROJECTS,
  now = new Date(),
  osvLockfiles = projects === BUN_PROJECTS
    ? OSV_LOCKFILES
    : projects.map(({ lockfile }) => lockfile),
  auditOptions = {},
) {
  const findings = [];
  let ignoredCount = 0;
  for (const { directory, lockfile } of projects) {
    const result = runBunAudit(run, resolve(repoRoot, directory), auditOptions);
    if (result.error) throw result.error;
    if (result.signal) {
      throw new Error(`${lockfile}: bun audit terminated by ${result.signal}`);
    }
    if (![0, 1].includes(result.status)) {
      throw new Error(`${lockfile}: bun audit exited ${result.status}`);
    }
    let advisories;
    try {
      advisories = summarizeAdvisories(
        parseBunAuditOutput(`${result.stdout}\n${result.stderr}`),
      );
    } catch (error) {
      throw new Error(
        `${lockfile}: bun audit failed (${error.message}): ${(result.stderr || result.stdout).trim()}`,
      );
    }

    const configPath = resolve(repoRoot, directory, "osv-scanner.toml");
    const ignored = existsSync(configPath)
      ? parseOsvIgnoredVulnerabilities(readFileSync(configPath, "utf8"))
      : new Map();
    const used = new Set();
    for (const advisory of advisories) {
      const exception = ignored.get(advisory.id);
      if (
        exception &&
        exception.ignoreUntil >= now.toISOString().slice(0, 10)
      ) {
        used.add(advisory.id);
        ignoredCount += 1;
        continue;
      }
      findings.push({ ...advisory, lockfile });
    }
    for (const [id, exception] of ignored) {
      if (used.has(id)) continue;
      const state =
        exception.ignoreUntil < now.toISOString().slice(0, 10)
          ? "expired"
          : "unused";
      findings.push({
        id,
        lockfile,
        packageName: "exception",
        severity: state,
        title: `${state} dependency exception`,
      });
    }
    if (result.status === 1 && advisories.length === 0) {
      throw new Error(`${lockfile}: bun audit exited ${result.status}`);
    }
  }

  const bunLocks = new Set(projects.map(({ lockfile }) => lockfile));
  for (const lockfile of osvLockfiles.filter((path) => !bunLocks.has(path))) {
    const configPath = resolve(repoRoot, dirname(lockfile), "osv-scanner.toml");
    const ignored = existsSync(configPath)
      ? parseOsvIgnoredVulnerabilities(readFileSync(configPath, "utf8"))
      : new Map();
    const result = run(
      "osv-scanner",
      [
        "scan",
        "source",
        `--lockfile=${lockfile}`,
        "--config=/dev/null",
        "--format=json",
        "--verbosity=error",
      ],
      { cwd: repoRoot, encoding: "utf8" },
    );
    if (result.error) throw result.error;
    if (result.signal) {
      throw new Error(
        `${lockfile}: OSV-Scanner terminated by ${result.signal}`,
      );
    }
    if (![0, 1].includes(result.status)) {
      throw new Error(`${lockfile}: OSV-Scanner exited ${result.status}`);
    }
    let report;
    try {
      report = JSON.parse(result.stdout);
    } catch (error) {
      throw new Error(
        `${lockfile}: invalid OSV-Scanner JSON (${error.message})`,
      );
    }
    if (
      !report ||
      typeof report !== "object" ||
      !Array.isArray(report.results)
    ) {
      throw new Error(`${lockfile}: invalid OSV-Scanner result structure`);
    }
    const used = new Set();
    let vulnerabilityCount = 0;
    for (const scanResult of report.results) {
      if (!scanResult || !Array.isArray(scanResult.packages)) {
        throw new Error(`${lockfile}: invalid OSV-Scanner result structure`);
      }
      for (const pkg of scanResult.packages) {
        if (!pkg || !Array.isArray(pkg.vulnerabilities)) {
          throw new Error(`${lockfile}: invalid OSV-Scanner result structure`);
        }
        for (const vulnerability of pkg.vulnerabilities) {
          vulnerabilityCount += 1;
          const ids = [
            vulnerability.id,
            ...(vulnerability.aliases ?? []),
          ].filter(Boolean);
          const acceptedId = ids.find((id) => {
            const exception = ignored.get(id);
            return (
              exception &&
              exception.ignoreUntil >= now.toISOString().slice(0, 10)
            );
          });
          if (acceptedId) {
            used.add(acceptedId);
            ignoredCount += 1;
            continue;
          }
          findings.push({
            id: vulnerability.id ?? ids[0] ?? "unknown",
            lockfile,
            packageName: pkg.package?.name ?? "dependency",
            severity: vulnerability.database_specific?.severity ?? "unknown",
            title:
              vulnerability.summary ??
              vulnerability.details?.split("\n", 1)[0] ??
              "unaccepted OSV vulnerability",
          });
        }
      }
    }
    if (result.status === 1 && vulnerabilityCount === 0) {
      throw new Error(`${lockfile}: OSV-Scanner exited 1 without findings`);
    }
    for (const [id, exception] of ignored) {
      const expired = exception.ignoreUntil < now.toISOString().slice(0, 10);
      if (!expired && used.has(id)) continue;
      const state = expired ? "expired" : "unused";
      findings.push({
        id,
        lockfile,
        packageName: "exception",
        severity: state,
        title: `${state} dependency exception`,
      });
    }
  }

  if (findings.length > 0) {
    const details = findings
      .map(({ id, lockfile, packageName, severity, title }) =>
        [severity, lockfile, packageName, id, title].join("\t"),
      )
      .join("\n");
    throw new Error(
      `${findings.length} dependency audit findings:\n${details}`,
    );
  }
  process.stdout.write(
    `No unaccepted dependency advisories found (${osvLockfiles.length} locks, ${ignoredCount} time-bounded exceptions).\n`,
  );
}

/**
 * Actions from ONE repository that must run at the same version.
 *
 * A repository can publish a root action and sub-actions together, so the
 * subpath is optional: `github/codeql-action@sha` and
 * `github/codeql-action/init@sha` are the same family and requiring a subpath
 * missed drift between them entirely.
 *
 * CodeQL refuses a mixed set outright — "Loaded a configuration file for
 * version 4.37.9, but running version 4.37.8" — and that is exactly what an
 * ungrouped Dependabot run produces, since it treats each path as its own
 * dependency and opens a PR per path. `.github/dependabot.yml` groups them so
 * they arrive together; this checks the result rather than trusting it.
 */
export function findActionFamilyDrift(sources) {
  const pinned = new Map();
  for (const [filename, source] of sources) {
    let document;
    try {
      document = parseDocument(source);
      if (document.errors.length > 0) continue;
    } catch {
      continue;
    }
    // Only real `uses:` values count. Scanning the raw text also matched a SHA
    // left in a YAML comment or quoted inside a `run:` block, and reported
    // drift against a reference the workflow never resolves.
    visit(document, {
      Pair(_, pair) {
        const key = resolveYamlScalar(pair.key, document);
        const value = resolveYamlScalar(pair.value, document);
        if (key.value !== "uses" || typeof value.value !== "string") return;
        const reference = value.value;
        if (reference.startsWith("./") || reference.startsWith("docker://")) {
          return;
        }
        const separator = reference.lastIndexOf("@");
        if (separator < 0) return;
        const path = reference.slice(0, separator);
        const sha = reference.slice(separator + 1);
        if (!/^[0-9a-f]{40}$/u.test(sha)) return;
        const segments = path.split("/");
        if (segments.length < 2) return;
        const family = segments.slice(0, 2).join("/");
        if (!pinned.has(family)) pinned.set(family, new Map());
        const shas = pinned.get(family);
        if (!shas.has(sha)) shas.set(sha, new Set());
        shas.get(sha).add(`${filename} (${path})`);
      },
    });
  }

  const findings = [];
  for (const [family, shas] of [...pinned].sort()) {
    if (shas.size < 2) continue;
    const where = [...shas]
      .map(
        ([sha, places]) =>
          `${sha.slice(0, 12)} in ${[...places].sort().join(", ")}`,
      )
      .sort()
      .join("; ");
    findings.push(
      `${family} is pinned to ${shas.size} different commits: ${where}`,
    );
  }
  return findings;
}

export async function auditWorkflowFiles(paths) {
  const runExpressions = paths.flatMap((path) =>
    findWorkflowRunInterpolations(
      readFileSync(resolve(repoRoot, path), "utf8"),
      path,
    ),
  );
  const dependencyFindings = paths.flatMap((path) =>
    findWorkflowDependencyFindings(
      readFileSync(resolve(repoRoot, path), "utf8"),
      path,
    ),
  );
  const drift = findActionFamilyDrift(
    paths.map((path) => [path, readFileSync(resolve(repoRoot, path), "utf8")]),
  );
  const findings = [...runExpressions, ...dependencyFindings, ...drift];
  if (findings.length > 0) {
    throw new Error(findings.join("\n"));
  }
  process.stdout.write(
    `${paths.length} workflow files passed security policy.\n`,
  );
}

async function auditUrls(paths) {
  const urls = [
    ...new Set(
      paths.flatMap((path) =>
        extractExternalUrls(readFileSync(resolve(repoRoot, path), "utf8")),
      ),
    ),
  ].sort();
  if (urls.length === 0) {
    throw new Error(
      "No external URLs found; refusing to report a vacuous pass",
    );
  }

  const failures = [];
  await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, {
          redirect: "follow",
          signal: AbortSignal.timeout(20_000),
        });
        await response.body?.cancel();
        if (!response.ok) failures.push(`${response.status} ${url}`);
      } catch (error) {
        failures.push(`ERROR ${url} (${error.message})`);
      }
    }),
  );

  process.stdout.write(
    failures.length > 0
      ? `${failures.sort().join("\n")}\n`
      : `${urls.length} external URLs resolved.\n`,
  );
  if (failures.length > 0) process.exitCode = 1;
}

async function main() {
  const [command, ...paths] = process.argv.slice(2);
  if (command === "dependencies") {
    auditDependencies();
    return;
  }
  if (!command) {
    throw new Error(
      "Usage: audit-security.mjs dependencies | workflows [files...] | urls <files...>",
    );
  }
  if (command === "workflows") {
    await auditWorkflowFiles(paths.length > 0 ? paths : listWorkflowFiles());
    return;
  }
  if (command === "urls") {
    if (paths.length === 0) {
      throw new Error("The urls audit requires at least one file");
    }
    await auditUrls(paths);
    return;
  }
  throw new Error(`Unknown audit command '${command}'`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  });
}
