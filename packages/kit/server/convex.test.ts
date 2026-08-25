import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";
import { ErrorCode, createError } from "../convex/utils/errors";

process.env.VITE_KIT_CONVEX_URL ??= "https://placeholder.convex.cloud";

const { handleConvexError, resolveServerConvexUrl } = await import("./convex");

describe("resolveServerConvexUrl", () => {
  it("uses the Convex CLI variable for local development", () => {
    expect(
      resolveServerConvexUrl({
        VITE_CONVEX_URL: "http://127.0.0.1:3210",
      }),
    ).toBe("http://127.0.0.1:3210");
  });

  it("prefers explicit production server configuration", () => {
    expect(
      resolveServerConvexUrl({
        VITE_KIT_CONVEX_URL: "https://build.convex.cloud",
        CONVEX_URL: "https://runtime.convex.cloud",
        VITE_CONVEX_URL: "http://127.0.0.1:3210",
      }),
    ).toBe("https://build.convex.cloud");
  });

  it("rejects an unconfigured environment", () => {
    expect(() => resolveServerConvexUrl({})).toThrow(
      "run `convex dev` to generate VITE_CONVEX_URL",
    );
  });
});

describe("handleConvexError", () => {
  it("returns structured ConvexError payloads", () => {
    expect(
      handleConvexError(
        new ConvexError({
          code: "INVALID_API_KEY",
          message: "Invalid API key",
        }),
      ),
    ).toEqual({
      code: "INVALID_API_KEY",
      message: "Invalid API key",
    });
  });

  it("returns legacy JSON ConvexError payloads", () => {
    expect(
      handleConvexError(
        new ConvexError(
          JSON.stringify({
            error: "INVALID_API_KEY",
            message: "Invalid API key",
          }),
        ),
      ),
    ).toEqual({
      code: "INVALID_API_KEY",
      message: "Invalid API key",
    });
  });

  it("preserves safe client-payload conflict details", () => {
    expect(
      handleConvexError(
        new ConvexError({
          code: "CLIENT_PAYLOAD_VERSION_CONFLICT",
          message: "Client payload was changed by another request",
          expectedVersion: 0,
          actualVersion: 4,
        }),
      ),
    ).toEqual({
      code: "CLIENT_PAYLOAD_VERSION_CONFLICT",
      message: "Client payload was changed by another request",
      expectedVersion: 0,
      actualVersion: 4,
    });
  });

  it("does not expose unstructured ConvexError strings", () => {
    expect(handleConvexError(new ConvexError("internal backend detail"))).toBe(
      null,
    );
  });

  // Every Convex function /v1 calls can throw AppError; none may reach the body.
  it("does not expose dashboard-scoped AppError payloads", () => {
    expect(handleConvexError(createError(ErrorCode.PROJECT_NOT_FOUND))).toBe(
      null,
    );
    expect(
      handleConvexError(
        createError(ErrorCode.INVALID_INPUT, "Sync job not found"),
      ),
    ).toBe(null);
  });
});
