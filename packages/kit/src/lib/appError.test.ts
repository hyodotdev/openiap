import { describe, expect, it } from "vitest";
import { ErrorCode, createError } from "../../convex/utils/errors";
import { appErrorCode } from "./appError";

describe("appErrorCode", () => {
  it("reads the code an AppError actually puts on the wire", () => {
    expect(
      appErrorCode({ data: createError(ErrorCode.USER_NOT_REGISTERED).data }),
    ).toBe(ErrorCode.USER_NOT_REGISTERED);
  });

  it("returns the enum member, not a bare string", () => {
    expect(appErrorCode({ data: { code: "USER_ALREADY_MEMBER" } })).toBe(
      ErrorCode.USER_ALREADY_MEMBER,
    );
  });

  it("ignores codes the enum does not declare", () => {
    expect(appErrorCode({ data: { code: "MADE_UP_CODE" } })).toBeUndefined();
    expect(appErrorCode({ data: { code: 42 } })).toBeUndefined();
  });

  it("returns undefined for errors that carry no application data", () => {
    expect(appErrorCode({ message: "Server Error" })).toBeUndefined();
    expect(appErrorCode({ data: "plain string payload" })).toBeUndefined();
    expect(appErrorCode(null)).toBeUndefined();
    expect(appErrorCode(undefined)).toBeUndefined();
    expect(appErrorCode({})).toBeUndefined();
  });
});
