import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";
import { parse as parseYaml } from "yaml";
import ts from "typescript";
import {
  approvalFields,
  approvalLink,
  testRunnerFor,
} from "./approved-verification.mjs";
import { publicSurfaceChanges } from "./public-declarations.mjs";
import { shipsInAnyPackage } from "./release-branch-policy.mjs";

const projectLeadId = 27461460; // @hyochan in MAINTAINERS.md
const publicContractPaths = [
  /^libraries\/(?:react-native-iap|expo-iap)\/src\/index\.ts$/,
  /^packages\/kit\/(?:convex\/commerce|server\/api\/commerce)\/(?!.*\.(?:test|spec)\.ts$)(?!(?:.*\/)?(?:__tests__|tests?)\/).+\.ts$/,
  /^specs\/(?:client|commerce-protocol)\/compatibility\.json$/,
  /^specs\/client\/src\/(?:generated\/|(?:[^/]+\.graphql|capability-matrix\.mjs|kit-api\.ts|purchase-flow(?:-core|-confirmers)?\.ts|purchase-flow\.vectors\.json)$)/,
  /^packages\/conformance\/src\/spec\/(?:behaviors|provider-profile)\.mjs$/,
  /^specs\/commerce-protocol\/(?:schema\/|generated\/|SPEC\.md$|vectors\/|(?:src|conformance)\/index\.(?:mjs|d\.ts)$)/,
];

// An approved PR cannot also change the check or the CI jobs that check its
// approved tests. Other CI jobs may change along with the contract.
const gateFiles = new Set([
  ".github/workflows/design-approval.yml",
  "scripts/audit-design-approval.mjs",
  "scripts/approved-verification.mjs",
  "scripts/public-declarations.mjs",
  "packages/conformance/scripts/check-apple-test-run.mjs",
]);
const ciWorkflow = ".github/workflows/ci.yml";
const evidenceJobs = ["audit-release-state", "test-android", "test-ios"];

/** Approval-gate changes an approved PR makes; they must land separately. */
export function approvalGateChanges(files, read) {
  const changed = files.filter((file) => gateFiles.has(file));
  if (files.includes(ciWorkflow)) {
    // The evidence jobs plus the triggers, env and permissions around them.
    const gate = (side) => {
      const source = read(side, ciWorkflow);
      if (source === undefined) return undefined;
      const workflow = parseYaml(source) ?? {};
      return {
        ...workflow,
        jobs: Object.fromEntries(
          evidenceJobs.map((job) => [job, workflow.jobs?.[job]]),
        ),
      };
    };
    if (!isDeepStrictEqual(gate("base"), gate("head")))
      changed.push(`${ciWorkflow} (an evidence job or its workflow settings)`);
  }
  return changed;
}

export function needsDesignApproval(files, body, surfaceChanged = []) {
  const fields = (body ?? "").match(/^Public contract:[^\r\n]*/gm) ?? [];
  const impact = fields[0]?.slice("Public contract:".length).trim();
  if (
    fields.length > 1 ||
    (fields.length && !["changed", "unchanged"].includes(impact))
  ) {
    throw new Error(
      "Use a single Public contract: changed or Public contract: unchanged line.",
    );
  }
  const authored =
    surfaceChanged.length > 0 ||
    files.some((file) =>
      publicContractPaths.some((pattern) => pattern.test(file)),
    );
  if (authored && impact === "unchanged") {
    throw new Error(
      surfaceChanged.length
        ? `This PR changes published SDK declarations and needs design approval: ${surfaceChanged.join(", ")}`
        : "This PR edits a public contract source and needs design approval.",
    );
  }
  if (!authored && !impact && files.some(shipsInAnyPackage)) {
    throw new Error(
      "Classify the shipped changes as Public contract: changed or Public contract: unchanged in the PR body.",
    );
  }
  return authored || impact === "changed";
}

