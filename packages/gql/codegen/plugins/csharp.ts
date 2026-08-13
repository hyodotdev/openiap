/**
 * C# Code Generation Plugin
 *
 * Generates C# 12 / .NET 8 records, enums, interfaces, and unions with
 * System.Text.Json serialization attributes from the OpenIAP GraphQL schema.
 *
 * Output conventions:
 *   - GraphQL enum  → C# enum + per-enum JsonConverter (string raw value).
 *   - GraphQL interface → C# interface (contract only; no JSON polymorphism).
 *   - GraphQL union → abstract record with [JsonPolymorphic("__typename")] +
 *     [JsonDerivedType] for each member.
 *   - GraphQL object → sealed record inheriting from its union (if any) and
 *     implementing each interface; properties use [JsonPropertyName].
 *   - GraphQL input → sealed record with required properties (matches Kotlin).
 *   - Operation root types (Query/Mutation/Subscription) → C# interface with
 *     Task<T>-returning async methods.
 *   - VoidResult → empty readonly record struct.
 *   - Result unions (# => Union) → abstract record + sealed wrapper records,
 *     mirroring the Kotlin sealed-interface pattern.
 */

import { CodegenPlugin, type CodegenPluginConfig } from './base-plugin.js';
import { generatedFileHeader } from '../core/generated-header.js';
import type {
  IRSchema,
  IREnum,
  IRInterface,
  IRObject,
  IRInput,
  IRUnion,
  IROperation,
  IRType,
  IRField,
  IROperationField,
} from '../core/types.js';
import {
  toPascalCasePreserveIOS,
  toCamelCasePreserveIOS,
  toConstantCase,
  capitalize,
  GRAPHQL_TO_CSHARP,
  requireGraphQLScalarMapping,
} from '../core/utils.js';

const CSHARP_KEYWORDS = new Set([
  'abstract',
  'as',
  'base',
  'bool',
  'break',
  'byte',
  'case',
  'catch',
  'char',
  'checked',
  'class',
  'const',
  'continue',
  'decimal',
  'default',
  'delegate',
  'do',
  'double',
  'else',
  'enum',
  'event',
  'explicit',
  'extern',
  'false',
  'finally',
  'fixed',
  'float',
  'for',
  'foreach',
  'goto',
  'if',
  'implicit',
  'in',
  'int',
  'interface',
  'internal',
  'is',
  'lock',
  'long',
  'namespace',
  'new',
  'null',
  'object',
  'operator',
  'out',
  'override',
  'params',
  'private',
  'protected',
  'public',
  'readonly',
  'ref',
  'return',
  'sbyte',
  'sealed',
  'short',
  'sizeof',
  'stackalloc',
  'static',
  'string',
  'struct',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'uint',
  'ulong',
  'unchecked',
  'unsafe',
  'ushort',
  'using',
  'virtual',
  'void',
  'volatile',
  'while',
]);

const NAMESPACE = 'OpenIap';

// Preserve the published MAUI 1.x CLR signatures until a coordinated 2.0.
const MAUI_1_X_STRING_RESULT_OPERATIONS = new Set(['deepLinkToSubscriptions', 'finishTransaction', 'restorePurchases']);

export class CSharpPlugin extends CodegenPlugin {
  readonly name = 'csharp';
  readonly fileExtension = '.cs';
  readonly keywords = CSHARP_KEYWORDS;

  private schema!: IRSchema;
  // For each nested-union name, the OUTER union it appears under. Used so the
  // nested union can inherit from its parent — that way C# pattern matching
  // works through the chain ProductOrSubscription → Product → ProductIOS.
  private nestedUnionParents = new Map<string, string>();

  constructor(config: CodegenPluginConfig) {
    super(config);
  }

  // ============================================================================
  // Type Mapping
  // ============================================================================

  mapScalar(name: string): string {
    return requireGraphQLScalarMapping(GRAPHQL_TO_CSHARP, name, 'C#');
  }

  mapType(type: IRType): string {
    if (type.kind === 'list') {
      const elementType = this.mapType(type.elementType!);
      const element = type.elementType!.nullable ? `${elementType}?` : elementType;
      return `IReadOnlyList<${element}>`;
    }
    if (type.kind === 'scalar') {
      return this.mapScalar(type.name!);
    }
    return type.name!;
  }

  escapeKeyword(name: string): string {
    return this.keywords.has(name) ? `@${name}` : name;
  }

  enumValueCase(name: string): string {
    return toPascalCasePreserveIOS(name);
  }

  fieldNameCase(name: string): string {
    // C# convention is PascalCase for properties; preserve IOS suffix.
    return toPascalCasePreserveIOS(name);
  }

  private propertyType(type: IRType): string {
    const base = this.mapType(type);
    return type.nullable ? `${base}?` : base;
  }

  // ============================================================================
  // Code Generation
  // ============================================================================

