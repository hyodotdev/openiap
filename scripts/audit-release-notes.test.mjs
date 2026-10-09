import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  RELEASE_NOTES,
  findUnnotedSourceChanges,
} from "./audit-release-notes.mjs";

test("published source changes need the release card", () => {
  assert.deepEqual(
    findUnnotedSourceChanges([
      "packages/google/openiap/src/amazon/java/dev/hyo/openiap/OpenIapModule.kt",
      "packages/google/gradle/openiap-store.gradle",
      "libraries/expo-iap/plugin/src/withIAP.ts",
      "libraries/react-native-iap/android/build.gradle",
      "libraries/maui-iap/src/OpenIap.Maui/buildTransitive/OpenIap.Maui.targets",
      "packages/google/openiap/consumer-rules.pro",
      "Package.swift",
      "specs/client/src/api.graphql",
      "specs/client/src/generated/types.gd",
      "openiap.podspec",
      "packages/google/gradle-plugin/build.gradle.kts",
      "packages/cli/bin/openiap.mjs",
      "libraries/react-native-iap/android/consumer-rules.pro",
      "libraries/react-native-iap/android/CMakeLists.txt",
      "libraries/expo-iap/onside/index.js",
      "libraries/kmp-iap/library/consumer-rules-non-play.pro",
      "libraries/godot-iap/android/settings.gradle.kts",
      "libraries/maui-iap/android/build.gradle.kts",
      "libraries/godot-iap/scripts/fix_ios_embed.sh",
      "libraries/godot-iap/scripts/write-gdap.sh",
    ]),
    [
      "packages/google/openiap/src/amazon/java/dev/hyo/openiap/OpenIapModule.kt",
      "packages/google/gradle/openiap-store.gradle",
      "libraries/expo-iap/plugin/src/withIAP.ts",
      "libraries/react-native-iap/android/build.gradle",
      "libraries/maui-iap/src/OpenIap.Maui/buildTransitive/OpenIap.Maui.targets",
      "packages/google/openiap/consumer-rules.pro",
      "Package.swift",
      "specs/client/src/api.graphql",
      "specs/client/src/generated/types.gd",
      "openiap.podspec",
      "packages/google/gradle-plugin/build.gradle.kts",
      "packages/cli/bin/openiap.mjs",
      "libraries/react-native-iap/android/consumer-rules.pro",
      "libraries/react-native-iap/android/CMakeLists.txt",
      "libraries/expo-iap/onside/index.js",
      "libraries/kmp-iap/library/consumer-rules-non-play.pro",
      "libraries/godot-iap/android/settings.gradle.kts",
      "libraries/maui-iap/android/build.gradle.kts",
      "libraries/godot-iap/scripts/fix_ios_embed.sh",
      "libraries/godot-iap/scripts/write-gdap.sh",
    ],
  );
});

test("a PR that updates the release card passes", () => {
  assert.deepEqual(
    findUnnotedSourceChanges([
      "libraries/expo-iap/plugin/src/withIAP.ts",
      RELEASE_NOTES,
    ]),
    [],
  );
});

test("tests, examples, docs, and manifests need no release card", () => {
  assert.deepEqual(
    findUnnotedSourceChanges([
      "libraries/expo-iap/src/__tests__/vega-adapter.test.ts",
      "libraries/expo-iap/example/eas.json",
      "packages/google/openiap/src/testAmazon/java/dev/hyo/openiap/AmazonSubscriptionProductMappingTest.kt",
      "packages/google/Example/build.gradle.kts",
      "libraries/flutter_inapp_purchase/pubspec.yaml",
      "libraries/react-native-iap/package.json",
      "packages/docs/src/pages/docs/setup/expo.tsx",
      "libraries/kmp-iap/library/src/androidUnitTest/kotlin/io/github/hyochan/kmpiap/PlatformStoreTest.kt",
      "specs/client/codegen/plugins/gdscript.ts",
      "specs/client/src/generated-gdscript.test.ts",
      "libraries/react-native-iap/android/gradle.properties",
      "libraries/kmp-iap/library/library.podspec",
      "packages/google/openiap/proguard-rules.pro",
      "libraries/godot-iap/ios-gdextension/Tests/GodotIapTests/GodotIapHelperTests.swift",
    ]),
    [],
  );
});

