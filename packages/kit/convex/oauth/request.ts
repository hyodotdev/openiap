import { v, type Infer } from "convex/values";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { oauthClientName, oauthResource } from "./clients";

export const BROWSER_ONLY =
  "Approve connectors from an interactive browser session.";

/** Connectors are approved from a browser, never from a CLI session. */
export async function isCliIdentity(
  ctx: QueryCtx | MutationCtx,
): Promise<boolean> {
  return (await ctx.auth.getUserIdentity())?.iapkitCli === true;
}

export const authorizationRequestValidator = v.object({
  responseType: v.optional(v.string()),
  clientId: v.optional(v.string()),
  redirectUri: v.optional(v.string()),
  codeChallenge: v.optional(v.string()),
  codeChallengeMethod: v.optional(v.string()),
  resource: v.optional(v.string()),
});
type AuthorizationRequest = Infer<typeof authorizationRequestValidator>;

/**
 * Checks an authorization request before anything is shown or redirected.
 * A failure here is reported on the page: the redirect URI is not yet trusted.
 */
export function checkAuthorizationRequest(request: AuthorizationRequest):
  | { ok: false; error: string }
  | {
      ok: true;
      clientId: string;
      clientName: string;
      redirectUri: string;
      codeChallenge: string;
    } {
  const { clientId, redirectUri, codeChallenge } = request;
  const clientName =
    clientId && redirectUri ? oauthClientName(clientId, redirectUri) : null;
  if (!clientId || !redirectUri || !clientName)
    return {
      ok: false,
      error:
        "This app is not on IAPKit's connector list. Connect it with a secret key instead.",
    };
  if (request.responseType !== "code")
    return { ok: false, error: "Only the authorization code flow is offered." };
  if (
    request.codeChallengeMethod !== "S256" ||
    !codeChallenge ||
    !/^[A-Za-z0-9_-]{43}$/.test(codeChallenge)
  )
    return { ok: false, error: "A PKCE S256 code challenge is required." };
  if (request.resource !== undefined && request.resource !== oauthResource())
    return {
      ok: false,
      error: "This request is for a different MCP server.",
    };
  return { ok: true, clientId, clientName, redirectUri, codeChallenge };
}
