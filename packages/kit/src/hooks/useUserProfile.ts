import { useQuery } from "convex/react";
import { api } from "@/convex";

export function useUserProfile() {
  const profile = useQuery(api.userProfiles.query.getCurrentUserProfile);
  const stats = useQuery(api.userProfiles.query.getUserStats);

  const isLoading = profile === undefined || stats === undefined;
  // `getCurrentUserProfile` + `getUserStats` both return `null` for
  // unauthenticated users AND for authenticated users whose profile row
  // hasn't been created yet — we can't tell those apart client-side, so
  // surfacing "Profile not found" to the logged-out case is wrong. Treat
  // the paired-null case as "no session" (no error) and leave the error
  // slot reserved for future explicit error reporting from the backend.
  const isSignedOut = !isLoading && profile === null && stats === null;

  return {
    profile,
    stats,
    isLoading,
    isSignedOut,
    error: null as string | null,
  };
}
