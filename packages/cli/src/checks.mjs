import {
  BUNDLED_FILES,
  clientFiles,
  dependencies,
  envValue,
  hasUnreadablePath,
  isDirectory,
  isEnvFile,
  listDir,
  parseEnv,
  parseProperties,
  read,
  readFirst,
  codeLines,
  isGeneratedDir,
  pubspecAssets,
  quoted,
  walkFiles,
} from "./project.mjs";
import { finding } from "./findings.mjs";

function withoutXmlComments(text) {
  return text.replace(/<!--[\s\S]*?-->/g, (comment) =>
    comment.replace(/[^\r\n]/g, " "),
  );
}

/** A value read from a project file is data, never a line of this report. */
function oneLine(value) {
  return (
    value
      // Escapes and bidi overrides can repaint a line they did not write.
      .replace(
        /[\u0000-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g,
        "",
      )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60)
  );
}

/** A plist can name anything, and that name is spliced into a RegExp. */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function lineAt(text, index) {
  return text.slice(0, index).split("\n").length;
}

/**
 * The store a build links. The second argument is a literal in a generated
 * project and a variable in a hand-written one, and a variable names a store
 * only Gradle can resolve.
 */
const PLATFORM_STRATEGY =
  /^[ \t]*missingDimensionStrategy[\s(]{0,4}["']platform["'][\s,]{0,8}(?:["'](\w+)["']|(\w+))/;

const APP_BUILD_FILES = [
  "android/app/build.gradle",
  "android/app/build.gradle.kts",
];

/**
 * A generated Android project is written in one pass, so its store flag and
 * its flavor literal always agree when they are fresh. A disagreement means a
 * half-finished regeneration, and the app links a store the device may not run.
 */
export function androidStoreChecks(root) {
  const propertiesText = read(root, "android/gradle.properties");
  const app = readFirst(root, APP_BUILD_FILES);
  // Either file alone still proves which store the build links.
  if (propertiesText === null && !app) return [];

  const properties = propertiesText ? parseProperties(propertiesText) : null;
  // OpenIAP Gradle scripts read these properties with Groovy toBoolean().
  const enabled = (name) =>
    ["true", "1", "y"].includes(
      properties?.get(name)?.value.trim().toLowerCase(),
    );
  const horizon = enabled("horizonEnabled");
  const fireOs = enabled("fireOsEnabled");
  const findings = [];

  if (horizon && fireOs) {
    findings.push(
      finding(
        "android-store-flavor-conflict",
        "error",
        "android/gradle.properties",
        "horizonEnabled and fireOsEnabled are both true.",
        "Leave one store enabled and regenerate the Android project.",
        { line: properties.get("horizonEnabled")?.line },
      ),
    );
  }

  // Gradle comments hold disabled configuration; reading them reports fiction.
  const strategies = app
    ? codeLines(app.text)
        .map((one) => ({ ...one, match: PLATFORM_STRATEGY.exec(one.line) }))
        .filter((one) => one.match)
    : [];
  const stores = [
    ...new Set(strategies.map((one) => one.match[1]).filter(Boolean)),
  ];
  // A variable second argument names a store this cannot resolve.
  const computed = strategies.some((one) => !one.match[1]);
  // Play billing works if any flavor links Play, so only a build that links no
  // Play flavor at all is worth reporting.
  const linksNonPlay = stores.includes("play")
    ? undefined
    : stores.find((one) => one !== "play");
  // Build types may legitimately link different stores, so a mismatch is not
  // about how many are declared: it is that none of them is the one the flags
  // selected, which only a half-finished regeneration produces.
  const selects = properties
    ? fireOs
      ? "amazon"
      : horizon
        ? "horizon"
        : "play"
    : null;
  // A computed flavor may well resolve to the selected store, so a mismatch is
  // only provable when every strategy names a store and none of them is it.
  const missing =
    selects !== null &&
    !computed &&
    stores.length > 0 &&
    !stores.includes(selects);
  const declared = stores.length === 1 && !computed ? stores[0] : null;
  const line = strategies[0]?.number;

  // With both flags true `selected` is this tool's own tiebreak, not something
  // gradle.properties states, and the conflict finding already covers it.
  if (missing && !(horizon && fireOs)) {
    findings.push(
      finding(
        "android-store-flavor-mismatch",
        "error",
        app.file,
        `The project links ${stores.join(" and ")} while gradle.properties selects ${selects}.`,
        "Regenerate the Android project so both come from one run.",
        { line, expected: selects, actual: stores.join(",") },
      ),
    );
  }

  const store = linksNonPlay ?? declared ?? selects;
  if (store && store !== "play") {
    const evidence =
      declared || linksNonPlay ? app.file : "android/gradle.properties";
    const enabledFlag = fireOs ? "fireOsEnabled" : "horizonEnabled";
    findings.push(
      finding(
        "android-store-not-play",
        "warning",
        evidence,
        computed && !linksNonPlay
          ? `gradle.properties selects the ${store} store, and the build computes its flavor from it.`
          : `This Android project is built for the ${store} store.`,
        `Google Play billing will not connect from this build. Regenerate without the ${store} flags before testing on a Play device.`,
        {
          line: linksNonPlay
            ? strategies.find((one) => one.match[1] === linksNonPlay)?.number
            : properties?.get(enabledFlag)?.line,
          actual: store,
        },
      ),
    );
  }

  if (store === "horizon") findings.push(...horizonAppIdCheck(root));
  return findings;
}

/**
 * Every flavor's manifest, not just `main`: an app can declare the id in the
 * Horizon source set alone. Gradle can also inject it through a placeholder,
 * which no manifest records -- so this reports a suspicion, never a verdict.
 */
function horizonAppIdCheck(root) {
  // A test source set merges into the test APK, never the app, so an id
  // declared only there proves nothing about what ships.
  const shipped = listDir(root, "android/app/src").filter(
    (one) => !/^(androidTest|test)/.test(one),
  );
  const manifests = shipped
    .map((one) => `android/app/src/${one}/AndroidManifest.xml`)
    .map((file) => ({ file, text: read(root, file) }))
    .filter(({ text }) => text !== null);
  if (manifests.length === 0) return [];
  const declares = ({ text }) =>
    // An XML comment holds disabled configuration, the same as a Gradle one.
    withoutXmlComments(text).includes(
      "com.meta.horizon.platform.HORIZON_APP_ID",
    );
  if (manifests.some(declares)) return [];
  // Point at the manifest the id belongs in, not whichever the disk listed.
  const preferred =
    manifests.find(({ file }) => file.includes("/horizon/")) ??
    manifests.find(({ file }) => file.includes("/main/")) ??
    manifests[0];
  return [
    finding(
      "android-horizon-app-id-missing",
      "warning",
      preferred.file,
      "The Horizon store is selected but no shipped manifest declares HORIZON_APP_ID.",
      "Set the Horizon app id in your OpenIAP plugin configuration and regenerate, unless Gradle injects it as a manifest placeholder.",
    ),
  ];
}

/** A long tail is what separates a real key from prose naming the prefix. */
const SECRET_KEY = /openiap-kit_sk_[A-Za-z0-9]{16,}/;

/**
 * Whether a name assigned in an env file reaches the bundle: a dotenv
 * transform inlines the bare name, Expo's bundler inlines `EXPO_PUBLIC_`, and a
 * Flutter app shipping `.env` as an asset copies the file verbatim.
 */
function reachesBundle(root, framework, name, file) {
  const deps = dependencies(root);
  if (DOTENV_PACKAGES.some((one) => deps[one])) return true;
  // Only Expo's bundler inlines this prefix; elsewhere the name is read by
  // nothing, which is what `iapkit-env-unexpected-expo-prefix` reports.
  if (framework === "expo" && name.startsWith("EXPO_PUBLIC_")) return true;
  // Flutter copies the asset paths pubspec declares, and only those.
  return pubspecAssets(root).includes(file);
}

/** A secret key in a client file ships to every device that installs the app. */
export function secretKeyChecks(root, framework) {
  const findings = [];
  for (const file of clientFiles(root)) {
    const text = read(root, file);
    if (!text) continue;

    if (isEnvFile(file) || file === "eas.json") {
      let entries;
      if (file === "eas.json") {
        try {
          const config = JSON.parse(text);
          entries = Object.values(config.build ?? {}).flatMap((profile) =>
            ["ios", "android"].flatMap((platform) =>
              Object.entries({
                ...profile?.env,
                ...profile?.[platform]?.env,
              }).map(([name, value]) => ({ name, value })),
            ),
          );
          entries = [
            ...new Map(
              entries.map((entry) => [JSON.stringify(entry), entry]),
            ).values(),
          ];
        } catch {
          continue;
        }
      } else {
        entries = parseEnv(text);
        if (!pubspecAssets(root).includes(file)) {
          entries = entries.filter(
            (entry) => envValue(entries, entry.name) === entry,
          );
        }
      }
      // Parsed, so a key inside a comment is not reported as shipping.
      for (const entry of entries) {
        if (typeof entry.value !== "string" || !SECRET_KEY.test(entry.value))
          continue;
        // Expo inlines only EXPO_PUBLIC_ names, so a bare name can be the
        // server-side key an API route reads. Anywhere the bundle is not
        // proven, say so rather than demanding a rotation.
        const proven = reachesBundle(root, framework, entry.name, file);
        findings.push(
          proven
            ? finding(
                "iapkit-secret-key-in-client",
                "error",
                file,
                `An IAPKit secret key is assigned to ${entry.name}, which reaches the app bundle.`,
                "Move it to your server and use a publishable openiap-kit_pk_ key here. Rotate the exposed key.",
                { line: entry.line, actual: entry.name },
              )
            : finding(
                "iapkit-secret-key-in-env",
                "warning",
                file,
                `An IAPKit secret key is assigned to ${entry.name}. Nothing here proves it reaches the bundle.`,
                "Keep it off every EXPO_PUBLIC_ name and out of exported app configuration.",
                { line: entry.line, actual: entry.name },
              ),
        );
      }
      continue;
    }

    // A key on a comment line is not shipped; anywhere else in a bundled file
    // it is, whether or not it sits inside a string.
    const found = codeLines(text).find((one) => SECRET_KEY.test(one.line));
    if (!found) continue;
    findings.push(
      finding(
        "iapkit-secret-key-in-client",
        "error",
        file,
        "An IAPKit secret key is in a file the app bundle can read.",
        "Move it to your server and use a publishable openiap-kit_pk_ key here. Rotate the exposed key.",
        { line: found.number },
      ),
    );
  }
  return findings;
}

const IAPKIT_NAMES = [
  "IAPKIT_API_KEY",
  "IAPKIT_BASE_URL",
  "IAPKIT_PUBLISHABLE_KEY",
];

/**
 * Transforms that inline a bare name into the bundle. Plain `dotenv` is not
 * one: it is a Node library, and the app.config lane it serves is covered by
 * `readAtConfigTime` instead.
 */
export const DOTENV_PACKAGES = ["react-native-dotenv", "react-native-config"];

/** The ways an app.config can name an env variable, as one pattern each. */
function envReadPatterns(name) {
  // A dotenv name may hold `.` and `-`, which are regex syntax.
  const safe = escapeRegExp(name);
  return {
    // `delete` removes the value rather than reading it.
    dotted: new RegExp(`(?<!delete\\s{1,8})process\\.env\\??\\.${safe}\\b`),
    indexed: new RegExp(`process\\.env\\??\\[\\s*["'\`]${safe}["'\`]\\s*\\]`),
    // Prettier wraps a destructure over several lines once it is long enough.
    destructured: new RegExp(
      `\\{[^{}]*\\b${safe}\\b[^{}]*\\}\\s*=\\s*process\\.env\\b`,
      "s",
    ),
  };
}

/** Whether any bundled file names the variable at all. */
function readAtConfigTime(root, name) {
  const reads = envReadPatterns(name);
  return BUNDLED_FILES.some((file) => {
    const text = read(root, file);
    if (text === null) return false;
    const lines = codeLines(text);
    return (
      reads.destructured.test(lines.map((one) => one.line).join("\n")) ||
      lines.some((one) => {
        const match =
          reads.dotted.exec(one.line) ?? reads.indexed.exec(one.line);
        // A name inside a string on this line is prose, not a read.
        return Boolean(match) && !quoted(one.line, match.index);
      })
    );
  });
}

/**
 * Expo inlines only `EXPO_PUBLIC_`-prefixed variables into the bundle, so the
 * unprefixed name reads as undefined at runtime -- unless something else
 * supplies it, in which case the bare name is correct and demanding the prefix
 * would be wrong advice.
 */
export function envNameChecks(root, framework) {
  const deps = dependencies(root);
  if (DOTENV_PACKAGES.some((one) => deps[one])) return [];

  const findings = [];
  for (const file of clientFiles(root)) {
    if (!isEnvFile(file)) continue;
    const text = read(root, file);
    if (!text) continue;
    const entries = parseEnv(text);

    // A prefix on another variable says nothing about this one.
    for (const name of IAPKIT_NAMES) {
      const bare = envValue(entries, name);
      const prefixed = envValue(entries, `EXPO_PUBLIC_${name}`);
      if (framework === "expo" && bare && !prefixed) {
        if (SECRET_KEY.test(bare.value)) continue; // secretKeyChecks owns it
        if (readAtConfigTime(root, name)) continue;
        findings.push(
          finding(
            "iapkit-env-missing-expo-prefix",
            "warning",
            file,
            `Expo reads only EXPO_PUBLIC_-prefixed variables in app code, so ${name} is undefined at runtime.`,
            `Rename ${name} to EXPO_PUBLIC_${name}, or read it in app.config where Node resolves it.`,
            { line: bare.line, actual: name },
          ),
        );
      }
      if (framework !== "expo" && framework !== "unknown" && prefixed) {
        findings.push(
          finding(
            "iapkit-env-unexpected-expo-prefix",
            "warning",
            file,
            `EXPO_PUBLIC_${name} is set in a ${framework} project, where nothing inlines that prefix.`,
            `Rename it to ${name}, and check how this project reads env files.`,
            { line: prefixed.line, actual: `EXPO_PUBLIC_${name}` },
          ),
        );
      }
    }
  }
  return findings;
}

/**
 * The base URL is an origin. IAPKit appends the verification path itself, so a
 * URL that already carries one resolves to a route that does not exist.
 */
export function baseUrlChecks(root, framework) {
  const findings = [];
  for (const file of clientFiles(root)) {
    if (!isEnvFile(file)) continue;
    const text = read(root, file);
    if (!text) continue;
    const entries = parseEnv(text);
    for (const name of ["IAPKIT_BASE_URL", "EXPO_PUBLIC_IAPKIT_BASE_URL"]) {
      const entry = envValue(entries, name);
      if (!entry) continue;
      // A value on a name this project never inlines cannot break anything at
      // runtime, so its shape is a suspicion rather than a proven fault.
      const level = reachesBundle(root, framework, name, file)
        ? "error"
        : "warning";
      // An empty or interpolated value is filled at build time; nothing here
      // proves it wrong.
      if (entry.value === "" || /^\$|\$\{|\$\(/.test(entry.value)) continue;
      let url;
      try {
        url = new URL(entry.value);
      } catch {
        findings.push(
          finding(
            "iapkit-base-url-invalid",
            level,
            file,
            `${name} is not a URL.`,
            "Use a bare origin such as https://kit.openiap.dev.",
            // The value can be anything, including a credential, so the
            // finding says where it is and never what it is.
            { line: entry.line },
          ),
        );
        continue;
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        findings.push(
          finding(
            "iapkit-base-url-scheme",
            level,
            file,
            `${name} uses ${url.protocol} instead of http or https.`,
            "Use a bare http(s) origin.",
            { line: entry.line, actual: url.protocol },
          ),
        );
        continue;
      }
      // Every verification lane requires a bare origin and throws a developer
      // error otherwise: `OpenIapModule.swift`, `PurchaseVerificationValidator`
      // and both Vega adapters reject a path, userinfo, a query or a fragment.
      // A trailing slash is trimmed first, so `/` is an origin.
      const path = url.pathname !== "" && url.pathname !== "/";
      if (path || url.username || url.password || url.search || url.hash) {
        findings.push(
          finding(
            "iapkit-base-url-has-path",
            level,
            file,
            `${name} is not a bare origin, which is all IAPKit accepts.`,
            "Give the scheme and host only; IAPKit appends /v1/purchase/verify itself.",
            { line: entry.line },
          ),
        );
      }
    }
  }
  return findings;
}

const IOS_SOURCE = /\.(swift|m|mm|h)$/;

/**
 * When the Info.plist names a scene delegate, the class has to exist in the
 * target. Without it UIKit attaches nothing, React Native never starts, and
 * the app shows a black screen with no crash to explain it.
 */
export function iosSceneChecks(root, framework) {
  if (framework !== "expo" && framework !== "react-native") return [];
  const findings = [];
  // Sources live wherever the target groups them, so read the whole ios/ tree
  // rather than only the directory holding the plist.
  const sources = walkFiles(root, "ios", IOS_SOURCE).map((one) =>
    read(root, one),
  );
  const unreadableSource =
    sources.some((one) => one === null) || hasUnreadablePath("ios");
  const declarations = sources
    .filter(Boolean)
    .flatMap((one) => codeLines(one).map((line) => line.line));

  // The app directory is named after the app, so read whatever ios/ holds
  // rather than assuming the name of this repository's own examples.
  const plists = [
    ...(read(root, "ios/Info.plist") === null ? [] : ["ios"]),
    ...listDir(root, "ios")
      // Exactly what `walkFiles` skips: a plist in a generated directory is
      // not the app's, and its sources are never searched.
      .filter((one) => !isGeneratedDir(one) && isDirectory(root, `ios/${one}`))
      .map((one) => `ios/${one}`),
  ];
  for (const dir of plists) {
    const plist = read(root, `${dir}/Info.plist`);
    if (!plist) continue;

    // A plist declares one delegate per scene role, and the roles after the
    // first were never examined.
    const activePlist = withoutXmlComments(plist);
    for (const declared of activePlist.matchAll(
      /<key>UISceneDelegateClassName<\/key>\s*(?:<string>([^<]*)<\/string>|<string\s*\/>)/g,
    )) {
      // Only `$(PRODUCT_MODULE_NAME).X` names the app's own module. A dotted
      // name like `RNScreens.SceneDelegate` comes from a pod, which lives in
      // a directory this deliberately does not read.
      const value = (declared[1] ?? "").trim();
      const qualified = /^\$[({]PRODUCT_MODULE_NAME[)}]\./.test(value);
      // Any other module is a framework whose sources are not in this tree.
      if (!qualified && value.includes(".")) continue;
      // Match on the whole name; `oneLine` is for the report.
      const name = value.split(".").pop().trim();
      const shown = oneLine(name);
      const line = lineAt(plist, declared.index);

      if (!name) {
        findings.push(
          finding(
            "ios-scene-delegate-missing",
            "error",
            `${dir}/Info.plist`,
            "UISceneDelegateClassName is set to an empty class name.",
            "Regenerate the iOS project, or remove UISceneDelegateClassName.",
            { line },
          ),
        );
        continue;
      }

      const escaped = escapeRegExp(name);
      // `@objc(Name)` renames a Swift class for UIKit, so the declaration line
      // need not carry the name at all.
      const defined = new RegExp(
        `(?:\\bclass|@interface|@implementation)\\s+${escaped}\\b` +
          `|@objc\\(\\s*${escaped}\\s*\\)`,
      );
      // Counting quotes to reject a name inside a string breaks on an ObjC
      // char literal, and missing a real declaration fails a correct project.
      // Reading a mentioned name as declared only under-reports.
      if (declarations.some((one) => defined.test(one))) continue;
      // A source this run could not open cannot be said to lack the class.
      if (unreadableSource) continue;

      // `$(PRODUCT_MODULE_NAME).X` says the class is in the app's own module,
      // so its absence is proof. A bare name can also come from a linked
      // framework, which no file in the project records.
      findings.push(
        finding(
          "ios-scene-delegate-missing",
          qualified ? "error" : "warning",
          `${dir}/Info.plist`,
          qualified
            ? `The Info.plist names ${shown} in the app's own module, which no source under ios/ declares.`
            : `The Info.plist names the scene delegate ${shown}, which no source under ios/ declares.`,
          qualified
            ? "Regenerate the iOS project, or remove UISceneDelegateClassName."
            : "Check that a linked framework supplies it; otherwise regenerate the iOS project or remove UISceneDelegateClassName.",
          { line, actual: shown },
        ),
      );
    }
  }
  return findings;
}
