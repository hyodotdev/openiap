// Runs the tests a design approval names and reads their outcome from the
// runner's own report, so a skipped or unrun test cannot count as
// verification however its body is written. The tests are PR code, so this
// runs in the PR's own CI job. It catches mistakes, not a PR that rewrites
// CI: design-approval.yml checks the approval from main and rejects an
// approved PR that edits this file or that job.

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { appleTestOutcomes } from "../packages/conformance/scripts/check-apple-test-run.mjs";

const approvalLines = (body) =>
  (body ?? "").match(/^Design approval:[^\r\n]*/gm) ?? [];

export function approvalLink(body, repository) {
  const fields = approvalLines(body);
  if (fields.length !== 1)
    throw new Error("Add one Design approval link to the PR body.");
  const url = fields[0].slice("Design approval:".length).trim();
  const prefix = `https://github.com/${repository}/issues/`;
  const reference =
    url.startsWith(prefix) &&
    /^(\d+)#issuecomment-(\d+)$/.exec(url.slice(prefix.length));
  if (!reference)
    throw new Error(
      "Design approval must link to a comment on a proposal issue in this repository.",
    );
  return { url, issue: reference[1], comment: reference[2] };
}

export function approvalFields(details, field) {
  const prefix = `${field}:`;
  const values = details
    .filter((line) => line.startsWith(prefix))
    .map((line) => line.slice(prefix.length).trim());
  if (
    !values.length ||
    values.some(
      (value) => !value || /^(?:tbd|todo|pending|n\/?a)[.!]?$/i.test(value),
    )
  ) {
    throw new Error(`The approval must include concrete ${field}: evidence.`);
  }
  return values;
}

/** Parses `path#test name` values from an approval's Verification: lines. */
export function verificationTests(values) {
  return values.map((value) => {
    const separator = value.indexOf("#");
    return {
      path: value.slice(0, separator),
      name: value.slice(separator + 1),
    };
  });
}

const jsonReport = (output) => JSON.parse(output || '{"testResults":[]}');

const workspaceInstall = [
  ["bun", ["install", "--frozen-lockfile", "--ignore-scripts"], "."],
];

// The required CI jobs that run Swift and Kotlin tests check the approved ones
// in their own report. A native test no required job runs cannot verify an
// approval.
const nativeJobs = {
  apple: /^packages\/apple\/Tests\/.+\.swift$/,
  google: /^packages\/google\/(?:core|openiap)\/src\/test\w*\/.+\.kt$/,
};

/**
 * How CI runs a test file. `root` is the nearest directory with a
 * package.json, where the test's own CI job runs it. A Swift or Kotlin test
 * returns only the platform job that checks it.
 */