  generate(schema: IRSchema): string {
    this.schema = schema;
    this.lines = [];

    // Build a nested-union → outer-union map so nested members can declare
    // their inheritance and JsonPolymorphism nests correctly.
    this.nestedUnionParents.clear();
    for (const u of schema.unions) {
      for (const m of u.members) {
        if (m.isNestedUnion) {
          this.nestedUnionParents.set(m.name, u.name);
        }
      }
    }

    this.generateHeader();

    if (schema.enums.length > 0) {
      this.addSection('Enums');
      for (const irEnum of schema.enums) this.generateEnum(irEnum);
    }

    if (schema.interfaces.length > 0) {
      this.addSection('Interfaces');
      for (const i of schema.interfaces) this.generateInterface(i);
    }

    if (schema.unions.length > 0) {
      this.addSection('Unions');
      for (const u of schema.unions) this.generateUnion(u);
    }

    if (schema.objects.length > 0) {
      this.addSection('Objects');
      for (const o of schema.objects) this.generateObject(o);
    }

    if (schema.inputs.length > 0) {
      this.addSection('Input Objects');
      for (const i of schema.inputs) this.generateInput(i);
    }

    if (schema.operations.length > 0) {
      this.addSection('Root Operations');
      for (const op of schema.operations) this.generateOperation(op);
    }

    return this.postProcess(this.lines.join('\n'));
  }

  generateHeader(): void {
    for (const line of generatedFileHeader()) this.emit(line);
    this.emit('');
    this.emit('#nullable enable');
    this.emit('');
    this.emit('using System;');
    this.emit('using System.Collections.Generic;');
    this.emit('using System.Text.Json;');
    this.emit('using System.Text.Json.Serialization;');
    this.emit('using System.Threading.Tasks;');
    this.emit('');
    this.emit(`namespace ${NAMESPACE};`);
    this.emit('');
    this.emit('public interface IOpenIapEnumJsonConverter<TEnum> where TEnum : struct, Enum');
    this.emit('{');
    this.emit('    bool TryReadRaw(string value, out TEnum result);');
    this.emit('    string WriteRaw(TEnum value);');
    this.emit('}');
    this.emit('');
    this.emit('public sealed class StrictEnumJsonConverter<TEnum, TConverter> : JsonConverter<TEnum>');
    this.emit('    where TEnum : struct, Enum');
    this.emit('    where TConverter : IOpenIapEnumJsonConverter<TEnum>, new()');
    this.emit('{');
    this.emit('    private static readonly TConverter Converter = new();');
    this.emit('');
    this.emit('    public override TEnum Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)');
    this.emit('    {');
    this.emit('        var raw = reader.GetString();');
    this.emit('        if (raw is not null && Converter.TryReadRaw(raw, out var value)) return value;');
    this.emit('        throw new JsonException($"Unknown {typeof(TEnum).Name} input value: {raw}");');
    this.emit('    }');
    this.emit('');
    this.emit('    public override void Write(Utf8JsonWriter writer, TEnum value, JsonSerializerOptions options) =>');
    this.emit('        writer.WriteStringValue(Converter.WriteRaw(value));');
    this.emit('}');
    this.emit('');
    this.emit('public sealed class StrictNullableEnumJsonConverter<TEnum, TConverter> : JsonConverter<TEnum?>');
    this.emit('    where TEnum : struct, Enum');
    this.emit('    where TConverter : IOpenIapEnumJsonConverter<TEnum>, new()');
    this.emit('{');
    this.emit('    private static readonly TConverter Converter = new();');
    this.emit('');
    this.emit('    public override TEnum? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)');
    this.emit('    {');
    this.emit('        var raw = reader.GetString();');
    this.emit('        if (raw is not null && Converter.TryReadRaw(raw, out var value)) return value;');
    this.emit('        throw new JsonException($"Unknown {typeof(TEnum).Name} input value: {raw}");');
    this.emit('    }');
    this.emit('');
    this.emit('    public override void Write(Utf8JsonWriter writer, TEnum? value, JsonSerializerOptions options)');
    this.emit('    {');
    this.emit('        if (value is null) writer.WriteNullValue();');
    this.emit('        else writer.WriteStringValue(Converter.WriteRaw(value.Value));');
    this.emit('    }');
    this.emit('}');
    this.emit('');
    this.emit('public sealed class StrictEnumListJsonConverter<TEnum, TConverter> : JsonConverter<IReadOnlyList<TEnum>>');
    this.emit('    where TEnum : struct, Enum');
    this.emit('    where TConverter : IOpenIapEnumJsonConverter<TEnum>, new()');
    this.emit('{');
    this.emit('    private static readonly TConverter Converter = new();');
    this.emit('');
    this.emit('    public override IReadOnlyList<TEnum> Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)');
    this.emit('    {');
    this.emit('        using var document = JsonDocument.ParseValue(ref reader);');
    this.emit('        if (document.RootElement.ValueKind != JsonValueKind.Array) throw new JsonException("Expected an enum input array.");');
    this.emit('        var values = new List<TEnum>();');
    this.emit('        foreach (var element in document.RootElement.EnumerateArray())');
    this.emit('        {');
    this.emit('            var raw = element.ValueKind == JsonValueKind.String ? element.GetString() : null;');
    this.emit('            if (raw is null || !Converter.TryReadRaw(raw, out var value))');
    this.emit('                throw new JsonException($"Unknown {typeof(TEnum).Name} input value: {raw}");');
    this.emit('            values.Add(value);');
    this.emit('        }');
    this.emit('        return values;');
    this.emit('    }');
    this.emit('');
    this.emit('    public override void Write(Utf8JsonWriter writer, IReadOnlyList<TEnum> value, JsonSerializerOptions options)');
    this.emit('    {');
    this.emit('        writer.WriteStartArray();');
    this.emit('        foreach (var item in value) writer.WriteStringValue(Converter.WriteRaw(item));');
    this.emit('        writer.WriteEndArray();');
    this.emit('    }');
    this.emit('}');
    this.emit('');
    this.emit('public sealed class StrictNullableEnumListJsonConverter<TEnum, TConverter> : JsonConverter<IReadOnlyList<TEnum?>>');
    this.emit('    where TEnum : struct, Enum');
    this.emit('    where TConverter : IOpenIapEnumJsonConverter<TEnum>, new()');
    this.emit('{');
    this.emit('    private static readonly TConverter Converter = new();');
    this.emit('');
    this.emit('    public override IReadOnlyList<TEnum?> Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)');
    this.emit('    {');
    this.emit('        using var document = JsonDocument.ParseValue(ref reader);');
    this.emit('        if (document.RootElement.ValueKind != JsonValueKind.Array) throw new JsonException("Expected an enum input array.");');
    this.emit('        var values = new List<TEnum?>();');
    this.emit('        foreach (var element in document.RootElement.EnumerateArray())');
    this.emit('        {');
    this.emit('            if (element.ValueKind == JsonValueKind.Null)');
    this.emit('            {');
    this.emit('                values.Add(null);');
    this.emit('                continue;');
    this.emit('            }');
    this.emit('            var raw = element.ValueKind == JsonValueKind.String ? element.GetString() : null;');
    this.emit('            if (raw is null || !Converter.TryReadRaw(raw, out var value))');
    this.emit('                throw new JsonException($"Unknown {typeof(TEnum).Name} input value: {raw}");');
    this.emit('            values.Add(value);');
    this.emit('        }');
    this.emit('        return values;');
    this.emit('    }');
    this.emit('');
    this.emit('    public override void Write(Utf8JsonWriter writer, IReadOnlyList<TEnum?> value, JsonSerializerOptions options)');
    this.emit('    {');
    this.emit('        writer.WriteStartArray();');
    this.emit('        foreach (var item in value)');
    this.emit('        {');
    this.emit('            if (item is null) writer.WriteNullValue();');
    this.emit('            else writer.WriteStringValue(Converter.WriteRaw(item.Value));');
    this.emit('        }');
    this.emit('        writer.WriteEndArray();');
    this.emit('    }');
    this.emit('}');
    this.emit('');
  }

