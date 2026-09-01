// Proves IAPKit conforms to the OpenIAP Commerce Protocol.
//
// The specification is the authority: its JSON Schema validates real payloads
// this implementation builds, and its published vocabulary is compared against
// the one this implementation ships. Neither list is restated here, so the two
// cannot drift silently — if kit gains an event type the spec does not declare,
// this file fails.

import Ajv from "ajv/dist/2020.js";
import {
  KNOWN_COMMERCE_EVENT_TYPES as SPEC_EVENT_TYPES,
  COMMERCE_EVENT_VERSION,
  DATA_PROVENANCE as SPEC_DATA_PROVENANCE,
  EXTENSION_LIMITS,
  KNOWN_STORES as SPEC_KNOWN_STORES,
  SUBSCRIPTION_STATES as SPEC_SUBSCRIPTION_STATES,
  WEBHOOK,
  commerceEventSchema,
  primitivesSchema,
} from "openiap-commerce-protocol";
import { describe, expect, it } from "vitest";

import type { Doc } from "../_generated/dataModel";
import { PROVIDER_CAPABILITIES } from "./capabilities";
import {
  COMMERCE_ENVIRONMENTS,
  COMMERCE_EVENT_SCHEMA_VERSION,
  COMMERCE_EVENT_TYPES,
  COMMERCE_STORES,
  DATA_PROVENANCE_VALUES,
  commerceEventTypeForTransition,
  MAX_EXTENSION_ENTRIES,
  MAX_EXTENSION_KEY_LENGTH,
  MAX_EXTENSION_VALUE_LENGTH,
  TRANSITION_TO_EVENT,
  type LifecycleTransition,
} from "./contract";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import {
  applySubscriptionTransition,
  entitlementActive,
} from "../subscriptions/stateMachine";
import {
  mapAppleNotificationType,
  mapGoogleSubscriptionNotificationType,
} from "../webhooks/shared";

import { buildEventPayload } from "./deliveryState";
import { emitCommerceEvent } from "./internal";
import {
  EVENT_ID_HEADER,
  DELIVERY_ID_HEADER,
  SIGNATURE_HEADER,
  CONTENT_TYPE,
  SIGNATURE_TOLERANCE_SECONDS,
  signPayloadWithRotation,
  TIMESTAMP_HEADER,
} from "./signing";

// kit is an ESM package, so `require` only exists through the test runner's
// interop shim. Resolve the specification's published subpaths the way any
// ESM consumer would instead of depending on that.
const resolveSpec = createRequire(import.meta.url).resolve;

function validator() {
  const ajv = new Ajv({ strict: true, allErrors: true });
  ajv.addSchema(primitivesSchema, "primitives.schema.json");
  ajv.addSchema(commerceEventSchema, "commerce-event.schema.json");
  return ajv;
}

const validateEvent = () =>
  validator().getSchema("commerce-event.schema.json")!;

/** A stored row shaped exactly as `emitCommerceEvent` writes one. */
function storedEvent(overrides: Record<string, unknown> = {}) {
  return {
    _id: "commerceEvents_1",
    _creationTime: 0,
    projectId: "projects_1",
    eventType: "subscription.renewed",
    eventVersion: COMMERCE_EVENT_SCHEMA_VERSION,
    store: "apple",
    environment: "production",
    userId: "user_1",
    productId: "premium.monthly",
    transactionId: "2000000912345678",
    originalTransactionId: "2000000811111111",
    subscriptionId: "subscriptions_1",
    subscription: {
      state: "Active",
      productId: "premium.monthly",
      expiresAt: 1_758_979_200_000,
      renewsAt: 1_758_979_200_000,
      willRenew: true,
    },
    entitlementActive: true,
    currency: "USD",
    amountMicros: 9_990_000,
    amountProvenance: "store",
    sourceEventId: "webhookEvents_1",
    sourceStoreNotificationId: "8f3b1c2d-4e5a-6b7c-8d9e-0f1a2b3c4d5e",
    occurredAt: 1_756_300_800_000,
    processedAt: 1_756_300_801_420,
    ...overrides,
  } as unknown as Doc<"commerceEvents">;
}

