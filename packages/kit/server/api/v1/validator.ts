import type { Context, MiddlewareHandler } from "hono";
import { resolver, uniqueSymbol } from "hono-openapi";

import {
  isContentLengthOverLimit,
  JsonBodyTooLargeError,
  readJsonBodyWithLimit,
} from "./request-body";

// Keep this JSON validator local instead of delegating to
// hono-openapi's validator: Hono's built-in JSON parser reads the
// whole body before schema validation, while verify requests need an
// edge cap before parsing. We still attach hono-openapi's metadata so
// generated OpenAPI request schemas keep working.
type ValidatorIssue = { message: string; path?: ReadonlyArray<unknown> };
type ValidatorSchema = Parameters<typeof resolver>[0];
type ValidatorResult<Output> =
  | { success: true; data: unknown }
  | { success: false; error: ReadonlyArray<ValidatorIssue>; data: unknown }
  | { issues: ReadonlyArray<ValidatorIssue> }
  | { value: Output };

const MAX_VALIDATOR_JSON_BODY_BYTES = 32 * 1024;

export function validator<Schema extends ValidatorSchema>(schema: Schema) {
  const middleware: MiddlewareHandler = async (c, next) => {
    let value: unknown = {};
    const contentType = c.req.header("content-type");
    if (isJsonContentType(contentType)) {
      if (
        isContentLengthOverLimit(
          c.req.header("content-length"),
          MAX_VALIDATOR_JSON_BODY_BYTES,
        )
      ) {
        return payloadTooLarge(c, "Request body is too large");
      }
      try {
        value = await readJsonBodyWithLimit(
          c.req.raw,
          MAX_VALIDATOR_JSON_BODY_BYTES,
          "Request body is too large",
        );
      } catch (error) {
        if (error instanceof JsonBodyTooLargeError) {
          return payloadTooLarge(c, error.message);
        }
        return c.json(
          { errors: [{ code: "INVALID_INPUT", message: "Body is not JSON" }] },
          400,
        );
      }
    }

    const result = (await schema["~standard"].validate(
      value,
    )) as ValidatorResult<unknown>;
    if ("issues" in result && result.issues) {
      return validationError(c, value, result.issues);
    }
    if ("success" in result && result.success === false) {
      return validationError(c, result.data, result.error);
    }

    const data =
      "success" in result && result.success === true
        ? result.data
        : "value" in result
          ? result.value
          : value;
    c.req.addValidatedData("json", data as Record<string, unknown>);
    return next();
  };

  return Object.assign(middleware, {
    [uniqueSymbol]: {
      target: "json",
      ...resolver(schema),
    },
  });
}

function payloadTooLarge(c: Context, message: string) {
  return c.json(
    {
      errors: [{ code: "PAYLOAD_TOO_LARGE", message }],
    },
    413,
  );
}

function isJsonContentType(contentType: string | undefined): boolean {
  if (!contentType) {
    return false;
  }
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase();
  return (
    mediaType === "application/json" ||
    Boolean(
      mediaType?.startsWith("application/") && mediaType.endsWith("+json"),
    )
  );
}

function validationError(
  c: Context,
  _data: unknown,
  issues: ReadonlyArray<ValidatorIssue>,
) {
  const errors = [];

  for (const issue of issues) {
    errors.push({
      code: "INVALID_INPUT",
      message: issue.message,
      path: issuePathToString(issue.path),
    });
  }

  return c.json({ errors }, 400);
}

function issuePathToString(
  path: ReadonlyArray<unknown> | undefined,
): string | undefined {
  if (!path || path.length === 0) {
    return undefined;
  }

  const segments: string[] = [];
  for (const segment of path) {
    if (typeof segment === "string") {
      segments.push(segment);
      continue;
    }

    if (typeof segment === "number") {
      segments.push(String(segment));
      continue;
    }

    // Null slips past `typeof === "object"` and would throw on
    // `.key` / `.toString()`; guard explicitly. Unknown segment shapes
    // are dropped rather than stringified to `""` — otherwise a
    // path like `["a", unknown, "b"]` would serialize to `"a..b"`
    // and break client-side error mapping.
    if (segment !== null && typeof segment === "object" && "key" in segment) {
      const key = segment.key;
      if (typeof key === "string") {
        segments.push(key);
      } else if (typeof key === "number") {
        segments.push(String(key));
      }
    }
  }

  if (segments.length === 0) {
    return undefined;
  }

  return segments.join(".");
}
