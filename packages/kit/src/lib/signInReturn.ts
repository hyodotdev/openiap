// Convex Auth forgets `redirectTo` when a GitHub sign-in takes over 15 minutes
// and lands on "/", so the approval pages remember where they started.
const KEY = "iapkit.signInReturn";
const MAX_AGE_MS = 60 * 60 * 1000;
const APPROVAL_PAGE = /^\/(?:oauth|cli)\/authorize$/;

export function isApprovalPage(pathname: string): boolean {
  return APPROVAL_PAGE.test(pathname);
}

/** Router state an approval page gets when a sign-in is resumed. */
export const SIGN_IN_UNFINISHED = { signInUnfinished: true } as const;

export function isSignInUnfinished(state: unknown): boolean {
  return (
    typeof state === "object" && state !== null && "signInUnfinished" in state
  );
}

export function rememberSignInReturn(path: string): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }));
  } catch {
    // Storage blocked: a failed sign-in just lands on the home page.
  }
}

export function clearSignInReturn(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Storage blocked; nothing to clear.
  }
}

/** The approval page an unfinished sign-in started from, read once. */
export function takeSignInReturn(now = Date.now()): string | null {
  try {
    const saved = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    const parsed: unknown = saved ? JSON.parse(saved) : null;
    if (!parsed || typeof parsed !== "object") return null;
    const { path, at } = parsed as { path?: unknown; at?: unknown };
    if (typeof path !== "string" || typeof at !== "number") return null;
    const query = path.indexOf("?");
    return query > 0 &&
      isApprovalPage(path.slice(0, query)) &&
      now - at < MAX_AGE_MS
      ? path
      : null;
  } catch {
    return null;
  }
}