describe("IAPKit conforms to the OpenIAP Commerce Protocol", () => {
  it("declares only event types the specification names", () => {
    for (const eventType of COMMERCE_EVENT_TYPES) {
      expect(SPEC_EVENT_TYPES).toContain(eventType);
    }
  });

  it("emits the event version the specification names", () => {
    expect(COMMERCE_EVENT_SCHEMA_VERSION).toBe(COMMERCE_EVENT_VERSION);
  });

  it("bounds extensions exactly as the specification does", () => {
    expect({
      maxEntries: MAX_EXTENSION_ENTRIES,
      maxKeyLength: MAX_EXTENSION_KEY_LENGTH,
      maxValueLength: MAX_EXTENSION_VALUE_LENGTH,
    }).toEqual(EXTENSION_LIMITS);
  });

  it("uses the transport headers and replay window the specification fixes", () => {
    expect(SIGNATURE_HEADER).toBe(WEBHOOK.signatureHeader);
    expect(TIMESTAMP_HEADER).toBe(WEBHOOK.timestampHeader);
    expect(EVENT_ID_HEADER).toBe(WEBHOOK.eventIdHeader);
    expect(DELIVERY_ID_HEADER).toBe(WEBHOOK.deliveryIdHeader);
    expect(SIGNATURE_TOLERANCE_SECONDS).toBe(WEBHOOK.toleranceSeconds);
    expect(CONTENT_TYPE).toBe(WEBHOOK.contentType);
  });

  const signatureVectors = JSON.parse(
    readFileSync(
      resolveSpec("openiap-commerce-protocol/vectors/signatures.json"),
      "utf8",
    ),
  ) as {
    cases: {
      name: string;
      secret: string;
      previousSecret?: string;
      timestamp: number;
      body: string;
      expected: string;
    }[];
  };

  // SPEC.md 9.4.2 fixes the signed material. Every other signing test here is
  // self-relative, so it could be changed wholesale without one of them failing.
  it.each(signatureVectors.cases.map((c) => [c.name, c] as const))(
    "reproduces the %s signature vector",
    async (_name, vector) => {
      await expect(
        signPayloadWithRotation(
          { current: vector.secret, previous: vector.previousSecret },
          vector.timestamp,
          vector.body,
        ),
      ).resolves.toBe(vector.expected);
    },
  );
});

describe("built payloads validate against the specification schema", () => {
  it("a minimal event with no subscription and no price validates", () => {
    const validate = validateEvent();
    const payload = buildEventPayload(
      storedEvent({
        store: "amazon",
        subscription: undefined,
        subscriptionId: undefined,
        entitlementActive: undefined,
        currency: undefined,
        amountMicros: undefined,
        amountProvenance: undefined,
        userId: undefined,
        transactionId: undefined,
        originalTransactionId: undefined,
        sourceStoreNotificationId: undefined,
      }),
    );
    const ok = validate(payload);
    expect(validate.errors ?? [], JSON.stringify(validate.errors)).toEqual([]);
    expect(ok).toBe(true);
  });

  it("kit's emitter produces lifecycle events for Apple and Google only", async () => {
    // storeForPlatform maps the inbound platform enum, which has two members.
    // Horizon and Amazon reach kit through verification, not notifications —
    // which is exactly what their capability descriptor declares.
    for (const [platform, expectedStore] of [
      ["IOS", "apple"],
      ["Android", "google"],
    ] as const) {
      const { ctx, inserted } = emitterContext();
      await emitCommerceEvent(ctx as never, {
        projectId: "projects_1" as never,
        transition: "Renewed",
        active: true,
        previouslyActive: true,
        sourceEvent: { ...(richSource as object), platform } as never,
      });
      expect(inserted[0].doc.store).toBe(expectedStore);
    }
  });

  it("omits the snapshot rather than inventing an entitlement gate", () => {
    // The stored gate is optional. Emitting `active: false` for a row that
    // never recorded one would assert no access for something unknown.
    const payload = buildEventPayload(
      storedEvent({ entitlementActive: undefined }),
    );
    expect(payload.subscription).toBeUndefined();
    expect(validateEvent()(payload)).toBe(true);
  });

  it("carries the gate through when the row recorded one", () => {
    const payload = buildEventPayload(
      storedEvent({ entitlementActive: false }),
    );
    expect(payload.subscription?.active).toBe(false);
  });

  it("omits price entirely when the store asserted no amount, rather than sending zero", () => {
    const payload = buildEventPayload(
      storedEvent({ currency: undefined, amountMicros: undefined }),
    );
    expect(payload.price).toBeUndefined();
  });
});

