#!/usr/bin/env node
/** Compiles the canonical Commerce Protocol SDL into JSON Schema artifacts. */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { buildASTSchema, Kind, parse, valueFromASTUntyped } from "graphql";

const at = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const sourcePath = at("generated/commerce-protocol.graphql");
const DIRECTIVE_ARGUMENTS = new Map([
  ["binding", new Set(["name", "version", "description"])],
  ["definition", new Set(["schema"])],
  ["errorStatus", new Set(["code", "http"])],
  ["document", new Set(["name", "title", "description", "root"])],
  [
    "eventInvariant",
    new Set(["eventTypes", "require", "snapshotState", "snapshotActive"]),
  ],
  ["inline", new Set()],
  ["jsonArray", new Set(["minItems", "maxItems", "uniqueItems"])],
  ["jsonConst", new Set(["boolean"])],
  ["jsonInteger", new Set(["minimum", "maximum"])],
  [
    "jsonMap",
    new Set([
      "valueType",
      "minProperties",
      "maxProperties",
      "keyPattern",
      "keyMinLength",
      "keyMaxLength",
    ]),
  ],
  ["jsonObject", new Set(["additionalProperties"])],
  ["jsonString", new Set(["pattern", "minLength", "maxLength", "examples"])],
  ["mappingInvariant", new Set()],
  [
    "operation",
    new Set([
      "profile",
      "auth",
      "method",
      "path",
      "successStatus",
      "idempotent",
      "errors",
    ]),
  ],
  ["optional", new Set()],
  ["profile", new Set(["name", "version", "description"])],
  ["protocol", new Set(["version", "baseId"])],
  ["storeEvidence", new Set(["store", "member"])],
  ["storeMappingInvariant", new Set()],
  ["supportInvariant", new Set()],
]);
const SUPPORTED_DIRECTIVES = new Set(DIRECTIVE_ARGUMENTS.keys());
const REPEATABLE_DIRECTIVES = new Set([
  "binding",
  "document",
  "errorStatus",
  "eventInvariant",
  "profile",
  "storeEvidence",
]);
const OPERATION_AUTH_ROLES = new Set(["none", "verification", "server"]);
const OPERATION_CONTAINERS = new Set(["Query", "Mutation"]);

function directive(node, name) {
  return node.directives?.find((entry) => entry.name.value === name);
}

function directiveArgs(node, name) {
  const match = directive(node, name);
  if (!match) return null;
  return Object.fromEntries(
    match.arguments.map((argument) => [
      argument.name.value,
      valueFromASTUntyped(argument.value),
    ]),
  );
}

function allDirectiveArgs(node, name) {
  return (node.directives ?? [])
    .filter((entry) => entry.name.value === name)
    .map((entry) =>
      Object.fromEntries(
        entry.arguments.map((argument) => [
          argument.name.value,
          valueFromASTUntyped(argument.value),
        ]),
      ),
    );
}

function requiredDirective(node, name) {
  const args = directiveArgs(node, name);
  const label = node.name?.value ?? node.kind;
  if (!args) throw new Error(`${label} must declare @${name}`);
  return args;
}

function withDescription(node, schema) {
  return node.description?.value
    ? { description: node.description.value, ...schema }
    : schema;
}

function nullable(schema) {
  if (typeof schema.type === "string") {
    return { ...schema, type: [schema.type, "null"] };
  }
  return { anyOf: [schema, { type: "null" }] };
}

function assertKeys(args, allowed, label) {
  const unknown = Object.keys(args).filter((key) => !allowed.has(key));
  if (unknown.length) {
    throw new Error(
      `${label} has unsupported arguments: ${unknown.join(", ")}`,
    );
  }
}

