#!/usr/bin/env node

// Deprecated keys that every patch and minor keeps, with a warning, until the
// next major of each package that ships them. `major` is the last major that
// keeps the key; a package that goes major and still keeps it raises its entry
// first. A key several packages share goes in one major of all of them: a
// library that took the new openiap-google in a later minor would otherwise
// lose the key in that minor. The PR that removes a key marks its rule
// `dropped`, and every release workflow then runs `release-gate` so each of
// those packages ships that major. Node built-ins only, so release jobs run it
// without installing anything.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  libraryReleaseTags,
  nativeReleaseGates,
} from "./release-branch-policy.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PACKAGE_JSON_VERSION = /"version":\s*"([^"]+)"/;
const NEXT_MAJOR_NOTICE = /removed in the next major release/i;
const MIGRATION_PAGE = "packages/docs/src/pages/docs/updates/migration.tsx";

export const scheduledRemovalRules = [
  {
    label: "legacy Gradle store flags",
    packages: [
      {
        name: "openiap-google",
        major: 3,
        file: "openiap-versions.json",
        pattern: /"google":\s*"([^"]+)"/,
      },
      {
        name: "react-native-iap",
        major: 16,
        file: "libraries/react-native-iap/package.json",
        pattern: PACKAGE_JSON_VERSION,
      },
      {
        name: "expo-iap",
        major: 5,
        file: "libraries/expo-iap/package.json",
        pattern: PACKAGE_JSON_VERSION,
      },
      {
        name: "flutter_inapp_purchase",
        major: 10,
        file: "libraries/flutter_inapp_purchase/pubspec.yaml",
        pattern: /^version:\s*(\S+)/m,
      },
    ],
    sources: [
      {
        file: "packages/google/gradle/openiap-store.gradle",
        tokens: ["horizonEnabled", "fireOsEnabled", "openiapPlatform"],
      },
    ],
    catalog: [
      "horizonEnabled=true",
      "fireOsEnabled=true",
      "openiapPlatform=none",
    ],
  },
  {
    label: "expo-iap store pin options",
    packages: [
      {
        name: "expo-iap",
        major: 5,
        file: "libraries/expo-iap/package.json",
        pattern: PACKAGE_JSON_VERSION,
      },
    ],
    sources: [
      {
        file: "libraries/expo-iap/plugin/src/withIAP.ts",
        tokens: [
          "modules.horizon",
          "modules.amazon.fireOS",
          "EXPO_IAP_HORIZON",
          "EXPO_IAP_FIREOS",
        ],
      },
      {
        file: "libraries/expo-iap/plugin/src/expoConfig.augmentation.d.ts",
        tokens: ["horizon?: boolean", "fireOS?: boolean"],
      },
    ],
    catalog: [
      "modules.horizon / EXPO_IAP_HORIZON=1",
      "modules.amazon.fireOS / EXPO_IAP_FIREOS=1",
    ],
  },
  {
    label: "OpenIap.Maui store alias",
    packages: [
      {
        name: "OpenIap.Maui",
        major: 2,
        file: "libraries/maui-iap/src/OpenIap.Maui/OpenIap.Maui.csproj",
        pattern: /<PackageVersion>([^<]+)<\/PackageVersion>/,
      },
    ],
    sources: [
      {
        file: "libraries/maui-iap/src/OpenIap.Maui/buildTransitive/OpenIap.Maui.targets",
        tokens: ["OpenIapAndroidStore"],
      },
    ],
    catalog: ["OpenIapAndroidStore"],
  },
  {
    label: "react-native-iap NitroProduct price fields",
    packages: [
      {
        name: "react-native-iap",
        major: 16,
        file: "libraries/react-native-iap/package.json",
        pattern: PACKAGE_JSON_VERSION,
      },
    ],
    sources: [
      {
        file: "libraries/react-native-iap/src/specs/RnIap.nitro.ts",
        tokens: [
          "originalPriceAndroid",
          "originalPriceAmountMicrosAndroid",
          "introductoryPriceCyclesAndroid",
          "introductoryPricePeriodAndroid",
          "introductoryPriceValueAndroid",
          "subscriptionPeriodAndroid",
          "freeTrialPeriodAndroid",
        ],
      },
    ],
    catalog: ["NitroProduct.originalPriceAndroid"],
  },
];

// The tag each package's release cuts; version=current republishes it.
const releaseTags = {
  "openiap-google": nativeReleaseGates.google.tag,
  "react-native-iap": libraryReleaseTags["react-native"],
  "expo-iap": libraryReleaseTags.expo,
  flutter_inapp_purchase: libraryReleaseTags.flutter,
  "godot-iap": libraryReleaseTags.godot,
  "kmp-iap": libraryReleaseTags.kmp,
  "OpenIap.Maui": libraryReleaseTags.maui,
};

