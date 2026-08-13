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

function field(name: string, type: IRType): IRField {
  return { name, type, isOverride: false };
}

function decoderSchema(): IRSchema {
  return {
    enums: [tolerantStatus, strictFormat],
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
        ],
        interfaces: [],
        unions: [],
        isResultUnion: false,
      },
    ],
    inputs: [],
    unions: [],
    operations: [],
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
    expect(output).toContain(
      'payload = (json["payload"] as? Map<String, Any?>)?.let { runCatching { Payload.fromJson(it) }.getOrNull() }',
    );
  });

  it('degrades neutral Dart enums and drops an unreadable optional payload', () => {
    const output = new DartPlugin({ outputPath: 'types.dart' }).generate(decoderSchema());

    expect(output).toContain('return TolerantStatus.Unknown;');
    expect(output).not.toContain('Unknown TolerantStatus value');
    expect(output).toContain("throw ArgumentError('Unknown StrictFormat value: $value');");
    expect(output).toContain('static Payload? _tryFromJson(Map<String, dynamic> json)');
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
    expect(output).toContain('[JsonConverter(typeof(PayloadNullableJsonConverter))]');
    expect(output).toContain('return document.RootElement.Deserialize<Payload>(options);');
    expect(output).toContain('catch (JsonException)');
  });

  it('degrades neutral GDScript enums and drops an unreadable optional payload', () => {
    const output = new GDScriptPlugin({ outputPath: 'types.gd' }).generate(decoderSchema());

    expect(output).toContain('obj.status = TOLERANT_STATUS_FROM_STRING.get(enum_str, TolerantStatus.UNKNOWN)');
    expect(output).toContain('obj.status = TolerantStatus.UNKNOWN');
    expect(output).toContain(
      'if not data.has("format") or not data["format"] is String or not STRICT_FORMAT_FROM_STRING.has(data["format"]):',
    );
    expect(output).toContain('\t\t\treturn null');
    expect(output).toContain(
      'if data["payload"] is Dictionary:\n\t\t\t\tobj.payload = Payload.from_dict(data["payload"])\n\t\treturn obj',
    );
  });
});