function hasJavaScriptTest(path, source, name) {
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest);
  const hasTestWork = (body) => {
    let hasCall = false;
    let skips = false;
    const visit = (node, nested = false) => {
      const inCallback = nested || ts.isFunctionLike(node);
      if (ts.isCallExpression(node)) {
        hasCall ||= !inCallback;
        const target = node.expression;
        skips ||=
          (ts.isPropertyAccessExpression(target) &&
            target.name.text === "skip") ||
          (ts.isElementAccessExpression(target) &&
            ts.isStringLiteralLike(target.argumentExpression) &&
            target.argumentExpression.text === "skip") ||
          (ts.isIdentifier(target) && target.text === "pending");
      }
      ts.forEachChild(node, (child) => visit(child, inCallback));
    };
    if (ts.isBlock(body)) {
      for (const statement of body.statements) {
        visit(statement);
        if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement))
          break;
      }
    } else {
      visit(body);
    }
    return hasCall && !skips;
  };

  // Only descend into plain, enabled suite callbacks. Skipped, focused and
  // conditional suites cannot provide unconditional verification evidence.
  const search = (statements) =>
    statements.some((statement) => {
      if (!ts.isExpressionStatement(statement)) return false;
      const call = statement.expression;
      if (!ts.isCallExpression(call) || !ts.isIdentifier(call.expression))
        return false;
      const [title, callback] = call.arguments;
      if (
        !callback ||
        (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback))
      )
        return false;

      if (call.expression.text === "describe" && ts.isBlock(callback.body)) {
        return search(callback.body.statements);
      }
      return (
        ["it", "test"].includes(call.expression.text) &&
        title &&
        ts.isStringLiteralLike(title) &&
        title.text === name &&
        hasTestWork(callback.body)
      );
    });

  return search(file.statements);
}

function nativeBodyHasTestWork(path, source, bodyStart, disabledScopes) {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    ts.LanguageVariant.Standard,
    source,
  );
  const {
    EndOfFileToken,
    Identifier,
    OpenBraceToken,
    CloseBraceToken,
    OpenParenToken,
    DotToken,
    CloseParenToken,
    EqualsToken,
    EqualsGreaterThanToken,
    SemicolonToken,
  } = ts.SyntaxKind;
  const parents = [];
  let token = scanner.scan();
  while (token !== EndOfFileToken && scanner.getTokenPos() < bodyStart) {
    if (token === OpenBraceToken)
      parents.push(disabledScopes.has(scanner.getTokenPos()));
    if (token === CloseBraceToken) parents.pop();
    token = scanner.scan();
  }
  if (
    token !== OpenBraceToken ||
    scanner.getTokenPos() !== bodyStart ||
    parents.includes(true)
  )
    return false;

  const activeBlocks = [true];
  const isCSharp = path.endsWith(".cs");
  let hasCall = false;
  let previous;
  let previousText;
  let beforeIdentifier;
  let identifier;
  let qualifier;
  let inExpressionBody = false;
  let localFunction = false;
  for (
    token = scanner.scan();
    token !== EndOfFileToken;
    token = scanner.scan()
  ) {
    if (token === OpenBraceToken) {
      activeBlocks.push(
        activeBlocks.at(-1) &&
          !localFunction &&
          previous !== EqualsToken &&
          previous !== EqualsGreaterThanToken,
      );
      localFunction = false;
    }
    if (token === CloseBraceToken) {
      activeBlocks.pop();
      if (!activeBlocks.length) return hasCall;
    }
    if (token === EqualsGreaterThanToken) inExpressionBody = true;
    if (token === SemicolonToken) {
      inExpressionBody = false;
      localFunction = false;
    }
    const tokenText = scanner.getTokenText();
    if (isCSharp && tokenText === "delegate") localFunction = true;
    if (token === Identifier) {
      beforeIdentifier = previousText;
      qualifier = previous === DotToken ? identifier : undefined;
      identifier = tokenText;
    }
    if (token === OpenParenToken && previous === Identifier) {
      if (
        /^(?:XCTSkip(?:If|Unless)?|Ignore|Skip|assum(?:e|ing)\w+)$/.test(
          identifier,
        ) ||
        qualifier === "Assume" ||
        qualifier === "Assumptions" ||
        (qualifier === "Assert" && identifier === "Inconclusive")
      )
        return false;
      if (
        !hasCall &&
        activeBlocks.at(-1) &&
        !inExpressionBody &&
        !localFunction
      ) {
        const control = /^(?:foreach|lock|fixed|when)$/.test(identifier);
        localFunction =
          beforeIdentifier === "func" || beforeIdentifier === "fun";
        if (!localFunction && isCSharp && !qualifier && !control) {
          // A C# declaration has a block or expression body after its parameters.
          localFunction = scanner.lookAhead(() => {
            let parens = 1;
            while (parens) {
              const next = scanner.scan();
              if (next === EndOfFileToken) return false;
              if (next === OpenParenToken) parens++;
              if (next === CloseParenToken) parens--;
            }
            const next = scanner.scan();
            return next === OpenBraceToken || next === EqualsGreaterThanToken;
          });
        }
        hasCall = !localFunction && !control;
      }
    }
    previous = token;
    previousText = tokenText;
  }
  return false;
}

