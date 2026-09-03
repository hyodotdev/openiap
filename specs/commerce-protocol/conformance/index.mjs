// Portable conformance runner for the OpenIAP Commerce Protocol operation
// surface. It drives any provider through the generated operation vectors,
// over REST, GraphQL, or both, and judges only against generated artifacts —
// never against any particular backend.
//
// It runs offline against whatever `fetch` it is given, needs no hosted
// service, and imports no implementation. The one external need is a JSON
// Schema validator: pass the Ajv 2020 class (`import Ajv from
// "ajv/dist/2020.js"`) as `Ajv` — the published runtime itself keeps zero
// dependencies, so it does not bundle one.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const load = (name) =>
  JSON.parse(
    readFileSync(
      fileURLToPath(new URL(`../generated/${name}`, import.meta.url)),
      "utf8",
    ),
  );

export const httpBindingManifest = load("bindings/http-binding.json");
export const graphqlOperations = load("bindings/graphql-operations.json");
export const introspectionSignature = load(
  "bindings/introspection-signature.json",
);
export const operationVectors = load("vectors/operations.json");
export const signatureVectors = JSON.parse(
  readFileSync(
    fileURLToPath(new URL("../vectors/signatures.json", import.meta.url)),
    "utf8",
  ),
);
export const lifecycleVectors = load("vectors/lifecycle.json");
const bundleSchema = JSON.parse(
  readFileSync(
    fileURLToPath(
      new URL(
        "../generated/schemas/commerce-protocol.bundle.schema.json",
        import.meta.url,
      ),
    ),
    "utf8",
  ),
);

const operationsByName = new Map(
  httpBindingManifest.operations.map((operation) => [
    operation.name,
    operation,
  ]),
);

/** A bearer this map does not name; a conforming provider must reject it. */
const INVALID_CREDENTIAL = "openiap-conformance-invalid-credential";

function stringLeaves(value, found = []) {
  if (Array.isArray(value)) {
    for (const item of value) stringLeaves(item, found);
    return found;
  }
  if (typeof value === "string") {
    found.push(value);
    return found;
  }
  if (value === null || typeof value !== "object") return found;
  for (const member of Object.values(value)) {
    stringLeaves(member, found);
  }
  return found;
}

/** Every string nested inside a store-evidence object is sensitive. */
function evidenceValues(input) {
  if (input === null || typeof input !== "object" || Array.isArray(input)) {
    return [];
  }
  const found = [];
  for (const [memberName, member] of Object.entries(input)) {
    // Operation-level identity and the store discriminator are not evidence.
    // Evidence members are nested objects; scanning every such object also
    // covers a mismatched/future evidence member without a hard-coded list.
    if (
      memberName !== "userId" &&
      memberName !== "store" &&
      member !== null &&
      typeof member === "object"
    ) {
      stringLeaves(member, found);
    }
  }
  return found;
}

/**
 * The exact shape SPEC.md 7 allows for a request-level failure: a non-empty
 * errors array where every error has a message and no code beyond the
 * generic INVALID_REQUEST, NO data member at all (the request never
 * executed), HTTP 200 — or 400 only when every error is codeless. Anything
 * looser would certify what §7 forbids: a more specific code on a request
 * error, a coded error at 400, or a data member on a request that never ran.
 */
function isWellFormedRequestRejection(status, body) {
  if (!body || typeof body !== "object" || "data" in body) return false;
  if (!Array.isArray(body.errors) || body.errors.length === 0) return false;
  let codedCount = 0;
  for (const error of body.errors) {
    // Non-empty: SPEC.md 8 makes a message human-readable, and an empty
    // string is not a message at all.
    if (typeof error?.message !== "string" || error.message.length === 0) {
      return false;
    }
    const code = error?.extensions?.code;
    if (code !== undefined) {
      if (code !== "INVALID_REQUEST") return false;
      codedCount += 1;
    }
  }
  // §7 categories are exclusive per envelope: all coded or all codeless —
  // a mixed rejection is malformed, not a well-formed request rejection.
  if (codedCount > 0 && codedCount < body.errors.length) return false;
  return status === 200 || (status === 400 && codedCount === 0);
}

/**
 * Members that may never appear in a server-read response (tokenless rule).
 * SubscriptionStatusSnapshot forbids four categories: purchase tokens, store
 * transaction identity, signed receipts, and provider-internal record ids.
 */
const TOKEN_MEMBER_NAMES = new Set([
  "purchaseToken",
  "originalTransactionId",
  "transactionId",
  "jws",
  "receipt",
  "receiptId",
  "signedTransaction",
  "signedPayload",
  "id",
  "_id",
]);

function findTokenMembers(value, path = "", found = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      findTokenMembers(item, `${path}[${index}]`, found),
    );
    return found;
  }
  if (value === null || typeof value !== "object") return found;
  for (const [key, member] of Object.entries(value)) {
    const memberPath = path ? `${path}.${key}` : key;
    if (TOKEN_MEMBER_NAMES.has(key)) found.push(memberPath);
    findTokenMembers(member, memberPath, found);
  }
  return found;
}

/**
 * GraphQL returns null for a selected member the provider omitted, and the
 * operation types deliberately never allow a meaningful null — so dropping
 * null members yields the binding-neutral shape both transports are judged
 * on.
 */
export function normalizeResultData(value) {
  if (Array.isArray(value)) return value.map(normalizeResultData);
  if (value === null || typeof value !== "object") return value;
  // Null-prototype output: a provider member literally named __proto__ must
  // stay an ordinary own key, not silently re-parent the object and vanish
  // from parity, schema validation, and the tokenless scan.
  const out = Object.create(null);
  for (const [key, member] of Object.entries(value)) {
    if (member === null || member === undefined) continue;
    out[key] = normalizeResultData(member);
  }
  return out;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  const entries = Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
  return `{${entries.join(",")}}`;
}

function withoutMembers(value, members) {
  if (!members?.length || value === null || typeof value !== "object") {
    return value;
  }
  const out = { ...value };
  for (const member of members) delete out[member];
  return out;
}

/**
 * Recursively keeps only the members the generated canonical selection tree
 * names (`true` marks a leaf, an object a nested selection). Used for parity:
 * the tree is this protocol version's contract shape, and a REST body may
 * legally carry additive MINOR members on an open object that the frozen
 * GraphQL selection cannot fetch — those fall outside the comparison, while a
 * contract member missing from either binding still disagrees.
 */
function projectOnto(value, tree) {
  if (tree === true || tree === null || typeof tree !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    // A list field's tree describes each element.
    return value.map((item) => projectOnto(item, tree));
  }
  if (value !== null && typeof value === "object") {
    // Object.hasOwn, not `in`: the tree is a plain literal, so `in` would
    // also match prototype names ("toString", "constructor") and wrongly
    // keep a legal additive member that happens to collide with one.
    const out = Object.create(null);
    for (const key of Object.keys(value)) {
      if (Object.hasOwn(tree, key)) {
        out[key] = projectOnto(value[key], tree[key]);
      }
    }
    return out;
  }
  return value;
}

/**
 * Members present in `value` that the canonical selection tree never names.
 * A real GraphQL executor cannot return a field the frozen document did not
 * request, so anything extra on the GraphQL binding is a fabricated response
 * — it must FAIL, never be silently projected away.
 */
function extraMembers(value, tree, path = "", found = []) {
  if (tree === true || tree === null || typeof tree !== "object") return found;
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      extraMembers(item, tree, `${path}[${index}]`, found),
    );
    return found;
  }
  if (value === null || typeof value !== "object") return found;
  for (const key of Object.keys(value)) {
    const memberPath = path ? `${path}.${key}` : key;
    if (!Object.hasOwn(tree, key)) {
      found.push(memberPath);
    } else {
      extraMembers(value[key], tree[key], memberPath, found);
    }
  }
  return found;
}

function authorizationHeader(credential, credentials) {
  if (credential === null || credential === undefined) return {};
  // A vector may present a credential no provider issued, to prove the
  // provider rejects an unknown bearer rather than trusting any string.
  if (credential === "invalid") {
    return { Authorization: `Bearer ${INVALID_CREDENTIAL}` };
  }
  const value = credentials?.[credential];
  if (!value) {
    throw new Error(`No ${credential} credential was configured`);
  }
  return { Authorization: `Bearer ${value}` };
}

/**
 * REST transport adapter: resolves each operation through the generated HTTP
 * manifest and normalizes the response to a binding-neutral outcome.
 */
