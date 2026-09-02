// The portable GraphQL binding: one POST endpoint executing the generated
// schema projection. Resolvers only adapt transport — auth context, variable
// unpacking, and error mapping — and delegate to the shared handlers.

import {
  buildSchema,
  execute,
  GraphQLError,
  Kind,
  OperationTypeNode,
  parse,
  validate,
  type DocumentNode,
  type OperationDefinitionNode,
  type SelectionSetNode,
} from "graphql";
import HTTP_BINDING from "openiap-commerce-protocol/generated/bindings/http-binding.json";
import operationsSdl from "openiap-commerce-protocol/generated/bindings/operations-sdl.json";

import { ProtocolOperationError } from "./errors";
import * as handlers from "./handlers";
import type { ProtocolContext } from "./handlers";
import { validateOperationInput } from "./validation";

// The projection is generated from the SDL; serving anything else would fail
// the introspection-agreement rule in SPEC.md 7.
export const commerceGraphqlSchema = buildSchema(operationsSdl.sdl);

// Bounds chosen far above the canonical documents and the standard
// introspection query, far below anything abusive.
const MAX_QUERY_DEPTH = 20;
const MAX_FIELD_NODES = 1_000;

type CommerceRole = "none" | "verification" | "server";

export interface GraphqlRequestContext {
  role: CommerceRole | null;
  apiKey?: string;
  requestIp?: string;
}

const operationAuth = new Map(
  HTTP_BINDING.operations.map((operation) => [operation.name, operation.auth]),
);

function assertRole(operationName: string, context: GraphqlRequestContext) {
  const required = operationAuth.get(operationName);
  if (required === "none" || required === undefined) return;
  if (context.role === null) {
    throw new GraphQLError("A credential is required", {
      extensions: { code: "UNAUTHORIZED" },
    });
  }
  if (required === "server" && context.role !== "server") {
    throw new GraphQLError("This operation requires the server role", {
      extensions: { code: "FORBIDDEN" },
    });
  }
}

function protocolContext(context: GraphqlRequestContext): ProtocolContext {
  if (!context.apiKey) {
    throw new GraphQLError("A credential is required", {
      extensions: { code: "UNAUTHORIZED" },
    });
  }
  return { apiKey: context.apiKey, requestIp: context.requestIp };
}

async function resolve<T>(
  operationName: string,
  context: GraphqlRequestContext,
  input: unknown,
  run: (input: never) => Promise<T> | T,
): Promise<T> {
  assertRole(operationName, context);
  // Server-role authoritative auth already ran in executeCommerceGraphql,
  // BEFORE execute() — graphql-js coerces variables before any resolver, so
  // an auth check here would come after input validation (SPEC.md 5 forbids
  // that ordering for server operations).
  // The same generated JSON Schema the REST binding enforces. GraphQL's own
  // coercion does not check the custom scalars' patterns and bounds, so
  // without this the bindings would disagree on CONTENT bounds (SPEC.md 8).
  // Structural asymmetry is different and documented: REST ignores an unknown
  // input member (SPEC.md 6) while GraphQL rejects one at coercion (SPEC.md 7).
  if (input !== undefined) {
    const invalid = validateOperationInput(operationName, input);
    if (invalid) {
      throw new GraphQLError(invalid, {
        extensions: { code: "INVALID_REQUEST" },
      });
    }
  }
  try {
    return await run(input as never);
  } catch (error) {
    if (error instanceof GraphQLError) throw error;
    if (error instanceof ProtocolOperationError) {
      throw new GraphQLError(error.message, {
        extensions: {
          code: error.code,
          ...(error.retryAfterSec === undefined
            ? {}
            : { retryAfterSec: error.retryAfterSec }),
        },
      });
    }
    throw new GraphQLError("The operation failed", {
      extensions: { code: "INTERNAL_ERROR" },
    });
  }
}

