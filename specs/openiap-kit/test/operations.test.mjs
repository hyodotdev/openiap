// Guards the operation surface: the compiler rejections that keep an
// @operation honest, drift checks for every generated binding artifact, and
// schema-level accept/reject cases for the operation documents.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import Ajv from "ajv/dist/2020.js";
import { buildSchema, parse, validate } from "graphql";
import { describe, expect, it } from "vitest";

import { buildOperationArtifacts } from "../scripts/build-operations.mjs";
import { compileProtocolContract } from "../scripts/build-json-schemas.mjs";
import { bundleSchema } from "../src/index.mjs";

const at = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const source = readFileSync(at("generated/commerce-protocol.graphql"), "utf8");
const { ir } = compileProtocolContract(source);

const ajv = new Ajv({ strict: true, allErrors: true });
ajv.addSchema(bundleSchema, "bundle");
const validator = (name) => ajv.getSchema(`bundle#/$defs/${name}`);

describe("the operation IR", () => {
  it("declares exactly the six portable operations", () => {
    expect(ir.operations.map((operation) => operation.name).sort()).toEqual([
      "bindPurchase",
      "entitlements",
      "eraseUser",
      "providerCapabilities",
      "subscriptionStatus",
      "verifyPurchase",
    ]);
  });

  it("keeps account operations on the server role and verification account-free", () => {
    const byName = new Map(ir.operations.map((o) => [o.name, o]));
    expect(byName.get("verifyPurchase").auth).toBe("verification");
    for (const name of [
      "subscriptionStatus",
      "entitlements",
      "bindPurchase",
      "eraseUser",
    ]) {
      expect(byName.get(name).auth, name).toBe("server");
    }
    expect(byName.get("providerCapabilities").auth).toBe("none");
  });

  it("names the four profiles and two bindings", () => {
    expect(ir.profiles.map((profile) => profile.name).sort()).toEqual([
      "accountLifecycle",
      "entitlements",
      "events",
      "verification",
    ]);
    expect(ir.bindings.map((binding) => binding.name).sort()).toEqual([
      "graphql",
      "rest",
    ]);
  });

  it("maps every named error code to one HTTP status from the SDL", () => {
    for (const code of ir.errorCodes) {
      expect(ir.errorStatus[code], code).toBeGreaterThanOrEqual(400);
      expect(ir.errorStatus[code], code).toBeLessThan(600);
    }
    // The map covers exactly the named codes — no extra, no missing.
    expect(Object.keys(ir.errorStatus).sort()).toEqual(
      [...ir.errorCodes].sort(),
    );
  });
});