export function createRestAdapter({ baseUrl, fetch: fetchFn, credentials }) {
  if (!baseUrl || typeof fetchFn !== "function") {
    throw new Error("createRestAdapter needs baseUrl and fetch");
  }
  const origin = baseUrl.replace(/\/$/u, "");
  return {
    binding: "rest",
    // The configured bearer values, so the runner can reject an error
    // message that echoes a credential (SPEC.md 8). Values only — never sent
    // anywhere; compared against message text locally.
    secrets: Object.values(credentials ?? {}),
    async request({ operation, input, credential }) {
      const definition = operationsByName.get(operation);
      if (!definition) throw new Error(`Unknown operation: ${operation}`);
      const headers = {
        Accept: "application/json",
        ...authorizationHeader(credential, credentials),
      };
      let url = `${origin}${definition.path}`;
      const options = { method: definition.method, headers };
      if (definition.method === "GET") {
        const query = new URLSearchParams();
        for (const [key, value] of Object.entries(input ?? {})) {
          if (value !== null && value !== undefined) {
            query.set(key, String(value));
          }
        }
        const encoded = query.toString();
        if (encoded) url += `?${encoded}`;
      } else {
        headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(input ?? {});
      }
      const response = await fetchFn(url, options);
      const status = response.status;
      let body;
      try {
        body = await response.json();
      } catch {
        return { kind: "invalid", status, detail: "response body is not JSON" };
      }
      if (status === definition.successStatus) {
        return { kind: "result", status, data: normalizeResultData(body) };
      }
      const code = body?.error?.code;
      if (
        typeof code !== "string" ||
        typeof body?.error?.message !== "string"
      ) {
        return {
          kind: "invalid",
          status,
          detail: "error response is not a ProtocolErrorResponse",
        };
      }
      // The full body rides along so the runner can validate the error
      // envelope against the CLOSED ProtocolErrorResponse schema — a failure
      // response is the easiest place to smuggle members past the tokenless
      // rules, because callers rarely inspect one.
      return { kind: "error", status, code, errorBody: body };
    },
  };
}

/**
 * GraphQL transport adapter: sends the generated canonical full-selection
 * document for each operation and normalizes the response. A GraphQL
 * validation failure with no protocol code is INVALID_REQUEST by definition —
 * see the GraphQL binding section of SPEC.md.
 */
export function createGraphqlAdapter({ url, fetch: fetchFn, credentials }) {
  if (!url || typeof fetchFn !== "function") {
    throw new Error("createGraphqlAdapter needs url and fetch");
  }
  // Sends an arbitrary GraphQL request body — used by the executor probe to
  // send malformed / non-canonical documents an operationName-only dispatcher
  // would mishandle.
  const rawGraphql = async (payload, credential) => {
    const response = await fetchFn(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...authorizationHeader(credential, credentials),
      },
      body: JSON.stringify(payload),
    });
    let body;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return { status: response.status, body };
  };

  return {
    binding: "graphql",
    // See createRestAdapter: local credential-echo comparison only.
    secrets: Object.values(credentials ?? {}),
    rawGraphql,
    async request({ operation, input, credential }) {
      const entry = graphqlOperations.operations[operation];
      if (!entry) throw new Error(`Unknown operation: ${operation}`);
      const response = await fetchFn(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...authorizationHeader(credential, credentials),
        },
        body: JSON.stringify({
          query: entry.document,
          operationName: operation.charAt(0).toUpperCase() + operation.slice(1),
          variables: input === null || input === undefined ? {} : { input },
        }),
      });
      let body;
      try {
        body = await response.json();
      } catch {
        return {
          kind: "invalid",
          status: response.status,
          detail: "response body is not JSON",
        };
      }
      if (Array.isArray(body?.errors) && body.errors.length) {
        // EVERY entry in the envelope is held to the wrapper rules — judging
        // errors[0] alone would let a provider smuggle a malformed or
        // differently-coded error behind a clean first one.
        const codes = body.errors.map((error) => error?.extensions?.code);
        for (const error of body.errors) {
          // SPEC.md 8: a message is human-readable — an absent or empty one
          // is not a message at all (REST's NonEmptyString enforces the same).
          if (
            typeof error?.message !== "string" ||
            error.message.length === 0
          ) {
            return {
              kind: "invalid",
              status: response.status,
              detail:
                "a GraphQL error in the envelope carries no non-empty message string",
            };
          }
        }
        // One definition of "coded" for the whole file: a present code that
        // is not a string is malformed, never quietly treated as codeless.
        if (
          codes.some((code) => code !== undefined && typeof code !== "string")
        ) {
          return {
            kind: "invalid",
            status: response.status,
            detail: "extensions.code must be a string when present",
          };
        }
        // SPEC.md 7's two categories are exclusive per envelope: an operation
        // failure carries the §8 code, a request-level failure carries none
        // (or the generic INVALID_REQUEST on every entry). A codeless entry
        // riding beside a coded one would be invisible to every code check —
        // a leak channel — so a mixed envelope is malformed outright.
        if (
          codes.some((code) => typeof code === "string") &&
          codes.some((code) => code === undefined)
        ) {
          return {
            kind: "invalid",
            status: response.status,
            detail:
              "the envelope mixes coded and codeless errors (SPEC.md 7 categories are exclusive)",
          };
        }
        // SPEC.md 7: an operation failure — the error carries a protocol
        // code — is an HTTP 200. A request-level failure carries no code
        // (the caller treats it as INVALID_REQUEST), omits the data member
        // entirely, and MAY use 200 or 400. A codeless error WITH a data
        // member is an executed operation hiding its protocol code.
        if (
          codes.some((code) => typeof code === "string") &&
          response.status !== 200
        ) {
          return {
            kind: "invalid",
            status: response.status,
            detail: `GraphQL operation error returned HTTP ${response.status}, must be 200`,
          };
        }
        if (codes.some((code) => typeof code !== "string") && "data" in body) {
          return {
            kind: "invalid",
            status: response.status,
            detail:
              "an executed operation's error must carry a protocol code (SPEC.md 7)",
          };
        }
        if (
          codes.every((code) => typeof code !== "string") &&
          response.status !== 200 &&
          response.status !== 400
        ) {
          return {
            kind: "invalid",
            status: response.status,
            detail: `GraphQL request error returned HTTP ${response.status}, must be 200 or 400`,
          };
        }
        const stringCodes = codes.filter((value) => typeof value === "string");
        return {
          kind: "error",
          status: response.status,
          code: stringCodes[0] ?? "INVALID_REQUEST",
          // ONE structure for the whole envelope — message and code travel
          // together per entry, so a code cannot be dropped while its message
          // is kept (or vice versa) to dodge half the checks. The runner
          // derives everything it needs from this.
          errors: body.errors.map((error) => ({
            message: error.message,
            ...(typeof error.extensions?.code === "string"
              ? { code: error.extensions.code }
              : {}),
          })),
          // SPEC.md 7: a pre-execution refusal omits data; vectors for
          // server-role auth negatives assert on this.
          hasData: "data" in body,
        };
      }
      // The canonical document selects exactly one root field — a real
      // executor cannot answer any other. A sibling root is fabricated data
      // riding beside the operation, and extracting only data[operation]
      // would silently discard it.
      if (body?.data && typeof body.data === "object") {
        const roots = Object.keys(body.data);
        if (roots.length !== 1 || roots[0] !== operation) {
          return {
            kind: "invalid",
            status: response.status,
            detail: `GraphQL data carries roots [${roots.join(", ")}], the document requested only ${operation}`,
          };
        }
      }
      const data = body?.data?.[operation];
      if (data === undefined || data === null) {
        return {
          kind: "invalid",
          status: response.status,
          detail: "response carries neither data nor errors",
        };
      }
      if (response.status !== 200) {
        return {
          kind: "invalid",
          status: response.status,
          detail: `GraphQL success returned HTTP ${response.status}, must be 200`,
        };
      }
      return {
        kind: "result",
        status: response.status,
        data: normalizeResultData(data),
        // PRE-normalization shape: the unrequested-member check must see a
        // fabricated `member: null` before null-stripping erases it.
        rawData: data,
      };
    },
  };
}

function buildValidator(Ajv) {
  if (typeof Ajv !== "function") {
    throw new Error(
      'runConformance needs the Ajv 2020 class: import Ajv from "ajv/dist/2020.js"',
    );
  }
  const ajv = new Ajv({
    strict: true,
    allErrors: true,
    loadSchema: () => {
      throw new Error("remote schema resolution attempted");
    },
  });
  ajv.addSchema(bundleSchema, "bundle");
  return (pointer) => ajv.getSchema(`bundle#/$defs/${pointer}`);
}

// A returned error must map to its manifest status on REST, must be one the
// operation actually declares, and — for a non-blocking code every operation
// can hit — must sit in a small always-allowed set. Applied to both the
// expected-error branch and the allowCodes bypass so neither escapes it.
const ALWAYS_ALLOWED_ERROR_CODES = new Set(["RATE_LIMITED", "INTERNAL_ERROR"]);

function checkErrorOutcome(outcome, operationName, adapter) {
  const failures = [];
  if (adapter.binding === "rest") {
    const status = httpBindingManifest.errorStatus[outcome.code];
    if (status !== undefined && outcome.status !== status) {
      failures.push(
        `REST status for ${outcome.code} must be ${status}, got ${outcome.status}`,
      );
    }
  }
  const declared = operationsByName.get(operationName)?.errors ?? [];
  // Same derived-codes/empty-fallback rule as the expectation loop.
  const derived =
    adapter.binding === "graphql" ? graphqlErrorCodes(outcome) : [];
  for (const code of derived.length ? derived : [outcome.code]) {
    if (!declared.includes(code) && !ALWAYS_ALLOWED_ERROR_CODES.has(code)) {
      failures.push(
        `${operationName} returned ${code}, which it does not declare in the manifest`,
      );
    }
  }
  return failures;
}

