import { createMiddleware } from "hono/factory";

const MAX_API_KEY_LENGTH = 128;

function isValidApiKeyLength(apiKey: string): boolean {
  return apiKey.length <= MAX_API_KEY_LENGTH;
}

export function apiKeyValidationError(
  apiKey: string | undefined,
): string | null {
  if (!apiKey?.trim()) return "API key is required";
  if (/\s/.test(apiKey)) return "API key is malformed";
  if (!isValidApiKeyLength(apiKey)) return "API key is too long";
  return null;
}

export function isSecretApiKey(apiKey: string | undefined): apiKey is string {
  return apiKey?.startsWith("openiap-kit_sk_") === true;
}

export function isPublishableApiKey(apiKey: string | undefined): boolean {
  return apiKey?.startsWith("openiap-kit_pk_") === true;
}

export const apiKeyMiddleware = createMiddleware<{
  Variables: {
    apiKey: string;
  };
}>(async (c, next) => {
  const token = c.req.header("Authorization");

  if (!token) {
    return c.json(
      {
        errors: [
          {
            code: "MISSING_API_KEY",
            message:
              'An API key must be provided in the Authorization header in the format "Bearer api-key"',
          },
        ],
      },
      401,
    );
  }

  // Split on any run of whitespace rather than a single space so valid
  // `Bearer  <key>` / leading-whitespace headers aren't rejected.
  const parts = token.trim().split(/\s+/);

  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    // 403 (not 401): the caller presented credentials, they were just
    // in the wrong format / scheme. Keeps the wire contract aligned
    // with the OpenAPI spec in `routes.ts` which documents 401 for
    // missing tokens and 403 for invalid tokens.
    return c.json(
      {
        errors: [
          {
            code: "INVALID_API_KEY",
            message:
              'An API key must be provided in the Authorization header in the format "Bearer api-key"',
          },
        ],
      },
      403,
    );
  }

  const validationError = apiKeyValidationError(parts[1]);
  if (validationError) {
    return c.json(
      {
        errors: [
          {
            code: "INVALID_API_KEY",
            message: validationError,
          },
        ],
      },
      403,
    );
  }

  c.set("apiKey", parts[1]);

  await next();
});

/**
 * Rejects an explicitly publishable credential before an administrative
 * handler can read or mutate project data.
 *
 * The prefix is only an early-deny signal. Unknown and legacy key formats
 * still reach Convex, where the stored key type is authoritative and legacy
 * keys fail closed as publishable.
 */
export const secretAdminApiKeyMiddleware = createMiddleware<{
  Variables: {
    apiKey: string;
  };
}>(async (c, next) => {
  // Administrative responses may contain private catalog, entitlement, or
  // analytics data. Never let a browser/CDN shared cache retain them.
  c.header("Cache-Control", "private, no-store");
  if (isPublishableApiKey(c.var.apiKey)) {
    return c.json(
      {
        errors: [
          {
            code: "INSUFFICIENT_SCOPE",
            message:
              "This operation requires a secret admin key. Publishable mobile keys cannot access administrative operations.",
          },
        ],
      },
      403,
    );
  }

  await next();
});