  private addSection(title: string): void {
    this.emit(`// ============================================================================`);
    this.emit(`// ${title}`);
    this.emit(`// ============================================================================`);
    this.emit('');
  }

  // ============================================================================
  // Doc Comments
  // ============================================================================

  private emitDoc(description: string | undefined, indent: string = ''): void {
    if (!description) return;
    const lines = description.split(/\r?\n/);
    if (lines.length === 1) {
      this.emit(`${indent}/// <summary>${escapeXml(lines[0])}</summary>`);
      return;
    }
    this.emit(`${indent}/// <summary>`);
    for (const line of lines) {
      this.emit(line ? `${indent}/// ${escapeXml(line)}` : `${indent}///`);
    }
    this.emit(`${indent}/// </summary>`);
  }

  // ============================================================================
  // Enums
  // ============================================================================

  generateEnum(irEnum: IREnum): void {
    const converterName = `${irEnum.name}JsonConverter`;
    this.emitDoc(irEnum.description);
    this.emit(`[JsonConverter(typeof(${converterName}))]`);
    this.emit(`public enum ${irEnum.name}`);
    this.emit('{');
    irEnum.values.forEach((value, index) => {
      this.emitDoc(value.description, '    ');
      const caseName = this.enumValueCase(value.name);
      const suffix = index === irEnum.values.length - 1 ? '' : ',';
      this.emit(`    ${caseName}${suffix}`);
    });
    this.emit('}');
    this.emit('');

    // Generate the per-enum JsonConverter that maps enum <-> raw string.
    this.emit(`public sealed class ${converterName} : JsonConverter<${irEnum.name}>, IOpenIapEnumJsonConverter<${irEnum.name}>`);
    this.emit('{');
    this.emit(`    private static readonly Dictionary<string, ${irEnum.name}> _fromString = new()`);
    this.emit('    {');
    for (const value of irEnum.values) {
      const caseName = this.enumValueCase(value.name);
      const aliases = new Set<string>([value.rawValue, toConstantCase(value.name), value.name]);
      for (const alias of aliases) {
        this.emit(`        ["${alias}"] = ${irEnum.name}.${caseName},`);
      }
    }
    this.emit('    };');
    this.emit('');
    this.emit(`    private static readonly Dictionary<${irEnum.name}, string> _toString = new()`);
    this.emit('    {');
    for (const value of irEnum.values) {
      const caseName = this.enumValueCase(value.name);
      this.emit(`        [${irEnum.name}.${caseName}] = "${value.rawValue}",`);
    }
    this.emit('    };');
    this.emit('');
    this.emit(`    public override ${irEnum.name} Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)`);
    this.emit('    {');
    this.emit('        var raw = reader.GetString();');
    this.emit(`        if (raw is not null && _fromString.TryGetValue(raw, out var value)) return value;`);
    const unknownValue = this.enumUnknownValue(irEnum);
    if (unknownValue) {
      this.emit(`        return ${irEnum.name}.${this.enumValueCase(unknownValue.name)};`);
    } else {
      this.emit(`        throw new JsonException($"Unknown ${irEnum.name} value: {raw}");`);
    }
    this.emit('    }');
    this.emit('');
    this.emit(`    public override void Write(Utf8JsonWriter writer, ${irEnum.name} value, JsonSerializerOptions options)`);
    this.emit('    {');
    this.emit(`        writer.WriteStringValue(_toString[value]);`);
    this.emit('    }');
    this.emit('');
    this.emit(`    internal static string ToRawString(${irEnum.name} value) => _toString[value];`);
    this.emit(`    internal static ${irEnum.name} FromRawString(string value) =>`);
    const fromRawFallback = unknownValue
      ? `${irEnum.name}.${this.enumValueCase(unknownValue.name)}`
      : `throw new ArgumentException($"Unknown ${irEnum.name} value: {value}")`;
    this.emit(`        _fromString.TryGetValue(value, out var v) ? v : ${fromRawFallback};`);
    this.emit('');
    this.emit(`    public bool TryReadRaw(string value, out ${irEnum.name} result) =>`);
    this.emit('        _fromString.TryGetValue(value, out result);');
    this.emit('');
    this.emit(`    public string WriteRaw(${irEnum.name} value) => _toString[value];`);
    this.emit('}');
    this.emit('');

    // Companion extension class so consumers can call `value.ToJson()` and
    // `<EnumName>Extensions.FromJson("…")` symmetrically with the Kotlin
    // codegen output.
    this.emit(`public static class ${irEnum.name}Extensions`);
    this.emit('{');
    this.emit(`    public static string ToJson(this ${irEnum.name} value) => ${converterName}.ToRawString(value);`);
    this.emit(`    public static ${irEnum.name} FromJson(string value) => ${converterName}.FromRawString(value);`);
    this.emit('}');
    this.emit('');
  }

