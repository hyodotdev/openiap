import assert from "node:assert/strict";
import { join } from "node:path";

// Invoked only inside run-commerce-interop's isolated deployment.
export async function runStoreCoverage({
  example,
  output,
  key,
  kitUrl,
  receiver,
  appleJws,
  storeState,
  inspect,
  check,
  trace,
}) {
  const { createProvider, CREDENTIALS } = await import(
    join(example, "provider.mjs")
  );
  const { createCommerceClient } = await import(
    join(example, "composition/commerce-client.mjs")
  );
  const { startAppBackend } = await import(
    join(example, "composition/app-backend.mjs")
  );
  const kit = createCommerceClient({
    baseUrl: kitUrl,
    credential: `Bearer ${key}`,
  });
  let sqlite;
  const providerServer = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch: (request) => sqlite.fetch(request),
  });
  const exampleUrl = `http://127.0.0.1:${providerServer.port}`;
  const fixtureClient = createCommerceClient({
    baseUrl: exampleUrl,
    credential: CREDENTIALS.server,
  });
  const app = startAppBackend({
    path: join(output, "all-stores-app.sqlite"),
    receiver,
    providers: {
      example: { baseUrl: exampleUrl, credential: CREDENTIALS.server },
      iapkit: { baseUrl: kitUrl, credential: `Bearer ${key}` },
    },
    resolveSession: (request) =>
      request.headers.get("authorization")?.replace("Bearer ", ""),
    resolveStoreUser: (request, store) =>
      request.headers.get("authorization") === `Bearer store_${store}`
        ? `store-user-${store}`
        : null,
  });
  const endpoints = [app.url, receiver.url];
  const results = {};
  async function request(
    store,
    path,
    method = "GET",
    input,
    session = `store_${store}`,
  ) {
    const response = await fetch(app.url + path, {
      method,
      headers: {
        authorization: `Bearer ${session}`,
        "content-type": "application/json",
      },
      ...(input ? { body: JSON.stringify(input) } : {}),
    });
    const result = await response.json().catch(() => null);
    trace.push({ store, path, method, status: response.status, result });
    return { status: response.status, result };
  }
  try {
    for (const store of ["apple", "amazon", "horizon"]) {
      const input =
        store === "apple"
          ? { store, apple: { jws: appleJws } }
          : store === "amazon"
            ? {
                store,
                amazon: {
                  userId: "store-user-amazon",
                  receiptId: "local-amazon-receipt",
                  sandbox: true,
                },
              }
            : {
                store,
                horizon: {
                  userId: "store-user-horizon",
                  sku: "premium.monthly",
                },
              };
      const userId = `store_${store}`;
      const evidence =
        store === "apple"
          ? appleJws
          : store === "amazon"
            ? JSON.stringify([
                input.amazon.userId,
                input.amazon.receiptId,
                true,
              ])
            : JSON.stringify([input.horizon.userId, input.horizon.sku]);
      const fixture = {
        store,
        evidence,
        userId,
        productId: "premium.monthly",
        startsAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        pointInTime: store !== "apple",
        currentVerdict: () => storeState[store],
      };
      sqlite = createProvider(
        join(output, `store-${store}.sqlite`),
        Date.now,
        fixture,
      );
      results[store] = {};
      for (const [name, client] of [
        ["example", fixtureClient],
        ["iapkit", kit],
      ]) {
        app.select(name);
        check(
          `${store}/${name}: keeps the same app and receiver`,
          [app.url, receiver.url],
          endpoints,
        );
        const before = await client.call("entitlements", { userId });
        check(`${store}/${name}: starts without access`, before.productIds, []);
        check(
          `${store}/${name}: unverified evidence cannot bind`,
          (await client.call("bindPurchase", { ...input, userId })).bound,
          false,
        );
        const verified = await client.call("verifyPurchase", input);
        check(
          `${store}/${name}: verifies the store-specific input`,
          verified.isValid,
          true,
        );
        check(
          `${store}/${name}: verification alone grants no account access`,
          (await client.call("entitlements", { userId })).productIds,
          [],
        );
        const bought = await request(store, "/purchase", "POST", input);
        check(`${store}/${name}: app purchase succeeds`, bought.status, 200);
        check(
          `${store}/${name}: app receives access`,
          bought.result?.productIds,
          ["premium.monthly"],
        );
        check(
          `${store}/${name}: binding is repeatable`,
          (await client.call("bindPurchase", { ...input, userId })).bound,
          true,
        );
        check(
          `${store}/${name}: another account cannot claim the purchase`,
          (await client.call("bindPurchase", { ...input, userId: "store_bob" }))
            .bound,
          false,
        );
        const access = await client.call("entitlements", { userId });
        check(
          `${store}/${name}: access includes only verified products`,
          access.productIds,
          ["premium.monthly"],
        );
        check(
          `${store}/${name}: tokenless access does not leak store evidence`,
          JSON.stringify(access).includes("store-user-") ||
            JSON.stringify(access).includes("local-amazon-receipt"),
          false,
        );
        if (store !== "apple") {
          check(
            `${store}/${name}: does not invent subscription lifecycle records`,
            access.subscriptions,
            [],
          );
          const forged = {
            store,
            [store]: { ...input[store], userId: "someone-else" },
          };
          check(
            `${store}/${name}: rejects another store account in the app session`,
            (await request(store, "/purchase", "POST", forged)).status,
            403,
          );
          storeState[store] = "outage";
          check(
            `${store}/${name}: an upstream outage fails the access read`,
            (await request(store, "/access")).status,
            503,
          );
          storeState[store] = false;
          check(
            `${store}/${name}: a negative store recheck removes access`,
            (await client.call("entitlements", { userId })).productIds,
            [],
          );
          storeState[store] = true;
          check(
            `${store}/${name}: rechecked ownership restores access`,
            (await client.call("entitlements", { userId })).productIds,
            ["premium.monthly"],
          );
          if (name === "iapkit") {
            const updatedAt = async () =>
              (await inspect()).purchases.find(
                (row) => row.appUserId === userId,
              )?.updatedAt;
            const before = await updatedAt();
            await client.call("entitlements", { userId });
            check(
              `${store}/iapkit: an unchanged recheck verdict is not written back`,
              await updatedAt(),
              before,
            );
          }
        }
        results[store][name] = {
          verified: verified.isValid,
          productIds: access.productIds,
          subscriptions: access.subscriptions.length,
          storeRecheck: store !== "apple",
        };
      }
      app.select("example");
      check(
        `${store}: switching back needs no consumer edit`,
        (await request(store, "/access")).result.productIds,
        ["premium.monthly"],
      );
      const deleted = await request(store, "/account", "DELETE");
      check(
        `${store}: the app accepts account erasure`,
        deleted.result?.accepted,
        true,
      );
      let pending = 1;
      for (let attempt = 0; attempt < 100 && pending; attempt++) {
        pending = await app.drainErasure();
        if (pending) await Bun.sleep(100);
      }
      check(`${store}: both providers complete erasure`, pending, 0);
      for (const [name, client] of [
        ["example", fixtureClient],
        ["iapkit", kit],
      ]) {
        check(
          `${store}/${name}: erased account has no access`,
          (await client.call("entitlements", { userId })).productIds,
          [],
        );
        check(
          `${store}/${name}: erased user id cannot bind again`,
          (await client.call("bindPurchase", { ...input, userId })).bound,
          false,
        );
      }
      // The erased user id stays refused while its job is retained; IAPKit's
      // Amazon/Horizon evidence does not, unlike the example's permanent mark.
      if (["amazon", "horizon"].includes(store)) {
        const next = `store_next_${store}`;
        check(
          `${store}/example: erased evidence cannot bind to another account`,
          (await fixtureClient.call("bindPurchase", { ...input, userId: next }))
            .bound,
          false,
        );
        check(
          `${store}/iapkit: another account can bind the erased evidence`,
          (await kit.call("bindPurchase", { ...input, userId: next })).bound,
          true,
        );
        check(
          `${store}/iapkit: the new account receives the rechecked access`,
          (await kit.call("entitlements", { userId: next })).productIds,
          ["premium.monthly"],
        );
      }
      check(
        `${store}: an erased session cannot submit another purchase`,
        (await request(store, "/purchase", "POST", input)).status,
        401,
      );
      const state = await inspect();
      check(
        `${store}: IAPKit removes account identity from persisted purchases`,
        state.purchases.some((row) => row.appUserId === userId),
        false,
      );
      sqlite.close();
      sqlite = null;
    }
    assert.equal(Object.keys(results).length, 3);
    return results;
  } finally {
    await app.close();
    await providerServer.stop(true);
    sqlite?.close();
  }
}
