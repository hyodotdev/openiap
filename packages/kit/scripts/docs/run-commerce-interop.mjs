import assert from "node:assert/strict";
import { mock } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
  symlinkSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { ConvexHttpClient } from "convex/browser";
import { anyApi, getFunctionName } from "convex/server";
import { Hono } from "hono";
import { inventories, pinSources } from "./commerce-source-snapshot.mjs";

const kit = resolve(import.meta.dir, "../..");
const repo = resolve(kit, "../..");
const example = resolve(
  process.argv[2] ?? join(repo, "../openiap-commerce-protocol-example"),
);
const revision = (cwd) => {
  const git = (args) => {
    const result = Bun.spawnSync(["git", ...args], { cwd });
    assert.equal(result.exitCode, 0, "Cannot identify source revision");
    return result.stdout.toString().trim();
  };
  // Uncommitted changes are recorded as such, never attributed to HEAD.
  return (
    git(["rev-parse", "HEAD"]) +
    (git(["status", "--porcelain"]) ? "-dirty" : "")
  );
};
const revisions = { openiap: revision(repo), example: revision(example) };
const unchangedFiles = [
  "composition/app-backend.mjs",
  "composition/commerce-client.mjs",
  "consumer.mjs",
  "webhooks.mjs",
  "erasure.mjs",
  "contract.mjs",
];
const inputs = {
  openiap: pinSources(kit, () => inventories.openiap(kit)),
  example: pinSources(example, () => [
    ...unchangedFiles,
    ...new Bun.Glob("*.mjs").scanSync({ cwd: example }),
    ...new Bun.Glob("composition/**/*.mjs").scanSync({ cwd: example }),
    "README.md",
    "package.json",
    "package-lock.json",
  ]),
  harness: pinSources(import.meta.dir, () =>
    inventories.harness(import.meta.dir),
  ),
  workspace: pinSources(repo, () => inventories.workspace(repo)),
};
const before = Object.fromEntries(
  unchangedFiles.map((name) => [name, inputs.example.hashes[name]]),
);
function optionalGeneratedFiles(root, hashes) {
  const result = Bun.spawnSync(["git", "check-ignore", "--stdin"], {
    cwd: root,
    stdin: Buffer.from(Object.keys(hashes).join("\n") + "\n"),
  });
  assert([0, 1].includes(result.exitCode), "Cannot identify generated inputs");
  return result.stdout
    .toString()
    .trim()
    .split("\n")
    .filter((name) => /(^|\/)_?generated\//.test(name));
}
const optionalInputs = {
  openiap: optionalGeneratedFiles(kit, inputs.openiap.hashes),
  workspace: optionalGeneratedFiles(repo, inputs.workspace.hashes),
};
const output = resolve(
  process.argv[3] ?? mkdtempSync(join(tmpdir(), "commerce-interop-")),
);
const deployment = join(output, "local-convex");
mkdirSync(deployment, { recursive: true });
assert(
  !existsSync(join(deployment, ".env.local")),
  "Use a new output directory; a run must start empty.",
);
// Unrelated image processing and maintenance entry points stay out of the isolated deployment.
for (const name of Object.keys(inputs.openiap.hashes))
  if (
    (name.startsWith("convex/") ||
      ["convex.json", "tsconfig.json"].includes(name)) &&
    !["convex/crons.ts", "convex/files/action.ts"].includes(name)
  )
    inputs.openiap.write(name, join(deployment, name));
inputs.harness.write(
  "commerce-interop-fixture.ts",
  join(deployment, "convex/interopFixture.ts"),
);
symlinkSync(join(kit, "node_modules"), join(deployment, "node_modules"), "dir");
writeFileSync(
  join(deployment, "package.json"),
  JSON.stringify({
    name: "commerce-interop-local",
    type: "module",
    dependencies: { convex: "1.44.0" },
  }),
);
const env = { ...process.env };
for (const key of Object.keys(env))
  if (
    key.startsWith("CONVEX_") ||
    key.startsWith("VITE_KIT_CONVEX_") ||
    key === "VITE_CONVEX_URL"
  )
    delete env[key];
env.CONVEX_AGENT_MODE = "anonymous";
const logPath = join(output, "convex.log");
let convexProcess;
async function boot() {
  writeFileSync(logPath, "");
  convexProcess = Bun.spawn(
    [
      process.execPath,
      join(kit, "node_modules/convex/bin/main.js"),
      "dev",
      "--typecheck",
      "disable",
      "--codegen",
      "disable",
      "--tail-logs",
      "disable",
      "--local-backend-version",
      "precompiled-2026-08-25-7cce8fb",
    ],
    {
      cwd: deployment,
      env,
      stdout: Bun.file(logPath),
      stderr: Bun.file(logPath),
    },
  );
  for (let i = 0; i < 600; i++) {
    if (readFileSync(logPath, "utf8").includes("Convex functions ready!"))
      return;
    if (convexProcess.exitCode !== null)
      throw new Error(`Local Convex exited; inspect ${logPath}`);
    await Bun.sleep(250);
  }
  throw new Error(`Local Convex did not become ready; inspect ${logPath}`);
}
async function stop() {
  if (convexProcess) {
    convexProcess.kill("SIGINT");
    await convexProcess.exited;
  }
}
const checks = [],
  trace = [],
  results = {
    example: { label: "openiap-commerce-protocol-example" },
    iapkit: { label: "IAPKit" },
  };
function check(label, actual, expected) {
  assert.deepEqual(actual, expected, label);
  checks.push(label);
  console.log(`PASS ${label}`);
}
const hash = (path) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
let appServer, receiver, sqlite, sqliteServer, kitServer;
try {
  await boot();
  const config = JSON.parse(
    readFileSync(join(deployment, ".convex/local/default/config.json"), "utf8"),
  );
  const convexUrl = `http://127.0.0.1:${config.ports.cloud}`;
  assert.equal(new URL(convexUrl).hostname, "127.0.0.1");
  process.env.VITE_KIT_CONVEX_URL = convexUrl;
  const admin = new ConvexHttpClient(convexUrl);
  admin.setAdminAuth(config.adminKey);
  const ctx = {
    runQuery: admin.query.bind(admin),
    runMutation: admin.mutation.bind(admin),
    runAction: admin.action.bind(admin),
  };
  const secret = randomBytes(32).toString("hex");
  const exampleSecret = randomBytes(32).toString("hex");
  const key = "openiap-kit_sk_" + randomBytes(24).toString("hex"),
    publishable = "openiap-kit_pk_" + randomBytes(24).toString("hex");
  const seeded = await admin.action(anyApi.interopFixture.setup, {
    secret,
    key,
    publishable,
  });
  const startedAt = Date.now(),
    expiresAt = startedAt + 45000,
    token = "local-interop-google-token",
    userId = "interop_alice",
    productId = "premium.monthly";
  let googleState = "SUBSCRIPTION_STATE_ACTIVE";
  mock.module("googleapis", () => ({
    google: {
      auth: { GoogleAuth: class {} },
      androidpublisher: () => ({
        purchases: {
          productsv2: {
            getproductpurchasev2: async () => {
              throw { code: 404 };
            },
          },
          subscriptionsv2: {
            get: async ({ token: received }) => {
              if (received !== token) throw { code: 404 };
              return {
                data: {
                  subscriptionState: googleState,
                  startTime: new Date(startedAt - 60000).toISOString(),
                  acknowledgementState: "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED",
                  latestOrderId: "GPA.local-fixture",
                  testPurchase: {},
                  lineItems: [
                    {
                      productId,
                      expiryTime: new Date(expiresAt).toISOString(),
                      autoRenewingPlan: {
                        autoRenewEnabled:
                          googleState === "SUBSCRIPTION_STATE_ACTIVE",
                        recurringPrice: { currencyCode: "USD", units: "5" },
                      },
                    },
                  ],
                },
              };
            },
          },
        },
      }),
    },
  }));
  mock.module("google-auth-library", () => ({
    OAuth2Client: class {
      async verifyIdToken() {
        return {
          getPayload: () => ({
            email: "fixture@local-test.iam.gserviceaccount.com",
            email_verified: true,
          }),
        };
      }
    },
  }));
  process.env.GOOGLE_PUBSUB_AUDIENCE = "https://kit.example.com";
  const storeState = { apple: true, amazon: true, horizon: true };
  const applePayload = {
    transactionId: "90000000000001",
    originalTransactionId: "90000000000001",
    bundleId: "dev.openiap.interop",
    productId,
    type: "Auto-Renewable Subscription",
    environment: "Sandbox",
    purchaseDate: Date.now(),
    expiresDate: Date.now() + 3600000,
  };
  const appleJws = [
    Buffer.from('{"alg":"ES256"}').toString("base64url"),
    Buffer.from(JSON.stringify(applePayload)).toString("base64url"),
    "Zml4dHVyZQ",
  ].join(".");
  const appleLibrary = await import("@apple/app-store-server-library");
  mock.module("@apple/app-store-server-library", () => ({
    ...appleLibrary,
    AppStoreServerAPIClient: class {
      async getTransactionInfo(id) {
        assert.equal(id, applePayload.transactionId);
        return { signedTransactionInfo: appleJws };
      }
    },
    SignedDataVerifier: class {
      async verifyAndDecodeTransaction(jws) {
        assert.equal(jws, appleJws);
        return applePayload;
      }
    },
  }));
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const target = new URL(
      typeof url === "string" || url instanceof URL ? url : url.url,
    );
    if (target.hostname === "graph.oculus.com") {
      assert.equal(target.pathname, "/1234567890/verify_entitlement");
      const form = new URLSearchParams(init.body);
      assert.equal(form.get("user_id"), "store-user-horizon");
      assert.equal(form.get("sku"), productId);
      if (storeState.horizon === "outage")
        return Response.json({}, { status: 400 });
      return Response.json({
        success: storeState.horizon,
        grant_time: Math.floor(Date.now() / 1000),
      });
    }
    if (target.hostname === "appstore-sdk.amazon.com") {
      assert(target.pathname.includes("/sandbox/"));
      assert(
        target.pathname.endsWith(
          "/user/store-user-amazon/receiptId/local-amazon-receipt",
        ),
      );
      if (storeState.amazon === "outage")
        return Response.json({}, { status: 496 });
      return Response.json({
        receiptId: "local-amazon-receipt",
        productId,
        productType: "SUBSCRIPTION",
        purchaseDate: Date.now() - 60000,
        cancelDate: storeState.amazon ? null : Date.now(),
        testTransaction: true,
      });
    }
    return nativeFetch(url, init);
  };
  const nativeRunAction = ctx.runAction;
  ctx.runAction = (ref, args) =>
    getFunctionName(ref) === "files/internal:getAppleP8Key"
      ? Promise.resolve({ keyContent: "local-fixture-key" })
      : nativeRunAction(ref, args);
  const { verifyAppStoreReceiptInternalV1 } =
    await import("../../convex/purchases/ios.ts");
  const { verifyAmazonReceiptInternalV1 } =
    await import("../../convex/purchases/amazon.ts");
  const { verifyMetaHorizonReceiptInternalV1 } =
    await import("../../convex/purchases/horizon.ts");
  const { readBoundPurchaseEntitlements } =
    await import("../../convex/purchases/action.ts");
  const { verifyGooglePlayReceiptInternalV1 } =
    await import("../../convex/purchases/android.ts");
  const { ingestGoogleRtdn } = await import("../../convex/webhooks/google.ts");
  const { deliverPendingEventsHandler } =
    await import("../../convex/commerce/delivery.ts");
  const { client } = await import("../../server/convex.ts");
  const realAction = client.action.bind(client);
  const fixtureActions = {
    "purchases/android:verifyGooglePlayReceiptInternalV1":
      verifyGooglePlayReceiptInternalV1,
    "purchases/ios:verifyAppStoreReceiptInternalV1":
      verifyAppStoreReceiptInternalV1,
    "purchases/amazon:verifyAmazonReceiptInternalV1":
      verifyAmazonReceiptInternalV1,
    "purchases/horizon:verifyMetaHorizonReceiptInternalV1":
      verifyMetaHorizonReceiptInternalV1,
    "purchases/action:readBoundPurchaseEntitlements":
      readBoundPurchaseEntitlements,
  };
  client.action = (ref, args) =>
    fixtureActions[getFunctionName(ref)]
      ? fixtureActions[getFunctionName(ref)]._handler(ctx, args)
      : realAction(ref, args);
  const { commerceRoutes } =
    await import("../../server/api/commerce/routes.ts");
  kitServer = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: new Hono().route("/commerce/v1", commerceRoutes).fetch,
  });
  const { createProvider, CREDENTIALS } = await import(
    join(example, "provider.mjs")
  );
  const { startConsumer } = await import(join(example, "consumer.mjs"));
  const { startAppBackend } = await import(
    join(example, "composition/app-backend.mjs")
  );
  const { createCommerceClient } = await import(
    join(example, "composition/commerce-client.mjs")
  );
  const { deliver } = await import(join(example, "webhooks.mjs"));
  const fixture = {
    store: "google",
    evidence: token,
    userId,
    productId,
    startsAt: startedAt - 60000,
    expiresAt,
  };
  const sqlitePath = join(output, "provider.sqlite");
  sqlite = createProvider(sqlitePath, Date.now, fixture);
  sqliteServer = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) => sqlite.fetch(request),
  });
  receiver = startConsumer({
    secret: [
      { name: "example", projectId: "commerce_example", secret: exampleSecret },
      { name: "iapkit", projectId: seeded.projectId, secret },
    ],
    path: join(output, "receiver.sqlite"),
  });
  const providers = {
    example: {
      baseUrl: `http://127.0.0.1:${sqliteServer.port}`,
      credential: CREDENTIALS.server,
    },
    iapkit: {
      baseUrl: `http://127.0.0.1:${kitServer.port}`,
      credential: `Bearer ${key}`,
    },
  };
  const sessions = new Map([
    ["Bearer local-alice", userId],
    ["Bearer local-bob", "interop_bob"],
  ]);
  appServer = startAppBackend({
    path: join(output, "app.sqlite"),
    providers,
    receiver,
    resolveSession: (request) =>
      sessions.get(request.headers.get("authorization")),
  });
  const appUrl = appServer.url,
    receiverUrl = receiver.url;
  const evidence = { store: "google", google: { purchaseToken: token } };
  const clients = Object.fromEntries(
    Object.entries(providers).map(([name, cfg]) => [
      name,
      createCommerceClient(cfg),
    ]),
  );
  let current = "example";
  async function appCall(
    path,
    method = "GET",
    body,
    session = "Bearer local-alice",
  ) {
    const response = await fetch(appServer.url + path, {
      method,
      headers: { authorization: session, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const result = await response.json().catch(() => null);
    trace.push({
      provider: current,
      path,
      method,
      status: response.status,
      result,
    });
    return { status: response.status, result };
  }
  function select(name) {
    current = name;
    appServer.select(name);
    check(
      `${name}: app and receiver endpoints remain unchanged`,
      [appServer.url, receiver.url],
      [appUrl, receiverUrl],
    );
  }
  const rawEvents = [];
  async function receive(init) {
    rawEvents.push(init);
    return fetch(receiver.url, { ...init, method: "POST" });
  }
  async function drain(name, fail = false) {
    return name === "example"
      ? deliver(sqlite, exampleSecret, Date.now, (init) =>
          fail
            ? Promise.resolve(new Response(null, { status: 503 }))
            : receive(init),
        )
      : deliverPendingEventsHandler(ctx, async (req) =>
          fail
            ? 503
            : (await receive({ headers: req.headers, body: req.body })).status,
        );
  }
  async function observe(kind, id = kind) {
    googleState =
      kind === "expire"
        ? "SUBSCRIPTION_STATE_EXPIRED"
        : kind === "cancel"
          ? "SUBSCRIPTION_STATE_CANCELED"
          : "SUBSCRIPTION_STATE_ACTIVE";
    return ingestGoogleRtdn._handler(ctx, {
      apiKey: publishable,
      oidcToken: "local-fixture-oidc",
      rawMessage: "local-fixture",
      payload: {
        messageId: id,
        packageName: "dev.openiap.interop",
        eventTimeMillis: Date.now(),
        subscriptionNotification: {
          notificationType: kind === "expire" ? 13 : kind === "cancel" ? 3 : 4,
          purchaseToken: token,
          subscriptionId: productId,
        },
      },
    });
  }
  for (const name of Object.keys(providers)) {
    select(name);
    results[name].before = (await appCall("/access")).result;
    check(
      `${name}: empty provider gives no access`,
      results[name].before.productIds,
      [],
    );
    check(
      `${name}: actual verification accepts fixture`,
      (await clients[name].call("verifyPurchase", evidence)).isValid,
      true,
    );
    check(
      `${name}: verification alone does not grant access`,
      (await appCall("/access")).result.productIds,
      [],
    );
    results[name].bound = (
      await appCall("/purchase", "POST", {
        ...evidence,
        userId: "attacker_supplied",
      })
    ).result;
    check(
      `${name}: unchanged app fulfills the purchase`,
      results[name].bound.productIds,
      [productId],
    );
    check(
      `${name}: repeated fulfillment is idempotent`,
      (await appCall("/purchase", "POST", evidence)).result.productIds,
      [productId],
    );
    check(
      `${name}: body cannot select account identity`,
      (
        await clients[name].call("entitlements", {
          userId: "attacker_supplied",
        })
      ).productIds,
      [],
    );
    check(
      `${name}: another user cannot claim the purchase`,
      (
        await clients[name].call("bindPurchase", {
          ...evidence,
          userId: "interop_bob",
        })
      ).bound,
      false,
    );
    const credential =
      name === "example" ? CREDENTIALS.verification : `Bearer ${publishable}`;
    const r = await fetch(
      providers[name].baseUrl + "/commerce/v1/users/erase",
      {
        method: "POST",
        headers: {
          authorization: credential,
          "content-type": "application/json",
        },
        body: JSON.stringify({ userId }),
      },
    );
    check(
      `${name}: publishable verification credentials cannot erase`,
      r.status,
      403,
    );
    if (name === "iapkit") await observe("start");
    await drain(name);
    check(
      `${name}: same receiver persists an authenticated grant`,
      receiver
        .inspect()
        .some(
          (event) =>
            event.projectId ===
              (name === "example" ? "commerce_example" : seeded.projectId) &&
            event.eventType === "entitlement.granted" &&
            event.userId === userId,
        ),
      true,
    );
    if (name === "example")
      sqlite.observe({ id: "cancel", kind: "cancel", occurredAt: Date.now() });
    else await observe("cancel");
    const state = await clients[name].call("subscriptionStatus", { userId });
    results[name].canceled = state;
    check(
      `${name}: cancellation stops renewal but keeps paid access`,
      [state.active, state.subscription.willRenew],
      [true, false],
    );
    await drain(name, true);
  }
  select("example");
  check(
    "Switching back restores the same persisted access",
    (await appCall("/access")).result.productIds,
    [productId],
  );
  const pendingBefore = await admin.query(
    anyApi.interopFixture.inspect,
    seeded,
  );
  check(
    "IAPKit 503 leaves a durable pending delivery",
    pendingBefore.deliveries.some(
      (row) => row.status === "pending" && row.attempts === 1,
    ),
    true,
  );
  console.log(
    "Restarting the actual local Convex process and SQLite provider with retries pending.",
  );
  await stop();
  await boot();
  sqlite.close();
  sqlite = createProvider(sqlitePath, Date.now, fixture);
  check(
    "IAPKit pending deliveries survive process restart",
    (await admin.query(anyApi.interopFixture.inspect, seeded)).deliveries,
    pendingBefore.deliveries,
  );
  await Bun.sleep(Math.max(0, startedAt + 34000 - Date.now()));
  for (const name of Object.keys(providers)) await drain(name);
  for (const projectId of ["commerce_example", seeded.projectId])
    check(
      `${projectId === "commerce_example" ? "example" : "iapkit"}: cancellation retry reaches unchanged receiver`,
      receiver
        .inspect()
        .some(
          (event) =>
            event.projectId === projectId &&
            event.eventType === "subscription.canceled",
        ),
      true,
    );
  const count = receiver.count();
  receiver.reopen();
  for (const init of rawEvents.slice()) await receive(init);
  check(
    "Lost acknowledgements and receiver restart create no duplicate effects",
    receiver.count(),
    count,
  );
  console.log("Waiting for the actual paid expiry deadline.");
  await Bun.sleep(Math.max(0, expiresAt + 10 - Date.now()));
  for (const name of Object.keys(providers)) {
    select(name);
    results[name].expired = (await appCall("/access")).result;
    check(
      `${name}: access expires before a store notification`,
      results[name].expired.productIds,
      [],
    );
  }
  sqlite.observe({ id: "expire", kind: "expire", occurredAt: Date.now() });
  await observe("expire");
  check(
    "Repeated IAPKit store notification is deduplicated",
    (await observe("expire")).deduped,
    true,
  );
  for (const name of Object.keys(providers)) await drain(name);
  for (const projectId of ["commerce_example", seeded.projectId])
    check(
      `${projectId === "commerce_example" ? "example" : "iapkit"}: receiver observes revocation`,
      receiver
        .inspect()
        .some(
          (event) =>
            event.projectId === projectId &&
            event.eventType === "entitlement.revoked",
        ),
      true,
    );
  check(
    "App account deletion is accepted",
    (await appCall("/account", "DELETE")).result.accepted,
    true,
  );
  for (let i = 0; i < 80 && (await appServer.drainErasure()); i++)
    await Bun.sleep(100);
  check(
    "App completes erasure across both configured providers",
    await appServer.drainErasure(),
    0,
  );
  check(
    "Deleted session cannot submit a late purchase",
    (await appCall("/purchase", "POST", evidence)).status,
    401,
  );
  for (const name of Object.keys(providers)) {
    results[name].erased = await clients[name].call("entitlements", { userId });
    check(
      `${name}: erased user has no access`,
      results[name].erased.productIds,
      [],
    );
    const first = await clients[name].call("eraseUser", { userId }),
      again = await clients[name].call("eraseUser", { userId });
    results[name].erasure = again;
    check(
      `${name}: repeated erasure returns the same completed job`,
      [first.status, again.jobId],
      ["completed", first.jobId],
    );
  }
  const erasedState = await admin.query(anyApi.interopFixture.inspect, seeded);
  check(
    "IAPKit persisted subscription, event and job identities are removed",
    JSON.stringify(erasedState).includes(userId),
    false,
  );
  check(
    "Example purchase identity is removed",
    sqlite.inspect().purchases[0].userId,
    null,
  );
  check(
    "Previously delivered app event identities are removed",
    receiver.inspect().some((event) => event.userId === userId),
    false,
  );
  receiver.reopen();
  for (const init of rawEvents.slice()) await receive(init);
  check(
    "Late signed redeliveries after erasure and restart cannot restore identities",
    receiver.inspect().some((event) => event.userId === userId),
    false,
  );
  check(
    "Consumer source files are byte-for-byte unchanged during replacement",
    Object.fromEntries(
      unchangedFiles.map((name) => [name, hash(join(example, name))]),
    ),
    before,
  );
  const { runStoreCoverage } = await import("./commerce-store-coverage.mjs");
  const storeCoverage = await runStoreCoverage({
    example,
    output,
    key,
    kitUrl: `http://127.0.0.1:${kitServer.port}`,
    receiver,
    appleJws,
    storeState,
    inspect: () =>
      admin.query(anyApi.interopFixture.inspect, {
        projectId: seeded.projectId,
      }),
    check,
    trace,
  });
  for (const snapshot of Object.values(inputs)) snapshot.assertUnchanged();
  check(
    "Source revisions remain unchanged throughout execution",
    { openiap: revision(repo), example: revision(example) },
    revisions,
  );
  const report = {
    results,
    storeCoverage,
    harnessHashes: inputs.harness.hashes,
    sources: {
      openiap: {
        baseRevision: revisions.openiap,
        hashes: inputs.openiap.hashes,
        optionalGeneratedFiles: optionalInputs.openiap,
      },
      example: {
        baseRevision: revisions.example,
        hashes: inputs.example.hashes,
      },
      workspace: {
        baseRevision: revisions.openiap,
        hashes: inputs.workspace.hashes,
        optionalGeneratedFiles: optionalInputs.workspace,
      },
    },
    runtime: {
      bun: Bun.version,
      convex: JSON.parse(
        readFileSync(join(kit, "node_modules/convex/package.json"), "utf8"),
      ).version,
    },
    command:
      "bun --conditions=openiap-source packages/kit/scripts/docs/run-commerce-interop.mjs ../openiap-commerce-protocol-example <new-output-directory>",
    configurationChanges: [
      "Commerce base URL and server credential",
      "Separate webhook signing keys, each bound to its provider and project",
      "Example fixture store adapter configured to recognize the same synthetic Google token",
    ],
    recordedAt: new Date().toISOString(),
    checks,
    checkCount: checks.length,
    trace,
    consumerHashes: before,
    changedConsumerFiles: [],
    providerOrder: ["example", "iapkit", "example"],
    backendVersion: config.backendVersion,
    scope: {
      actual: [
        "IAPKit Hono routes and handlers",
        "Apple, Google, Amazon and Horizon verification action bodies; Google RTDN action",
        "Amazon and Horizon stored purchase binding, fresh ownership reads and erasure",
        "Convex persistence, authorization, subscription transitions, erasure scheduler and delivery leases",
        "IAPKit outbound signing and result recording",
        "Original example SQLite provider",
        "One app backend and one receiver, real loopback HTTP",
        "Actual Convex process restart with pending deliveries",
      ],
      fixtures: [
        "Google Play HTTP and OIDC, Amazon RVS and Meta Graph responses",
        "Apple signed-transaction verifier, Server API and test signing-key loader at their external boundaries",
        "Paid subscription and app sessions",
        "HTTPS destination transport redirected to the loopback receiver through the existing worker injection",
      ],
      excluded: [
        "Real store purchase, device SDK integration and store cryptographic verification",
        "Public HTTPS DNS/TLS delivery",
        "Automatic migration of existing purchases between providers",
        "Unrelated image processing and scheduled maintenance crons",
      ],
    },
  };
  writeFileSync(
    join(output, "report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    `Completed ${checks.length} checks. Report: ${join(output, "report.json")}`,
  );
} catch (error) {
  writeFileSync(
    join(output, "failure.json"),
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        completedChecks: checks,
        assertion: error.message,
      },
      null,
      2,
    ) + "\n",
  );
  throw error;
} finally {
  await appServer?.close();
  await receiver?.close();
  await sqliteServer?.stop(true);
  sqlite?.close();
  await kitServer?.stop(true);
  await stop();
}