  // ============================================================================
  // Interfaces
  // ============================================================================

  generateInterface(irInterface: IRInterface): void {
    this.emitDoc(irInterface.description);
    this.emit(`public interface ${irInterface.name}`);
    this.emit('{');
    const sortedFields = [...irInterface.fields].sort((a, b) => a.name.localeCompare(b.name));
    for (const field of sortedFields) {
      this.emitDoc(field.description, '    ');
      this.emitDeprecation(field.description, '    ');
      const propType = this.propertyType(field.type);
      const propName = this.fieldNameCase(field.name);
      this.emit(`    ${propType} ${propName} { get; }`);
    }
    this.emit('}');
    this.emit('');
  }

  // ============================================================================
  // Unions
  // ============================================================================

  generateUnion(irUnion: IRUnion): void {
    this.emitDoc(irUnion.description);

    // Register every transitive concrete descendant for STJ polymorphic
    // dispatch. STJ matches the discriminator value to a registered type and
    // constructs it directly — there is no multi-level recursive lookup, so a
    // nested chain like ProductOrSubscription → Product → ProductIOS must
    // expose ProductIOS as a `[JsonDerivedType]` of ProductOrSubscription too.
    // Mirrors the Dart codegen's flatten so the wire format is uniformly
    // leaf-`__typename` (e.g. "ProductIOS") for every abstract ancestor.
    const concrete = this.flattenUnionMembers(irUnion).sort();

    this.emit(`[JsonPolymorphic(TypeDiscriminatorPropertyName = "__typename")]`);
    for (const name of concrete) {
      this.emit(`[JsonDerivedType(typeof(${name}), "${name}")]`);
    }
    const parent = this.nestedUnionParents.get(irUnion.name);
    const baseTypes = [parent, ...irUnion.sharedInterfaces].filter(Boolean);
    const inheritance = baseTypes.length > 0 ? ` : ${baseTypes.join(', ')}` : '';
    const sharedFields = this.sharedInterfaceFields(irUnion);
    if (sharedFields.length === 0) {
      this.emit(`public abstract record ${irUnion.name}${inheritance};`);
      this.emit('');
      return;
    }

    this.emit(`public abstract record ${irUnion.name}${inheritance}`);
    this.emit('{');
    for (const field of sharedFields) {
      this.emitDoc(field.description, '    ');
      this.emitDeprecation(field.description, '    ');
      const propType = this.propertyType(field.type);
      const propName = this.fieldNameCase(field.name);
      this.emit(`    public abstract ${propType} ${propName} { get; init; }`);
    }
    this.emit('}');
    this.emit('');
  }

