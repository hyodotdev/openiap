import { describe, expect, it } from 'vitest';
import type { IREnum, IRField, IRSchema, IRType } from '../codegen/core/types';
import { CSharpPlugin } from '../codegen/plugins/csharp';
import { DartPlugin } from '../codegen/plugins/dart';
import { GDScriptPlugin } from '../codegen/plugins/gdscript';
import { KotlinPlugin } from '../codegen/plugins/kotlin';

const tolerantStatus: IREnum = {
  name: 'TolerantStatus',
  isErrorCode: false,
  values: [
    { name: 'Unknown', rawValue: 'unknown', legacyAliases: [] },
    { name: 'Active', rawValue: 'active', legacyAliases: [] },
  ],
};

const strictFormat: IREnum = {
  name: 'StrictFormat',
  isErrorCode: false,
  values: [
    { name: 'Toml', rawValue: 'toml', legacyAliases: [] },
    { name: 'Json', rawValue: 'json', legacyAliases: [] },
  ],
};

const platform: IREnum = {
  name: 'Platform',
  isErrorCode: false,
  values: [
    { name: 'Ios', rawValue: 'ios', legacyAliases: [] },
    { name: 'Android', rawValue: 'android', legacyAliases: [] },
  ],
};

function field(name: string, type: IRType): IRField {
  return { name, type, isOverride: false };
}

function decoderSchema(): IRSchema {
  return {
    enums: [tolerantStatus, strictFormat, platform],
    interfaces: [],
    objects: [
      {
        name: 'Payload',
        fields: [
          field('format', {
            kind: 'enum',
            name: 'StrictFormat',
            nullable: false,
          }),
          field('body', { kind: 'scalar', name: 'String', nullable: false }),
        ],
        interfaces: [],
        unions: [],
        isResultUnion: false,
      },
      {
        name: 'Envelope',
        fields: [
          field('status', {
            kind: 'enum',
            name: 'TolerantStatus',
            nullable: false,
          }),
          field('payload', { kind: 'object', name: 'Payload', nullable: true }),
          field('transitive', { kind: 'object', name: 'TransitiveEnvelope', nullable: true }),
          field('deep', { kind: 'object', name: 'DeepEnvelope', nullable: true }),
        ],
        interfaces: [],
        unions: [],
        isResultUnion: false,
      },
      {
        name: 'RequiredEnvelope',
        fields: [
          field('payload', {
            kind: 'object',
            name: 'Payload',
            nullable: false,
          }),
        ],
        interfaces: [],
        unions: [],
        isResultUnion: false,
      },
      {
        name: 'TransitiveEnvelope',
        fields: [
          field('requiredEnvelope', {
            kind: 'object',
            name: 'RequiredEnvelope',
            nullable: false,
          }),
        ],
        interfaces: [],
        unions: [],
        isResultUnion: false,
      },
      {
        name: 'PayloadListEnvelope',
        fields: [
          field('payloads', {
            kind: 'list',
            nullable: false,
            elementType: {
              kind: 'object',
              name: 'Payload',
              nullable: false,
            },
          }),
        ],
        interfaces: [],
        unions: [],
        isResultUnion: false,
      },
      {
        name: 'ListOnlyPayload',
        fields: [
          field('format', {
            kind: 'enum',
            name: 'StrictFormat',
            nullable: false,
          }),
        ],
        interfaces: [],
        unions: [],
        isResultUnion: false,
      },
      {
        name: 'NullablePayloadListEnvelope',
        fields: [
          field('payloads', {
            kind: 'list',
            nullable: false,
            elementType: {
              kind: 'object',
              name: 'ListOnlyPayload',
              nullable: true,
            },
          }),
        ],
        interfaces: [],
        unions: [],
        isResultUnion: false,
      },
      {
        name: 'DeepPayload',
        fields: [
          field('format', {
            kind: 'enum',
            name: 'StrictFormat',
            nullable: false,
          }),
        ],
        interfaces: [],
        unions: [],
        isResultUnion: false,
      },
      {
        name: 'DeepEnvelope',
        fields: [
          field('payload', {
            kind: 'object',
            name: 'DeepPayload',
            nullable: false,
          }),
        ],
        interfaces: [],
        unions: [],
        isResultUnion: false,
      },
      {
        name: 'AndroidProduct',
        fields: [
          {
            ...field('platform', {
              kind: 'enum',
              name: 'Platform',
              nullable: false,
            }),
            defaultValue: 'Android',
          },
        ],
        interfaces: [],
        unions: [],
        isResultUnion: false,
      },
    ],
    inputs: [
      {
        name: 'InputPayload',
        fields: [
          field('format', {
            kind: 'enum',
            name: 'StrictFormat',
            nullable: false,
          }),
        ],
        hasRequiredFields: true,
        isCustomType: false,
      },
      {
        name: 'RequestInput',
        fields: [
          field('option', {
            kind: 'input',
            name: 'InputPayload',
            nullable: true,
          }),
          field('formats', {
            kind: 'list',
            nullable: true,
            elementType: {
              kind: 'enum',
              name: 'StrictFormat',
              nullable: true,
            },
          }),
        ],
        hasRequiredFields: false,
        isCustomType: false,
      },
    ],
    unions: [],
    operations: [
      {
        kind: 'Mutation',
        name: 'Mutation',
        fields: [
          {
            name: 'submit',
            args: [
              {
                name: 'options',
                type: {
                  kind: 'list',
                  nullable: false,
                  elementType: {
                    kind: 'input',
                    name: 'InputPayload',
                    nullable: false,
                  },
                },
              },
            ],
            returnType: { kind: 'scalar', name: 'Boolean', nullable: false },
            resolvedReturnType: { kind: 'scalar', name: 'Boolean', nullable: false },
          },
        ],
      },
    ],
  };
}

