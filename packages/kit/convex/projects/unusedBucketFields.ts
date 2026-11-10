// Left on projects from before admission buckets got their own table.
export const UNUSED_PROJECT_BUCKET_FIELDS = [
  "verificationAdmissionTokens",
  "verificationAdmissionRefilledAt",
  "entitlementRecheckTokens",
  "entitlementRecheckRefilledAt",
] as const;

type UnusedProjectBucketField = (typeof UNUSED_PROJECT_BUCKET_FIELDS)[number];

/**
 * Patch that removes the unused bucket fields a project still carries, or
 * null for a clean row. db.patch only removes a field given as an explicit
 * `undefined`.
 */
export function unusedProjectBucketFieldsPatch(
  doc: object,
): Partial<Record<UnusedProjectBucketField, undefined>> | null {
  const present = UNUSED_PROJECT_BUCKET_FIELDS.filter((field) => field in doc);
  if (present.length === 0) return null;
  return Object.fromEntries(present.map((field) => [field, undefined]));
}
