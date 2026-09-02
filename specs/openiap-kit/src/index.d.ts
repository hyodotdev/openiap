export interface JsonSchema {
  $id: string;
  $schema: string;
  title: string;
  [key: string]: unknown;
}

export declare const primitivesSchema: JsonSchema;
export declare const bundleSchema: JsonSchema;
export declare const commerceEventSchema: JsonSchema;
export declare const providerCapabilitiesSchema: JsonSchema;
export declare const storeEventMappingSchema: JsonSchema;
export declare const operationsSchema: JsonSchema;
export declare const schemas: readonly JsonSchema[];

export interface HttpBindingOperation {
  name: string;
  kind: "query" | "mutation";
  profile: string;
  auth: "none" | "verification" | "server";
  method: "GET" | "POST";
  path: string;
  successStatus: number;
  idempotent: boolean;
  errors: readonly string[];
  input: string | null;
  result: string;
}

export declare const HTTP_BINDING: Readonly<{
  protocolVersion: string;
  profiles: Readonly<Record<string, string>>;
  bindings: Readonly<Record<string, string>>;
  errorStatus: Readonly<Record<string, number>>;
  errorResponse: string;
  operations: readonly HttpBindingOperation[];
}>;

export declare const KNOWN_PROTOCOL_ERROR_CODES: readonly string[];
export declare const PROTOCOL_PROFILES: Readonly<Record<string, string>>;
export declare const PROTOCOL_BINDINGS: Readonly<Record<string, string>>;

export declare const COMMERCE_EVENT_VERSION: string;
export declare const KNOWN_COMMERCE_EVENT_TYPES: readonly string[];
export declare const KNOWN_STORES: readonly string[];
export declare const SUBSCRIPTION_STATES: readonly string[];
export declare const DATA_PROVENANCE: readonly string[];

export declare const EXTENSION_LIMITS: Readonly<{
  maxEntries: number;
  maxKeyLength: number;
  maxValueLength: number;
}>;

export declare const WEBHOOK: Readonly<{
  signatureHeader: string;
  timestampHeader: string;
  eventIdHeader: string;
  deliveryIdHeader: string;
  signaturePrefix: string;
  contentType: string;
  toleranceSeconds: number;
}>;
