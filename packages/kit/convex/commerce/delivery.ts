"use node";

// HTTP half of outbound delivery.
//
// Direction is strictly store → IAPKit → developer backend. This is
// server-to-server only: destinations are HTTPS endpoints a project owner
// registered, nothing here is reachable from a shipped app, and no
// client-pullable stream exists.

import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import type { ClaimedDelivery } from "./deliveryState";
import {
  DELIVERY_ID_HEADER,
  EVENT_ID_HEADER,
  REQUEST_TIMEOUT_MS,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
  checkDestinationUrl,
  isRetryableStatus,
  signPayloadWithRotation,
} from "./signing";

export const deliverPendingEvents = internalAction({
  args: {},
  returns: v.object({ attempted: v.number(), delivered: v.number() }),
  handler: async (ctx) => {
    const claimed: ClaimedDelivery[] = await ctx.runMutation(
      internal.commerce.deliveryState.claimPendingDeliveries,
      {},
    );
    let delivered = 0;

    for (const item of claimed) {
      const check = checkDestinationUrl(item.url);
      if (!check.ok) {
        // Never retry an unsafe target: the URL cannot become safe on its own
        // and retrying would keep probing an internal address.
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

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(check.url.toString(), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            [SIGNATURE_HEADER]: signature,
            [TIMESTAMP_HEADER]: String(timestamp),
            [EVENT_ID_HEADER]: item.eventId,
            [DELIVERY_ID_HEADER]: item.deliveryId,
          },
          body: item.body,
          redirect: "manual",
          signal: controller.signal,
        });
        const ok = response.status >= 200 && response.status < 300;
        if (ok) delivered += 1;
        await ctx.runMutation(
          internal.commerce.deliveryState.recordDeliveryResult,
          {
            deliveryId: item.deliveryId,
            leaseToken: item.leaseToken,
            ok,
            statusCode: response.status,
            retryable: isRetryableStatus(response.status),
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
      } finally {
        clearTimeout(timer);
      }
    }

    return { attempted: claimed.length, delivered };
  },
});
