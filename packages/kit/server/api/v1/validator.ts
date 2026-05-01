import { validator as honoValidator } from "hono-openapi";

// Hono-openapi's Hook callback signature gets re-derived from a generic
// chain that resolves slightly differently depending on which hoisted
// copy of hono-openapi tsc picks up (Bun installs multiple peer-dep
// variants under node_modules/.bun). Cast to a stable narrow shape so
// the file typechecks the same on every install layout — without this,
// tsc reports `result` and `c` as implicit `any` on a fresh install.
type ValidatorIssue = { message: string; path?: ReadonlyArray<unknown> };
type ValidatorResult =
  | { success: true; data: unknown }
  | { success: false; error: ReadonlyArray<ValidatorIssue>; data: unknown };

export function validator<Schema extends Parameters<typeof honoValidator>[1]>(
  schema: Schema,
) {
  return honoValidator(
    "json",
    schema,
    (
      result: ValidatorResult,
      // Hono context is typed as `any`-generic here intentionally — see
      // comment above. We use only `c.json(...)`, which is stable.
      c: { json: (body: unknown, status: number) => Response },
    ) => {
      if (result.success) {
        return;
      }

      const errors = [];

      for (const issue of result.error) {
        errors.push({
          code: "INVALID_INPUT",
          message: issue.message,
          path: issuePathToString(issue.path),
        });
      }

      return c.json({ errors }, 400);
    },
  );
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
