import { DART_KEYWORDS } from "./codegen/core/dart-keywords.mjs";
import { CAPABILITY_MATRIX } from "./src/capability-matrix.mjs";
import {
  SUITE_VERSION,
  SUITE_MAJOR_RELEASE_DATE,
} from "../../packages/conformance/src/spec/suite-version.mjs";
import {
  ANDROID_PROVIDER_PROFILE,
  requiredProviderBehaviors,
} from "../../packages/conformance/src/spec/android-provider-profile.mjs";

// Same grammar as the Commerce Protocol store key.
export const STORE_ID_PATTERN = /^[a-z][a-z0-9_]*$/;
// Aliases are build inputs, not identities, so the official hyphenated
// selection aliases keep their own pattern.
export const STORE_ALIAS_PATTERN = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
export const PROVIDER_COORDINATE_PATTERN =
  /^[A-Za-z0-9_.-]+:[A-Za-z0-9_.-]+:[0-9][A-Za-z0-9_.-]*$/;
const SEMVER =
  /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const capabilities = Object.keys(ANDROID_PROVIDER_PROFILE.capabilities);
const discriminators = {
  apple: "Apple",
  play: "Google",
  horizon: "Horizon",
  amazon: "Amazon",
};
const sameSet = (a, b) =>
  a.length === new Set(a).size &&
  a.length === b.length &&
  a.every((item) => b.includes(item));
const requireThat = (condition, message) => {
  if (!condition) throw new Error(message);
};
const semverMajor = (version) => {
  requireThat(
    typeof version === "string" && SEMVER.test(version),
    `Invalid semantic version: ${version}`,
  );
  return Number(version.split(".")[0]);
};

export function validateProviderReport(
  report,
  declaredCapabilities,
  { suiteVersion = SUITE_VERSION, platform = "android" } = {},
) {
  requireThat(
    ["android", "ios"].includes(platform),
    `Unknown provider platform: ${platform}`,
  );
  requireThat(report && typeof report === "object", "Missing provider report");
  const major = semverMajor(report.suiteVersion);
  const current = semverMajor(suiteVersion);
  semverMajor(report.clientProtocolVersion);
  requireThat(major <= current, "Report names a future suite major");
  requireThat(
    sameSet(report.capabilities ?? [], declaredCapabilities),
    "Report capabilities differ from registry",
  );
  const scope = platform === "ios" ? "apple-provider" : "android-provider";
  requireThat(
    report.scope?.kind === scope,
    `Report must use the ${scope} profile`,
  );
  const required = report.scope?.requiredBehaviors;
  requireThat(
    Array.isArray(required) &&
      required.length > 0 &&
      required.length === new Set(required).size,
    "Missing or duplicate required behaviors",
  );
  requireThat(
    sameSet(
      required,
      requiredProviderBehaviors(declaredCapabilities, major, platform),
    ),
    "Report omits required suite behaviors",
  );
  requireThat(
    Array.isArray(report.results) &&
      report.results.length ===
        new Set(report.results.map((result) => result.id)).size,
    "Missing or duplicate report results",
  );
  const outcomes = new Map(
    report.results.map((result) => [result.id, result.outcome]),
  );
  requireThat(
    report.results.every(
      (result) =>
        typeof result.id === "string" &&
        ["pass", "fail", "not-applicable"].includes(result.outcome),
    ),
    "Invalid report result",
  );
  const passing =
    required.every((id) => outcomes.get(id) === "pass") &&
    !report.results.some((result) => result.outcome === "fail");
  requireThat(
    report.conformant === passing &&
      report.scope.complete === required.every((id) => outcomes.has(id)),
    "Report verdict contradicts executed results",
  );
  return passing;
}

export function storeBindings(store) {
  if (store.bindings) {
    requireThat(
      typeof store.bindings === "object" &&
        !Array.isArray(store.bindings) &&
        Object.keys(store.bindings).length > 0,
      `Invalid bindings: ${store.id}`,
    );
    requireThat(
      ["platform", "coordinates", "capabilities", "latestReport"].every(
        (key) => store[key] === undefined,
      ),
      `Store binding metadata has two owners: ${store.id}`,
    );
    return Object.entries(store.bindings).map(([platform, binding]) => ({
      ...binding,
      platform,
    }));
  }
  return [
    {
      platform: store.platform,
      coordinates: store.coordinates,
      capabilities: store.capabilities,
      latestReport: store.latestReport,
    },
  ];
}

export function maintenanceStatus(
  store,
  windowDays,
  {
    now = new Date(),
    suiteVersion = SUITE_VERSION,
    majorReleaseDate = SUITE_MAJOR_RELEASE_DATE,
  } = {},
) {
  if (store.tier !== "community") return store.tier;
  if (
    storeBindings(store).every(
      (binding) =>
        semverMajor(binding.latestReport.report.suiteVersion) ===
        semverMajor(suiteVersion),
    )
  )
    return "community";
  return now.getTime() - new Date(majorReleaseDate).getTime() >
    windowDays * 86_400_000
    ? "unmaintained"
    : "outdated";
}