describe("the subscription state vocabulary matches", () => {
  it("kit's own state vocabulary is one the specification declares", () => {
    // Reading the spec's enum and validating it against the spec's enum proves
    // nothing. The real claim is that kit's union is a subset of it.
    const source = readFileSync(
      fileURLToPath(new URL("../webhooks/shared.ts", import.meta.url)),
      "utf8",
    );
    const start = source.indexOf("export type SubscriptionState");
    const block = source.slice(start, source.indexOf(";", start));
    const declared = [...block.matchAll(/"([A-Za-z]+)"/g)].map((m) => m[1]);
    expect(declared.length).toBeGreaterThan(5);
    for (const state of declared) {
      expect(SPEC_SUBSCRIPTION_STATES, `${state} is undeclared`).toContain(
        state,
      );
    }
  });

  it("declares no provenance, store, or environment the specification lacks", () => {
    // Closed value space: the two lists must be identical.
    expect([...DATA_PROVENANCE_VALUES].sort()).toEqual(
      [...SPEC_DATA_PROVENANCE].sort(),
    );
    // Open value spaces: everything kit emits must still be a value the
    // specification names today.
    for (const store of COMMERCE_STORES) {
      expect(SPEC_KNOWN_STORES, `${store} is undeclared`).toContain(store);
    }
    const specEnvironments = (
      primitivesSchema as unknown as {
        $defs: { Environment: { examples: readonly string[] } };
      }
    ).$defs.Environment.examples;
    for (const environment of COMMERCE_ENVIRONMENTS) {
      expect(specEnvironments, `${environment} is undeclared`).toContain(
        environment,
      );
    }
  });

  it("rejects a state the specification does not declare", () => {
    const validate = validateEvent();
    const payload = buildEventPayload(
      storedEvent({
        subscription: { state: "Hibernating", productId: "premium.monthly" },
      }),
    );
    expect(validate(payload)).toBe(false);
  });
});

describe("kit's capabilities agree with the published descriptor", () => {
  const descriptor = JSON.parse(
    readFileSync(
      resolveSpec(
        "openiap-commerce-protocol/examples/provider-capabilities.json",
      ),
      "utf8",
    ),
  ) as {
    eventTypes: string[];
    stores: Record<
      string,
      Record<string, { provider: boolean; implementation: boolean }>
    >;
  };

  const FIELDS: [keyof (typeof PROVIDER_CAPABILITIES)["apple"], string][] = [
    ["supportsInitialValidation", "initialValidation"],
    ["supportsServerNotifications", "serverNotifications"],
    ["supportsSubscriptions", "subscriptions"],
    ["supportsRenewalEvents", "renewalEvents"],
    ["supportsRefundEvents", "refundEvents"],
    ["supportsExpiration", "expiration"],
    ["supportsReconciliation", "reconciliation"],
    ["supportsEntitlements", "entitlements"],
    ["supportsRevenueAmount", "revenueAmount"],
  ];

  it("publishes the event vocabulary kit implements", () => {
    expect([...descriptor.eventTypes].sort()).toEqual(
      [...COMMERCE_EVENT_TYPES].sort(),
    );
  });

  // kit knows one axis: what it implements. The descriptor carries both, and
  // fabricating the provider axis from kit's boolean is the conflation the
  // two-axis model exists to prevent — it would claim Amazon publishes no
  // notification channel merely because kit consumes none.
  it.each(Object.keys(PROVIDER_CAPABILITIES))(
    "%s implementation axis matches kit",
    (store) => {
      const caps =
        PROVIDER_CAPABILITIES[store as keyof typeof PROVIDER_CAPABILITIES];
      for (const [kitField, specField] of FIELDS) {
        expect(
          descriptor.stores[store][specField].implementation,
          `${store}.${specField}`,
        ).toBe(caps[kitField]);
      }
    },
  );

  it("never claims to implement more than the provider offers", () => {
    for (const [store, entry] of Object.entries(descriptor.stores)) {
      for (const [name, support] of Object.entries(entry)) {
        if (support.implementation) {
          expect(support.provider, `${store}.${name}`).toBe(true);
        }
      }
    }
  });
});

