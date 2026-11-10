import { describe, expect, it } from "vitest";
import {
  UNUSED_PROJECT_BUCKET_FIELDS,
  unusedProjectBucketFieldsPatch,
} from "./unusedBucketFields";

describe("unusedProjectBucketFieldsPatch", () => {
  // The migrations component applies the patch with db.patch, so only an
  // explicit `field: undefined` removes a field. Assert on key presence.
  it("removes the bucket fields the row carries", () => {
    const patch = unusedProjectBucketFieldsPatch({
      name: "Acme",
      verificationAdmissionTokens: 3,
      entitlementRecheckRefilledAt: 1,
    });
    expect(Object.keys(patch!).sort()).toEqual([
      "entitlementRecheckRefilledAt",
      "verificationAdmissionTokens",
    ]);
    for (const value of Object.values(patch!)) expect(value).toBeUndefined();
  });

  it("covers all four fields", () => {
    const row = Object.fromEntries(
      UNUSED_PROJECT_BUCKET_FIELDS.map((field) => [field, 1]),
    );
    expect(Object.keys(unusedProjectBucketFieldsPatch(row)!)).toHaveLength(4);
  });

  it("leaves a clean row alone", () => {
    expect(unusedProjectBucketFieldsPatch({ name: "Acme" })).toBeNull();
  });
});
