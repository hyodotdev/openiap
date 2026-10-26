export const VERIFICATION_REJECTION_COOLDOWN_MS = 5 * 60_000;

// Settled store verdicts, unless the verifier says otherwise: Google's UNKNOWN
// covers both an unrecognized state and the explicit 410 revoked-token response,
// and only the latter is settled; an EXPIRED subscription Play holds on hold or
// paused comes back when the user fixes payment or resumes.
const STABLE_REJECTION_STATES = new Set([
  "INAUTHENTIC",
  "CANCELED",
  "EXPIRED",
  "CONSUMED",
]);

/**
 * Whether a rejected verification arms the failure cooldown. Settled verdicts
 * (INAUTHENTIC, CANCELED, EXPIRED) don't change in seconds; others can. The
 * verifier's `stableRejection`, when set, decides instead.
 */
export function isStableRejection(
  state: string,
  stableRejection?: boolean,
): boolean {
  return stableRejection ?? STABLE_REJECTION_STATES.has(state.toUpperCase());
}

/**
 * A rejection a retry of the same evidence will not change. Never Horizon's:
 * Meta checks current ownership of (userId, sku), and the user can buy right
 * after `success: false`.
 */
export function isSettledRejection(
  store: string | undefined,
  outcome: { isValid: boolean; state: string; stableRejection?: boolean },
): boolean {
  return (
    store !== "horizon" &&
    !outcome.isValid &&
    isStableRejection(outcome.state, outcome.stableRejection)
  );
}