describe("kit reproduces the specification's lifecycle vectors", () => {
  const vectors = JSON.parse(
    readFileSync(
      resolveSpec("openiap-commerce-protocol/generated/vectors/lifecycle.json"),
      "utf8",
    ),
  ) as {
    entitlement: {
      cases: {
        name: string;
        state: string;
        expiresAt?: number;
        occurredAt: number;
        processedAt: number;
        entitled: boolean;
      }[];
    };
    emission: {
      cases: {
        name: string;
        lifecycleEvent: string | null;
        entitledBefore: boolean;
        entitledAfter: boolean;
        emit: string[];
      }[];
    };
    binding: {
      cases: {
        name: string;
        entitledAtBinding: boolean;
        emit: string[];
      }[];
    };
  };

  it.each(vectors.entitlement.cases.map((c) => [c.name, c] as const))(
    "entitlement: %s",
    (_name, testCase) => {
      const sub = {
        state: testCase.state,
        productId: "premium.monthly",
        ...(testCase.expiresAt === undefined
          ? {}
          : { expiresAt: testCase.expiresAt }),
      } as never;
      expect(entitlementActive(sub, testCase.processedAt)).toBe(
        testCase.entitled,
      );
    },
  );

  // Drives kit's REAL emitter. Re-deriving the expected list from
  // entitledBefore/entitledAfter would just restate the generator's formula and
  // could never fail — the point is to make `emitCommerceEvent` itself produce
  // the events the vectors demand.
  const KIT_TRANSITIONS = Object.keys(
    TRANSITION_TO_EVENT,
  ) as LifecycleTransition[];

  /** The kit transition whose mapping produces this specification event. */
  function transitionFor(lifecycleEvent: string | null) {
    const match = KIT_TRANSITIONS.find(
      (t) => commerceEventTypeForTransition(t) === lifecycleEvent,
    );
    if (!match) throw new Error(`no kit transition emits ${lifecycleEvent}`);
    return match;
  }

  it.each(vectors.emission.cases.map((c) => [c.name, c] as const))(
    "emission: %s",
    async (_name, testCase) => {
      const { ctx, inserted } = emitterContext();
      await emitCommerceEvent(ctx as never, {
        projectId: "projects_1" as never,
        transition: transitionFor(testCase.lifecycleEvent),
        active: testCase.entitledAfter,
        previouslyActive: testCase.entitledBefore,
        sourceEvent: richSource,
        subscription: {
          state: "Active",
          productId: "premium.monthly",
          userId: "user_5e91a7",
        },
      });
      const emitted = inserted
        .filter((row) => row.table === "commerceEvents")
        .map((row) => row.doc.eventType);
      expect(emitted).toEqual(testCase.emit);
    },
  );

  it.each(vectors.binding.cases.map((c) => [c.name, c] as const))(
    "first binding: %s",
    async (_name, testCase) => {
      const { ctx, inserted } = emitterContext();
      await emitCommerceEvent(ctx as never, {
        projectId: "projects_1" as never,
        transition: null,
        active: testCase.entitledAtBinding,
        previouslyActive: false,
        sourceEvent: richSource,
        subscription: {
          state: testCase.entitledAtBinding ? "Active" : "Expired",
          productId: "premium.monthly",
          userId: "user_5e91a7",
        },
      });
      expect(
        inserted
          .filter((row) => row.table === "commerceEvents")
          .map((row) => row.doc.eventType),
      ).toEqual(testCase.emit);
    },
  );

  it("maps every transition kit produces onto an event the vectors cover", () => {
    const covered = new Set(
      vectors.emission.cases.map((c) => c.lifecycleEvent).filter(Boolean),
    );
    const transitions = KIT_TRANSITIONS.filter((t) => t !== "Ignored");
    for (const transition of transitions) {
      const event = commerceEventTypeForTransition(transition);
      expect(event, `${transition} must map to an event`).toBeTruthy();
      expect(covered, `${event} must be covered by a vector`).toContain(event);
    }
  });

  it("emits nothing for the no-op transition, as the vectors require", () => {
    expect(commerceEventTypeForTransition("Ignored")).toBeNull();
    expect(commerceEventTypeForTransition(null)).toBeNull();
  });
});

