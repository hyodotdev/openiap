import {
  clientFiles,
  dependencies,
  detectFramework,
  hasUnreadablePath,
  isEnvFile,
  isDirectory,
  isGeneratedDir,
  listDir,
  manifestIsMalformed,
  read,
  unreadable,
} from "./project.mjs";
export { FINDING_IDS } from "./findings.mjs";
import { finding } from "./findings.mjs";

import {
  DOTENV_PACKAGES,
  androidStoreChecks,
  baseUrlChecks,
  envNameChecks,
  iosSceneChecks,
  secretKeyChecks,
} from "./checks.mjs";

/**
 * Everything here reads the checkout and nothing else. A device, a store
 * account, and the network can each break an integration in ways no file
 * records, so those are reported as unchecked rather than guessed at.
 */
const NOT_CHECKED_LOCALLY = [
  "Store account state: agreements, product status, and license testers.",
  "Device state: a scene session or an installed build left by another app that shares the bundle id.",
  "Play billing availability on the device and its signed-in account.",
];

/** What this run did not look at, so "no problems found" is not read as more. */
function skippedChecks(root, framework) {
  const skipped = [];
  const androidFiles = listDir(root, "android");
  const hasAndroid =
    androidFiles.includes("gradle.properties") ||
    listDir(root, "android/app").some((one) =>
      ["build.gradle", "build.gradle.kts"].includes(one),
    );
  if (
    !hasAndroid &&
    !unreadable.has("android") &&
    !unreadable.has("android/app")
  ) {
    skipped.push("Android store flavor: no android/ project was found here.");
  }

  const iosDirs = listDir(root, "ios").filter((one) =>
    !isGeneratedDir(one) && isDirectory(root, `ios/${one}`),
  );
  const iosPlists = [
    "ios/Info.plist",
    ...iosDirs.map((one) => `ios/${one}/Info.plist`),
  ];
  const iosPlist = iosPlists.some((file) => read(root, file) !== null);
  if (framework !== "expo" && framework !== "react-native") {
    skipped.push(`iOS scene delegate: not checked for ${framework} projects.`);
  } else if (!iosPlist && !hasUnreadablePath("ios")) {
    skipped.push("iOS scene delegate: no ios/ Info.plist was found here.");
  }

  // The unexpected-prefix half runs for every framework except `unknown`.
  const deps = dependencies(root);
  if (DOTENV_PACKAGES.some((one) => deps[one])) {
    skipped.push(
      "Env variable names: a dotenv transform is installed, so neither prefix rule applies.",
    );
  } else if (framework === "unknown") {
    skipped.push(
      "Env variable names: no framework was detected, so neither prefix rule applies.",
    );
  }

  const files = clientFiles(root);
  if (files.length === 0) {
    skipped.push(
      "Keys and base URL: no env file or app config was found here.",
    );
  } else if (!files.some((one) => isEnvFile(one))) {
    skipped.push(
      "Base URL: only env files are read for it, and there is none here.",
    );
  }
  // Saying which files are read is the only way "no problems" is not read as a
  // verdict on the ones that are not.
  skipped.push(
    "Application source: keys are looked for in env files, app.config, app.json and eas.json only.",
  );
  return skipped;
}

function summarize(framework, findings, skipped = []) {
  const errors = findings.filter((one) => one.level === "error").length;
  return {
    framework,
    findings,
    errors,
    warnings: findings.length - errors,
    notCheckedLocally: [...NOT_CHECKED_LOCALLY, ...skipped],
  };
}

export function doctor(root) {
  // Reporting a path it never read as clean is the one answer this must never
  // give, so a missing or unreadable project is a finding, not silence.
  if (!isDirectory(root, ".")) {
    return summarize("unknown", [
      finding(
        "project-not-a-directory",
        "error",
        root,
        "This path is not a directory that could be read.",
        "Pass the root of the app you want checked.",
      ),
    ]);
  }

  unreadable.clear();
  const framework = detectFramework(root);
  const findings = [];
  if (manifestIsMalformed(root)) {
    // Framework detection reads this file, so every check below it is
    // degraded. Saying so beats reporting the leftovers as a clean bill.
    findings.push(
      finding(
        "project-manifest-unreadable",
        "error",
        "package.json",
        "package.json exists but is not valid JSON, so nothing could be read from it.",
        "Fix the JSON; framework detection and its checks depend on it.",
      ),
    );
  }
  findings.push(
    ...androidStoreChecks(root),
    ...secretKeyChecks(root, framework),
    ...envNameChecks(root, framework),
    ...baseUrlChecks(root, framework),
    ...iosSceneChecks(root, framework),
  );
  // Compute this first: it is the only reader of some directories, and their
  // misses have to reach the drain below.
  const skipped = skippedChecks(root, framework);
  for (const file of [...unreadable].sort()) {
    findings.push(
      finding(
        "project-file-unreadable",
        "error",
        file,
        `This path could not be read, so nothing in it was checked: ${file}`,
        "Fix its permissions or its type; a socket, a FIFO and a dangling symlink are not readable.",
      ),
    );
  }
  return summarize(framework, findings, skipped);
}

export function formatText(result) {
  const lines = [`Framework: ${result.framework}`];
  if (result.findings.length === 0) {
    lines.push("", "No problems found in this checkout.");
  } else {
    lines.push("");
    for (const one of result.findings) {
      const where = one.line ? `${one.file}:${one.line}` : one.file;
      lines.push(`${one.level === "error" ? "error" : "warn "}  ${where}`);
      lines.push(`       ${one.message}`);
      lines.push(`       ${one.fix}`);
      lines.push(`       [${one.id}]`);
      lines.push("");
    }
    lines.push(`${result.errors} error(s), ${result.warnings} warning(s).`);
  }
  lines.push("", "Not checked locally:");
  for (const item of result.notCheckedLocally) lines.push(`  - ${item}`);
  return lines.join("\n");
}
