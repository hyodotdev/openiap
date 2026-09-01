"use node";

// HTTP half of outbound delivery.
//
// Direction is strictly store → IAPKit → developer backend. This is
// server-to-server only: destinations are HTTPS endpoints a project owner
// registered, nothing here is reachable from a shipped app, and no
// client-pullable stream exists.

import { v } from "convex/values";
import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest, type RequestOptions } from "node:https";
import { isIP, type LookupFunction } from "node:net";

import { internal } from "../_generated/api";
import { internalAction, type ActionCtx } from "../_generated/server";
import type { ClaimedDelivery } from "./deliveryState";
import {
  CONTENT_TYPE,
  DELIVERY_ID_HEADER,
  EVENT_ID_HEADER,
  REQUEST_TIMEOUT_MS,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  checkDestinationUrl,
  CLAIM_BATCH_LIMIT,
  isRetryableStatus,
  isPublicIpAddress,
  signPayloadWithRotation,
} from "./signing";

export type ResolvedAddress = { address: string; family: number };
export const MAX_FALLBACK_ADDRESSES = 4;
type Resolver = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<ResolvedAddress[]>;

export async function resolvePublicAddresses(
  rawHostname: string,
  resolver: Resolver = dnsLookup,
): Promise<ResolvedAddress[]> {
  const hostname = rawHostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  const family = isIP(hostname);
  const addresses = family
    ? [{ address: hostname, family }]
    : await resolver(hostname, { all: true, verbatim: true });
  if (
    addresses.length === 0 ||
    addresses.some((entry) => !isPublicIpAddress(entry.address))
  ) {
    throw new Error("destination resolved to a non-public address");
  }
  return [
    ...new Map(
      addresses.map((entry) => [`${entry.family}:${entry.address}`, entry]),
    ).values(),
  ].slice(0, MAX_FALLBACK_ADDRESSES);
}

export type DeliveryRequest = {
  url: URL;
  headers: Record<string, string>;
  body: string;
};

type AddressPoster = (
  request: DeliveryRequest,
  selected: ResolvedAddress,
  timeoutMs: number,
) => Promise<number>;

async function withinTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error("request timed out")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function postJsonToAddress(
  request: DeliveryRequest,
  selected: ResolvedAddress,
  timeoutMs: number,
): Promise<number> {
  return await new Promise<number>((resolve, reject) => {
    const outgoing = httpsRequest(
      buildPinnedRequestOptions(request, selected),
      (response) => {
        clearTimeout(timer);
        const status = response.statusCode ?? 0;
        response.destroy();
        resolve(status);
      },
    );
    const timer = setTimeout(() => {
      outgoing.destroy(new Error("request timed out"));
    }, timeoutMs);
    outgoing.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    outgoing.end(request.body);
  });
}

export function buildPinnedRequestOptions(
  request: DeliveryRequest,
  selected: ResolvedAddress,
): RequestOptions {
  const hostname = request.url.hostname
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  const pinnedLookup: LookupFunction = (_hostname, _options, callback) => {
    if (_options.all) {
      callback(null, [selected]);
    } else {
      callback(null, selected.address, selected.family);
    }
  };

  return {
    protocol: "https:",
    hostname,
    port: request.url.port || undefined,
    path: `${request.url.pathname}${request.url.search}`,
    method: "POST",
    headers: request.headers,
    lookup: pinnedLookup,
    ...(isIP(hostname) === 0 ? { servername: hostname } : {}),
  };
}

export async function postJsonPinned(
  request: DeliveryRequest,
  resolver: Resolver = dnsLookup,
  postToAddress: AddressPoster = postJsonToAddress,
): Promise<number> {
  const startedAt = Date.now();
  const hostname = request.url.hostname
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  const addresses = await withinTimeout(
    resolvePublicAddresses(hostname, resolver),
    REQUEST_TIMEOUT_MS,
  );
  let lastError: unknown;
  for (let index = 0; index < addresses.length; index += 1) {
    const remaining = REQUEST_TIMEOUT_MS - (Date.now() - startedAt);
    if (remaining <= 0) break;
    const addressesLeft = addresses.length - index;
    const attemptBudget =
      addressesLeft === 1
        ? remaining
        : Math.max(1, Math.min(3_000, Math.floor(remaining / addressesLeft)));
    try {
      return await postToAddress(request, addresses[index], attemptBudget);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("all destination addresses failed");
}

export async function deliverPendingEventsHandler(
  ctx: Pick<ActionCtx, "runMutation">,
  post: (request: DeliveryRequest) => Promise<number> = postJsonPinned,
): Promise<{ attempted: number; delivered: number }> {
  let attempted = 0;
  let delivered = 0;

  for (let index = 0; index < CLAIM_BATCH_LIMIT; index += 1) {
    const claimed: ClaimedDelivery[] = await ctx.runMutation(
      internal.commerce.deliveryState.claimPendingDeliveries,
      {},
    );
    const [item] = claimed;
    if (!item) break;
    attempted += 1;

    const check = checkDestinationUrl(item.url);
    if (!check.ok) {
      await ctx.runMutation(
        internal.commerce.deliveryState.recordDeliveryResult,
        {
          deliveryId: item.deliveryId,
          leaseToken: item.leaseToken,
          ok: false,
          error: `destination rejected: ${check.reason}`,
          retryable: false,
        },
      );
      continue;
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await signPayloadWithRotation(
      {
        current: item.secret,
        ...(item.previousSecret ? { previous: item.previousSecret } : {}),
      },
      timestamp,
      item.body,
    );

    try {
      const status = await post({
        url: check.url,
        headers: {
          "content-type": CONTENT_TYPE,
          [SIGNATURE_HEADER]: signature,
          [TIMESTAMP_HEADER]: String(timestamp),
          [EVENT_ID_HEADER]: item.eventId,
          [DELIVERY_ID_HEADER]: item.deliveryId,
        },
        body: item.body,
      });
      const ok = status >= 200 && status < 300;
      if (ok) delivered += 1;
      await ctx.runMutation(
        internal.commerce.deliveryState.recordDeliveryResult,
        {
          deliveryId: item.deliveryId,
          leaseToken: item.leaseToken,
          ok,
          statusCode: status,
          retryable: isRetryableStatus(status),
        },
      );
    } catch (error) {
      await ctx.runMutation(
        internal.commerce.deliveryState.recordDeliveryResult,
        {
          deliveryId: item.deliveryId,
          leaseToken: item.leaseToken,
          ok: false,
          error: error instanceof Error ? error.message : "request failed",
          retryable: true,
        },
      );
    }
  }

  return { attempted, delivered };
}

export const deliverPendingEvents = internalAction({
  args: {},
  returns: v.object({ attempted: v.number(), delivered: v.number() }),
  handler: async (ctx) => deliverPendingEventsHandler(ctx),
});