describe("kit can produce everything the store mapping promises", () => {
  const mapping = JSON.parse(
    readFileSync(
      resolveSpec(
        "openiap-commerce-protocol/examples/store-event-mapping.json",
      ),
      "utf8",
    ),
  ) as {
    stores: Record<
      string,
      {
        notificationChannel: string | null;
        mappings: { event: string | null }[];
      }
    >;
  };

  it("never claims to consume a channel the store does not publish", () => {
    // notificationChannel is a fact about the store; the capability is a fact
    // about kit. Implementation implies provider, never the reverse.
    for (const [store, entry] of Object.entries(mapping.stores)) {
      const caps =
        PROVIDER_CAPABILITIES[store as keyof typeof PROVIDER_CAPABILITIES];
      if (!caps.supportsServerNotifications) continue;
      expect(
        entry.notificationChannel,
        `${store}: kit consumes notifications the mapping says do not exist`,
      ).not.toBeNull();
    }
  });

  it("records an unconsumed channel as a kit gap, not a store limitation", () => {
    // Amazon is the live case: the store publishes a channel, kit integrates
    // no receiver. Collapsing that into "the store has none" is the exact
    // conflation the two-axis capability model exists to prevent.
    expect(mapping.stores.amazon.notificationChannel).not.toBeNull();
    expect(PROVIDER_CAPABILITIES.amazon.supportsServerNotifications).toBe(
      false,
    );
  });

  it("produces no lifecycle events for a store the mapping leaves empty", () => {
    for (const [store, entry] of Object.entries(mapping.stores)) {
      if (entry.mappings.length > 0) continue;
      const caps =
        PROVIDER_CAPABILITIES[store as keyof typeof PROVIDER_CAPABILITIES];
      expect(caps.supportsSubscriptions, `${store}`).toBe(false);
      expect(caps.supportsRenewalEvents, `${store}`).toBe(false);
    }
  });
});

/**
 * Stands in for a MutationCtx. `destinations` lets a test exercise the
 * fan-out and the per-destination event-type filter, which a context that
 * always answers "no destinations" would hide entirely.
 */
function emitterContext(
  destinations: { _id: string; eventTypes?: string[] }[] = [],
) {
  const inserted: { table: string; doc: Record<string, unknown> }[] = [];
  const byId = new Map<string, Record<string, unknown>>();
  const rowsFor = (table: string) =>
    table === "outboundDestinations" ? destinations : [];
  const queryFor = (table: string) => {
    const q: Record<string, unknown> = {
      withIndex: () => q,
      collect: async () => rowsFor(table),
      unique: async () => rowsFor(table)[0] ?? null,
      first: async () => rowsFor(table)[0] ?? null,
    };
    return q;
  };
  const ctx = {
    db: {
      insert: async (table: string, doc: Record<string, unknown>) => {
        const id = `${table}_${inserted.length + 1}`;
        const row = { ...doc, _id: id, _creationTime: 0 };
        inserted.push({ table, doc: row });
        byId.set(id, row);
        return id;
      },
      patch: async (id: string, patchDoc: Record<string, unknown>) => {
        Object.assign(byId.get(id) ?? {}, patchDoc);
      },
      get: async (id: string) => byId.get(id) ?? null,
      query: (table: string) => queryFor(table),
    },
  };
  return { ctx, inserted };
}

/** A source event complete enough that the emitter fills every canonical field. */
const richSource = {
  _id: "webhookEvents_1",
  platform: "IOS",
  environment: "Production",
  occurredAt: 1_756_300_800_000,
  sourceNotificationId: "8f3b1c2d-4e5a-6b7c-8d9e-0f1a2b3c4d5e",
  productId: "premium.monthly",
  purchaseToken: "2000000811111111",
  currency: "USD",
  priceAmountMicros: 9_990_000,
  amountProvenance: "store",
} as never;

