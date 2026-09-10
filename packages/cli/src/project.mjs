import {
  lstatSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
} from "node:fs";
import path from "node:path";

/** Paths this run could not read; `doctor` turns the set into findings. */
export const unreadable = new Set();

export function hasUnreadablePath(relative) {
  return [...unreadable].some(
    (file) =>
      file === relative ||
      file.startsWith(`${relative}/`) ||
      file.startsWith(`${relative}${path.sep}`),
  );
}

function isAbsent(file) {
  try {
    let ancestor = file;
    while (!lstatSync(ancestor, { throwIfNoEntry: false })) {
      const parent = path.dirname(ancestor);
      if (parent === ancestor) return true;
      ancestor = parent;
    }
    return ancestor !== file && statSync(ancestor).isDirectory();
  } catch {
    return false;
  }
}

/** Reading a file has three outcomes, not two. */
function readState(root, relative) {
  const file = path.join(root, relative);
  try {
    if (isAbsent(file)) return { state: "absent" };
    // A FIFO blocks readFileSync until someone writes; a directory is not a
    // config file. Neither is absent, so neither may be read as one.
    if (!statSync(file).isFile()) return { state: "unreadable" };
    return { state: "read", text: readFileSync(file, "utf8") };
  } catch {
    return { state: "unreadable" };
  }
}

/** Read a file, or null when it is absent or unreadable. */
export function read(root, relative) {
  const result = readState(root, relative);
  if (result.state === "unreadable") unreadable.add(relative);
  return result.state === "read" ? result.text : null;
}

/** Read the first of these files that exists, with the path that supplied it. */
export function readFirst(root, relatives) {
  for (const relative of relatives) {
    const text = read(root, relative);
    if (text !== null) return { file: relative, text };
  }
  return null;
}

/** Directory entry names, or an empty list when the directory is absent. */
export function listDir(root, relative) {
  const dir = path.join(root, relative);
  try {
    return readdirSync(dir);
  } catch {
    // A directory that exists but cannot be listed is not an empty one.
    if (!isAbsent(dir)) {
      unreadable.add(relative === "." ? "." : relative);
    }
    return [];
  }
}

export function isDirectory(root, relative) {
  const file = path.join(root, relative);
  try {
    return statSync(file).isDirectory();
  } catch {
    if (!isAbsent(file)) unreadable.add(relative);
    return false;
  }
}

const GENERATED_DIRS = new Set([
  "Pods",
  "build",
  "DerivedData",
  "node_modules",
  ".git",
]);

/** A directory holding generated or vendored files rather than the app's own. */
export function isGeneratedDir(entry) {
  return GENERATED_DIRS.has(entry) || entry.endsWith(".xcodeproj");
}

/** Every file under `relative` matching `pattern`, generated artifacts aside. */
export function walkFiles(root, relative, pattern) {
  const found = [];
  const pending = [relative];
  const visited = new Set();
  while (pending.length) {
    const directory = pending.pop();
    const entries = listDir(root, directory);
    if (entries.length === 0) continue;
    let canonical;
    try {
      canonical = realpathSync(path.join(root, directory));
    } catch {
      unreadable.add(directory);
      continue;
    }
    if (visited.has(canonical)) continue;
    visited.add(canonical);
    for (const entry of entries) {
      if (isGeneratedDir(entry)) continue;
      const child = path.join(directory, entry);
      if (isDirectory(root, child)) pending.push(child);
      else if (pattern.test(entry)) found.push(child);
    }
  }
  return found;
}

/**
 * Assignments the way dotenv reads them. This is dotenv 16's own line pattern:
 * `:` separates as well as `=`, names may hold `.` and `-`, and a value may be
 * quoted with `'`, `"` or a backtick and span lines.
 */
const DOTENV_LINE =
  /(?:^|^)[^\S\r\n]*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/gm;

export function parseEnv(text) {
  const source = text.replace(/^\uFEFF/, "").replace(/\r\n?/gm, "\n");
  const entries = [];
  for (const match of source.matchAll(DOTENV_LINE)) {
    let value = (match[2] ?? "").trim();
    const quote = value[0];
    if (quote === '"' || quote === "'" || quote === "`") {
      value = value.slice(1, -1);
      if (quote === '"')
        value = value.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
    }
    entries.push({
      name: match[1],
      value,
      line: source.slice(0, match.index).split("\n").length,
    });
  }
  return entries;
}