/** Optional registration adds discovery metadata, never a runtime dependency. */
export function validateStoreRegistry(registry) {
  requireThat(
    registry?.schemaVersion === 1 &&
      Number.isInteger(registry.maintenanceWindowDays) &&
      registry.maintenanceWindowDays > 0,
    "Invalid registry schema or maintenance window",
  );
  requireThat(
    JSON.stringify(registry.selectionAliases) ===
      JSON.stringify({ auto: "auto", none: "none" }),
    "Selection controls must remain auto and none",
  );
  requireThat(
    Array.isArray(registry.stores),
    "Registry stores must be an array",
  );
  const names = new Set(["auto", "none", "unknown"]);
  const members = new Set();
  for (const store of registry.stores) {
    requireThat(
      typeof store.id === "string" &&
        STORE_ID_PATTERN.test(store.id) &&
        !names.has(store.id),
      `Invalid or duplicate store id: ${store.id}`,
    );
    const member = store.id
      .split(/[._-]/)
      // A valid id can repeat or trail underscores; empty parts carry no name.
      .filter((part) => part.length > 0)
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join("");
    const dartMember = member[0].toLowerCase() + member.slice(1);
    requireThat(
      !members.has(member) &&
        !DART_KEYWORDS.has(dartMember) &&
        ![
          "StoreIds",
          "Self",
          "ToString",
          "HashCode",
          "RuntimeType",
          "NoSuchMethod",
          "GetHashCode",
          "Equals",
          "GetType",
          "ReferenceEquals",
          "MemberwiseClone",
          "Finalize",
        ].includes(member),
      `Store constants collide or are reserved: ${store.id}`,
    );
    members.add(member);
    names.add(store.id);
    requireThat(
      ["experimental", "community", "official"].includes(store.tier),
      `Invalid tier: ${store.id}`,
    );
    requireThat(
      typeof store.displayName === "string" && store.displayName.trim(),
      `Missing display name: ${store.id}`,
    );
    requireThat(
      Array.isArray(store.maintainers) &&
        store.maintainers.length > 0 &&
        store.maintainers.every((name) =>
          /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/.test(name),
        ),
      `Invalid maintainers: ${store.id}`,
    );
    requireThat(
      typeof store.repo === "string" && /^https:\/\/[^\s]+$/.test(store.repo),
      `Missing public repository: ${store.id}`,
    );
    requireThat(Array.isArray(store.aliases), `Missing aliases: ${store.id}`);
    for (const alias of store.aliases) {
      requireThat(
        typeof alias === "string" &&
          STORE_ALIAS_PATTERN.test(alias) &&
          !names.has(alias),
        `Invalid or duplicate alias: ${alias}`,
      );
      names.add(alias);
    }
    requireThat(
      store.commerceStore === undefined ||
        (store.tier === "official" &&
          store.id === "play" &&
          store.commerceStore === "google"),
      `Invalid commerceStore: ${store.id}`,
    );
    let allBindingsPass = true;
    for (const binding of storeBindings(store)) {
      requireThat(
        ["android", "ios"].includes(binding.platform),
        `Invalid platform: ${store.id}`,
      );
      requireThat(
        Array.isArray(binding.capabilities) &&
          sameSet(binding.capabilities, [...new Set(binding.capabilities)]) &&
          binding.capabilities.every((item) => capabilities.includes(item)),
        `Invalid capabilities: ${store.id}`,
      );
      if (store.tier === "official") {
        requireThat(
          !store.bindings,
          `Official bindings retain their native package owner: ${store.id}`,
        );
        requireThat(
          discriminators[store.id] &&
            store.repo.startsWith("https://github.com/hyodotdev/openiap/"),
          `Official store must live in the monorepo: ${store.id}`,
        );
        const expected = capabilities.filter(
          (capability) =>
            CAPABILITY_MATRIX[capability].stores[discriminators[store.id]] !==
            "unsupported",
        );
        requireThat(
          sameSet(binding.capabilities, expected),
          `Official capabilities differ from matrix: ${store.id}`,
        );
        requireThat(
          binding.coordinates?.versionKey ===
            (store.id === "apple" ? "apple" : "google"),
          `Official coordinate must use the version SSOT: ${store.id}`,
        );
        requireThat(
          binding.platform === (store.id === "apple" ? "ios" : "android"),
          `Invalid official platform: ${store.id}`,
        );
        if (binding.platform === "android")
          requireThat(
            binding.coordinates.module ===
              `io.github.hyochan.openiap:openiap-google${store.id === "play" ? "" : `-${store.id}`}`,
            `Invalid official coordinate: ${store.id}`,
          );
      } else {
        const coordinate = binding.coordinates;
        const valid =
          binding.platform === "android"
            ? typeof coordinate === "string" &&
              PROVIDER_COORDINATE_PATTERN.test(coordinate) &&
              !coordinate.startsWith("io.github.hyochan.openiap:openiap-")
            : coordinate &&
              typeof coordinate === "object" &&
              /^https:\/\/[^\s]+$/.test(coordinate.package) &&
              /^[A-Za-z][A-Za-z0-9_-]*$/.test(coordinate.product) &&
              SEMVER.test(coordinate.version) &&
              !coordinate.package.startsWith(
                "https://github.com/hyodotdev/openiap",
              );
        requireThat(valid, `Invalid community coordinates: ${store.id}`);
        if (binding.latestReport) {
          requireThat(
            /^https:\/\/[^\s]+$/.test(binding.latestReport.url),
            `Report needs a public URL: ${store.id}`,
          );
          requireThat(
            binding.latestReport.report.storeId === store.id &&
              binding.latestReport.report.store === "unknown",
            `Report store identity differs: ${store.id}`,
          );
          const passing = validateProviderReport(
            binding.latestReport.report,
            binding.capabilities,
            { platform: binding.platform },
          );
          allBindingsPass &&= passing;
        } else allBindingsPass = false;
      }
    }
    if (store.tier !== "official")
      requireThat(
        store.tier === (allBindingsPass ? "community" : "experimental"),
        `Tier disagrees with conformance report: ${store.id}`,
      );
  }
  for (const id of Object.keys(discriminators))
    requireThat(
      registry.stores.some(
        (store) => store.id === id && store.tier === "official",
      ),
      `Missing official store: ${id}`,
    );
  return registry;
}
