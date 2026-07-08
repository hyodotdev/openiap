import { describe, expect, it } from "vitest";
import { CSharpPlugin } from "../codegen/plugins/csharp";
import { KotlinPlugin } from "../codegen/plugins/kotlin";
import type { IRField, IRSchema, IRType } from "../codegen/core/types";

const stringType: IRType = { kind: "scalar", name: "String", nullable: false };
const floatType: IRType = { kind: "scalar", name: "Float", nullable: false };

function field(name: string, type: IRType, defaultValue?: unknown): IRField {
  return {
    name,
    type,
    isOverride: false,
    ...(defaultValue !== undefined ? { defaultValue } : {}),
  };
}

function schema(fields: IRField[]): IRSchema {
  return {
    enums: [],
    interfaces: [],
    objects: [],
    inputs: [
      {
        name: "DefaultInput",
        fields,
        hasRequiredFields: true,
        isCustomType: false,
      },
    ],
    unions: [],
    operations: [],
    metadata: {
      unionWrapperNames: new Set(),
      futureFieldNames: new Set(),
      platformDefaults: new Map(),
      singleFieldObjects: new Map(),
      unionMembership: new Map(),
      inputsWithRequiredFields: new Set(),
    },
  };
}

describe("codegen defaults", () => {
  it("keeps unsupported non-null C# defaults required and escapes string literals", () => {
    const output = new CSharpPlugin({ outputPath: "Types.cs" }).generate(
      schema([
        field("unsupportedDefault", stringType, { raw: "unsupported" }),
        field("escapedString", stringType, 'quote " and slash \\'),
      ]),
    );

    expect(output).toContain(
      "public required string UnsupportedDefault { get; init; }",
    );
    expect(output).toContain(
      'public string EscapedString { get; init; } = "quote \\" and slash \\\\";',
    );
  });

  it("emits whole-number GraphQL Float defaults as Kotlin Double literals", () => {
    const output = new KotlinPlugin({
      outputPath: "Types.kt",
      packageName: "dev.hyo.openiap",
    }).generate(
      schema([
        field("wholeWeight", floatType, 0),
        field("fractionalWeight", floatType, 1.5),
      ]),
    );

    expect(output).toContain("val wholeWeight: Double = 0.0");
    expect(output).toContain("val fractionalWeight: Double = 1.5,");
  });
});
