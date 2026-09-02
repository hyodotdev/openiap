// Programmatic access to the specification artifacts.
//
// The generated JSON Schemas are the runtime artifacts. Every exported contract
// value is read from them rather than restated here; their GraphQL authoring
// source is commerce-protocol.graphql.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const load = (name) =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../generated/schemas/${name}`, import.meta.url)),
      "utf8",
    ),
  );

export const primitivesSchema = load("primitives.schema.json");
/**
 * Every schema in one document with no external reference. Prefer this when
 * validating: it needs no sibling file and no network access, so an
 * implementation can validate offline and forever.
 */
export const bundleSchema = load("commerce-protocol.bundle.schema.json");
export const commerceEventSchema = load("commerce-event.schema.json");
export const providerCapabilitiesSchema = load(
  "provider-capabilities.schema.json",
);
export const storeEventMappingSchema = load("store-event-mapping.schema.json");
export const operationsSchema = load("operations.schema.json");

export const schemas = Object.freeze([
  primitivesSchema,
  commerceEventSchema,
  providerCapabilitiesSchema,
  storeEventMappingSchema,
  operationsSchema,
]);

const loadGenerated = (name) =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../generated/${name}`, import.meta.url)),
      "utf8",
    ),
  );

/** HTTP binding manifest for the operation surface, generated from the SDL. */
export const HTTP_BINDING = Object.freeze(
  loadGenerated("bindings/http-binding.json"),
);

/** Protocol error codes this version names; the value space stays open. */
export const KNOWN_PROTOCOL_ERROR_CODES = Object.freeze([
  ...operationsSchema.$defs.ProtocolError.properties.code.examples,
]);

/** Operation profiles and transport bindings, keyed by name with versions. */
export const PROTOCOL_PROFILES = Object.freeze({ ...HTTP_BINDING.profiles });
export const PROTOCOL_BINDINGS = Object.freeze({ ...HTTP_BINDING.bindings });

const eventVersion = commerceEventSchema.$id.match(/\/(\d+\.\d+)\//)?.[1];
if (!eventVersion)
  throw new Error("Commerce event schema has no MAJOR.MINOR ID");

/** Version of the event body, derived from the generated schema identifier. */
export const COMMERCE_EVENT_VERSION = eventVersion;

/** Event types named by this version; the schema permits future minor values. */
export const KNOWN_COMMERCE_EVENT_TYPES = Object.freeze([
  ...commerceEventSchema.properties.eventType.examples,
]);

/**
 * The stores this version names. The value space is deliberately open — an
 * implementation may emit a store that is not listed here, and a consumer must
 * forward it rather than reject the event.
 */
export const KNOWN_STORES = Object.freeze([
  ...primitivesSchema.$defs.Store.examples,
]);

export const SUBSCRIPTION_STATES = Object.freeze([
  ...primitivesSchema.$defs.SubscriptionState.enum,
]);

export const DATA_PROVENANCE = Object.freeze([
  ...primitivesSchema.$defs.DataProvenance.enum,
]);

/** Bounds on the `extensions` escape hatch, read from the schema. */
export const EXTENSION_LIMITS = Object.freeze({
  maxEntries: primitivesSchema.$defs.Extensions.maxProperties,
  maxKeyLength: primitivesSchema.$defs.Extensions.propertyNames.maxLength,
  maxValueLength:
    primitivesSchema.$defs.Extensions.additionalProperties.maxLength,
});

/**
 * Transport constants a receiver needs, read from the published vectors so the
 * package cannot disagree with the file an implementation actually tests
 * against. Behaviour is specified in SPEC.md §9.4.
 */
const signatureVectors = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../vectors/signatures.json", import.meta.url)),
    "utf8",
  ),
);

export const WEBHOOK = Object.freeze({
  signatureHeader: signatureVectors.headers.signature,
  timestampHeader: signatureVectors.headers.timestamp,
  eventIdHeader: signatureVectors.headers.eventId,
  deliveryIdHeader: signatureVectors.headers.deliveryId,
  // Literals, not derived values: SPEC.md §9.4.2 and §9.4.1 name them, and
  // test/vectors.test.mjs asserts every vector carries the prefix.
  signaturePrefix: "v1=",
  contentType: "application/json",
  toleranceSeconds: signatureVectors.toleranceSeconds,
});