function hasNativeTest(path, source, name) {
  const quoted = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const annotation = "@[\\w.]+(?:\\([^\\r\\n)]*\\))?|\\[[^\\]\\r\\n]+\\]";
  const gap = "(?:[ \\t\\r\\n]|//[^\\r\\n]*|/\\*[\\s\\S]*?\\*/)+";
  const modifiers = `(?:(?:${annotation}|public|private|internal|protected|fileprivate|final|open|override|virtual|sealed|static|async|unsafe|partial|abstract)${gap})*`;
  const method = `(?:func|fun|void|Task|ValueTask)[ \\t]+(?:${quoted}|\\x60${quoted}\\x60)[ \\t]*\\([^{};]*\\{`;
  const declaration = new RegExp(`^[ \\t]*${modifiers}${method}`, "m").exec(
    source,
  );
  if (!declaration) return false;
  const [signature] = declaration;
  const disabled =
    /@(?:[\w.]+\.)?(?:Disabled|Ignore)\b|\[\s*(?:[\w.]+\.)?Ignore\b|\bSkip\s*=/;
  if (disabled.test(signature)) return false;
  if (path.endsWith(".swift") && /\bstatic\b/.test(signature)) return false;

  const types = new RegExp(
    `^[ \\t]*${modifiers}(?:class|object|struct|actor)\\b[^{};]*\\{`,
    "gm",
  );
  const disabledScopes = new Set(
    [...source.matchAll(types)]
      .filter(([signature]) => disabled.test(signature))
      .map(({ 0: signature, index }) => index + signature.length - 1),
  );
  return nativeBodyHasTestWork(
    path,
    source,
    declaration.index + signature.length - 1,
    disabledScopes,
  );
}

function verifyApprovedScope(details, files, readTest, surfaceChanged) {
  approvalFields(details, "Design");
  approvalFields(details, "Acceptance");
  const approvedPaths = approvalFields(details, "Contract");
  const authored = files.filter(
    (file) =>
      surfaceChanged.includes(file) ||
      publicContractPaths.some((pattern) => pattern.test(file)),
  );
  const source = authored.filter((file) => !/\/generated\//.test(file));
  const required = source.length ? source : authored;
  if (
    approvedPaths.some((path) => !files.includes(path)) ||
    required.some((path) => !approvedPaths.includes(path))
  ) {
    throw new Error(
      "The approved Contract: paths must cover the changed public sources.",
    );
  }

  for (const value of approvalFields(details, "Verification")) {
    const [, path, test] = /^([\w./-]+)#(.+)$/.exec(value) ?? [];
    if (
      !path ||
      path.split("/").some((part) => !part || part === "." || part === "..") ||
      !/(?:^|\/)(?:__tests__|[Tt]ests?)\/|\.(?:test|spec)\.[^/]+$|Tests?\.(?:swift|kt|cs)$/.test(
        path,
      )
    ) {
      throw new Error(
        "Verification: must use a repository test path followed by # and its test name.",
      );
    }
    const source = readTest(path);
    const runnable =
      source &&
      (/\.(?:swift|kt|cs)$/.test(path)
        ? hasNativeTest(path, source, test)
        : hasJavaScriptTest(path, source, test));
    if (!runnable) {
      throw new Error(
        `Approved verification test was not found or is empty or disabled: ${value}`,
      );
    }
    // A test no required CI job runs cannot show its result.
    testRunnerFor(path, source);
  }
}

/**
 * An approval covers one change. The first PR merged from its branch after it
 * used it up, whatever that PR's body links now (a body can be edited after
 * the merge), and so did any merged PR that links it, so a recreated branch
 * cannot ship a second change on the same comment.
 */
export function assertApprovalUnused(link, pull, comment, merged) {
  const repository = pull.base.repo.full_name;
  const linked = (body) => {
    try {
      return approvalLink(body, repository).url;
    } catch {
      return undefined;
    }
  };
  const used = merged.find(
    (other) =>
      other.number !== pull.number &&
      Date.parse(other.merged_at) > Date.parse(comment.created_at) &&
      (other.head.label === pull.head.label || linked(other.body) === link.url),
  );
  if (used) {
    throw new Error(
      `Design approval ${link.url} was already used by merged PR #${used.number}; record a new approval for this change.`,
    );
  }
}

export function verifyDesignApproval({
  pull,
  link,
  comment,
  commits,
  files,
  readTest,
  surfaceChanged = [],
  gateChanged = [],
}) {
  if (comment.html_url !== link.url || comment.user?.id !== projectLeadId) {
    throw new Error(
      "The linked issue comment must be written by the project lead.",
    );
  }
  const [decision, ...details] = (comment.body ?? "").trim().split(/\r?\n/);
  const branch = `${pull.head.repo.full_name}:${pull.head.ref}`;
  const target = `${pull.base.repo.full_name}:${pull.base.ref}`;
  const scope = `${branch} into ${target}`;
  if (
    decision !== `Approved public contract design for ${scope}` ||
    !details.join("\n").trim()
  ) {
    throw new Error(
      `Approval must name ${scope} and record the concrete design decision.`,
    );
  }
  verifyApprovedScope(details, files, readTest, surfaceChanged);
  if (gateChanged.length) {
    throw new Error(
      `Change the approval CI in a separate PR, not with an approved contract change: ${gateChanged.join(", ")}`,
    );
  }
  const approvedAt = Date.parse(comment.created_at);
  if (
    !Number.isFinite(approvedAt) ||
    approvedAt !== Date.parse(comment.updated_at)
  ) {
    throw new Error(
      "Link an unedited approval comment so its original timestamp is verifiable.",
    );
  }
  if (
    !commits.length ||
    commits.length !== pull.commits ||
    !commits.some(({ sha }) => sha === pull.head.sha)
  ) {
    throw new Error(
      "Could not verify the complete commit list for this PR head.",
    );
  }
  const dates = [
    pull.created_at,
    ...commits.flatMap(({ commit }) => [
      commit?.author?.date,
      commit?.committer?.date,
    ]),
  ];
  if (!dates.every((date) => Date.parse(date) > approvedAt)) {
    throw new Error(
      "The design approval must predate the PR and every implementation commit (author and committer dates).",
    );
  }
}

function main() {
  const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8"));
  const repo = event.repository.full_name;
  const number = event.pull_request.number;
  // The 1 MiB default fails on a long PR list and reads a large source as
  // missing.
  const output = { encoding: "utf8", maxBuffer: 2 ** 28 };
  const api = (...args) =>
    JSON.parse(execFileSync("gh", ["api", ...args], output));
  const git = (args, options) =>
    execFileSync("git", args, { ...output, ...options });
  const pullPath = `repos/${repo}/pulls/${number}`;
  const pull = api(pullPath);
  const { base, head } = event.pull_request;
  if (pull.head.sha !== head.sha) {
    throw new Error("The PR head moved; the run for the newer head checks it.");
  }
  // design-approval.yml checks out main and fetches the PR head as data. Diff
  // from the merge base, as the PR's file list does.
  const mergeBase = git(["merge-base", base.sha, head.sha]).trim();
  const files = git([
    "diff",
    "--name-only",
    "--no-renames",
    "-z",
    mergeBase,
    head.sha,
  ])
    .split("\0")
    .filter(Boolean);
  const read = (side, path) => {
    try {
      return git(
        ["show", `${side === "base" ? mergeBase : head.sha}:${path}`],
        {
          stdio: ["ignore", "pipe", "ignore"],
        },
      );
    } catch {
      return undefined;
    }
  };
  // design-approval.yml installs the SDK dependencies from main's lockfiles.
  const surfaceChanged = publicSurfaceChanges(files, read, {
    requireDependencies: true,
  });
  if (!needsDesignApproval(files, pull.body, surfaceChanged)) {
    console.log(
      "No authored contract changes or declared public contract change.",
    );
    return;
  }

  const link = approvalLink(pull.body, repo);
  const comment = api(`repos/${repo}/issues/comments/${link.comment}`);
  // The branch filter misses PRs from deleted forks; the proposal issue's
  // cross-references still list them.
  const referencing = api(
    `repos/${repo}/issues/${link.issue}/timeline?per_page=100`,
    "--paginate",
    "--slurp",
  )
    .flat()
    .filter(
      ({ event, source }) =>
        event === "cross-referenced" &&
        source?.issue?.repository?.full_name === repo &&
        source.issue.pull_request?.merged_at,
    )
    .map(({ source }) => api(`repos/${repo}/pulls/${source.issue.number}`));
  assertApprovalUnused(link, pull, comment, [
    ...api(
      "-X",
      "GET",
      `repos/${repo}/pulls`,
      "-f",
      "state=closed",
      "-f",
      `head=${pull.head.label}`,
      "-f",
      "per_page=100",
      "--paginate",
      "--slurp",
    ).flat(),
    ...referencing,
  ]);
  const commits = api(
    `${pullPath}/commits?per_page=100`,
    "--paginate",
    "--slurp",
  ).flat();
  verifyDesignApproval({
    pull,
    link,
    comment,
    commits,
    files,
    readTest: (path) => read("head", path),
    surfaceChanged,
    gateChanged: approvalGateChanges(files, read),
  });
  console.log(`Design approval verified for PR #${number}: ${link.url}`);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
