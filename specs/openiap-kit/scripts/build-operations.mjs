#!/usr/bin/env node
// Compiles the operation surface of the canonical SDL into its transport
// binding artifacts: the HTTP manifest, the executable GraphQL projection and
// its canonical documents, the OpenAPI 3.1 document, and the operation
// conformance vectors. One IR, four projections — none is authored by hand.
//
// Generated and committed. Edit the schema/*.graphql layers, never generated/.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildSchema,
  isEnumType,
  isInputObjectType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  Kind,
  parse,
} from "graphql";

import { buildBundle } from "./build-bundle.mjs";
import {
  compileCommerceSchemas,
  compileProtocolContract,
} from "./build-json-schemas.mjs";

const at = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const sourcePath = at("generated/commerce-protocol.graphql");

const BUILTIN_SCALARS = new Set(["String", "Boolean", "Int", "Float", "ID"]);

function operationReachableTypes(ast, operations) {
  const definitions = new Map();
  for (const node of ast.definitions) {
    if (
      [
        Kind.OBJECT_TYPE_DEFINITION,
        Kind.INPUT_OBJECT_TYPE_DEFINITION,
        Kind.SCALAR_TYPE_DEFINITION,
        Kind.ENUM_TYPE_DEFINITION,
      ].includes(node.kind) &&
      !["Query", "Mutation"].includes(node.name.value)
    ) {
      definitions.set(node.name.value, node);
    }
  }
  const reachable = new Set();
  const visit = (name) => {
    if (reachable.has(name) || BUILTIN_SCALARS.has(name)) return;
    const node = definitions.get(name);
    if (!node) throw new Error(`Unknown SDL type: ${name}`);
    reachable.add(name);
    for (const field of node.fields ?? []) {
      let type = field.type;
      while (type.kind === Kind.NON_NULL_TYPE || type.kind === Kind.LIST_TYPE) {
        type = type.type;
      }
      visit(type.name.value);
    }
  };
  for (const operation of operations) {
    if (operation.input) visit(operation.input);
    visit(operation.result);
  }
  return { definitions, reachable };
}

function renderFieldType(field) {
  const optional = field.directives?.some(
    (entry) => entry.name.value === "optional",
  );
  const renderType = (type) => {
    if (type.kind === Kind.NON_NULL_TYPE) return `${renderType(type.type)}!`;
    if (type.kind === Kind.LIST_TYPE) return `[${renderType(type.type)}]`;
    return type.name.value;
  };
  const rendered = renderType(field.type);
  // The GraphQL binding expresses "may be omitted" as nullability: an
  // omitted optional member and a null one mean the same thing there.
  return optional ? rendered.replace(/!$/u, "") : rendered;
}

function renderDescription(node, indent) {
  const text = node.description?.value;
  if (!text) return "";
  return `${indent}"""\n${indent}${text}\n${indent}"""\n`;
}

function renderTypeDefinition(node) {
  const description = renderDescription(node, "");
  if (node.kind === Kind.SCALAR_TYPE_DEFINITION) {
    return `${description}scalar ${node.name.value}\n`;
  }
  if (node.kind === Kind.ENUM_TYPE_DEFINITION) {
    const values = node.values
      .map((value) => `  ${value.name.value}`)
      .join("\n");
    return `${description}enum ${node.name.value} {\n${values}\n}\n`;
  }
  const keyword =
    node.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION ? "input" : "type";
  const fields = node.fields
    .map(
      (field) =>
        `${renderDescription(field, "  ")}  ${field.name.value}: ${renderFieldType(field)}`,
    )
    .join("\n");
  return `${description}${keyword} ${node.name.value} {\n${fields}\n}\n`;
}

function renderExecutableSchema(ast, ir) {
  const { definitions, reachable } = operationReachableTypes(
    ast,
    ir.operations,
  );
  const sections = [
    `# Executable GraphQL projection of the OpenIAP Commerce Protocol ${ir.version}`,
    "# operation surface. Generated from commerce-protocol.graphql — do not edit.",
    "# A conforming GraphQL binding defines everything this projection",
    "# defines, exactly as defined; a compatible MINOR may extend it",
    "# additively. Introspection, where enabled, must agree with the schema",
    "# served.",
    "",
  ];
  for (const [name, node] of definitions) {
    if (reachable.has(name)) sections.push(renderTypeDefinition(node));
  }
  for (const containerName of ["Query", "Mutation"]) {
    const kind = containerName.toLowerCase();
    const fields = ir.operations
      .filter((operation) => operation.kind === kind)
      .map((operation) => {
        const args = operation.input ? `(input: ${operation.input}!)` : "";
        const description = operation.description
          ? `  """\n  ${operation.description}\n  """\n`
          : "";
        return `${description}  ${operation.name}${args}: ${operation.result}!`;
      });
    if (fields.length) {
      sections.push(`type ${containerName} {\n${fields.join("\n\n")}\n}\n`);
    }
  }
  return sections.join("\n");
}

