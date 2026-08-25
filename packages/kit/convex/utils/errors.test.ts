import { ConvexError } from "convex/values";
import { describe, expect, it } from "vitest";
import { APP_ERROR_SCOPE, AppError, ErrorCode, createError } from "./errors";

describe("AppError", () => {
  // Convex serializes application errors by checking for this symbol; a plain
  // Error fails the check and is redacted to "Server Error" in production.
  it("qualifies as a Convex application error", () => {
    const error = createError(ErrorCode.USER_NOT_REGISTERED);
    expect(Symbol.for("ConvexError") in error).toBe(true);
    expect(error).toBeInstanceOf(ConvexError);
    expect(error).toBeInstanceOf(AppError);
  });

  it("puts the code on the wire payload", () => {
    expect(createError(ErrorCode.USER_ALREADY_MEMBER).data).toEqual({
      code: ErrorCode.USER_ALREADY_MEMBER,
      message: ErrorCode.USER_ALREADY_MEMBER,
      scope: APP_ERROR_SCOPE,
    });
  });

  it("carries details as the payload message without repeating the code", () => {
    const error = createError(ErrorCode.INVALID_INPUT, "Sync job not found");
    expect(error.data.message).toBe("Sync job not found");
    expect(error.data.code).toBe(ErrorCode.INVALID_INPUT);
  });

  it("keeps server logs keyed by the code", () => {
    expect(createError(ErrorCode.PROJECT_NOT_FOUND).message).toBe(
      ErrorCode.PROJECT_NOT_FOUND,
    );
    expect(createError(ErrorCode.INVALID_INPUT, "missing id").message).toBe(
      "INVALID_INPUT: missing id",
    );
  });

  it("exposes the code as a field for server-side branching", () => {
    expect(createError(ErrorCode.CANNOT_REMOVE_OWNER).code).toBe(
      ErrorCode.CANNOT_REMOVE_OWNER,
    );
  });
});
