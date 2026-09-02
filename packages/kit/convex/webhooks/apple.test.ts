import { Environment } from "@apple/app-store-server-library";
import { describe, expect, it } from "vitest";

import { mapPreviewEnvironment } from "./apple";

// The environment is read from the notification before its signature is
// checked, so it decides whether the signature is checked at all: the Apple
// library returns the decoded JWT unverified under XCODE and LOCAL_TESTING.
// Anything a caller can put in the payload must still require a real signature.
describe("mapPreviewEnvironment", () => {
  it("maps the two environments Apple signs", () => {
    expect(mapPreviewEnvironment("Sandbox")).toBe(Environment.SANDBOX);
    expect(mapPreviewEnvironment("Production")).toBe(Environment.PRODUCTION);
  });

  it.each(["Xcode", "LocalTesting", "XCODE", undefined, "", "anything"])(
    "never selects an unverified environment for %s",
    (claimed) => {
      const resolved = mapPreviewEnvironment(claimed);
      expect(resolved).not.toBe(Environment.XCODE);
      expect(resolved).not.toBe(Environment.LOCAL_TESTING);
    },
  );
});
