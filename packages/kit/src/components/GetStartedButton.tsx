import { useConvexAuth } from "convex/react";
import { Link } from "react-router-dom";

import { openAuthModal } from "../lib/signals";

/** Opens sign-in, or the dashboard for a visitor who is already signed in. */
export default function GetStartedButton({
  className,
  onClick,
}: {
  className: string;
  onClick?: () => void;
}) {
  const { isAuthenticated } = useConvexAuth();
  return isAuthenticated ? (
    <Link to="/" onClick={onClick} className={className}>
      {"Open dashboard"}
    </Link>
  ) : (
    <button
      type="button"
      onClick={() => {
        onClick?.();
        openAuthModal();
      }}
      className={className}
    >
      {"Get started"}
    </button>
  );
}