describe("compiler rejections for the operation surface", () => {
  const compile = (mutated) => () => compileProtocolContract(mutated);
  const mutate = (from, to) => {
    const mutated = source.replace(from, to);
    expect(mutated).not.toBe(source);
    return mutated;
  };

  it("rejects an operation without @operation", () => {
    const mutated = `${source}\nextend type Query { undeclared: ProviderCapabilities! }\n`;
    // extend type is not a definition the compiler walks, so express it as a
    // fresh SDL with a bare field instead.
    const bare = source.replace(
      '  providerCapabilities: ProviderCapabilities!\n    @operation(\n      profile: "core"\n      auth: "none"\n      method: "GET"\n      path: "/commerce/v1/capabilities"\n      successStatus: 200\n      idempotent: true\n      errors: ["RATE_LIMITED", "INTERNAL_ERROR"]\n    )',
      "  providerCapabilities: ProviderCapabilities!",
    );
    expect(bare).not.toBe(source);
    expect(() => compileProtocolContract(bare)).toThrow(
      "Query.providerCapabilities must declare @operation",
    );
    expect(mutated).toBeTruthy();
  });

  it("rejects an unknown auth role", () => {
    expect(
      compile(mutate('auth: "verification"', 'auth: "publishable"')),
    ).toThrow("Mutation.verifyPurchase has unknown auth role publishable");
  });

  it("rejects an undeclared profile", () => {
    expect(
      compile(mutate('profile: "verification"', 'profile: "billing"')),
    ).toThrow("Mutation.verifyPurchase names undeclared profile billing");
  });

  it("rejects a query that is not a GET", () => {
    expect(
      compile(
        mutate(
          'auth: "none"\n      method: "GET"\n      path: "/commerce/v1/capabilities"',
          'auth: "none"\n      method: "POST"\n      path: "/commerce/v1/capabilities"',
        ),
      ),
    ).toThrow("Query.providerCapabilities must use method GET");
  });

  it("rejects a path outside the versioned commerce namespace", () => {
    expect(
      compile(
        mutate('path: "/commerce/v1/capabilities"', 'path: "/v1/capabilities"'),
      ),
    ).toThrow("Query.providerCapabilities path must match");
  });

  it("rejects a duplicate operation path", () => {
    expect(
      compile(
        mutate(
          'path: "/commerce/v1/purchases/bind"',
          'path: "/commerce/v1/purchases/verify"',
        ),
      ),
    ).toThrow("Duplicate operation path: /commerce/v1/purchases/verify");
  });

  it("rejects an unknown error code", () => {
    expect(
      compile(
        mutate(
          '"UNSUPPORTED_STORE"\n        "VERIFICATION_FAILED"',
          '"UNSUPPORTED_STORE"\n        "NOT_A_CODE"',
        ),
      ),
    ).toThrow("Mutation.verifyPurchase names unknown error code NOT_A_CODE");
  });

  it("rejects a GET operation whose input cannot ride query parameters", () => {
    const mutated = mutate(
      'input SubscriptionStatusInput\n  @definition(schema: "operations")\n  @jsonObject(additionalProperties: true) {',
      'input SubscriptionStatusInput\n  @definition(schema: "operations")\n  @jsonObject(additionalProperties: true) {\n  apple: AppleEvidence! @optional',
    );
    expect(compile(mutated)).toThrow(
      "Query.subscriptionStatus is a GET operation, so SubscriptionStatusInput.apple must be a scalar query parameter",
    );
  });

  it("rejects a nullable @optional member on an operation-reachable type", () => {
    const mutated = mutate(
      "  environment: Environment! @optional\n}",
      "  environment: Environment @optional\n}",
    );
    expect(compile(mutated)).toThrow("cannot be both nullable and @optional");
  });

  it("rejects @storeEvidence naming an unknown member", () => {
    const mutated = mutate(
      '@storeEvidence(store: "amazon", member: "amazon") {\n  store: Store!\n  apple: AppleEvidence! @optional\n  google: GoogleEvidence! @optional\n  horizon: HorizonEvidence! @optional\n  amazon: AmazonEvidence! @optional\n}',
      '@storeEvidence(store: "amazon", member: "missing") {\n  store: Store!\n  apple: AppleEvidence! @optional\n  google: GoogleEvidence! @optional\n  horizon: HorizonEvidence! @optional\n  amazon: AmazonEvidence! @optional\n}',
    );
    expect(compile(mutated)).toThrow(
      "@storeEvidence names unknown member missing",
    );
  });

  it("rejects an operation container carrying type directives", () => {
    const mutated = mutate(
      "type Query {",
      "type Query @jsonObject(additionalProperties: true) {",
    );
    expect(compile(mutated)).toThrow(
      "Query is an operation container and takes no type directives",
    );
  });

  it("rejects a server operation missing FORBIDDEN in its error list", () => {
    const mutated = mutate(
      '"UNSUPPORTED_STORE"\n        "VERIFICATION_FAILED"',
      '"UNSUPPORTED_STORE"',
    );
    // verifyPurchase is verification-role, so it must keep UNAUTHORIZED; drop a
    // server op's FORBIDDEN instead to exercise the auth/error cross-check.
    const serverDrop = source.replace(
      '      profile: "accountLifecycle"\n      auth: "server"\n      method: "POST"\n      path: "/commerce/v1/purchases/bind"\n      successStatus: 200\n      idempotent: true\n      errors: [\n        "INVALID_REQUEST"\n        "UNAUTHORIZED"\n        "FORBIDDEN"',
      '      profile: "accountLifecycle"\n      auth: "server"\n      method: "POST"\n      path: "/commerce/v1/purchases/bind"\n      successStatus: 200\n      idempotent: true\n      errors: [\n        "INVALID_REQUEST"\n        "UNAUTHORIZED"',
    );
    expect(serverDrop).not.toBe(source);
    expect(() => compileProtocolContract(serverDrop)).toThrow(
      'Mutation.bindPurchase has auth "server" and must declare FORBIDDEN',
    );
    expect(mutated).toBeTruthy();
  });

  it("rejects an @errorStatus for an unknown code", () => {
    const mutated = mutate(
      '@errorStatus(code: "CONFLICT", http: 409)',
      '@errorStatus(code: "NOT_A_CODE", http: 409)',
    );
    expect(compile(mutated)).toThrow(
      "@errorStatus names unknown error code NOT_A_CODE",
    );
  });

  it("rejects a missing @errorStatus mapping", () => {
    const mutated = source.replace(
      '  @errorStatus(code: "CONFLICT", http: 409)\n',
      "",
    );
    expect(mutated).not.toBe(source);
    expect(() => compileProtocolContract(mutated)).toThrow(
      "@errorStatus is missing a mapping for CONFLICT",
    );
  });

  it("rejects a profile named core", () => {
    const mutated = mutate(
      '@profile(\n    name: "verification"',
      '@profile(\n    name: "core"',
    );
    expect(compile(mutated)).toThrow("Invalid @profile name: core");
  });
});

