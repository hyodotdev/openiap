import { useEffect, useRef } from "react";
import { useConvexAuth } from "convex/react";
import { useUserProfile } from "./useUserProfile";
import {
  MixpanelEvent,
  identifyUser,
  resetUser,
  trackEvent,
} from "../lib/mixpanel";

// `sessionStorage` is per-tab and cleared on close, which matches
// Mixpanel's session model. Persisting the "already fired signed_in
// for userId X" flag here means a reload or in-tab navigation won't
// re-fire the event, but opening a fresh tab or reopening the browser
// will — that's the retention-friendly semantic (each fresh SPA
// session = one sign-in).
const SIGNED_IN_SESSION_KEY = "mp:signedIn:userId";

function readSignedInUserId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage?.getItem(SIGNED_IN_SESSION_KEY) ?? null;
  } catch {
    // Private-mode / disabled storage — treat as "not yet fired" so
    // we still get one event per page load rather than none. A few
    // duplicate events on the margin beat a silent retention board.
    return null;
  }
}

function writeSignedInUserId(userId: string | null) {
  if (typeof window === "undefined") return;
  try {
    const storage = window.sessionStorage;
    if (!storage) return;
    if (userId === null) {
      storage.removeItem(SIGNED_IN_SESSION_KEY);
    } else {
      storage.setItem(SIGNED_IN_SESSION_KEY, userId);
    }
  } catch {
    // See `readSignedInUserId` — best-effort, never crash on storage
    // failure.
  }
}

export function useMixpanelIdentify() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { profile, isLoading: isProfileLoading } = useUserProfile();
  const wasAuthenticated = useRef(false);

  // Pull the specific profile fields out into local primitives so the
  // effect's deps array is a flat list of stable values. Listing
  // `profile` itself would cause a redundant `identifyUser` call every
  // time the convex query hands back a new object identity — which
  // happens on every re-render even when the field contents are
  // unchanged.
  const userId = profile?.userId ?? profile?._id ?? null;
  const email = profile?.email ?? null;
  const displayName = profile?.displayName ?? null;
  const currentOrganizationId = profile?.currentOrganizationId ?? null;
  const lastLoginMethod = profile?.lastLoginMethod ?? null;

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated) {
      if (wasAuthenticated.current) {
        // Fire signed_out exactly once on the auth → unauth transition
        // (not on every initial load while auth state resolves). This
        // is the signal retention boards use to compute session
        // lengths. Clear the session flag too so a fresh sign-in in
        // the same tab produces a fresh signed_in event.
        trackEvent(MixpanelEvent.SignedOut);
        writeSignedInUserId(null);
        resetUser();
        wasAuthenticated.current = false;
      }
      return;
    }

    if (isProfileLoading || !userId) {
      return;
    }

    // `identifyUser` is idempotent and forwards the traits to
    // `mixpanel.people.set`, so calling it on every profile field
    // change keeps Mixpanel's user profile in sync with convex
    // (email, displayName, current org). The local-primitive deps
    // mean re-runs only happen on real content changes.
    identifyUser(userId, {
      email: email ?? undefined,
      displayName: displayName ?? undefined,
      currentOrganizationId: currentOrganizationId ?? undefined,
    });

    // `signed_in` is session-scoped: fire once per browser session
    // (sessionStorage), not once per trait update. Otherwise every
    // email change / org switch would count as a fresh sign-in.
    if (readSignedInUserId() !== userId) {
      trackEvent(MixpanelEvent.SignedIn, {
        method: lastLoginMethod ?? undefined,
      });
      writeSignedInUserId(userId);
    }

    wasAuthenticated.current = true;
  }, [
    isAuthenticated,
    isLoading,
    isProfileLoading,
    userId,
    email,
    displayName,
    currentOrganizationId,
    lastLoginMethod,
  ]);
}
