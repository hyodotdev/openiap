import { createMiddleware } from "hono/factory";
import type { Context } from "hono";

import { parsePositiveNumber } from "../../utils/env";
import { getRequestIp, hashApiKey } from "./rate-limit";

export interface InFlightState {
  active: number;
  byKey: Map<string, number>;
  byIp: Map<string, number>;
}

export interface InFlightLimitConfig {
  /** Maximum number of downstream handlers executing in this process. */
  maxInFlight: number;
  /** Maximum handlers one API key may occupy in this process. */
  maxInFlightPerKey: number;
  /** Maximum handlers one trusted source IP may occupy in this process. */
  maxInFlightPerIp: number;
  /** Retry hint returned when the process is already at capacity. */
  retryAfterSeconds: number;
  /** Injectable state for deterministic tests or an isolated route group. */
  state: InFlightState;
  /** Injectable trusted-IP resolver for deterministic tests. */
  getIp: (c: Context) => string | undefined;
}

const DEFAULT_MAX_IN_FLIGHT = Math.floor(
  parsePositiveNumber(process.env.VERIFY_MAX_IN_FLIGHT, 32, 1),
);
const DEFAULT_MAX_IN_FLIGHT_PER_KEY = Math.floor(
  parsePositiveNumber(process.env.VERIFY_MAX_IN_FLIGHT_PER_KEY, 8, 1),
);
const DEFAULT_MAX_IN_FLIGHT_PER_IP = Math.floor(
  parsePositiveNumber(process.env.VERIFY_MAX_IN_FLIGHT_PER_IP, 16, 1),
);
const DEFAULT_RETRY_AFTER_SECONDS = Math.ceil(
  parsePositiveNumber(process.env.VERIFY_BUSY_RETRY_AFTER_SEC, 1, 0.001),
);
const sharedVerifyState: InFlightState = {
  active: 0,
  byKey: new Map(),
  byIp: new Map(),
};

type InFlightLimitVars = {
  apiKeyHash?: string;
};

/**
 * Bound expensive verification work already executing in this process.
 *
 * Token buckets cap arrival rate, but a slow upstream store can make accepted
 * requests overlap for much longer than one refill interval. This guard stops
 * that overlap from growing without bound. It intentionally rejects instead
 * of queueing: an in-process queue would retain request bodies and sockets and
 * become another memory-exhaustion target during an outage or traffic spike.
 */
export function inFlightLimitMiddleware(
  config: Partial<InFlightLimitConfig> = {},
): ReturnType<typeof createMiddleware<{ Variables: InFlightLimitVars }>> {
  const maxInFlight = Math.max(
    1,
    Math.floor(config.maxInFlight ?? DEFAULT_MAX_IN_FLIGHT),
  );
  const maxInFlightPerKey = Math.max(
    1,
    Math.min(
      maxInFlight,
      Math.floor(config.maxInFlightPerKey ?? DEFAULT_MAX_IN_FLIGHT_PER_KEY),
    ),
  );
  const maxInFlightPerIp = Math.max(
    1,
    Math.min(
      maxInFlight,
      Math.floor(config.maxInFlightPerIp ?? DEFAULT_MAX_IN_FLIGHT_PER_IP),
    ),
  );
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil(config.retryAfterSeconds ?? DEFAULT_RETRY_AFTER_SECONDS),
  );
  const state = config.state ?? sharedVerifyState;
  const resolveIp = config.getIp ?? getRequestIp;

  return createMiddleware(async (c, next) => {
    const apiKeyHash = c.var.apiKeyHash;
    if (!apiKeyHash) {
      // Without a key hash the key/IP axes cannot be evaluated safely. Report
      // the process axis and fail closed while preserving the documented 500
      // response headers for the verification middleware chain.
      c.header("X-Concurrency-Limit", String(maxInFlight));
      c.header("X-Concurrency-Remaining", "0");
      c.header("X-Concurrency-Scope", "global");
      return c.json(
        {
          errors: [
            {
              code: "INTERNAL_MISCONFIGURATION",
              message:
                "Concurrency guard ran before the API key hash was populated.",
            },
          ],
        },
        500,
      );
    }

    // Fly overwrites `fly-client-ip`; direct/local traffic shares the
    // bounded "unknown" source instead of trusting spoofable forwarded headers.
    const ipHash = hashApiKey(`ip:${resolveIp(c) ?? "unknown"}`);
    const activeForKey = state.byKey.get(apiKeyHash) ?? 0;
    const activeForIp = state.byIp.get(ipHash) ?? 0;
    const scope =
      state.active >= maxInFlight
        ? "global"
        : activeForIp >= maxInFlightPerIp
          ? "ip"
          : activeForKey >= maxInFlightPerKey
            ? "key"
            : null;

    if (scope !== null) {
      const limit =
        scope === "global"
          ? maxInFlight
          : scope === "ip"
            ? maxInFlightPerIp
            : maxInFlightPerKey;
      c.header("Retry-After", String(retryAfterSeconds));
      c.header("X-Concurrency-Limit", String(limit));
      c.header("X-Concurrency-Remaining", "0");
      c.header("X-Concurrency-Scope", scope);
      return c.json(
        {
          errors: [
            {
              code: "SERVICE_BUSY",
              message:
                scope === "global"
                  ? "Shared verification capacity is temporarily full. Retry with jittered backoff, contact OpenIAP before sustained high-volume traffic, or self-host for dedicated capacity."
                  : scope === "ip"
                    ? "This network source is using its current share of verification capacity. Retry with jittered backoff, contact OpenIAP before sustained high-volume traffic, or self-host for dedicated capacity."
                    : "This API key is using its current share of verification capacity. Retry with jittered backoff, contact OpenIAP before sustained high-volume traffic, or self-host for dedicated capacity.",
            },
          ],
        },
        503,
      );
    }

    state.active += 1;
    state.byKey.set(apiKeyHash, activeForKey + 1);
    state.byIp.set(ipHash, activeForIp + 1);

    const remainingAxes = [
      {
        scope: "key" as const,
        limit: maxInFlightPerKey,
        remaining: Math.max(0, maxInFlightPerKey - activeForKey - 1),
      },
      {
        scope: "ip" as const,
        limit: maxInFlightPerIp,
        remaining: Math.max(0, maxInFlightPerIp - activeForIp - 1),
      },
      {
        scope: "global" as const,
        limit: maxInFlight,
        remaining: Math.max(0, maxInFlight - state.active),
      },
    ];
    const tightestAxis = remainingAxes.reduce((tightest, axis) =>
      axis.remaining < tightest.remaining ? axis : tightest,
    );
    c.header("X-Concurrency-Limit", String(tightestAxis.limit));
    c.header("X-Concurrency-Remaining", String(tightestAxis.remaining));
    c.header("X-Concurrency-Scope", tightestAxis.scope);

    try {
      await next();
    } finally {
      // Downstream store/network failures must never leak capacity. Deleting
      // idle entries keeps both maps bounded by the global in-flight maximum.
      const remainingForKey = (state.byKey.get(apiKeyHash) ?? 1) - 1;
      if (remainingForKey <= 0) {
        state.byKey.delete(apiKeyHash);
      } else {
        state.byKey.set(apiKeyHash, remainingForKey);
      }
      const remainingForIp = (state.byIp.get(ipHash) ?? 1) - 1;
      if (remainingForIp <= 0) {
        state.byIp.delete(ipHash);
      } else {
        state.byIp.set(ipHash, remainingForIp);
      }
      state.active = Math.max(0, state.active - 1);
    }
  });
}