describe("generated binding artifacts", () => {
  const rendered = buildOperationArtifacts(source);

  it.each([...rendered.keys()])("generated/%s has no drift", (name) => {
    expect(readFileSync(at(`generated/${name}`), "utf8")).toBe(
      rendered.get(name),
    );
  });

  it("keeps the JSON-wrapped projection byte-identical to the .graphql one", () => {
    // The kit GraphQL binding imports operations-sdl.json (it survives a
    // single-file bundle); this pins it to operations.graphql, the file
    // SPEC.md 7 names as normative, so kit serving the JSON serves the SDL.
    const sdlJson = JSON.parse(
      readFileSync(at("generated/bindings/operations-sdl.json"), "utf8"),
    );
    const graphql = readFileSync(
      at("generated/bindings/operations.graphql"),
      "utf8",
    );
    expect(sdlJson.sdl).toBe(graphql);
  });

  it("projects an executable schema every canonical document validates against", () => {
    const schema = buildSchema(rendered.get("bindings/operations.graphql"));
    const documents = JSON.parse(
      rendered.get("bindings/graphql-operations.json"),
    );
    for (const [name, entry] of Object.entries(documents.operations)) {
      expect(validate(schema, parse(entry.document)), name).toEqual([]);
    }
    expect(schema.getSubscriptionType()).toBeUndefined();
  });

  it("keeps the projection header consistent with the SPEC's additive-MINOR rule", () => {
    // SPEC.md 7 was corrected from "serves exactly this schema" to allow a
    // compatible MINOR to extend the projection; the generated header must
    // say the same, or the two contradict.
    const header = rendered.get("bindings/operations.graphql").slice(0, 400);
    expect(header).toContain("compatible MINOR");
    expect(header).not.toContain("serves exactly this schema");
  });

  it("pins the introspection signature to the projection schema, member for member", () => {
    // The structural introspection check is only as strong as this artifact:
    // a generator regression that empties the OBJECT half would silently
    // disable every field/argument comparison while the byte-compare stays
    // green. So the whole signature is re-derived here from the executable
    // projection via graphql-js and must match exactly.
    const schema = buildSchema(rendered.get("bindings/operations.graphql"));
    const signature = JSON.parse(
      rendered.get("bindings/introspection-signature.json"),
    );
    const expected = {};
    for (const [name, type] of Object.entries(schema.getTypeMap())) {
      if (name.startsWith("__")) continue;
      if (["String", "Boolean", "Int", "Float", "ID"].includes(name)) continue;
      if (type.constructor.name === "GraphQLObjectType") {
        const fields = {};
        for (const [fieldName, field] of Object.entries(type.getFields())) {
          const args = {};
          for (const arg of field.args) args[arg.name] = String(arg.type);
          fields[fieldName] = {
            type: String(field.type),
            ...(Object.keys(args).length ? { args } : {}),
          };
        }
        expected[name] = { kind: "OBJECT", fields };
      } else if (type.constructor.name === "GraphQLInputObjectType") {
        const inputFields = {};
        for (const [fieldName, field] of Object.entries(type.getFields())) {
          inputFields[fieldName] = String(field.type);
        }
        expected[name] = { kind: "INPUT_OBJECT", inputFields };
      } else if (type.constructor.name === "GraphQLEnumType") {
        expected[name] = {
          kind: "ENUM",
          values: type
            .getValues()
            .map((value) => value.name)
            .sort(),
        };
      } else if (type.constructor.name === "GraphQLScalarType") {
        expected[name] = { kind: "SCALAR" };
      }
    }
    expect(signature.types).toEqual(expected);
    expect(signature.queryType).toBe(schema.getQueryType().name);
    expect(signature.mutationType).toBe(schema.getMutationType().name);
    // The OBJECT half is populated — the exact regression this pin exists for.
    const queryFields = signature.types[signature.queryType]?.fields ?? {};
    expect(Object.keys(queryFields).length).toBeGreaterThan(0);
  });

  it("pins every selection tree to the projection schema and the canonical document", () => {
    // Parity is judged by projecting results onto `selection` — a tree that
    // drifts shallow silently stops guarding its nested members, and the
    // byte-compare against the generator cannot catch a generator
    // regression. So the tree is re-derived here from two independent
    // renderings: the executable projection's type graph, and the canonical
    // document's own AST. All three must agree, member for member.
    const schema = buildSchema(rendered.get("bindings/operations.graphql"));
    const documents = JSON.parse(
      rendered.get("bindings/graphql-operations.json"),
    );
    const unwrap = (type) => {
      let current = type;
      while (current.ofType) current = current.ofType;
      return current;
    };
    const treeFromSchema = (type) => {
      if (typeof type.getFields !== "function") return true;
      const tree = {};
      for (const [fieldName, field] of Object.entries(type.getFields())) {
        tree[fieldName] = treeFromSchema(unwrap(field.type));
      }
      return tree;
    };
    const treeFromAst = (selectionSet) => {
      if (!selectionSet) return true;
      const tree = {};
      for (const selection of selectionSet.selections) {
        tree[selection.name.value] = treeFromAst(selection.selectionSet);
      }
      return tree;
    };
    const roots = {
      query: schema.getQueryType().getFields(),
      mutation: schema.getMutationType().getFields(),
    };
    for (const [name, entry] of Object.entries(documents.operations)) {
      const rootField = roots[entry.kind][name];
      expect(rootField, name).toBeDefined();
      expect(entry.selection, `${name} vs schema`).toEqual(
        treeFromSchema(unwrap(rootField.type)),
      );
      const operation = parse(entry.document).definitions[0];
      expect(entry.selection, `${name} vs document`).toEqual(
        treeFromAst(operation.selectionSet.selections[0].selectionSet),
      );
    }
  });

  it("keeps the manifest, OpenAPI paths, and IR in exact agreement", () => {
    const manifest = JSON.parse(rendered.get("bindings/http-binding.json"));
    const openapi = JSON.parse(
      rendered.get("openapi/commerce-protocol.openapi.json"),
    );
    expect(manifest.operations.map((o) => o.name).sort()).toEqual(
      ir.operations.map((o) => o.name).sort(),
    );
    for (const operation of manifest.operations) {
      const path = openapi.paths[operation.path];
      expect(path, operation.path).toBeDefined();
      const definition = path[operation.method.toLowerCase()];
      expect(definition.operationId).toBe(operation.name);
      expect(
        definition.responses[String(operation.successStatus)],
      ).toBeDefined();
      for (const code of operation.errors) {
        expect(
          definition.responses[String(manifest.errorStatus[code])],
          `${operation.name} ${code}`,
        ).toBeDefined();
      }
    }
  });

  it("references only bundle definitions that exist", () => {
    const manifest = JSON.parse(rendered.get("bindings/http-binding.json"));
    for (const operation of manifest.operations) {
      for (const pointer of [operation.input, operation.result]) {
        if (pointer === null) continue;
        const name = pointer.replace("#/$defs/", "");
        expect(bundleSchema.$defs[name], pointer).toBeDefined();
      }
    }
  });
});