test("the audit reads only the branch's own changes after the base moved on", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "release-notes-"));
  const git = (...args) =>
    execFileSync(
      "git",
      ["-c", "user.name=t", "-c", "user.email=t@t", ...args],
      {
        cwd: root,
        stdio: "pipe",
      },
    );
  const commit = (file, message) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), message);
    git("add", file);
    git("commit", "-q", "-m", message);
  };
  try {
    git("init", "-q", "-b", "main");
    commit("README.md", "start");
    git("checkout", "-q", "-b", "feature");
    commit("packages/docs/src/pages/docs/setup/expo.tsx", "docs only");
    git("checkout", "-q", "main");
    commit("packages/cli/src/init.mjs", "a source change on main");
    git("checkout", "-q", "feature");
    const audit = fileURLToPath(
      new URL("./audit-release-notes.mjs", import.meta.url),
    );
    const output = execFileSync("node", [audit, "main"], {
      cwd: root,
      encoding: "utf8",
    });
    assert.match(output, /Release note audit: clean\./);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function normalize(text) {
  // JSX drops whitespace around newlines, so `word\n;` renders "word;".
  // Same-line spaces survive, so a rendered "storeId ;" must fail.
  // Versions drift after release, so needles pin words, not digits.
  return text
    .replaceAll("&apos;", "'")
    .replace(/\{'([^'\\]*)'\}/g, "$1")
    .replace(/\d+\.\d+\.\d+/g, "0.0.0")
    .replace(/[ \t]*\n\s*([;,.!?)%])/g, "$1")
    .replaceAll(/\s+/g, " ");
}

test("JSX punctuation normalization preserves intentional spacing", () => {
  assert.equal(normalize("storeId\n{'; '}recompile"), "storeId; recompile");
  assert.equal(normalize("storeId{' '}required"), "storeId required");
  assert.notEqual(normalize("storeId ; recompile"), "storeId; recompile");
});

function cardSource() {
  const source = fs.readFileSync(path.join(repoRoot, RELEASE_NOTES), "utf8");
  const start = source.indexOf("id: 'community-store-providers-2026-10-02'");
  const end = source.indexOf("id: '", start + 1);
  return source.slice(start, end === -1 ? undefined : end);
}

function cardText() {
  return normalize(cardSource());
}

// Only the Breaking list: a bullet moved to Common changes must fail.
function breakingSlice() {
  const card = cardSource();
  const start = card.indexOf("<h5>Breaking changes</h5>");
  const end = card.indexOf("<h5>Common changes</h5>", start);
  assert.ok(start !== -1, "card is missing the Breaking changes heading");
  assert.ok(end !== -1, "card is missing the Common changes heading");
  assert.ok(start < end, "Breaking changes must come before Common changes");
  return card.slice(start, end);
}

// Plain text of a JSX fragment. A depth counter drops nested or partial tags,
// which a single regex pass would leave behind.
function stripTags(text) {
  let depth = 0;
  let plain = "";
  for (const char of text) {
    if (char === "<") depth++;
    else if (char === ">" && depth > 0) depth--;
    else if (depth === 0) plain += char;
  }
  return plain;
}