  private sharedInterfaceFields(irUnion: IRUnion): IRField[] {
    const fields = new Map<string, IRField>();
    for (const interfaceName of irUnion.sharedInterfaces) {
      const irInterface = this.schema.interfaces.find((item) => item.name === interfaceName);
      for (const field of irInterface?.fields ?? []) {
        fields.set(field.name, field);
      }
    }
    return [...fields.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  private flattenUnionMembers(irUnion: IRUnion): string[] {
    const out: string[] = [];
    for (const member of irUnion.members) {
      const nested = this.schema.unions.find((u) => u.name === member.name);
      if (nested) {
        out.push(...this.flattenUnionMembers(nested));
      } else {
        out.push(member.name);
      }
    }
    return out;
  }

  // ============================================================================
  // Objects (Records)
  // ============================================================================

  generateObject(irObject: IRObject): void {
    if (irObject.name === 'VoidResult') {
      this.emitDoc(irObject.description);
      this.emit('public readonly record struct VoidResult;');
      this.emit('');
      return;
    }

    if (irObject.isResultUnion && irObject.resultUnionEntries) {
      this.generateResultUnionObject(irObject);
      return;
    }

    const sortedFields = [...irObject.fields].sort((a, b) => a.name.localeCompare(b.name));

    if (sortedFields.length === 0) {
      this.emitDoc(irObject.description);
      this.emit(`public sealed record ${irObject.name};`);
      this.emit('');
      return;
    }

    this.emitDoc(irObject.description);
    const baseTypes = this.computeBaseTypes(irObject);
    const inheritance = baseTypes.length > 0 ? ` : ${baseTypes.join(', ')}` : '';
    this.emit(`public sealed record ${irObject.name}${inheritance}`);
    this.emit('{');
    this.emitProperties(sortedFields, this.inheritedUnionFieldNames(irObject));
    this.emit('}');
    this.emit('');
    this.emitNullableJsonConverter(irObject.name);
  }

  private computeBaseTypes(irObject: IRObject): string[] {
    // Records can only inherit from a single base record; pick the first
    // union as the base, then implement interfaces. Subsequent unions (rare)
    // are dropped since C# records cannot multi-inherit — consumers use the
    // primary union (e.g., ProductOrSubscription is handled via wrapper).
    const baseTypes: string[] = [];
    const inheritedInterfaces = new Set<string>();
    if (irObject.unions.length > 0) {
      baseTypes.push(irObject.unions[0]);
      const baseUnion = this.schema.unions.find((item) => item.name === irObject.unions[0]);
      for (const interfaceName of baseUnion?.sharedInterfaces ?? []) {
        inheritedInterfaces.add(interfaceName);
      }
    }
    for (const iface of irObject.interfaces) {
      if (!inheritedInterfaces.has(iface)) {
        baseTypes.push(iface);
      }
    }
    return baseTypes;
  }

  private inheritedUnionFieldNames(irObject: IRObject): Set<string> {
    const names = new Set<string>();
    const baseUnionName = irObject.unions[0];
    if (!baseUnionName) return names;
    const baseUnion = this.schema.unions.find((item) => item.name === baseUnionName);
    for (const field of baseUnion ? this.sharedInterfaceFields(baseUnion) : []) {
      names.add(field.name);
    }
    return names;
  }

  private emitProperties(fields: IRField[], inheritedFields = new Set<string>(), isInputContext = false): void {
    fields.forEach((field) => {
      this.emitDoc(field.description, '    ');
      this.emitDeprecation(field.description, '    ');
      const isDeprecated = this.deprecationReason(field.description) !== null;
      const propType = this.propertyType(field.type);
      const propName = this.fieldNameCase(field.name);
      const jsonName = field.name;
      const overrideModifier = inheritedFields.has(field.name) ? 'override ' : '';
      this.emit(`    [JsonPropertyName("${jsonName}")]`);
      if (isInputContext && field.type.kind === 'enum') {
        const converter = field.type.nullable ? 'StrictNullableEnumJsonConverter' : 'StrictEnumJsonConverter';
        this.emit(
          `    [JsonConverter(typeof(${converter}<${field.type.name}, ${field.type.name}JsonConverter>))]`,
        );
      } else if (isInputContext && field.type.kind === 'list' && field.type.elementType?.kind === 'enum') {
        const converter = field.type.elementType.nullable
          ? 'StrictNullableEnumListJsonConverter'
          : 'StrictEnumListJsonConverter';
        const enumName = field.type.elementType.name;
        this.emit(`    [JsonConverter(typeof(${converter}<${enumName}, ${enumName}JsonConverter>))]`);
      } else if (
        field.type.nullable &&
        ['object', 'input'].includes(field.type.kind) &&
        this.typeNeedsTolerantNullableDecoder(field.type.name!, this.schema)
      ) {
        this.emit(`    [JsonConverter(typeof(${field.type.name}NullableJsonConverter))]`);
      } else if (
        field.type.kind === 'list' &&
        field.type.elementType?.nullable === true &&
        field.type.elementType.kind === 'object' &&
        this.typeNeedsTolerantNullableDecoder(field.type.elementType.name!, this.schema)
      ) {
        this.emit(`    [JsonConverter(typeof(${field.type.elementType.name}NullableElementListJsonConverter))]`);
      }

      // Required vs. nullable — non-nullable scalars/objects get the C#
      // `required` modifier so callers must initialize them; nullable
      // properties default to null.
      if (field.type.nullable) {
        const defaultValue = this.buildDefaultValueExpression(field);
        const initializer = defaultValue ? ` = ${defaultValue};` : '';
        this.emit(`    public ${overrideModifier}${propType} ${propName} { get; init; }${initializer}`);
      } else if (field.defaultValue !== undefined) {
        const defaultValue = this.buildDefaultValueExpression(field);
        if (defaultValue) {
          this.emit(`    public ${overrideModifier}${propType} ${propName} { get; init; } = ${defaultValue};`);
        } else {
          this.emit(`    public ${overrideModifier}required ${propType} ${propName} { get; init; }`);
        }
      } else if (isDeprecated) {
        // C# rejects ObsoleteAttribute on required members (CS9042). Keep the
        // non-null wire type while allowing callers to initialize only the
        // replacement field.
        this.emit(`    public ${overrideModifier}${propType} ${propName} { get; init; }`);
      } else {
        this.emit(`    public ${overrideModifier}required ${propType} ${propName} { get; init; }`);
      }
    });
  }

  private buildDefaultValueExpression(field: IRField): string | null {
    if (field.defaultValue === undefined) return null;
    return this.buildDefaultValueForType(field.type, field.defaultValue);
  }

  private buildDefaultValueForType(type: IRType, defaultValue: unknown): string | null {
    if (type.kind === 'list') {
      if (!Array.isArray(defaultValue)) return null;
      const itemType = this.mapType(type.elementType!);
      const items = defaultValue
        .map((value) => this.buildDefaultValueForType(type.elementType!, value))
        .filter((value): value is string => value !== null);
      return `new List<${itemType}> { ${items.join(', ')} }`;
    }
    if (type.kind === 'enum' && typeof defaultValue === 'string') {
      return `global::${NAMESPACE}.${type.name}.${this.enumValueCase(defaultValue)}`;
    }
    if (type.kind === 'scalar') {
      if (typeof defaultValue === 'string') return this.csharpStringLiteral(defaultValue);
      if (typeof defaultValue === 'number' || typeof defaultValue === 'boolean') {
        return String(defaultValue).toLowerCase();
      }
    }
    return null;
  }

  private csharpStringLiteral(value: string): string {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r/g, '\\r').replace(/\n/g, '\\n').replace(/\t/g, '\\t')}"`;
  }

