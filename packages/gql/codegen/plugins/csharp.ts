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
  PLATFORM_TYPE_DEFAULTS,
} from '../core/utils.js';

const CSHARP_KEYWORDS = new Set([
  'abstract', 'as', 'base', 'bool', 'break', 'byte', 'case', 'catch', 'char',
  'checked', 'class', 'const', 'continue', 'decimal', 'default', 'delegate',
  'do', 'double', 'else', 'enum', 'event', 'explicit', 'extern', 'false',
  'finally', 'fixed', 'float', 'for', 'foreach', 'goto', 'if', 'implicit',
  'in', 'int', 'interface', 'internal', 'is', 'lock', 'long', 'namespace',
  'new', 'null', 'object', 'operator', 'out', 'override', 'params', 'private',
  'protected', 'public', 'readonly', 'ref', 'return', 'sbyte', 'sealed',
  'short', 'sizeof', 'stackalloc', 'static', 'string', 'struct', 'switch',
  'this', 'throw', 'true', 'try', 'typeof', 'uint', 'ulong', 'unchecked',
  'unsafe', 'ushort', 'using', 'virtual', 'void', 'volatile', 'while',
]);

const GRAPHQL_TO_CSHARP: Record<string, string> = {
  ID: 'string',
  String: 'string',
  Boolean: 'bool',
  Int: 'int',
  Float: 'double',
};

const NAMESPACE = 'Hyo.OpenIap';

export class CSharpPlugin extends CodegenPlugin {
  readonly name = 'csharp';
  readonly fileExtension = '.cs';
  readonly keywords = CSHARP_KEYWORDS;

  private schema!: IRSchema;
  private enumNames = new Set<string>();
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
    return GRAPHQL_TO_CSHARP[name] ?? 'string';
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

    for (const e of schema.enums) this.enumNames.add(e.name);

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
    this.emit('// ============================================================================');
    this.emit('// AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY');
    this.emit('// Run `bun run generate` after updating any *.graphql schema file.');
    this.emit('// ============================================================================');
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
    for (const line of lines) {
      this.emit(`${indent}/// <summary>${escapeXml(line)}</summary>`);
    }
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
    this.emit(`public sealed class ${converterName} : JsonConverter<${irEnum.name}>`);
    this.emit('{');
    this.emit(`    private static readonly Dictionary<string, ${irEnum.name}> _fromString = new()`);
    this.emit('    {');
    for (const value of irEnum.values) {
      const caseName = this.enumValueCase(value.name);
      const aliases = new Set<string>([
        value.rawValue,
        toConstantCase(value.name),
        value.name,
      ]);
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
    this.emit(`        throw new JsonException($"Unknown ${irEnum.name} value: {raw}");`);
    this.emit('    }');
    this.emit('');
    this.emit(`    public override void Write(Utf8JsonWriter writer, ${irEnum.name} value, JsonSerializerOptions options)`);
    this.emit('    {');
    this.emit(`        writer.WriteStringValue(_toString[value]);`);
    this.emit('    }');
    this.emit('');
    this.emit(`    internal static string ToRawString(${irEnum.name} value) => _toString[value];`);
    this.emit(`    internal static ${irEnum.name} FromRawString(string value) =>`);
    this.emit(`        _fromString.TryGetValue(value, out var v) ? v : throw new ArgumentException($"Unknown ${irEnum.name} value: {value}");`);
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

    // Emit JsonDerivedType for the IMMEDIATE union members only (concrete
    // records OR other unions). Nested unions inherit from this union so the
    // chain ProductOrSubscription → Product → ProductIOS is real C#
    // inheritance and `is Product` pattern matching just works.
    const immediate = [...irUnion.members].map((m) => m.name).sort();

    this.emit(`[JsonPolymorphic(TypeDiscriminatorPropertyName = "__typename")]`);
    for (const name of immediate) {
      this.emit(`[JsonDerivedType(typeof(${name}), "${name}")]`);
    }
    // Concrete members implement any shared interface directly. We don't
    // attach the interface to the abstract record because that would force
    // us to emit `abstract` overrides for every interface member and double
    // the property declarations on each concrete record.
    const parent = this.nestedUnionParents.get(irUnion.name);
    const inheritance = parent ? ` : ${parent}` : '';
    this.emit(`public abstract record ${irUnion.name}${inheritance};`);
    this.emit('');
  }

  // ============================================================================
  // Objects (Records)
  // ============================================================================