function breakingBullets() {
  const slice = breakingSlice();
  return [...slice.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((match) =>
    normalize(stripTags(match[1])).trim(),
  );
}

function migrationSource() {
  return fs.readFileSync(
    path.join(repoRoot, "packages/docs/src/pages/docs/updates/migration.tsx"),
    "utf8",
  );
}

// Only the provider-contract train: shared needles must live in this section.
function migrationSlice() {
  const source = migrationSource();
  const start = source.lastIndexOf(
    "<AnchorLink",
    source.indexOf('id="provider-contract-upgrade"'),
  );
  const end = source.indexOf('id="v2-to-v3"', start);
  assert.ok(start !== -1, "migration guide is missing the upgrade section");
  assert.ok(end !== -1, "migration guide is missing the next train");
  return source.slice(start, end);
}

const BREAKING_BULLETS = [
  'Client Protocol 1.0.0 removes deprecated redemption APIs, Horizon <code>success</code>, and Apple <code>specVersion</code>; use their replacements in the <Link to="/docs/updates/migration#client-protocol-1-removals">migration table</Link>.',
  "Client Protocol 1.0.0 makes <code>storeId</code> required on purchases and IAPKit results; set it on hand-built values (C# and the Kotlin IAPKit result infer official ids).",
  "KMP 4.0.0 adds <code>UNKNOWN</code> to the public <code>Store</code> enum; add the branch to every exhaustive <code>when (getStore())</code>.",
  "OpenIAP Google 4.0.0 and KMP 4.0.0 make the Kotlin <code>RequestVerifyPurchaseWithIapkitResult</code> a plain class whose constructor and <code>copy</code> carry <code>storeId</code>; recompile code that copies results or constructs or copies purchases.",
  "OpenIAP Google 4.0.0 moves shared classes into the <code>openiap-core</code> artifact; apps linking the AAR by file must add it (Maven consumers get it transitively).",
  "OpenIAP Apple 4.0.0 requires tvOS 16.0+ (SwiftPM; CocoaPods already required 16.0); raise the deployment target of tvOS apps.",
  "OpenIAP Apple 4.0.0 throws <code>CancellationError</code>, with no purchase-error event, when the calling task of <code>requestPurchase</code> or another StoreKit operation is cancelled; catch it at the call site.",
  "Flutter 11.0.0 <code>initConnection()</code> now returns false on iOS and macOS when StoreKit cannot make payments; it returned true before.",
  "React Native 17.0.0, Expo 6.0.0, Flutter 11.0.0, and Godot 4.0.0 forward the provider's Android error code where they returned fixed codes; handle specific codes such as <code>not-prepared</code>.",
  "Flutter 11.0.0 and Godot 4.0.0 (and KMP 4.0.0 on iOS) report the native error code from failed verification instead of always <code>purchase-verification-failed</code>; match specific codes.",
  "React Native 17.0.0, Expo 6.0.0, and Flutter 11.0.0 run the provider's Android restore first, and on Horizon deliver each owned purchase to purchase listeners; make the handler idempotent.",
  "React Native 17.0.0 and Flutter 11.0.0 (every call), KMP 4.0.0 and MAUI 3.0.0 (id-filtered calls) answer <code>hasActiveSubscriptions</code> on iOS from the active flag; a subscriber in billing grace reads inactive.",
  "Godot 4.0.0 emits one <code>purchase_error</code>, not two, for a failed Apple restore, and one for a failed <code>verify_purchase</code> (on Android only when the result carries a code).",
  "Godot 4.0.0 reports OpenIAP's error code in failed Apple <code>products_fetched</code> payloads for <code>get_storefront</code>, <code>fetch_products</code>, and iOS-only calls, which carried <code>service-error</code> or no code; match specific codes.",
  "Godot 4.0.0 fails the Android export when <code>openiap/android_store</code> is unrecognized instead of falling back to Play; fix the store value.",
];

test("the community provider card carries an explicit Breaking changes section", () => {
  const card = cardText();
  const breaking = normalize(breakingSlice());
  assert.ok(
    card.includes("/docs/updates/migration#provider-contract-upgrade"),
    "card is missing the migration guide link",
  );
  const bullets = breakingBullets();
  for (const bullet of BREAKING_BULLETS) {
    assert.ok(
      bullets.includes(normalize(stripTags(bullet)).trim()),
      `Breaking list is missing: ${bullet}`,
    );
  }
  for (const moved of [
    "Purchases and verification outputs include a required",
    "Add <code>storeId</code> to manually constructed",
    "Requires tvOS 16.0+.",
    "Cancelling a <code>requestPurchase</code> task throws",
    "instead of fixed codes",
    "also report a store-aware init message",
    "run the provider's Android restore before querying ownership",
    "On Horizon, each owned purchase then reaches",
    "now answer <code>hasActiveSubscriptions</code>",
    "needs a new branch",
    "Client Protocol 1.0.0 and every SDK require",
    "data class into",
    "operations that rethrow it",
    "Each item names who is affected",
    "report the provider's own Android error code",
    "Rejects invalid Android provider selection during export",
    "emits one error for Apple restore failures",
    "which must also cover",
    "constructs or copies purchases or results",
    "must add it, Maven",
    "when the task calling",
    "initConnection</code>, or another",
    "match generated",
    "KMP 4.0.0, and Godot 4.0.0 report",
    "emits a single",
    "instead of staying silent",
    "for before and after code",
    "store-aware init message",
  ]) {
    assert.ok(
      !card.toLowerCase().includes(normalize(moved).toLowerCase()),
      `moved fact is duplicated outside Breaking changes: ${moved}`,
    );
  }
  assert.ok(
    !card.includes("still signals each owned purchase once"),
    "stale Godot restore claim is still present",
  );
  assert.ok(
    !card.includes("StoreKit's active flag"),
    "stale StoreKit flag claim is still present",
  );
});

test("every Breaking bullet is one sentence of at most 30 words", () => {
  const bullets = breakingBullets();
  assert.equal(bullets.length, BREAKING_BULLETS.length);
  for (const bullet of bullets) {
    const words = bullet.split(/\s+/).filter(Boolean);
    assert.ok(
      words.length <= 30,
      `bullet has ${words.length} words (at most 30): ${bullet}`,
    );
    const sentences = bullet
      .replace(/\d+\.\d+(?:\.\d+)?/g, "V")
      .split("")
      .filter((char) => char === "." || char === "!" || char === "?").length;
    assert.equal(sentences, 1, `bullet is not one sentence: ${bullet}`);
  }
});

test("the migration guide covers the provider contract upgrade", () => {
  const slice = migrationSlice();
  const page = normalize(slice);
  for (const anchor of [
    'id="provider-contract-upgrade"',
    'id="provider-contract-store-id"',
    'id="provider-contract-kmp-store"',
    'id="provider-contract-kotlin-result"',
    'id="provider-contract-openiap-core"',
    'id="provider-contract-tvos"',
    'id="provider-contract-cancellation"',
    'id="provider-contract-flutter-init"',
    'id="provider-contract-error-codes"',
    'id="provider-contract-verify-codes"',
    'id="provider-contract-restore"',
    'id="provider-contract-godot-events"',
    'id="provider-contract-godot-export"',
    'id="provider-contract-subscription-flag"',
  ]) {
    assert.ok(
      slice.includes(`<AnchorLink ${anchor}`),
      `migration guide is missing: ${anchor}`,
    );
  }
  for (const substance of [
    "store: 'google', storeId: 'play',",
    "store: IapStore.Google, storeId: 'play',",
    'storeId = "play"',
    'StoreId = "play"',
    'store_id = "play"',
    "...savedPurchase,",
    "your KmpInAppPurchase instance",
    "Store.UNKNOWN ->",
    "Store.NONE",
    "preload(",
    "its own provider id",
    "IapStore.unknown",
    "from_dict</code> returns null",
    "JsonException",
    "storefrontCountryCodeIOS",
    "the new <code>openiap-core</code>",
    "recompile",
    "component1-3",
    "tvOS 16",
    "CancellationError",
    "can be cancelled, such as a SwiftUI",
    "user-cancelled",
    "wrapped the cancellation into an emitted",
    "threw it as a <code>PurchaseError</code> without an event",
    "without updating state",
    "even after connecting",
    "cannot make payments",
    "not-prepared",
    "rejected every failure with",
    "answered native failures with",
    "Dart-guarded calls still throw",
    "StoreConnectionFailure",
    "verification without a userId",
    "transaction-validation-failed",
    "expo-iap",
    "loadPurchases",
    "Failed to restore purchases [code]",
    "Failed to sync iOS purchases [code]",
    "grantOnce(purchase.purchaseToken",
    "get_available_purchases_result",
    "verify_purchase</code> now emits",
    "get_storefront</code> failures,",
    "failure payloads for",
    "failure results of the iOS-only methods now carry",
    "now carry OpenIAP's code instead of",
    "or no code",
    "openiap/android_store",
    "no longer checks init in Dart",
    "connect and answer instead of throwing",
    "Play and Horizon report the provider's",
    "or call it before",
    "Failed to check active subscriptions [code]",
    "Failed to get active subscriptions [code]",
    "Flutter on iOS and macOS",
    "Godot on iOS and Android",
    "MAUI also on Mac",
    "gracePeriodExpirationDate",
    "/docs/updates/releases#community-store-providers-2026-10-02",
  ]) {
    assert.ok(
      page.includes(substance),
      `migration guide is missing: ${substance}`,
    );
  }
  for (const dropped of [
    "the cancellation was wrapped into a",
    "endConnection</code> runs first",
    "calls before init now report",
    "native-only calls now report",
    "failures and async failure payloads in",
    "KMP and MAUI also treat an empty id list",
    "pass an explicit empty id list",
    "pass explicit ids or omit the filter",
    "the other operations that rethrow it",
    "const finished = ",
    "Android failures arrived as one fixed code",
    "store: .google",
    "with its explicit provider id",
    "ToString",
    "which is never returned",
    "add the branches",
    "match the provider's codes against",
    "init errors keep the",
    "On Amazon a failed init",
    "Store purchase restore did not complete",
    "Onside purchase restore did not complete",
    "AppStore.sync",
    "empty id list means all",
    "const granted",
    "failures now carry OpenIAP's code instead of always",
    "now carry a code where they had none",
  ]) {
    assert.ok(
      !page.includes(dropped),
      `removed claim is still present: ${dropped}`,
    );
  }
});

test("card and migration links resolve to existing anchors", () => {
  const migration = migrationSource();
  assert.ok(
    migration.includes('id="provider-contract-upgrade"'),
    "card link target is missing: provider-contract-upgrade",
  );
  const releases = fs.readFileSync(path.join(repoRoot, RELEASE_NOTES), "utf8");
  assert.ok(
    releases.includes('id="community-store-providers-2026-10-02"'),
    "migration link target is missing: community-store-providers-2026-10-02",
  );
  const providers = fs.readFileSync(
    path.join(
      repoRoot,
      "packages/docs/src/pages/docs/guides/store-providers.tsx",
    ),
    "utf8",
  );
  assert.ok(
    providers.includes('id="identity"'),
    "migration link target is missing: store-providers identity",
  );
});

function docsPages(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...docsPages(full));
    else if (entry.name.endsWith(".tsx")) found.push(full);
  }
  return found.sort();
}