  private emitDeprecation(description: string | undefined, indent: string = ''): void {
    const reason = this.deprecationReason(description);
    if (!reason) return;
    this.emit(`${indent}[Obsolete(${this.csharpStringLiteral(reason)})]`);
  }

  private deprecationReason(description: string | undefined): string | null {
    return description?.match(/(?:^|\n)@deprecated\s+([^\n]+)/)?.[1]?.trim() || null;
  }

  private generateResultUnionObject(irObject: IRObject): void {
    this.emitDoc(irObject.description);
    const entries = [...irObject.resultUnionEntries!].sort((a, b) => a.fieldName.localeCompare(b.fieldName));

    // Sealed wrapper hierarchy mirroring Kotlin. The actual GraphQL JSON for
    // these result unions has no `__typename` / `__variant` discriminator —
    // it is the field that is set that determines the variant — so we avoid
    // System.Text.Json polymorphism here. Consumers pattern-match on the
    // concrete record after manual deserialization.
    this.emit(`public abstract record ${irObject.name};`);
    this.emit('');

    for (const entry of entries) {
      this.emitDoc(entry.description);
      const className = `${irObject.name}${capitalize(entry.fieldName)}`;
      const propType = this.propertyType(entry.type);
      this.emit(`public sealed record ${className}(${propType} Value) : ${irObject.name};`);
      this.emit('');
    }
  }

