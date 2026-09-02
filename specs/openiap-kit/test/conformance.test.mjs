// The conformance runner must certify a provider built only from the
// specification, and must actually fail when a provider breaks a rule —
// a runner that cannot reject is decoration.

import Ajv from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

import { createHmac } from "node:crypto";

import {
  createGraphqlAdapter,
  createRestAdapter,
  normalizeResultData,
  operationVectors,
  runConformance,
  signatureVectors,
} from "../conformance/index.mjs";
import { createMockProvider } from "../conformance/mock-provider.mjs";

// A full events provider written only from SPEC.md §9 — signing, verification,
// the delivery envelope, response semantics, and the emission rules. No IAPKit
// code is imported; passing certifies the specification, not one backend.
const WEBHOOK_HEADERS = signatureVectors.headers;
const TOLERANCE_SECONDS = signatureVectors.toleranceSeconds;

// §9.4.2: HMAC-SHA256 over ascii(timestamp) || 0x2e || body, hex, `v1=`.
function signFromSpec(secret, timestamp, body) {
  return `v1=${createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex")}`;
}

const referenceEventsAdapter = {
  sign: ({ secret, timestamp, body }) => signFromSpec(secret, timestamp, body),
  // §9.4.2 consumer: tolerance, split-and-compare against every held secret.
  verify: ({ body, timestamp, signature, secrets, now }) => {
    if (Math.abs(now - timestamp) > TOLERANCE_SECONDS) return false;
    const held = secrets.map((secret) => signFromSpec(secret, timestamp, body));
    return String(signature)
      .split(",")
      .map((part) => part.trim())
      .some((presented) => held.includes(presented));
  },
  // §9.4.1: POST envelope with the four headers; retries reuse deliveryId.
  delivery: ({ event, body, timestamp, secrets, deliveryId }) => ({
    method: "POST",
    contentType: "application/json",
    headers: {
      [WEBHOOK_HEADERS.signature]: secrets
        .map((secret) => signFromSpec(secret, timestamp, body))
        .join(","),
      [WEBHOOK_HEADERS.timestamp]: String(timestamp),
      [WEBHOOK_HEADERS.eventId]: event.eventId,
      [WEBHOOK_HEADERS.deliveryId]: deliveryId,
    },
  }),
  // §9.4.3 response → action; a timeout or connection error is a retry.
  classifyResponse: (status) => {
    if (status === "connection-error" || status === "timeout") return "retry";
    if (status >= 200 && status < 300) return "delivered";
    if (status === 408 || status === 429 || status >= 500) return "retry";
    return "permanent-failure";
  },
  // §2.3: Active/InGracePeriod grant access; expiry is exclusive.
  entitled: ({ state, expiresAt, processedAt }) =>
    (state === "Active" || state === "InGracePeriod") &&
    (expiresAt === undefined || processedAt < expiresAt),
  // §9.1: the lifecycle event, then an entitlement event only when the gate flips.
  emission: ({ lifecycleEvent, entitledBefore, entitledAfter }) => {
    const events = [];
    if (lifecycleEvent) events.push(lifecycleEvent);
    if (entitledBefore !== entitledAfter) {
      events.push(
        entitledAfter ? "entitlement.granted" : "entitlement.revoked",
      );
    }
    return events;
  },
  // §2.4: coalesce unbound gate deltas into one grant iff currently entitled.
  coalesceAtBinding: ({ entitledAtBinding }) =>
    entitledAtBinding ? ["entitlement.granted"] : [],
};

function response2(body, response) {
  return new Response(JSON.stringify(body), {
    status: response.status,
    headers: { "Content-Type": "application/json" },
  });
}

const BASE_URL = "https://mock.provider.example";
const GRAPHQL_URL = `${BASE_URL}/commerce/v1/graphql`;

function adaptersFor(provider) {
  return [
    createRestAdapter({
      baseUrl: BASE_URL,
      fetch: provider.fetch,
      credentials: provider.credentials,
    }),
    createGraphqlAdapter({
      url: GRAPHQL_URL,
      fetch: provider.fetch,
      credentials: provider.credentials,
    }),
  ];
}