function selectionSet(typeName, definitions, stack = []) {
  const node = definitions.get(typeName);
  if (
    !node ||
    node.kind === Kind.SCALAR_TYPE_DEFINITION ||
    node.kind === Kind.ENUM_TYPE_DEFINITION
  ) {
    return "";
  }
  if (stack.includes(typeName)) {
    throw new Error(`Selection cycle: ${[...stack, typeName].join(" -> ")}`);
  }
  const fields = node.fields.map((field) => {
    let type = field.type;
    while (type.kind === Kind.NON_NULL_TYPE || type.kind === Kind.LIST_TYPE) {
      type = type.type;
    }
    const nested = BUILTIN_SCALARS.has(type.name.value)
      ? ""
      : selectionSet(type.name.value, definitions, [...stack, typeName]);
    return `${field.name.value}${nested}`;
  });
  return ` { ${fields.join(" ")} }`;
}

// The same walk as selectionSet, as a JSON tree: `true` for a leaf, an object
// for a nested selection. The conformance runner checks the raw GraphQL
// result against this CONTRACT shape (an unrequested member is fabricated)
// and projects the NON-GraphQL bindings onto it for parity — projecting onto
// the live GraphQL response instead would let a provider hide a one-sided
// drop of a contract member.
function selectionTree(typeName, definitions, stack = []) {
  const node = definitions.get(typeName);
  if (
    !node ||
    node.kind === Kind.SCALAR_TYPE_DEFINITION ||
    node.kind === Kind.ENUM_TYPE_DEFINITION
  ) {
    return true;
  }
  if (stack.includes(typeName)) {
    throw new Error(`Selection cycle: ${[...stack, typeName].join(" -> ")}`);
  }
  const tree = {};
  for (const field of node.fields) {
    let type = field.type;
    while (type.kind === Kind.NON_NULL_TYPE || type.kind === Kind.LIST_TYPE) {
      type = type.type;
    }
    tree[field.name.value] = BUILTIN_SCALARS.has(type.name.value)
      ? true
      : selectionTree(type.name.value, definitions, [...stack, typeName]);
  }
  return tree;
}

function renderCanonicalDocuments(ast, ir) {
  const { definitions } = operationReachableTypes(ast, ir.operations);
  const documents = {};
  for (const operation of ir.operations) {
    const documentName =
      operation.name.charAt(0).toUpperCase() + operation.name.slice(1);
    const variables = operation.input ? `($input: ${operation.input}!)` : "";
    const argument = operation.input ? "(input: $input)" : "";
    const selection = selectionSet(operation.result, definitions);
    documents[operation.name] = {
      kind: operation.kind,
      document: `${operation.kind} ${documentName}${variables} { ${operation.name}${argument}${selection} }`,
      selection: selectionTree(operation.result, definitions),
    };
  }
  return {
    $comment:
      "Canonical full-selection GraphQL documents for every protocol operation. Generated from commerce-protocol.graphql — do not edit. The conformance runner sends exactly these documents; REST/GraphQL parity is judged on each `selection` tree, this protocol version's contract shape.",
    protocolVersion: ir.version,
    operations: documents,
  };
}

function buildHttpManifest(ir) {
  return {
    $comment:
      "HTTP binding manifest for the OpenIAP Commerce Protocol operation surface. Generated from commerce-protocol.graphql — do not edit. Schema pointers resolve inside commerce-protocol.bundle.schema.json.",
    protocolVersion: ir.version,
    profiles: Object.fromEntries(
      ir.profiles.map((profile) => [profile.name, profile.version]),
    ),
    bindings: Object.fromEntries(
      ir.bindings.map((binding) => [binding.name, binding.version]),
    ),
    // SPEC.md 8: authored per code by @errorStatus in the SDL metadata.
    errorStatus: { ...ir.errorStatus },
    errorResponse: "#/$defs/ProtocolErrorResponse",
    operations: ir.operations.map((operation) => ({
      name: operation.name,
      kind: operation.kind,
      profile: operation.profile,
      auth: operation.auth,
      method: operation.method,
      path: operation.path,
      successStatus: operation.successStatus,
      idempotent: operation.idempotent,
      errors: operation.errors,
      input: operation.input ? `#/$defs/${operation.input}` : null,
      result: `#/$defs/${operation.result}`,
    })),
  };
}

