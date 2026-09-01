export interface ResultOutcome {
  kind: "result";
  status: number;
  /** Normalized shape: null members stripped, binding-neutral. */
  data: unknown;
  /**
   * REQUIRED on a GraphQL result: the pre-normalization shape. The runner
   * fails the case (adapter contract) when it is undefined — presence alone
   * is not enough; a fabricated `member: null` is only visible before
   * null-stripping.
   */
  rawData?: unknown;
}

export interface InvalidOutcome {
  kind: "invalid";
  status: number;
  detail: string;
  code?: string;
}

/**
 * A GraphQL error outcome. `errors` and `hasData` are REQUIRED and `errors`
 * must be non-empty: the runner records an adapter-contract failure when
 * either is missing or hollowed out (an empty array, a non-boolean), so an
 * adapter cannot make the envelope rules pass vacuously. Message and code
 * travel together per entry — the runner derives every code/message view it
 * needs from this one structure.
 */
export interface GraphqlErrorOutcome {
  kind: "error";
  status: number;
  /** Normalized first code (INVALID_REQUEST when the envelope is codeless). */
  code: string;
  /** The whole envelope, entry by entry, in order. */
  errors: Array<{ message: string; code?: string }>;
  /** Whether the response carried a `data` member (SPEC.md §7 pre-execution rule). */
  hasData: boolean;
}

/**
 * A REST error outcome. `errorBody` is REQUIRED: the runner records an
 * adapter-contract failure when it is missing — the CLOSED
 * ProtocolErrorResponse envelope cannot be validated without it.
 */
export interface RestErrorOutcome {
  kind: "error";
  status: number;
  code: string;
  /** The full parsed error body, validated against ProtocolErrorResponse. */
  errorBody: unknown;
}

export type ConformanceOutcome =
  | ResultOutcome
  | InvalidOutcome
  | GraphqlErrorOutcome
  | RestErrorOutcome;

export interface ConformanceAdapter {
  binding: string;
  /**
   * The configured credential VALUES. REQUIRED — the runner records an
   * adapter-contract failure without them, because the SPEC.md §8
   * credential-echo scan on error messages cannot run. Compared locally
   * against message text only; never transmitted.
   */
  secrets: string[];
  request(args: {
    operation: string;
    input: unknown;
    credential: string | null;
  }): Promise<ConformanceOutcome>;
  /**
   * Sends an arbitrary raw GraphQL request body. REQUIRED on a `graphql`
   * adapter: the executor probe drives malformed and non-canonical documents
   * through it, and a GraphQL adapter without it fails the probe outright —
   * a runner that cannot probe must not certify "GraphQL-conformant".
   * `createGraphqlAdapter` provides it.
   */
  rawGraphql?(
    payload: unknown,
    credential: string | null,
  ): Promise<{ status: number; body: unknown }>;
}

export interface AdapterFetch {
  (url: string, init?: RequestInit): Promise<Response>;
}

export interface ConformanceCaseResult {
  id: string;
  binding: string;
  ok: boolean;
  failures: string[];
}

export interface ConformanceParityFailure {
  id: string;
  outcomes: Record<string, string>;
}

export interface ConformanceReport {
  ok: boolean;
  results: ConformanceCaseResult[];
  parityFailures: ConformanceParityFailure[];
}

export declare function createRestAdapter(options: {
  baseUrl: string;
  fetch: AdapterFetch;
  credentials?: Record<string, string>;
}): ConformanceAdapter;

export declare function createGraphqlAdapter(options: {
  url: string;
  fetch: AdapterFetch;
  credentials?: Record<string, string>;
}): ConformanceAdapter;

/**
 * The provider's outbound webhook implementation. A descriptor that declares
 * the `events` profile MUST supply every method — a signing-only adapter does
 * not implement it. The runner drives §9.4.2 signing and verification (with
 * rotation and clock-skew), the §9.4.1 delivery envelope, §9.4.3 response
 * semantics, the §2.3 entitlement gate, and the §9.1/§2.4 emission rules.
 * SPEC.md §11.3 lists what stays outside this surface (§9.2 mapping, §9.3
 * document schema, §9.4.4 backoff, §9.4.5 destination safety).
 */