  // ============================================================================
  // Inputs (Records)
  // ============================================================================

  generateInput(irInput: IRInput): void {
    if (irInput.isCustomType) {
      this.generateCustomInput(irInput);
      return;
    }
    this.generateStandardInput(irInput);
  }

  private generateStandardInput(irInput: IRInput): void {
    this.emitDoc(irInput.description);
    this.emit(`public sealed record ${irInput.name}`);
    this.emit('{');
    this.emitProperties(irInput.fields, new Set<string>(), true);
    this.emit('}');
    this.emit('');
    this.emitNullableJsonConverter(irInput.name);
  }

  private emitNullableJsonConverter(typeName: string): void {
    if (!this.typeNeedsTolerantNullableDecoder(typeName, this.schema)) return;
    this.emit(`public sealed class ${typeName}NullableJsonConverter : JsonConverter<${typeName}?>`);
    this.emit('{');
    this.emit(
      `    public override ${typeName}? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)`,
    );
    this.emit('    {');
    this.emit('        using var document = JsonDocument.ParseValue(ref reader);');
    this.emit('        try');
    this.emit('        {');
    this.emit(`            return document.RootElement.Deserialize<${typeName}>(options);`);
    this.emit('        }');
    this.emit('        catch (JsonException)');
    this.emit('        {');
    this.emit('            return null;');
    this.emit('        }');
    this.emit('        catch (InvalidOperationException)');
    this.emit('        {');
    this.emit('            return null;');
    this.emit('        }');
    this.emit('    }');
    this.emit('');
    this.emit(
      `    public override void Write(Utf8JsonWriter writer, ${typeName}? value, JsonSerializerOptions options) =>`,
    );
    this.emit('        JsonSerializer.Serialize(writer, value, options);');
    this.emit('}');
    this.emit('');

    const needsListConverter = this.schema.objects.some((container) =>
      container.fields.some(
        (field) =>
          field.type.kind === 'list' &&
          field.type.elementType?.nullable === true &&
          field.type.elementType.kind === 'object' &&
          field.type.elementType.name === typeName,
      ),
    );
    if (!needsListConverter) return;
    this.emit(`public sealed class ${typeName}NullableElementListJsonConverter : JsonConverter<IReadOnlyList<${typeName}?>>`);
    this.emit('{');
    this.emit(
      `    public override IReadOnlyList<${typeName}?> Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)`,
    );
    this.emit('    {');
    this.emit('        using var document = JsonDocument.ParseValue(ref reader);');
    this.emit('        if (document.RootElement.ValueKind != JsonValueKind.Array)');
    this.emit('        {');
    this.emit(`            throw new JsonException("Expected an array of ${typeName} values.");`);
    this.emit('        }');
    this.emit(`        var values = new List<${typeName}?>();`);
    this.emit('        foreach (var element in document.RootElement.EnumerateArray())');
    this.emit('        {');
    this.emit('            try');
    this.emit('            {');
    this.emit(`                values.Add(element.Deserialize<${typeName}>(options));`);
    this.emit('            }');
    this.emit('            catch (JsonException)');
    this.emit('            {');
    this.emit('                values.Add(null);');
    this.emit('            }');
    this.emit('            catch (InvalidOperationException)');
    this.emit('            {');
    this.emit('                values.Add(null);');
    this.emit('            }');
    this.emit('        }');
    this.emit('        return values;');
    this.emit('    }');
    this.emit('');
    this.emit(
      `    public override void Write(Utf8JsonWriter writer, IReadOnlyList<${typeName}?> value, JsonSerializerOptions options) =>`,
    );
    this.emit('        JsonSerializer.Serialize(writer, value, options);');
    this.emit('}');
    this.emit('');
  }

  private generateCustomInput(irInput: IRInput): void {
    switch (irInput.customTypeKind) {
      case 'PurchaseInput':
        // Alias-style: PurchaseInput is just a Purchase. C# supports
        // file-scoped using-aliases but they don't compose with generics
        // across files, so we emit a thin forwarding record instead.
        this.emit('// PurchaseInput is structurally a Purchase; consumers should pass a');
        this.emit('// Purchase instance directly. Kept as a typedef-style alias record.');
        this.emit(`public sealed record PurchaseInput(Purchase Value);`);
        this.emit('');
        break;
      case 'RequestPurchaseProps':
        this.generateRequestPurchaseProps(irInput);
        break;
      case 'DiscountOfferInputIOS':
        this.generateStandardInput(irInput);
        break;
      default:
        throw new Error(`${irInput.name} is marked as a custom input without a C# generator strategy.`);
    }
  }

