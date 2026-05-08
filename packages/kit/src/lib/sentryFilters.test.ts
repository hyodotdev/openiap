import type { Event } from "@sentry/react";
import { describe, expect, test } from "vitest";

import { applySentryEventFilters } from "./sentryFilters";

describe("applySentryEventFilters", () => {
  test("keeps Convex reconnect failures on a stable fingerprint", () => {
    const event: Event = {
      breadcrumbs: [
        {
          category: "fetch",
          data: {
            method: "POST",
            url: "https://healthy-kudu-836.convex.cloud/api/action",
          },
        },
      ],
      request: { url: "https://kit.openiap.dev/intu/project/intu/apikeys" },
    };

    const result = applySentryEventFilters(event, {
      originalException: new TypeError("Failed to fetch"),
    });

    expect(result?.tags?.source).toBe("convex-reconnect");
    expect(result?.fingerprint).toEqual(["convex-reconnect-load-failed"]);
  });

  test("fingerprints generic Convex action server errors", () => {
    const event: Event = {
      breadcrumbs: [
        {
          category: "fetch",
          data: {
            method: "POST",
            status_code: 200,
            url: "https://healthy-kudu-836.convex.cloud/api/action",
          },
        },
      ],
      request: { url: "https://kit.openiap.dev/intu/project/intu/apikeys" },
    };

    const result = applySentryEventFilters(event, {
      originalException: new Error(
        "[Request ID: 79b077815fe97b2b] Server Error",
      ),
    });

    expect(result?.tags?.source).toBe("convex-action-server-error");
    expect(result?.fingerprint).toEqual(["convex-action-server-error"]);
  });

  test("does not rewrite unrelated server errors", () => {
    const event: Event = {
      breadcrumbs: [
        {
          category: "fetch",
          data: {
            method: "POST",
            url: "https://api.example.test/action",
          },
        },
      ],
      request: { url: "https://kit.openiap.dev/intu/project/intu/apikeys" },
    };

    const result = applySentryEventFilters(event, {
      originalException: new Error("[Request ID: abc123] Server Error"),
    });

    expect(result?.tags?.source).toBeUndefined();
    expect(result?.fingerprint).toBeUndefined();
  });
});