describe("SPEC.md stays in agreement with the generated contract", () => {
  const spec = readFileSync(at("SPEC.md"), "utf8");

  it("documents exactly the manifest's error codes and statuses in section 8", () => {
    const section = spec.match(
      /## 8\. Portable errors\s*\n([\s\S]*?)(?=\n## )/u,
    )?.[1];
    expect(section).toBeTruthy();
    const rows = Object.fromEntries(
      [...section.matchAll(/^\| `([A-Z_]+)`\s*\| (\d{3})\s*\|/gmu)].map(
        (match) => [match[1], Number(match[2])],
      ),
    );
    const manifest = JSON.parse(
      readFileSync(at("generated/bindings/http-binding.json"), "utf8"),
    );
    expect(rows).toEqual(manifest.errorStatus);
  });

  it("documents every operation path in section 6 as the manifest binds it", () => {
    const manifest = JSON.parse(
      readFileSync(at("generated/bindings/http-binding.json"), "utf8"),
    );
    for (const operation of manifest.operations) {
      const row = new RegExp(
        `\\| \`${operation.name}\` +\\| ${operation.method} +\\| \`${operation.path.replaceAll("/", "/")}\``,
        "u",
      );
      expect(spec, `${operation.name} row`).toMatch(row);
    }
  });

  it("names each profile's operations in section 3 as declared in the SDL", () => {
    const manifest = JSON.parse(
      readFileSync(at("generated/bindings/http-binding.json"), "utf8"),
    );
    for (const operation of manifest.operations) {
      if (operation.profile === "core") continue;
      const row = spec
        .split("\n")
        .find((line) => line.startsWith(`| \`${operation.profile}\``));
      expect(row, operation.profile).toBeTruthy();
      expect(row, `${operation.profile} lists ${operation.name}`).toContain(
        operation.name,
      );
    }
  });
});

