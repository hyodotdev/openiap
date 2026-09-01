// Minimal in-memory provider implementing both transport bindings of the
// operation surface. It exists to prove the conformance runner judges against
// the specification alone: it imports no backend and none of IAPKit, and its
// data is fixture data — including its capability descriptor, which describes
// this mock, not any real store integration.
//
// Its GraphQL endpoint is a real executor over the generated schema projection:
// it parses, validates, and executes the query with graphql-js, so a runner
// that sends a real GraphQL document (not just an operationName) is genuinely
// exercised. graphql is a development-only dependency of this spec package; a
// non-JS provider would serve its own GraphQL runtime.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { buildSchema, execute, GraphQLError, parse, validate } from "graphql";

import {
  httpBindingManifest,
  lifecycleVectors,
  operationVectors,
} from "./index.mjs";

const operationsSchema = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("../generated/schemas/operations.schema.json", import.meta.url),
    ),
    "utf8",
  ),
);

const projectionSdl = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL("../generated/bindings/operations-sdl.json", import.meta.url),
    ),
    "utf8",
  ),
).sdl;
const mockGraphqlSchema = buildSchema(projectionSdl);

/** First operation field of the (single) operation, through fragment spreads. */
function rootFieldName(document) {
  const operation = document.definitions.find(
    (definition) => definition.kind === "OperationDefinition",
  );
  if (!operation) return null;
  const fragments = new Map(
    document.definitions
      .filter((definition) => definition.kind === "FragmentDefinition")
      .map((definition) => [definition.name.value, definition.selectionSet]),
  );
  const seen = new Set();
  const find = (selectionSet) => {
    for (const selection of selectionSet?.selections ?? []) {
      if (selection.kind === "Field") return selection.name.value;
      if (selection.kind === "InlineFragment") {
        const found = find(selection.selectionSet);
        if (found) return found;
      } else if (selection.kind === "FragmentSpread") {
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

const FIXTURES = operationVectors.fixtures;
const CREDENTIALS = Object.freeze({
  verification: "mock-verification-credential",
  server: "mock-server-credential",
});
const KNOWN_STORES = new Set(["apple", "google", "horizon", "amazon"]);

const fullSupport = () => ({ provider: true, implementation: true });
const mockedSupport = () => ({
  provider: true,
  implementation: false,
  notes: "Fixture descriptor: the mock provider consumes no real store API.",
});

const CAPABILITIES = Object.freeze({
  specVersion: httpBindingManifest.protocolVersion,
  implementation: {
    name: "openiap-conformance-mock-provider",
    version: "0.1.0",
  },
  eventTypes: ["entitlement.granted", "entitlement.revoked"],
  stores: {
    apple: {
      initialValidation: fullSupport(),
      serverNotifications: mockedSupport(),
      subscriptions: fullSupport(),
      renewalEvents: mockedSupport(),
      refundEvents: mockedSupport(),
      expiration: mockedSupport(),
      reconciliation: mockedSupport(),
      entitlements: fullSupport(),
      revenueAmount: mockedSupport(),
    },
  },
  profiles: {
    verification: "1.0",
    entitlements: "1.0",
    accountLifecycle: "1.0",
  },
  bindings: { rest: "1.0", graphql: "1.0" },
});

function requiredMembersOf(typeName) {
  return operationsSchema.$defs[typeName]?.required ?? [];
}

class OperationError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function createMockProvider({ declareEvents = false } = {}) {
  // The base mock serves the operation surface only. `declareEvents` adds the
  // events profile to its descriptor so the runner's events verification (which
  // requires an events adapter and reproduces the signature vectors) is
  // exercised — a provider that declares events but skips signing must fail.
  const capabilities = declareEvents
    ? {
        ...CAPABILITIES,
        profiles: { ...CAPABILITIES.profiles, events: "1.0" },
        // §10 honesty: everything the emission rules can produce must be
        // declared — the runner cross-checks emitted types against this list.
        eventTypes: [
          ...new Set([
            ...lifecycleVectors.emission.cases.flatMap(
              (testCase) => testCase.emit,
            ),
            ...lifecycleVectors.binding.cases.flatMap(
              (testCase) => testCase.emit,
            ),
          ]),
        ].sort(),
      }
    : CAPABILITIES;
  const subscriptions = [
    {
      productId: "mock.premium",
      state: "Active",
      active: true,
      store: "google",
      expiresAt: Date.now() + 30 * 86_400_000,
      willRenew: true,
      startedAt: Date.now() - 86_400_000,
      updatedAt: Date.now(),
      purchaseToken: FIXTURES.googlePurchaseToken,
      userId: FIXTURES.userId,
    },
  ];
  let erasureJobCounter = 0;
  const erasureJobs = new Map();

  const snapshotOf = (subscription) => ({
    productId: subscription.productId,
    state: subscription.state,
    active: subscription.active,
    store: subscription.store,
    expiresAt: subscription.expiresAt,
    willRenew: subscription.willRenew,
    startedAt: subscription.startedAt,
    updatedAt: subscription.updatedAt,
  });

  const requireInputMembers = (typeName, input) => {
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
      throw new OperationError("INVALID_REQUEST", "input must be an object");
    }
    for (const member of requiredMembersOf(typeName)) {
      if (input[member] === undefined || input[member] === null) {
        throw new OperationError("INVALID_REQUEST", `${member} is required`);
      }
    }
  };

  const evidenceOf = (input) => {
    if (!KNOWN_STORES.has(input.store)) {
      throw new OperationError(
        "UNSUPPORTED_STORE",
        "This provider does not integrate the named store",
      );
    }
    const evidence = input[input.store];
    if (evidence === undefined || evidence === null) {
      throw new OperationError(
        "INVALID_REQUEST",
        `${input.store} evidence is required`,
      );
    }
    requireInputMembers(
      `${input.store.charAt(0).toUpperCase()}${input.store.slice(1)}Evidence`,
      evidence,
    );
    return evidence;
  };

  const handlers = {
    providerCapabilities: () => capabilities,
    subscriptionStatus: (input) => {
      requireInputMembers("SubscriptionStatusInput", input);
      const owned = subscriptions.filter(
        (subscription) => subscription.userId === input.userId,
      );
      const active = owned.filter((subscription) => subscription.active);
      const selected = active[0] ?? owned[0];
      return {
        active: active.length > 0,
        ...(selected ? { subscription: snapshotOf(selected) } : {}),
      };
    },
    entitlements: (input) => {
      requireInputMembers("EntitlementsInput", input);
      const active = subscriptions.filter(
        (subscription) =>
          subscription.userId === input.userId && subscription.active,
      );
      return {
        userId: input.userId,
        productIds: [...new Set(active.map((s) => s.productId))],
        subscriptions: active.map(snapshotOf),
      };
    },
    verifyPurchase: (input) => {
      requireInputMembers("VerifyPurchaseInput", input);
      evidenceOf(input);
      return {
        store: input.store,
        isValid: true,
        state: "ENTITLED",
        productId: "mock.premium",
        environment: "sandbox",
      };
    },
    bindPurchase: (input) => {
      requireInputMembers("BindPurchaseInput", input);
      const evidence = evidenceOf(input);
      const token =
        evidence.purchaseToken ?? evidence.jws ?? evidence.receiptId;
      const match = subscriptions.find(
        (subscription) => subscription.purchaseToken === token,
      );
      if (!match) return { bound: false };
      if (match.userId === undefined) {
        match.userId = input.userId;
        return { bound: true };
      }
      // Possession of a token is not proof of ownership: an existing binding
      // never moves, and a foreign binding is indistinguishable from an
      // unknown purchase.
      return { bound: match.userId === input.userId };
    },
    eraseUser: (input) => {
      requireInputMembers("EraseUserInput", input);
      let job = erasureJobs.get(input.userId);
      if (!job) {
        erasureJobCounter += 1;
        job = { jobId: `mock-erasure-job-${erasureJobCounter}` };
        erasureJobs.set(input.userId, job);
        for (const subscription of subscriptions) {
          if (subscription.userId === input.userId) {
            subscription.userId = undefined;
          }
        }
      }
      return { accepted: true, jobId: job.jobId, status: "completed" };
    },
  };

  const roleOf = (request) => {
    const header = request.headers.get?.("Authorization");
    if (!header?.startsWith("Bearer ")) return null;
    const token = header.slice("Bearer ".length);
    if (token === CREDENTIALS.server) return "server";
    if (token === CREDENTIALS.verification) return "verification";
    return "invalid";
  };

  const authorize = (definition, role) => {
    if (definition.auth === "none") return;
    if (role === null || role === "invalid") {
      throw new OperationError("UNAUTHORIZED", "A credential is required");
    }
    if (definition.auth === "server" && role !== "server") {
      throw new OperationError(
        "FORBIDDEN",
        "This operation requires the server role",
      );
    }
  };

  const run = (operationName, input, role) => {
    const definition = httpBindingManifest.operations.find(
      (operation) => operation.name === operationName,
    );
    if (!definition) {
      throw new OperationError("NOT_FOUND", "Unknown operation");
    }
    authorize(definition, role);
    return {
      definition,
      data: handlers[operationName](input),
    };
  };

  // Root resolvers for the real GraphQL executor: same auth + handlers as REST,
  // protocol codes carried in errors[].extensions.code (HTTP stays 200).
  const graphqlRootValue = (role) =>
    Object.fromEntries(
      httpBindingManifest.operations.map((operation) => [
        operation.name,
        (args) => {
          try {
            return run(operation.name, args?.input ?? null, role).data;
          } catch (error) {
            const code =
              error instanceof OperationError ? error.code : "INTERNAL_ERROR";
            throw new GraphQLError(
              error instanceof Error ? error.message : "Operation failed",
              { extensions: { code } },
            );
          }
        },
      ]),
    );

  const json = (status, body) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });

  const fetchImpl = async (url, options = {}) => {
    const request = new Request(url, options);
    const { pathname, searchParams } = new URL(request.url);
    const role = roleOf(request);

    if (pathname === "/commerce/v1/graphql" && request.method === "POST") {
      let payload;
      try {
        payload = await request.json();
      } catch {
        // SPEC.md 7: a coded error MUST be HTTP 200, so a 400 transport-shape
        // rejection stays codeless — the caller treats it as INVALID_REQUEST.
        return json(400, {
          errors: [{ message: "Request body is not JSON" }],
        });
      }
      const { query, variables, operationName } = payload ?? {};
      if (typeof query !== "string") {
        return json(400, {
          errors: [{ message: "query is required" }],
        });
      }
      let document;
      try {
        document = parse(query);
      } catch {
        // graphql-js messages echo document text; fixed text per SPEC.md 8.
        return json(200, {
          errors: [
            {
              message: "The GraphQL document does not parse",
              extensions: { code: "INVALID_REQUEST" },
            },
          ],
        });
      }
      const validationErrors = validate(mockGraphqlSchema, document);
      if (validationErrors.length) {
        // A request-level failure is HTTP 200/400; literal-coercion messages
        // echo submitted values, so the text is fixed.
        return json(200, {
          errors: validationErrors.map(() => ({
            message: "The GraphQL document is not valid for the schema",
            extensions: { code: "INVALID_REQUEST" },
          })),
        });
      }
      // SPEC.md 5: server-role authorization precedes input validation, and
      // graphql-js coerces variables before any resolver — authorize the root
      // operation field here, before execute().
      const rootField = rootFieldName(document);
      const rootDefinition = httpBindingManifest.operations.find(
        (operation) => operation.name === rootField,
      );
      if (rootDefinition && rootDefinition.auth === "server") {
        try {
          authorize(rootDefinition, role);
        } catch (error) {
          return json(200, {
            errors: [
              {
                message: error.message,
                extensions: {
                  code:
                    error instanceof OperationError
                      ? error.code
                      : "INTERNAL_ERROR",
                },
              },
            ],
          });
        }
      }
      const result = await execute({
        schema: mockGraphqlSchema,
        document,
        rootValue: graphqlRootValue(role),
        operationName: typeof operationName === "string" ? operationName : null,
        variableValues:
          variables && typeof variables === "object" ? variables : undefined,
      });
      return json(200, {
        ...(result.data === undefined ? {} : { data: result.data }),
        ...(result.errors?.length
          ? {
              errors: result.errors.map((error) => {
                // A resolver-raised failure carries a protocol code and a safe
                // message; a codeless error is graphql-js variable coercion,
                // whose message echoes the submitted value — replace it.
                const coded = typeof error.extensions?.code === "string";
                return {
                  message: coded
                    ? error.message
                    : "The request variables are not valid for the operation",
                  extensions: {
                    code: coded ? error.extensions.code : "INVALID_REQUEST",
                  },
                };
              }),
            }
          : {}),
      });
    }

    const definition = httpBindingManifest.operations.find(
      (operation) =>
        operation.path === pathname && operation.method === request.method,
    );
    if (!definition) {
      return json(404, {
        error: { code: "NOT_FOUND", message: "Unknown operation" },
      });
    }
    let input = null;
    if (definition.method === "GET") {
      input = Object.fromEntries(searchParams.entries());
      if (Object.keys(input).length === 0) input = definition.input ? {} : null;
    } else {
      try {
        input = await request.json();
      } catch {
        return json(400, {
          error: { code: "INVALID_REQUEST", message: "Body is not JSON" },
        });
      }
    }
    try {
      const { data } = run(definition.name, input, role);
      return json(definition.successStatus, data);
    } catch (error) {
      if (error instanceof OperationError) {
        return json(httpBindingManifest.errorStatus[error.code] ?? 500, {
          error: { code: error.code, message: error.message },
        });
      }
      return json(500, {
        error: { code: "INTERNAL_ERROR", message: "Operation failed" },
      });
    }
  };

  return {
    fetch: fetchImpl,
    credentials: { ...CREDENTIALS },
    capabilities,
  };
}