export function compileProtocolContract(source) {
  const ast = parse(source);
  const definitions = new Map();
  const operationContainers = new Map();
  const schemaExtensions = [];

  for (const node of ast.definitions) {
    for (const location of [
      node,
      ...(node.fields ?? []),
      ...(node.values ?? []),
    ]) {
      const seen = new Set();
      for (const entry of location.directives ?? []) {
        const name = entry.name.value;
        if (!SUPPORTED_DIRECTIVES.has(name)) {
          throw new Error(`Unsupported compiler directive: @${name}`);
        }
        if (!REPEATABLE_DIRECTIVES.has(name) && seen.has(name)) {
          throw new Error(`Duplicate compiler directive: @${name}`);
        }
        seen.add(name);
        const args = Object.fromEntries(
          entry.arguments.map((argument) => [
            argument.name.value,
            valueFromASTUntyped(argument.value),
          ]),
        );
        assertKeys(args, DIRECTIVE_ARGUMENTS.get(name), `@${name}`);
      }
    }
    if (
      node.kind === Kind.OBJECT_TYPE_DEFINITION &&
      node.name.value === "Subscription"
    ) {
      // The webhook-direction guardrail: the operation surface is bounded
      // request/response, never a stream a shipped app could subscribe to.
      throw new Error(
        "Commerce Protocol SDL must not define a Subscription root",
      );
    }
    if (
      node.kind === Kind.OBJECT_TYPE_DEFINITION &&
      OPERATION_CONTAINERS.has(node.name.value)
    ) {
      if (operationContainers.has(node.name.value)) {
        throw new Error(`Duplicate SDL type: ${node.name.value}`);
      }
      if (node.directives?.length) {
        throw new Error(
          `${node.name.value} is an operation container and takes no type directives`,
        );
      }
      operationContainers.set(node.name.value, node);
    } else if (
      node.kind === Kind.OBJECT_TYPE_DEFINITION ||
      node.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION ||
      node.kind === Kind.SCALAR_TYPE_DEFINITION ||
      node.kind === Kind.ENUM_TYPE_DEFINITION
    ) {
      if (definitions.has(node.name.value)) {
        throw new Error(`Duplicate SDL type: ${node.name.value}`);
      }
      definitions.set(node.name.value, node);
    } else if (node.kind === Kind.SCHEMA_EXTENSION) {
      if (node.operationTypes?.length) {
        throw new Error(
          "Commerce Protocol SDL must not define executable roots on a schema extension",
        );
      }
      schemaExtensions.push(node);
    } else if (
      node.kind === Kind.OPERATION_DEFINITION ||
      node.kind === Kind.SCHEMA_DEFINITION
    ) {
      throw new Error(
        "Commerce Protocol SDL must not define executable documents",
      );
    }
  }

  buildASTSchema(ast);

  const metadataNode = schemaExtensions.at(0);
  if (!metadataNode || schemaExtensions.length !== 1) {
    throw new Error("Commerce Protocol SDL must have one schema extension");
  }

  const protocol = requiredDirective(metadataNode, "protocol");
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)$/u.test(protocol.version)) {
    throw new Error("@protocol version must be canonical MAJOR.MINOR");
  }
  if (!/^https:\/\/[^/]+\/.+[^/]$/u.test(protocol.baseId)) {
    throw new Error(
      "@protocol baseId must be an absolute HTTPS URL without a trailing slash",
    );
  }
  const documents = metadataNode.directives
    .filter((entry) => entry.name.value === "document")
    .map((entry) =>
      Object.fromEntries(
        entry.arguments.map((argument) => [
          argument.name.value,
          valueFromASTUntyped(argument.value),
        ]),
      ),
    );

  if (!documents.length) throw new Error("No @document directives found");
  const documentNames = new Set();
  for (const document of documents) {
    if (!document.name || !document.title || !document.description) {
      throw new Error("@document needs name, title, and description");
    }
    if (!/^[a-z][a-z0-9-]*$/u.test(document.name)) {
      throw new Error(`Invalid @document name: ${document.name}`);
    }
    if (documentNames.has(document.name)) {
      throw new Error(`Duplicate @document: ${document.name}`);
    }
    documentNames.add(document.name);
  }

  const namePattern = /^[a-z][a-zA-Z0-9]*$/u;
  const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;
  const declaredGroups = new Map([
    ["profile", new Map()],
    ["binding", new Map()],
  ]);
  for (const [directiveName, group] of declaredGroups) {
    for (const entry of allDirectiveArgs(metadataNode, directiveName)) {
      if (!entry.name || !entry.version || !entry.description) {
        throw new Error(`@${directiveName} needs name, version, description`);
      }
      if (!namePattern.test(entry.name) || entry.name === "core") {
        throw new Error(`Invalid @${directiveName} name: ${entry.name}`);
      }
      if (!versionPattern.test(entry.version)) {
        throw new Error(
          `@${directiveName} ${entry.name} version must be canonical MAJOR.MINOR`,
        );
      }
      if (group.has(entry.name)) {
        throw new Error(`Duplicate @${directiveName}: ${entry.name}`);
      }
      group.set(entry.name, entry);
    }
  }
  const profiles = declaredGroups.get("profile");
  const bindings = declaredGroups.get("binding");

  const errorCodes = new Set(
    directiveArgs(definitions.get("ProtocolErrorCode"), "jsonString")
      ?.examples ?? [],
  );

  // The HTTP status per error code is authored here so the manifest, OpenAPI
  // document, and conformance runner all derive it from the SDL rather than a
  // hand-kept table. It must map exactly the named error codes.
  const errorStatus = {};
  for (const entry of allDirectiveArgs(metadataNode, "errorStatus")) {
    if (typeof entry.code !== "string" || typeof entry.http !== "number") {
      throw new Error("@errorStatus needs a string code and an integer http");
    }
    if (!errorCodes.has(entry.code)) {
      throw new Error(`@errorStatus names unknown error code ${entry.code}`);
    }
    if (entry.code in errorStatus) {
      throw new Error(`Duplicate @errorStatus for ${entry.code}`);
    }
    if (entry.http < 400 || entry.http > 599) {
      throw new Error(`@errorStatus ${entry.code} http must be a 4xx/5xx`);
    }
    errorStatus[entry.code] = entry.http;
  }
  for (const code of errorCodes) {
    if (!(code in errorStatus)) {
      throw new Error(`@errorStatus is missing a mapping for ${code}`);
    }
  }

  const protocolMajor = protocol.version.split(".")[0];
  const pathPattern = new RegExp(
    `^/commerce/v${protocolMajor}/[a-z][a-z0-9/-]*$`,
    "u",
  );

  const operations = [];
  const operationPaths = new Set();
  for (const [containerName, container] of operationContainers) {
    const kind = containerName === "Query" ? "query" : "mutation";
    for (const field of container.fields ?? []) {
      const label = `${containerName}.${field.name.value}`;
      const op = directiveArgs(field, "operation");
      if (!op) throw new Error(`${label} must declare @operation`);
      if (op.profile !== "core" && !profiles.has(op.profile)) {
        throw new Error(`${label} names undeclared profile ${op.profile}`);
      }
      if (!OPERATION_AUTH_ROLES.has(op.auth)) {
        throw new Error(`${label} has unknown auth role ${op.auth}`);
      }
      const expectedMethod = kind === "query" ? "GET" : "POST";
      if (op.method !== expectedMethod) {
        throw new Error(`${label} must use method ${expectedMethod}`);
      }
      if (!pathPattern.test(op.path)) {
        throw new Error(`${label} path must match ${pathPattern.source}`);
      }
      if (operationPaths.has(op.path)) {
        throw new Error(`Duplicate operation path: ${op.path}`);
      }
      operationPaths.add(op.path);
      if (![200, 202].includes(op.successStatus)) {
        throw new Error(`${label} successStatus must be 200 or 202`);
      }
      if (
        kind === "query" &&
        (op.idempotent !== true || op.successStatus !== 200)
      ) {
        throw new Error(`${label} queries are idempotent 200 operations`);
      }
      if (typeof op.idempotent !== "boolean") {
        throw new Error(`${label} idempotent must be a boolean`);
      }
      if (!Array.isArray(op.errors) || op.errors.length === 0) {
        throw new Error(`${label} must declare its error codes`);
      }
      for (const code of op.errors) {
        if (!errorCodes.has(code)) {
          throw new Error(`${label} names unknown error code ${code}`);
        }
      }
      // The auth role implies error codes the binding will actually return, so
      // the OpenAPI document and the conformance vectors cannot disagree about
      // them. A rate-limitable operation must declare RATE_LIMITED.
      const requiredCodes = ["RATE_LIMITED"];
      if (op.auth !== "none") requiredCodes.push("UNAUTHORIZED");
      if (op.auth === "server") requiredCodes.push("FORBIDDEN");
      for (const code of requiredCodes) {
        if (!op.errors.includes(code)) {
          throw new Error(
            `${label} has auth "${op.auth}" and must declare ${code}`,
          );
        }
      }

      if ((field.arguments ?? []).length > 1) {
        throw new Error(`${label} takes at most one argument`);
      }
      let inputName = null;
      const argument = field.arguments?.[0];
      if (argument) {
        if (argument.name.value !== "input") {
          throw new Error(`${label} argument must be named input`);
        }
        if (
          argument.type.kind !== Kind.NON_NULL_TYPE ||
          argument.type.type.kind !== Kind.NAMED_TYPE
        ) {
          throw new Error(`${label} input must be a non-null named type`);
        }
        inputName = argument.type.type.name.value;
        const inputNode = definitions.get(inputName);
        if (inputNode?.kind !== Kind.INPUT_OBJECT_TYPE_DEFINITION) {
          throw new Error(`${label} input ${inputName} must be an input type`);
        }
        if (!directiveArgs(inputNode, "definition")) {
          throw new Error(`${label} input ${inputName} must be a @definition`);
        }
        if (op.method === "GET") {
          for (const inputField of inputNode.fields ?? []) {
            let fieldType = inputField.type;
            if (fieldType.kind === Kind.NON_NULL_TYPE) {
              fieldType = fieldType.type;
            }
            const named =
              fieldType.kind === Kind.NAMED_TYPE
                ? definitions.get(fieldType.name.value)
                : null;
            if (
              fieldType.kind !== Kind.NAMED_TYPE ||
              (named &&
                named.kind !== Kind.SCALAR_TYPE_DEFINITION &&
                named.kind !== Kind.ENUM_TYPE_DEFINITION)
            ) {
              throw new Error(
                `${label} is a GET operation, so ${inputName}.${inputField.name.value} must be a scalar query parameter`,
              );
            }
          }
        }
      }

      if (
        field.type.kind !== Kind.NON_NULL_TYPE ||
        field.type.type.kind !== Kind.NAMED_TYPE
      ) {
        throw new Error(`${label} result must be a non-null named type`);
      }
      const resultName = field.type.type.name.value;
      const resultNode = definitions.get(resultName);
      if (resultNode?.kind !== Kind.OBJECT_TYPE_DEFINITION) {
        throw new Error(`${label} result ${resultName} must be an object type`);
      }
      const isDocumentRoot = documents.some(
        (document) => document.root === resultName,
      );
      if (!directiveArgs(resultNode, "definition") && !isDocumentRoot) {
        throw new Error(
          `${label} result ${resultName} must be a @definition or a document root`,
        );
      }

      operations.push({
        name: field.name.value,
        kind,
        description: field.description?.value ?? "",
        profile: op.profile,
        auth: op.auth,
        method: op.method,
        path: op.path,
        successStatus: op.successStatus,
        idempotent: op.idempotent,
        errors: [...op.errors],
        input: inputName,
        result: resultName,
      });
    }
  }
  if (operationContainers.size && operations.length === 0) {
    throw new Error("Operation containers must declare operations");
  }

  // The GraphQL binding cannot express omitted-vs-null, so a nullable member
  // that may also be omitted would carry two meanings there. Forbid the
  // combination on every type an operation can reach.
  const operationReachable = new Set();
  const visitOperationType = (name) => {
    if (
      operationReachable.has(name) ||
      ["String", "Boolean", "Int", "Float", "ID"].includes(name)
    ) {
      return;
    }
    const node = definitions.get(name);
    if (!node) throw new Error(`Unknown SDL type: ${name}`);
    operationReachable.add(name);
    for (const field of node.fields ?? []) {
      let fieldType = field.type;
      const nullable = fieldType.kind !== Kind.NON_NULL_TYPE;
      if (nullable && directive(field, "optional")) {
        throw new Error(
          `${name}.${field.name.value} is operation-reachable and cannot be both nullable and @optional`,
        );
      }
      while (
        fieldType.kind === Kind.NON_NULL_TYPE ||
        fieldType.kind === Kind.LIST_TYPE
      ) {
        fieldType = fieldType.type;
      }
      visitOperationType(fieldType.name.value);
    }
    const mapValue = directiveArgs(node, "jsonMap")?.valueType;
    if (mapValue) visitOperationType(mapValue);
  };
  for (const operation of operations) {
    if (operation.input) visitOperationType(operation.input);
    visitOperationType(operation.result);
  }
  // Both bindings can return the shared error envelope on any operation.
  if (operations.length) visitOperationType("ProtocolErrorResponse");

  const definitionsBySchema = new Map();
  for (const node of definitions.values()) {
    const owner = directiveArgs(node, "definition")?.schema;
    if (!owner) continue;
    if (!documentNames.has(owner)) {
      throw new Error(
        `${node.name.value} references unknown document ${owner}`,
      );
    }
    if (directive(node, "inline")) {
      throw new Error(
        `${node.name.value} cannot be both @definition and @inline`,
      );
    }
    const list = definitionsBySchema.get(owner) ?? [];
    list.push(node);
    definitionsBySchema.set(owner, list);
  }

  const reachable = new Set();
  function visit(name) {
    if (
      reachable.has(name) ||
      ["String", "Boolean", "Int", "Float", "ID"].includes(name)
    ) {
      return;
    }
    const node = definitions.get(name);
    if (!node) throw new Error(`Unknown SDL type: ${name}`);
    reachable.add(name);
    for (const field of node.fields ?? []) {
      let fieldType = field.type;
      while (
        fieldType.kind === Kind.NON_NULL_TYPE ||
        fieldType.kind === Kind.LIST_TYPE
      ) {
        fieldType = fieldType.type;
      }
      visit(fieldType.name.value);
    }
    const mapValue = directiveArgs(node, "jsonMap")?.valueType;
    if (mapValue) visit(mapValue);
  }
  for (const document of documents) {
    if (document.root) visit(document.root);
  }
  for (const operation of operations) {
    if (operation.input) visit(operation.input);
    visit(operation.result);
  }
  if (operations.length) visit("ProtocolErrorResponse");
  const unreachable = [...definitions.keys()].filter(
    (name) => !reachable.has(name),
  );
  if (unreachable.length) {
    throw new Error(`Unreachable SDL types: ${unreachable.join(", ")}`);
  }

  function compileNamed(name, owner, allowNull = false, stack = []) {
    const builtins = {
      String: { type: "string" },
      Boolean: { type: "boolean" },
      Int: { type: "integer" },
      Float: { type: "number" },
      ID: { type: "string" },
    };
    if (builtins[name])
      return allowNull ? nullable(builtins[name]) : builtins[name];

    const node = definitions.get(name);
    if (!node) throw new Error(`Unknown SDL type: ${name}`);
    if (stack.includes(name))
      throw new Error(`Inline type cycle: ${[...stack, name].join(" -> ")}`);

    const definitionOwner = directiveArgs(node, "definition")?.schema;
    if (definitionOwner) {
      const ref =
        definitionOwner === owner
          ? `#/$defs/${name}`
          : `${definitionOwner}.schema.json#/$defs/${name}`;
      const schema = { $ref: ref };
      return allowNull ? nullable(schema) : schema;
    }

    let schema;
    if (
      node.kind === Kind.ENUM_TYPE_DEFINITION ||
      node.kind === Kind.SCALAR_TYPE_DEFINITION
    ) {
      schema = compileScalarOrEnum(node, owner, stack);
    } else if (directive(node, "inline")) {
      schema = compileObject(node, owner, [...stack, name]);
    } else {
      throw new Error(`${name} is neither a definition nor an inline type`);
    }
    schema = withDescription(node, schema);
    return allowNull ? nullable(schema) : schema;
  }

  function compileType(typeNode, owner, stack) {
    if (typeNode.kind === Kind.NON_NULL_TYPE) {
      return compileTypeNonNull(typeNode.type, owner, stack);
    }
    return nullable(compileTypeNonNull(typeNode, owner, stack));
  }

  function compileTypeNonNull(typeNode, owner, stack) {
    if (typeNode.kind === Kind.LIST_TYPE) {
      return {
        type: "array",
        items: compileType(typeNode.type, owner, stack),
      };
    }
    if (typeNode.kind !== Kind.NAMED_TYPE) {
      throw new Error(`Unsupported GraphQL type node: ${typeNode.kind}`);
    }
    return compileNamed(typeNode.name.value, owner, false, stack);
  }

  function compileField(field, owner, stack) {
    let schema = compileType(field.type, owner, stack);
    const array = directiveArgs(field, "jsonArray");
    if (array) {
      const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
      if (type !== "array")
        throw new Error(`${field.name.value} @jsonArray needs a list type`);
      schema = { ...schema, ...array };
    }
    const constant = directiveArgs(field, "jsonConst");
    if (constant) {
      schema = { ...schema, const: constant.boolean };
    }
    return withDescription(field, schema);
  }

  function applyInvariants(node, schema) {
    const eventInvariants = allDirectiveArgs(node, "eventInvariant");
    if (eventInvariants.length) {
      const knownEvents = new Set(
        directiveArgs(definitions.get("CommerceEventType"), "jsonString")
          ?.examples ?? [],
      );
      const knownStates = new Set(
        definitions
          .get("SubscriptionState")
          ?.values?.map((value) => value.name.value) ?? [],
      );
      schema.allOf = eventInvariants.map((rule) => {
        if (!rule.eventTypes?.length) {
          throw new Error("@eventInvariant needs eventTypes");
        }
        for (const eventType of rule.eventTypes) {
          if (!knownEvents.has(eventType)) {
            throw new Error(`@eventInvariant names unknown event ${eventType}`);
          }
        }
        const required = rule.require ?? [];
        for (const member of required) {
          if (!schema.properties[member]) {
            throw new Error(
              `@eventInvariant requires unknown member ${member}`,
            );
          }
        }
        if (
          rule.snapshotState !== undefined &&
          !knownStates.has(rule.snapshotState)
        ) {
          throw new Error(
            `@eventInvariant names unknown state ${rule.snapshotState}`,
          );
        }
        const constrainsSnapshot =
          rule.snapshotState !== undefined || rule.snapshotActive !== undefined;
        if (!required.length && !constrainsSnapshot) {
          throw new Error("@eventInvariant has no constraint");
        }

        const condition = {
          properties: {
            eventType: { enum: rule.eventTypes },
            ...(constrainsSnapshot ? { subscription: { type: "object" } } : {}),
          },
          required: [
            "eventType",
            ...(constrainsSnapshot ? ["subscription"] : []),
          ],
        };
        const then = {
          properties: Object.fromEntries(
            required.map((member) => [member, {}]),
          ),
          ...(required.length ? { required } : {}),
        };
        if (constrainsSnapshot) {
          const snapshotProperties = {
            ...(rule.snapshotState === undefined
              ? {}
              : { state: { const: rule.snapshotState } }),
            ...(rule.snapshotActive === undefined
              ? {}
              : { active: { const: rule.snapshotActive } }),
          };
          then.properties.subscription = {
            type: "object",
            properties: snapshotProperties,
            required: Object.keys(snapshotProperties),
          };
        }
        return { if: condition, then };
      });
    }

    if (directive(node, "supportInvariant")) {
      schema.anyOf = [
        {
          properties: {
            provider: { const: true },
            implementation: { const: true },
          },
        },
        {
          properties: { notes: { type: "string", minLength: 1 } },
          required: ["notes"],
        },
      ];
      schema.if = {
        properties: { implementation: { const: true } },
        required: ["implementation"],
      };
      schema.then = {
        properties: { provider: { const: true } },
        required: ["provider"],
      };
    }

    if (directive(node, "storeMappingInvariant")) {
      schema.anyOf = [
        {
          properties: {
            notificationChannel: { type: "string" },
            mappings: { type: "array", minItems: 1 },
          },
          required: ["notificationChannel", "mappings"],
        },
        {
          properties: { notes: { type: "string", minLength: 1 } },
          required: ["notes"],
        },
      ];
      schema.allOf = [
        {
          if: {
            properties: { notificationChannel: { type: "null" } },
            required: ["notificationChannel"],
          },
          then: {
            properties: { mappings: { type: "array", maxItems: 0 } },
            required: ["mappings"],
          },
        },
      ];
    }

    const evidenceRules = allDirectiveArgs(node, "storeEvidence");
    if (evidenceRules.length) {
      const conditions = evidenceRules.map((rule) => {
        if (!rule.store || !rule.member) {
          throw new Error("@storeEvidence needs store and member");
        }
        if (!schema.properties[rule.member]) {
          throw new Error(`@storeEvidence names unknown member ${rule.member}`);
        }
        return {
          if: {
            properties: { store: { const: rule.store } },
            required: ["store"],
          },
          then: {
            properties: { [rule.member]: {} },
            required: [rule.member],
          },
        };
      });
      schema.allOf = [...(schema.allOf ?? []), ...conditions];
    }

    if (directive(node, "mappingInvariant")) {
      schema.if = { properties: { event: { type: "null" } } };
      schema.then = {
        properties: { notes: { type: "string", minLength: 1 } },
        required: ["notes"],
      };
      schema.not = {
        properties: {
          whenNoPriorStoreEvent: { type: "boolean" },
          whenPreviousState: { type: "array" },
        },
        required: ["whenNoPriorStoreEvent", "whenPreviousState"],
      };
    }
    return schema;
  }

  function compileObject(node, owner, stack = []) {
    const object = requiredDirective(node, "jsonObject");
    const required = node.fields
      .filter((field) => !directive(field, "optional"))
      .map((field) => field.name.value);
    const properties = Object.fromEntries(
      node.fields.map((field) => [
        field.name.value,
        compileField(field, owner, stack),
      ]),
    );
    let schema = { type: "object" };
    if (required.length) schema.required = required;
    schema.additionalProperties = object.additionalProperties;
    schema.properties = properties;
    schema = applyInvariants(node, schema);
    return withDescription(node, schema);
  }

  function compileDefinition(node, owner) {
    if (
      node.kind === Kind.OBJECT_TYPE_DEFINITION ||
      node.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION
    ) {
      return compileObject(node, owner);
    }
    const schema = compileScalarOrEnum(node, owner);
    return withDescription(node, schema);
  }

  function compileScalarOrEnum(node, owner, stack = []) {
    if (node.kind === Kind.ENUM_TYPE_DEFINITION) {
      return {
        type: "string",
        enum: node.values.map((value) => value.name.value),
      };
    }
    if (node.kind !== Kind.SCALAR_TYPE_DEFINITION) {
      throw new Error(`Unsupported definition: ${node.name.value}`);
    }
    const string = directiveArgs(node, "jsonString");
    const integer = directiveArgs(node, "jsonInteger");
    const map = directiveArgs(node, "jsonMap");
    const declared = [string, integer, map].filter(Boolean);
    if (declared.length !== 1) {
      throw new Error(
        `${node.name.value} must declare one JSON scalar directive`,
      );
    }
    if (string) {
      return { type: "string", ...string };
    }
    if (integer) {
      return { type: "integer", ...integer };
    }
    if (map) {
      const {
        valueType,
        minProperties,
        maxProperties,
        keyPattern,
        keyMinLength,
        keyMaxLength,
      } = map;
      const schema = { type: "object" };
      if (minProperties !== undefined) schema.minProperties = minProperties;
      if (maxProperties !== undefined) schema.maxProperties = maxProperties;
      const propertyNames = {};
      if (keyPattern !== undefined) propertyNames.pattern = keyPattern;
      if (keyMinLength !== undefined) propertyNames.minLength = keyMinLength;
      if (keyMaxLength !== undefined) propertyNames.maxLength = keyMaxLength;
      if (Object.keys(propertyNames).length)
        schema.propertyNames = propertyNames;
      if (!valueType) {
        throw new Error(`${node.name.value} @jsonMap needs valueType`);
      }
      schema.additionalProperties = compileNamed(
        valueType,
        owner,
        false,
        stack,
      );
      return schema;
    }
    throw new Error(`${node.name.value} lacks a JSON scalar directive`);
  }

  const compiled = new Map();
  for (const document of documents) {
    const schema = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: `${protocol.baseId}/${protocol.version}/${document.name}.schema.json`,
      title: document.title,
      description: document.description,
    };
    if (document.root) {
      const root = definitions.get(document.root);
      if (!root || root.kind !== Kind.OBJECT_TYPE_DEFINITION) {
        throw new Error(
          `${document.name} root ${document.root} is not an object`,
        );
      }
      Object.assign(schema, compileObject(root, document.name));
    }
    const owned = definitionsBySchema.get(document.name) ?? [];
    if (owned.length) {
      schema.$defs = Object.fromEntries(
        owned.map((node) => [
          node.name.value,
          compileDefinition(node, document.name),
        ]),
      );
    }
    compiled.set(`${document.name}.schema.json`, schema);
  }

  return {
    schemas: compiled,
    ir: {
      version: protocol.version,
      baseId: protocol.baseId,
      profiles: [...profiles.values()],
      bindings: [...bindings.values()],
      errorCodes: [...errorCodes],
      errorStatus,
      operations,
    },
  };
}

export function compileCommerceSchemas(source) {
  return compileProtocolContract(source).schemas;
}

export function renderCommerceSchemas(source) {
  return new Map(
    [...compileCommerceSchemas(source)].map(([name, schema]) => [
      name,
      `${JSON.stringify(schema, null, 2)}\n`,
    ]),
  );
}

function main() {
  const source = readFileSync(sourcePath, "utf8");
  const rendered = renderCommerceSchemas(source);
  const check = process.argv.includes("--check");
  let stale = false;
  for (const [name, contents] of rendered) {
    const target = at(`generated/schemas/${name}`);
    if (check) {
      if (readFileSync(target, "utf8") !== contents) {
        console.error(`generated/schemas/${name} is stale`);
        stale = true;
      }
    } else {
      writeFileSync(target, contents);
      console.log(`wrote ${target}`);
    }
  }
  if (stale) {
    console.error("Run: node scripts/build-json-schemas.mjs");
    process.exitCode = 1;
  } else if (check) {
    console.log("generated JSON Schemas are current");
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  main();