describe("operation document schemas", () => {
  const example = (name) =>
    JSON.parse(readFileSync(`${at("examples")}/${name}`, "utf8"));

  it("accepts the canonical verify request and result", () => {
    expect(
      validator("VerifyPurchaseInput")(example("verify-purchase-request.json")),
    ).toBe(true);
    expect(
      validator("VerifyPurchaseResult")(example("verify-purchase-result.json")),
    ).toBe(true);
  });

  it("rejects evidence that does not match the named store", () => {
    const request = example("verify-purchase-request.json");
    delete request.apple;
    expect(validator("VerifyPurchaseInput")(request)).toBe(false);
  });

  it("accepts an unknown store with no named evidence, keeping the space open", () => {
    expect(
      validator("VerifyPurchaseInput")({
        store: "a_store_openiap_has_never_heard_of",
      }),
    ).toBe(true);
  });

  it("rejects an error envelope without a code", () => {
    expect(
      validator("ProtocolErrorResponse")({ error: { message: "nope" } }),
    ).toBe(false);
    expect(
      validator("ProtocolErrorResponse")({
        error: { code: "VERIFICATION_FAILED", message: "nope" },
      }),
    ).toBe(true);
  });

  it("accepts a tokenless status result and has no member for a token to hide in", () => {
    const result = {
      active: true,
      subscription: {
        productId: "premium.monthly",
        state: "Active",
        active: true,
        store: "apple",
        expiresAt: 1758979200000,
      },
    };
    expect(validator("SubscriptionStatusResult")(result)).toBe(true);
    const snapshot = bundleSchema.$defs.SubscriptionStatusSnapshot;
    for (const member of ["purchaseToken", "originalTransactionId", "id"]) {
      expect(snapshot.properties[member]).toBeUndefined();
    }
  });

  it("keeps the example descriptor's profiles and bindings pinned to the manifest", () => {
    // IAPKit serves this file verbatim as its live providerCapabilities
    // result, so a profile/binding version bump in the SDL must not leave it
    // advertising a version the provider does not actually serve.
    const descriptor = example("provider-capabilities.json");
    const manifest = JSON.parse(
      readFileSync(at("generated/bindings/http-binding.json"), "utf8"),
    );
    expect(descriptor.profiles).toEqual(manifest.profiles);
    expect(descriptor.bindings).toEqual(manifest.bindings);
  });

  it("rejects a capability profile map with a non-canonical version", () => {
    const descriptor = example("provider-capabilities.json");
    expect(validator("ProviderCapabilities")(descriptor)).toBe(true);
    descriptor.profiles = { verification: "1" };
    expect(validator("ProviderCapabilities")(descriptor)).toBe(false);
  });

  it("tolerates an unknown future profile key", () => {
    const descriptor = example("provider-capabilities.json");
    descriptor.profiles = { ...descriptor.profiles, futureProfile: "1.0" };
    expect(validator("ProviderCapabilities")(descriptor)).toBe(true);
  });
});
