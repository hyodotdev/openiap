import { useState } from "react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "@/convex";

export default function CliAuthorize() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn } = useAuthActions();
  const code =
    new URLSearchParams(window.location.search).get("user_code") ?? "";
  const device = useQuery(
    api.cli.query.device,
    isAuthenticated ? { userCode: code } : "skip",
  );
  const approve = useMutation(api.cli.mutation.approve);
  const [result, setResult] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function respond(allow: boolean): Promise<void> {
    setBusy(true);
    setError(undefined);
    try {
      const response = await approve({ userCode: code, allow });
      if (response.error) {
        setError(response.error);
        return;
      }
      setResult(
        allow ? "Connected. Return to your terminal." : "Connection denied.",
      );
    } catch {
      setError(
        "This code is invalid, expired, or already used. Start login again in your terminal.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <section className="max-w-lg w-full rounded-xl border border-border p-8 space-y-6">
        <h1 className="text-2xl font-semibold">Connect OpenIAP CLI</h1>
        <p>
          Only approve a connection you started. Check that this code matches
          your terminal.
        </p>
        <p
          className="font-mono text-3xl tracking-widest break-all"
          aria-label="Verification code"
        >
          {code}
        </p>
        {result ? (
          <p role="status">{result}</p>
        ) : isLoading ? (
          <p>Loading…</p>
        ) : !isAuthenticated ? (
          <button
            className="btn-gradient px-5 py-3"
            onClick={() =>
              void signIn("github", {
                redirectTo: `/cli/authorize?user_code=${encodeURIComponent(code)}`,
              }).catch(() => setError("GitHub sign-in failed. Try again."))
            }
          >
            Sign in with GitHub
          </button>
        ) : device === undefined ? (
          <p>Loading connection…</p>
        ) : !device || device.used ? (
          <p>This code is invalid or already used. Start login again.</p>
        ) : (
          <>
            <dl className="space-y-2">
              <dt>Device</dt>
              <dd className="break-all">{device.name}</dd>
              <dt>Access</dt>
              <dd>{device.scope} — your organization roles still apply</dd>
            </dl>
            <div className="flex gap-4 flex-wrap">
              <button
                disabled={busy}
                className="btn-gradient px-5 py-3"
                onClick={() => void respond(true)}
              >
                Approve connection
              </button>
              <button
                disabled={busy}
                className="px-5 py-3 border rounded-lg"
                onClick={() => void respond(false)}
              >
                Deny
              </button>
            </div>
          </>
        )}
        {error && <p role="alert">{error}</p>}
      </section>
    </main>
  );
}
