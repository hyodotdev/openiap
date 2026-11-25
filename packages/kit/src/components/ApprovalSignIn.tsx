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
}): React.JSX.Element {
  const { signIn } = useAuthActions();
  const unfinished = isSignInUnfinished(useLocation().state);
  const [error, setError] = useState<string>();
  // One sign-in at a time; a success leaves the page, a failure re-enables it.
  const [pending, setPending] = useState(false);

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
        disabled={pending}
        onClick={() => {
          setPending(true);
          setError(undefined);
          rememberSignInReturn(returnTo);
          void signIn("github", { redirectTo: returnTo }).catch(() => {
            clearSignInReturn();
            setError("GitHub sign-in failed. Try again.");
            setPending(false);
          });
        }}
      >
        {pending ? "Signing in…" : "Sign in with GitHub"}
      </button>
      {error && <ApprovalAlert>{error}</ApprovalAlert>}
    </>
  );
}