// SPEC.md 4.2: the outer `active` gate must agree with the snapshot's own
// gate, and a `true` gate requires an entitling subscription. The schema
// cannot express this cross-field relation, so the runner checks it.
function statusInvariants(data) {
  const failures = [];
  if (!data || typeof data !== "object") return failures;
  const active = data.active === true;
  const subscriptionActive = data.subscription?.active === true;
  if (active !== subscriptionActive) {
    failures.push(
      `active (${data.active}) disagrees with subscription.active (${data.subscription?.active})`,
    );
  }
  if (active && !data.subscription) {
    failures.push("active is true but no entitling subscription is present");
  }
  return failures;
}

// SPEC.md 4.3: the result answers FOR the requested user — an echoed userId
// that names someone else is a cross-user leak, whatever else matches —
// productIds must be exactly the deduplicated productIds of the returned
// subscriptions, and every returned subscription must be entitled.
function entitlementsInvariants(data, input) {
  const failures = [];
  if (!data || typeof data !== "object") return failures;
  if (
    typeof input?.userId === "string" &&
    data.userId !== undefined &&
    data.userId !== input.userId
  ) {
    failures.push(
      `entitlements answered for userId ${JSON.stringify(data.userId)} but ${JSON.stringify(input.userId)} was requested`,
    );
  }
  const subscriptions = Array.isArray(data.subscriptions)
    ? data.subscriptions
    : [];
  for (const subscription of subscriptions) {
    if (subscription?.active !== true) {
      failures.push(
        `entitlements returned a non-active subscription (${subscription?.productId})`,
      );
    }
  }
  const expected = [...new Set(subscriptions.map((s) => s?.productId))].sort();
  const actual = Array.isArray(data.productIds)
    ? [...data.productIds].sort()
    : [];
  if (stableStringify(expected) !== stableStringify(actual)) {
    failures.push(
      `productIds ${JSON.stringify(actual)} is not the deduplicated set of active subscription productIds ${JSON.stringify(expected)}`,
    );
  }
  return failures;
}

/**
 * SPEC.md 8 message hygiene, shared by the vector envelope checks AND the
 * executor probes so neither becomes a side door: every error message is a
 * non-empty string (human-readable) and echoes neither the submitted
 * evidence nor a configured credential.
 */
function messageHygieneFailures(messages, forbidden, context) {
  const failures = [];
  for (const message of messages) {
    if (typeof message !== "string" || message.length === 0) {
      failures.push(
        `${context}: an error message must be a non-empty string (SPEC.md 8)`,
      );
      continue;
    }
    if (forbidden.some((token) => message.includes(token))) {
      failures.push(
        `${context}: an error message echoes submitted evidence or a credential (SPEC.md 8)`,
      );
    }
  }
  return failures;
}

/**
 * Values that must never appear in an error message: this vector's own
 * evidence, the AUTHORITATIVE credential values the caller handed the runner
 * (an adapter-supplied list alone could be emptied to dodge the scan), any
 * adapter-declared extras, and the runner's invalid-credential constant.
 * Compared locally against message text only; nothing leaves the runner.
 */
function forbiddenTokens({ input, adapter, credentials }) {
  // Evidence values keep a minimum length so a short generic fragment can't
  // false-positive against ordinary prose; credentials are the caller's
  // EXACT configured values and are scanned at any length — a short real
  // credential echoed into a message is still a leak.
  return [
    ...evidenceValues(input).filter(
      (value) => typeof value === "string" && value.length >= 8,
    ),
    ...Object.values(credentials ?? {}),
    ...(Array.isArray(adapter?.secrets) ? adapter.secrets : []),
    INVALID_CREDENTIAL,
  ].filter((value) => typeof value === "string" && value.length > 0);
}

/** Derived views over the unified GraphQL error structure. */
function graphqlErrorCodes(outcome) {
  return Array.isArray(outcome.errors)
    ? outcome.errors
        .map((error) => error?.code)
        .filter((code) => typeof code === "string")
    : [];
}

/**
 * Envelope rules that hold for EVERY error outcome, whichever expectation
 * branch produced it — the adapter contract, the SPEC.md 8 message hygiene,
 * and the closed REST error envelope. Factored out so the allowCodes branch
 * (a success vector answered with a permitted error, e.g.
 * VERIFICATION_FAILED without store credentials) cannot become a side door
 * around them.
 */
function errorEnvelopeFailures({
  outcome,
  adapter,
  validate,
  input,
  credentials,
}) {
  const failures = [];
  // Adapter contract: this metadata is what the envelope rules run on. An
  // adapter that omits or hollows it must fail LOUDLY here — checking mere
  // presence would let `errors: []` or `rawData: undefined` pass vacuously.
  if (adapter.binding === "graphql") {
    if (
      !Array.isArray(outcome.errors) ||
      outcome.errors.length === 0 ||
      typeof outcome.hasData !== "boolean"
    ) {
      failures.push(
        "adapter contract: a GraphQL error outcome must carry a non-empty errors[] (each {message, code?}) and a boolean hasData — the envelope rules cannot run without them",
      );
    } else {
      for (const error of outcome.errors) {
        if (error?.code !== undefined && typeof error.code !== "string") {
          failures.push(
            "adapter contract: a GraphQL error entry's code must be a string when present",
          );
        }
      }
      // §7 rules stated over the REPORTED envelope too, not only the wire
      // (createGraphqlAdapter checks the wire; a custom adapter never goes
      // through it): the coded/codeless categories are exclusive, and a
      // codeless envelope on an executed response hides its protocol code.
      const codedCount = outcome.errors.filter(
        (error) => typeof error?.code === "string",
      ).length;
      if (codedCount > 0 && codedCount < outcome.errors.length) {
        failures.push(
          "the envelope mixes coded and codeless errors (SPEC.md 7 categories are exclusive)",
        );
      }
      if (codedCount === 0 && outcome.hasData === true) {
        failures.push(
          "an executed operation's error must carry a protocol code (SPEC.md 7)",
        );
      }
    }
  }
  if (adapter.binding === "rest" && outcome.errorBody === undefined) {
    failures.push(
      "adapter contract: a REST error outcome must carry errorBody — the closed error envelope cannot be validated without it",
    );
  }
  // SPEC.md 7's HTTP status rules live HERE, in the common helper, not only
  // inside createGraphqlAdapter — a custom adapter reporting a coded error
  // at 400 must fail whichever expectation branch evaluates it.
  if (adapter.binding === "graphql" && Array.isArray(outcome.errors)) {
    const coded = graphqlErrorCodes(outcome).length > 0;
    if (coded && outcome.status !== 200) {
      failures.push(
        `SPEC.md 7: a coded GraphQL error must be delivered at HTTP 200, got ${outcome.status}`,
      );
    }
    if (!coded && outcome.status !== 200 && outcome.status !== 400) {
      failures.push(
        `SPEC.md 7: a codeless request rejection must be HTTP 200 or 400, got ${outcome.status}`,
      );
    }
  }
  // The normalized outcome.code is DERIVED state — an adapter asserting a
  // different code than its own reported envelope could steer the runner
  // into the wrong expectation branch (e.g. fake VERIFICATION_FAILED to
  // enter allowCodes). Cross-check it against the envelope on both bindings.
  if (adapter.binding === "graphql" && Array.isArray(outcome.errors)) {
    const derived = graphqlErrorCodes(outcome)[0] ?? "INVALID_REQUEST";
    if (outcome.code !== derived) {
      failures.push(
        `adapter contract: outcome.code (${outcome.code}) disagrees with the reported errors[] (${derived}) — the normalized code must be derived, never asserted`,
      );
    }
  }
  if (
    adapter.binding === "rest" &&
    outcome.errorBody !== undefined &&
    typeof outcome.errorBody?.error?.code === "string" &&
    outcome.code !== outcome.errorBody.error.code
  ) {
    failures.push(
      `adapter contract: outcome.code (${outcome.code}) disagrees with errorBody.error.code (${outcome.errorBody.error.code})`,
    );
  }
  const forbidden = forbiddenTokens({ input, adapter, credentials });
  const messages =
    adapter.binding === "graphql"
      ? Array.isArray(outcome.errors)
        ? outcome.errors.map((error) => error?.message)
        : []
      : [outcome.errorBody?.error?.message].filter(
          (message) => message !== undefined,
        );
  failures.push(
    ...messageHygieneFailures(messages, forbidden, "error envelope"),
  );
  // SPEC.md 6: the REST error envelope is CLOSED — validate the whole body,
  // so a leak attached beside `error` fails instead of riding out unseen.
  if (outcome.errorBody !== undefined && validate) {
    const validator = validate("ProtocolErrorResponse");
    if (validator && !validator(outcome.errorBody)) {
      failures.push(
        `error envelope does not validate against ProtocolErrorResponse: ${JSON.stringify(validator.errors?.slice(0, 2))}`,
      );
    }
  }
  return failures;
}

