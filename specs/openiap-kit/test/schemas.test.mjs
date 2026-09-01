import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

// draft 2020-12 needs ajv's 2020 entry point; the default export is draft-07.
import Ajv from "ajv/dist/2020.js";
import { describe, expect, it } from "vitest";

import {
  KNOWN_COMMERCE_EVENT_TYPES,
  bundleSchema,
  COMMERCE_EVENT_VERSION,
  DATA_PROVENANCE,
  EXTENSION_LIMITS,
  KNOWN_STORES,
  WEBHOOK,
  commerceEventSchema,
  primitivesSchema,
  providerCapabilitiesSchema,
  schemas,
  storeEventMappingSchema,
} from "../src/index.mjs";

const dir = (name) => fileURLToPath(new URL(`../${name}`, import.meta.url));
const readExample = (name) =>
  JSON.parse(readFileSync(`${dir("examples")}/${name}`, "utf8"));

function ajv() {
  const instance = new Ajv({ strict: true, allErrors: true });
  // Schemas cross-reference each other by filename, matching how a consumer
  // fetches them from the published directory.
  instance.addSchema(primitivesSchema, "primitives.schema.json");
  instance.addSchema(commerceEventSchema, "commerce-event.schema.json");
  instance.addSchema(
    providerCapabilitiesSchema,
    "provider-capabilities.schema.json",
  );
  instance.addSchema(
    storeEventMappingSchema,
    "store-event-mapping.schema.json",
  );
  return instance;
}

const validateEvent = () => ajv().getSchema("commerce-event.schema.json");
const validateCapabilities = () =>
  ajv().getSchema("provider-capabilities.schema.json");

describe("schema integrity", () => {
  it("every schema compiles under strict mode", () => {
    expect(() => ajv()).not.toThrow();
  });

  it("every schema declares a stable $id", () => {
    const version = COMMERCE_EVENT_VERSION.replace(".", "\\.");
    for (const schema of [...schemas, bundleSchema]) {
      expect(schema.$id, schema.title).toMatch(
        new RegExp(
          `^https://openiap\\.dev/schemas/commerce-protocol/${version}/[a-z0-9.-]+\\.schema\\.json$`,
        ),
      );
    }
  });

  it("every definition carries a description", () => {
    for (const schema of schemas) {
      for (const [name, def] of Object.entries(schema.$defs ?? {})) {
        expect(
          def.description,
          `${schema.title}#${name} needs a description`,
        ).toBeTruthy();
      }
    }
  });

  it("every declared property carries a description", () => {
    // A member with neither a description nor prose leaves a consumer guessing;
    // two shipped that way before this check existed.
    const walk = (node, path) => {
      if (!node || typeof node !== "object") return;
      for (const [name, prop] of Object.entries(node.properties ?? {})) {
        // A $ref inherits the description of whatever it points at.
        if (prop.$ref) continue;
        expect(
          prop.description,
          `${path}.${name} needs a description`,
        ).toBeTruthy();
        walk(prop, `${path}.${name}`);
      }
      for (const [name, def] of Object.entries(node.$defs ?? {})) {
        walk(def, `${path}#${name}`);
      }
    };
    for (const schema of schemas) walk(schema, schema.title);
  });
});

describe("the closed objects SPEC.md 12 names", () => {
  const closed = [];
  const walk = (node, path) => {
    if (!node || typeof node !== "object") return;
    if (node.additionalProperties === false) closed.push(path);
    for (const [name, prop] of Object.entries(node.properties ?? {})) {
      walk(prop, `${path}.${name}`);
    }
    for (const [name, def] of Object.entries(node.$defs ?? {})) {
      walk(def, `${path}#${name}`);
    }
  };
  for (const schema of schemas) walk(schema, schema.title);

  it("is the capability axis, the mapping row, and the tokenless server reads", () => {
    // 9 tolerates unknown members on open objects, and closes exactly these:
    // Support/Mapping (an unknown qualifier changes selection) and the
    // tokenless server-read results (a closed object is what makes "no token
    // can appear" enforceable by the schema rather than a name blocklist).
    expect(closed.map((p) => p.split("#").pop()).sort()).toEqual([
      "EntitlementsResult",
      "Mapping",
      "ProtocolError",
      "ProtocolErrorResponse",
      "SubscriptionStatusResult",
      "SubscriptionStatusSnapshot",
      "Support",
    ]);
  });
});

