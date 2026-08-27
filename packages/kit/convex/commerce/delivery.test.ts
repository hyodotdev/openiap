import { afterEach, describe, expect, it, vi } from "vitest";

import {
  deliverPendingEventsHandler,
  resolvePublicAddresses,
  type DeliveryRequest,
} from "./delivery";
import {
  DELIVERY_ID_HEADER,
  EVENT_ID_HEADER,
  SIGNATURE_HEADER,
  TIMESTAMP_HEADER,
} from "./signing";

const claimed = {
  deliveryId: "outboundDeliveries_1",
  leaseToken: "lease-1",
  attempts: 0,
  url: "https://hooks.example.com/iapkit?source=test",
  secret: "whsec_test",
  body: JSON.stringify({ eventType: "subscription.renewed" }),
  eventId: "commerceEvents_1",
} as const;

afterEach(() => {
  vi.useRealTimers();
});

describe("deliverPendingEventsHandler", () => {
  it("posts signed headers and records the response before claiming again", async () => {
    vi.setSystemTime(new Date("2026-08-27T00:00:00.000Z"));
    let claimCount = 0;
    const recorded: Array<Record<string, unknown>> = [];
    const runMutation = vi.fn(async (_reference, args) => {
      if ("maxClaims" in args) {
        claimCount += 1;
        return claimCount === 1 ? [claimed] : [];
      }
      recorded.push(args);
      return null;
    });
    const requests: DeliveryRequest[] = [];

    await expect(
      deliverPendingEventsHandler({ runMutation } as never, async (request) => {
        requests.push(request);
        return 204;
      }),
    ).resolves.toEqual({ attempted: 1, delivered: 1 });

    expect(requests).toHaveLength(1);
    expect(requests[0].url.toString()).toBe(claimed.url);
    expect(requests[0].body).toBe(claimed.body);
    expect(requests[0].headers[EVENT_ID_HEADER]).toBe(claimed.eventId);
    expect(requests[0].headers[DELIVERY_ID_HEADER]).toBe(claimed.deliveryId);
    expect(requests[0].headers[TIMESTAMP_HEADER]).toBe("1787788800");
    expect(requests[0].headers[SIGNATURE_HEADER]).toMatch(/^v1=[0-9a-f]{64}$/);
    expect(recorded).toEqual([
      expect.objectContaining({
        deliveryId: claimed.deliveryId,
        leaseToken: claimed.leaseToken,
        ok: true,
        statusCode: 204,
        retryable: false,
      }),
    ]);
  });

  it("records redirects as permanent failures without following them", async () => {
    let claimCount = 0;
    const recorded: Array<Record<string, unknown>> = [];
    const runMutation = vi.fn(async (_reference, args) => {
      if ("maxClaims" in args) {
        claimCount += 1;
        return claimCount === 1 ? [claimed] : [];
      }
      recorded.push(args);
      return null;
    });
    const post = vi.fn(async () => 302);

    await expect(
      deliverPendingEventsHandler({ runMutation } as never, post),
    ).resolves.toEqual({ attempted: 1, delivered: 0 });
    expect(post).toHaveBeenCalledTimes(1);
    expect(recorded[0]).toMatchObject({
      ok: false,
      statusCode: 302,
      retryable: false,
    });
  });

  it("rejects an unsafe stored URL before issuing a request", async () => {
    let claimCount = 0;
    const recorded: Array<Record<string, unknown>> = [];
    const unsafeClaim = { ...claimed, url: "https://127.0.0.1/hook" };
    const runMutation = vi.fn(async (_reference, args) => {
      if ("maxClaims" in args) {
        claimCount += 1;
        return claimCount === 1 ? [unsafeClaim] : [];
      }
      recorded.push(args);
      return null;
    });
    const post = vi.fn(async () => 204);

    await expect(
      deliverPendingEventsHandler({ runMutation } as never, post),
    ).resolves.toEqual({ attempted: 1, delivered: 0 });
    expect(post).not.toHaveBeenCalled();
    expect(recorded[0]).toMatchObject({
      deliveryId: claimed.deliveryId,
      leaseToken: claimed.leaseToken,
      ok: false,
      error: "destination rejected: host-not-public",
      retryable: false,
    });
  });

  it("records transport failures as retryable", async () => {
    let claimCount = 0;
    const recorded: Array<Record<string, unknown>> = [];
    const runMutation = vi.fn(async (_reference, args) => {
      if ("maxClaims" in args) {
        claimCount += 1;
        return claimCount === 1 ? [claimed] : [];
      }
      recorded.push(args);
      return null;
    });

    await expect(
      deliverPendingEventsHandler({ runMutation } as never, async () => {
        throw new Error("connection reset");
      }),
    ).resolves.toEqual({ attempted: 1, delivered: 0 });
    expect(recorded[0]).toMatchObject({
      deliveryId: claimed.deliveryId,
      leaseToken: claimed.leaseToken,
      ok: false,
      error: "connection reset",
      retryable: true,
    });
  });
});

describe("resolvePublicAddresses", () => {
  it("rejects private, shared and link-local DNS answers", async () => {
    for (const address of [
      "127.0.0.1",
      "100.64.0.1",
      "169.254.169.254",
      "::1",
    ]) {
      await expect(
        resolvePublicAddresses("hooks.example.com", async () => [
          { address, family: address.includes(":") ? 6 : 4 },
        ]),
      ).rejects.toThrow(/non-public/);
    }
  });

  it("rejects a mixed public/private DNS response", async () => {
    await expect(
      resolvePublicAddresses("hooks.example.com", async () => [
        { address: "93.184.216.34", family: 4 },
        { address: "10.0.0.5", family: 4 },
      ]),
    ).rejects.toThrow(/non-public/);
  });

  it("accepts only-public answers for a pinned connection", async () => {
    await expect(
      resolvePublicAddresses("hooks.example.com", async () => [
        { address: "93.184.216.34", family: 4 },
        { address: "2606:4700:4700::1111", family: 6 },
      ]),
    ).resolves.toHaveLength(2);
  });
});