test("every migration and release deep link resolves to an existing id", () => {
  const migration = migrationSource();
  const releases = fs.readFileSync(path.join(repoRoot, RELEASE_NOTES), "utf8");
  const links = [];
  for (const page of docsPages(path.join(repoRoot, "packages/docs/src"))) {
    const source = fs.readFileSync(page, "utf8");
    for (const match of source.matchAll(
      /\/docs\/updates\/(migration|releases)#([A-Za-z0-9_-]+)/g,
    )) {
      links.push({
        page: path.relative(repoRoot, page),
        target: match[1],
        id: match[2],
      });
    }
  }
  assert.ok(links.length > 0, "no migration or release deep links found");
  for (const { page, target, id } of links) {
    const source = target === "migration" ? migration : releases;
    assert.ok(
      source.includes(`id="${id}"`),
      `${page} links to missing ${target}#${id}`,
    );
  }
});

test("the has-active-subscriptions page states the iOS active flag and grace", () => {
  const source = fs.readFileSync(
    path.join(
      repoRoot,
      "packages/docs/src/pages/docs/apis/has-active-subscriptions.tsx",
    ),
    "utf8",
  );
  const page = normalize(source);
  assert.ok(
    page.includes(
      "has the active flag set (expiration in the future); a subscriber in billing grace reads inactive",
    ),
    "page is missing the iOS active-flag and grace statement",
  );
  assert.ok(
    page.includes(
      "/docs/updates/migration#provider-contract-subscription-flag",
    ),
    "page is missing the migration guide link",
  );
  assert.ok(
    !page.includes("the iterator yields at least one non-expired subscription"),
    "stale iterator claim is still present",
  );
});