function evaluateExpectation({
  outcome,
  expect,
  operationName,
  adapter,
  validate,
  input,
  credentials,
}) {
  const failures = [];
  // Every code the envelope carried, derived from the unified structure. An
  // EMPTY list falls back to the normalized outcome.code: a codeless
  // server-auth rejection normalizes to INVALID_REQUEST, and that must fail
  // a vector expecting UNAUTHORIZED, not skip the loop entirely.
  const envelopeCodes = (candidate) => {
    const derived =
      adapter.binding === "graphql" ? graphqlErrorCodes(candidate) : [];
    return derived.length ? derived : [candidate.code];
  };
  if (expect.kind === "error") {
    if (outcome.kind !== "error") {
      failures.push(
        `expected an error, got ${outcome.kind}${outcome.detail ? `: ${outcome.detail}` : ""}`,
      );
      return failures;
    }
    failures.push(
      ...errorEnvelopeFailures({
        outcome,
        adapter,
        validate,
        input,
        credentials,
      }),
    );
    for (const code of envelopeCodes(outcome)) {
      if (!expect.codes.includes(code)) {
        failures.push(
          `expected one of [${expect.codes.join(", ")}], got ${code}`,
        );
      }
    }
    // SPEC.md 7: a pre-execution refusal (server-role auth, decided before
    // the document executes) omits the data member entirely.
    if (
      expect.preExecution &&
      adapter.binding === "graphql" &&
      outcome.hasData
    ) {
      failures.push(
        "a pre-execution refusal must omit the data member (SPEC.md 7)",
      );
    }
    failures.push(...checkErrorOutcome(outcome, operationName, adapter));
    return failures;
  }
  // The allowCodes gate keys on the DERIVED code, so an adapter cannot
  // assert a permitted code to smuggle a different envelope into this branch.
  const normalizedCode =
    outcome.kind !== "error"
      ? undefined
      : adapter.binding === "graphql"
        ? (graphqlErrorCodes(outcome)[0] ?? "INVALID_REQUEST")
        : typeof outcome.errorBody?.error?.code === "string"
          ? outcome.errorBody.error.code
          : outcome.code;
  if (outcome.kind === "error" && expect.allowCodes?.includes(normalizedCode)) {
    // The verdict is unreachable without store credentials, but the error is
    // still a full protocol error: its envelope, message hygiene, status,
    // and declaration all stay contract — this branch is not a side door.
    failures.push(
      ...errorEnvelopeFailures({
        outcome,
        adapter,
        validate,
        input,
        credentials,
      }),
    );
    for (const code of envelopeCodes(outcome)) {
      if (!expect.allowCodes.includes(code)) {
        failures.push(
          `expected one of [${expect.allowCodes.join(", ")}], got ${code}`,
        );
      }
    }
    failures.push(...checkErrorOutcome(outcome, operationName, adapter));
    return failures;
  }
  if (outcome.kind !== "result") {
    failures.push(
      `expected a result, got ${outcome.kind}${outcome.code ? ` (${outcome.code})` : ""}${outcome.detail ? `: ${outcome.detail}` : ""}`,
    );
    return failures;
  }
  return failures;
}

function evaluateResultChecks({ outcome, expect, adapter, validate, input }) {
  const failures = [];
  if (outcome.kind !== "result") return failures;
  if (expect.schema) {
    const validator = validate(expect.schema);
    if (!validator) {
      failures.push(`no bundle definition for ${expect.schema}`);
    } else if (!validator(outcome.data)) {
      failures.push(
        `result does not validate against ${expect.schema}: ${JSON.stringify(validator.errors?.slice(0, 3))}`,
      );
    }
  }
  if (expect.resultSubset) {
    for (const [member, value] of Object.entries(expect.resultSubset)) {
      const actual =
        outcome.data && typeof outcome.data === "object"
          ? outcome.data[member]
          : undefined;
      if (stableStringify(actual) !== stableStringify(value)) {
        failures.push(
          `result.${member} must equal ${JSON.stringify(value)}, got ${JSON.stringify(actual)}`,
        );
      }
    }
  }
  for (const check of expect.checks ?? []) {
    if (check === "tokenless") {
      // Primary enforcement is the CLOSED result schema (validated above): a
      // rawReceipt or provider-internal id fails validation, no name list
      // required. This heuristic scan is defence-in-depth for the open parts
      // of the response tree only.
      const leaks = findTokenMembers(outcome.data);
      if (leaks.length) {
        failures.push(`token members in response: ${leaks.join(", ")}`);
      }
    } else if (check === "statusConsistency") {
      failures.push(...statusInvariants(outcome.data));
    } else if (check === "entitlementsConsistency") {
      failures.push(...entitlementsInvariants(outcome.data, input));
    } else if (check === "declaresTestedBinding") {
      const bindings =
        outcome.data && typeof outcome.data === "object"
          ? outcome.data.bindings
          : undefined;
      if (typeof bindings?.[adapter.binding] !== "string") {
        failures.push(
          `capability descriptor does not declare the ${adapter.binding} binding it just answered on`,
        );
      }
    } else {
      failures.push(`unknown check: ${check}`);
    }
  }
  return failures;
}

/**
 * Probes the GraphQL binding as a real executor, not an operationName-only
 * dispatcher. Sends documents a dispatcher that ignores `query` would mishandle
 * — a parse error, a field the schema does not define, a variable of the wrong
 * type — plus an introspection query that must agree with the projection.
 */
/** Renders an introspection type reference back into SDL notation. */
function typeRefString(ref) {
  if (!ref || typeof ref !== "object") return null;
  if (ref.kind === "NON_NULL") {
    const inner = typeRefString(ref.ofType);
    return inner === null ? null : `${inner}!`;
  }
  if (ref.kind === "LIST") {
    const inner = typeRefString(ref.ofType);
    return inner === null ? null : `[${inner}]`;
  }
  return typeof ref.name === "string" ? ref.name : null;
}

/**
 * Compares a served __schema against the generated structural signature, as a
 * subset: every type, field, argument, input member, and enum value the
 * signature names must be served with the exact kind, type string (including
 * nullability), and — for closed enums and objects — the exact member set.
 * Extra types, fields on open objects, and NULLABLE arguments or input members
 * are compatible MINOR additions; an extra non-null argument or input member
 * would break existing callers and fails.
 */
function compareIntrospection(servedSchema) {
  const failures = [];
  const servedTypes = new Map(
    (servedSchema?.types ?? [])
      .filter((type) => typeof type?.name === "string")
      .map((type) => [type.name, type]),
  );
  if (servedTypes.size === 0) {
    failures.push(
      "introspection neither returned the schema types nor rejected as a well-formed request-level failure",
    );
    return failures;
  }
  for (const [rootKind, expectedName] of [
    ["queryType", introspectionSignature.queryType],
    ["mutationType", introspectionSignature.mutationType],
  ]) {
    if (expectedName && servedSchema?.[rootKind]?.name !== expectedName) {
      failures.push(
        `introspection ${rootKind} is ${JSON.stringify(servedSchema?.[rootKind]?.name)}, the projection's is ${expectedName}`,
      );
    }
  }
  for (const [typeName, expected] of Object.entries(
    introspectionSignature.types,
  )) {
    const served = servedTypes.get(typeName);
    if (!served) {
      failures.push(`introspection is missing type ${typeName}`);
      continue;
    }
    if (served.kind !== expected.kind) {
      failures.push(
        `type ${typeName} is served as ${served.kind}, the projection defines ${expected.kind}`,
      );
      continue;
    }
    if (expected.kind === "OBJECT") {
      const servedFields = new Map(
        (served.fields ?? []).map((field) => [field.name, field]),
      );
      if (expected.closed) {
        for (const fieldName of servedFields.keys()) {
          if (!Object.hasOwn(expected.fields, fieldName)) {
            failures.push(
              `closed type ${typeName} serves undeclared field ${fieldName}`,
            );
          }
        }
      }
      for (const [fieldName, expectedField] of Object.entries(
        expected.fields,
      )) {
        const servedField = servedFields.get(fieldName);
        if (!servedField) {
          failures.push(`type ${typeName} is missing field ${fieldName}`);
          continue;
        }
        const servedType = typeRefString(servedField.type);
        if (servedType !== expectedField.type) {
          failures.push(
            `${typeName}.${fieldName} is served as ${servedType}, the projection defines ${expectedField.type}`,
          );
        }
        const servedArgs = new Map(
          (servedField.args ?? []).map((arg) => [arg.name, arg]),
        );
        for (const [argName, expectedArg] of Object.entries(
          expectedField.args ?? {},
        )) {
          const servedArg = servedArgs.get(argName);
          const servedArgType = servedArg
            ? typeRefString(servedArg.type)
            : null;
          if (servedArgType !== expectedArg) {
            failures.push(
              `${typeName}.${fieldName}(${argName}:) is served as ${servedArgType}, the projection defines ${expectedArg}`,
            );
          }
        }
        for (const [argName, servedArg] of servedArgs) {
          if (Object.hasOwn(expectedField.args ?? {}, argName)) continue;
          // An unrenderable ref (deeper than the probe fragment, or
          // malformed) must FAIL CLOSED: only a provably nullable extra
          // argument is a compatible addition.
          const servedArgType = typeRefString(servedArg.type);
          if (servedArgType === null || servedArgType.endsWith("!")) {
            failures.push(
              `${typeName}.${fieldName} adds an argument ${argName}: ${String(servedArgType)} that is required or unrenderable, which breaks existing callers`,
            );
          }
        }
      }
    } else if (expected.kind === "INPUT_OBJECT") {
      const servedFields = new Map(
        (served.inputFields ?? []).map((field) => [field.name, field]),
      );
      for (const [fieldName, expectedType] of Object.entries(
        expected.inputFields,
      )) {
        const servedField = servedFields.get(fieldName);
        const servedType = servedField ? typeRefString(servedField.type) : null;
        if (servedType !== expectedType) {
          failures.push(
            `input ${typeName}.${fieldName} is served as ${servedType}, the projection defines ${expectedType}`,
          );
        }
      }
      for (const [fieldName, servedField] of servedFields) {
        if (Object.hasOwn(expected.inputFields, fieldName)) continue;
        // Fail closed on an unrenderable ref, as for arguments above.
        const servedType = typeRefString(servedField.type);
        if (servedType === null || servedType.endsWith("!")) {
          failures.push(
            `input ${typeName} adds a member ${fieldName}: ${String(servedType)} that is required or unrenderable, which breaks existing callers`,
          );
        }
      }
    } else if (expected.kind === "ENUM") {
      // Closed enumeration: adding OR removing a value is MAJOR (SPEC.md 12).
      const servedValues = (served.enumValues ?? [])
        .map((value) => value.name)
        .sort();
      if (stableStringify(servedValues) !== stableStringify(expected.values)) {
        failures.push(
          `enum ${typeName} serves ${JSON.stringify(servedValues)}, the projection defines ${JSON.stringify(expected.values)}`,
        );
      }
    }
  }
  return failures;
}

