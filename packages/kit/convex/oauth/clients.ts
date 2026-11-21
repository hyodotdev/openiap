import { v, type Infer } from "convex/values";
import { publicBaseUrl } from "../utils/helpers";

export const OAUTH_SCOPES = ["iapkit:read", "iapkit:write"] as const;
export const oauthScopeValidator = v.union(
  v.literal("read"),
  v.literal("write"),
);
export type OauthScope = Infer<typeof oauthScopeValidator>;

/**
 * Connectors that may sign users in, pinned to the redirect URI each one's
 * Client ID Metadata Document registers, so a code only ever goes there.
 * ChatGPT's per-app documents register the callback with the same id.
 */
const CLIENTS: readonly {
  name: string;
  clientId: RegExp;
  redirectUri: (match: RegExpExecArray) => string;
}[] = [
  {
    name: "Claude",
    clientId: /^https:\/\/claude\.ai\/oauth\/mcp-oauth-client-metadata$/,
    redirectUri: () => "https://claude.ai/api/mcp/auth_callback",
  },
  {
    name: "ChatGPT",
    clientId: /^https:\/\/chatgpt\.com\/oauth\/client\.json$/,
    redirectUri: () => "https://chatgpt.com/connector_platform_oauth_redirect",
  },
  {
    name: "ChatGPT",
    clientId: /^https:\/\/chatgpt\.com\/oauth\/([\w-]{1,128})\/client\.json$/,
    redirectUri: ([, callbackId]) =>
      `https://chatgpt.com/connector/oauth/${callbackId}`,
  },
];

export function oauthClientName(
  clientId: string,
  redirectUri: string,
): string | null {
  for (const client of CLIENTS) {
    const match = client.clientId.exec(clientId);
    if (match && client.redirectUri(match) === redirectUri) return client.name;
  }
  return null;
}

/** The OAuth issuer is IAPKit's public origin. */
export const oauthIssuer = publicBaseUrl;

export function oauthResource(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  return `${oauthIssuer(env)}/mcp`;
}

export function scopeString(scope: OauthScope): string {
  return (scope === "write" ? OAUTH_SCOPES : OAUTH_SCOPES.slice(0, 1)).join(
    " ",
  );
}