describe("commerce event examples", () => {
  // Event examples are the ones that are events. Anything else in examples/
  // documents a different schema and is covered by its own suite.
  const files = readdirSync(dir("examples")).filter(
    (f) => readExample(f).eventType !== undefined,
  );

  it.each(files)("%s validates", (file) => {
    const validate = validateEvent();
    const ok = validate(readExample(file));
    expect(validate.errors ?? [], JSON.stringify(validate.errors)).toEqual([]);
    expect(ok).toBe(true);
  });
});

describe("commerce event rejections", () => {
  const base = () => readExample("subscription-renewed.json");

  const reject = (mutate) => {
    const event = base();
    mutate(event);
    const validate = validateEvent();
    expect(validate(event)).toBe(false);
    return validate.errors;
  };

  // §9 adds an event type in a MINOR, so a validator pinned on the major must
  // accept one it does not know — otherwise the compatibility promise is void.
  // The shape is still constrained.
  it("accepts an event type a later minor version adds", () => {
    const event = readExample("subscription-renewed.json");
    event.eventType = "subscription.frobnicated";
    event.eventVersion = "1.1";
    expect(validateEvent()(event)).toBe(true);
  });

  it("rejects an empty environment placeholder", () => {
    reject((event) => {
      event.environment = "";
    });
  });

  // Declarations the model makes meaningless must not validate: consuming what
  // a store does not offer, and mapping notifications on a store that publishes
  // none.
  it("rejects consuming a capability the store does not offer", () => {
    const doc = readExample("provider-capabilities.json");
    doc.stores.apple.initialValidation = {
      provider: false,
      implementation: true,
      notes: "impossible",
    };
    expect(validateCapabilities()(doc)).toBe(false);
  });

  it("rejects an event type that is not a namespaced token", () => {
    reject((e) => {
      e.eventType = "Subscription.Frobnicated";
    });
  });

  it("rejects a missing required member", () => {
    reject((e) => {
      delete e.projectId;
    });
  });

  it("rejects a fractional timestamp", () => {
    // Note what this does NOT catch: a seconds-resolution value is a valid
    // integer, so the schema accepts it. Only the unit convention in SPEC.md 2.1
    // rules it out, and no validator can enforce that.
    reject((e) => {
      e.occurredAt = 1756300800.5;
    });
  });

  it("rejects a lowercase currency", () => {
    reject((e) => {
      e.price.currency = "usd";
    });
  });

  it("rejects money without provenance, so an inferred amount cannot pass as store-authoritative", () => {
    reject((e) => {
      delete e.price.provenance;
    });
  });

  it("rejects a negative amount, because price is a magnitude and never a sign", () => {
    reject((e) => {
      e.price.amountMicros = -9_990_000;
    });
  });

  it("rejects a non-integer amount, which would lose precision", () => {
    reject((e) => {
      e.price.amountMicros = 9.99;
    });
  });

  it("rejects a subscription snapshot without the entitlement gate", () => {
    reject((e) => {
      delete e.subscription.active;
    });
  });

  it("requires every entitlement event to identify its user and product", () => {
    for (const file of [
      "entitlement-granted-no-subscription.json",
      "entitlement-revoked.json",
    ]) {
      for (const missing of ["userId", "productId"]) {
        const event = readExample(file);
        delete event[missing];
        const validate = validateEvent();
        expect(validate(event), `${file} must require ${missing}`).toBe(false);
      }
    }
  });

  it.each([
    ["entitlement.granted", false],
    ["entitlement.revoked", true],
  ])("rejects %s when its snapshot active is %s", (eventType, active) => {
    const event = base();
    event.eventType = eventType;
    event.subscription.active = active;
    expect(validateEvent()(event)).toBe(false);
  });

  const snapshotStateRules = [
    ["subscription.started", "Active"],
    ["subscription.renewed", "Active"],
    ["subscription.recovered", "Active"],
    ["subscription.resumed", "Active"],
    ["subscription.entered_grace_period", "InGracePeriod"],
    ["subscription.entered_billing_retry", "InBillingRetry"],
    ["subscription.expired", "Expired"],
    ["subscription.revoked", "Revoked"],
    ["subscription.refunded", "Refunded"],
    ["subscription.paused", "Paused"],
  ];

  it.each(snapshotStateRules)(
    "rejects %s with the wrong snapshot state",
    (eventType, expectedState) => {
      const event = base();
      event.eventType = eventType;
      event.subscription.state =
        expectedState === "Active" ? "Expired" : "Active";
      if (
        [
          "subscription.entered_billing_retry",
          "subscription.expired",
          "subscription.revoked",
          "subscription.refunded",
          "subscription.paused",
        ].includes(eventType)
      ) {
        event.subscription.active = false;
      }
      expect(validateEvent()(event)).toBe(false);
    },
  );

  it.each([
    ["subscription.entered_billing_retry", "InBillingRetry"],
    ["subscription.expired", "Expired"],
    ["subscription.revoked", "Revoked"],
    ["subscription.refunded", "Refunded"],
    ["subscription.paused", "Paused"],
  ])("rejects %s when its snapshot is active", (eventType, state) => {
    const event = base();
    event.eventType = eventType;
    event.subscription.state = state;
    event.subscription.active = true;
    expect(validateEvent()(event)).toBe(false);
  });

  it("allows a lifecycle event without a snapshot", () => {
    const event = base();
    event.eventType = "subscription.revoked";
    delete event.subscription;
    expect(validateEvent()(event)).toBe(true);
  });

  it("rejects a non-string extension value", () => {
    reject((e) => {
      e.extensions = { attempts: 3 };
    });
  });

  it("rejects more extension entries than the bound allows", () => {
    reject((e) => {
      e.extensions = Object.fromEntries(
        Array.from({ length: 25 }, (_, i) => [`k${i}`, "v"]),
      );
    });
  });

  it("rejects an over-long extension value", () => {
    reject((e) => {
      e.extensions = { blob: "x".repeat(513) };
    });
  });

  it("rejects an eventVersion that is not MAJOR.MINOR", () => {
    reject((e) => {
      e.eventVersion = "1";
    });
  });

  it("rejects a non-canonical eventVersion with a leading zero", () => {
    reject((e) => {
      e.eventVersion = "01.0";
    });
  });

  it("accepts a 256-character identifier and rejects 257", () => {
    const accepted = base();
    accepted.userId = "u".repeat(256);
    expect(validateEvent()(accepted)).toBe(true);

    reject((e) => {
      e.userId = "u".repeat(257);
    });
  });
});