// buildSchema attaches no resolvers, so the root value carries one function
// per operation; nested members resolve off plain handler results.
const rootValue = {
  providerCapabilities: (
    _args: unknown,
    context: GraphqlRequestContext,
  ): Promise<unknown> =>
    resolve("providerCapabilities", context, undefined, () =>
      handlers.providerCapabilities(),
    ),
  subscriptionStatus: (
    args: { input: { userId: string } },
    context: GraphqlRequestContext,
  ): Promise<unknown> =>
    resolve("subscriptionStatus", context, args.input, (input) =>
      handlers.subscriptionStatus(protocolContext(context), input),
    ),
  entitlements: (
    args: { input: { userId: string } },
    context: GraphqlRequestContext,
  ): Promise<unknown> =>
    resolve("entitlements", context, args.input, (input) =>
      handlers.entitlements(protocolContext(context), input),
    ),
  verifyPurchase: (
    args: { input: Parameters<typeof handlers.verifyPurchase>[1] },
    context: GraphqlRequestContext,
  ): Promise<unknown> =>
    resolve("verifyPurchase", context, args.input, (input) =>
      handlers.verifyPurchase(protocolContext(context), input),
    ),
  bindPurchase: (
    args: { input: Parameters<typeof handlers.bindPurchase>[1] },
    context: GraphqlRequestContext,
  ): Promise<unknown> =>
    resolve("bindPurchase", context, args.input, (input) =>
      handlers.bindPurchase(protocolContext(context), input),
    ),
  eraseUser: (
    args: { input: { userId: string } },
    context: GraphqlRequestContext,
  ): Promise<unknown> =>
    resolve("eraseUser", context, args.input, (input) =>
      handlers.eraseUser(protocolContext(context), input),
    ),
};

function boundsError(document: DocumentNode): string | null {
  const operations = document.definitions.filter(
    (definition): definition is OperationDefinitionNode =>
      definition.kind === Kind.OPERATION_DEFINITION,
  );
  if (operations.length !== 1) {
    return "Send exactly one operation per request";
  }
  const operation = operations[0];
  if (operation.operation === OperationTypeNode.SUBSCRIPTION) {
    return "The GraphQL binding serves no subscriptions";
  }

  const fragments = new Map<string, SelectionSetNode>();
  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.set(definition.name.value, definition.selectionSet);
    }
  }

  // Count actual selections after expanding inline and named fragments, so an
  // aliased amplification hidden inside `... on Query { a b c }` or a fragment
  // spread is counted at the level it really executes. Crucially the walk
  // ABORTS the instant any bound is exceeded, and a total node-visit budget
  // hard-caps the work: a fragment DAG (f0 spreads f1 twice, f1 spreads f2
  // twice, …) expands exponentially, so fully expanding it before checking is
  // itself the DoS. Early exit plus the visit budget keep the cost linear in
  // the budget regardless of how the DAG is shaped.
  const MAX_VISITS = 10_000;
  let fields = 0;
  let rootFields = 0;
  let visits = 0;
  const seenFragments = new Set<string>();
  const walk = (
    selectionSet: SelectionSetNode | undefined,
    depth: number,
  ): string | null => {
    if (depth > MAX_QUERY_DEPTH) return "Query is too deep";
    if (!selectionSet?.selections) return null;
    for (const selection of selectionSet.selections) {
      if (++visits > MAX_VISITS) return "Query is too complex";
      if (selection.kind === Kind.FIELD) {
        fields += 1;
        if (fields > MAX_FIELD_NODES) return "Query selects too many fields";
        if (depth === 1) {
          rootFields += 1;
          if (rootFields > 1) {
            return "Send exactly one operation field per request";
          }
        }
        const nested = walk(selection.selectionSet, depth + 1);
        if (nested) return nested;
      } else if (selection.kind === Kind.INLINE_FRAGMENT) {
        // An inline fragment does not add a level: its members select on the
        // same object at the current depth.
        const nested = walk(selection.selectionSet, depth);
        if (nested) return nested;
      } else {
        const name = selection.name.value;
        if (seenFragments.has(name)) continue; // cycle guard
        seenFragments.add(name);
        const nested = walk(fragments.get(name), depth);
        seenFragments.delete(name);
        if (nested) return nested;
      }
    }
    return null;
  };
  const exceeded = walk(operation.selectionSet, 1);
  if (exceeded) return exceeded;

  // A field-free operation (only fragment spreads that resolve to nothing) is
  // not one operation field.
  if (rootFields !== 1) return "Send exactly one operation field per request";
  return null;
}

function errorPayload(code: string, message: string) {
  return { errors: [{ message, extensions: { code } }] };
}

// graphql-js parse/validation/coercion messages embed the submitted document
// and variable VALUES verbatim — a coercion error on VerifyPurchaseInput
// echoes the whole JWS back to an unauthenticated caller, which SPEC.md 8
// forbids (no store evidence or signed payloads in messages). Request-level
// failures therefore answer with fixed text; the caller reproduces the detail
// locally against the published projection.
const PARSE_MESSAGE = "The GraphQL document does not parse";
const VALIDATION_MESSAGE = "The GraphQL document is not valid for the schema";
const COERCION_MESSAGE =
  "The request variables are not valid for the operation";

/**
 * The single root operation field, resolved through fragment spreads. Only
 * called after boundsError enforced exactly one operation with exactly one
 * root field, so the first field found is the operation being invoked.
 */
