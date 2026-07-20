import { describe, expect, it } from "vitest";
import { CSharpPlugin } from "../codegen/plugins/csharp";
import { GDScriptPlugin } from "../codegen/plugins/gdscript";
import { KotlinPlugin } from "../codegen/plugins/kotlin";
import type { IREnum, IRField, IRSchema, IRType } from "../codegen/core/types";

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

function schema(fields: IRField[], enums: IREnum[] = []): IRSchema {
  return {
    enums,
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

  it("emits GraphQL enum defaults as GDScript field initializers", () => {
    const rendererEnum: IREnum = {
      name: "Renderer",
      isErrorCode: false,
      values: [
        {
          name: "UNSPECIFIED",
          rawValue: "unspecified",
          legacyAliases: [],
        },
        {
          name: "GOOGLE_RENDERED",
          rawValue: "google-rendered",
          legacyAliases: [],
        },
      ],
    };
    const rendererType: IRType = {
      kind: "enum",
      name: "Renderer",
      nullable: true,
    };
    const output = new GDScriptPlugin({ outputPath: "types.gd" }).generate(
      schema(
        [field("renderer", rendererType, "GOOGLE_RENDERED")],
        [rendererEnum],
      ),
    );

    expect(output).toContain(
      "var renderer: Renderer = Renderer.GOOGLE_RENDERED",
    );

    const csharpOutput = new CSharpPlugin({ outputPath: "Types.cs" }).generate(
      schema(
        [field("renderer", rendererType, "GOOGLE_RENDERED")],
        [rendererEnum],
      ),
    );
    expect(csharpOutput).toContain(
      "public Renderer? Renderer { get; init; } = global::OpenIap.Renderer.GoogleRendered;",
    );
  });

  it("preserves null for GDScript enum inputs without defaults", () => {
    const rendererEnum: IREnum = {
      name: "Renderer",
      isErrorCode: false,
      values: [
        {
          name: "UNSPECIFIED",
          rawValue: "unspecified",
          legacyAliases: [],
        },
      ],
    };
    const output = new GDScriptPlugin({ outputPath: "types.gd" }).generate(
      schema(
        [
          field("renderer", {
            kind: "enum",
            name: "Renderer",
            nullable: true,
          }),
        ],
        [rendererEnum],
      ),
    );

    expect(output).toContain("var renderer: Variant = null");
    expect(output).toContain("if renderer != null:");
  });

  it("emits GraphQL enum-list defaults as GDScript array initializers", () => {
    // Regression: list defaults used to fall through to `[]`, silently
    // dropping schema defaults such as `categories: [InAppMessageCategoryAndroid!]
    // = [TRANSACTIONAL]` while every other language plugin kept them.
    const categoryEnum: IREnum = {
      name: "Category",
      isErrorCode: false,
      values: [
        {
          name: "TRANSACTIONAL",
          rawValue: "transactional",
          legacyAliases: [],
        },
        {
          name: "PROMOTIONAL",
          rawValue: "promotional",
          legacyAliases: [],
        },
      ],
    };
    const listType: IRType = {
      kind: "list",
      nullable: false,
      elementType: { kind: "enum", name: "Category", nullable: false },
    };
    const output = new GDScriptPlugin({ outputPath: "types.gd" }).generate(
      schema([field("categories", listType, ["TRANSACTIONAL"])], [categoryEnum]),
    );

    expect(output).toContain(
      "var categories: Array[Category] = [Category.TRANSACTIONAL]",
    );
  });
});
