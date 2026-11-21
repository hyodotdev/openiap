import { useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { ConvexError } from "convex/values";
import { api } from "@/convex";
import type { Id } from "@/convex";
import { ApprovalAlert, ApprovalCard } from "@/components/ApprovalCard";
import { ApprovalSignIn } from "@/components/ApprovalSignIn";
import { convexErrorMessage } from "@/lib/appError";
import { CONNECTOR_CHANGES, CONNECTOR_READS } from "@/lib/connectorAccess";

const NOT_COMPLETED =
  "Could not complete the connection. Start again from the app.";

/** Consent page a connector (Claude, ChatGPT) sends the user to. */
export default function OauthAuthorize() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const params = new URLSearchParams(window.location.search);
  const field = (name: string) => params.get(name) ?? undefined;
  const request = {
    responseType: field("response_type"),
    clientId: field("client_id"),
    redirectUri: field("redirect_uri"),
    codeChallenge: field("code_challenge"),
    codeChallengeMethod: field("code_challenge_method"),
    resource: field("resource"),
  };
  const details = useQuery(
    api.oauth.query.authorizationRequest,
    isAuthenticated ? { request } : "skip",
  );
  const approve = useMutation(api.oauth.mutation.approve);
  const [projectId, setProjectId] = useState<Id<"projects">>();
  const [allowChanges, setAllowChanges] = useState(false);
  // Which answer is on its way, so only Connect says "Connecting…".
  const [sending, setSending] = useState<"allow" | "deny">();
  const [error, setError] = useState<string>();

  async function respond(allow: boolean): Promise<void> {
    setSending(allow ? "allow" : "deny");
    setError(undefined);
    try {
      const { redirectTo } = await approve({
        request,
        state: field("state"),
        allow,
        projectId: selected,
        scope: allowChanges ? "write" : "read",
      });
      window.location.assign(redirectTo);
    } catch (failure) {
      // Show the server's reason when it gave one, such as a project choice.
      const data: unknown =
        failure instanceof ConvexError ? failure.data : undefined;
      setError(
        data && typeof data === "object" && "message" in data
          ? convexErrorMessage(failure)
          : NOT_COMPLETED,
      );
      setSending(undefined);
    }
  }

  const projects = details?.projects ?? [];
  const selected = projectId ?? projects[0]?.id;
  const cancel = (
    <button
      disabled={sending !== undefined}
      className="btn-secondary btn-lg"
      onClick={() => void respond(false)}
    >
      Cancel
    </button>
  );

  return (
    <ApprovalCard title="Connect to IAPKit">
      {isLoading ? (
        <p>Loading…</p>
      ) : !isAuthenticated ? (
        <ApprovalSignIn returnTo={`/oauth/authorize${window.location.search}`}>
          <p>Sign in to choose the project this app can use.</p>
        </ApprovalSignIn>
      ) : details === undefined ? (
        <p>Loading connection…</p>
      ) : details.error ? (
        <ApprovalAlert>{details.error}</ApprovalAlert>
      ) : projects.length === 0 ? (
        <>
          <p>
            You have no project to connect. Only owners and admins can connect
            an app.
          </p>
          {cancel}
        </>
      ) : (
        <>
          <p>
            <strong>{details.clientName}</strong> ({details.redirectHost}) wants
            to use one IAPKit project. Only approve a connection you started.
          </p>
          <label className="block space-y-2">
            <span className="font-medium">Project</span>
            <select
              className="w-full rounded-lg border border-border bg-background p-3"
              value={selected}
              onChange={(event) =>
                setProjectId(event.target.value as Id<"projects">)
              }
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.organizationName} / {project.name}
                </option>
              ))}
            </select>
          </label>
          <fieldset className="space-y-3">
            <legend className="mb-2 font-medium">Access</legend>
            <p className="text-sm text-muted-foreground">
              Reads {CONNECTOR_READS}.
            </p>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 has-checked:border-primary has-checked:bg-primary/5">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 accent-primary"
                checked={allowChanges}
                onChange={(event) => setAllowChanges(event.target.checked)}
              />
              <span className="space-y-1">
                <span className="block font-medium">Also allow changes</span>
                <span className="block text-sm text-muted-foreground">
                  It can {CONNECTOR_CHANGES}.
                </span>
              </span>
            </label>
          </fieldset>
          <div className="flex gap-3 flex-wrap">
            <button
              disabled={sending !== undefined}
              className="btn-gradient btn-lg"
              onClick={() => void respond(true)}
            >
              {sending === "allow" ? "Connecting…" : "Connect"}
            </button>
            {cancel}
          </div>
        </>
      )}
      {error && <ApprovalAlert>{error}</ApprovalAlert>}
    </ApprovalCard>
  );
}
