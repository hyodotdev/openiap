import { useState, useEffect } from "react";
import { Authenticated, Unauthenticated, useConvexAuth } from "convex/react";
import { Toaster } from "sonner";
import { EnsureUserProfile } from "./EnsureUserProfile";
import PublicPages from "../pages";
import AuthenticatedPages from "../pages/auth";

// Wrapper component to ensure background is always visible
function BackgroundWrapper({ children }: { children: React.ReactNode }) {
  // Initialize with current theme
  const getInitialBgColor = () => {
    if (typeof document !== "undefined" && document.documentElement) {
      const isDark = document.documentElement.classList.contains("dark");
      return isDark ? "#18181B" : "#fefefe";
    }
    return "#fefefe";
  };

  const [bgColor, setBgColor] = useState(getInitialBgColor);

  useEffect(() => {
    const updateBgColor = () => {
      if (document.documentElement) {
        const isDark = document.documentElement.classList.contains("dark");
        setBgColor(isDark ? "#18181B" : "#fefefe");
      }
    };

    // Watch for theme changes
    const observer = new MutationObserver(updateBgColor);
    if (document.documentElement) {
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
      });
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="min-h-screen bg-background"
      style={{
        backgroundColor: bgColor,
        minHeight: "100vh",
        width: "100%",
        position: "relative",
      }}
    >
      {children}
    </div>
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
            <Toaster />
          </EnsureUserProfile>
        </BackgroundWrapper>
      </Authenticated>
    );
  }

  return (
    <Unauthenticated>
      <BackgroundWrapper>
        <PublicPages />
        <Toaster />
      </BackgroundWrapper>
    </Unauthenticated>
  );
}
