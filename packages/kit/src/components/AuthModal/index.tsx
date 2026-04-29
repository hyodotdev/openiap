import React, { useCallback, useState, useEffect, useRef } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvex } from "convex/react";
import { Loader2, Check, AlertCircle, AtSign, Send } from "lucide-react";
import { SiGithub } from "@icons-pack/react-simple-icons";
import { useNavigate } from "react-router-dom";
import { api } from "@/convex";
import { Modal } from "./Modal";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// UI states:
//   "github"     — default, primary GitHub sign-in button + secondary link
//                  to reveal email path
//   "emailInput" — existing-user email path: enter email, gets gated by
//                  canSignInWithEmail query, then OTP send
//   "emailVerify" — OTP input after a successful send
type AuthView = "github" | "emailInput" | "emailVerify";

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { signIn } = useAuthActions();
  const navigate = useNavigate();
  const convex = useConvex();

  const [view, setView] = useState<AuthView>("github");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      if (view === "emailInput" && emailInputRef.current) {
        emailInputRef.current.focus({ preventScroll: true });
      } else if (view === "emailVerify" && otpInputRef.current) {
        otpInputRef.current.focus({ preventScroll: true });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [isOpen, view]);

  const handleReset = useCallback(() => {
    setView("github");
    setEmail("");
    setOtp("");
    setError("");
    setIsOtpSent(false);
    setIsAuthenticating(false);
  }, []);

  // `handleClose` is passed to <Modal onClose> and Modal re-subscribes
  // its Escape / click-outside listeners whenever that prop changes.
  // Without useCallback, setState in the email input (every keystroke)
  // would give Modal a new function reference, tear down + re-arm the
  // effect, and the re-mount logic steals focus back to the dialog
  // root — cursor jumps out of the input after every character.
  const handleClose = useCallback(() => {
    if (isAuthenticating) return;
    handleReset();
    onClose();
  }, [isAuthenticating, handleReset, onClose]);

  const getOtpProvider = () => "resend-otp-en";

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Pre-flight gate: confirm this email belongs to an existing
      // user. Prevents us from paying Resend to send an OTP that
      // would be rejected server-side anyway (new signups must go
      // through GitHub). Also catches the common "I forgot I had a
      // GitHub-only account on this email" case with a clearer
      // error message.
      const exists = await convex.query(api.users.query.canSignInWithEmail, {
        email,
      });
      if (!exists) {
        setError(
          "No account found for this email. New accounts now use GitHub sign-in — please continue with GitHub above.",
        );
        setIsLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append("email", email);
      await signIn(getOtpProvider(), formData);
      setIsOtpSent(true);
      setView("emailVerify");
    } catch (err: any) {
      if (
        err.message?.includes("service") ||
        err.message?.includes("trouble sending")
      ) {
        setError(
          "Our email service is temporarily unavailable. Please try again later or use GitHub sign in.",
        );
      } else if (
        err.message?.includes("too many") ||
        err.message?.includes("rate limit")
      ) {
        setError(
          "Too many attempts. Please wait a few minutes before trying again.",
        );
      } else {
        setError(
          err.message ||
            "Unable to send verification code. Please try again in a moment.",
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setIsAuthenticating(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("code", otp);
      await signIn(getOtpProvider(), formData);
      setTimeout(() => {
        void navigate("/");
        handleClose();
      }, 500);
    } catch (err: any) {
      setIsAuthenticating(false);
      if (err.message?.includes("Invalid code")) {
        setError("Invalid verification code. Please check and try again.");
      } else {
        setError(err.message || "Verification failed. Please try again.");
      }
      setIsLoading(false);
    }
  };

  const handleGithubSignIn = async () => {
    setIsLoading(true);
    setIsAuthenticating(true);
    setError("");

    try {
      sessionStorage.setItem("github_auth_pending", "true");
      await signIn("github");
    } catch (err: any) {
      sessionStorage.removeItem("github_auth_pending");
      setIsAuthenticating(false);
      if (
        err.message?.includes("service") ||
        err.message?.includes("unavailable")
      ) {
        setError(
          "Our email service is temporarily unavailable. Please try again later or use GitHub sign in.",
        );
      } else {
        setError(
          err.message ||
            "GitHub sign in is temporarily unavailable. Please try again later.",
        );
      }
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div
        className={`space-y-6 transition-opacity duration-200 ${isAuthenticating ? "opacity-75" : "opacity-100"}`}
      >
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            {"Sign in to IAPKit"}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {"Manage your in-app purchases and tax compliance"}
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Default: GitHub primary. We dropped the dual-tab layout on
            2026-04-22 so new signups can only ever land on GitHub; the
            email path is only surfaced through the secondary link below
            and gated by canSignInWithEmail. */}
        {view === "github" && (
          <div className="space-y-4">
            <button
              onClick={() => {
                void handleGithubSignIn();
              }}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-[#24292e] dark:bg-[#24292e] hover:bg-[#1b1f23] dark:hover:bg-[#1b1f23] text-white rounded-lg font-medium transition-colors shadow-sm hover:shadow-md"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {"Connecting to GitHub..."}
                </>
              ) : (
                <>
                  <SiGithub className="h-5 w-5" />
                  {"Continue with GitHub"}
                </>
              )}
            </button>

            <p className="text-xs text-center text-gray-500 dark:text-gray-400">
              {"You'll be redirected to GitHub to authorize IAPKit"}
            </p>

            {/* Divider + email-legacy escape hatch. Kept low-key so new
                users gravitate toward GitHub, while the ~110 existing
                email-only accounts still have an obvious path in. */}
            <div className="relative pt-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200 dark:border-gray-700" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-white dark:bg-gray-900 px-3 text-gray-500 dark:text-gray-400">
                  {"or"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setError("");
                setView("emailInput");
              }}
              className="w-full text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
              disabled={isLoading}
            >
              {"Have an existing email account? Sign in with email code →"}
            </button>
          </div>
        )}

        {/* Existing-user email path. The server-side
            createOrUpdateUser callback rejects any resend-otp attempt
            for a brand-new email, and `canSignInWithEmail` gates
            the send here before we even hit Resend. */}
        {view === "emailInput" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSendOtp(e);
            }}
            className="space-y-4"
          >
            <div className="rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 p-3 text-xs text-amber-900 dark:text-amber-100">
              {
                "New signups use GitHub. Email sign-in is kept active for existing email accounts only — link your GitHub from Profile to unify."
              }
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                {"Email address"}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <AtSign className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  ref={emailInputRef}
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={"you@example.com"}
                  className="input w-full pl-10"
                  required
                  autoFocus={false}
                  disabled={isLoading}
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn-gradient w-full justify-center gap-2"
              disabled={isLoading || !email}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {"Sending..."}
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  {"Send verification code"}
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                setError("");
                setView("github");
              }}
              className="w-full text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors"
              disabled={isLoading}
            >
              {"← Back to GitHub sign-in"}
            </button>
          </form>
        )}

        {view === "emailVerify" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleVerifyOtp(e);
            }}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="otp"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                {"Verification code"}
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                {"We sent a code to"}{" "}
                <span className="font-medium">{email}</span>
              </p>
              <input
                ref={otpInputRef}
                id="otp"
                type="text"
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))
                }
                placeholder="00000000"
                className="input w-full text-center text-2xl tracking-[0.5em] font-mono"
                required
                autoFocus={false}
                maxLength={8}
                disabled={isLoading}
              />
            </div>

            {isOtpSent && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <Check className="h-4 w-4" />
                <span>
                  {"We sent a code to"} {email}
                </span>
              </div>
            )}

            <div className="space-y-3">
              <button
                type="submit"
                className="btn-gradient w-full justify-center"
                disabled={isLoading || otp.length !== 8}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {"Verifying..."}
                  </>
                ) : (
                  "Verify & Sign in"
                )}
              </button>

              <div className="flex items-center gap-4 text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setView("emailInput");
                    setOtp("");
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                  disabled={isLoading}
                >
                  {"Change email"}
                </button>
                <span className="text-gray-400">·</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    void handleSendOtp(e);
                  }}
                  className="text-accent hover:text-accent/80 transition-colors"
                  disabled={isLoading}
                >
                  {"Resend code"}
                </button>
              </div>
            </div>
          </form>
        )}

        <div className="pt-4 border-t border-gray-200 dark:border-gray-700 text-center text-xs text-gray-500 dark:text-gray-400">
          {"By signing in, you agree to our"}{" "}
          <a
            href="/terms-of-service"
            className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
          >
            {"Terms of Service"}
          </a>{" "}
          {"and"}{" "}
          <a
            href="/privacy-policy"
            className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
          >
            {"Privacy Policy"}
          </a>
        </div>
      </div>
    </Modal>
  );
}
