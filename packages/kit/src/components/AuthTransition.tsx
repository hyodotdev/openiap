import { useState, useEffect } from "react";
import { Authenticated, Unauthenticated, useConvexAuth } from "convex/react";
import { Toaster } from "sonner";
import { EnsureUserProfile } from "./EnsureUserProfile";
import PublicPages from "../pages";
import AuthenticatedPages from "../pages/auth";

function BackgroundWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full bg-background">{children}</div>
  );
}

export function AuthTransition() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show loading state while auth is being determined or not mounted
  if (isLoading || !mounted) {
    return (
      <BackgroundWrapper>
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">{"Loading..."}</p>
          </div>
        </div>
      </BackgroundWrapper>
    );
  }

  // Use isAuthenticated directly instead of separate state
  if (isAuthenticated) {
    return (
      <Authenticated>
        <BackgroundWrapper>
          <EnsureUserProfile>
            <AuthenticatedPages />
            <Toaster closeButton />
          </EnsureUserProfile>
        </BackgroundWrapper>
      </Authenticated>
    );
  }

  return (
    <Unauthenticated>
      <BackgroundWrapper>
        <PublicPages />
        <Toaster closeButton />
      </BackgroundWrapper>
    </Unauthenticated>
  );
}