function componentRefs(node, out) {
  if (Array.isArray(node)) {
    for (const item of node) componentRefs(item, out);
    return;
  }
  if (node === null || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    if (key === "$ref" && typeof value === "string") {
      const match = value.match(/^#\/\$defs\/(.+)$/u);
      if (match) out.add(match[1]);
    } else {
      componentRefs(value, out);
    }
  }
}

function toOpenApiSchema(node) {
  if (Array.isArray(node)) return node.map(toOpenApiSchema);
  if (node === null || typeof node !== "object") return node;
  const out = {};
  for (const [key, value] of Object.entries(node)) {
    out[key] =
      key === "$ref" && typeof value === "string"
        ? value.replace(/^#\/\$defs\//u, "#/components/schemas/")
        : toOpenApiSchema(value);
  }
  return out;
}

function buildOpenApi(ir, bundle, manifest) {
  const needed = new Set();
  for (const operation of ir.operations) {
    if (operation.input) needed.add(operation.input);
    needed.add(operation.result);
  }
  needed.add("ProtocolErrorResponse");
  const schemas = {};
  const queue = [...needed];
  while (queue.length) {
    const name = queue.shift();
    if (schemas[name]) continue;
    const def = bundle.$defs[name];
    if (!def) throw new Error(`Bundle is missing $defs/${name}`);
    schemas[name] = toOpenApiSchema(def);
    const refs = new Set();
    componentRefs(def, refs);
    for (const ref of refs) queue.push(ref);
  }

  const paths = {};
  for (const operation of ir.operations) {
    const errorResponses = {};
    for (const code of operation.errors) {
      const status = String(manifest.errorStatus[code]);
      const existing = errorResponses[status];
      errorResponses[status] = {
        description: existing
          ? `${existing.description} or \`${code}\``
          : `\`${code}\``,
        content: {
          "application/json": {
            schema: { $ref: "#/components/schemas/ProtocolErrorResponse" },
          },
        },
      };
    }

    const definition = {
      operationId: operation.name,
      summary: operation.description.split(".")[0],
      description: operation.description,
      tags: [operation.profile],
      security:
        operation.auth === "none"
          ? []
          : [{ [`${operation.auth}Credential`]: [] }],
      responses: {
        [String(operation.successStatus)]: {
          description: "Success",
          content: {
            "application/json": {
              schema: { $ref: `#/components/schemas/${operation.result}` },
            },
          },
        },
        ...errorResponses,
      },
    };
    if (operation.input && operation.method === "GET") {
      const input = bundle.$defs[operation.input];
      definition.parameters = Object.entries(input.properties).map(
        ([name, schema]) => ({
          name,
          in: "query",
          required: (input.required ?? []).includes(name),
          schema: toOpenApiSchema(schema),
        }),
      );
    } else if (operation.input) {
      definition.requestBody = {
        required: true,
        content: {
          "application/json": {
            schema: { $ref: `#/components/schemas/${operation.input}` },
          },
        },
      };
    }
    paths[operation.path] ??= {};
    paths[operation.path][operation.method.toLowerCase()] = definition;
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "OpenIAP Commerce Protocol",
      version: ir.version,
      description:
        "REST binding of the OpenIAP Commerce Protocol operation surface. Generated from commerce-protocol.graphql — do not edit. Error statuses follow the manifest's errorStatus table; every error body is a ProtocolErrorResponse.",
      license: { name: "MIT" },
    },
    paths,
    components: {
      schemas,
      securitySchemes: {
        verificationCredential: {
          type: "http",
          scheme: "bearer",
          description:
            "Verification-role credential: limited to purchase-evidence verification, no account access.",
        },
        serverCredential: {
          type: "http",
          scheme: "bearer",
          description:
            "Server-role credential for an authenticated developer backend. Never ship it in an app.",
        },
      },
    },
    "x-error-status": manifest.errorStatus,
  };
}

// Deterministic fixture inputs. Fake but well-formed: they satisfy the
// operation schemas and realistic provider input caps, so a provider without
// store credentials still exercises the transport contract. They prove
// nothing about real receipt validity, and the vectors never require a
// provider to accept them as valid.
const FIXTURES = Object.freeze({
  userId: "conformance-user-1",
  erasureUserId: "conformance-erasure-user-1",
  appleJws: `eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9.${"eyJjb25mb3JtYW5jZSI6dHJ1ZX0".repeat(4)}.${"c2lnbmF0dXJl".repeat(4)}`,
  googlePurchaseToken: "conformance-google-purchase-token-0000000001",
  amazonUserId: "conformance-amazon-user-1",
  amazonReceiptId: "conformance-amazon-receipt-0000000001",
  horizonUserId: "1234567890123456",
  horizonSku: "conformance.sku",
  unknownPurchaseToken: "conformance-google-purchase-token-unknown-9999",
  unknownUserId: "conformance-user-the-provider-never-heard-of",
});

function validInputFor(operation) {
  switch (operation.name) {
    case "providerCapabilities":
      return null;
    case "subscriptionStatus":
    case "entitlements":
      return { userId: FIXTURES.userId };
    case "verifyPurchase":
      return { store: "apple", apple: { jws: FIXTURES.appleJws } };
    case "bindPurchase":
      return {
        userId: FIXTURES.userId,
        store: "google",
        google: { purchaseToken: FIXTURES.googlePurchaseToken },
      };
    case "eraseUser":
      return { userId: FIXTURES.erasureUserId };
    default:
      throw new Error(`No fixture input for operation ${operation.name}`);
  }
}

function buildOperationVectors(ir) {
  const cases = [];
  for (const operation of ir.operations) {
    const input = validInputFor(operation);
    const credential = operation.auth === "none" ? null : operation.auth;

    // SPEC.md 5 orders server-role authorization before validation and
    // SPEC.md 7 makes a pre-execution refusal omit the data member, so every
    // server-operation auth negative asserts on the GraphQL envelope too.
    // Verification-role operations are exempt from the ordering rule and may
    // refuse in-resolver, where an executed data member is legitimate.
    const preExecution =
      operation.auth === "server" ? { preExecution: true } : {};
    if (operation.auth !== "none") {
      cases.push({
        id: `${operation.name}.auth.missing-credential`,
        operation: operation.name,
        credential: null,
        input,
        expect: { kind: "error", codes: ["UNAUTHORIZED"], ...preExecution },
      });
      cases.push({
        // A provider must reject a bearer it never issued, not trust any
        // string — otherwise server operations are open to any caller.
        id: `${operation.name}.auth.unknown-credential`,
        operation: operation.name,
        credential: "invalid",
        input,
        expect: { kind: "error", codes: ["UNAUTHORIZED"], ...preExecution },
      });
    }
    if (operation.auth === "server") {
      cases.push({
        id: `${operation.name}.auth.verification-role-refused`,
        operation: operation.name,
        credential: "verification",
        input,
        expect: { kind: "error", codes: ["FORBIDDEN"], preExecution: true },
      });
      if (operation.input) {
        // SPEC.md 5: server-role authorization precedes input validation. The
        // input is structurally complete (it passes GraphQL variable
        // coercion, which a transport-shape failure would short-circuit) but
        // fails the content schema — an oversized userId. With an unknown
        // credential the only conforming answer is UNAUTHORIZED; a provider
        // that answers INVALID_REQUEST validated before authenticating.
        cases.push({
          id: `${operation.name}.auth.precedes-validation`,
          operation: operation.name,
          credential: "invalid",
          input: { ...input, userId: "x".repeat(600) },
          expect: {
            kind: "error",
            codes: ["UNAUTHORIZED"],
            preExecution: true,
          },
        });
        // The structural variant: an empty input fails REST schema validation
        // AND GraphQL variable coercion. GraphQL engines coerce variables
        // before any resolver runs, so a provider that authorizes only inside
        // resolvers leaks a member-by-member verdict here.
        cases.push({
          id: `${operation.name}.auth.precedes-structural-validation`,
          operation: operation.name,
          credential: "invalid",
          input: {},
          expect: {
            kind: "error",
            codes: ["UNAUTHORIZED"],
            preExecution: true,
          },
        });
      }
    }
    if (operation.input) {
      cases.push({
        id: `${operation.name}.input.missing-required-member`,
        operation: operation.name,
        credential,
        input: {},
        expect: { kind: "error", codes: ["INVALID_REQUEST"] },
      });
    }

    const successExpect =
      operation.name === "verifyPurchase"
        ? // Without store credentials a real provider cannot judge fake
          // evidence: a schema-valid verdict and VERIFICATION_FAILED are both
          // conformant. This never certifies real receipt validity.
          {
            kind: "result",
            schema: operation.result,
            allowCodes: ["VERIFICATION_FAILED"],
          }
        : { kind: "result", schema: operation.result };
    if (operation.name === "subscriptionStatus") {
      successExpect.checks = ["tokenless", "statusConsistency"];
    }
    if (operation.name === "entitlements") {
      successExpect.checks = ["tokenless", "entitlementsConsistency"];
    }
    if (operation.name === "eraseUser") {
      // Job progress may advance between calls and bindings.
      successExpect.ignoreMembers = ["status"];
    }
    cases.push({
      id: `${operation.name}.success.contract`,
      operation: operation.name,
      credential,
      input,
      expect: successExpect,
    });

    if (operation.input && operation.method === "POST") {
      cases.push({
        id: `${operation.name}.input.unknown-member-ignored`,
        operation: operation.name,
        credential,
        input: { ...input, unknownFutureMember: "ignored" },
        bindings: ["rest"],
        expect: { ...successExpect },
      });
    }
    if (operation.idempotent && operation.kind === "mutation") {
      cases.push({
        id: `${operation.name}.idempotent.repeat`,
        operation: operation.name,
        credential,
        input,
        repeat: 2,
        expect: { ...successExpect },
      });
    }
  }

  cases.push(
    {
      id: "verifyPurchase.store.unsupported",
      operation: "verifyPurchase",
      credential: "verification",
      input: { store: "a_store_openiap_has_never_heard_of" },
      expect: { kind: "error", codes: ["UNSUPPORTED_STORE"] },
    },
    {
      id: "verifyPurchase.input.mismatched-evidence",
      operation: "verifyPurchase",
      credential: "verification",
      input: {
        store: "apple",
        google: { purchaseToken: FIXTURES.googlePurchaseToken },
      },
      expect: { kind: "error", codes: ["INVALID_REQUEST"] },
    },
    {
      id: "providerCapabilities.honesty.binding-declared",
      operation: "providerCapabilities",
      credential: null,
      input: null,
      expect: {
        kind: "result",
        schema: "ProviderCapabilities",
        checks: ["declaresTestedBinding"],
      },
    },
    {
      // A purchase the provider has no binding for must report bound:false —
      // and the anti-enumeration rule keeps that indistinguishable from a
      // foreign binding, so a provider cannot probe whether it exists.
      id: "bindPurchase.unknown-evidence.not-bound",
      operation: "bindPurchase",
      credential: "server",
      input: {
        userId: FIXTURES.userId,
        store: "google",
        google: { purchaseToken: FIXTURES.unknownPurchaseToken },
      },
      expect: {
        kind: "result",
        schema: "BindPurchaseResult",
        resultSubset: { bound: false },
      },
    },
    {
      // A server read for a user the provider knows nothing about must be a
      // well-formed empty answer, not a canned entitled payload.
      id: "entitlements.unknown-user.empty",
      operation: "entitlements",
      credential: "server",
      input: { userId: FIXTURES.unknownUserId },
      expect: {
        kind: "result",
        schema: "EntitlementsResult",
        checks: ["tokenless", "entitlementsConsistency"],
        resultSubset: { productIds: [] },
      },
    },
  );

  return {
    $comment:
      "Operation conformance vectors for the OpenIAP Commerce Protocol. Generated from commerce-protocol.graphql — do not edit. Every case runs on each binding the provider declares unless it names `bindings`; a case's normalized outcome must also agree across bindings. Fixture evidence is fake but well-formed: these vectors verify the transport contract and never certify real store receipt validity.",
    protocolVersion: ir.version,
    fixtures: FIXTURES,
    credentialRoles: ["verification", "server"],
    cases,
  };
}

function signatureTypeString(type) {
  if (isNonNullType(type)) return `${signatureTypeString(type.ofType)}!`;
  if (isListType(type)) return `[${signatureTypeString(type.ofType)}]`;
  return type.name;
}

/**
 * A structural fingerprint of the executable projection, for the conformance
 * runner's introspection agreement check. Field and argument types carry full
 * nullability, enums carry their closed value sets, and input objects their
 * member types — so a served schema that renames, retypes, or drops anything
 * this version defines fails, while purely additive MINOR surface (new types,
 * new fields, new nullable arguments) still certifies.
 */
function buildIntrospectionSignature(sdl, version) {
  const schema = buildSchema(sdl);
  const types = {};
  for (const [name, type] of Object.entries(schema.getTypeMap())) {
    if (name.startsWith("__") || BUILTIN_SCALARS.has(name)) continue;
    if (isObjectType(type)) {
      const fields = {};
      for (const [fieldName, field] of Object.entries(type.getFields())) {
        const args = {};
        for (const arg of field.args) {
          args[arg.name] = signatureTypeString(arg.type);
        }
        fields[fieldName] = {
          type: signatureTypeString(field.type),
          ...(Object.keys(args).length ? { args } : {}),
        };
      }
      types[name] = { kind: "OBJECT", fields };
    } else if (isInputObjectType(type)) {
      const inputFields = {};
      for (const [fieldName, field] of Object.entries(type.getFields())) {
        inputFields[fieldName] = signatureTypeString(field.type);
      }
      types[name] = { kind: "INPUT_OBJECT", inputFields };
    } else if (isEnumType(type)) {
      types[name] = {
        kind: "ENUM",
        values: type
          .getValues()
          .map((value) => value.name)
          .sort(),
      };
    } else if (isScalarType(type)) {
      types[name] = { kind: "SCALAR" };
    }
  }
  return {
    $comment:
      "Structural introspection signature of the executable GraphQL projection. Generated from commerce-protocol.graphql — do not edit. The conformance runner compares a served schema's introspection against this as a subset: everything named here must exist with these exact kinds, types, nullability, arguments, and (for closed enums) exact value sets; additive surface beyond it is a compatible MINOR.",
    protocolVersion: version,
    queryType: schema.getQueryType()?.name ?? null,
    mutationType: schema.getMutationType()?.name ?? null,
    types,
  };
}

export function buildOperationArtifacts(source) {
  const { ir } = compileProtocolContract(source);
  const ast = parse(source);
  const schemas = compileCommerceSchemas(source);
  const bundle = buildBundle({
    primitives: schemas.get("primitives.schema.json"),
    event: schemas.get("commerce-event.schema.json"),
    capabilities: schemas.get("provider-capabilities.schema.json"),
    mapping: schemas.get("store-event-mapping.schema.json"),
    operations: schemas.get("operations.schema.json"),
  });
  const manifest = buildHttpManifest(ir);
  return new Map([
    ["bindings/http-binding.json", `${JSON.stringify(manifest, null, 2)}\n`],
    ["bindings/operations.graphql", renderExecutableSchema(ast, ir)],
    [
      // The same projection as a JSON member, so an implementation compiled
      // into a single binary can import it where a runtime file read would
      // not survive bundling.
      "bindings/operations-sdl.json",
      `${JSON.stringify(
        {
          $comment:
            "The executable GraphQL projection from bindings/operations.graphql, wrapped as JSON for bundlers. Generated from commerce-protocol.graphql — do not edit.",
          sdl: renderExecutableSchema(ast, ir),
        },
        null,
        2,
      )}\n`,
    ],
    [
      "bindings/graphql-operations.json",
      `${JSON.stringify(renderCanonicalDocuments(ast, ir), null, 2)}\n`,
    ],
    [
      "bindings/introspection-signature.json",
      `${JSON.stringify(
        buildIntrospectionSignature(
          renderExecutableSchema(ast, ir),
          ir.version,
        ),
        null,
        2,
      )}\n`,
    ],
    [
      "openapi/commerce-protocol.openapi.json",
      `${JSON.stringify(buildOpenApi(ir, bundle, manifest), null, 2)}\n`,
    ],
    [
      "vectors/operations.json",
      `${JSON.stringify(buildOperationVectors(ir), null, 2)}\n`,
    ],
  ]);
}

function main() {
  const source = readFileSync(sourcePath, "utf8");
  const rendered = buildOperationArtifacts(source);
  const check = process.argv.includes("--check");
  let stale = false;
  for (const [name, contents] of rendered) {
    const target = at(`generated/${name}`);
    if (check) {
      if (readFileSync(target, "utf8") !== contents) {
        console.error(`generated/${name} is stale`);
        stale = true;
      }
    } else {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, contents);
      console.log(`wrote ${target}`);
    }
  }
  if (stale) {
    console.error("Run: node scripts/build-operations.mjs");
    process.exitCode = 1;
  } else if (check) {
    console.log("generated operation artifacts are current");
  }
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1])
) {
  main();
}