export function testRunnerFor(path, source = "", root = ".") {
  if (path.startsWith("libraries/maui-iap/tests/OpenIap.Maui.Tests/")) {
    // The shared net10.0 suite, as ci-maui-iap.yml runs it.
    return {
      root: "libraries/maui-iap",
      install: [],
      report: (output, file) => nativeReport(file, source, trxCases(output)),
      command: (file, report) => [
        "dotnet",
        [
          "test",
          "tests/OpenIap.Maui.Tests/OpenIap.Maui.Tests.csproj",
          "-p:TargetFrameworks=net10.0",
          "--nologo",
          "--results-directory",
          dirname(report),
          "--logger",
          `trx;LogFileName=${basename(report)}`,
        ],
      ],
    };
  }
  if (/\.(?:swift|kt|cs)$/.test(path)) {
    const job = Object.keys(nativeJobs).find((key) =>
      nativeJobs[key].test(path),
    );
    if (!job)
      throw new Error(`No required CI job runs the native test ${path}`);
    return { job };
  }
  if (/\bfrom\s+["']node:test["']/.test(source)) {
    return {
      root,
      install: workspaceInstall,
      report: (output, file) => junitReport(file, output),
      command: (file, report) => [
        "node",
        [
          "--test",
          "--test-reporter=junit",
          `--test-reporter-destination=${report}`,
          file,
        ],
      ],
    };
  }
  if (/\bfrom\s+["']bun:test["']/.test(source)) {
    return {
      root,
      install: workspaceInstall,
      report: (output, file) => junitReport(file, output),
      command: (file, report) => [
        "bun",
        [
          "test",
          `./${file}`,
          "--reporter=junit",
          `--reporter-outfile=${report}`,
        ],
      ],
    };
  }
  const jest = (directory, install) => ({
    root: directory,
    install,
    report: jsonReport,
    command: (file, report) => [
      "npx",
      ["jest", file, "--json", `--outputFile=${report}`],
    ],
  });
  if (path.startsWith("libraries/react-native-iap/")) {
    // Corepack activates the yarn version package.json pins.
    return jest("libraries/react-native-iap", [
      ["corepack", ["enable"], "libraries/react-native-iap"],
      [
        "yarn",
        ["install", "--immutable", "--mode=skip-build"],
        "libraries/react-native-iap",
      ],
    ]);
  }
  if (path.startsWith("libraries/expo-iap/")) {
    // The config plugin has its own jest config.
    return jest(
      path.startsWith("libraries/expo-iap/plugin/")
        ? "libraries/expo-iap/plugin"
        : "libraries/expo-iap",
      [["bun", ["install", "--frozen-lockfile"], "libraries/expo-iap"]],
    );
  }
  if (/^(?:packages|specs)\//.test(path)) {
    return {
      root,
      install: workspaceInstall,
      report: jsonReport,
      command: (file, report) => [
        "bunx",
        ["vitest", "run", file, "--reporter=json", `--outputFile=${report}`],
      ],
    };
  }
  throw new Error(`No CI test runner is known for ${path}`);
}

const xmlText = (text) =>
  text.replace(
    /&(?:#(\d+)|#x([\da-f]+)|(amp|lt|gt|quot|apos));/gi,
    (_, decimal, hex, name) =>
      decimal
        ? String.fromCodePoint(Number(decimal))
        : hex
          ? String.fromCodePoint(Number.parseInt(hex, 16))
          : { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[
              name.toLowerCase()
            ],
  );

// Messages escape `<`, and test output lands in XML comments or CDATA, which
// are dropped first, so test output cannot forge a result. A space keeps the
// text around a dropped section from joining into new markup.
const reportElements = (xml) =>
  xml.replace(/<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>/g, " ");

const xmlAttribute = (attributes, key) => {
  const value = new RegExp(`\\s${key}="([^"]*)"`).exec(attributes)?.[1];
  return value === undefined ? undefined : xmlText(value);
};

/** Reads the test cases of a node:test, bun:test, or Gradle JUnit report. */
export function junitCases(xml) {
  const cases = [];
  for (const match of reportElements(xml).matchAll(
    /<testcase((?:\s+[\w:.-]+="[^"]*")*)\s*(?:\/>|>([\s\S]*?)<\/testcase>)/g,
  )) {
    const name = xmlAttribute(match[1], "name");
    if (name === undefined) continue;
    const body = match[2] ?? "";
    const skipped = /<skipped\b[^>]*>/.exec(body)?.[0];
    cases.push({
      // node:test escapes a quote twice.
      name: name.replaceAll("&quot;", '"'),
      classname: xmlAttribute(match[1], "classname") ?? "",
      status: skipped
        ? /type="todo"|message="TODO"/.test(skipped)
          ? "todo"
          : "skipped"
        : /<(?:failure|error)\b/.test(body)
          ? "failed"
          : "passed",
    });
  }
  return cases;
}

/** Reads the results of a VSTest TRX report as JUnit-style cases. */
export function trxCases(xml) {
  const outcomes = {
    Passed: "passed",
    Failed: "failed",
    NotExecuted: "skipped",
  };
  return [
    ...reportElements(xml).matchAll(
      /<UnitTestResult\b((?:\s+[\w:.-]+="[^"]*")*)/g,
    ),
  ].map(([, attributes]) => {
    // Namespace.Class.Method, with a theory's arguments after it.
    const test = (xmlAttribute(attributes, "testName") ?? "").replace(
      /\(.*$/s,
      "",
    );
    return {
      classname: test.slice(0, test.lastIndexOf(".")),
      name: test.slice(test.lastIndexOf(".") + 1),
      status: outcomes[xmlAttribute(attributes, "outcome")] ?? "failed",
    };
  });
}

/** A JUnit report as the Jest-shaped report the check uses. */
export function junitReport(path, xml) {
  const assertionResults = junitCases(xml).map(({ name, status }) => ({
    title: name,
    status,
  }));
  return { testResults: [{ name: `/${path}`, assertionResults }] };
}

/**
 * The results a report holds for the native test file `source`: cases of the
 * types it declares, in its Kotlin package or C# namespace.
 */
export function nativeReport(path, source, cases) {
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  const types = new Set(
    [
      ...code.matchAll(/\b(?:class|struct|extension|actor|object)\s+(\w+)/g),
    ].map(([, type]) => type),
  );
  // Swift has no package line; `package` there is an access modifier.
  const packageName = path.endsWith(".swift")
    ? undefined
    : /^[ \t]*(?:package|namespace)[ \t]+([\w.]+)/m.exec(code)?.[1];
  const assertionResults = cases
    .filter(
      ({ classname }) =>
        (!packageName || classname.startsWith(`${packageName}.`)) &&
        types.has(classname.split(/[.$+]/).at(-1)),
    )
    // A parameterized run appends `[n]`, which no method name can contain.
    .map(({ name, status }) => ({
      title: name.replace(/\[[^\]]*\]$/, ""),
      status,
    }));
  return { testResults: [{ name: `/${path}`, assertionResults }] };
}

/** Every approved test must have run exactly as titled, and only passed. */
export function assertApprovedTestsPassed(tests, reports) {
  for (const { path, name } of tests) {
    const results = (reports.get(path)?.testResults ?? [])
      .filter((file) => file.name.replaceAll("\\", "/").endsWith(`/${path}`))
      .flatMap((file) => file.assertionResults)
      .filter((assertion) => assertion.title === name);
    if (!results.length) {
      throw new Error(
        `Approved verification test did not run: ${path}#${name}`,
      );
    }
    const statuses = [...new Set(results.map(({ status }) => status))];
    if (statuses.some((status) => status !== "passed")) {
      throw new Error(
        `Approved verification test did not pass (${statuses.join(", ")}): ${path}#${name}`,
      );
    }
  }
}

// The nearest directory with a package.json, relative to the repository.
function packageRoot(path, root) {
  for (
    let directory = dirname(path);
    directory !== ".";
    directory = dirname(directory)
  ) {
    if (existsSync(resolve(root, directory, "package.json"))) return directory;
  }
  return ".";
}

export function runApprovedTests(tests, root, run = execFileSync) {
  // Test code is PR code; it gets no API token.
  const env = { ...process.env };
  delete env.GH_TOKEN;
  delete env.GITHUB_TOKEN;
  const reports = new Map();
  const installed = new Set();
  const directory = mkdtempSync(join(tmpdir(), "approved-tests-"));
  const verified = [];
  for (const [index, test] of tests.entries()) {
    let source = "";
    try {
      source = readFileSync(resolve(root, test.path), "utf8");
    } catch {
      // A missing file has no results; the assertion reports it.
    }
    const runner = testRunnerFor(
      test.path,
      source,
      packageRoot(test.path, root),
    );
    if (runner.job) {
      console.log(
        `${test.path}#${test.name} is checked in the ${runner.job} job.`,
      );
      continue;
    }
    verified.push(test);
    for (const [command, args, cwd] of runner.install) {
      const key = `${cwd} ${command} ${args.join(" ")}`;
      if (installed.has(key)) continue;
      run(command, args, { cwd: resolve(root, cwd), env, stdio: "inherit" });
      installed.add(key);
    }
    const report = join(directory, `${index}.report`);
    const [command, args] = runner.command(
      relative(runner.root, test.path),
      report,
    );
    try {
      run(command, args, {
        cwd: resolve(root, runner.root),
        env,
        stdio: "inherit",
      });
    } catch {
      // A failing run still writes its report; the assertion explains it.
    }
    let output = "";
    try {
      output = readFileSync(report, "utf8");
    } catch {
      // No report means the test did not run.
    }
    reports.set(test.path, runner.report(output, test.path));
  }
  assertApprovedTestsPassed(verified, reports);
}

// Reads a platform job's report as JUnit-style cases.
const platformCases = {
  apple: ([log]) =>
    appleTestOutcomes(readFileSync(log, "utf8")).map(
      ({ suite, method, status }) => ({
        classname: suite,
        name: method,
        status,
      }),
    ),
  // A module without results has none to read; its approved tests did not run.
  google: (directories) =>
    directories.filter(existsSync).flatMap((directory) =>
      readdirSync(directory, { recursive: true })
        .filter((file) => file.endsWith(".xml"))
        .flatMap((file) =>
          junitCases(readFileSync(join(directory, file), "utf8")),
        ),
    ),
};

/**
 * A re-run replays its original event, whose PR body decided which evidence
 * jobs run, so it must not check an approval added or changed since.
 */
export function assertSameApproval(eventBody, currentBody) {
  if (
    approvalLines(eventBody).join("\n") !==
    approvalLines(currentBody).join("\n")
  )
    throw new Error(
      "The design approval changed after this CI run started; re-run the latest run, which checks it.",
    );
}

/** Checks the approved tests of one platform job against its report. */
export function checkPlatformTests(tests, job, cases, readSource) {
  const native = tests.filter(({ path }) => nativeJobs[job].test(path));
  assertApprovedTestsPassed(
    native,
    new Map(
      native.map(({ path }) => [
        path,
        nativeReport(path, readSource(path) ?? "", cases),
      ]),
    ),
  );
  return native.length;
}

/**
 * Without arguments, runs the approved JavaScript and C# tests. With a
 * platform job and its reports, checks that job's approved Swift or Kotlin
 * tests.
 */
function main([job, ...reports]) {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const repo = event.repository.full_name;
  const api = (path) =>
    JSON.parse(execFileSync("gh", ["api", path], { encoding: "utf8" }));
  const pull = api(`repos/${repo}/pulls/${event.pull_request.number}`);
  assertSameApproval(event.pull_request.body, pull.body);
  // design-approval.yml decides whether the PR needs an approval and fails it
  // without one; this only checks the tests a linked approval names.
  if (!approvalLines(pull.body).length) {
    console.log("No design approval is linked, so there is nothing to check.");
    return;
  }
  const link = approvalLink(pull.body, repo);
  const comment = api(`repos/${repo}/issues/comments/${link.comment}`);
  const details = (comment.body ?? "").trim().split(/\r?\n/).slice(1);
  const tests = verificationTests(approvalFields(details, "Verification"));
  if (job) {
    if (!platformCases[job]) throw new Error(`Unknown platform job ${job}`);
    const checked = checkPlatformTests(
      tests,
      job,
      platformCases[job](reports),
      (path) => {
        try {
          return readFileSync(path, "utf8");
        } catch {
          return undefined;
        }
      },
    );
    console.log(`${checked} approved ${job} tests passed: ${link.url}`);
    return;
  }
  runApprovedTests(tests, process.cwd());
  console.log(`Approved verification tests passed: ${link.url}`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