async function probeGraphqlExecutor(
  adapter,
  forbidden = [],
  probeRole = "server",
) {
  const failures = [];
  if (probeRole !== "server" && probeRole !== "verification") {
    return [
      "no credentialed role is available to probe the executor — pass the credentials this provider issues",
    ];
  }
  // Probe an operation authorized by a role the provider actually exposes;
  // otherwise a valid FORBIDDEN response looks like an executor failure.
  const target =
    probeRole === "server"
      ? {
          name: "SubscriptionStatus",
          field: "subscriptionStatus",
          inputType: "SubscriptionStatusInput",
          validInput: { userId: "executor-probe" },
          resultField: "active",
        }
      : {
          name: "VerifyPurchase",
          field: "verifyPurchase",
          inputType: "VerifyPurchaseInput",
          validInput: { store: "a_store_openiap_has_never_heard_of" },
          resultField: "isValid",
        };
  const send = (payload, credential = null) =>
    adapter.rawGraphql(payload, credential);
  const isRequestRejection = (result) =>
    isWellFormedRequestRejection(result.status, result.body);
  // SPEC.md 8 hygiene on the probes' own responses — the same helper the
  // vector envelope checks use, so a credential echoed only into a probe
  // rejection (a path no vector exercises) still fails.
  const hygiene = (result, label) =>
    messageHygieneFailures(
      Array.isArray(result.body?.errors)
        ? result.body.errors.map((error) => error?.message)
        : [],
      forbidden,
      label,
    );

  // 1. A BROKEN query text paired with a real operationName and valid
  // variables and credential. A real executor parses the query and fails; a
  // dispatcher that ignores the query text and keys on operationName would run
  // the selected operation and return data. Returning data here is the tell.
  const broken = await send(
    {
      query: "this is not graphql at all {{{",
      operationName: target.name,
      variables: { input: target.validInput },
    },
    probeRole,
  );
  failures.push(...hygiene(broken, "probe: syntactically invalid query"));
  if (broken.body?.data !== undefined || !isRequestRejection(broken)) {
    failures.push(
      "a syntactically invalid query was executed (operationName-only dispatch?)",
    );
  }

  // 2. A syntactically valid query that selects a field the result type does
  // not define, again with a real operationName. A real executor rejects it at
  // validation; a dispatcher returns data.
  const unknownField = await send(
    {
      query: `query ${target.name}($input: ${target.inputType}!) { ${target.field}(input: $input) { thisFieldDoesNotExist } }`,
      operationName: target.name,
      variables: { input: target.validInput },
    },
    probeRole,
  );
  failures.push(...hygiene(unknownField, "probe: undefined field"));
  if (
    unknownField.body?.data !== undefined ||
    !isRequestRejection(unknownField)
  ) {
    failures.push(
      "a query selecting an undefined field was executed (no validation?)",
    );
  }

  // 3. An input variable of the wrong SHAPE (a scalar where the schema expects
  // an input object) must fail graphql-js input coercion.
  const badVariable = await send(
    {
      query: `query ${target.name}($input: ${target.inputType}!) { ${target.field}(input: $input) { ${target.resultField} } }`,
      operationName: target.name,
      variables: { input: "not-an-input-object" },
    },
    probeRole,
  );
  failures.push(...hygiene(badVariable, "probe: mistyped variable"));
  if (
    badVariable.body?.data?.[target.field] !== undefined ||
    !isRequestRejection(badVariable)
  ) {
    failures.push("a mistyped input variable was not rejected");
  }
  // SPEC.md 8: messages never contain submitted evidence. graphql-js coercion
  // messages echo the whole variable value, so a provider that passes them
  // through verbatim would echo a JWS or purchase token the same way.
  if (JSON.stringify(badVariable.body ?? {}).includes("not-an-input-object")) {
    failures.push(
      "a request error echoes the submitted input value back (SPEC.md 8 forbids evidence in error messages)",
    );
  }

  // 4. Introspection must agree with the projection STRUCTURALLY (SPEC.md 7):
  // names alone would miss a retyped argument, flipped nullability, a dropped
  // input member, or a mutated closed enum. The generated signature is
  // compared as a subset — everything it names must be served identically;
  // MINOR additions are limited to new types, open-object fields, and nullable
  // arguments or input members (SPEC.md 12).
  const TYPE_REF =
    "kind name ofType { kind name ofType { kind name ofType { kind name ofType { kind name } } } }";
  // Use the same credential as probes 1-3 because production providers may
  // gate introspection behind authentication.
  const introspection = await send(
    {
      query: `query { __schema { queryType { name } mutationType { name } types { name kind fields(includeDeprecated: true) { name args { name type { ${TYPE_REF} } } type { ${TYPE_REF} } } inputFields { name type { ${TYPE_REF} } } enumValues(includeDeprecated: true) { name } } } }`,
    },
    probeRole,
  );
  // SPEC.md 7: "Introspection, WHERE ENABLED, must agree" — a provider that
  // disables introspection (a common production default) answers this with a
  // WELL-FORMED §7 request-level rejection and skips the agreement check;
  // probes 1-3 still certify the executor. Anything else — an HTTP 500, a
  // coded 400, a bodiless response — is a failure, not a disabled feature.
  const introspectionDisabled = isWellFormedRequestRejection(
    introspection.status,
    introspection.body,
  );
  failures.push(...hygiene(introspection, "probe: introspection"));
  if (introspectionDisabled) {
    // Nothing to compare.
  } else {
    failures.push(...compareIntrospection(introspection.body?.data?.__schema));
  }
  return failures;
}