test("the restore-purchases page documents the provider-first Android restore", () => {
  const source = fs.readFileSync(
    path.join(
      repoRoot,
      "packages/docs/src/pages/docs/apis/restore-purchases.tsx",
    ),
    "utf8",
  );
  const page = normalize(source);
  assert.ok(page.includes("Reads owned purchases from the store"));
  assert.ok(page.includes("with no system-level UI prompt"));
  assert.ok(
    page.includes(
      "React Native, Expo, Flutter, MAUI, Godot, and KMP (Amazon, Horizon, and community-provider builds) call the provider's restore",
    ),
  );
  assert.ok(page.includes("KMP's Play build queries ownership directly"));
  assert.ok(page.includes("<code>PurchasingService.getPurchaseUpdates</code>"));
  assert.ok(
    page.includes("Play and Amazon restores deliver nothing by themselves"),
  );
  assert.ok(
    page.includes(
      "Horizon's restore delivers each owned purchase to the purchase listeners (React Native, Expo, Flutter, MAUI, and KMP)",
    ),
  );
  assert.ok(
    page.includes(
      "Godot emits no <code>purchase_updated</code> signal; read owned purchases with <code>get_available_purchases_result</code>",
    ),
  );
  assert.ok(
    !page.includes("signals each owned purchase once"),
    "stale Godot restore claim is still present",
  );
  assert.ok(
    !page.includes("Runs the provider's restore first"),
    "unqualified restore claim is still present",
  );
  assert.ok(
    !page.includes("Play has no concept of an explicit"),
    "stale restore claim is still present",
  );
});