/** The assignment dotenv applies for a name: the last one wins. */
export function envValue(entries, name) {
  return entries.filter((one) => one.name === name).pop();
}

/**
 * `java.util.Properties`: leading whitespace, `#` and `!` comments, `=`, `:`
 * or plain whitespace as the separator, and a trailing `\\` continuing the
 * value onto the next line.
 */
export function parseProperties(text) {
  const found = new Map();
  const lines = text.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const number = index + 1;
    let line = lines[index].trim();
    if (!line || line.startsWith("#") || line.startsWith("!")) continue;
    while (
      (line.match(/\\+$/)?.[0].length ?? 0) % 2 === 1 &&
      index + 1 < lines.length
    ) {
      index += 1;
      line = line.slice(0, -1) + lines[index].trim();
    }
    const match = line.match(/^([^\s=:]+)(?:[ \t]*[=:][ \t]*|[ \t]+)(.*)$/);
    if (match) found.set(match[1], { value: match[2].trim(), line: number });
  }
  return found;
}

/**
 * A line that opens a comment in any of the files this reads. Deciding this
 * per line keeps a mistake to one row: classifying a whole file needs a real
 * lexer for JavaScript, Groovy and Swift, and every version of that erased the
 * remainder of a file when it met a construct it did not know.
 */
