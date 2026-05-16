import { describe, expect, it } from "vitest";
import { ConvexError } from "convex/values";

process.env.VITE_KIT_CONVEX_URL ??= "https://placeholder.convex.cloud";

const { handleConvexError } = await import("./convex");

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

  it("does not expose unstructured ConvexError strings", () => {
    expect(handleConvexError(new ConvexError("internal backend detail"))).toBe(
      null,
    );
  });
});