describe("forward compatibility", () => {
  it("accepts an unknown optional member, so a minor addition does not break a pinned consumer", () => {
    const event = readExample("subscription-renewed.json");
    event.somethingAddedInAMinorVersion = { nested: true };
    const validate = validateEvent();
    expect(validate(event)).toBe(true);
  });

  it("accepts an unrecognised environment, which is an open value space", () => {
    const event = readExample("subscription-renewed.json");
    event.environment = "a-store-environment-that-does-not-exist-yet";
    expect(validateEvent()(event)).toBe(true);
  });
});

describe("provider capabilities", () => {
  it("requires notes whenever a capability is not fully supported", () => {
    const doc = readExample("provider-capabilities.json");
    doc.stores.horizon.serverNotifications = {
      provider: false,
      implementation: false,
    };
    expect(validateCapabilities()(doc)).toBe(false);
  });

  it("requires notes when provider and implementation disagree", () => {
    const doc = readExample("provider-capabilities.json");
    doc.stores.amazon.serverNotifications = {
      provider: true,
      implementation: false,
    };
    expect(validateCapabilities()(doc)).toBe(false);
  });

  it("accepts a store this version does not name, since the value space is open", () => {
    const doc = readExample("provider-capabilities.json");
    doc.stores.nintendo = doc.stores.apple;
    expect(validateCapabilities()(doc)).toBe(true);
  });

  it("rejects a descriptor that does not say which events it emits", () => {
    const doc = readExample("provider-capabilities.json");
    delete doc.eventTypes;
    expect(validateCapabilities()(doc)).toBe(false);
  });

  it("rejects an empty or duplicated event-type list", () => {
    for (const value of [
      [],
      ["subscription.renewed", "subscription.renewed"],
    ]) {
      const doc = readExample("provider-capabilities.json");
      doc.eventTypes = value;
      expect(validateCapabilities()(doc)).toBe(false);
    }
  });

  it("rejects a descriptor with no specification version", () => {
    const doc = readExample("provider-capabilities.json");
    delete doc.specVersion;
    expect(validateCapabilities()(doc)).toBe(false);
  });

  it("rejects a store key that is not a valid token", () => {
    const doc = readExample("provider-capabilities.json");
    doc.stores["Nintendo Switch"] = doc.stores.apple;
    expect(validateCapabilities()(doc)).toBe(false);
  });

  it("declares every store this version names", () => {
    const doc = readExample("provider-capabilities.json");
    expect(Object.keys(doc.stores).sort()).toEqual([...KNOWN_STORES].sort());
  });
});