test("the get-active-subscriptions page documents the platform isActive rules", () => {
  const source = fs.readFileSync(
    path.join(
      repoRoot,
      "packages/docs/src/pages/docs/apis/get-active-subscriptions.tsx",
    ),
    "utf8",
  );
  const page = normalize(source);
  assert.ok(page.includes("while the expiration date is in the future"));
  assert.ok(page.includes("billing grace reads inactive"));
  assert.ok(page.includes("while the purchase state is purchased"));
  assert.ok(page.includes("<code>purchaseState == PURCHASED</code> as active"));
  assert.ok(
    !page.includes("paying or grace"),
    "stale isActive claim is still present",
  );
  assert.ok(
    !page.includes("autoRenewing</code> as active"),
    "stale autoRenewing claim is still present",
  );
});

test("the registry note keeps a major's profile while any entry cites it", () => {
  const guide = fs.readFileSync(
    path.join(repoRoot, "knowledge/internal/04-platform-packages.md"),
    "utf8",
  );
  assert.ok(guide.includes("for as long as any registry entry cites it"));
  assert.ok(
    !guide.includes("until the registry maintenance window ends"),
    "stale registry window claim is still present",
  );
  const profile = fs.readFileSync(
    path.join(repoRoot, "packages/conformance/src/spec/provider-profile.mjs"),
    "utf8",
  );
  assert.ok(profile.includes("while any registry entry cites it"));
  assert.ok(
    !profile.includes("until the registry window ends"),
    "stale registry window claim is still present",
  );
});

test("the Client Protocol feature-PR rule refreshes the lockfile", () => {
  for (const file of [
    "knowledge/internal/04-platform-packages.md",
    "knowledge/internal/06-git-deployment.md",
    ".claude/commands/release.md",
  ]) {
    const source = fs.readFileSync(path.join(repoRoot, file), "utf8");
    assert.ok(
      source.includes("bun install --lockfile-only --ignore-scripts"),
      `${file} is missing the lockfile refresh`,
    );
  }
  const guide = fs.readFileSync(
    path.join(repoRoot, "knowledge/internal/04-platform-packages.md"),
    "utf8",
  );
  assert.ok(
    guide.includes("refresh `bun.lock` and run"),
    "the Client Protocol update steps skip the lockfile refresh",
  );
  assert.ok(
    !guide.includes("mirrors it into `openiap-versions.json`"),
    "stale sync-mirror claim is still present",
  );
});

test("the Expo restore JSDoc names the provider restore first", () => {
  const source = fs.readFileSync(
    path.join(repoRoot, "libraries/expo-iap/src/index.ts"),
    "utf8",
  );
  assert.ok(
    source.includes(
      "Android: run the provider's restore, then fetch available purchases",
    ),
  );
  assert.ok(
    !source.includes("the query itself restores them"),
    "stale restore JSDoc is still present",
  );
});