describe("the portable conformance runner", () => {
  it("passes the independent mock provider on both bindings with parity", async () => {
    const provider = createMockProvider();
    const report = await runConformance({
      adapters: adaptersFor(provider),
      Ajv,
      credentials: provider.credentials,
    });
    const failed = report.results.filter((result) => !result.ok);
    expect(failed).toEqual([]);
    expect(report.parityFailures).toEqual([]);
    expect(report.ok).toBe(true);
    // Both bindings actually ran: every binding-neutral case appears twice.
    const bindings = new Set(report.results.map((result) => result.binding));
    expect([...bindings].sort()).toEqual(["graphql", "rest"]);
  });

  it("needs no IAPKit code and no network beyond the injected fetch", async () => {
    const provider = createMockProvider();
    const source = await import("../conformance/mock-provider.mjs");
    expect(source).toBeTruthy();
    // The runner reaches the provider only through fetch; a runner-side
    // network dependency would bypass this stub and reject here.
    const report = await runConformance({
      adapters: [
        createRestAdapter({
          baseUrl: BASE_URL,
          fetch: provider.fetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    expect(report.ok).toBe(true);
  });

  it("rejects a provider that leaks purchase tokens from account reads", async () => {
    const provider = createMockProvider();
    const leakyFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).includes("/subscriptions/status")) {
        const body = await response.json();
        if (body.subscription) {
          body.subscription.purchaseToken = "leaked-token";
        }
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createRestAdapter({
          baseUrl: BASE_URL,
          fetch: leakyFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const failure = report.results.find(
      (result) => result.id === "subscriptionStatus.success.contract",
    );
    expect(failure.ok).toBe(false);
    expect(failure.failures.join(" ")).toContain("token members");
  });

  it("rejects rawReceipt / providerInternalId smuggled into a tokenless read (closed schema)", async () => {
    // Not a name-blocklist test: the SubscriptionStatusSnapshot schema is
    // CLOSED, so any member beyond the declared set fails validation — no
    // matter what the smuggled member is named.
    const provider = createMockProvider();
    for (const smuggled of [
      "rawReceipt",
      "providerInternalId",
      "internalRecordId",
      "somethingNewNobodyBlocklisted",
    ]) {
      const fetchLeak = async (url, options) => {
        const response = await provider.fetch(url, options);
        if (String(url).includes("/subscriptions/status")) {
          const body = await response.json();
          if (body.subscription) body.subscription[smuggled] = "SECRET";
          return new Response(JSON.stringify(body), {
            status: response.status,
            headers: { "Content-Type": "application/json" },
          });
        }
        return response;
      };
      const report = await runConformance({
        adapters: [
          createRestAdapter({
            baseUrl: BASE_URL,
            fetch: fetchLeak,
            credentials: provider.credentials,
          }),
        ],
        Ajv,
        credentials: provider.credentials,
      });
      const failure = report.results.find(
        (r) => r.id === "subscriptionStatus.success.contract",
      );
      expect(failure.ok, smuggled).toBe(false);
      expect(report.ok).toBe(false);
    }
  });

  it("rejects a self-contradicting status (active vs subscription.active)", async () => {
    const provider = createMockProvider();
    const contradictFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).includes("/subscriptions/status")) {
        const body = await response.json();
        // outer active:false but the snapshot claims active:true.
        body.active = false;
        if (body.subscription) body.subscription.active = true;
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createRestAdapter({
          baseUrl: BASE_URL,
          fetch: contradictFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const failure = report.results.find(
      (r) => r.id === "subscriptionStatus.success.contract",
    );
    expect(failure.ok).toBe(false);
    expect(failure.failures.join(" ")).toContain("disagrees");
  });

  it("rejects entitlements whose productIds do not match the active subscriptions", async () => {
    const provider = createMockProvider();
    const skewFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).includes("/commerce/v1/entitlements")) {
        const body = await response.json();
        if (Array.isArray(body.productIds)) {
          body.productIds = [...body.productIds, "ghost.product"];
        }
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createRestAdapter({
          baseUrl: BASE_URL,
          fetch: skewFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const failure = report.results.find(
      (r) => r.id === "entitlements.success.contract",
    );
    expect(failure.ok).toBe(false);
    expect(failure.failures.join(" ")).toContain("deduplicated set");
  });

  it("rejects a provider that skips auth", async () => {
    const provider = createMockProvider();
    const openFetch = (url, options = {}) => {
      const headers = new Headers(options.headers);
      headers.set("Authorization", `Bearer ${provider.credentials.server}`);
      return provider.fetch(url, { ...options, headers });
    };
    const report = await runConformance({
      adapters: [
        createRestAdapter({
          baseUrl: BASE_URL,
          fetch: openFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const failure = report.results.find(
      (result) => result.id === "subscriptionStatus.auth.missing-credential",
    );
    expect(failure.ok).toBe(false);
  });

  it("rejects a REST binding that maps an error to the wrong HTTP status", async () => {
    const provider = createMockProvider();
    const wrongStatusFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (response.status === 401) {
        return new Response(await response.text(), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createRestAdapter({
          baseUrl: BASE_URL,
          fetch: wrongStatusFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const failures = report.results.filter(
      (result) => !result.ok && result.id.endsWith("auth.missing-credential"),
    );
    expect(failures.length).toBeGreaterThan(0);
    expect(failures[0].failures.join(" ")).toContain("REST status");
  });

  it("fails parity when the two bindings answer differently", async () => {
    const provider = createMockProvider();
    const skewedFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).includes("/commerce/v1/entitlements?")) {
        const body = await response.json();
        if (!Array.isArray(body.productIds)) {
          return new Response(JSON.stringify(body), {
            status: response.status,
            headers: { "Content-Type": "application/json" },
          });
        }
        body.productIds = [...body.productIds, "rest-only-product"];
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createRestAdapter({
          baseUrl: BASE_URL,
          fetch: skewedFetch,
          credentials: provider.credentials,
        }),
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: skewedFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    expect(
      report.parityFailures.some(
        (failure) => failure.id === "entitlements.success.contract",
      ),
    ).toBe(true);
  });

  it("rejects an operationName-only GraphQL dispatcher via the executor probe", async () => {
    const provider = createMockProvider();
    // Wrap the provider so its GraphQL endpoint ignores the query text and
    // dispatches on operationName alone — the exact fake the probe must catch.
    const dispatcherFetch = async (url, options) => {
      if (!String(url).endsWith("/commerce/v1/graphql")) {
        return provider.fetch(url, options);
      }
      const payload = JSON.parse(options.body);
      const name = payload.operationName;
      if (name && name !== "IntrospectionQuery") {
        // Delegate the real operation by sending its canonical document,
        // regardless of the (possibly broken) query the caller supplied.
        const canonical = {
          query: (
            await import("openiap-commerce-protocol/generated/bindings/graphql-operations.json")
          ).default.operations[name.charAt(0).toLowerCase() + name.slice(1)]
            .document,
          operationName: name,
          variables: payload.variables,
        };
        return provider.fetch(url, {
          ...options,
          body: JSON.stringify(canonical),
        });
      }
      return provider.fetch(url, options);
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: dispatcherFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const probe = report.results.find((r) => r.id === "graphql.executor-probe");
    expect(probe.ok).toBe(false);
    expect(probe.failures.join(" ")).toContain("operationName-only dispatch");
    expect(report.ok).toBe(false);
  });

  it("mock GraphQL endpoint parses and validates, not just operationName dispatch", async () => {
    const provider = createMockProvider();
    const call = (query, variables) =>
      provider
        .fetch(GRAPHQL_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, variables }),
        })
        .then((r) => r.json());

    // A syntactically broken query — an operationName-only dispatcher would
    // never see this, since it ignores the query text.
    const brokenParse = await call("query { this is not graphql", {});
    expect(brokenParse.errors[0].extensions.code).toBe("INVALID_REQUEST");

    // A query selecting a field the schema does not define fails validation.
    const invalidField = await call("query { notARealOperation }", {});
    expect(invalidField.errors[0].extensions.code).toBe("INVALID_REQUEST");

    // A valid document with a full selection resolves.
    const ok = await call("query { providerCapabilities { specVersion } }", {});
    expect(ok.data.providerCapabilities.specVersion).toBeTruthy();
  });

  it("normalizes GraphQL nulls to omission before judging", () => {
    expect(
      normalizeResultData({
        active: false,
        subscription: null,
        nested: { kept: 1, dropped: null },
      }),
    ).toEqual({ active: false, nested: { kept: 1 } });
  });

  it("keeps the vectors honest about what they do not certify", () => {
    expect(operationVectors.$comment).toContain(
      "never certify real store receipt validity",
    );
  });

  it("certifies a full events provider across signing, verification, delivery, response, and emission", async () => {
    const provider = createMockProvider({ declareEvents: true });
    const report = await runConformance({
      adapters: adaptersFor(provider),
      Ajv,
      credentials: provider.credentials,
      eventsAdapter: referenceEventsAdapter,
    });
    const eventsResults = report.results.filter(
      (r) => r.id === "events.profile-verification",
    );
    expect(eventsResults.length).toBeGreaterThan(0);
    for (const result of eventsResults) {
      expect(result.ok, result.failures.join(" ")).toBe(true);
    }
    expect(report.ok).toBe(true);
    expect(signatureVectors.cases.length).toBeGreaterThan(0);
  });

  it("fails a signing-only events provider (the events profile is more than a signer)", async () => {
    const provider = createMockProvider({ declareEvents: true });
    const report = await runConformance({
      adapters: adaptersFor(provider),
      Ajv,
      credentials: provider.credentials,
      // A correct signer but nothing else: no verify, delivery, response
      // classification, or emission rules. This must not certify events.
      eventsAdapter: { sign: referenceEventsAdapter.sign },
    });
    const eventsResult = report.results.find(
      (r) => r.id === "events.profile-verification" && r.binding === "rest",
    );
    expect(eventsResult.ok).toBe(false);
    const joined = eventsResult.failures.join(" ");
    expect(joined).toContain("signing-only provider");
    for (const method of [
      "verify",
      "delivery",
      "classifyResponse",
      "entitled",
      "emission",
      "coalesceAtBinding",
    ]) {
      expect(joined).toContain(`eventsAdapter.${method}`);
    }
    expect(report.ok).toBe(false);
  });

  it("fails an adapter whose entitlement gate treats the expiry boundary as inclusive", async () => {
    const provider = createMockProvider({ declareEvents: true });
    const report = await runConformance({
      adapters: adaptersFor(provider),
      Ajv,
      credentials: provider.credentials,
      eventsAdapter: {
        ...referenceEventsAdapter,
        // processedAt == expiresAt must NOT be entitled (SPEC.md 2.3).
        entitled: ({ state, expiresAt, processedAt }) =>
          (state === "Active" || state === "InGracePeriod") &&
          (expiresAt === undefined || processedAt <= expiresAt),
      },
    });
    const eventsResult = report.results.find(
      (r) => r.id === "events.profile-verification" && r.binding === "rest",
    );
    expect(eventsResult.ok).toBe(false);
    expect(eventsResult.failures.join(" ")).toContain(
      "expires exactly at processing",
    );
    expect(report.ok).toBe(false);
  });

  it("fails an events provider whose verifier accepts a tampered delivery", async () => {
    const provider = createMockProvider({ declareEvents: true });
    const report = await runConformance({
      adapters: adaptersFor(provider),
      Ajv,
      credentials: provider.credentials,
      eventsAdapter: { ...referenceEventsAdapter, verify: () => true },
    });
    const eventsResult = report.results.find(
      (r) => r.id === "events.profile-verification" && r.binding === "rest",
    );
    expect(eventsResult.ok).toBe(false);
    expect(eventsResult.failures.join(" ")).toContain("must be rejected");
    expect(report.ok).toBe(false);
  });

  it("fails an events provider whose emission rule omits a required entitlement event", async () => {
    const provider = createMockProvider({ declareEvents: true });
    const report = await runConformance({
      adapters: adaptersFor(provider),
      Ajv,
      credentials: provider.credentials,
      // Never emits the entitlement event that must accompany a gate flip.
      eventsAdapter: {
        ...referenceEventsAdapter,
        emission: ({ lifecycleEvent }) =>
          lifecycleEvent ? [lifecycleEvent] : [],
      },
    });
    const eventsResult = report.results.find(
      (r) => r.id === "events.profile-verification" && r.binding === "rest",
    );
    expect(eventsResult.ok).toBe(false);
    expect(eventsResult.failures.join(" ")).toContain("emission");
    expect(report.ok).toBe(false);
  });

  it("fails an events provider that treats a permanent failure as retryable", async () => {
    const provider = createMockProvider({ declareEvents: true });
    const report = await runConformance({
      adapters: adaptersFor(provider),
      Ajv,
      credentials: provider.credentials,
      eventsAdapter: {
        ...referenceEventsAdapter,
        // 3xx and non-408/429 4xx are permanent; retrying them is wrong.
        classifyResponse: (status) =>
          status >= 200 && status < 300 ? "delivered" : "retry",
      },
    });
    const eventsResult = report.results.find(
      (r) => r.id === "events.profile-verification" && r.binding === "rest",
    );
    expect(eventsResult.ok).toBe(false);
    expect(eventsResult.failures.join(" ")).toContain("permanent-failure");
    expect(report.ok).toBe(false);
  });

  it("fails a delivery envelope that is not POST application/json", async () => {
    const provider = createMockProvider({ declareEvents: true });
    const report = await runConformance({
      adapters: adaptersFor(provider),
      Ajv,
      credentials: provider.credentials,
      eventsAdapter: {
        ...referenceEventsAdapter,
        // Signs correctly but ships the wrong transport shape.
        delivery: async (args) => ({
          ...(await referenceEventsAdapter.delivery(args)),
          method: "GET",
          contentType: "text/plain",
        }),
      },
    });
    const eventsResult = report.results.find(
      (r) => r.id === "events.profile-verification" && r.binding === "rest",
    );
    expect(eventsResult.ok).toBe(false);
    const joined = eventsResult.failures.join(" ");
    expect(joined).toContain("must be POST");
    expect(joined).toContain("application/json");
    expect(report.ok).toBe(false);
  });

  it("fails an adapter that classifies a timeout or connection error as permanent", async () => {
    const provider = createMockProvider({ declareEvents: true });
    const report = await runConformance({
      adapters: adaptersFor(provider),
      Ajv,
      credentials: provider.credentials,
      eventsAdapter: {
        ...referenceEventsAdapter,
        // Correct on every HTTP status, wrong on the no-response outcomes.
        classifyResponse: (status) =>
          typeof status === "number"
            ? referenceEventsAdapter.classifyResponse(status)
            : "permanent-failure",
      },
    });
    const eventsResult = report.results.find(
      (r) => r.id === "events.profile-verification" && r.binding === "rest",
    );
    expect(eventsResult.ok).toBe(false);
    expect(eventsResult.failures.join(" ")).toContain("connection-error");
    expect(report.ok).toBe(false);
  });

  it("fails a verifier that requires every presented rotation signature to match", async () => {
    const provider = createMockProvider({ declareEvents: true });
    const report = await runConformance({
      adapters: adaptersFor(provider),
      Ajv,
      credentials: provider.credentials,
      eventsAdapter: {
        ...referenceEventsAdapter,
        // AND semantics instead of the §9.4.2 any-pair rule: correct for the
        // single-signature cases and stricter on every rejection, so only the
        // rotation checks can catch it.
        verify: ({ body, timestamp, signature, secrets, now }) => {
          if (Math.abs(now - timestamp) > signatureVectors.toleranceSeconds) {
            return false;
          }
          const held = secrets.map((secret) =>
            referenceEventsAdapter.sign({ secret, timestamp, body }),
          );
          return String(signature)
            .split(",")
            .map((part) => part.trim())
            .every((presented) => held.includes(presented));
        },
      },
    });
    const eventsResult = report.results.find(
      (r) => r.id === "events.profile-verification" && r.binding === "rest",
    );
    expect(eventsResult.ok).toBe(false);
    const joined = eventsResult.failures.join(" ");
    expect(joined).toContain("holding only the previous secret");
    expect(joined).toContain("holding only the current secret");
    expect(report.ok).toBe(false);
  });

  it("fails a declared events profile with no events adapter", async () => {
    const provider = createMockProvider({ declareEvents: true });
    const report = await runConformance({
      adapters: adaptersFor(provider),
      Ajv,
      credentials: provider.credentials,
    });
    const eventsResult = report.results.find(
      (r) => r.id === "events.profile-verification" && r.binding === "rest",
    );
    expect(eventsResult.ok).toBe(false);
    expect(eventsResult.failures.join(" ")).toContain("no eventsAdapter");
    expect(report.ok).toBe(false);
  });

  it("fails a declared events profile whose signer is wrong", async () => {
    const provider = createMockProvider({ declareEvents: true });
    const report = await runConformance({
      adapters: adaptersFor(provider),
      Ajv,
      credentials: provider.credentials,
      eventsAdapter: { sign: () => "v1=deadbeef" },
    });
    const eventsResult = report.results.find(
      (r) => r.id === "events.profile-verification" && r.binding === "rest",
    );
    expect(eventsResult.ok).toBe(false);
    expect(eventsResult.failures.join(" ")).toContain("signature vector");
  });

  it("fails a provider whose descriptor version disagrees with the manifest", async () => {
    const provider = createMockProvider();
    const skewedFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).includes("/commerce/v1/capabilities")) {
        const body = await response.json();
        body.profiles = { ...body.profiles, verification: "9.9" };
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createRestAdapter({
          baseUrl: BASE_URL,
          fetch: skewedFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const versionResult = report.results.find(
      (r) => r.id === "capabilities.version-agreement",
    );
    expect(versionResult.ok).toBe(false);
    expect(versionResult.failures.join(" ")).toContain("verification");
  });

  // The additive-minor introspection case is covered by "certifies
  // introspection carrying additive minor surface" below, against the
  // structural comparison the probe actually runs.

  it("certifies a provider whose GraphQL request errors carry no protocol code (SPEC 7 allows it)", async () => {
    const provider = createMockProvider();
    const codelessFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        // Simulate an engine that leaves graphql-js request errors codeless:
        // strip extensions only where the mock stamped INVALID_REQUEST onto a
        // dataless response (parse/validation/coercion). Coded pre-execution
        // rejections (auth) are operation failures and keep their codes.
        if (!("data" in body) && Array.isArray(body.errors)) {
          for (const error of body.errors) {
            if (error.extensions?.code === "INVALID_REQUEST") {
              delete error.extensions;
            }
          }
        }
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createRestAdapter({
          baseUrl: BASE_URL,
          fetch: codelessFetch,
          credentials: provider.credentials,
        }),
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: codelessFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const failed = report.results.filter((result) => !result.ok);
    expect(failed).toEqual([]);
    expect(report.parityFailures).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it("certifies a provider that disables introspection (SPEC 7: 'where enabled')", async () => {
    const provider = createMockProvider();
    const noIntrospectionFetch = async (url, options) => {
      if (
        String(url).endsWith("/commerce/v1/graphql") &&
        String(options?.body ?? "").includes("__schema")
      ) {
        return new Response(
          JSON.stringify({
            errors: [{ message: "introspection is disabled" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return provider.fetch(url, options);
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: noIntrospectionFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const probe = report.results.find((r) => r.id === "graphql.executor-probe");
    expect(probe.ok, probe.failures.join(" ")).toBe(true);
    expect(report.ok).toBe(true);
  });

  it("fails a GraphQL adapter that cannot be probed (no rawGraphql)", async () => {
    const provider = createMockProvider();
    const adapter = createGraphqlAdapter({
      url: GRAPHQL_URL,
      fetch: provider.fetch,
      credentials: provider.credentials,
    });
    delete adapter.rawGraphql;
    const report = await runConformance({
      adapters: [adapter],
      Ajv,
      credentials: provider.credentials,
    });
    const probe = report.results.find((r) => r.id === "graphql.executor-probe");
    expect(probe.ok).toBe(false);
    expect(probe.failures.join(" ")).toContain("rawGraphql");
    expect(report.ok).toBe(false);
  });

  it("fails a zero-tolerance signature verifier (clock skew inside 300s must be accepted)", async () => {
    const provider = createMockProvider({ declareEvents: true });
    const report = await runConformance({
      adapters: adaptersFor(provider),
      Ajv,
      credentials: provider.credentials,
      eventsAdapter: {
        ...referenceEventsAdapter,
        verify: ({ body, timestamp, signature, secrets, now }) => {
          if (now !== timestamp) return false; // tolerates zero skew only
          const held = secrets.map((secret) =>
            referenceEventsAdapter.sign({ secret, timestamp, body }),
          );
          return String(signature)
            .split(",")
            .map((part) => part.trim())
            .some((presented) => held.includes(presented));
        },
      },
    });
    const eventsResult = report.results.find(
      (r) => r.id === "events.profile-verification" && r.binding === "rest",
    );
    expect(eventsResult.ok).toBe(false);
    expect(eventsResult.failures.join(" ")).toContain("skew");
    expect(report.ok).toBe(false);
  });

  it("fails a provider whose request errors echo the submitted value (SPEC 8)", async () => {
    const provider = createMockProvider();
    const echoFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (!("data" in body) && Array.isArray(body.errors)) {
          for (const error of body.errors) {
            if (error.extensions?.code === "INVALID_REQUEST") {
              // A raw graphql-js engine would say: Variable "$input" got
              // invalid value "not-an-input-object"; ...
              error.message = `Variable "$input" got invalid value ${JSON.stringify(JSON.parse(String(options?.body ?? "{}")).variables?.input ?? null)}`;
            }
          }
        }
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: echoFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const probe = report.results.find((r) => r.id === "graphql.executor-probe");
    expect(probe.ok).toBe(false);
    expect(probe.failures.join(" ")).toContain("echoes the submitted input");
    expect(report.ok).toBe(false);
  });

  it("certifies cross-binding parity when REST carries an additive minor member GraphQL cannot select", async () => {
    const provider = createMockProvider();
    const additiveRestFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/purchases/verify")) {
        const body = await response.json();
        // Only the SUCCESS body: the error envelope is CLOSED by design.
        if ("error" in body) return response2(body, response);
        // VerifyPurchaseResult is an OPEN object: a 1.1 provider may add an
        // optional member (SPEC 12, MINOR). The frozen canonical GraphQL
        // selection cannot fetch it, so parity must ignore it.
        body.futureMinorMember = "additive";
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createRestAdapter({
          baseUrl: BASE_URL,
          fetch: additiveRestFetch,
          credentials: provider.credentials,
        }),
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: provider.fetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    expect(report.parityFailures).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it("survives an adapter throw: one dropped connection fails that case, not the run", async () => {
    const provider = createMockProvider();
    const flakyFetch = async (url, options) => {
      if (String(url).includes("/commerce/v1/entitlements")) {
        throw new TypeError("fetch failed");
      }
      return provider.fetch(url, options);
    };
    const report = await runConformance({
      adapters: [
        createRestAdapter({
          baseUrl: BASE_URL,
          fetch: flakyFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    // The run completed and every non-entitlements case still reported.
    expect(
      report.results.some(
        (r) => r.id === "subscriptionStatus.success.contract" && r.ok,
      ),
    ).toBe(true);
    const failed = report.results.find(
      (r) => r.id === "entitlements.success.contract",
    );
    expect(failed.ok).toBe(false);
    expect(failed.failures.join(" ")).toContain("adapter threw");
    expect(report.ok).toBe(false);
  });

  it("fails parity when GraphQL silently drops a contract member REST still serves", async () => {
    // The projection shape is the GENERATED canonical selection, not the live
    // GraphQL answer — otherwise deleting `environment` from the GraphQL side
    // would delete it from the REST side of the comparison too, and a missing
    // contract member would hide.
    const provider = createMockProvider();
    const dropFieldFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (body?.data?.verifyPurchase) {
          expect(body.data.verifyPurchase.environment).toBeDefined();
          delete body.data.verifyPurchase.environment;
        }
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createRestAdapter({
          baseUrl: BASE_URL,
          fetch: provider.fetch,
          credentials: provider.credentials,
        }),
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: dropFieldFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    expect(
      report.parityFailures.some((f) => f.id.startsWith("verifyPurchase")),
    ).toBe(true);
    expect(report.ok).toBe(false);
  });

  it("rejects an entitlements answer echoing a different userId than requested", async () => {
    const provider = createMockProvider();
    const wrongUserFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).includes("/commerce/v1/entitlements")) {
        const body = await response.json();
        body.userId = "different-user";
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createRestAdapter({
          baseUrl: BASE_URL,
          fetch: wrongUserFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const failure = report.results.find(
      (r) => r.id === "entitlements.success.contract",
    );
    expect(failure.ok).toBe(false);
    expect(failure.failures.join(" ")).toContain("was requested");
    expect(report.ok).toBe(false);
  });

  it("fails a delivery that declares Content-Encoding beyond identity", async () => {
    const provider = createMockProvider({ declareEvents: true });
    const report = await runConformance({
      adapters: adaptersFor(provider),
      Ajv,
      credentials: provider.credentials,
      eventsAdapter: {
        ...referenceEventsAdapter,
        delivery: async (args) => {
          const composed = await referenceEventsAdapter.delivery(args);
          return {
            ...composed,
            headers: { ...composed.headers, "Content-Encoding": "gzip" },
          };
        },
      },
    });
    const eventsResult = report.results.find(
      (r) => r.id === "events.profile-verification" && r.binding === "rest",
    );
    expect(eventsResult.ok).toBe(false);
    expect(eventsResult.failures.join(" ")).toContain("Content-Encoding");
    expect(report.ok).toBe(false);
  });

  it("rejects executor-probe responses whose errors carry no message", async () => {
    const provider = createMockProvider();
    const messagelessFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (!("data" in body) && Array.isArray(body.errors)) {
          body.errors = body.errors.map(() => ({}));
        }
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: messagelessFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const probe = report.results.find((r) => r.id === "graphql.executor-probe");
    expect(probe.ok).toBe(false);
    expect(report.ok).toBe(false);
  });

  it("does not treat an HTTP 500 introspection answer as introspection-disabled", async () => {
    const provider = createMockProvider();
    const brokenIntrospectionFetch = async (url, options) => {
      if (
        String(url).endsWith("/commerce/v1/graphql") &&
        String(options?.body ?? "").includes("__schema")
      ) {
        return new Response(JSON.stringify({ errors: [{ message: "boom" }] }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      return provider.fetch(url, options);
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: brokenIntrospectionFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const probe = report.results.find((r) => r.id === "graphql.executor-probe");
    expect(probe.ok).toBe(false);
    expect(report.ok).toBe(false);
  });

  it("fails an events provider that emits an event type its descriptor does not declare", async () => {
    const provider = createMockProvider({ declareEvents: true });
    const underDeclaredFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).includes("/commerce/v1/capabilities")) {
        const body = await response.json();
        // The mock's emission rules produce subscription.* types too; a
        // descriptor listing only the entitlement pair is dishonest (§10).
        body.eventTypes = ["entitlement.granted", "entitlement.revoked"];
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createRestAdapter({
          baseUrl: BASE_URL,
          fetch: underDeclaredFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
      eventsAdapter: referenceEventsAdapter,
    });
    const eventsResult = report.results.find(
      (r) => r.id === "events.profile-verification",
    );
    expect(eventsResult.ok).toBe(false);
    expect(eventsResult.failures.join(" ")).toContain("does not declare");
    expect(report.ok).toBe(false);
  });

  it("rejects a coded request rejection delivered at HTTP 400 (SPEC 7: coded means 200)", async () => {
    const provider = createMockProvider();
    const coded400Fetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (!("data" in body) && Array.isArray(body.errors)) {
          return new Response(
            JSON.stringify({
              errors: body.errors.map(() => ({
                message: "Request rejected",
                extensions: { code: "INVALID_REQUEST" },
              })),
            }),
            { status: 400, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: coded400Fetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const probe = report.results.find((r) => r.id === "graphql.executor-probe");
    expect(probe.ok).toBe(false);
    expect(report.ok).toBe(false);
  });

  it("rejects a request rejection carrying a more specific code than INVALID_REQUEST", async () => {
    const provider = createMockProvider();
    const specificCodeFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (!("data" in body) && Array.isArray(body.errors)) {
          for (const error of body.errors) {
            error.extensions = { code: "UNSUPPORTED_PROFILE" };
          }
        }
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: specificCodeFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const probe = report.results.find((r) => r.id === "graphql.executor-probe");
    expect(probe.ok).toBe(false);
    expect(report.ok).toBe(false);
  });

  it("rejects a request rejection that carries a data member (SPEC 7: omitted entirely)", async () => {
    const provider = createMockProvider();
    const dataNullFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (!("data" in body) && Array.isArray(body.errors)) {
          body.data = null;
        }
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: dataNullFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const probe = report.results.find((r) => r.id === "graphql.executor-probe");
    expect(probe.ok).toBe(false);
    expect(report.ok).toBe(false);
  });

  it("does not accept a data-carrying rejection as introspection-disabled", async () => {
    // The only path where the §7 data-omission rule is load-bearing on its
    // own: probes 1-3 carry their own data checks, but a disabled-looking
    // introspection answer with `data: null` must not count as a well-formed
    // request rejection.
    const provider = createMockProvider();
    const dataNullIntrospection = async (url, options) => {
      if (
        String(url).endsWith("/commerce/v1/graphql") &&
        String(options?.body ?? "").includes("__schema")
      ) {
        return new Response(
          JSON.stringify({
            data: null,
            errors: [{ message: "introspection is disabled" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return provider.fetch(url, options);
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: dataNullIntrospection,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const probe = report.results.find((r) => r.id === "graphql.executor-probe");
    expect(probe.ok).toBe(false);
    expect(report.ok).toBe(false);
  });

  it("catches a forbidden Content-Encoding even behind a second differently-cased header", async () => {
    const provider = createMockProvider({ declareEvents: true });
    const report = await runConformance({
      adapters: adaptersFor(provider),
      Ajv,
      credentials: provider.credentials,
      eventsAdapter: {
        ...referenceEventsAdapter,
        delivery: async (args) => {
          const composed = await referenceEventsAdapter.delivery(args);
          return {
            ...composed,
            headers: {
              ...composed.headers,
              "Content-Encoding": "identity",
              "content-encoding": "gzip",
            },
          };
        },
      },
    });
    const eventsResult = report.results.find(
      (r) => r.id === "events.profile-verification" && r.binding === "rest",
    );
    expect(eventsResult.ok).toBe(false);
    expect(eventsResult.failures.join(" ")).toContain("Content-Encoding");
  });

  it("rejects duplicate timestamp headers with different casing", async () => {
    const provider = createMockProvider({ declareEvents: true });
    const report = await runConformance({
      adapters: adaptersFor(provider),
      Ajv,
      credentials: provider.credentials,
      eventsAdapter: {
        ...referenceEventsAdapter,
        delivery: async (args) => {
          const composed = await referenceEventsAdapter.delivery(args);
          return {
            ...composed,
            headers: { ...composed.headers, "OpenIAP-Timestamp": "0" },
          };
        },
      },
    });
    const eventsResult = report.results.find(
      (r) => r.id === "events.profile-verification" && r.binding === "rest",
    );
    expect(eventsResult.ok).toBe(false);
    expect(eventsResult.failures.join(" ")).toContain(
      "openiap-timestamp must occur exactly once",
    );
  });

  it("accepts an Identity Content-Encoding in any casing (RFC 9110)", async () => {
    const provider = createMockProvider({ declareEvents: true });
    const report = await runConformance({
      adapters: adaptersFor(provider),
      Ajv,
      credentials: provider.credentials,
      eventsAdapter: {
        ...referenceEventsAdapter,
        delivery: async (args) => {
          const composed = await referenceEventsAdapter.delivery(args);
          return {
            ...composed,
            headers: { ...composed.headers, "Content-Encoding": "Identity" },
          };
        },
      },
    });
    const eventsResult = report.results.find(
      (r) => r.id === "events.profile-verification" && r.binding === "rest",
    );
    expect(eventsResult.ok, eventsResult.failures.join(" ")).toBe(true);
  });

  it("tolerates an additive member whose name collides with Object.prototype", async () => {
    const provider = createMockProvider();
    const collideFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/purchases/verify")) {
        const body = await response.json();
        // Only the SUCCESS body: the error envelope is CLOSED by design.
        if ("error" in body) return response2(body, response);
        // Legal MINOR addition on an open object; `in`-based projection
        // would wrongly keep it and fail parity.
        body.toString = "additive";
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createRestAdapter({
          baseUrl: BASE_URL,
          fetch: collideFetch,
          credentials: provider.credentials,
        }),
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: provider.fetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    expect(report.parityFailures).toEqual([]);
    expect(report.ok).toBe(true);
  });

  it("fails the events row when the descriptor omits eventTypes instead of skipping the honesty check", async () => {
    const provider = createMockProvider({ declareEvents: true });
    const noTypesFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).includes("/commerce/v1/capabilities")) {
        const body = await response.json();
        delete body.eventTypes;
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createRestAdapter({
          baseUrl: BASE_URL,
          fetch: noTypesFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
      eventsAdapter: referenceEventsAdapter,
    });
    const eventsResult = report.results.find(
      (r) => r.id === "events.profile-verification",
    );
    expect(eventsResult.ok).toBe(false);
    expect(eventsResult.failures.join(" ")).toContain("no eventTypes array");
  });

  it("keeps a member literally named __proto__ visible to the tokenless scan", async () => {
    const provider = createMockProvider();
    const protoFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/purchases/verify")) {
        const text = await response.text();
        // Inject via raw text: JSON.parse keeps __proto__ as an own key, and
        // normalization must not let the assignment re-parent the object and
        // hide the smuggled token from the scan.
        const body = JSON.parse(text);
        const injected = `${text.slice(0, text.lastIndexOf("}"))},"__proto__":{"purchaseToken":"smuggled"}}`;
        expect(body).toBeTruthy();
        return new Response(injected, {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createRestAdapter({
          baseUrl: BASE_URL,
          fetch: protoFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    // VerifyPurchaseResult carries no tokenless check, but the schema is what
    // must see the member; the invariant locked here is narrower: the member
    // survives normalization as an own key instead of vanishing.
    const normalized = normalizeResultData(
      JSON.parse('{"__proto__":{"purchaseToken":"smuggled"},"isValid":true}'),
    );
    expect(Object.keys(normalized).sort()).toEqual(["__proto__", "isValid"]);
    expect(normalized.purchaseToken).toBeUndefined();
    expect(report).toBeTruthy();
  });

  it("fails a custom GraphQL adapter that omits the error metadata (no vacuous pass)", async () => {
    // The envelope rules run on codes/messages/hasData. A hand-written
    // adapter that drops them must fail the adapter contract, not let a
    // data-carrying auth refusal certify.
    const provider = createMockProvider();
    const dataOnAuth = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (
          !("data" in body) &&
          body.errors?.[0]?.extensions?.code === "UNAUTHORIZED"
        ) {
          body.data = null;
        }
        return response2(body, response);
      }
      return response;
    };
    const inner = createGraphqlAdapter({
      url: GRAPHQL_URL,
      fetch: dataOnAuth,
      credentials: provider.credentials,
    });
    const stripped = {
      binding: "graphql",
      secrets: inner.secrets,
      rawGraphql: inner.rawGraphql,
      request: async (args) => {
        const outcome = await inner.request(args);
        delete outcome.hasData;
        delete outcome.codes;
        delete outcome.messages;
        return outcome;
      },
    };
    const report = await runConformance({
      adapters: [stripped],
      Ajv,
      credentials: provider.credentials,
    });
    const contract = report.results.filter(
      (r) => !r.ok && r.failures.join(" ").includes("adapter contract"),
    );
    expect(contract.length).toBeGreaterThan(0);
    expect(report.ok).toBe(false);
  });

  it("fails a custom REST adapter that omits errorBody (no vacuous pass)", async () => {
    const provider = createMockProvider();
    const leakyError = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (!String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (body && typeof body === "object" && "error" in body) {
          body.leak = { purchaseToken: "LEAKED" };
        }
        return response2(body, response);
      }
      return response;
    };
    const inner = createRestAdapter({
      baseUrl: BASE_URL,
      fetch: leakyError,
      credentials: provider.credentials,
    });
    const stripped = {
      binding: "rest",
      secrets: inner.secrets,
      request: async (args) => {
        const outcome = await inner.request(args);
        delete outcome.errorBody;
        return outcome;
      },
    };
    const report = await runConformance({
      adapters: [stripped],
      Ajv,
      credentials: provider.credentials,
    });
    const contract = report.results.filter(
      (r) => !r.ok && r.failures.join(" ").includes("adapter contract"),
    );
    expect(contract.length).toBeGreaterThan(0);
    expect(report.ok).toBe(false);
  });

  it("fails an adapter that exposes no secrets for the credential-echo scan", async () => {
    const provider = createMockProvider();
    const inner = createRestAdapter({
      baseUrl: BASE_URL,
      fetch: provider.fetch,
      credentials: provider.credentials,
    });
    const noSecrets = { ...inner };
    delete noSecrets.secrets;
    const report = await runConformance({
      adapters: [noSecrets],
      Ajv,
      credentials: provider.credentials,
    });
    const contract = report.results.find((r) => r.id === "adapter.contract");
    expect(contract.ok).toBe(false);
    expect(report.ok).toBe(false);
  });

  it("rejects a codeless server-auth rejection (empty codes must not skip the expectation)", async () => {
    const provider = createMockProvider();
    const stripCodes = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (
          !("data" in body) &&
          Array.isArray(body.errors) &&
          ["UNAUTHORIZED", "FORBIDDEN"].includes(
            body.errors[0]?.extensions?.code,
          )
        ) {
          for (const error of body.errors) delete error.extensions;
        }
        return response2(body, response);
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: stripCodes,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const authFailures = report.results.filter(
      (r) =>
        !r.ok &&
        r.id.includes(".auth.") &&
        r.failures.join(" ").includes("got INVALID_REQUEST"),
    );
    expect(authFailures.length).toBeGreaterThan(0);
    expect(report.ok).toBe(false);
  });

  it("rejects a GraphQL response carrying an unrequested sibling root", async () => {
    const provider = createMockProvider();
    const siblingRoot = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (
          body?.data &&
          typeof body.data === "object" &&
          !("__schema" in body.data)
        ) {
          body.data.unrequestedRoot = { secret: "x" };
        }
        return response2(body, response);
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: siblingRoot,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const invalid = report.results.filter(
      (r) => !r.ok && r.failures.join(" ").includes("carries roots"),
    );
    expect(invalid.length).toBeGreaterThan(0);
    expect(report.ok).toBe(false);
  });

  it("rejects an unrequested member fabricated as null (raw shape, before null-stripping)", async () => {
    const provider = createMockProvider();
    const nullMember = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (body?.data?.verifyPurchase) {
          body.data.verifyPurchase.unrequestedField = null;
        }
        return response2(body, response);
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: nullMember,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const failure = report.results.find(
      (r) =>
        r.id === "verifyPurchase.success.contract" && r.binding === "graphql",
    );
    expect(failure.ok).toBe(false);
    expect(failure.failures.join(" ")).toContain("never requested");
    expect(report.ok).toBe(false);
  });

  it("fails a custom adapter setting rawData to undefined (value check, not presence)", async () => {
    const provider = createMockProvider();
    const nullField = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (body?.data?.verifyPurchase) {
          body.data.verifyPurchase.unrequestedField = null;
        }
        return response2(body, response);
      }
      return response;
    };
    const inner = createGraphqlAdapter({
      url: GRAPHQL_URL,
      fetch: nullField,
      credentials: provider.credentials,
    });
    const stripped = {
      binding: "graphql",
      secrets: inner.secrets,
      rawGraphql: inner.rawGraphql,
      request: async (args) => {
        const outcome = await inner.request(args);
        if (outcome.kind === "result") outcome.rawData = undefined;
        return outcome;
      },
    };
    const report = await runConformance({
      adapters: [stripped],
      Ajv,
      credentials: provider.credentials,
    });
    const contract = report.results.filter(
      (r) => !r.ok && r.failures.join(" ").includes("adapter contract"),
    );
    expect(contract.length).toBeGreaterThan(0);
    expect(report.ok).toBe(false);
  });

  it("fails a custom adapter hollowing the error envelope to an empty errors array", async () => {
    const provider = createMockProvider();
    const dataOnAuth = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (
          !("data" in body) &&
          body.errors?.[0]?.extensions?.code === "UNAUTHORIZED"
        ) {
          body.data = null;
        }
        return response2(body, response);
      }
      return response;
    };
    const inner = createGraphqlAdapter({
      url: GRAPHQL_URL,
      fetch: dataOnAuth,
      credentials: provider.credentials,
    });
    const hollowed = {
      binding: "graphql",
      secrets: inner.secrets,
      rawGraphql: inner.rawGraphql,
      request: async (args) => {
        const outcome = await inner.request(args);
        if (outcome.kind === "error") outcome.errors = [];
        return outcome;
      },
    };
    const report = await runConformance({
      adapters: [hollowed],
      Ajv,
      credentials: provider.credentials,
    });
    const contract = report.results.filter(
      (r) => !r.ok && r.failures.join(" ").includes("adapter contract"),
    );
    expect(contract.length).toBeGreaterThan(0);
    expect(report.ok).toBe(false);
  });

  it("detects a credential echo even when the adapter empties its own secrets", async () => {
    const provider = createMockProvider();
    const echoCredential = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (!String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (body && "error" in body) {
          body.error.message = `rejected bearer ${provider.credentials.server}`;
        }
        return response2(body, response);
      }
      return response;
    };
    const inner = createRestAdapter({
      baseUrl: BASE_URL,
      fetch: echoCredential,
      credentials: provider.credentials,
    });
    inner.secrets = []; // A non-conforming adapter hiding its own credentials.
    const report = await runConformance({
      adapters: [inner],
      Ajv,
      // The AUTHORITATIVE list comes from the caller, not the adapter.
      credentials: provider.credentials,
    });
    const echoed = report.results.filter(
      (r) => !r.ok && r.failures.join(" ").includes("echoes submitted"),
    );
    expect(echoed.length).toBeGreaterThan(0);
    expect(report.ok).toBe(false);
  });

  it("fails an executor probe whose rejection echoes a credential", async () => {
    const provider = createMockProvider();
    const echoProbe = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (!("data" in body) && Array.isArray(body.errors)) {
          for (const error of body.errors) {
            error.message = `rejected bearer ${provider.credentials.server}`;
          }
        }
        return response2(body, response);
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: echoProbe,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const probe = report.results.find((r) => r.id === "graphql.executor-probe");
    expect(probe.ok).toBe(false);
    expect(probe.failures.join(" ")).toContain("echoes submitted");
  });

  it("fails an executor probe answered with empty-string messages", async () => {
    const provider = createMockProvider();
    const emptyProbe = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (!("data" in body) && Array.isArray(body.errors)) {
          for (const error of body.errors) error.message = "";
        }
        return response2(body, response);
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: emptyProbe,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const probe = report.results.find((r) => r.id === "graphql.executor-probe");
    expect(probe.ok).toBe(false);
  });

  it("refuses to run without the authoritative credentials map", async () => {
    const provider = createMockProvider();
    await expect(
      runConformance({
        adapters: [
          createRestAdapter({
            baseUrl: BASE_URL,
            fetch: provider.fetch,
            credentials: provider.credentials,
          }),
        ],
        Ajv,
      }),
    ).rejects.toThrow("needs credentials");
  });

  it("fails an adapter asserting a permitted code to smuggle into the allowCodes branch", async () => {
    // The wire says UNAUTHORIZED; the adapter lies that outcome.code is
    // VERIFICATION_FAILED to slip the verifyPurchase success vector into the
    // allowCodes branch. The gate keys on the DERIVED code and the contract
    // cross-checks the assertion, so both bite.
    const provider = createMockProvider();
    const unauthorizedVerify = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (body?.data?.verifyPurchase) {
          return new Response(
            JSON.stringify({
              errors: [
                {
                  message: "A credential is required",
                  extensions: { code: "UNAUTHORIZED" },
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return response2(body, response);
      }
      return response;
    };
    const inner = createGraphqlAdapter({
      url: GRAPHQL_URL,
      fetch: unauthorizedVerify,
      credentials: provider.credentials,
    });
    const lying = {
      binding: "graphql",
      secrets: inner.secrets,
      rawGraphql: inner.rawGraphql,
      request: async (args) => {
        const outcome = await inner.request(args);
        if (outcome.kind === "error" && outcome.code === "UNAUTHORIZED") {
          outcome.code = "VERIFICATION_FAILED";
        }
        return outcome;
      },
    };
    const report = await runConformance({
      adapters: [lying],
      Ajv,
      credentials: provider.credentials,
    });
    const failure = report.results.find(
      (r) => r.id === "verifyPurchase.success.contract",
    );
    expect(failure.ok).toBe(false);
    expect(report.ok).toBe(false);
  });

  it("fails a custom adapter reporting a coded error at HTTP 400 (common helper enforces the status rule)", async () => {
    // createGraphqlAdapter enforces the 200-MUST rule on the wire, but a
    // custom adapter never goes through it — the COMMON envelope helper has
    // to carry the rule too.
    const provider = createMockProvider();
    const inner = createGraphqlAdapter({
      url: GRAPHQL_URL,
      fetch: provider.fetch,
      credentials: provider.credentials,
    });
    const lyingStatus = {
      binding: "graphql",
      secrets: inner.secrets,
      rawGraphql: inner.rawGraphql,
      request: async (args) => {
        const outcome = await inner.request(args);
        if (outcome.kind === "error") outcome.status = 400;
        return outcome;
      },
    };
    const report = await runConformance({
      adapters: [lyingStatus],
      Ajv,
      credentials: provider.credentials,
    });
    const status = report.results.filter(
      (r) =>
        !r.ok && r.failures.join(" ").includes("must be delivered at HTTP 200"),
    );
    expect(status.length).toBeGreaterThan(0);
    expect(report.ok).toBe(false);
  });

  it("survives an adapter returning null instead of an outcome", async () => {
    const provider = createMockProvider();
    const inner = createRestAdapter({
      baseUrl: BASE_URL,
      fetch: provider.fetch,
      credentials: provider.credentials,
    });
    const nullReturning = {
      binding: "rest",
      secrets: inner.secrets,
      request: async (args) =>
        args.operation === "entitlements" ? null : inner.request(args),
    };
    const report = await runConformance({
      adapters: [nullReturning],
      Ajv,
      credentials: provider.credentials,
    });
    // The run completed; the null-returning cases failed as adapter faults.
    const faulted = report.results.filter(
      (r) => !r.ok && r.failures.join(" ").includes("instead of an outcome"),
    );
    expect(faulted.length).toBeGreaterThan(0);
    expect(
      report.results.some(
        (r) => r.id === "subscriptionStatus.success.contract" && r.ok,
      ),
    ).toBe(true);
    expect(report.ok).toBe(false);
  });

  it("fails a custom adapter REPORTING a mixed envelope (common helper, not only the wire)", async () => {
    const provider = createMockProvider();
    const inner = createGraphqlAdapter({
      url: GRAPHQL_URL,
      fetch: provider.fetch,
      credentials: provider.credentials,
    });
    const mixing = {
      binding: "graphql",
      secrets: inner.secrets,
      rawGraphql: inner.rawGraphql,
      request: async (args) => {
        const outcome = await inner.request(args);
        if (outcome.kind === "error") {
          outcome.errors = [...outcome.errors, { message: "codeless rider" }];
        }
        return outcome;
      },
    };
    const report = await runConformance({
      adapters: [mixing],
      Ajv,
      credentials: provider.credentials,
    });
    const mixed = report.results.filter(
      (r) => !r.ok && r.failures.join(" ").includes("mixes coded and codeless"),
    );
    expect(mixed.length).toBeGreaterThan(0);
    expect(report.ok).toBe(false);
  });

  it("fails a custom adapter REPORTING a codeless envelope with data (common helper)", async () => {
    const provider = createMockProvider();
    const inner = createGraphqlAdapter({
      url: GRAPHQL_URL,
      fetch: provider.fetch,
      credentials: provider.credentials,
    });
    const hollowing = {
      binding: "graphql",
      secrets: inner.secrets,
      rawGraphql: inner.rawGraphql,
      request: async (args) => {
        const outcome = await inner.request(args);
        if (outcome.kind === "error") {
          outcome.errors = outcome.errors.map(({ message }) => ({ message }));
          outcome.code = "INVALID_REQUEST";
          outcome.hasData = true;
        }
        return outcome;
      },
    };
    const report = await runConformance({
      adapters: [hollowing],
      Ajv,
      credentials: provider.credentials,
    });
    const executedCodeless = report.results.filter(
      (r) =>
        !r.ok && r.failures.join(" ").includes("must carry a protocol code"),
    );
    expect(executedCodeless.length).toBeGreaterThan(0);
    expect(report.ok).toBe(false);
  });

  it("certifies a legal verification-only provider without demanding a server credential", async () => {
    // SPEC 3: a provider implements the profiles it declares. One that only
    // serves verification never uses the server role, so the runner must not
    // demand credentials.server — role credentials are required at USE, not
    // up front.
    const provider = createMockProvider();
    const verificationOnly = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).includes("/commerce/v1/capabilities")) {
        const body = await response.json();
        body.profiles = { verification: "1.0" };
        return response2(body, response);
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createRestAdapter({
          baseUrl: BASE_URL,
          fetch: verificationOnly,
          credentials: { verification: provider.credentials.verification },
        }),
      ],
      Ajv,
      credentials: { verification: provider.credentials.verification },
    });
    expect(report.ok, JSON.stringify(report.results.filter((r) => !r.ok))).toBe(
      true,
    );
  });

  it("certifies a verification-only GraphQL provider (the probe targets the role it holds)", async () => {
    // With only a verification credential, the probes must exercise
    // verifyPurchase — probing the server-only subscriptionStatus would hit
    // a LEGAL pre-execution FORBIDDEN and be misread as an executor fault.
    const provider = createMockProvider();
    const verificationOnly = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (body?.data?.providerCapabilities) {
          body.data.providerCapabilities.profiles = { verification: "1.0" };
        }
        return response2(body, response);
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: verificationOnly,
          credentials: { verification: provider.credentials.verification },
        }),
      ],
      Ajv,
      credentials: { verification: provider.credentials.verification },
    });
    const probe = report.results.find((r) => r.id === "graphql.executor-probe");
    expect(probe.ok, probe.failures.join(" ")).toBe(true);
    expect(report.ok, JSON.stringify(report.results.filter((r) => !r.ok))).toBe(
      true,
    );
  });

  it("refuses to run when a protocol role is missing from credentials", async () => {
    const provider = createMockProvider();
    await expect(
      runConformance({
        adapters: [
          createRestAdapter({
            baseUrl: BASE_URL,
            fetch: provider.fetch,
            credentials: provider.credentials,
          }),
        ],
        Ajv,
        credentials: { server: provider.credentials.server },
      }),
    ).rejects.toThrow("credentials.verification");
  });

  it("detects a short credential echoed into an error message", async () => {
    const provider = createMockProvider();
    const shortCreds = { verification: "pk1", server: "sk2" };
    const shortFetch = async (url, options) => {
      const auth = String(options?.headers?.Authorization ?? "");
      const mapped = auth.includes("pk1")
        ? `Bearer ${provider.credentials.verification}`
        : auth.includes("sk2")
          ? `Bearer ${provider.credentials.server}`
          : auth;
      const response = await provider.fetch(url, {
        ...options,
        headers: { ...options?.headers, Authorization: mapped },
      });
      if (!String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (body && "error" in body) {
          body.error.message = "rejected bearer sk2 for this operation";
        }
        return response2(body, response);
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createRestAdapter({
          baseUrl: BASE_URL,
          fetch: shortFetch,
          credentials: shortCreds,
        }),
      ],
      Ajv,
      credentials: shortCreds,
    });
    const echoed = report.results.filter(
      (r) => !r.ok && r.failures.join(" ").includes("echoes submitted"),
    );
    expect(echoed.length).toBeGreaterThan(0);
  });

  it("does not treat a mixed rejection as introspection-disabled", async () => {
    const provider = createMockProvider();
    const mixedIntrospection = async (url, options) => {
      if (
        String(url).endsWith("/commerce/v1/graphql") &&
        String(options?.body ?? "").includes("__schema")
      ) {
        return new Response(
          JSON.stringify({
            errors: [
              {
                message: "introspection is disabled",
                extensions: { code: "INVALID_REQUEST" },
              },
              { message: "codeless rider" },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return provider.fetch(url, options);
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: mixedIntrospection,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const probe = report.results.find((r) => r.id === "graphql.executor-probe");
    expect(probe.ok).toBe(false);
  });

  it("rejects an envelope mixing coded and codeless errors", async () => {
    const provider = createMockProvider();
    const mixedFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (
          !("data" in body) &&
          Array.isArray(body.errors) &&
          typeof body.errors[0]?.extensions?.code === "string"
        ) {
          body.errors.push({ message: "rider with no code" });
        }
        return response2(body, response);
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: mixedFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const mixed = report.results.filter(
      (r) => !r.ok && r.failures.join(" ").includes("mixes coded and codeless"),
    );
    expect(mixed.length).toBeGreaterThan(0);
    expect(report.ok).toBe(false);
  });

  it("applies the envelope rules on the allowCodes branch too (VERIFICATION_FAILED is not a side door)", async () => {
    // A provider without store credentials may answer the verifyPurchase
    // success vector with VERIFICATION_FAILED — but that error still may not
    // echo the submitted evidence in its message. The success vector submits
    // the Apple JWS fixture, so that is the value that must not come back.
    const token = operationVectors.fixtures.appleJws;
    const provider = createMockProvider();
    const failedVerdictEcho = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/purchases/verify")) {
        const body = await response.json();
        if (body && typeof body === "object" && !("error" in body)) {
          return new Response(
            JSON.stringify({
              error: {
                code: "VERIFICATION_FAILED",
                message: `store unreachable for ${token}`,
              },
            }),
            { status: 502, headers: { "Content-Type": "application/json" } },
          );
        }
        return response2(body, response);
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createRestAdapter({
          baseUrl: BASE_URL,
          fetch: failedVerdictEcho,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const failure = report.results.find(
      (r) => r.id === "verifyPurchase.success.contract",
    );
    expect(failure.ok).toBe(false);
    expect(failure.failures.join(" ")).toContain("echoes submitted");
    expect(report.ok).toBe(false);
  });

  it("rejects error messages echoing evidence or credentials on both bindings", async () => {
    const token = operationVectors.fixtures.googlePurchaseToken;
    for (const binding of ["rest", "graphql"]) {
      const provider = createMockProvider();
      const echoFetch = async (url, options) => {
        const response = await provider.fetch(url, options);
        const isGraphql = String(url).endsWith("/commerce/v1/graphql");
        const body = await response.json();
        if (isGraphql && Array.isArray(body.errors)) {
          for (const error of body.errors) {
            error.message = `store rejected ${token}`;
          }
        } else if (!isGraphql && body && "error" in body) {
          body.error.message = `store rejected ${token}`;
        }
        return response2(body, response);
      };
      const report = await runConformance({
        adapters: [
          binding === "rest"
            ? createRestAdapter({
                baseUrl: BASE_URL,
                fetch: echoFetch,
                credentials: provider.credentials,
              })
            : createGraphqlAdapter({
                url: GRAPHQL_URL,
                fetch: echoFetch,
                credentials: provider.credentials,
              }),
        ],
        Ajv,
        credentials: provider.credentials,
      });
      const echoed = report.results.filter(
        (r) => !r.ok && r.failures.join(" ").includes("echoes submitted"),
      );
      expect(echoed.length, binding).toBeGreaterThan(0);
      expect(report.ok, binding).toBe(false);
    }
  });

  it("rejects an empty GraphQL error message (SPEC 8: human-readable)", async () => {
    const provider = createMockProvider();
    const emptyMessage = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (Array.isArray(body.errors)) {
          for (const error of body.errors) error.message = "";
        }
        return response2(body, response);
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: emptyMessage,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const invalid = report.results.filter(
      (r) => !r.ok && r.failures.join(" ").includes("no non-empty message"),
    );
    expect(invalid.length).toBeGreaterThan(0);
    expect(report.ok).toBe(false);
  });

  it("rejects an off-contract code smuggled behind a clean errors[0]", async () => {
    const provider = createMockProvider();
    const smuggleFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (
          Array.isArray(body.errors) &&
          typeof body.errors[0]?.extensions?.code === "string"
        ) {
          body.errors.push({
            message: "leak",
            extensions: { code: "PROVIDER_SPECIFIC_LEAK" },
          });
        }
        return response2(body, response);
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: smuggleFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const smuggled = report.results.filter(
      (r) => !r.ok && r.failures.join(" ").includes("PROVIDER_SPECIFIC_LEAK"),
    );
    expect(smuggled.length).toBeGreaterThan(0);
    expect(report.ok).toBe(false);
  });

  it("rejects a non-string extensions.code instead of treating it as codeless", async () => {
    const provider = createMockProvider();
    const numericCodeFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (Array.isArray(body.errors) && body.errors[0]) {
          body.errors[0].extensions = { code: 42 };
        }
        return response2(body, response);
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: numericCodeFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const malformed = report.results.filter(
      (r) => !r.ok && r.failures.join(" ").includes("must be a string"),
    );
    expect(malformed.length).toBeGreaterThan(0);
    expect(report.ok).toBe(false);
  });

  it("rejects a REST error response smuggling members beside the closed envelope", async () => {
    // A failure response is the easiest place to hide a leak — callers
    // rarely inspect one. The envelope is CLOSED, and the runner validates it.
    const provider = createMockProvider();
    const leakyErrorFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (!String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (body && typeof body === "object" && "error" in body) {
          body.data = {
            subscription: { purchaseToken: "LEAKED-TOKEN" },
          };
        }
        return response2(body, response);
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createRestAdapter({
          baseUrl: BASE_URL,
          fetch: leakyErrorFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const leaked = report.results.filter(
      (r) => !r.ok && r.failures.join(" ").includes("ProtocolErrorResponse"),
    );
    expect(leaked.length).toBeGreaterThan(0);
    expect(report.ok).toBe(false);
  });

  it("certifies a provider that gates introspection behind the server credential", async () => {
    const provider = createMockProvider();
    const gatedFetch = async (url, options) => {
      if (
        String(url).endsWith("/commerce/v1/graphql") &&
        String(options?.body ?? "").includes("__schema") &&
        !String(options?.headers?.Authorization ?? "").includes(
          provider.credentials.server,
        )
      ) {
        return new Response(
          JSON.stringify({
            errors: [
              {
                message: "A credential is required",
                extensions: { code: "UNAUTHORIZED" },
              },
            ],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return provider.fetch(url, options);
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: gatedFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const probe = report.results.find((r) => r.id === "graphql.executor-probe");
    expect(probe.ok, probe.failures.join(" ")).toBe(true);
    expect(report.ok).toBe(true);
  });

  it("fails closed on an extra argument too deep for the probe fragment to render", async () => {
    const provider = createMockProvider();
    const deepArgFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (
        String(url).endsWith("/commerce/v1/graphql") &&
        String(options?.body ?? "").includes("__schema")
      ) {
        const body = await response.json();
        const query = body?.data?.__schema?.types?.find(
          (entry) => entry.name === "Query",
        );
        const field = query?.fields?.find(
          (entry) => entry.name === "entitlements",
        );
        // A required argument whose type ref exceeds the 5-level fragment:
        // the last node has no ofType, so it cannot be rendered — the
        // breaking-change guard must fail CLOSED, not skip.
        field.args.push({
          name: "tenant",
          type: {
            kind: "NON_NULL",
            name: null,
            ofType: {
              kind: "LIST",
              name: null,
              ofType: {
                kind: "NON_NULL",
                name: null,
                ofType: {
                  kind: "LIST",
                  name: null,
                  ofType: { kind: "NON_NULL", name: null },
                },
              },
            },
          },
        });
        return response2(body, response);
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: deepArgFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const probe = report.results.find((r) => r.id === "graphql.executor-probe");
    expect(probe.ok).toBe(false);
    expect(probe.failures.join(" ")).toContain("unrenderable");
  });

  it("runs the binding-independent events vectors once, not once per binding", async () => {
    const provider = createMockProvider({ declareEvents: true });
    let classifyCalls = 0;
    const report = await runConformance({
      adapters: adaptersFor(provider),
      Ajv,
      credentials: provider.credentials,
      eventsAdapter: {
        ...referenceEventsAdapter,
        classifyResponse: (status) => {
          classifyCalls += 1;
          return referenceEventsAdapter.classifyResponse(status);
        },
      },
    });
    // Two bindings still report two rows, but the vectors ran once: 400
    // statuses + 2 sentinels.
    expect(
      report.results.filter((r) => r.id === "events.profile-verification")
        .length,
    ).toBe(2);
    expect(classifyCalls).toBe(402);
    expect(report.ok).toBe(true);
  });

  it("rejects a pre-execution auth refusal that carries a data member", async () => {
    // SPEC 7: a server-role refusal is decided before the document executes
    // and must omit data entirely; smuggling `data: null` onto it forges an
    // executed shape.
    const provider = createMockProvider();
    const dataOnAuthFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (
          !("data" in body) &&
          Array.isArray(body.errors) &&
          body.errors[0]?.extensions?.code === "UNAUTHORIZED"
        ) {
          body.data = null;
        }
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: dataOnAuthFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const failure = report.results.find(
      (r) => r.id === "subscriptionStatus.auth.missing-credential",
    );
    expect(failure.ok).toBe(false);
    expect(failure.failures.join(" ")).toContain("omit the data member");
    expect(report.ok).toBe(false);
  });

  it("rejects an operation-error envelope hiding a malformed second error", async () => {
    // errors[0] is clean; the smuggled second entry has no message. Judging
    // only the first entry would certify it.
    const provider = createMockProvider();
    const secondErrorFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if ("data" in body && Array.isArray(body.errors)) {
          body.errors.push({});
        }
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: secondErrorFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const invalid = report.results.filter(
      (r) => !r.ok && r.failures.join(" ").includes("no non-empty message"),
    );
    expect(invalid.length).toBeGreaterThan(0);
    expect(report.ok).toBe(false);
  });

  it("fails a verifier that rejects the exact ±tolerance boundary (SPEC: only > tolerance is stale)", async () => {
    const provider = createMockProvider({ declareEvents: true });
    const report = await runConformance({
      adapters: adaptersFor(provider),
      Ajv,
      credentials: provider.credentials,
      eventsAdapter: {
        ...referenceEventsAdapter,
        // >= instead of >: rejects exactly ±300s, which SPEC accepts.
        verify: ({ body, timestamp, signature, secrets, now }) => {
          if (Math.abs(now - timestamp) >= TOLERANCE_SECONDS) return false;
          const held = secrets.map((secret) =>
            referenceEventsAdapter.sign({ secret, timestamp, body }),
          );
          return String(signature)
            .split(",")
            .map((part) => part.trim())
            .some((presented) => held.includes(presented));
        },
      },
    });
    const eventsResult = report.results.find(
      (r) => r.id === "events.profile-verification" && r.binding === "rest",
    );
    expect(eventsResult.ok).toBe(false);
    expect(eventsResult.failures.join(" ")).toContain("must be accepted");
  });

  it("fails a verifier that never rejects future-dated timestamps", async () => {
    // The fixture rejections only cover the PAST direction (+301s); a
    // verifier with a one-sided window accepts a signature stamped in the
    // future, and only the runner's dynamic -(tolerance+1) probe can see it.
    const provider = createMockProvider({ declareEvents: true });
    const report = await runConformance({
      adapters: adaptersFor(provider),
      Ajv,
      credentials: provider.credentials,
      eventsAdapter: {
        ...referenceEventsAdapter,
        verify: ({ body, timestamp, signature, secrets, now }) => {
          // One-sided: bounds staleness only when now is AFTER the stamp.
          if (now - timestamp > TOLERANCE_SECONDS) return false;
          const held = secrets.map((secret) =>
            referenceEventsAdapter.sign({ secret, timestamp, body }),
          );
          return String(signature)
            .split(",")
            .map((part) => part.trim())
            .some((presented) => held.includes(presented));
        },
      },
    });
    const eventsResult = report.results.find(
      (r) => r.id === "events.profile-verification" && r.binding === "rest",
    );
    expect(eventsResult.ok).toBe(false);
    expect(eventsResult.failures.join(" ")).toContain("must be rejected");
  });

  it("fails a classifier on any mis-mapped status across the whole 200-599 range", async () => {
    const provider = createMockProvider({ declareEvents: true });
    const report = await runConformance({
      adapters: adaptersFor(provider),
      Ajv,
      credentials: provider.credentials,
      eventsAdapter: {
        ...referenceEventsAdapter,
        // Correct everywhere except one unsampled status.
        classifyResponse: (status) =>
          status === 304
            ? "retry"
            : referenceEventsAdapter.classifyResponse(status),
      },
    });
    const eventsResult = report.results.find(
      (r) => r.id === "events.profile-verification" && r.binding === "rest",
    );
    expect(eventsResult.ok).toBe(false);
    expect(eventsResult.failures.join(" ")).toContain("response 304");
  });

  it("fails a GraphQL result carrying a member the canonical document never requested", async () => {
    const provider = createMockProvider();
    const unrequestedFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (body?.data?.verifyPurchase) {
          body.data.verifyPurchase.unrequestedField = "leak";
        }
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createRestAdapter({
          baseUrl: BASE_URL,
          fetch: provider.fetch,
          credentials: provider.credentials,
        }),
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: unrequestedFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const failure = report.results.find(
      (r) =>
        r.id === "verifyPurchase.success.contract" && r.binding === "graphql",
    );
    expect(failure.ok).toBe(false);
    expect(failure.failures.join(" ")).toContain("never requested");
    expect(report.ok).toBe(false);
  });

  it("fails introspection that flips an input member's nullability", async () => {
    const provider = createMockProvider();
    const flipFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (
        String(url).endsWith("/commerce/v1/graphql") &&
        String(options?.body ?? "").includes("__schema")
      ) {
        const body = await response.json();
        const type = body?.data?.__schema?.types?.find(
          (entry) => entry.name === "SubscriptionStatusInput",
        );
        const field = type?.inputFields?.find(
          (entry) => entry.name === "userId",
        );
        expect(field?.type?.kind).toBe("NON_NULL");
        field.type = field.type.ofType; // Identifier! -> Identifier
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: flipFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const probe = report.results.find((r) => r.id === "graphql.executor-probe");
    expect(probe.ok).toBe(false);
    expect(probe.failures.join(" ")).toContain("SubscriptionStatusInput");
  });

  it("fails introspection that drops an input member", async () => {
    const provider = createMockProvider();
    const dropFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (
        String(url).endsWith("/commerce/v1/graphql") &&
        String(options?.body ?? "").includes("__schema")
      ) {
        const body = await response.json();
        const type = body?.data?.__schema?.types?.find(
          (entry) => entry.name === "BindPurchaseInput",
        );
        type.inputFields = type.inputFields.filter(
          (entry) => entry.name !== "userId",
        );
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: dropFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const probe = report.results.find((r) => r.id === "graphql.executor-probe");
    expect(probe.ok).toBe(false);
    expect(probe.failures.join(" ")).toContain("BindPurchaseInput.userId");
  });

  it("fails introspection that mutates a closed enum's value set", async () => {
    const provider = createMockProvider();
    const enumFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (
        String(url).endsWith("/commerce/v1/graphql") &&
        String(options?.body ?? "").includes("__schema")
      ) {
        const body = await response.json();
        const type = body?.data?.__schema?.types?.find(
          (entry) => entry.name === "SubscriptionState",
        );
        expect(Array.isArray(type?.enumValues)).toBe(true);
        type.enumValues.push({ name: "FutureState" });
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: enumFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const probe = report.results.find((r) => r.id === "graphql.executor-probe");
    expect(probe.ok).toBe(false);
    expect(probe.failures.join(" ")).toContain("enum SubscriptionState");
  });

  it("fails introspection that adds a field to a closed tokenless result", async () => {
    const provider = createMockProvider();
    const extraFieldFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (
        String(url).endsWith("/commerce/v1/graphql") &&
        String(options?.body ?? "").includes("__schema")
      ) {
        const body = await response.json();
        const type = body?.data?.__schema?.types?.find(
          (entry) => entry.name === "SubscriptionStatusSnapshot",
        );
        type.fields.push({
          name: "rawReceipt",
          args: [],
          type: { kind: "SCALAR", name: "String", ofType: null },
        });
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: extraFieldFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const probe = report.results.find((r) => r.id === "graphql.executor-probe");
    expect(probe.ok).toBe(false);
    expect(probe.failures.join(" ")).toContain(
      "closed type SubscriptionStatusSnapshot serves undeclared field rawReceipt",
    );
  });

  it("certifies introspection carrying additive minor surface (new type, new nullable field)", async () => {
    const provider = createMockProvider();
    const additiveFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (
        String(url).endsWith("/commerce/v1/graphql") &&
        String(options?.body ?? "").includes("__schema")
      ) {
        const body = await response.json();
        const schema = body?.data?.__schema;
        schema.types.push({
          name: "FutureMinorType",
          kind: "OBJECT",
          fields: [
            {
              name: "value",
              args: [],
              type: { kind: "SCALAR", name: "String", ofType: null },
            },
          ],
          inputFields: null,
          enumValues: null,
        });
        const query = schema.types.find((entry) => entry.name === "Query");
        query.fields.push({
          name: "futureMinorRead",
          args: [
            {
              name: "hint",
              // Nullable argument: additive-safe.
              type: { kind: "SCALAR", name: "String", ofType: null },
            },
          ],
          type: { kind: "OBJECT", name: "FutureMinorType", ofType: null },
        });
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: additiveFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const probe = report.results.find((r) => r.id === "graphql.executor-probe");
    expect(probe.ok, probe.failures.join(" ")).toBe(true);
    expect(report.ok).toBe(true);
  });

  it("rejects an executed operation error that hides its protocol code", async () => {
    const provider = createMockProvider();
    const hideCodeFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        // An executed operation includes the data member; stripping its code
        // disguises an operation failure as a request-level one.
        if ("data" in body && Array.isArray(body.errors)) {
          for (const error of body.errors) delete error.extensions;
        }
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: hideCodeFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const disguised = report.results.filter(
      (r) =>
        !r.ok && r.failures.join(" ").includes("must carry a protocol code"),
    );
    expect(disguised.length).toBeGreaterThan(0);
    expect(report.ok).toBe(false);
  });

  it("rejects a GraphQL error that carries no message string", async () => {
    const provider = createMockProvider();
    const noMessageFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (Array.isArray(body.errors)) {
          for (const error of body.errors) delete error.message;
        }
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: noMessageFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const missing = report.results.filter(
      (r) => !r.ok && r.failures.join(" ").includes("no non-empty message"),
    );
    expect(missing.length).toBeGreaterThan(0);
    expect(report.ok).toBe(false);
  });

  it("fails a provider that validates server-operation input before authenticating", async () => {
    const provider = createMockProvider();
    const validateFirstFetch = async (url, options) => {
      // Simulates a provider that runs the input schema before the
      // authoritative credential check on a privileged REST operation.
      const target = String(url);
      if (
        target.includes("/commerce/v1/subscriptions/status") &&
        /userId=x{600}/.test(target)
      ) {
        return new Response(
          JSON.stringify({
            error: { code: "INVALID_REQUEST", message: "userId is too long" },
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }
      return provider.fetch(url, options);
    };
    const report = await runConformance({
      adapters: [
        createRestAdapter({
          baseUrl: BASE_URL,
          fetch: validateFirstFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const ordering = report.results.find(
      (r) => r.id === "subscriptionStatus.auth.precedes-validation",
    );
    expect(ordering.ok).toBe(false);
    expect(report.ok).toBe(false);
  });

  it("certifies a provider that declares a newer compatible minor (SPEC pins on major)", async () => {
    const provider = createMockProvider();
    const minorBumpFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).includes("/commerce/v1/capabilities")) {
        const body = await response.json();
        // A 1.0 runner must accept a 1.1 provider: same major, added minor.
        body.specVersion = "1.1";
        body.profiles = { ...body.profiles, verification: "1.1" };
        body.bindings = { ...body.bindings, rest: "1.1" };
        return new Response(JSON.stringify(body), {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        });
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createRestAdapter({
          baseUrl: BASE_URL,
          fetch: minorBumpFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    const versionResult = report.results.find(
      (r) => r.id === "capabilities.version-agreement",
    );
    expect(versionResult.ok, versionResult.failures.join(" ")).toBe(true);
    expect(report.ok).toBe(true);
  });

  it("rejects a GraphQL operation error returned with a non-200 status", async () => {
    const provider = createMockProvider();
    const badStatusFetch = async (url, options) => {
      const response = await provider.fetch(url, options);
      if (String(url).endsWith("/commerce/v1/graphql")) {
        const body = await response.json();
        if (body.errors) {
          return new Response(JSON.stringify(body), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
      return response;
    };
    const report = await runConformance({
      adapters: [
        createGraphqlAdapter({
          url: GRAPHQL_URL,
          fetch: badStatusFetch,
          credentials: provider.credentials,
        }),
      ],
      Ajv,
      credentials: provider.credentials,
    });
    // The auth-negative vectors produce GraphQL errors; forcing them to 400
    // must be flagged as invalid, not accepted as the expected error.
    const authCase = report.results.find(
      (r) => r.id === "subscriptionStatus.auth.missing-credential",
    );
    expect(authCase.ok).toBe(false);
    expect(authCase.failures.join(" ")).toContain("must be 200");
  });
});
