/**
 * Every id this tool can emit. Agents are told to match on `id`, so a rename
 * is a contract change: the registry test fails until this list and the README
 * agree with the code.
 */
export const FINDING_IDS = Object.freeze([
  "android-store-flavor-conflict",
  "android-store-flavor-mismatch",
  "android-store-not-play",
  "android-horizon-app-id-missing",
  "iapkit-secret-key-in-client",
  "iapkit-secret-key-in-env",
  "iapkit-env-missing-expo-prefix",
  "iapkit-env-unexpected-expo-prefix",
  "iapkit-base-url-invalid",
  "iapkit-base-url-scheme",
  "iapkit-base-url-has-path",
  "ios-scene-delegate-missing",
  "project-file-unreadable",
  "project-manifest-unreadable",
  "project-not-a-directory",
]);

/**
 * Every finding carries a stable id so an agent can act on it without parsing
 * prose, and names the file it was read from so a person can verify it.
 */
export function finding(id, level, file, message, fix, extra = {}) {
  if (!FINDING_IDS.includes(id))
    throw new Error(`Unregistered finding id: ${id}`);
  return { id, level, file, message, fix, ...extra };
}