  generateObject(irObject: IRObject): void {
    if (irObject.name === 'VoidResult') {
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
    this.emitProperties(sortedFields, irObject.name);
    this.emit('}');
    this.emit('');
  }

  private computeBaseTypes(irObject: IRObject): string[] {
    // Records can only inherit from a single base record; pick the first
    // union as the base, then implement interfaces. Subsequent unions (rare)
    // are dropped since C# records cannot multi-inherit — consumers use the
    // primary union (e.g., ProductOrSubscription is handled via wrapper).
    const baseTypes: string[] = [];
    if (irObject.unions.length > 0) {
      baseTypes.push(irObject.unions[0]);
    }
    for (const iface of irObject.interfaces) {
      baseTypes.push(iface);
    }
    return baseTypes;
  }

  private emitProperties(fields: IRField[], typeName: string): void {
    const defaults = PLATFORM_TYPE_DEFAULTS[typeName];
    fields.forEach((field) => {
      this.emitDoc(field.description, '    ');
      const propType = this.propertyType(field.type);
      const propName = this.fieldNameCase(field.name);
      const jsonName = field.name;
      this.emit(`    [JsonPropertyName("${jsonName}")]`);

      // Required vs. nullable — non-nullable scalars/objects get the C#
      // `required` modifier so callers must initialize them; nullable
      // properties default to null.
      if (field.type.nullable) {
        this.emit(`    public ${propType} ${propName} { get; init; }`);
      } else if (defaults && field.name === 'platform') {
        const defaultValue = `IapPlatform.${toPascalCasePreserveIOS(defaults.platform)}`;
        this.emit(`    public ${propType} ${propName} { get; init; } = ${defaultValue};`);
      } else if (defaults && field.name === 'type') {
        const defaultValue = `ProductType.${toPascalCasePreserveIOS(defaults.type)}`;
        this.emit(`    public ${propType} ${propName} { get; init; } = ${defaultValue};`);
      } else {
        this.emit(`    public required ${propType} ${propName} { get; init; }`);
      }
    });
  }

  private generateResultUnionObject(irObject: IRObject): void {
    this.emitDoc(irObject.description);
    const entries = [...irObject.resultUnionEntries!].sort((a, b) =>
      a.fieldName.localeCompare(b.fieldName)
    );

    // Sealed wrapper hierarchy mirroring Kotlin. The actual GraphQL JSON for
    // these result unions has no `__typename` / `__variant` discriminator —
    // it is the field that is set that determines the variant — so we avoid
    // System.Text.Json polymorphism here. Consumers pattern-match on the
    // concrete record after manual deserialization.
    this.emit(`public abstract record ${irObject.name};`);
    this.emit('');

    for (const entry of entries) {
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
    this.emitProperties(irInput.fields, irInput.name);
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
      default:
        this.generateStandardInput(irInput);
        break;
    }
  }

  private generateRequestPurchaseProps(irInput: IRInput): void {
    this.emitDoc(irInput.description);
    this.emit('public sealed record RequestPurchaseProps');
    this.emit('{');
    this.emit('    [JsonPropertyName("requestPurchase")]');
    this.emit('    public RequestPurchasePropsByPlatforms? RequestPurchase { get; init; }');
    this.emit('');
    this.emit('    [JsonPropertyName("requestSubscription")]');
    this.emit('    public RequestSubscriptionPropsByPlatforms? RequestSubscription { get; init; }');
    this.emit('');
    this.emit('    [JsonPropertyName("type")]');
    this.emit('    public required ProductQueryType Type { get; init; }');
    this.emit('');
    this.emit('    [JsonPropertyName("useAlternativeBilling")]');
    this.emit('    public bool? UseAlternativeBilling { get; init; }');
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

    const sortedFields = irOperation.fields
      .filter((f) => f.name !== '_placeholder')
      .sort((a, b) => a.name.localeCompare(b.name));

    sortedFields.forEach((field, index) => {
      this.emitDoc(field.description, '    ');
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
    const resolved = field.resolvedReturnType;
    if (resolved.kind === 'list') {
      const inner = this.mapType(resolved.elementType!);
      const element = resolved.elementType!.nullable ? `${inner}?` : inner;
      const list = `IReadOnlyList<${element}>`;
      return resolved.nullable ? `${list}?` : list;
    }
    if (resolved.kind === 'scalar' && resolved.name === undefined) {
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

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