/** Reads the provider's capability outcome once for gating and certification. */
async function readCapabilityOutcome(adapter) {
  try {
    const returned = await adapter.request({
      operation: "providerCapabilities",
      input: null,
      credential: null,
    });
    return returned &&
      typeof returned === "object" &&
      typeof returned.kind === "string"
      ? returned
      : {
          kind: "invalid",
          status: 0,
          detail: `adapter contract: request() returned ${JSON.stringify(returned) ?? String(returned)} instead of an outcome`,
        };
  } catch (error) {
    return {
      kind: "invalid",
      status: 0,
      detail: `adapter threw: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

const majorOf = (version) => String(version ?? "").split(".")[0];

/**
 * Checks the descriptor's declared versions agree with the generated manifest.
 * SPEC.md §3 and §12: the spec, every profile, and every binding version as
 * MAJOR.MINOR, and a caller pins on the MAJOR. A newer compatible minor — the
 * provider serves a superset the runner still understands — MUST certify, so
 * this compares majors and never exact strings. A different major is the trap
 * (a silently incompatible surface) and is what fails.
 */
function checkVersionAgreement(capabilities, adapter) {
  const failures = [];
  if (!capabilities) return failures;
  if (
    majorOf(capabilities.specVersion) !==
    majorOf(httpBindingManifest.protocolVersion)
  ) {
    failures.push(
      `specVersion ${capabilities.specVersion} disagrees with protocol major of ${httpBindingManifest.protocolVersion}`,
    );
  }
  for (const [name, version] of Object.entries(capabilities.profiles ?? {})) {
    const declared = httpBindingManifest.profiles[name];
    if (declared !== undefined && majorOf(declared) !== majorOf(version)) {
      failures.push(
        `profile ${name} major ${majorOf(version)} disagrees with manifest ${declared}`,
      );
    }
  }
  const bindingVersion = capabilities.bindings?.[adapter.binding];
  const manifestBinding = httpBindingManifest.bindings[adapter.binding];
  if (
    bindingVersion !== undefined &&
    manifestBinding !== undefined &&
    majorOf(bindingVersion) !== majorOf(manifestBinding)
  ) {
    failures.push(
      `binding ${adapter.binding} major ${majorOf(bindingVersion)} disagrees with manifest ${manifestBinding}`,
    );
  }
  return failures;
}

/**
 * Certifies a declared `events` profile against the §9 rules the vectors can
 * express, not just positive signing — a provider that ships only a signer
 * does not implement the profile. Each adapter method is exercised against
 * the published vectors:
 *
 * - `sign`            §9.4.2 — reproduce every expected signature
 * - `verify`          §9.4.2 — accept a valid delivery inside the clock-skew
 *                      tolerance in both directions, accept a rotated header
 *                      while holding either key alone, and reject every
 *                      rejection vector (tamper, wrong key, stale timestamp,
 *                      body-only signature, reused retry signature,
 *                      garbage-appended signature)
 * - `delivery`        §9.4.1 — a POST application/json envelope with the four
 *                      headers, eventId and delivery-id stable across a retry
 *                      while timestamp and signature refresh
 * - `classifyResponse §9.4.3 — map every consumer status, plus timeout and
 *                      connection error, to delivered / retry / permanent-failure
 * - `entitled`        §2.3   — the entitlement gate, on every lifecycle vector
 * - `emission`        §9.1   — emit the right event list for a lifecycle change
 * - `coalesceAtBinding §2.4  — coalesce unbound gate deltas at first binding
 *
 * A missing method is a conformance failure, so a signing-only adapter fails.
 * SPEC.md 11.3 names the §9 rules that stay OUTSIDE this surface (§9.2
 * mapping, §9.3 document schema, §9.4.4 backoff, §9.4.5 destination safety).
 */
async function checkEventsProfile(capabilities, eventsAdapter, lifecycle) {
  const failures = [];
  if (!capabilities?.profiles?.events) return failures;
  if (!eventsAdapter || typeof eventsAdapter.sign !== "function") {
    failures.push(
      "events profile is declared but no eventsAdapter.sign was supplied to verify signature and delivery vectors",
    );
    return failures;
  }
  for (const method of [
    "verify",
    "delivery",
    "classifyResponse",
    "entitled",
    "emission",
    "coalesceAtBinding",
  ]) {
    if (typeof eventsAdapter[method] !== "function") {
      failures.push(
        `events profile requires eventsAdapter.${method} (SPEC.md §9); a signing-only provider does not implement the events profile`,
      );
    }
  }

  const headerNames = signatureVectors.headers ?? {};

  // §9.4.2 produce: reproduce every expected signature.
  for (const vector of signatureVectors.cases ?? []) {
    // During rotation the emitter signs with the current and previous secrets
    // and joins them; the single-key signer is the adapter's job, composing
    // the header is the transport rule's, so the runner composes it here.
    const secrets = [vector.secret];
    if (vector.previousSecret) secrets.push(vector.previousSecret);
    const signed = (
      await Promise.all(
        secrets.map((secret) =>
          eventsAdapter.sign({
            secret,
            timestamp: vector.timestamp,
            body: vector.body,
          }),
        ),
      )
    ).join(",");
    if (signed !== vector.expected) {
      failures.push(
        `signature vector ${vector.name ?? vector.expected}: got ${signed}, expected ${vector.expected}`,
      );
    }
  }

  // §9.4.2 consumer rules: accept a valid delivery and reject every rejection.
  if (typeof eventsAdapter.verify === "function") {
    const tolerance = signatureVectors.toleranceSeconds;
    for (const vector of signatureVectors.cases ?? []) {
      const secrets = [vector.secret];
      if (vector.previousSecret) secrets.push(vector.previousSecret);
      const header = vector.presentedHeader ?? vector.expected;
      // SPEC.md 9.4.2 rule 1 rejects only |now - timestamp| > tolerance, so
      // the boundary itself is INSIDE: exactly ±tolerance must be accepted
      // (a >= comparison must not certify) and ±(tolerance+1) must be
      // rejected (a > tolerance+1 comparison must not certify either).
      for (const [now, label] of [
        [vector.timestamp, "no skew"],
        [vector.timestamp + tolerance, `+${tolerance}s skew`],
        [vector.timestamp - tolerance, `-${tolerance}s skew`],
      ]) {
        const accepted = await eventsAdapter.verify({
          body: vector.body,
          timestamp: vector.timestamp,
          signature: header,
          secrets,
          now,
        });
        if (!accepted) {
          failures.push(
            `signature case ${vector.name} (${label}): |now - timestamp| <= ${tolerance} must be accepted`,
          );
        }
      }
      for (const [now, label] of [
        [vector.timestamp + tolerance + 1, `+${tolerance + 1}s skew`],
        [vector.timestamp - tolerance - 1, `-${tolerance + 1}s skew`],
      ]) {
        const accepted = await eventsAdapter.verify({
          body: vector.body,
          timestamp: vector.timestamp,
          signature: header,
          secrets,
          now,
        });
        if (accepted) {
          failures.push(
            `signature case ${vector.name} (${label}): |now - timestamp| > ${tolerance} must be rejected as stale`,
          );
        }
      }
      // §9.4.2 rule 2: a receiver holding EITHER key alone must accept the
      // rotated header — any presented signature matching any held secret is
      // enough. Checking only one side would let an all-must-match verifier
      // pass.
      if (vector.previousSecret) {
        for (const [held, label] of [
          [vector.previousSecret, "previous"],
          [vector.secret, "current"],
        ]) {
          const rotated = await eventsAdapter.verify({
            body: vector.body,
            timestamp: vector.timestamp,
            signature: header,
            secrets: [held],
            now: vector.timestamp,
          });
          if (!rotated) {
            failures.push(
              `rotation ${vector.name}: a receiver holding only the ${label} secret must accept a rotated header`,
            );
          }
        }
      }
    }
    for (const rejection of signatureVectors.rejections ?? []) {
      const accepted = await eventsAdapter.verify({
        body: rejection.body,
        timestamp: rejection.timestamp,
        signature: rejection.presentedSignature,
        secrets: [rejection.secret],
        now: rejection.receiverNow ?? rejection.timestamp,
      });
      if (accepted) {
        failures.push(
          `signature rejection ${rejection.name ?? "case"} was accepted but must be rejected`,
        );
      }
    }
  }

  // §9.4.1 envelope: the four headers, and retry-chain stability.
  if (typeof eventsAdapter.delivery === "function") {
    const chains = new Map();
    for (const vector of signatureVectors.cases ?? []) {
      if (!vector.deliveryId) continue;
      const secrets = [vector.secret];
      if (vector.previousSecret) secrets.push(vector.previousSecret);
      const event = JSON.parse(vector.body);
      const composed = await eventsAdapter.delivery({
        event,
        body: vector.body,
        timestamp: vector.timestamp,
        secrets,
        deliveryId: vector.deliveryId,
      });
      // §9.4.1: the envelope is a POST with a JSON body — a GET or a
      // text/plain delivery is not the webhook contract, whatever it signs.
      if (composed?.method !== "POST") {
        failures.push(
          `delivery ${vector.name}: the envelope method must be POST, got ${String(composed?.method)}`,
        );
      }
      if (composed?.contentType !== "application/json") {
        failures.push(
          `delivery ${vector.name}: Content-Type must be application/json, got ${String(composed?.contentType)}`,
        );
      }
      const got = composed?.headers ?? {};
      // SPEC.md 9.4.1: Content-Encoding MUST be absent or identity —
      // transport compression makes "raw body bytes" ambiguous, so a gzip
      // delivery breaks signature verification by construction. EVERY header
      // whose name case-folds to content-encoding is checked (a second key
      // in a different casing must not slip past a first-match lookup), and
      // the value comparison is case-insensitive per RFC 9110 §8.4.1.
      for (const [name, value] of Object.entries(got)) {
        if (name.toLowerCase() !== "content-encoding") continue;
        if (String(value).trim().toLowerCase() !== "identity") {
          failures.push(
            `delivery ${vector.name}: Content-Encoding must be absent or identity, got ${String(value)}`,
          );
        }
      }
      const expectSig = vector.presentedHeader ?? vector.expected;
      const requiredHeaders = [
        [headerNames.signature, expectSig, "the signed header"],
        [
          headerNames.timestamp,
          String(vector.timestamp),
          "the signing timestamp in seconds",
        ],
        [headerNames.eventId, event.eventId, "body.eventId"],
        [headerNames.deliveryId, vector.deliveryId, "the attempt-chain id"],
      ];
      const normalizedHeaders = {};
      for (const [
        expectedName,
        expectedValue,
        description,
      ] of requiredHeaders) {
        const matches = Object.entries(got).filter(
          ([name]) => name.toLowerCase() === expectedName,
        );
        if (matches.length !== 1) {
          failures.push(
            `delivery ${vector.name}: ${expectedName} must occur exactly once, got ${matches.length}`,
          );
          continue;
        }
        normalizedHeaders[expectedName] = matches[0][1];
        if (String(matches[0][1]) !== String(expectedValue)) {
          failures.push(
            `delivery ${vector.name}: ${expectedName} must equal ${description}`,
          );
        }
      }
      const chain = chains.get(vector.deliveryId) ?? [];
      chain.push(normalizedHeaders);
      chains.set(vector.deliveryId, chain);
    }
    for (const [deliveryId, chain] of chains) {
      if (chain.length < 2) continue;
      const [first, next] = chain;
      if (first[headerNames.eventId] !== next[headerNames.eventId]) {
        failures.push(
          `retry chain ${deliveryId}: eventId changed across attempts`,
        );
      }
      if (
        String(first[headerNames.timestamp]) ===
        String(next[headerNames.timestamp])
      ) {
        failures.push(
          `retry chain ${deliveryId}: a retry must choose a fresh timestamp`,
        );
      }
      if (first[headerNames.signature] === next[headerNames.signature]) {
        failures.push(
          `retry chain ${deliveryId}: a retry must recompute the signature`,
        );
      }
    }
  }

  // §9.4.3 response semantics, exhaustively: every status from 200 to 599 is
  // classified and compared to the table's rule — sampling would let a
  // classifier mis-map an unprobed status (a 304 marked retryable would
  // follow a redirect's cache path forever). Timeout and connection error
  // (no status at all) map to retry.
  if (typeof eventsAdapter.classifyResponse === "function") {
    const ruleFor = (status) => {
      if (status >= 200 && status < 300) return "delivered";
      if (status === 408 || status === 429 || status >= 500) return "retry";
      return "permanent-failure";
    };
    for (let status = 200; status <= 599; status += 1) {
      const action = await eventsAdapter.classifyResponse(status);
      const expected = ruleFor(status);
      if (action !== expected) {
        failures.push(
          `response ${status}: expected ${expected}, got ${action}`,
        );
      }
    }
    // The published sample table must itself agree with the rule — a drifted
    // vectors file is a spec bug, not a provider bug, but fail loudly.
    for (const testCase of signatureVectors.responseSemantics?.cases ?? []) {
      if (ruleFor(testCase.status) !== testCase.action) {
        failures.push(
          `responseSemantics vector ${testCase.status} disagrees with the SPEC.md 9.4.3 rule`,
        );
      }
    }
    const noResponse = signatureVectors.responseSemantics?.connectionError;
    if (noResponse) {
      for (const sentinel of ["connection-error", "timeout"]) {
        const action = await eventsAdapter.classifyResponse(sentinel);
        if (action !== noResponse) {
          failures.push(
            `response ${sentinel}: expected ${noResponse}, got ${action}`,
          );
        }
      }
    }
  }

  // §2.3 entitlement gate: the predicate the emission rule flips on. Every
  // lifecycle vector — state, expiry boundary, missing expiry — must reproduce.
  if (typeof eventsAdapter.entitled === "function") {
    for (const testCase of lifecycle?.entitlement?.cases ?? []) {
      const got = await eventsAdapter.entitled({
        state: testCase.state,
        expiresAt: testCase.expiresAt,
        processedAt: testCase.processedAt,
      });
      if (got !== testCase.entitled) {
        failures.push(
          `entitlement ${testCase.name}: expected ${testCase.entitled}, got ${got}`,
        );
      }
    }
  }

  // §9.1 emission and §2.4 binding coalescing. Everything the adapter emits
  // is also checked against the descriptor's declared eventTypes (§10): a
  // provider that emits a type it never declared is dishonest about its
  // surface, whichever direction the mismatch runs.
  const declaredEventTypes = Array.isArray(capabilities.eventTypes)
    ? new Set(capabilities.eventTypes)
    : null;
  if (declaredEventTypes === null) {
    // Never skip silently: this row must not read as "honesty verified"
    // when the declaration the check compares against is missing entirely.
    failures.push(
      "events profile is declared but the descriptor carries no eventTypes array to check emissions against",
    );
  }
  const checkDeclared = (emitted, label) => {
    if (!declaredEventTypes || !Array.isArray(emitted)) return;
    for (const type of emitted) {
      if (!declaredEventTypes.has(type)) {
        failures.push(
          `${label} emits ${JSON.stringify(type)}, which the capability descriptor's eventTypes does not declare`,
        );
      }
    }
  };
  if (typeof eventsAdapter.emission === "function") {
    for (const testCase of lifecycle?.emission?.cases ?? []) {
      const emitted = await eventsAdapter.emission({
        lifecycleEvent: testCase.lifecycleEvent,
        entitledBefore: testCase.entitledBefore,
        entitledAfter: testCase.entitledAfter,
      });
      if (stableStringify(emitted) !== stableStringify(testCase.emit)) {
        failures.push(
          `emission ${testCase.name}: expected ${JSON.stringify(testCase.emit)}, got ${JSON.stringify(emitted)}`,
        );
      }
      checkDeclared(emitted, `emission ${testCase.name}`);
    }
  }
  if (typeof eventsAdapter.coalesceAtBinding === "function") {
    for (const testCase of lifecycle?.binding?.cases ?? []) {
      const emitted = await eventsAdapter.coalesceAtBinding({
        unboundGateChanges: testCase.unboundGateChanges,
        entitledAtBinding: testCase.entitledAtBinding,
      });
      checkDeclared(emitted, `binding ${testCase.name}`);
      if (stableStringify(emitted) !== stableStringify(testCase.emit)) {
        failures.push(
          `binding ${testCase.name}: expected ${JSON.stringify(testCase.emit)}, got ${JSON.stringify(emitted)}`,
        );
      }
    }
  }

  return failures;
}

