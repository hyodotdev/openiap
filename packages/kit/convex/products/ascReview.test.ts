import { describe, expect, it, vi } from "vitest";

import {
  ascReviewLocalizationMatches,
  classifyAscManualReviewAction,
  ensureAscReviewVersion,
  getAscReviewEligibilityActions,
  isAscApprovedReviewHistoryState,
  md5Hex,
  partitionAscReviewSubmissionItems,
  planAscReviewVersion,
  submitAscReviewVersions,
  uploadAscReviewScreenshot,
  upsertAscReviewLocalization,
  type AscJsonRequest,
} from "./ascReview";

class MockAscError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

describe("uploadAscReviewScreenshot", () => {
  it("honors every IAP upload operation without forwarding ASC auth", async () => {
    const bytes = Uint8Array.from([1, 2, 3, 4, 5]);
    const requests: Array<{
      path: string;
      init?: RequestInit & { body?: string };
    }> = [];
    let poll = 0;
    const request: AscJsonRequest = async <T>(
      path: string,
      init?: RequestInit & { body?: string },
    ) => {
      requests.push({ path, init });
      if (path.endsWith("/appStoreReviewScreenshot")) {
        throw new MockAscError(404, "not found");
      }
      if (path === "/v1/inAppPurchaseAppStoreReviewScreenshots") {
        return {
          data: {
            id: "shot-1",
            type: "inAppPurchaseAppStoreReviewScreenshots",
            attributes: {
              // Returned out of order to verify offset ordering/coverage.
              uploadOperations: [
                {
                  method: "PUT",
                  url: "https://upload.example/part-2",
                  offset: 2,
                  length: 3,
                  requestHeaders: [{ name: "x-apple-part", value: "second" }],
                },
                {
                  method: "POST",
                  url: "https://upload.example/part-1",
                  offset: 0,
                  length: 2,
                  requestHeaders: [
                    { name: "content-type", value: "image/png" },
                  ],
                },
              ],
            },
          },
        } as T;
      }
      if (init?.method === "PATCH") return { data: { id: "shot-1" } } as T;
      poll += 1;
      return {
        data: {
          id: "shot-1",
          type: "inAppPurchaseAppStoreReviewScreenshots",
          attributes: {
            assetDeliveryState: {
              state: poll === 1 ? "PROCESSING" : "COMPLETE",
            },
          },
        },
      } as T;
    };
    const uploads: Array<{
      url: string;
      init?: RequestInit;
      body: number[];
    }> = [];
    const fetchImpl = vi.fn(async (url: string | URL, init?: RequestInit) => {
      uploads.push({
        url: String(url),
        init,
        body: Array.from(
          new Uint8Array(await new Response(init?.body).arrayBuffer()),
        ),
      });
      return new Response("", { status: 200 });
    }) as unknown as typeof fetch;
    const sleep = vi.fn(async () => undefined);

    await expect(
      uploadAscReviewScreenshot({
        request,
        kind: "iap",
        parentId: "iap/unsafe",
        screenshot: { fileName: "review.png", fileType: "image/png", bytes },
        fetchImpl,
        sleep,
      }),
    ).resolves.toEqual({
      screenshotId: "shot-1",
      checksum: md5Hex(bytes),
      reused: false,
    });

    expect(requests[0]?.path).toBe(
      "/v2/inAppPurchases/iap%2Funsafe/appStoreReviewScreenshot",
    );
    const reserve = JSON.parse(String(requests[1]?.init?.body));
    expect(reserve.data.relationships.inAppPurchaseV2.data).toEqual({
      type: "inAppPurchases",
      id: "iap/unsafe",
    });
    expect(uploads).toEqual([
      {
        url: "https://upload.example/part-1",
        init: expect.objectContaining({
          method: "POST",
          headers: { "content-type": "image/png" },
        }),
        body: [1, 2],
      },
      {
        url: "https://upload.example/part-2",
        init: expect.objectContaining({
          method: "PUT",
          headers: { "x-apple-part": "second" },
        }),
        body: [3, 4, 5],
      },
    ]);
    for (const upload of uploads) {
      expect(upload.init?.headers).not.toHaveProperty("authorization");
    }
    const commit = JSON.parse(
      String(
        requests.find((entry) => entry.init?.method === "PATCH")?.init?.body,
      ),
    );
    expect(commit.data.attributes).toEqual({
      uploaded: true,
      sourceFileChecksum: md5Hex(bytes),
    });
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it("uses subscription-specific parent relationship and endpoints", async () => {
    const calls: string[] = [];
    const request: AscJsonRequest = async <T>(
      path: string,
      init?: RequestInit & { body?: string },
    ) => {
      calls.push(path);
      if (path.endsWith("/appStoreReviewScreenshot")) {
        throw new MockAscError(404, "missing");
      }
      if (path === "/v1/subscriptionAppStoreReviewScreenshots") {
        const body = JSON.parse(String(init?.body));
        expect(body.data.relationships.subscription.data).toEqual({
          type: "subscriptions",
          id: "sub-1",
        });
        return {
          data: {
            id: "sub-shot",
            type: "subscriptionAppStoreReviewScreenshots",
            attributes: {
              uploadOperations: [
                {
                  method: "PUT",
                  url: "https://upload.example/sub",
                  offset: 0,
                  length: 4,
                },
              ],
            },
          },
        } as T;
      }
      if (init?.method === "PATCH") return { data: { id: "sub-shot" } } as T;
      return {
        data: {
          id: "sub-shot",
          type: "subscriptionAppStoreReviewScreenshots",
          attributes: { assetDeliveryState: { state: "COMPLETE" } },
        },
      } as T;
    };

    await uploadAscReviewScreenshot({
      request,
      kind: "subscription",
      parentId: "sub-1",
      screenshot: {
        fileName: "review.jpg",
        fileType: "image/jpeg",
        bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]),
      },
      fetchImpl: vi.fn(
        async () => new Response("", { status: 200 }),
      ) as unknown as typeof fetch,
    });

    expect(calls[0]).toBe("/v1/subscriptions/sub-1/appStoreReviewScreenshot");
    expect(calls).toContain(
      "/v1/subscriptionAppStoreReviewScreenshots/sub-shot",
    );
  });

  it("rejects gapped upload operations before sending bytes", async () => {
    const fetchImpl = vi.fn();
    const request: AscJsonRequest = async <T>(path: string) => {
      if (path.endsWith("/appStoreReviewScreenshot")) {
        throw new MockAscError(404, "missing");
      }
      return {
        data: {
          id: "bad-shot",
          type: "inAppPurchaseAppStoreReviewScreenshots",
          attributes: {
            uploadOperations: [
              {
                method: "PUT",
                url: "https://upload.example/bad",
                offset: 1,
                length: 3,
              },
            ],
          },
        },
      } as T;
    };
    await expect(
      uploadAscReviewScreenshot({
        request,
        kind: "iap",
        parentId: "iap-1",
        screenshot: {
          fileName: "review.jpg",
          fileType: "image/jpeg",
          bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]),
        },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/invalid upload operation ranges/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reuses a complete screenshot with the same whole-file checksum", async () => {
    const bytes = Uint8Array.from([1, 2, 3]);
    const request = vi.fn(async () => ({
      data: {
        id: "existing-shot",
        type: "inAppPurchaseAppStoreReviewScreenshots",
        attributes: {
          sourceFileChecksum: md5Hex(bytes),
          assetDeliveryState: { state: "COMPLETE" },
        },
      },
    })) as unknown as AscJsonRequest;
    const fetchImpl = vi.fn();

    await expect(
      uploadAscReviewScreenshot({
        request,
        kind: "iap",
        parentId: "iap-1",
        screenshot: {
          fileName: "review.png",
          fileType: "image/png",
          bytes,
        },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toEqual({
      screenshotId: "existing-shot",
      checksum: md5Hex(bytes),
      reused: true,
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("resumes a same-checksum processing screenshot without replacing it", async () => {
    const bytes = Uint8Array.from([1, 2, 3]);
    const calls: Array<{ path: string; method?: string }> = [];
    let reads = 0;
    const request: AscJsonRequest = async <T>(
      path: string,
      init?: RequestInit & { body?: string },
    ) => {
      calls.push({ path, method: init?.method });
      reads += 1;
      return {
        data: {
          id: "processing-shot",
          type: "inAppPurchaseAppStoreReviewScreenshots",
          attributes: {
            sourceFileChecksum: md5Hex(bytes),
            assetDeliveryState: {
              state: reads < 3 ? "PROCESSING" : "COMPLETE",
            },
          },
        },
      } as T;
    };
    const fetchImpl = vi.fn();

    await expect(
      uploadAscReviewScreenshot({
        request,
        kind: "iap",
        parentId: "iap-1",
        screenshot: {
          fileName: "review.png",
          fileType: "image/png",
          bytes,
        },
        fetchImpl: fetchImpl as unknown as typeof fetch,
        sleep: async () => undefined,
      }),
    ).resolves.toEqual({
      screenshotId: "processing-shot",
      checksum: md5Hex(bytes),
      reused: true,
    });
    expect(calls.every((call) => call.method === undefined)).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("preserves a checksum-committed screenshot when bounded polling expires", async () => {
    const bytes = Uint8Array.from([1, 2, 3]);
    const calls: Array<{ path: string; method?: string }> = [];
    const request: AscJsonRequest = async <T>(
      path: string,
      init?: RequestInit & { body?: string },
    ) => {
      calls.push({ path, method: init?.method });
      if (path.endsWith("/appStoreReviewScreenshot")) {
        throw new MockAscError(404, "missing");
      }
      if (
        path === "/v1/inAppPurchaseAppStoreReviewScreenshots" &&
        init?.method === "POST"
      ) {
        return {
          data: {
            id: "slow-shot",
            type: "inAppPurchaseAppStoreReviewScreenshots",
            attributes: {
              uploadOperations: [
                {
                  method: "PUT",
                  url: "https://upload.example/slow",
                  offset: 0,
                  length: bytes.byteLength,
                },
              ],
            },
          },
        } as T;
      }
      if (init?.method === "PATCH") return { data: {} } as T;
      return {
        data: {
          id: "slow-shot",
          type: "inAppPurchaseAppStoreReviewScreenshots",
          attributes: { assetDeliveryState: { state: "PROCESSING" } },
        },
      } as T;
    };

    await expect(
      uploadAscReviewScreenshot({
        request,
        kind: "iap",
        parentId: "iap-1",
        screenshot: {
          fileName: "review.png",
          fileType: "image/png",
          bytes,
        },
        fetchImpl: vi.fn(
          async () => new Response("", { status: 200 }),
        ) as unknown as typeof fetch,
        sleep: async () => undefined,
        maxPollAttempts: 2,
      }),
    ).rejects.toThrow(/still processing after 2 polls/);
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);
  });

  it("preserves a committed screenshot when cancellation interrupts polling", async () => {
    const bytes = Uint8Array.from([1, 2, 3]);
    const calls: Array<{ path: string; method?: string }> = [];
    const request: AscJsonRequest = async <T>(
      path: string,
      init?: RequestInit & { body?: string },
    ) => {
      calls.push({ path, method: init?.method });
      if (path.endsWith("/appStoreReviewScreenshot")) {
        throw new MockAscError(404, "missing");
      }
      if (
        path === "/v1/inAppPurchaseAppStoreReviewScreenshots" &&
        init?.method === "POST"
      ) {
        return {
          data: {
            id: "cancel-after-commit",
            type: "inAppPurchaseAppStoreReviewScreenshots",
            attributes: {
              uploadOperations: [
                {
                  method: "PUT",
                  url: "https://upload.example/cancel-after-commit",
                  offset: 0,
                  length: bytes.byteLength,
                },
              ],
            },
          },
        } as T;
      }
      if (init?.method === "PATCH") return { data: {} } as T;
      return { data: {} } as T;
    };
    let checks = 0;
    const checkCancelled = async () => {
      checks += 1;
      if (checks === 5) throw new Error("cancel after checksum commit");
    };

    await expect(
      uploadAscReviewScreenshot({
        request,
        kind: "iap",
        parentId: "iap-1",
        screenshot: {
          fileName: "review.png",
          fileType: "image/png",
          bytes,
        },
        fetchImpl: vi.fn(
          async () => new Response("", { status: 200 }),
        ) as unknown as typeof fetch,
        checkCancelled,
      }),
    ).rejects.toThrow("cancel after checksum commit");
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);
  });

  it("reserves a screenshot when the parent relationship returns null data", async () => {
    const bytes = Uint8Array.from([1, 2, 3]);
    const request: AscJsonRequest = async <T>(
      path: string,
      init?: RequestInit & { body?: string },
    ) => {
      if (path.endsWith("/appStoreReviewScreenshot")) {
        return { data: null } as T;
      }
      if (
        path === "/v1/inAppPurchaseAppStoreReviewScreenshots" &&
        init?.method === "POST"
      ) {
        return {
          data: {
            id: "new-shot",
            type: "inAppPurchaseAppStoreReviewScreenshots",
            attributes: {
              uploadOperations: [
                {
                  method: "PUT",
                  url: "https://upload.example/new",
                  offset: 0,
                  length: bytes.byteLength,
                },
              ],
            },
          },
        } as T;
      }
      if (init?.method === "PATCH") return { data: { id: "new-shot" } } as T;
      return {
        data: {
          id: "new-shot",
          type: "inAppPurchaseAppStoreReviewScreenshots",
          attributes: { assetDeliveryState: { state: "COMPLETE" } },
        },
      } as T;
    };

    await expect(
      uploadAscReviewScreenshot({
        request,
        kind: "iap",
        parentId: "iap-1",
        screenshot: {
          fileName: "review.png",
          fileType: "image/png",
          bytes,
        },
        fetchImpl: vi.fn(
          async () => new Response("", { status: 200 }),
        ) as unknown as typeof fetch,
      }),
    ).resolves.toMatchObject({ screenshotId: "new-shot", reused: false });
  });

  it("times out a stalled upload operation and deletes the reservation", async () => {
    const calls: Array<{ path: string; method?: string }> = [];
    const request: AscJsonRequest = async <T>(
      path: string,
      init?: RequestInit & { body?: string },
    ) => {
      calls.push({ path, method: init?.method });
      if (path.endsWith("/appStoreReviewScreenshot")) {
        throw new MockAscError(404, "missing");
      }
      return {
        data: {
          id: "timed-out-shot",
          type: "inAppPurchaseAppStoreReviewScreenshots",
          attributes: {
            uploadOperations: [
              {
                method: "PUT",
                url: "https://upload.example/stalled",
                offset: 0,
                length: 3,
              },
            ],
          },
        },
      } as T;
    };
    const fetchImpl = vi.fn(
      async (_url: string | URL, init?: RequestInit) =>
        await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            { once: true },
          );
        }),
    ) as unknown as typeof fetch;

    await expect(
      uploadAscReviewScreenshot({
        request,
        kind: "iap",
        parentId: "iap-1",
        screenshot: {
          fileName: "review.png",
          fileType: "image/png",
          bytes: Uint8Array.from([1, 2, 3]),
        },
        fetchImpl,
        uploadTimeoutMs: 1,
      }),
    ).rejects.toThrow(/timed out after 1ms/);
    expect(calls.at(-1)).toEqual({
      path: "/v1/inAppPurchaseAppStoreReviewScreenshots/timed-out-shot",
      method: "DELETE",
    });
  });

  it("deletes the reservation when asset delivery fails", async () => {
    const calls: Array<{ path: string; method?: string }> = [];
    const request: AscJsonRequest = async <T>(
      path: string,
      init?: RequestInit & { body?: string },
    ) => {
      calls.push({ path, method: init?.method });
      if (path.endsWith("/appStoreReviewScreenshot")) {
        throw new MockAscError(404, "missing");
      }
      if (path === "/v1/inAppPurchaseAppStoreReviewScreenshots") {
        return {
          data: {
            id: "failed-shot",
            type: "inAppPurchaseAppStoreReviewScreenshots",
            attributes: {
              uploadOperations: [
                {
                  method: "PUT",
                  url: "https://upload.example/fail",
                  offset: 0,
                  length: 4,
                },
              ],
            },
          },
        } as T;
      }
      if (init?.method === "PATCH") return { data: {} } as T;
      return {
        data: {
          id: "failed-shot",
          type: "inAppPurchaseAppStoreReviewScreenshots",
          attributes: {
            assetDeliveryState: {
              state: "FAILED",
              errors: [{ description: "Invalid image" }],
            },
          },
        },
      } as T;
    };

    await expect(
      uploadAscReviewScreenshot({
        request,
        kind: "iap",
        parentId: "iap-1",
        screenshot: {
          fileName: "review.jpg",
          fileType: "image/jpeg",
          bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]),
        },
        fetchImpl: vi.fn(
          async () => new Response("", { status: 200 }),
        ) as unknown as typeof fetch,
      }),
    ).rejects.toThrow(/delivery failed: Invalid image/);
    expect(calls.at(-1)).toEqual({
      path: "/v1/inAppPurchaseAppStoreReviewScreenshots/failed-shot",
      method: "DELETE",
    });
  });

  it("deletes the reservation when cancellation interrupts multipart upload", async () => {
    const calls: Array<{ path: string; method?: string }> = [];
    const request: AscJsonRequest = async <T>(
      path: string,
      init?: RequestInit & { body?: string },
    ) => {
      calls.push({ path, method: init?.method });
      if (path.endsWith("/appStoreReviewScreenshot")) {
        throw new MockAscError(404, "missing");
      }
      return {
        data: {
          id: "cancelled-shot",
          type: "inAppPurchaseAppStoreReviewScreenshots",
          attributes: {
            uploadOperations: [
              {
                method: "PUT",
                url: "https://upload.example/cancel",
                offset: 0,
                length: 4,
              },
            ],
          },
        },
      } as T;
    };
    let checks = 0;
    const checkCancelled = async () => {
      checks += 1;
      if (checks === 3) throw new Error("cancelled");
    };

    await expect(
      uploadAscReviewScreenshot({
        request,
        kind: "iap",
        parentId: "iap-1",
        screenshot: {
          fileName: "review.jpg",
          fileType: "image/jpeg",
          bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]),
        },
        checkCancelled,
        fetchImpl: vi.fn() as unknown as typeof fetch,
      }),
    ).rejects.toThrow("cancelled");
    expect(calls.at(-1)).toEqual({
      path: "/v1/inAppPurchaseAppStoreReviewScreenshots/cancelled-shot",
      method: "DELETE",
    });
  });
});

describe("ASC version and submission workflow", () => {
  it("rejects an oversized submission before creating a remote draft", async () => {
    const request = vi.fn() as unknown as AscJsonRequest;
    const items = Array.from({ length: 201 }, (_, index) => ({
      productId: `product-${index}`,
      storeRef: `iap-${index}`,
      kind: "iap" as const,
      productType: "Consumable" as const,
      versionId: `version-${index}`,
    }));

    await expect(
      submitAscReviewVersions({ request, appId: "app-1", items }),
    ).resolves.toEqual({
      outcomes: [],
      globalFailure: expect.stringMatching(/at most 200 items/),
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("preclassifies first product types and new subscription groups", () => {
    const emptySnapshot = {
      approvedProductTypes: new Set<
        | "Subscription"
        | "NonRenewingSubscription"
        | "NonConsumable"
        | "Consumable"
      >(),
      approvedSubscriptionGroupIds: new Set<string>(),
    };
    const subscription = {
      productId: "premium-monthly",
      storeRef: "sub-1",
      kind: "subscription" as const,
      productType: "Subscription" as const,
      versionId: "sub-version",
      subscriptionGroupId: "group-new",
    };

    expect(
      getAscReviewEligibilityActions({
        item: subscription,
        snapshot: emptySnapshot,
      }).map((action) => action.code),
    ).toEqual(["app_version_required", "subscription_group_required"]);

    const approvedTypeOnly = {
      ...emptySnapshot,
      approvedProductTypes: new Set(["Subscription" as const]),
    };
    expect(
      getAscReviewEligibilityActions({
        item: subscription,
        snapshot: approvedTypeOnly,
      }).map((action) => action.code),
    ).toEqual(["subscription_group_required"]);

    expect(
      getAscReviewEligibilityActions({
        item: subscription,
        snapshot: {
          approvedProductTypes: new Set(["Subscription" as const]),
          approvedSubscriptionGroupIds: new Set(["group-new"]),
        },
      }),
    ).toEqual([]);
  });

  it("keeps approval history distinct from pending review states", () => {
    for (const state of [
      "APPROVED",
      "READY_FOR_SALE",
      "ACCEPTED",
      "REPLACED_WITH_NEW_VERSION",
      "DEVELOPER_REMOVED_FROM_SALE",
    ]) {
      expect(isAscApprovedReviewHistoryState(state)).toBe(true);
    }
    for (const state of [
      "PREPARE_FOR_SUBMISSION",
      "READY_FOR_REVIEW",
      "WAITING_FOR_REVIEW",
      "IN_REVIEW",
    ]) {
      expect(isAscApprovedReviewHistoryState(state)).toBe(false);
    }
  });

  it("does not let one approved product type unlock another", () => {
    const item = {
      productId: "lifetime",
      storeRef: "iap-1",
      kind: "iap" as const,
      productType: "NonConsumable" as const,
      versionId: "iap-version",
    };
    expect(
      getAscReviewEligibilityActions({
        item,
        snapshot: {
          approvedProductTypes: new Set(["Consumable" as const]),
          approvedSubscriptionGroupIds: new Set(),
        },
      }).map((action) => action.code),
    ).toEqual(["app_version_required"]);
  });

  it("creates IAP versions and v2 localizations against the version", async () => {
    const calls: Array<{ path: string; body?: unknown }> = [];
    const request: AscJsonRequest = async <T>(
      path: string,
      init?: RequestInit & { body?: string },
    ) => {
      calls.push({
        path,
        body: init?.body ? JSON.parse(init.body) : undefined,
      });
      if (path.includes("/versions?")) return { data: [] } as T;
      if (path === "/v1/inAppPurchaseVersions") {
        return {
          data: { id: "iap-version", type: "inAppPurchaseVersions" },
        } as T;
      }
      if (path.includes("/localizations?")) return { data: [] } as T;
      return { data: { id: "loc-1" } } as T;
    };

    const version = await ensureAscReviewVersion({
      request,
      kind: "iap",
      parentId: "iap-1",
    });
    await upsertAscReviewLocalization({
      request,
      kind: "iap",
      versionId: version.versionId,
      name: "Coins",
      description: "100 coins",
    });

    expect(version).toEqual({
      versionId: "iap-version",
      alreadySubmitted: false,
      attachedToSubmission: false,
    });
    expect(calls[1]).toEqual({
      path: "/v1/inAppPurchaseVersions",
      body: {
        data: {
          type: "inAppPurchaseVersions",
          relationships: {
            inAppPurchase: {
              data: { type: "inAppPurchases", id: "iap-1" },
            },
          },
        },
      },
    });
    expect(calls[3]).toEqual({
      path: "/v2/inAppPurchaseLocalizations",
      body: {
        data: {
          type: "inAppPurchaseLocalizations",
          attributes: {
            name: "Coins",
            description: "100 coins",
            locale: "en-US",
          },
          relationships: {
            version: {
              data: { type: "inAppPurchaseVersions", id: "iap-version" },
            },
          },
        },
      },
    });
  });

  it("treats READY_FOR_REVIEW as attached and does not create a mutable version", async () => {
    const request = vi.fn(async () => ({
      data: [
        {
          id: "attached-version",
          type: "subscriptionVersions",
          attributes: { state: "READY_FOR_REVIEW" },
        },
      ],
    })) as unknown as AscJsonRequest;

    await expect(
      ensureAscReviewVersion({
        request,
        kind: "subscription",
        parentId: "sub-1",
      }),
    ).resolves.toEqual({
      versionId: "attached-version",
      alreadySubmitted: false,
      attachedToSubmission: true,
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("does not create a new version for a previously completed Ready row", async () => {
    const request = vi.fn(async () => ({
      data: [
        {
          id: "approved-version",
          type: "inAppPurchaseVersions",
          attributes: { state: "APPROVED" },
        },
      ],
    })) as unknown as AscJsonRequest;

    await expect(
      ensureAscReviewVersion({
        request,
        kind: "iap",
        parentId: "iap-1",
        allowCreate: false,
      }),
    ).resolves.toEqual({
      versionId: "approved-version",
      alreadySubmitted: true,
      attachedToSubmission: true,
    });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("creates the first review version when a legacy Ready row has none", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({
        data: { id: "new-version", type: "inAppPurchaseVersions" },
      }) as unknown as AscJsonRequest;

    await expect(
      ensureAscReviewVersion({
        request,
        kind: "iap",
        parentId: "iap-legacy-ready",
        allowCreate: true,
        reuseApproved: true,
      }),
    ).resolves.toEqual({
      versionId: "new-version",
      alreadySubmitted: false,
      attachedToSubmission: false,
    });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("plans dry-run version handling from the actual remote state", () => {
    expect(
      planAscReviewVersion({ localState: "Ready", current: null }),
    ).toMatchObject({ action: "create" });
    expect(
      planAscReviewVersion({
        localState: "Ready",
        current: { versionId: "approved", state: "approved" },
      }),
    ).toEqual({
      action: "reuse",
      reviewVersion: {
        versionId: "approved",
        alreadySubmitted: true,
        attachedToSubmission: true,
      },
    });
    expect(
      planAscReviewVersion({
        localState: "Draft",
        current: { versionId: "approved", state: "approved" },
      }),
    ).toMatchObject({ action: "create" });
    expect(
      planAscReviewVersion({
        localState: "Draft",
        current: { versionId: "attached", state: "attached" },
      }),
    ).toEqual({
      action: "reuse",
      reviewVersion: {
        versionId: "attached",
        alreadySubmitted: false,
        attachedToSubmission: true,
      },
    });
  });

  it("partitions an oversized submission deterministically at Apple's limit", () => {
    const items = Array.from({ length: 201 }, (_, index) => index);
    const partition = partitionAscReviewSubmissionItems(items);
    expect(partition.selected).toHaveLength(200);
    expect(partition.selected.at(-1)).toBe(199);
    expect(partition.deferred).toEqual([200]);
  });

  it("compares immutable attached-version metadata before treating a retry as success", async () => {
    const request = vi.fn(async () => ({
      data: [
        {
          id: "loc-1",
          type: "inAppPurchaseLocalizations",
          attributes: {
            locale: "en-US",
            name: "Coins",
            description: "100 coins",
          },
        },
      ],
    })) as unknown as AscJsonRequest;

    await expect(
      ascReviewLocalizationMatches({
        request,
        kind: "iap",
        versionId: "attached-version",
        name: "Coins",
        description: "100 coins",
      }),
    ).resolves.toBe(true);
    await expect(
      ascReviewLocalizationMatches({
        request,
        kind: "iap",
        versionId: "attached-version",
        name: "Coins Plus",
        description: "200 coins",
      }),
    ).resolves.toBe(false);
  });

  it("creates one review submission with IAP and subscription version items", async () => {
    const calls: Array<{ path: string; body?: any }> = [];
    const request: AscJsonRequest = async <T>(
      path: string,
      init?: RequestInit & { body?: string },
    ) => {
      calls.push({
        path,
        body: init?.body ? JSON.parse(init.body) : undefined,
      });
      if (path === "/v1/reviewSubmissions" && init?.method === "POST") {
        return {
          data: { id: "submission-1", type: "reviewSubmissions" },
        } as T;
      }
      return { data: { id: "created" } } as T;
    };

    const result = await submitAscReviewVersions({
      request,
      appId: "app-1",
      items: [
        {
          productId: "coins",
          storeRef: "iap-1",
          kind: "iap",
          productType: "Consumable",
          versionId: "iap-version",
        },
        {
          productId: "premium",
          storeRef: "sub-1",
          kind: "subscription",
          productType: "Subscription",
          versionId: "sub-version",
        },
      ],
    });

    expect(calls[0]?.body).toEqual({
      data: {
        type: "reviewSubmissions",
        attributes: { platform: "IOS" },
        relationships: { app: { data: { type: "apps", id: "app-1" } } },
      },
    });
    expect(calls[1]?.body.data.relationships.inAppPurchaseVersion.data).toEqual(
      { type: "inAppPurchaseVersions", id: "iap-version" },
    );
    expect(calls[2]?.body.data.relationships.subscriptionVersion.data).toEqual({
      type: "subscriptionVersions",
      id: "sub-version",
    });
    expect(calls[3]).toEqual({
      path: "/v1/reviewSubmissions/submission-1",
      body: {
        data: {
          type: "reviewSubmissions",
          id: "submission-1",
          attributes: { submitted: true },
        },
      },
    });
    expect(result.outcomes.map((outcome) => outcome.status)).toEqual([
      "submitted",
      "submitted",
    ]);
    expect(calls.map((call) => call.path).join(" ")).not.toMatch(
      /inAppPurchaseSubmissions|subscriptionSubmissions/,
    );
  });

  it("keeps review-item failures product-specific and submits added items", async () => {
    let itemCount = 0;
    const calls: Array<{ path: string; body?: any }> = [];
    const request: AscJsonRequest = async <T>(
      path: string,
      init?: RequestInit & { body?: string },
    ) => {
      calls.push({
        path,
        body: init?.body ? JSON.parse(init.body) : undefined,
      });
      if (path === "/v1/reviewSubmissions" && init?.method === "POST") {
        return {
          data: { id: "submission-1", type: "reviewSubmissions" },
        } as T;
      }
      if (path === "/v1/reviewSubmissionItems") {
        itemCount += 1;
        if (itemCount === 1) {
          throw new MockAscError(
            422,
            "The first consumable in-app purchase must be submitted with a new app version",
          );
        }
        return { data: { id: "item-2" } } as T;
      }
      return { data: { id: "updated" } } as T;
    };
    const first = {
      productId: "coins",
      storeRef: "iap-1",
      kind: "iap" as const,
      productType: "Consumable" as const,
      versionId: "iap-version",
    };
    const second = {
      productId: "premium",
      storeRef: "sub-1",
      kind: "subscription" as const,
      productType: "Subscription" as const,
      versionId: "sub-version",
    };

    const result = await submitAscReviewVersions({
      request,
      appId: "app-1",
      items: [first, second],
    });

    expect(result).toEqual({
      outcomes: [
        {
          item: first,
          status: "manual",
          action: expect.objectContaining({
            productId: "coins",
            code: "app_version_required",
          }),
        },
        { item: second, status: "submitted" },
      ],
    });
    expect(calls.at(-1)).toMatchObject({
      path: "/v1/reviewSubmissions/submission-1",
      body: {
        data: { attributes: { submitted: true } },
      },
    });
  });

  it("removes only the first-of-type item and retries unrelated items", async () => {
    let createdItems = 0;
    let submitAttempts = 0;
    const calls: Array<{ path: string; method?: string }> = [];
    const request: AscJsonRequest = async <T>(
      path: string,
      init?: RequestInit & { body?: string },
    ) => {
      calls.push({ path, method: init?.method });
      if (path === "/v1/reviewSubmissions" && init?.method === "POST") {
        return {
          data: { id: "submission-typed", type: "reviewSubmissions" },
        } as T;
      }
      if (path === "/v1/reviewSubmissionItems") {
        createdItems += 1;
        return { data: { id: `item-${createdItems}` } } as T;
      }
      if (
        path === "/v1/reviewSubmissions/submission-typed" &&
        init?.method === "PATCH"
      ) {
        submitAttempts += 1;
        if (submitAttempts === 1) {
          throw new MockAscError(
            422,
            "The first consumable in-app purchase must be submitted with a new app version",
          );
        }
      }
      return { data: {} } as T;
    };
    const consumable = {
      productId: "coins",
      storeRef: "iap-1",
      kind: "iap" as const,
      productType: "Consumable" as const,
      versionId: "iap-version",
    };
    const subscription = {
      productId: "premium",
      storeRef: "sub-1",
      kind: "subscription" as const,
      productType: "Subscription" as const,
      versionId: "sub-version",
    };

    const result = await submitAscReviewVersions({
      request,
      appId: "app-1",
      items: [consumable, subscription],
    });

    expect(result.outcomes).toEqual([
      {
        item: consumable,
        status: "manual",
        action: expect.objectContaining({ code: "app_version_required" }),
      },
      { item: subscription, status: "submitted" },
    ]);
    expect(calls).toContainEqual({
      path: "/v1/reviewSubmissionItems/item-1",
      method: "DELETE",
    });
    expect(submitAttempts).toBe(2);
  });

  it("cancels the whole draft when a gated item deletion is not confirmed", async () => {
    let createdItems = 0;
    const calls: Array<{ path: string; method?: string; body?: unknown }> = [];
    const request: AscJsonRequest = async <T>(
      path: string,
      init?: RequestInit & { body?: string },
    ) => {
      const body = init?.body ? JSON.parse(init.body) : undefined;
      calls.push({ path, method: init?.method, body });
      if (path === "/v1/reviewSubmissions" && init?.method === "POST") {
        return {
          data: { id: "submission-delete-failed", type: "reviewSubmissions" },
        } as T;
      }
      if (path === "/v1/reviewSubmissionItems") {
        createdItems += 1;
        return { data: { id: `item-${createdItems}` } } as T;
      }
      if (
        path.startsWith("/v1/reviewSubmissionItems/") &&
        init?.method === "DELETE"
      ) {
        throw new Error("delete response lost");
      }
      if (
        path === "/v1/reviewSubmissions/submission-delete-failed" &&
        init?.method === "PATCH" &&
        body?.data?.attributes?.submitted === true
      ) {
        throw new MockAscError(
          422,
          "The first consumable in-app purchase must be submitted with a new app version",
        );
      }
      return { data: {} } as T;
    };
    const items = [
      {
        productId: "coins",
        storeRef: "iap-1",
        kind: "iap" as const,
        productType: "Consumable" as const,
        versionId: "iap-version",
      },
      {
        productId: "premium",
        storeRef: "sub-1",
        kind: "subscription" as const,
        productType: "Subscription" as const,
        versionId: "sub-version",
      },
    ];

    const result = await submitAscReviewVersions({
      request,
      appId: "app-1",
      items,
    });
    expect(result.outcomes).toEqual([]);
    expect(result.globalFailure).toMatch(/could not confirm removal/);
    expect(calls.at(-1)).toMatchObject({
      path: "/v1/reviewSubmissions/submission-delete-failed",
      method: "PATCH",
      body: { data: { attributes: { canceled: true } } },
    });
  });

  it("retries after sequential first-product manual gates", async () => {
    let createdItems = 0;
    let submitAttempts = 0;
    const calls: Array<{ path: string; method?: string }> = [];
    const request: AscJsonRequest = async <T>(
      path: string,
      init?: RequestInit & { body?: string },
    ) => {
      calls.push({ path, method: init?.method });
      if (path === "/v1/reviewSubmissions" && init?.method === "POST") {
        return {
          data: { id: "submission-sequential", type: "reviewSubmissions" },
        } as T;
      }
      if (path === "/v1/reviewSubmissionItems") {
        createdItems += 1;
        return { data: { id: `sequential-item-${createdItems}` } } as T;
      }
      if (
        path === "/v1/reviewSubmissions/submission-sequential" &&
        init?.method === "PATCH"
      ) {
        submitAttempts += 1;
        if (submitAttempts === 1) {
          throw new MockAscError(
            422,
            "The first consumable in-app purchase must be submitted with a new app version",
          );
        }
        if (submitAttempts === 2) {
          throw new MockAscError(
            422,
            "The subscription group must be submitted for review before this subscription",
          );
        }
      }
      return { data: {} } as T;
    };
    const consumable = {
      productId: "coins",
      storeRef: "iap-consumable",
      kind: "iap" as const,
      productType: "Consumable" as const,
      versionId: "version-consumable",
    };
    const subscription = {
      productId: "premium",
      storeRef: "sub-1",
      kind: "subscription" as const,
      productType: "Subscription" as const,
      versionId: "version-subscription",
    };
    const nonConsumable = {
      productId: "lifetime",
      storeRef: "iap-nonconsumable",
      kind: "iap" as const,
      productType: "NonConsumable" as const,
      versionId: "version-nonconsumable",
    };

    const result = await submitAscReviewVersions({
      request,
      appId: "app-1",
      items: [consumable, subscription, nonConsumable],
    });

    expect(result.outcomes).toEqual([
      {
        item: consumable,
        status: "manual",
        action: expect.objectContaining({ code: "app_version_required" }),
      },
      {
        item: subscription,
        status: "manual",
        action: expect.objectContaining({
          code: "subscription_group_required",
        }),
      },
      { item: nonConsumable, status: "submitted" },
    ]);
    expect(calls).toContainEqual({
      path: "/v1/reviewSubmissionItems/sequential-item-1",
      method: "DELETE",
    });
    expect(calls).toContainEqual({
      path: "/v1/reviewSubmissionItems/sequential-item-2",
      method: "DELETE",
    });
    expect(submitAttempts).toBe(3);
  });

  it("isolates a first non-renewing subscription from regular non-consumables", async () => {
    let createdItems = 0;
    let submitAttempts = 0;
    const request: AscJsonRequest = async <T>(
      path: string,
      init?: RequestInit & { body?: string },
    ) => {
      if (path === "/v1/reviewSubmissions" && init?.method === "POST") {
        return {
          data: { id: "submission-non-renewing", type: "reviewSubmissions" },
        } as T;
      }
      if (path === "/v1/reviewSubmissionItems") {
        createdItems += 1;
        return { data: { id: `non-renewing-item-${createdItems}` } } as T;
      }
      if (
        path === "/v1/reviewSubmissions/submission-non-renewing" &&
        init?.method === "PATCH"
      ) {
        submitAttempts += 1;
        if (submitAttempts === 1) {
          throw new MockAscError(
            422,
            "The first non-renewing subscription must be submitted with a new app version",
          );
        }
      }
      return { data: {} } as T;
    };
    const nonRenewing = {
      productId: "season-pass",
      storeRef: "iap-non-renewing",
      kind: "iap" as const,
      productType: "NonRenewingSubscription" as const,
      versionId: "version-non-renewing",
    };
    const nonConsumable = {
      productId: "lifetime",
      storeRef: "iap-non-consumable",
      kind: "iap" as const,
      productType: "NonConsumable" as const,
      versionId: "version-non-consumable",
    };

    const result = await submitAscReviewVersions({
      request,
      appId: "app-1",
      items: [nonRenewing, nonConsumable],
    });

    expect(result.outcomes).toEqual([
      {
        item: nonRenewing,
        status: "manual",
        action: expect.objectContaining({ code: "app_version_required" }),
      },
      { item: nonConsumable, status: "submitted" },
    ]);
    expect(submitAttempts).toBe(2);
  });

  it("never commandeers an existing App Store Connect review draft", async () => {
    const calls: Array<{ path: string; method?: string }> = [];
    const request: AscJsonRequest = async <T>(
      path: string,
      init?: RequestInit & { body?: string },
    ) => {
      calls.push({ path, method: init?.method });
      if (path === "/v1/reviewSubmissions" && init?.method === "POST") {
        throw new MockAscError(
          409,
          "An active review submission already exists",
        );
      }
      return { data: {} } as T;
    };
    const consumable = {
      productId: "coins",
      storeRef: "iap-1",
      kind: "iap" as const,
      productType: "Consumable" as const,
      versionId: "iap-version",
    };
    const subscription = {
      productId: "premium",
      storeRef: "sub-1",
      kind: "subscription" as const,
      productType: "Subscription" as const,
      versionId: "sub-version",
    };

    const result = await submitAscReviewVersions({
      request,
      appId: "app-1",
      items: [consumable, subscription],
    });

    expect(result.outcomes).toEqual([
      {
        item: consumable,
        status: "manual",
        action: expect.objectContaining({ code: "review_submission_conflict" }),
      },
      {
        item: subscription,
        status: "manual",
        action: expect.objectContaining({ code: "review_submission_conflict" }),
      },
    ]);
    expect(calls).not.toContainEqual({
      path: "/v1/reviewSubmissionItems",
      method: "POST",
    });
    expect(calls).toHaveLength(1);
  });

  it("reports a statusless create response as an explicit manual ambiguity", async () => {
    const calls: Array<{ path: string; method?: string }> = [];
    const request: AscJsonRequest = async <_T>(
      path: string,
      init?: RequestInit & { body?: string },
    ) => {
      calls.push({ path, method: init?.method });
      throw new Error("connection closed after request");
    };
    const item = {
      productId: "coins",
      storeRef: "iap-1",
      kind: "iap" as const,
      productType: "Consumable" as const,
      versionId: "iap-version",
    };

    await expect(
      submitAscReviewVersions({ request, appId: "app-1", items: [item] }),
    ).resolves.toEqual({
      outcomes: [
        {
          item,
          status: "manual",
          action: expect.objectContaining({
            code: "review_submission_status_unknown",
          }),
        },
      ],
    });
    expect(calls).toEqual([{ path: "/v1/reviewSubmissions", method: "POST" }]);
  });

  it("does not attribute a generic group constraint to multiple subscriptions", async () => {
    let itemCount = 0;
    const calls: Array<{ path: string; method?: string }> = [];
    const request: AscJsonRequest = async <T>(
      path: string,
      init?: RequestInit & { body?: string },
    ) => {
      calls.push({ path, method: init?.method });
      if (path === "/v1/reviewSubmissions" && init?.method === "POST") {
        return {
          data: { id: "submission-groups", type: "reviewSubmissions" },
        } as T;
      }
      if (path === "/v1/reviewSubmissionItems") {
        itemCount += 1;
        return { data: { id: `group-item-${itemCount}` } } as T;
      }
      if (
        path === "/v1/reviewSubmissions/submission-groups" &&
        init?.method === "PATCH" &&
        JSON.parse(String(init.body)).data.attributes.submitted === true
      ) {
        throw new MockAscError(
          422,
          "The subscription group must be submitted for review first",
        );
      }
      return { data: {} } as T;
    };
    const items = ["monthly", "yearly"].map((productId, index) => ({
      productId,
      storeRef: `sub-${index}`,
      kind: "subscription" as const,
      productType: "Subscription" as const,
      versionId: `sub-version-${index}`,
    }));

    const result = await submitAscReviewVersions({
      request,
      appId: "app-1",
      items,
    });

    expect(result.outcomes).toEqual([]);
    expect(result.globalFailure).toMatch(/could not be attributed/);
    expect(calls.filter((call) => call.method === "DELETE")).toHaveLength(0);
    expect(calls.at(-1)).toEqual({
      path: "/v1/reviewSubmissions/submission-groups",
      method: "PATCH",
    });
  });

  it("cancels the enclosing draft in O(1) when cancellation interrupts submission", async () => {
    const calls: Array<{ path: string; method?: string; body?: any }> = [];
    const request: AscJsonRequest = async <T>(
      path: string,
      init?: RequestInit & { body?: string },
    ) => {
      calls.push({
        path,
        method: init?.method,
        body: init?.body ? JSON.parse(init.body) : undefined,
      });
      if (path === "/v1/reviewSubmissions" && init?.method === "POST") {
        return {
          data: { id: "submission-cancel", type: "reviewSubmissions" },
        } as T;
      }
      if (path === "/v1/reviewSubmissionItems") {
        return { data: { id: "item-added" } } as T;
      }
      return { data: {} } as T;
    };
    let checks = 0;
    const checkCancelled = async () => {
      checks += 1;
      if (checks === 3) throw new Error("operator cancelled");
    };

    await expect(
      submitAscReviewVersions({
        request,
        appId: "app-1",
        items: [
          {
            productId: "coins",
            storeRef: "iap-1",
            kind: "iap",
            productType: "Consumable",
            versionId: "iap-version",
          },
          {
            productId: "premium",
            storeRef: "sub-1",
            kind: "subscription",
            productType: "Subscription",
            versionId: "sub-version",
          },
        ],
        checkCancelled,
      }),
    ).rejects.toThrow("operator cancelled");

    expect(calls.at(-1)).toEqual({
      path: "/v1/reviewSubmissions/submission-cancel",
      method: "PATCH",
      body: {
        data: {
          type: "reviewSubmissions",
          id: "submission-cancel",
          attributes: { canceled: true },
        },
      },
    });
    expect(calls.filter((call) => call.method === "DELETE")).toHaveLength(0);
  });

  it("rethrows a transport-boundary abort during item creation after canceling the owned draft", async () => {
    const abort = new Error("deadline reached inside request guard");
    const cleanupCalls: Array<{ path: string; body?: unknown }> = [];
    const request: AscJsonRequest = async <T>(
      path: string,
      init?: RequestInit & { body?: string },
    ) => {
      if (path === "/v1/reviewSubmissions" && init?.method === "POST") {
        return {
          data: { id: "submission-item-abort", type: "reviewSubmissions" },
        } as T;
      }
      if (path === "/v1/reviewSubmissionItems") throw abort;
      return { data: {} } as T;
    };
    const cleanupRequest: AscJsonRequest = async <T>(
      path: string,
      init?: RequestInit & { body?: string },
    ) => {
      cleanupCalls.push({
        path,
        body: init?.body ? JSON.parse(init.body) : undefined,
      });
      return { data: {} } as T;
    };

    await expect(
      submitAscReviewVersions({
        request,
        cleanupRequest,
        appId: "app-1",
        items: [
          {
            productId: "coins",
            storeRef: "iap-1",
            kind: "iap",
            productType: "Consumable",
            versionId: "iap-version",
          },
        ],
        isAbortError: (error) => error === abort,
      }),
    ).rejects.toBe(abort);
    expect(cleanupCalls).toEqual([
      {
        path: "/v1/reviewSubmissions/submission-item-abort",
        body: {
          data: {
            type: "reviewSubmissions",
            id: "submission-item-abort",
            attributes: { canceled: true },
          },
        },
      },
    ]);
  });

  it("rethrows a transport-boundary abort during final submission after canceling the owned draft", async () => {
    const abort = new Error("operator cancelled inside request guard");
    const cleanupCalls: Array<{ path: string; body?: unknown }> = [];
    const request: AscJsonRequest = async <T>(
      path: string,
      init?: RequestInit & { body?: string },
    ) => {
      if (path === "/v1/reviewSubmissions" && init?.method === "POST") {
        return {
          data: { id: "submission-submit-abort", type: "reviewSubmissions" },
        } as T;
      }
      if (path === "/v1/reviewSubmissionItems") {
        return { data: { id: "submission-item" } } as T;
      }
      if (
        path === "/v1/reviewSubmissions/submission-submit-abort" &&
        init?.method === "PATCH"
      ) {
        throw abort;
      }
      return { data: {} } as T;
    };
    const cleanupRequest: AscJsonRequest = async <T>(
      path: string,
      init?: RequestInit & { body?: string },
    ) => {
      cleanupCalls.push({
        path,
        body: init?.body ? JSON.parse(init.body) : undefined,
      });
      return { data: {} } as T;
    };

    await expect(
      submitAscReviewVersions({
        request,
        cleanupRequest,
        appId: "app-1",
        items: [
          {
            productId: "coins",
            storeRef: "iap-1",
            kind: "iap",
            productType: "Consumable",
            versionId: "iap-version",
          },
        ],
        isAbortError: (error) => error === abort,
      }),
    ).rejects.toBe(abort);
    expect(cleanupCalls).toEqual([
      {
        path: "/v1/reviewSubmissions/submission-submit-abort",
        body: {
          data: {
            type: "reviewSubmissions",
            id: "submission-submit-abort",
            attributes: { canceled: true },
          },
        },
      },
    ]);
  });

  it.each([
    [
      "The first consumable in-app purchase must be submitted with a new app version",
      "app_version_required",
    ],
    [
      "The first non-consumable in-app purchase requires an app version",
      "app_version_required",
    ],
    [
      "The first auto-renewable subscription must be submitted with an app version",
      "app_version_required",
    ],
    [
      "The first non-renewing subscription must be submitted with an app version",
      "app_version_required",
    ],
    [
      "The subscription group must be submitted for review before this subscription",
      "subscription_group_required",
    ],
  ])("classifies manual ASC constraint: %s", (message, code) => {
    expect(
      classifyAscManualReviewAction(new MockAscError(422, message), "sku-1"),
    ).toMatchObject({ productId: "sku-1", code });
  });

  it("does not classify transient server errors as manual follow-up", () => {
    expect(
      classifyAscManualReviewAction(
        new MockAscError(503, "Service unavailable"),
        "sku-1",
      ),
    ).toBeNull();
  });
});