  private generateRequestPurchaseProps(irInput: IRInput): void {
    const [requestPurchase, requestSubscription, type] = this.requireCustomInputFields(irInput);
    this.emitDoc(irInput.description);
    this.emit('public sealed record RequestPurchaseProps : IJsonOnDeserialized');
    this.emit('{');
    this.emitDoc(requestPurchase.description, '    ');
    this.emit('    [JsonPropertyName("requestPurchase")]');
    this.emit('    public RequestPurchasePropsByPlatforms? RequestPurchase { get; init; }');
    this.emit('');
    this.emitDoc(requestSubscription.description, '    ');
    this.emit('    [JsonPropertyName("requestSubscription")]');
    this.emit('    public RequestSubscriptionPropsByPlatforms? RequestSubscription { get; init; }');
    this.emit('');
    this.emitDoc(type.description, '    ');
    this.emit('    [JsonPropertyName("type")]');
    this.emit('    [JsonConverter(typeof(StrictEnumJsonConverter<ProductQueryType, ProductQueryTypeJsonConverter>))]');
    this.emit('    public required ProductQueryType Type { get; init; }');
    this.emit('');
    this.emit('    public void Validate()');
    this.emit('    {');
    this.emit('        var hasPurchase = RequestPurchase is not null;');
    this.emit('        var hasSubscription = RequestSubscription is not null;');
    this.emit('        if (hasPurchase == hasSubscription)');
    this.emit(
      '            throw new InvalidOperationException("RequestPurchaseProps requires exactly one of requestPurchase or requestSubscription");',
    );
    this.emit('        if (hasPurchase && Type != ProductQueryType.InApp)');
    this.emit('            throw new InvalidOperationException("type must be IN_APP when requestPurchase is provided");');
    this.emit('        if (hasSubscription && Type != ProductQueryType.Subs)');
    this.emit('            throw new InvalidOperationException("type must be SUBS when requestSubscription is provided");');
    this.emit('    }');
    this.emit('');
    this.emit('    void IJsonOnDeserialized.OnDeserialized() => Validate();');
    this.emit('}');
    this.emit('');
  }

  // ============================================================================
  // Operations
  // ============================================================================

  generateOperation(irOperation: IROperation): void {
    const interfaceName = `${irOperation.name}Resolver`;
    this.emitDoc(irOperation.description ?? `GraphQL root ${irOperation.name.toLowerCase()} operations.`);
    this.emit(`public interface ${interfaceName}`);
    this.emit('{');

    const sortedFields = irOperation.fields.filter((f) => f.name !== '_placeholder').sort((a, b) => a.name.localeCompare(b.name));

    sortedFields.forEach((field, index) => {
      this.emitDoc(this.operationFieldDescription(field), '    ');
      const returnType = this.getOperationReturnType(field);
      const args = field.args.map((arg) => {
        const argType = this.propertyType(arg.type);
        const argName = this.escapeKeyword(toCamelCasePreserveIOS(arg.name));
        const defaultValue = arg.type.nullable ? ' = null' : '';
        return `${argType} ${argName}${defaultValue}`;
      });
      const params = args.join(', ');
      const methodName = this.fieldNameCase(field.name);
      this.emit(`    Task<${returnType}> ${methodName}Async(${params});`);
      if (index < sortedFields.length - 1) this.emit('');
    });

    this.emit('}');
    this.emit('');
  }

  private getOperationReturnType(field: IROperationField): string {
    if (MAUI_1_X_STRING_RESULT_OPERATIONS.has(field.name)) return 'string';
    const resolved = field.resolvedReturnType;
    if (resolved.kind === 'list') {
      const inner = this.mapType(resolved.elementType!);
      const element = resolved.elementType!.nullable ? `${inner}?` : inner;
      const list = `IReadOnlyList<${element}>`;
      return resolved.nullable ? `${list}?` : list;
    }
    if (resolved.kind === 'scalar' && resolved.name === 'Void') {
      return 'VoidResult';
    }
    if (resolved.name === 'VoidResult') return 'VoidResult';
    const base = this.mapType(resolved);
    return resolved.nullable ? `${base}?` : base;
  }

  // ============================================================================
  // Required abstract method stubs (handled inline via generate())
  // ============================================================================

  // Note: base-plugin's `generate()` calls these in a specific order; we
  // override generate() directly above so these just delegate.
}

// ============================================================================
// XML escaping for /// <summary> docs
// ============================================================================
//
// Only `&`, `<`, `>` are mandatory inside XML element content per the W3C XML
// 1.0 spec — `'` and `"` are only required inside attribute values. We escape
// all five for defensive completeness so the helper is safe to reuse from any
// XML emission site (attribute or content) without auditing the call shape.

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