export const releaseTagOf = (packageName, version) =>
  releaseTags[packageName]?.(version);

const hasReleaseTag = (packageName, version) => {
  const tag = releaseTagOf(packageName, version);
  if (!tag) return false;
  try {
    execFileSync(
      "git",
      ["rev-parse", "--verify", "--quiet", `refs/tags/${tag}`],
      { cwd: root, stdio: "ignore" },
    );
    return true;
  } catch {
    return false;
  }
};

const readRepoFile = (file) => {
  const absolute = path.join(root, file);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : "";
};

const majorOf = (pkg, readFile) => {
  const version = pkg.pattern.exec(readFile(pkg.file))?.[1];
  return { version, major: Number(version?.split(".")[0]) };
};

export const collectScheduledRemovalFailures = (
  rules = scheduledRemovalRules,
  readFile = readRepoFile,
) => {
  const failures = [];
  for (const rule of rules) {
    const passed = [];
    for (const pkg of rule.packages) {
      const { version, major } = majorOf(pkg, readFile);
      // A kept rule may name the next major; a dropped one names the last that shipped the key.
      if (!Number.isInteger(major)) {
        failures.push(`${pkg.file}: cannot read the ${pkg.name} version`);
      } else if (major > pkg.major) {
        passed.push(`${pkg.name} ${version}`);
      } else if (rule.dropped ? major < pkg.major : major < pkg.major - 1) {
        failures.push(
          `${pkg.file}: ${rule.label} names ${pkg.name} major ${pkg.major}, but the package is ${version}`,
        );
      }
    }
    if (rule.dropped) {
      // Left in place after the majors ship, the rule still catches the key coming back.
      for (const source of rule.sources) {
        const text = readFile(source.file);
        for (const token of source.tokens) {
          if (text.includes(token)) {
            failures.push(
              `${source.file}: ${rule.label} is marked dropped but still has ${JSON.stringify(token)}`,
            );
          }
        }
      }
      continue;
    }
    if (passed.length === rule.packages.length) {
      failures.push(
        `${rule.label}: ${passed.join(", ")} is past the major that deprecated them; remove them there and mark this rule dropped`,
      );
      continue;
    }
    if (passed.length > 0) {
      failures.push(
        `${rule.label}: ${passed.join(", ")} passed its major alone; a shared key goes in one major of every package that carries it, so either keep it and raise that package's major in this rule, or drop it for all of them and mark this rule dropped`,
      );
    }
    for (const source of rule.sources) {
      const text = readFile(source.file);
      for (const token of source.tokens) {
        if (!text.includes(token)) {
          failures.push(
            `${source.file}: ${rule.label} dropped ${JSON.stringify(token)} before the next major release`,
          );
        }
      }
      if (!NEXT_MAJOR_NOTICE.test(text)) {
        failures.push(
          `${source.file}: ${rule.label} must say they are removed in the next major release`,
        );
      }
    }
    const catalog = readFile(MIGRATION_PAGE);
    for (const entry of rule.catalog) {
      if (!catalog.includes(entry)) {
        failures.push(
          `${MIGRATION_PAGE}: ${rule.label} has no migration row for ${JSON.stringify(entry)}`,
        );
      }
    }
  }
  return failures;
};

// Why this release of a package is refused, or null when it may go ahead: a
// dropped key needs a major, and a major needs every kept key raised first.
export function releaseGateFailure(
  packageName,
  versionMode,
  rules = scheduledRemovalRules,
  readFile = readRepoFile,
  isTagged = hasReleaseTag,
) {
  for (const rule of rules) {
    const pkg = rule.packages.find(
      (candidate) => candidate.name === packageName,
    );
    if (!pkg) continue;
    const { version, major } = majorOf(pkg, readFile);
    // A retry of a tagged version rebuilds that tag, not this checkout.
    if (versionMode === "current" && isTagged(packageName, version)) {
      return null;
    }
    if (rule.dropped && versionMode !== "major" && !(major > pkg.major)) {
      return `${packageName} ${version} has dropped ${rule.label}, so it must release with version=major, not ${versionMode}`;
    }
    if (!rule.dropped && versionMode === "major" && major === pkg.major) {
      return `${packageName} ${version} still ships ${rule.label} as major ${pkg.major}; raise its major in that rule, or drop the key, before a major release`;
    }
  }
  return null;
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const [command, packageName, versionMode] = process.argv.slice(2);
  if (command !== "release-gate" || !packageName || !versionMode) {
    console.error(
      "Usage: scheduled-removals.mjs release-gate <package-name> <version-mode>",
    );
    process.exitCode = 2;
  } else {
    const failure = releaseGateFailure(packageName, versionMode);
    if (failure) {
      console.error(`::error::${failure}`);
      process.exitCode = 1;
    } else {
      console.log(
        `Scheduled removal gate: ${packageName} may release with version=${versionMode}.`,
      );
    }
  }
}
