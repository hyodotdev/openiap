import { useConvexAuth } from "convex/react";

/**
 * Signed-in visitors to "/" go to their dashboard, so the landing page's
 * Features section is only linked for signed-out visitors.
 */
export function useShowsLandingFeatures(): boolean {
  return !useConvexAuth().isAuthenticated;
}