function rootFieldName(document: DocumentNode): string | null {
  const operations = document.definitions.filter(
    (definition): definition is OperationDefinitionNode =>
      definition.kind === Kind.OPERATION_DEFINITION,
  );
  const operation = operations[0];
  if (!operation) return null;
  const fragments = new Map<string, SelectionSetNode>();
  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.set(definition.name.value, definition.selectionSet);
    }
  }
  const seen = new Set<string>();
  const find = (selectionSet?: SelectionSetNode): string | null => {
    for (const selection of selectionSet?.selections ?? []) {
      if (selection.kind === Kind.FIELD) return selection.name.value;
      if (selection.kind === Kind.INLINE_FRAGMENT) {
        const found = find(selection.selectionSet);
        if (found) return found;
      } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
        const name = selection.name.value;
        if (seen.has(name)) continue;
        seen.add(name);
        const found = find(fragments.get(name));
        if (found) return found;
      }
    }
    return null;
  };
  return find(operation.selectionSet);
}

/**
 * Executes one GraphQL request against the projection. Returns the JSON body
 * and status; operation failures are 200 responses whose errors carry the
 * protocol code, per SPEC.md 7.
 */
export async function executeCommerceGraphql(
  payload: unknown,
  context: GraphqlRequestContext,
): Promise<{ status: 200; body: unknown }> {
  // SPEC.md 7: the GraphQL binding answers with HTTP 200 and the code in
  // errors[].extensions.code for every failure, including request-level ones.
  if (payload === null || typeof payload !== "object") {
    return {
      status: 200,
      body: errorPayload("INVALID_REQUEST", "Request body is not JSON"),
    };
  }
  const { query, variables, operationName } = payload as {
    query?: unknown;
    variables?: unknown;
    operationName?: unknown;
  };
  if (typeof query !== "string" || query.length === 0) {
    return {
      status: 200,
      body: errorPayload("INVALID_REQUEST", "query is required"),
    };
  }

  let document: DocumentNode;
  try {
    document = parse(query);
  } catch {
    // A syntax message can echo document text, and evidence pasted as a
    // literal is document text — fixed message only.
    return {
      status: 200,
      body: errorPayload("INVALID_REQUEST", PARSE_MESSAGE),
    };
  }

  const bounds = boundsError(document);
  if (bounds) {
    return { status: 200, body: errorPayload("INVALID_REQUEST", bounds) };
  }

  const validationErrors = validate(commerceGraphqlSchema, document);
  if (validationErrors.length) {
    // Literal-coercion validation errors echo the submitted value.
    return {
      status: 200,
      body: errorPayload("INVALID_REQUEST", VALIDATION_MESSAGE),
    };
  }

  // SPEC.md 5: server-role authorization precedes input validation, and
  // graphql-js coerces variables BEFORE any resolver runs — so the resolver is
  // too late. Authorize here, after transport-shape checks (parse, bounds,
  // validate) and before execute(), where coercion happens.
  const operationField = rootFieldName(document);
  if (operationField && operationAuth.get(operationField) === "server") {
    if (context.role === null) {
      return {
        status: 200,
        body: errorPayload("UNAUTHORIZED", "A credential is required"),
      };
    }
    if (context.role !== "server") {
      return {
        status: 200,
        body: errorPayload(
          "FORBIDDEN",
          "This operation requires the server role",
        ),
      };
    }
    try {
      await handlers.assertServerCredential({
        apiKey: context.apiKey ?? "",
        requestIp: context.requestIp,
      });
    } catch (error) {
      if (error instanceof ProtocolOperationError) {
        return { status: 200, body: errorPayload(error.code, error.message) };
      }
      return {
        status: 200,
        body: errorPayload("INTERNAL_ERROR", "The operation failed"),
      };
    }
  }

  const result = await execute({
    schema: commerceGraphqlSchema,
    document,
    rootValue,
    contextValue: context,
    variableValues:
      variables && typeof variables === "object"
        ? (variables as Record<string, unknown>)
        : undefined,
    operationName: typeof operationName === "string" ? operationName : null,
  });

  return {
    status: 200,
    body: {
      ...(result.data === undefined ? {} : { data: result.data }),
      ...(result.errors?.length
        ? {
            errors: result.errors.map((error) => {
              const coded = typeof error.extensions?.code === "string";
              return {
                // A codeless error here is graphql-js variable coercion,
                // whose message echoes the submitted value — replace it.
                // Resolver-raised errors carry a code and a safe message.
                message: coded ? error.message : COERCION_MESSAGE,
                extensions: {
                  code: coded
                    ? (error.extensions.code as string)
                    : "INVALID_REQUEST",
                  ...(typeof error.extensions?.retryAfterSec === "number"
                    ? { retryAfterSec: error.extensions.retryAfterSec }
                    : {}),
                },
              };
            }),
          }
        : {}),
    },
  };
}
