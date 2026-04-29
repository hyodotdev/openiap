import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const navigate = useNavigate();

  if (!isAuthenticated) {
    return null;
  }

  const handleSignOut = async () => {
    await signOut();
    void navigate("/");
  };

  return (
    <button
      className="btn-ghost gap-2 text-sm"
      onClick={() => void handleSignOut()}
    >
      <LogOut className="w-4 h-4" />
      <span className="hidden sm:inline">{"Sign Out"}</span>
    </button>
  );
}