describe("kit's cancellation vocabulary is one the specification names", () => {
  // The tokens live in a schema description on one side and a TypeScript union
  // on the other, with nothing between them. A store this backend never sees
  // may add more, so the check is containment, not equality.
  const described = JSON.parse(
    readFileSync(
      resolveSpec(
        "openiap-commerce-protocol/generated/schemas/commerce-event.schema.json",
      ),
      "utf8",
    ),
  ).properties.subscription.properties.cancellationReason.description as string;

  const KIT_REASONS = [
    "UserCanceled",
    "BillingError",
    "PriceIncreaseDeclined",
    "ProductUnavailable",
    "Refunded",
    "Other",
  ];

  it("matches the union the receiver declares", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../webhooks/shared.ts", import.meta.url)),
      "utf8",
    );
    const start = source.indexOf("export type WebhookCancellationReason");
    const block = source.slice(start, source.indexOf(";", start));
    const declared = [...block.matchAll(/"([A-Za-z]+)"/g)].map((m) => m[1]);
    expect(declared.sort()).toEqual([...KIT_REASONS].sort());
  });

  it("is named in full by the specification", () => {
    for (const reason of KIT_REASONS) {
      expect(described, `${reason} is unnamed by the spec`).toContain(reason);
    }
  });
});

describe("what the emitter writes is a valid specification event", () => {
  // The two halves of this file never met: one validated a hand-written row,
  // the other checked event-type strings. Neither took what emitCommerceEvent
  // actually inserted and ran it through the wire builder and the published
  // schema — which is the only assertion that makes this a conformance test.
  const validate = validateEvent();

  it("a full lifecycle emission survives buildEventPayload and the schema", async () => {
    const { ctx, inserted } = emitterContext();
    await emitCommerceEvent(ctx as never, {
      projectId: "projects_1" as never,
      transition: "Renewed",
      active: true,
      previouslyActive: false,
      sourceEvent: richSource,
      subscriptionId: "subscriptions_1" as never,
      subscription: {
        state: "Active",
        productId: "premium.monthly",
        expiresAt: 1_758_979_200_000,
        renewsAt: 1_758_979_200_000,
        willRenew: true,
        userId: "user_5e91a7",
      },
    });

    const events = inserted.filter((row) => row.table === "commerceEvents");
    expect(events).toHaveLength(2);
    for (const row of events) {
      const payload = buildEventPayload(row.doc as never);
      const ok = validate(payload);
      expect(validate.errors ?? [], JSON.stringify(validate.errors)).toEqual(
        [],
      );
      expect(ok).toBe(true);
      // The internal identifiers the emitter stores must not reach the wire.
      const wire = payload as unknown as Record<string, unknown>;
      expect(wire.subscriptionId).toBeUndefined();
      expect(wire.sourceEventId).toBeUndefined();
      expect(wire._id).toBeUndefined();
    }
  });

  it("prices the lifecycle event only, never both events of one transition", async () => {
    const { ctx, inserted } = emitterContext();
    await emitCommerceEvent(ctx as never, {
      projectId: "projects_1" as never,
      transition: "Started",
      active: true,
      previouslyActive: false,
      sourceEvent: richSource,
      subscription: {
        state: "Active",
        productId: "premium.monthly",
        userId: "user_5e91a7",
      },
    });
    const events = inserted.filter((row) => row.table === "commerceEvents");
    expect(events.map((row) => row.doc.eventType)).toEqual([
      "subscription.started",
      "entitlement.granted",
    ]);
    expect(events[0].doc.amountMicros).toBe(9_990_000);
    expect(events[1].doc.amountMicros).toBeUndefined();
    expect(events[1].doc.currency).toBeUndefined();
    expect(events[1].doc.amountProvenance).toBeUndefined();
  });

  it("omits the amount when the source recorded no provenance", async () => {
    // "store" is the only provenance the contract calls authoritative, so
    // defaulting to it would present an unknown as a store assertion.
    const { ctx, inserted } = emitterContext();
    await emitCommerceEvent(ctx as never, {
      projectId: "projects_1" as never,
      transition: "Renewed",
      active: true,
      previouslyActive: true,
      sourceEvent: {
        ...(richSource as object),
        amountProvenance: undefined,
      } as never,
    });
    expect(inserted[0].doc.amountProvenance).toBeUndefined();
    expect(buildEventPayload(inserted[0].doc as never).price).toBeUndefined();
  });

  it("puts the amount on the entitlement event when there is no lifecycle event", async () => {
    // A receipt-bootstrapped first purchase flips the gate with no lifecycle
    // change. Dropping the amount there would lose it entirely.
    const { ctx, inserted } = emitterContext();
    await emitCommerceEvent(ctx as never, {
      projectId: "projects_1" as never,
      transition: null,
      active: true,
      previouslyActive: false,
      sourceEvent: richSource,
      subscription: {
        state: "Active",
        productId: "premium.monthly",
        userId: "user_5e91a7",
      },
    });
    const events = inserted.filter((row) => row.table === "commerceEvents");
    expect(events.map((row) => row.doc.eventType)).toEqual([
      "entitlement.granted",
    ]);
    expect(events[0].doc.amountMicros).toBe(9_990_000);
  });

  it("carries the store's own notification id, not the emitter's row id", async () => {
    const { ctx, inserted } = emitterContext();
    await emitCommerceEvent(ctx as never, {
      projectId: "projects_1" as never,
      transition: "Renewed",
      active: true,
      previouslyActive: true,
      sourceEvent: richSource,
    });
    const payload = buildEventPayload(inserted[0].doc as never);
    expect(payload.sourceStoreEventId).toBe(
      "8f3b1c2d-4e5a-6b7c-8d9e-0f1a2b3c4d5e",
    );
    expect(payload.price).toEqual({
      currency: "USD",
      amountMicros: 9_990_000,
      provenance: "store",
    });
  });

  it("fans out to a subscribed destination and skips an unsubscribed one", async () => {
    const { ctx, inserted } = emitterContext([
      { _id: "outboundDestinations_1" },
      { _id: "outboundDestinations_2", eventTypes: ["subscription.expired"] },
    ]);
    await emitCommerceEvent(ctx as never, {
      projectId: "projects_1" as never,
      transition: "Renewed",
      active: true,
      previouslyActive: true,
      sourceEvent: richSource,
    });
    const deliveries = inserted.filter(
      (row) => row.table === "outboundDeliveries",
    );
    // The filtering destination asked for a different event type.
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].doc.destinationId).toBe("outboundDestinations_1");
  });
});

