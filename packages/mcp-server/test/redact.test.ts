import { describe, expect, it } from "vitest";

import { redactSensitivePayload } from "../src/redact";

describe("redactSensitivePayload", () => {
  it("redacts webhook and auth secret fields recursively", () => {
    const redacted = redactSensitivePayload({
      signedPayload: "apple-jws",
      rawSignedPayload: "raw-apple-jws",
      rawMessage: JSON.stringify({ purchaseToken: "google-token" }),
      headers: {
        Authorization: "Bearer jwt-token",
        cookie: "session=secret",
        "proxy-authorization": "Bearer proxy-token",
        "set-cookie": "sid=set-cookie-secret",
        "x-api-key": "x-api-key-secret",
        "x-openiap-api-key": "x-openiap-key-secret",
      },
      nested: [{ refreshToken: "refresh-token", idToken: "id-token" }],
    });

    expect(JSON.stringify(redacted)).not.toContain("apple-jws");
    expect(JSON.stringify(redacted)).not.toContain("raw-apple-jws");
    expect(JSON.stringify(redacted)).not.toContain("google-token");
    expect(JSON.stringify(redacted)).not.toContain("jwt-token");
    expect(JSON.stringify(redacted)).not.toContain("session=secret");
    expect(JSON.stringify(redacted)).not.toContain("proxy-token");
    expect(JSON.stringify(redacted)).not.toContain("set-cookie-secret");
    expect(JSON.stringify(redacted)).not.toContain("x-api-key-secret");
    expect(JSON.stringify(redacted)).not.toContain("x-openiap-key-secret");
    expect(JSON.stringify(redacted)).not.toContain("refresh-token");
    expect(JSON.stringify(redacted)).not.toContain("id-token");
  });

  it("redacts api keys inside JSON strings", () => {
    const redacted = String(
      redactSensitivePayload(
        '{"url":"https://kit.openiap.dev/v1/products/openiap-kit_abcdef123456"}',
      ),
    );

    expect(redacted).not.toContain("openiap-kit_abcdef123456");
    expect(redacted).toContain("<api-key-redacted>");
  });

  it("redacts short openiap api keys in free-form text", () => {
    const redacted = String(
      redactSensitivePayload(
        "request failed with Authorization: Bearer openiap-kit_abc123",
      ),
    );

    expect(redacted).not.toContain("openiap-kit_abc123");
    expect(redacted).toContain("<redacted len=");
  });

  it("redacts authorization bearer tokens in free-form text", () => {
    const redacted = String(
      redactSensitivePayload("upstream saw Authorization: Bearer jwt-token"),
    );

    expect(redacted).not.toContain("jwt-token");
    expect(redacted).toContain("Authorization: Bearer <redacted len=");
  });

  it("redacts non-bearer authorization headers in free-form text", () => {
    const redacted = String(
      redactSensitivePayload(
        "upstream saw Authorization: Basic dXNlcjpwYXNz",
      ),
    );

    expect(redacted).not.toContain("dXNlcjpwYXNz");
    expect(redacted).toContain("Authorization: Basic <redacted len=");
  });

  it("redacts sensitive headers in free-form text", () => {
    const redacted = String(
      redactSensitivePayload(
        "upstream headers x-api-key: x-secret proxy-authorization: Bearer proxy-token set-cookie: sid=set-cookie-secret; Path=/ cookie: session=cookie-secret; pref=second-cookie-secret",
      ),
    );

    expect(redacted).not.toContain("x-secret");
    expect(redacted).not.toContain("proxy-token");
    expect(redacted).not.toContain("set-cookie-secret");
    expect(redacted).not.toContain("cookie-secret");
    expect(redacted).not.toContain("second-cookie-secret");
    expect(redacted).toContain("x-api-key: <redacted len=");
    expect(redacted).toContain("proxy-authorization: Bearer <redacted len=");
    expect(redacted).toContain("set-cookie: <redacted len=");
    expect(redacted).toContain("cookie: <redacted len=");
  });

  it("preserves explicit placeholders in generated guidance", () => {
    expect(
      redactSensitivePayload(
        "use https://kit.example/v1/webhooks/<OPENIAP_API_KEY>",
      ),
    ).toBe("use https://kit.example/v1/webhooks/<OPENIAP_API_KEY>");
    expect(
      redactSensitivePayload("Authorization: Bearer <OPENIAP_API_KEY>"),
    ).toBe("Authorization: Bearer <OPENIAP_API_KEY>");
    expect(
      redactSensitivePayload("Authorization: Bearer openiap-kit_<your-key>"),
    ).toBe("Authorization: Bearer openiap-kit_<your-key>");
    expect(
      redactSensitivePayload(
        "use https://kit.example/v1/webhooks/openiap-kit_<your-key>",
      ),
    ).toBe("use https://kit.example/v1/webhooks/openiap-kit_<your-key>");
  });

  it("redacts custom api keys embedded in kit URL strings", () => {
    expect(
      redactSensitivePayload(
        "fetch https://kit.example/v1/webhooks/google/custom-secret failed",
      ),
    ).toBe(
      "fetch https://kit.example/v1/webhooks/google/<api-key-redacted> failed",
    );
    expect(
      redactSensitivePayload(
        "fetch https://kit.example/v1/webhooks/custom-secret failed",
      ),
    ).toBe("fetch https://kit.example/v1/webhooks/<api-key-redacted> failed");
    expect(
      redactSensitivePayload(
        "fetch https://kit.example/api/v1/webhooks/custom-secret failed",
      ),
    ).toBe(
      "fetch https://kit.example/api/v1/webhooks/<api-key-redacted> failed",
    );
    expect(
      redactSensitivePayload(
        "POST https://kit.example/v1/subscriptions/bind-user/custom-secret failed",
      ),
    ).toBe(
      "POST https://kit.example/v1/subscriptions/bind-user/<api-key-redacted> failed",
    );
    expect(
      redactSensitivePayload(
        "POST https://kit.example/v1/products/custom-secret/state failed",
      ),
    ).toBe(
      "POST https://kit.example/v1/products/<api-key-redacted>/state failed",
    );
    expect(
      redactSensitivePayload(
        "GET https://kit.example/v1/products/custom-secret/sync/jobs/job-1?apiKey=query-secret&token=jwt-token failed",
      ),
    ).toBe(
      "GET https://kit.example/v1/products/<api-key-redacted>/sync/jobs/job-1?apiKey=<redacted>&token=<redacted> failed",
    );
  });

  it("redacts sensitive query parameters in free-form strings", () => {
    expect(
      redactSensitivePayload(
        "callback https://example.test/path?access_token=access-secret&id_token=id-secret&ok=1&refreshToken=refresh-secret&jwt=jwt-secret#frag",
      ),
    ).toBe(
      "callback https://example.test/path?access_token=<redacted>&id_token=<redacted>&ok=1&refreshToken=<redacted>&jwt=<redacted>#frag",
    );
  });
});
