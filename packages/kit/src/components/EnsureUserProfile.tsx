import { useEffect, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex";
import { Loader2 } from "lucide-react";
interface EnsureUserProfileProps {
  children: React.ReactNode;
}

export function EnsureUserProfile({ children }: EnsureUserProfileProps) {
  const ensureUserProfile = useMutation(
    api.userProfiles.mutation.ensureUserProfile,
  );
  const [isEnsuring, setIsEnsuring] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Ref-based guard so React Strict Mode's double-mount in development
  // doesn't fire `ensureUserProfile()` twice (state updates from the first
  // mount aren't visible to the second mount).
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    const ensureProfile = async () => {
      try {
        // Convex mutations only resolve after the write is committed,
        // and any subsequent `useQuery(userProfile...)` inside children
        // picks the new row up reactively — no artificial delay needed.
        await ensureUserProfile();
        setIsEnsuring(false);
      } catch (err) {
        console.error("Failed to ensure user profile:", err);
        setError(
          "Failed to create user profile. Please try refreshing the page.",
        );
        setIsEnsuring(false);
      }
    };

    void ensureProfile();
  }, [ensureUserProfile]);

  if (isEnsuring) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {"Setting up your profile..."}
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <div className="text-destructive">
            <svg
              className="h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-foreground">
            {"Profile Setup Error"}
          </h3>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-gradient mt-2"
          >
            {"Refresh Page"}
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
