import { useState, type ReactNode } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useLocation } from "react-router-dom";

import { ApprovalAlert } from "@/components/ApprovalCard";
import {
  clearSignInReturn,
  isSignInUnfinished,
  rememberSignInReturn,
} from "@/lib/signInReturn";

/** GitHub sign-in for an approval page; comes back to `returnTo`. */
export function ApprovalSignIn({
  returnTo,
  children,
}: {
  returnTo: string;
  children?: ReactNode;
}) {
  const { signIn } = useAuthActions();
  const unfinished = isSignInUnfinished(useLocation().state);
  const [error, setError] = useState<string>();

  return (
    <>
      {unfinished && (
        <ApprovalAlert>
          GitHub sign-in did not finish. Sign in again.
        </ApprovalAlert>
      )}
      {children}
      <button
        className="btn-gradient btn-lg"
        onClick={() => {
          rememberSignInReturn(returnTo);
          void signIn("github", { redirectTo: returnTo }).catch(() => {
            clearSignInReturn();
            setError("GitHub sign-in failed. Try again.");
          });
        }}
      >
        Sign in with GitHub
      </button>
      {error && <ApprovalAlert>{error}</ApprovalAlert>}
    </>
  );
}