describe("every mapping row produces the event it promises", () => {
  // The mapping table is prose until something runs it. Without this, a row can
  // claim any event that merely exists in the vocabulary and stay green — which
  // is exactly how several rows drifted from the pipeline.
  type Row = {
    storeNotification: string;
    storeNotificationCode?: string;
    storeSubtype?: string | null;
    whenNoPriorStoreEvent?: boolean;
    whenPreviousState?: string[];
    event: string | null;
  };
  const mapping = JSON.parse(
    readFileSync(
      resolveSpec(
        "openiap-commerce-protocol/examples/store-event-mapping.json",
      ),
      "utf8",
    ),
  ) as { stores: Record<string, { mappings: Row[] }> };

  /** Notifications carried on their own message field, not a type enum. */
  const SPECIAL: Record<string, string | null> = {
    voidedPurchaseNotification: "PurchaseRefunded",
    testNotification: "TestNotification",
  };

  function internalTypeFor(store: string, row: Row): string | null {
    if (row.storeNotification in SPECIAL) return SPECIAL[row.storeNotification];
    if (store === "apple") {
      return mapAppleNotificationType(
        row.storeNotification,
        row.storeSubtype ?? null,
      );
    }
    return mapGoogleSubscriptionNotificationType(
      Number(row.storeNotificationCode),
    );
  }

  function emittedFor(store: string, row: Row): string | null {
    const internalType = internalTypeFor(store, row);
    if (!internalType) return null;
    // This drives the state machine directly, so it models "no prior store
    // event" as "no record" — one of the two cases the qualifier covers. The
    // other, a record with no store history, is reached only through the full
    // handler and is exercised in subscriptions/internal.test.ts ("starts
    // rather than recovers when a record exists with no store history").
    const current = row.whenNoPriorStoreEvent
      ? null
      : {
          state: (row.whenPreviousState?.[0] ?? "Active") as never,
          productId: "premium.monthly",
          expiresAt: 9_999_999_999_999,
        };
    const result = applySubscriptionTransition(current, {
      type: internalType,
      productId: "premium.monthly",
      platform: store === "apple" ? "IOS" : "Android",
      purchaseToken: "token",
      expiresAt: 9_999_999_999_999,
    } as never);
    return commerceEventTypeForTransition(result.transition);
  }

  const cases = Object.entries(mapping.stores).flatMap(([store, entry]) =>
    entry.mappings.map(
      (row) =>
        [
          `${store} ${row.storeNotification}${row.storeSubtype ? `/${row.storeSubtype}` : ""}${row.whenNoPriorStoreEvent ? " (no store history)" : row.whenPreviousState ? ` (was ${row.whenPreviousState[0]})` : ""}`,
          store,
          row,
        ] as const,
    ),
  );

  // The implementation's own code table, read from its source. Google sends a
  // number; the readable name lives only in a trailing comment, so without this
  // the table's names are decoration the test never executes — swap two and it
  // stays green while an implementer maps the wrong notification.
  const googleCodeNames = (() => {
    const source = readFileSync(
      fileURLToPath(new URL("../webhooks/shared.ts", import.meta.url)),
      "utf8",
    );
    const start = source.indexOf("const GOOGLE_SUB_TYPE_MAP");
    expect(start, "GOOGLE_SUB_TYPE_MAP not found").toBeGreaterThan(-1);
    // End at the object's own closing brace rather than at whatever declaration
    // happens to follow it: a negative indexOf would silently swallow the rest
    // of the file and inflate the table.
    const end = source.indexOf("\n};", start);
    expect(end, "GOOGLE_SUB_TYPE_MAP is unterminated").toBeGreaterThan(start);
    const block = source.slice(start, end);
    const names = new Map<string, string>();
    const codes = new Set<string>();
    for (const line of block.split("\n")) {
      const entry = line.match(/^\s*(\d+):\s*"[^"]*",/);
      if (!entry) continue;
      codes.add(entry[1]);
      const named = line.match(/\/\/\s*([A-Z][A-Z_]+)/);
      // Every entry must name itself, or the table's names go unchecked.
      expect(named, `code ${entry[1]} has no name comment`).not.toBeNull();
      if (named) names.set(entry[1], named[1]);
    }
    expect(names.size).toBe(codes.size);
    return names;
  })();

  it("names every Google notification the way the store numbers it", () => {
    for (const row of mapping.stores.google.mappings) {
      if (!row.storeNotificationCode) continue;
      const expected = googleCodeNames.get(row.storeNotificationCode);
      expect(
        expected,
        `code ${row.storeNotificationCode} is not in the map`,
      ).toBeDefined();
      expect(row.storeNotification, `code ${row.storeNotificationCode}`).toBe(
        expected,
      );
    }
  });

  it("gives every Google notification code a row", () => {
    const covered = new Set(
      mapping.stores.google.mappings.map((row) => row.storeNotificationCode),
    );
    for (const code of googleCodeNames.keys()) {
      expect(covered, `code ${code} has no row`).toContain(code);
    }
  });

  it("names only Apple notifications the receiver recognises", () => {
    // A row for a type the receiver rejects would document a mapping that never
    // happens — and with `event: null` it would look like a deliberate no-op.
    for (const row of mapping.stores.apple.mappings) {
      expect(
        mapAppleNotificationType(
          row.storeNotification as never,
          (row.storeSubtype ?? null) as never,
        ),
        `${row.storeNotification} is not handled by the receiver`,
      ).not.toBeNull();
    }
  });

  // Both sides of the previous check came from the same object, so it could
  // never fail. Coverage has to be measured against the implementation's own
  // inventory, which is what the Google code check already does.
  const appleHandledTypes = (() => {
    const source = readFileSync(
      fileURLToPath(new URL("../webhooks/shared.ts", import.meta.url)),
      "utf8",
    );
    const start = source.indexOf("function mapAppleNotificationType");
    const end = source.indexOf("\n}", start);
    const body = source.slice(start, end);
    return new Set(
      [...body.matchAll(/case "([A-Z_]+)":/g)].map((match) => match[1]),
    );
  })();

  it("gives every Apple notification the receiver handles a row", () => {
    expect(appleHandledTypes.size).toBeGreaterThan(10);
    const covered = new Set(
      mapping.stores.apple.mappings.map((row) => row.storeNotification),
    );
    for (const type of appleHandledTypes) {
      expect(covered, `${type} has no row`).toContain(type);
    }
  });

  it.each(cases)("%s", (_label, store, row) => {
    expect(emittedFor(store, row)).toBe(row.event);
  });
});
