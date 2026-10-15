// Wire format of the app-facing `GET /v1/products/{apiKey}/{productId}/client-payload`.
// The Hono route and the dashboard's SDK preview both build responses here, so
// the preview shows the exact bytes, headers, and ETag an app receives.

export type PublicClientPayload = {
  format: string;
  body: string;
  version: number;
  updatedAt: number;
};

export type PublicClientPayloadResult =
  | { status: "found"; clientPayload: PublicClientPayload }
  | { status: "not_modified"; version: number }
  | { status: "not_found" };

export type PublicClientPayloadResponse = {
  status: 200 | 304 | 404;
  headers: Record<string, string>;
  body: string;
};

// Project-scoped app data: a device may keep it but must revalidate, and a
// shared cache must not serve one project's payload to another.
export const PUBLIC_CLIENT_PAYLOAD_CACHE_HEADERS = {
  "Cache-Control": "private, no-cache",
  Vary: "Authorization",
} as const;

export async function clientPayloadEtagScope(
  apiKey: string,
  platform: "IOS" | "Android",
  productId: string,
): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${apiKey}\0${platform}\0${productId}`),
  );
  return base64Url(new Uint8Array(digest)).slice(0, 16);
}

export function clientPayloadEtag(scope: string, version: number): string {
  return `"iapkit-client-payload-${scope}-v${version}"`;
}

export function clientPayloadKnownVersion(
  ifNoneMatch: string | undefined,
  scope: string,
): number | undefined {
  if (!ifNoneMatch) return undefined;
  const pattern = new RegExp(
    `^(?:W/)?"iapkit-client-payload-${scope}-v(\\d+)"$`,
  );
  for (const candidate of ifNoneMatch.split(",")) {
    const match = candidate.trim().match(pattern);
    if (!match?.[1]) continue;
    const version = Number(match[1]);
    if (Number.isSafeInteger(version) && version >= 1) return version;
  }
  return undefined;
}

export function buildPublicClientPayloadResponse(
  result: PublicClientPayloadResult,
  scope: string,
): PublicClientPayloadResponse {
  switch (result.status) {
    case "found":
      return {
        status: 200,
        headers: {
          ...PUBLIC_CLIENT_PAYLOAD_CACHE_HEADERS,
          "Content-Type": "application/json",
          ETag: clientPayloadEtag(scope, result.clientPayload.version),
        },
        body: JSON.stringify({
          clientPayload: {
            format: result.clientPayload.format,
            body: result.clientPayload.body,
            version: result.clientPayload.version,
            updatedAt: result.clientPayload.updatedAt,
          },
        }),
      };
    case "not_modified":
      return {
        status: 304,
        headers: {
          ...PUBLIC_CLIENT_PAYLOAD_CACHE_HEADERS,
          ETag: clientPayloadEtag(scope, result.version),
        },
        body: "",
      };
    case "not_found":
      return {
        status: 404,
        headers: {
          ...PUBLIC_CLIENT_PAYLOAD_CACHE_HEADERS,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          errors: [
            { code: "NOT_FOUND", message: "Product client payload not found" },
          ],
        }),
      };
  }
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
