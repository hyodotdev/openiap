#!/usr/bin/env node
// Derives the lifecycle vectors from the rules SPEC.md states, not from any
// implementation. An implementation is then checked against them; that
// direction is what makes them a specification artifact rather than a
// transcript of one backend's behaviour.
//
// Generated and committed. `bun run test` byte-compares it and fails if it drifts.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const at = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const primitives = JSON.parse(
  readFileSync(at("generated/schemas/primitives.schema.json"), "utf8"),
);
const STATES = primitives.$defs.SubscriptionState.enum;

// SPEC.md 2.3: only these two states grant access, and expiry is exclusive.
const ENTITLED_STATES = new Set(["Active", "InGracePeriod"]);
const entitled = (state, expiresAt, processedAt) =>
  ENTITLED_STATES.has(state) &&
  (expiresAt === undefined || processedAt < expiresAt);

const PROCESSED_AT = 1_756_300_800_000;
const OCCURRED_AT = PROCESSED_AT - 1_000;
const entitlementCases = [];
for (const state of STATES) {
  for (const [label, expiresAt] of [
    ["no expiry", undefined],
    ["expires in the future", PROCESSED_AT + 86_400_000],
    ["expires exactly at processing", PROCESSED_AT],
    ["expired before processing", PROCESSED_AT - 1],
  ]) {
    entitlementCases.push({
      name: `${state} / ${label}`,
      state,
      ...(expiresAt === undefined ? {} : { expiresAt }),
      occurredAt: OCCURRED_AT,
      processedAt: PROCESSED_AT,
      entitled: entitled(state, expiresAt, PROCESSED_AT),
    });
  }
}

// SPEC.md 9.1: an entitlement event accompanies a lifecycle event only when the
// gate actually flips, and a transition that changes nothing emits neither.
//
// Keyed on the event type itself, never on an implementation's internal
// transition names: how a backend decides that a renewal happened is its own
// business, but what it must then emit is the specification's.
//
// This is a full cross-product, and deliberately so: it isolates the EMISSION
// RULE from event/snapshot consistency. A row here is an input to that one rule,
// not a wire event or a claim that a store can produce the combination. The
// GraphQL contract separately rejects contradictory event snapshots.
const LIFECYCLE_EVENTS = JSON.parse(
  readFileSync(at("generated/schemas/commerce-event.schema.json"), "utf8"),
).properties.eventType.examples.filter((type) =>
  type.startsWith("subscription."),
);

const emissionCases = [];
for (const lifecycleEvent of [...LIFECYCLE_EVENTS, null]) {
  for (const [wasActive, isActive] of [
    [false, false],
    [false, true],
    [true, true],
    [true, false],
  ]) {
    const events = [];
    if (lifecycleEvent) events.push(lifecycleEvent);
    if (wasActive !== isActive) {
      events.push(isActive ? "entitlement.granted" : "entitlement.revoked");
    }
    emissionCases.push({
      name: `${lifecycleEvent ?? "no lifecycle change"} (${wasActive ? "entitled" : "not entitled"} -> ${isActive ? "entitled" : "not entitled"})`,
      lifecycleEvent,
      entitledBefore: wasActive,
      entitledAfter: isActive,
      emit: events,
    });
  }
}

// SPEC.md 2.4: unbound deltas are coalesced at first binding. Historical
// changes are never replayed when their result is no longer current.
const bindingCases = [
  {
    name: "bind while the first grant is current",
    unboundGateChanges: ["entitlement.granted"],
    entitledAtBinding: true,
    emit: ["entitlement.granted"],
  },
  {
    name: "bind after the unbound grant expired",
    unboundGateChanges: ["entitlement.granted"],
    entitledAtBinding: false,
    emit: [],
  },
  {
    name: "bind after an unbound grant was revoked",
    unboundGateChanges: ["entitlement.granted", "entitlement.revoked"],
    entitledAtBinding: false,
    emit: [],
  },
  {
    name: "bind after an unbound gate reopened",
    unboundGateChanges: [
      "entitlement.granted",
      "entitlement.revoked",
      "entitlement.granted",
    ],
    entitledAtBinding: true,
    emit: ["entitlement.granted"],
  },
];

const doc = {
  $comment:
    "Deterministic lifecycle vectors for the OpenIAP Commerce Protocol. Any implementation, in any language, must reproduce every expected value. These are derived from the rules in SPEC.md — sections 2.3, 2.4, and 9.1 — and not from any particular backend, so passing them demonstrates conformance to the specification rather than agreement with one implementation.",
  entitlement: {
    rule: "SPEC.md 2.3. Evaluate at processedAt. Entitled when the state grants access AND processedAt < expiresAt. An omitted expiresAt means no expiry is known. The boundary is exclusive: processedAt == expiresAt is NOT entitled.",
    cases: entitlementCases,
  },
  emission: {
    rule: "SPEC.md 9.1. `lifecycleEvent` is the subscription event the emitter determined occurred, or null when nothing lifecycle-relevant changed. An entitlement event is emitted only when the gate actually flips, and follows the lifecycle event when both occur. How an emitter decides which lifecycle event occurred is implementation business; what it must then emit is not.",
    precondition:
      "Every case assumes the purchase has a bound userId and productId. SPEC.md 2.4 defers an entitlement delta while that actionable target is unavailable.",
    cases: emissionCases,
  },
  binding: {
    rule: "SPEC.md 2.4. At first binding, coalesce every unbound gate change into the current predicate evaluated at binding processedAt. The unbound baseline is not entitled: emit one entitlement.granted only when the current gate is open; never replay an obsolete historical grant or revoke.",
    cases: bindingCases,
  },
};

const target = at("generated/vectors/lifecycle.json");
const serialized = `${JSON.stringify(doc, null, 2)}\n`;
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== serialized) {
    console.error(
      "generated/vectors/lifecycle.json is stale. Run: node scripts/build-lifecycle-vectors.mjs",
    );
    process.exit(1);
  }
  console.log("lifecycle vectors are current");
} else {
  writeFileSync(target, serialized);
  console.log(
    `wrote ${target} (${entitlementCases.length} entitlement, ${emissionCases.length} emission, ${bindingCases.length} binding)`,
  );
}
