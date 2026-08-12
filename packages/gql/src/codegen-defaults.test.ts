import { describe, expect, it } from 'vitest';
import { CSharpPlugin } from '../codegen/plugins/csharp';
import { DartPlugin } from '../codegen/plugins/dart';
import { GDScriptPlugin } from '../codegen/plugins/gdscript';
import { KotlinPlugin } from '../codegen/plugins/kotlin';
import { SwiftPlugin } from '../codegen/plugins/swift';
import type { IREnum, IRField, IRSchema, IRType } from '../codegen/core/types';

const stringType: IRType = { kind: 'scalar', name: 'String', nullable: false };
const floatType: IRType = { kind: 'scalar', name: 'Float', nullable: false };
const booleanType: IRType = { kind: 'scalar', name: 'Boolean', nullable: false };

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
        name: 'DefaultInput',
        fields,
        hasRequiredFields: true,
        isCustomType: false,
      },
    ],
    unions: [],
    operations: [],
  };
}

function objectSchema(fields: IRField[], enums: IREnum[]): IRSchema {
  return {
    ...schema([], enums),
    inputs: [],
    objects: [
      {
        name: 'MappedProduct',
        fields,
        interfaces: [],
        unions: [],
        isResultUnion: false,
      },
    ],
  };
}

describe('codegen defaults', () => {
  it('exposes shared interface fields through C# union bases', () => {
    const isValid = field('isValid', booleanType);
    const output = new CSharpPlugin({ outputPath: 'Types.cs' }).generate({
      ...schema([]),
      interfaces: [{ name: 'ResultCommon', fields: [isValid] }],
      unions: [
        {
          name: 'Result',
          members: [{ name: 'ResultAndroid', isNestedUnion: false }],
          sharedInterfaces: ['ResultCommon'],
        },
      ],
      objects: [
        {
          name: 'ResultAndroid',
          fields: [isValid],
          interfaces: ['ResultCommon'],
          unions: ['Result'],
          isResultUnion: false,
        },
      ],
    });

    expect(output).toContain('public abstract record Result : ResultCommon');
    expect(output).toContain('public abstract bool IsValid { get; init; }');
    expect(output).toContain('public sealed record ResultAndroid : Result');
    expect(output).toContain('public override required bool IsValid { get; init; }');
  });

  it('wraps multiline C# documentation in one XML summary element', () => {
    const documentedField = field('value', stringType);
    documentedField.description = 'First line.\nSecond <line>.';

    const output = new CSharpPlugin({ outputPath: 'Types.cs' }).generate(schema([documentedField]));

    expect(output).toContain(
      ['    /// <summary>', '    /// First line.', '    /// Second &lt;line&gt;.', '    /// </summary>'].join('\n'),
    );
    expect(output).not.toContain('</summary>\n    /// <summary>');
  });

  it('keeps unsupported non-null C# defaults required and escapes string literals', () => {
    const output = new CSharpPlugin({ outputPath: 'Types.cs' }).generate(
      schema([field('unsupportedDefault', stringType, { raw: 'unsupported' }), field('escapedString', stringType, 'quote " and slash \\')]),
    );

    expect(output).toContain('public required string UnsupportedDefault { get; init; }');
    expect(output).toContain('public string EscapedString { get; init; } = "quote \\" and slash \\\\";');
  });

  it('emits whole-number GraphQL Float defaults as Kotlin Double literals', () => {
    const output = new KotlinPlugin({
      outputPath: 'Types.kt',
      packageName: 'dev.hyo.openiap',
    }).generate(schema([field('wholeWeight', floatType, 0), field('fractionalWeight', floatType, 1.5)]));

    expect(output).toContain('val wholeWeight: Double = 0.0');
    expect(output).toContain('val fractionalWeight: Double = 1.5,');
  });

  it('emits GraphQL enum defaults as GDScript field initializers', () => {
    const rendererEnum: IREnum = {
      name: 'Renderer',
      isErrorCode: false,
      values: [
        {
          name: 'UNSPECIFIED',
          rawValue: 'unspecified',
          legacyAliases: [],
        },
        {
          name: 'GOOGLE_RENDERED',
          rawValue: 'google-rendered',
          legacyAliases: [],
        },
      ],
    };
    const rendererType: IRType = {
      kind: 'enum',
      name: 'Renderer',
      nullable: true,
    };
    const output = new GDScriptPlugin({ outputPath: 'types.gd' }).generate(
      schema([field('renderer', rendererType, 'GOOGLE_RENDERED')], [rendererEnum]),
    );

    expect(output).toContain('var renderer: Renderer = Renderer.GOOGLE_RENDERED');

    const csharpOutput = new CSharpPlugin({ outputPath: 'Types.cs' }).generate(
      schema([field('renderer', rendererType, 'GOOGLE_RENDERED')], [rendererEnum]),
    );
    expect(csharpOutput).toContain('public Renderer? Renderer { get; init; } = global::OpenIap.Renderer.GoogleRendered;');
  });

  it('preserves null for GDScript enum inputs without defaults', () => {
    const rendererEnum: IREnum = {
      name: 'Renderer',
      isErrorCode: false,
      values: [
        {
          name: 'UNSPECIFIED',
          rawValue: 'unspecified',
          legacyAliases: [],
        },
      ],
    };
    const output = new GDScriptPlugin({ outputPath: 'types.gd' }).generate(
      schema(
        [
          field('renderer', {
            kind: 'enum',
            name: 'Renderer',
            nullable: true,
          }),
        ],
        [rendererEnum],
      ),
    );

    expect(output).toContain('var renderer: Variant = null');
    expect(output).toContain('if renderer != null:');
  });

  it('emits GraphQL enum-list defaults as GDScript array initializers', () => {
    // Regression: list defaults used to fall through to `[]`, silently
    // dropping schema defaults such as `categories: [InAppMessageCategoryAndroid!]
    // = [TRANSACTIONAL]` while every other language plugin kept them.
    const categoryEnum: IREnum = {
      name: 'Category',
      isErrorCode: false,
      values: [
        {
          name: 'TRANSACTIONAL',
          rawValue: 'transactional',
          legacyAliases: [],
        },
        {
          name: 'PROMOTIONAL',
          rawValue: 'promotional',
          legacyAliases: [],
        },
      ],
    };
    const listType: IRType = {
      kind: 'list',
      nullable: false,
      elementType: { kind: 'enum', name: 'Category', nullable: false },
    };
    const output = new GDScriptPlugin({ outputPath: 'types.gd' }).generate(
      schema([field('categories', listType, ['TRANSACTIONAL'])], [categoryEnum]),
    );

    expect(output).toContain('var categories: Array[Category] = [Category.TRANSACTIONAL]');
  });

  it('renders object defaults from IR without re-reading product policy', () => {
    const platformEnum: IREnum = {
      name: 'IapPlatform',
      isErrorCode: false,
      values: [
        { name: 'IOS', rawValue: 'ios', legacyAliases: [] },
        { name: 'Android', rawValue: 'android', legacyAliases: [] },
      ],
    };
    const productTypeEnum: IREnum = {
      name: 'ProductType',
      isErrorCode: false,
      values: [
        { name: 'InApp', rawValue: 'in-app', legacyAliases: [] },
        { name: 'Subs', rawValue: 'subs', legacyAliases: [] },
      ],
    };
    const product = objectSchema(
      [
        field('platform', { kind: 'enum', name: 'IapPlatform', nullable: false }, 'ios'),
        field('type', { kind: 'enum', name: 'ProductType', nullable: false }, 'in-app'),
      ],
      [platformEnum, productTypeEnum],
    );

    expect(new SwiftPlugin({ outputPath: 'Types.swift' }).generate(product)).toContain('public var platform: IapPlatform = .ios');
    expect(new KotlinPlugin({ outputPath: 'Types.kt' }).generate(product)).toContain('val platform: IapPlatform = IapPlatform.Ios');
    expect(new DartPlugin({ outputPath: 'types.dart' }).generate(product)).toContain('this.platform = IapPlatform.IOS');
    expect(new CSharpPlugin({ outputPath: 'Types.cs' }).generate(product)).toContain(
      'public IapPlatform Platform { get; init; } = global::OpenIap.IapPlatform.IOS;',
    );
    expect(new GDScriptPlugin({ outputPath: 'types.gd' }).generate(product)).toContain('var platform: IapPlatform = IapPlatform.IOS');
  });

  it('derives Swift ErrorCode compatibility cases from IR aliases', () => {
    const errorCode: IREnum = {
      name: 'ErrorCode',
      isErrorCode: true,
      values: [
        {
          name: 'LegacyFailure',
          rawValue: 'legacy-failure',
          legacyAliases: [],
        },
        {
          name: 'CanonicalFailure',
          rawValue: 'canonical-failure',
          legacyAliases: ['legacy-failure', 'LegacyFailure'],
        },
      ],
    };

    const output = new SwiftPlugin({ outputPath: 'Types.swift' }).generate(schema([], [errorCode]));

    expect(output).toContain('case "legacy-failure", "LegacyFailure":\n            self = .canonicalFailure // Legacy alias');
    expect(output).toContain('case "canonical-failure", "CanonicalFailure":\n            self = .canonicalFailure');
  });
});
