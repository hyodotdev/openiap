import { CAPABILITY_STORES, capabilityLevel } from "../spec/generated-spec.mjs";
import { BEHAVIORS, behaviorById } from "../spec/behaviors.mjs";
import { SUITE_VERSION, specVersion } from "../spec/version.mjs";

/**
 * Drives an adapter through every behavior and returns a compatibility report.
 *
 * The runner owns capability gating so adapters cannot skip their own
 * requirements: a behavior gated on a capability the store must support is
 * required, and one gated on a capability the store cannot support is inverted
 * into an absence check rather than dropped.
 */

/** @typedef {'pass' | 'fail' | 'skip' | 'not-applicable' | 'warn'} Outcome */

const NOT_IMPLEMENTED = Symbol("not-implemented");

function selectBehaviors(requested) {
  if (requested === undefined) {
    return {
      behaviors: BEHAVIORS,
      scope: {
        complete: true,
        evaluatedBehaviorIds: BEHAVIORS.map((behavior) => behavior.id),
        totalBehaviorCount: BEHAVIORS.length,
      },
    };
  }
  if (!Array.isArray(requested))
    throw new Error("options.behaviors must be an array");

  const ids = requested.map((behavior) => behavior?.id);
  if (ids.some((id) => typeof id !== "string")) {
    throw new Error("every selected behavior needs an id");
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error("selected behaviors must not contain duplicate ids");
  }
  const behaviors = ids.map(behaviorById);
  return {
    behaviors,
    scope: {
      complete: behaviors.length === BEHAVIORS.length,
      evaluatedBehaviorIds: ids,
      totalBehaviorCount: BEHAVIORS.length,
    },
  };
}

function resolveApplicability(behavior, adapter) {
  if (!behavior.capability) return { applicable: true, level: "required" };

  let level;
  try {
    level = capabilityLevel(behavior.capability, adapter.store);
  } catch (error) {
    return {
      applicable: false,
      level: "unknown",
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  if (level === "unsupported") {
    return {
      applicable: false,
      level,
      reason: `${adapter.store} does not support ${behavior.capability}`,
    };
  }
  return { applicable: true, level };
}

async function runOne(behavior, adapter) {
  const { applicable, level, reason } = resolveApplicability(behavior, adapter);
  const check = adapter.behaviors?.[behavior.id];

  if (level === "unknown") {
    return {
      id: behavior.id,
      outcome: behavior.level === "MUST" ? "fail" : "warn",
      capabilityLevel: level,
      reason,
    };
  }

  if (!applicable) {
    // An unsupported store must still degrade predictably. If the adapter
    // provides an absence check, run it; otherwise record not-applicable.
    const absence = adapter.absenceChecks?.[behavior.id];
    if (!absence) {
      return {
        id: behavior.id,
        outcome: "not-applicable",
        capabilityLevel: level,
        reason,
      };
    }
    try {
      await absence();
      return {
        id: behavior.id,
        outcome: "pass",
        capabilityLevel: level,
        reason: "documented absence verified",
      };
    } catch (error) {
      return {
        id: behavior.id,
        outcome: "fail",
        capabilityLevel: level,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  if (level === "optional" && !check) {
    return {
      id: behavior.id,
      outcome: "not-applicable",
      capabilityLevel: level,
      reason: `${adapter.store} optionally supports ${behavior.capability}`,
    };
  }

  if (!check) {
    // An unimplemented MUST is a failure, not a skip. Silent gaps are how a
    // suite ends up reporting compliance it never checked.
    return {
      id: behavior.id,
      outcome: behavior.level === "MUST" ? "fail" : "warn",
      capabilityLevel: level,
      reason: "adapter does not implement this behavior",
    };
  }

  try {
    const result = await check();
    if (result === NOT_IMPLEMENTED) {
      if (level === "optional") {
        return {
          id: behavior.id,
          outcome: "not-applicable",
          capabilityLevel: level,
          reason: "optional capability not implemented",
        };
      }
      return {
        id: behavior.id,
        outcome: behavior.level === "MUST" ? "fail" : "warn",
        capabilityLevel: level,
        reason: "adapter reported not-implemented",
      };
    }
    return { id: behavior.id, outcome: "pass", capabilityLevel: level };
  } catch (error) {
    return {
      id: behavior.id,
      outcome: behavior.level === "MUST" ? "fail" : "warn",
      capabilityLevel: level,
      reason: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * @param {object} adapter - see packages/conformance/README.md
 * @param {{ behaviors?: ReadonlyArray<object> }} [options]
 */
export async function runConformance(adapter, options = {}) {
  if (!adapter?.implementation)
    throw new Error("adapter.implementation is required");
  if (!adapter?.store) throw new Error("adapter.store is required");
  if (!CAPABILITY_STORES.includes(adapter.store)) {
    throw new Error(
      `adapter.store must be one of: ${CAPABILITY_STORES.join(", ")}; received ${adapter.store}`,
    );
  }

  const { behaviors, scope } = selectBehaviors(options.behaviors);
  const results = [];
  for (const behavior of behaviors) {
    results.push({
      ...(await runOne(behavior, adapter)),
      category: behavior.category,
      level: behavior.level,
    });
  }

  const counts = results.reduce(
    (acc, result) => ({
      ...acc,
      [result.outcome]: (acc[result.outcome] ?? 0) + 1,
    }),
    /** @type {Record<Outcome, number>} */ ({}),
  );

  const hasFailures = results.some((result) => result.outcome === "fail");
  return {
    suiteVersion: SUITE_VERSION,
    specVersion: specVersion(),
    implementation: adapter.implementation,
    store: adapter.store,
    results,
    counts,
    scope,
    conformant: scope.complete && !hasFailures,
  };
}

export { NOT_IMPLEMENTED };