/**
 * Runs every operation vector against each adapter, then checks that the
 * normalized outcome of every deterministic case agrees across bindings.
 * Returns `{ ok, results, parityFailures }`; nothing is thrown for a
 * conformance failure, so a caller can report all of them at once.
 */
export async function runConformance({
  adapters,
  Ajv,
  eventsAdapter,
  credentials,
}) {
  // The §8 credential-echo scan needs the AUTHORITATIVE credential values
  // from the caller — adapter-declared secrets alone could be emptied by a
  // non-conforming adapter, silently disabling the scan. Every role THIS RUN
  // exercises must be present (checked at first use below): passing only one
  // of two configured roles would leave the other credential unscanned,
  // while a legal partial-profile provider that never uses the server role
  // is not asked for a credential it does not have.
  const requireRoleCredential = (role) => {
    if (role === null || role === "invalid") return;
    const value = credentials?.[role];
    if (typeof value !== "string" || value.length === 0) {
      throw new Error(
        `runConformance needs credentials.${role}: this run exercises the ${role} role, and the SPEC.md 8 credential-echo scan cannot cover a credential it was not given`,
      );
    }
  };
  if (!Array.isArray(adapters) || adapters.length === 0) {
    throw new Error("runConformance needs at least one adapter");
  }
  const validate = buildValidator(Ajv);
  const results = [];
  const outcomesByCase = new Map();
  let cachedEventsFailures = null;

  const storeVectorIsEligible = (vector, capabilities, declaredStores) => {
    if (!vector.requiresStore || declaredStores === null) return true;
    if (!declaredStores.has(vector.requiresStore)) return false;
    return (
      !vector.requiresCapability ||
      capabilities?.stores?.[vector.requiresStore]?.[vector.requiresCapability]
        ?.implementation === true
    );
  };

  for (const adapter of adapters) {
    // SPEC.md 3 and 11.1 scope conformance to the profiles a provider
    // declares, so a partial-but-legal provider certifies the profiles it
    // serves instead of failing on operations it never claimed. `core`
    // (providerCapabilities) always runs.
    const capabilityOutcome = await readCapabilityOutcome(adapter);
    const capabilities =
      capabilityOutcome.kind === "result" &&
      capabilityOutcome.data &&
      typeof capabilityOutcome.data === "object"
        ? capabilityOutcome.data
        : null;
    const declaredProfiles =
      capabilities?.profiles && typeof capabilities.profiles === "object"
        ? new Set(Object.keys(capabilities.profiles))
        : null;
    const declaredStores =
      capabilities?.stores && typeof capabilities.stores === "object"
        ? new Set(Object.keys(capabilities.stores))
        : null;

    // Adapter contract: the credential values feed the SPEC.md 8 message
    // scan. An adapter without them would skip credential-echo detection
    // silently, so their absence is itself a failure.
    if (!Array.isArray(adapter.secrets)) {
      results.push({
        id: "adapter.contract",
        binding: adapter.binding,
        ok: false,
        failures: [
          "the adapter exposes no secrets: string[] (the configured credential values) — credential echo in error messages cannot be detected without them",
        ],
      });
    }

    const versionFailures = checkVersionAgreement(capabilities, adapter);
    results.push({
      id: "capabilities.version-agreement",
      binding: adapter.binding,
      ok: versionFailures.length === 0,
      failures: versionFailures,
    });
    for (const [profile, operation] of [
      ["verification", "verifyPurchase"],
      ["accountLifecycle", "bindPurchase"],
    ]) {
      if (!declaredProfiles?.has(profile) || declaredStores === null) continue;
      const hasEligibleStoreVector = operationVectors.cases.some(
        (vector) =>
          vector.operation === operation &&
          vector.requiresStore &&
          storeVectorIsEligible(vector, capabilities, declaredStores),
      );
      if (!hasEligibleStoreVector) {
        results.push({
          id: `${profile}.store-coverage`,
          binding: adapter.binding,
          ok: false,
          failures: [
            `the ${profile} profile declares no store capability this ${operationVectors.protocolVersion} runner can exercise`,
          ],
        });
      }
    }
    // The events obligations are transport-independent (signing, delivery,
    // emission — no binding involved), so the vectors run ONCE and the
    // verdict is reused for each binding's report row rather than re-driving
    // 400+ classifier calls per adapter.
    let eventsFailures;
    if (cachedEventsFailures !== null) {
      eventsFailures = cachedEventsFailures;
    } else {
      try {
        eventsFailures = await checkEventsProfile(
          capabilities,
          eventsAdapter,
          lifecycleVectors,
        );
      } catch (error) {
        eventsFailures = [
          `events verification threw: ${error instanceof Error ? error.message : String(error)}`,
        ];
      }
      if (capabilities?.profiles?.events) {
        cachedEventsFailures = eventsFailures;
      }
    }
    if (capabilities?.profiles?.events) {
      results.push({
        id: "events.profile-verification",
        binding: adapter.binding,
        ok: eventsFailures.length === 0,
        failures: eventsFailures,
      });
    }

    // The GraphQL binding must be a real executor, not an operationName
    // dispatcher: probe it with documents the canonical queries never send.
    // A GraphQL adapter without rawGraphql cannot be probed, and skipping the
    // probe silently would grant "GraphQL-conformant" with zero executor
    // evidence — so the missing capability is itself a failure.
    if (adapter.binding === "graphql") {
      let probeFailures;
      if (typeof adapter.rawGraphql !== "function") {
        probeFailures = [
          "the adapter exposes no rawGraphql(payload, credential) method, so the executor probe cannot run — use createGraphqlAdapter or implement rawGraphql",
        ];
      } else {
        try {
          probeFailures = await probeGraphqlExecutor(
            adapter,
            forbiddenTokens({ input: undefined, adapter, credentials }),
            // A legal partial-profile provider may hold no server
            // credential; the probes only need SOME accepted bearer.
            typeof credentials?.server === "string" && credentials.server
              ? "server"
              : typeof credentials?.verification === "string" &&
                  credentials.verification
                ? "verification"
                : null,
          );
        } catch (error) {
          probeFailures = [
            `executor probe threw: ${error instanceof Error ? error.message : String(error)}`,
          ];
        }
      }
      results.push({
        id: "graphql.executor-probe",
        binding: adapter.binding,
        ok: probeFailures.length === 0,
        failures: probeFailures,
      });
    }

    let capabilitySnapshotPending = true;
    for (const vector of operationVectors.cases) {
      if (vector.bindings && !vector.bindings.includes(adapter.binding)) {
        continue;
      }
      const profile = operationsByName.get(vector.operation)?.profile;
      if (
        profile !== undefined &&
        profile !== "core" &&
        declaredProfiles !== null &&
        !declaredProfiles.has(profile)
      ) {
        continue;
      }
      if (!storeVectorIsEligible(vector, capabilities, declaredStores)) {
        continue;
      }
      const attempts = [];
      for (let attempt = 0; attempt < (vector.repeat ?? 1); attempt += 1) {
        requireRoleCredential(vector.credential);
        // One adapter throw (a dropped connection, a missing credential) must
        // become that case's failure, never abort the run and discard every
        // other collected result — and a malformed RETURN (null, a non-object,
        // an outcome without kind) is the same class of fault, not a crash.
        try {
          let returned;
          if (
            vector.operation === "providerCapabilities" &&
            capabilitySnapshotPending
          ) {
            returned = capabilityOutcome;
            capabilitySnapshotPending = false;
          } else {
            returned = await adapter.request({
              operation: vector.operation,
              input: vector.input,
              credential: vector.credential,
            });
          }
          attempts.push(
            returned &&
              typeof returned === "object" &&
              typeof returned.kind === "string"
              ? returned
              : {
                  kind: "invalid",
                  status: 0,
                  detail: `adapter contract: request() returned ${JSON.stringify(returned) ?? String(returned)} instead of an outcome`,
                },
          );
        } catch (error) {
          attempts.push({
            kind: "invalid",
            status: 0,
            detail: `adapter threw: ${error instanceof Error ? error.message : String(error)}`,
          });
        }
      }
      const outcome = attempts[0];
      const failures = evaluateExpectation({
        outcome,
        expect: vector.expect,
        operationName: vector.operation,
        adapter,
        validate,
        input: vector.input,
        credentials,
      });
      if (
        vector.operation === "providerCapabilities" &&
        outcome.kind === "result" &&
        capabilities !== null &&
        stableStringify(outcome.data) !== stableStringify(capabilities)
      ) {
        failures.push(
          "providerCapabilities changed during the conformance run; the descriptor used for profile/store gating must be the descriptor being certified",
        );
      }
      // A real executor cannot answer a field the canonical document never
      // selected — an unrequested member on the GraphQL binding is fabricated
      // and must fail HERE, before projection could erase it from parity.
      // Judged on the PRE-normalization shape: a fabricated `member: null`
      // vanishes in normalizeResultData, so the normalized data cannot show it.
      if (adapter.binding === "graphql" && outcome.kind === "result") {
        // Value check, not presence: `rawData: undefined` must fail the
        // contract just like a missing member would.
        if (outcome.rawData === undefined) {
          failures.push(
            "adapter contract: a GraphQL result outcome must carry rawData (the pre-normalization shape) — the unrequested-member check cannot run without it",
          );
        }
        const tree = graphqlOperations.operations[vector.operation]?.selection;
        if (tree && typeof tree === "object") {
          for (const member of extraMembers(
            outcome.rawData ?? outcome.data,
            tree,
          )) {
            failures.push(
              `GraphQL returned ${member}, which the canonical document never requested`,
            );
          }
        }
      }
      try {
        failures.push(
          ...evaluateResultChecks({
            outcome,
            expect: vector.expect,
            adapter,
            validate,
            input: vector.input,
          }),
        );
      } catch (error) {
        // A malformed provider response must surface as a conformance
        // failure, never crash the whole run.
        failures.push(
          `result check threw: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      if (attempts.length > 1) {
        const ignore = vector.expect.ignoreMembers;
        const normalized = attempts.map((attempt) =>
          stableStringify(
            attempt.kind === "result"
              ? withoutMembers(attempt.data, ignore)
              : attempt,
          ),
        );
        if (new Set(normalized).size !== 1) {
          failures.push("repeated invocation was not idempotent");
        }
      }
      results.push({
        id: vector.id,
        binding: adapter.binding,
        ok: failures.length === 0,
        failures,
      });
      if (!vector.bindings) {
        const perBinding = outcomesByCase.get(vector.id) ?? new Map();
        perBinding.set(adapter.binding, {
          outcome,
          ignore: vector.expect.ignoreMembers,
          operation: vector.operation,
        });
        outcomesByCase.set(vector.id, perBinding);
      }
    }
  }

  const parityFailures = [];
  for (const [caseId, perBinding] of outcomesByCase) {
    if (perBinding.size < 2) continue;
    // Parity is judged on the GENERATED canonical selection tree — this
    // protocol version's contract shape. A 1.x provider may add optional
    // members on an open result object (SPEC.md 12, MINOR); REST returns
    // them and the frozen GraphQL selection cannot, so members outside the
    // tree are excluded from the comparison. The shape must come from the
    // generated artifact, never from a live response: projecting onto the
    // GraphQL answer would erase a ONE-SIDED drop (GraphQL missing a
    // contract member REST still serves) from the comparison. Omitting an
    // optional member from BOTH bindings consistently is legal omission
    // (§4), not a parity concern. Vector-declared ignoreMembers (an erasure
    // job's progressing status) still trump the tree by design.
    const operationName = [...perBinding.values()][0]?.operation;
    const shape = graphqlOperations.operations[operationName]?.selection;
    const normalized = new Map(
      [...perBinding].map(([binding, { outcome, ignore }]) => [
        binding,
        stableStringify(
          outcome.kind === "result"
            ? {
                kind: "result",
                // Projection applies to the NON-GraphQL bindings only: the
                // GraphQL result was already checked raw against the tree
                // (unrequested members fail the case itself), so projecting
                // it here would only mask that check.
                data: withoutMembers(
                  shape !== undefined &&
                    typeof shape === "object" &&
                    binding !== "graphql"
                    ? projectOnto(outcome.data, shape)
                    : outcome.data,
                  ignore,
                ),
              }
            : { kind: outcome.kind, code: outcome.code },
        ),
      ]),
    );
    if (new Set(normalized.values()).size !== 1) {
      parityFailures.push({
        id: caseId,
        outcomes: Object.fromEntries(normalized),
      });
    }
  }

  return {
    ok: results.every((result) => result.ok) && parityFailures.length === 0,
    results,
    parityFailures,
  };
}