describe('unknown enum decoder compatibility', () => {
  it('degrades neutral Kotlin enums and drops an unreadable optional payload', () => {
    const output = new KotlinPlugin({ outputPath: 'Types.kt' }).generate(decoderSchema());

    expect(output).toContain('else -> TolerantStatus.Unknown');
    expect(output).not.toContain('Unknown TolerantStatus value');
    expect(output).toContain('else -> throw IllegalArgumentException("Unknown StrictFormat value: $value")');
    expect(output).toContain(
      'format = (json["format"] as? String)?.let { StrictFormat.fromJson(it) } ?: throw IllegalArgumentException("Missing required enum value for StrictFormat")',
    );
    expect(output).toContain('payload = (json["payload"] as? Map<String, Any?>)?.let { runCatching { Payload.fromJson(it) }.getOrNull() }');
    expect(output).toContain(
      'payload = (json["payload"] as? Map<String, Any?>)?.let { Payload.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for Payload")',
    );
    expect(output).toContain('transitive = (json["transitive"] as? Map<String, Any?>)?.let { runCatching { TransitiveEnvelope.fromJson(it) }.getOrNull() }');
    expect(output).toContain('deep = (json["deep"] as? Map<String, Any?>)?.let { runCatching { DeepEnvelope.fromJson(it) }.getOrNull() }');
    expect(output).toContain(
      'payloads = (json["payloads"] as? List<*>)?.map { (it as? Map<String, Any?>)?.let { runCatching { ListOnlyPayload.fromJson(it) }.getOrNull() } } ?: emptyList()',
    );
    expect(output).toContain(
      'format = (json["format"] as? String)?.let { StrictFormat.fromJson(it) } ?: throw IllegalArgumentException("Missing required enum value for StrictFormat")',
    );
    expect(output).toContain(
      'option = json["option"]?.let { value -> (value as? Map<String, Any?>)?.let { InputPayload.fromJson(it) } ?: throw IllegalArgumentException("Invalid input object for InputPayload") }',
    );
    expect(output).toContain('platform = (json["platform"] as? String)?.let { Platform.fromJson(it) } ?: Platform.Android');
  });

  it('degrades neutral Dart enums and drops an unreadable optional payload', () => {
    const output = new DartPlugin({ outputPath: 'types.dart' }).generate(decoderSchema());

    expect(output).toContain('return TolerantStatus.Unknown;');
    expect(output).not.toContain('Unknown TolerantStatus value');
    expect(output).toContain("throw ArgumentError('Unknown StrictFormat value: $value');");
    expect(output).toContain('static Payload? _tryFromJson(Map<String, dynamic> json)');
    expect(output).toContain('static TransitiveEnvelope? _tryFromJson(Map<String, dynamic> json)');
    expect(output).toContain('static ListOnlyPayload? _tryFromJson(Map<String, dynamic> json)');
    expect(output).toContain(
      "payloads: (json['payloads'] as List<dynamic>).map((e) => e is Map<String, dynamic> ? ListOnlyPayload._tryFromJson(e as Map<String, dynamic>) : null).toList()",
    );
    expect(output).not.toContain('static InputPayload? _tryFromJson');
    expect(output).toContain('} on ArgumentError {');
    expect(output).toContain('} on TypeError {');
    expect(output).toContain(
      "payload: json['payload'] is Map<String, dynamic> ? Payload._tryFromJson(json['payload'] as Map<String, dynamic>) : null",
    );
  });

  it('degrades neutral C# enums and drops an unreadable optional payload', () => {
    const output = new CSharpPlugin({ outputPath: 'Types.cs' }).generate(decoderSchema());

    expect(output).toContain('return TolerantStatus.Unknown;');
    expect(output).not.toContain('Unknown TolerantStatus value');
    expect(output).toContain('throw new JsonException($"Unknown StrictFormat value: {raw}");');
    expect(output).toContain('public sealed class PayloadNullableJsonConverter : JsonConverter<Payload?>');
    expect(output).toContain('public sealed class TransitiveEnvelopeNullableJsonConverter : JsonConverter<TransitiveEnvelope?>');
    expect(output).toContain(
      'public sealed class ListOnlyPayloadNullableElementListJsonConverter : JsonConverter<IReadOnlyList<ListOnlyPayload?>>',
    );
    expect(output).toContain('[JsonConverter(typeof(ListOnlyPayloadNullableElementListJsonConverter))]');
    expect(output).not.toContain('InputPayloadNullableJsonConverter');
    expect(output).toContain('[JsonConverter(typeof(PayloadNullableJsonConverter))]');
    expect(output).toContain('return document.RootElement.Deserialize<Payload>(options);');
    expect(output).toContain('catch (JsonException)');
  });

  it('degrades neutral GDScript enums and drops an unreadable optional payload', () => {
    const output = new GDScriptPlugin({ outputPath: 'types.gd' }).generate(decoderSchema());

    expect(output).toContain('obj.status = TOLERANT_STATUS_FROM_STRING.get(enum_str, TolerantStatus.UNKNOWN)');
    expect(output).toContain('obj.status = TolerantStatus.UNKNOWN');
    expect(output).toContain('static func from_dict(data: Dictionary, report_errors: bool = true) -> Payload:');
    expect(output).toContain('push_error("Invalid Payload.format enum value")');
    expect(output).toContain('\t\t\treturn null');
    expect(output).toContain(
      'static func from_dict_or_null(data: Dictionary) -> Variant:\n\t\treturn from_dict(data, false)',
    );
    expect(output).toContain('if data["payload"] is Dictionary:\n\t\t\t\tobj.payload = Payload.from_dict_or_null(data["payload"])');
    expect(output).toContain(
      'var decoded_payload = Payload.from_dict(data["payload"], report_errors)\n\t\t\t\tif decoded_payload == null:\n\t\t\t\t\tif report_errors:\n\t\t\t\t\t\tpush_error("Invalid required Payload value for payload")\n\t\t\t\t\treturn null',
    );
    expect(output).toContain(
      'var decoded_required_envelope = RequiredEnvelope.from_dict(data["requiredEnvelope"], report_errors)\n\t\t\t\tif decoded_required_envelope == null:\n\t\t\t\t\tif report_errors:\n\t\t\t\t\t\tpush_error("Invalid required RequiredEnvelope value for requiredEnvelope")\n\t\t\t\t\treturn null',
    );
    expect(output).toContain('var decoded_payload = Payload.from_dict(item, report_errors)');
    expect(output).toContain('if decoded_payload == null:');
    expect(output).toContain('\t\t\t\t\t\treturn null');
    expect(output).toContain('arr.append(decoded_payload)');
    expect(output).toContain('var decoded_list_only_payload = ListOnlyPayload.from_dict_or_null(item)');
    expect(output).toContain('arr.append(decoded_list_only_payload)');
    expect(output).toContain('var decoded_option = InputPayload.from_dict(data["option"])');
    expect(output).toContain('push_error("Invalid input InputPayload value for option")');
    expect(output).toContain('var formats: Array[Variant] = []');
    expect(output).toContain('if data["formats"] is Array:\n\t\t\t\tvar arr: Array[Variant] = []');
    expect(output).toContain('if item == null:\n\t\t\t\t\t\tarr.append(null)');
    expect(output).toContain('push_error("Invalid StrictFormat list value for formats")');
    const inputPayload = output.slice(output.indexOf('class InputPayload:'), output.indexOf('class RequestInput:'));
    expect(inputPayload).not.toContain('from_dict_or_null');
    const operation = output.slice(output.indexOf('class Mutation:'));
    expect(operation).toContain('var decoded_input_payload = InputPayload.from_dict(item)');
    expect(operation).not.toContain('InputPayload.from_dict(item, report_errors)');
  });
});