export const COMMENT_LINE = /^[ \t]*(?:\/\/|#|\*|<!--|--)/;

/**
 * Whether `index` on `line` sits inside a quoted run. Counting each mark
 * separately called an apostrophe inside a double-quoted string the start of a
 * string, so one left-to-right pass tracks which mark actually opened.
 */
export function quoted(line, index) {
  let open = null;
  for (let at = 0; at < index; at += 1) {
    const char = line[at];
    if (char === "\\") {
      at += 1;
      continue;
    }
    if (open === "`" && char === "$" && line[at + 1] === "{") {
      // Interpolation is code, however deeply the braces nest.
      let depth = 1;
      at += 2;
      while (at < index && depth > 0) {
        if (line[at] === "{") depth += 1;
        else if (line[at] === "}") depth -= 1;
        at += 1;
      }
      // Still open means `index` is inside the interpolation, which is code.
      if (depth > 0) return false;
      at -= 1;
      continue;
    }
    if (open) {
      if (char === open) open = null;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") open = char;
  }
  return open !== null;
}

/**
 * The code on each line of `text`, with its 1-based number. A whole-line
 * comment is dropped and a trailing one is cut off; `//` after a colon is a
 * URL, not a comment.
 */
export function codeLines(text) {
  const found = [];
  let inBlock = false;
  text.split(/\r?\n/).forEach((raw, index) => {
    // Only a `/*` that opens its line starts a block: mid-line the same two
    // characters are a glob, a regex or a path, and treating them as a comment
    // erased the rest of the file.
    const opens = !inBlock && /^[ \t]*\/\*/.test(raw);
    if (opens) inBlock = true;
    const closed = inBlock && raw.includes("*/");
    if (inBlock) {
      inBlock = !closed;
      return;
    }
    const line = raw.split(/(?<!:)\/\//)[0];
    if (line.trim() !== "" && !COMMENT_LINE.test(line)) {
      found.push({ line, number: index + 1 });
    }
  });
  return found;
}

function packageJson(root) {
  const raw = read(root, "package.json");
  if (raw === null) return { state: "absent" };
  try {
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, ""));
    return parsed && typeof parsed === "object"
      ? { state: "read", value: parsed }
      : { state: "malformed" };
  } catch {
    return { state: "malformed" };
  }
}

/** Everything package.json declares, dependencies and devDependencies alike. */
export function dependencies(root) {
  const pkg = packageJson(root);
  if (pkg.state !== "read") return {};
  const { dependencies: deps, devDependencies: dev } = pkg.value;
  return {
    ...(deps && typeof deps === "object" ? deps : {}),
    ...(dev && typeof dev === "object" ? dev : {}),
  };
}

/** Whether package.json exists but could not be parsed. */
export function manifestIsMalformed(root) {
  return packageJson(root).state === "malformed";
}

/**
 * Which framework builds the app -- not which OpenIAP package is declared. A
 * monorepo or a lockfile alias can supply the library without naming it in
 * package.json, and every framework-specific check here is about the build
 * anyway: Expo is what inlines `EXPO_PUBLIC_` names, so it wins over bare
 * React Native even when the project installs `react-native-iap`.
 */
export function detectFramework(root) {
  const deps = dependencies(root);
  if (deps.expo || deps["expo-iap"]) return "expo";
  if (deps["react-native"] || deps["react-native-iap"]) return "react-native";
  const pubspec = read(root, "pubspec.yaml");
  if (pubspec && /^\s*(flutter_inapp_purchase|flutter)\s*:/m.test(pubspec)) {
    return "flutter";
  }
  if (declaresKmpIap(root)) return "kmp";
  return "unknown";
}

/**
 * A KMP app names the dependency in the version catalog or straight in the
 * module that applies it, and that module is a directory the app names
 * (`composeApp/`, `shared/`), so look one level down rather than guessing.
 */
function declaresKmpIap(root) {
  if (read(root, "gradle/libs.versions.toml")?.includes("kmp-iap")) return true;
  for (const entry of listDir(root, ".")) {
    if (entry.startsWith(".") || isGeneratedDir(entry)) continue;
    if (!isDirectory(root, entry)) continue;
    if (read(root, path.join(entry, "build.gradle.kts"))?.includes("kmp-iap")) {
      return true;
    }
  }
  return false;
}

/** An env file a build reads. Example files are templates, not configuration. */
const ENV_FILE = /^\.env(\..+)?$/;
const ENV_TEMPLATE = /\.(example|sample|template)$/;
/** What Flutter's `dotenv` is pointed at: `env`, `env.prod`, `.env.ci`. */
const FLUTTER_ENV = /(^|\.)env(\..+)?$/;

/** Files whose whole contents are compiled into the app bundle. */
export const BUNDLED_FILES = [
  // Expo resolves these in this order, so a key in the first one is the one
  // that ships even when a later file also exists.
  "app.config.ts",
  "app.config.mts",
  "app.config.cts",
  "app.config.js",
  "app.config.mjs",
  "app.config.cjs",
  "app.config.json",
  "app.json",
];

/** The asset paths a Flutter project declares, which ship verbatim. */
export function pubspecAssets(root) {
  const pubspec = read(root, "pubspec.yaml");
  if (!pubspec) return [];
  return [...pubspec.matchAll(/^\s*-\s*([^\s#]+)\s*$/gm)]
    .map((one) => one[1])
    .filter((one) => !one.endsWith("/"));
}

/**
 * Client-visible files: anything shipped in the app bundle or read by the
 * bundler. A Flutter project names its env file in pubspec, and this
 * repository's own example calls it `env.example`, so the name shape alone
 * cannot decide which files exist.
 */
export function clientFiles(root) {
  const names = listDir(root, ".");
  const envFiles = names
    .filter((one) => ENV_FILE.test(one) && !ENV_TEMPLATE.test(one))
    .sort();
  const declared = pubspecAssets(root).filter(
    (one) =>
      FLUTTER_ENV.test(path.basename(one)) &&
      readState(root, one).state !== "absent",
  );
  // A listed name that will not resolve is unreadable; one pubspec declares
  // but never shipped is a Flutter build problem, not this tool's.
  for (const file of [...envFiles, ...declared]) {
    if (readState(root, file).state === "absent") unreadable.add(file);
  }
  return [
    ...new Set([
      ...envFiles,
      ...declared,
      ...(read(root, "eas.json") === null ? [] : ["eas.json"]),
      ...BUNDLED_FILES.filter((one) => read(root, one) !== null),
    ]),
  ];
}

export function isEnvFile(file) {
  return FLUTTER_ENV.test(path.basename(file)) && !BUNDLED_FILES.includes(file);
}
