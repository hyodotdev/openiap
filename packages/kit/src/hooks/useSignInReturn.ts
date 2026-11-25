import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  clearSignInReturn,
  isApprovalPage,
  SIGN_IN_UNFINISHED,
  takeSignInReturn,
} from "@/lib/signInReturn";

/** Sends a failed approval-page sign-in back to the page it started from. */
export function useSignInReturn(): void {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // A failed GitHub callback lands on the bare home page.
    if (pathname === "/" && !search) {
      const path = takeSignInReturn();
      if (path)
        void navigate(path, { replace: true, state: SIGN_IN_UNFINISHED });
    } else if (isApprovalPage(pathname)) {
      clearSignInReturn();
    }
  }, [pathname, search, navigate]);

  useEffect(() => {
    // Back from GitHub to the approval page: the sign-in was abandoned.
    const onShow = () => {
      if (isApprovalPage(window.location.pathname)) clearSignInReturn();
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
}
