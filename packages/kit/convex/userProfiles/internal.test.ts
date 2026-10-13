import { describe, expect, it } from "vitest";

import * as userProfileMutations from "./mutation";
import { createOrUpdateProfile } from "./internal";

describe("createOrUpdateProfile", () => {
  it("is internal-only, so no client can write another user's profile", () => {
    expect(createOrUpdateProfile.isInternal).toBe(true);
    expect("createOrUpdateProfile" in userProfileMutations).toBe(false);
  });
});