describe("the descriptor cannot drift from the contract", () => {
  it("declares exactly the event types the schema defines", () => {
    // This list is hand-written in an example file. Nothing else keeps it
    // honest, which is precisely why it needs a test.
    const doc = readExample("provider-capabilities.json");
    expect([...doc.eventTypes].sort()).toEqual(
      [...KNOWN_COMMERCE_EVENT_TYPES].sort(),
    );
  });

  it("declares a specification version", () => {
    // specVersion and eventVersion are different quantities that happen to
    // coincide at 1.0; asserting equality would weld them.
    const doc = readExample("provider-capabilities.json");
    expect(doc.specVersion).toMatch(/^[0-9]+\.[0-9]+$/);
    expect(doc.specVersion.split(".")[0]).toBe(
      COMMERCE_EVENT_VERSION.split(".")[0],
    );
  });
});

describe("prose cannot drift from the schemas", () => {
  const spec = readFileSync(dir("SPEC.md"), "utf8");

  it("names every event type", () => {
    for (const type of KNOWN_COMMERCE_EVENT_TYPES) {
      expect(spec, `${type} is undocumented`).toContain(type);
    }
  });

  it("names every subscription state", () => {
    for (const state of primitivesSchema.$defs.SubscriptionState.enum) {
      expect(spec, `${state} is undocumented`).toContain(`\`${state}\``);
    }
  });

  it("names every provenance value", () => {
    for (const value of DATA_PROVENANCE) {
      expect(spec, `${value} is undocumented`).toContain(`\`${value}\``);
    }
  });

  it("states the extension bounds the schema enforces", () => {
    for (const bound of Object.values(EXTENSION_LIMITS)) {
      expect(spec, `${bound} is unstated`).toContain(String(bound));
    }
  });

  it("names schema members by the names the schemas actually use", () => {
    // A rename that reaches the schema but not the prose leaves the document
    // teaching a field that no longer exists.
    const conditions = Object.keys(
      storeEventMappingSchema.$defs.Mapping.properties,
    ).filter((name) => name.startsWith("when"));
    expect(conditions.length).toBeGreaterThan(0);
    for (const name of conditions) {
      expect(spec, `${name} is undocumented`).toContain(name);
    }
  });

  it("states the transport constants the vectors pin", () => {
    for (const header of [
      WEBHOOK.signatureHeader,
      WEBHOOK.timestampHeader,
      WEBHOOK.eventIdHeader,
      WEBHOOK.deliveryIdHeader,
    ]) {
      expect(spec, `${header} is undocumented`).toContain(header);
    }
    expect(spec).toContain(String(WEBHOOK.toleranceSeconds));
  });
});

describe("derived exports", () => {
  it("exposes the event types as an immutable list", () => {
    // Equality with the schema is guaranteed by construction in src/index.mjs;
    // what is worth pinning is that a consumer cannot mutate the shared arrays
    // and poison every other derived export in the process.
    expect(Object.isFrozen(KNOWN_COMMERCE_EVENT_TYPES)).toBe(true);
  });
});
