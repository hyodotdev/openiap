#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { format, resolveConfig } from "prettier";
import {
  SUITE_VERSION,
  SUITE_MAJOR_RELEASE_DATE,
} from "../packages/conformance/src/spec/suite-version.mjs";
import {
  validateStoreRegistry,
  maintenanceStatus,
  storeBindings,
} from "../specs/client/store-registry.mjs";

const root = new URL("../", import.meta.url);
const registry = validateStoreRegistry(
  JSON.parse(
    readFileSync(new URL("specs/client/src/store-registry.json", root), "utf8"),
  ),
);
const android = registry.stores.filter((store) =>
  storeBindings(store).some((binding) => binding.platform === "android"),
);
const aliases = android.flatMap((store) =>
  [store.id, ...store.aliases].map((alias) => [alias, store.id]),
);
const controls = Object.entries(registry.selectionAliases);
const check = process.argv.includes("--check");
const drift = [];
function update(path, transform) {
  const file = new URL(path, root);
  const previous = readFileSync(file, "utf8");
  const next = transform(previous);
  if (previous === next) return;
  if (check) drift.push(path);
  else {
    writeFileSync(file, next);
    console.log(`generated ${path}`);
  }
}
function replaceBlock(source, pattern, replacement, label) {
  if (!pattern.test(source))
    throw new Error(`Cannot find ${label} generation block`);
  return source.replace(pattern, replacement);
}

update("packages/google/gradle/openiap-store.gradle", (source) =>
  replaceBlock(
    source,
    /ext\.openIapStoreAliases = \[[\s\S]*?\n\]/,
    `ext.openIapStoreAliases = [\n${[...aliases, ...controls].map(([alias, id]) => `  '${alias}': '${id}',`).join("\n")}\n]`,
    "Gradle aliases",
  ),
);
update("packages/cli/src/checks.mjs", (source) =>
  replaceBlock(
    source,
    /export const STORE_ALIASES = \{[\s\S]*?\n\};/,
    `export const STORE_ALIASES = {\n${[...aliases, ...controls].map(([alias, id]) => `  "${alias}": "${id}",`).join("\n")}\n};`,
    "doctor aliases",
  ),
);
update("libraries/expo-iap/plugin/src/withIAP.ts", (source) =>
  replaceBlock(
    source,
    /const ANDROID_STORE_ALIASES: Record<string, string> = \{[\s\S]*?\n\};/,
    `const ANDROID_STORE_ALIASES: Record<string, string> = {\n${[...aliases, ...controls].map(([alias, id]) => `  "${alias}": "${id}",`).join("\n")}\n};`,
    "Expo plugin aliases",
  ),
);
update(
  "packages/google/openiap/src/main/java/dev/hyo/openiap/store/OpenIapStore.kt",
  (source) =>
    replaceBlock(
      source,
      /private val storeAliases = mapOf\([\s\S]*?\n\)/,
      `private val storeAliases = mapOf(\n${aliases
        .filter(([alias, id]) => alias !== id)
        .map(([alias, id]) => `    "${alias}" to "${id}",`)
        .join("\n")}\n)`,
      "native aliases",
    ),
);
update("libraries/godot-iap/addons/godot-iap/android_store.gd", (source) => {
  const stores = ["auto", ...android.map((store) => store.id)];
  source = replaceBlock(
    source,
    /const STORES: PackedStringArray = \[[^\n]+\]/,
    `const STORES: PackedStringArray = [${stores.map(JSON.stringify).join(", ")}]`,
    "Godot suggestions",
  );
  return replaceBlock(
    source,
    /const ALIASES := \{[\s\S]*?\n\}/,
    `const ALIASES := {\n${[...aliases, ...controls.filter(([, id]) => id !== "none")].map(([alias, id]) => `\t"${alias}": "${id}",`).join("\n")}\n}`,
    "Godot aliases",
  );
});
update(
  "libraries/maui-iap/src/OpenIap.Maui/buildTransitive/OpenIap.Maui.targets",
  (source) =>
    replaceBlock(
      source,
      /      <_OpenIapStoreName Include="[^\n]+[\s\S]*?(?=\n    <\/ItemGroup>)/,
      `      <_OpenIapStoreName Include="auto" Store="auto" />\n${android.map((store) => `      <_OpenIapStoreName Include="${[store.id, ...store.aliases].join(";")}" Store="${store.id}" />`).join("\n")}`,
      "MAUI aliases",
    ),
);

const versions = JSON.parse(
  readFileSync(new URL("openiap-versions.json", root), "utf8"),
);
const formatCoordinates = (store, binding) =>
  typeof binding.coordinates === "string"
    ? binding.coordinates
    : binding.platform === "android"
      ? `${binding.coordinates.module}:${versions[binding.coordinates.versionKey]}`
      : store.tier === "official"
        ? `${binding.coordinates.repository}@${versions[binding.coordinates.versionKey]}`
        : `${binding.coordinates.package}@${binding.coordinates.version} (${binding.coordinates.product})`;
const data = registry.stores.map((store) => {
  const bindings = storeBindings(store);
  return {
    ...store,
    platform: bindings.map((binding) => binding.platform).join(", "),
    capabilities: [
      ...new Set(bindings.flatMap((binding) => binding.capabilities)),
    ],
    coordinates: bindings
      .map(
        (binding) =>
          `${bindings.length > 1 ? `${binding.platform}: ` : ""}${formatCoordinates(store, binding)}`,
      )
      .join("; "),
    latestReport:
      bindings.find((binding) => binding.latestReport)?.latestReport.url ??
      null,
    reports: bindings
      .filter((binding) => binding.latestReport)
      .map((binding) => ({
        platform: binding.platform,
        url: binding.latestReport.url,
        suiteVersion: binding.latestReport.report.suiteVersion,
      })),
  };
});
const docsPath = "packages/docs/src/generated/store-registry.json";
const docsFile = new URL(docsPath, root);
const docs = await format(
  JSON.stringify({
    suiteVersion: SUITE_VERSION,
    maintenanceWindowDays: registry.maintenanceWindowDays,
    suiteMajorAdoptionDate: SUITE_MAJOR_RELEASE_DATE,
    stores: data,
  }),
  {
    ...(await resolveConfig(docsFile.pathname)),
    parser: "json",
  },
);
let previous = "";
try {
  previous = readFileSync(docsFile, "utf8");
} catch {}
if (previous !== docs) {
  if (check) drift.push(docsPath);
  else {
    writeFileSync(docsFile, docs);
    console.log(`generated ${docsPath}`);
  }
}
for (const store of registry.stores) {
  const status = maintenanceStatus(store, registry.maintenanceWindowDays);
  if (!["outdated", "unmaintained"].includes(status)) continue;
  console.warn(
    `::warning title=OpenIAP provider ${status}::${store.id}: conformance report is behind the current suite major`,
  );
}
if (drift.length) {
  console.error(
    `Store registry generation drift:\n${drift.map((file) => `- ${file}`).join("\n")}\nRun bun run stores:generate`,
  );
  process.exitCode = 1;
} else if (check)
  console.log("Store registry and generated surfaces are in sync.");