export interface EventsAdapter {
  /** §9.4.2 — HMAC-signs one payload, returning `v1=<hex>`. */
  sign(args: {
    secret: string;
    timestamp: number;
    body: string;
  }): string | Promise<string>;
  /** §9.4.2 — accepts a valid delivery and rejects tampered/stale/wrong-key ones. */
  verify(args: {
    body: string;
    timestamp: number;
    signature: string;
    secrets: string[];
    now: number;
  }): boolean | Promise<boolean>;
  /** §9.4.1 — composes the delivery envelope (POST, JSON, headers) for one attempt. */
  delivery(args: {
    event: { eventId: string };
    body: string;
    timestamp: number;
    secrets: string[];
    deliveryId: string;
  }):
    | { method: string; contentType: string; headers: Record<string, string> }
    | Promise<{
        method: string;
        contentType: string;
        headers: Record<string, string>;
      }>;
  /**
   * §9.4.3 — maps a consumer response to the emitter's action. Besides HTTP
   * statuses, the runner probes the no-response outcomes: `"timeout"` and
   * `"connection-error"` must classify as retry.
   */
  classifyResponse(
    status: number | "connection-error" | "timeout",
  ):
    | "delivered"
    | "retry"
    | "permanent-failure"
    | Promise<"delivered" | "retry" | "permanent-failure">;
  /** §2.3 — the entitlement gate, checked against every lifecycle vector. */
  entitled(args: {
    state: string;
    expiresAt?: number;
    processedAt: number;
  }): boolean | Promise<boolean>;
  /** §9.1 — the event types to emit for a lifecycle change. */
  emission(args: {
    lifecycleEvent: string | null;
    entitledBefore: boolean;
    entitledAfter: boolean;
  }): string[] | Promise<string[]>;
  /** §2.4 — the entitlement events to emit when a purchase first binds. */
  coalesceAtBinding(args: {
    unboundGateChanges: string[];
    entitledAtBinding: boolean;
  }): string[] | Promise<string[]>;
}

/**
 * `Ajv` is the Ajv 2020 class; the runner keeps zero dependencies itself.
 * `eventsAdapter` is required when the provider's descriptor declares the
 * events profile — the runner drives the EventsAdapter surface above through
 * it; SPEC.md §11.3 lists the §9 rules that stay outside that surface.
 */
export declare function runConformance(options: {
  adapters: ConformanceAdapter[];
  Ajv: unknown;
  eventsAdapter?: EventsAdapter;
  /**
   * REQUIRED: the AUTHORITATIVE role-to-credential map for the SPEC.md §8
   * credential-echo scan. Every role THIS RUN exercises must be present —
   * checked at first use, so a legal partial-profile provider that never
   * uses the server role is not asked for a credential it does not have,
   * while omitting a role the run does use throws. Pass the same values the
   * adapters were configured with; an adapter-supplied list alone could be
   * emptied by a non-conforming adapter. Compared locally against
   * error-message text; never transmitted.
   */
  credentials: Record<string, string>;
}): Promise<ConformanceReport>;

export declare const signatureVectors: {
  algorithm: string;
  toleranceSeconds: number;
  headers: Record<string, string>;
  cases: Array<Record<string, unknown>>;
  rejections: Array<Record<string, unknown>>;
  responseSemantics: {
    connectionError: string;
    cases: Array<{ status: number; action: string }>;
  };
};

export declare const lifecycleVectors: Record<string, unknown>;

export declare function normalizeResultData<T>(value: T): T;

export declare const httpBindingManifest: {
  protocolVersion: string;
  profiles: Record<string, string>;
  bindings: Record<string, string>;
  errorStatus: Record<string, number>;
  errorResponse: string;
  operations: Array<{
    name: string;
    kind: "query" | "mutation";
    profile: string;
    auth: "none" | "verification" | "server";
    method: "GET" | "POST";
    path: string;
    successStatus: number;
    idempotent: boolean;
    errors: string[];
    input: string | null;
    result: string;
  }>;
};

/**
 * The canonical full-selection shape of one operation result: `true` marks a
 * leaf field, a nested object a sub-selection. Parity projects every
 * non-GraphQL binding's result onto this tree, and the GraphQL result is
 * checked raw against it (an unrequested member fails).
 */
export type SelectionTree = true | { [field: string]: SelectionTree };

export declare const graphqlOperations: {
  protocolVersion: string;
  operations: Record<
    string,
    { kind: "query" | "mutation"; document: string; selection: SelectionTree }
  >;
};

/**
 * Structural fingerprint of the executable projection, compared as a subset
 * against a served schema's introspection: exact kinds, field/argument type
 * strings (nullability included), input members, and closed enum value sets.
 */
export declare const introspectionSignature: {
  protocolVersion: string;
  queryType: string | null;
  mutationType: string | null;
  types: Record<
    string,
    | { kind: "SCALAR" }
    | { kind: "ENUM"; values: string[] }
    | { kind: "INPUT_OBJECT"; inputFields: Record<string, string> }
    | {
        kind: "OBJECT";
        fields: Record<string, { type: string; args?: Record<string, string> }>;
      }
  >;
};

export declare const operationVectors: {
  protocolVersion: string;
  fixtures: Record<string, string>;
  credentialRoles: string[];
  cases: Array<{
    id: string;
    operation: string;
    credential: string | null;
    input: unknown;
    bindings?: string[];
    repeat?: number;
    expect: Record<string, unknown>;
  }>;
};
