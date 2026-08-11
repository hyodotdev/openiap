import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isIgnoredResourceUrl } from "./e2e-web-sites.mjs";

describe("web E2E resource URL filtering", () => {
  it("ignores only attributable favicon and third-party telemetry URLs", () => {
    assert.equal(
      isIgnoredResourceUrl("https://kit.openiap.dev/favicon.ico"),
      true,
    );
    assert.equal(
      isIgnoredResourceUrl("https://api-eu.mixpanel.com/track/?ip=1"),
      true,
    );
    assert.equal(
      isIgnoredResourceUrl(
        "https://o123.ingest.us.sentry.io/api/456/envelope/",
      ),
      true,
    );
  });

  it("keeps same-origin and unrelated 404 URLs actionable", () => {
    assert.equal(
      isIgnoredResourceUrl("https://kit.openiap.dev/missing.js"),
      false,
    );
    assert.equal(
      isIgnoredResourceUrl("https://kit.openiap.dev/docs/analytics/missing.js"),
      false,
    );
    assert.equal(
      isIgnoredResourceUrl("https://cdn.example.test/missing.js"),
      false,
    );
  });
});
