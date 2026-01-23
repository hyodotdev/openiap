/**
 * Kotlin Code Generation Plugin
 *
 * Generates Kotlin data classes with JSON serialization from GraphQL schema.
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
  KOTLIN_KEYWORDS,
  GRAPHQL_TO_KOTLIN,
  toPascalCase,
  toKebabCase,
  toConstantCase,
  capitalize,
  PLATFORM_TYPE_DEFAULTS,
} from '../core/utils.js';

export class KotlinPlugin extends CodegenPlugin {
  readonly name = 'kotlin';
  readonly fileExtension = '.kt';
  readonly keywords = KOTLIN_KEYWORDS;

  private schema!: IRSchema;

  constructor(config: CodegenPluginConfig) {
    super(config);
  }

  // ============================================================================
  // Type Mapping
  // ============================================================================

  mapScalar(name: string): string {
    return GRAPHQL_TO_KOTLIN[name] ?? 'String';
  }

  mapType(type: IRType): string {
    if (type.kind === 'list') {
      const elementType = this.mapType(type.elementType!);
      const element = type.elementType!.nullable ? `${elementType}?` : elementType;
      return `List<${element}>`;
    }
    if (type.kind === 'scalar') {
      return this.mapScalar(type.name!);
    }
    return type.name!;
  }

  escapeKeyword(name: string): string {
    return this.keywords.has(name) ? `\`${name}\`` : name;
  }

  enumValueCase(name: string): string {
    return toPascalCase(name);
  }

  fieldNameCase(name: string): string {
    return name; // Kotlin uses camelCase which matches GraphQL field names
  }

  // ============================================================================
  // Code Generation
  // ============================================================================

  /**
   * Override generate to match original output order:
   * 1. All interfaces first
   * 2. All helpers second
   */
  generate(schema: IRSchema): string {
    this.schema = schema;
    this.lines = [];

    // Header
    this.generateHeader();

    // Enums
    if (schema.enums.length > 0) {
      this.addSectionComment('Enums');
      for (const irEnum of schema.enums) {
        this.generateEnum(irEnum);
      }
    }

    // Interfaces
    if (schema.interfaces.length > 0) {
      this.addSectionComment('Interfaces');
      for (const irInterface of schema.interfaces) {
        this.generateInterface(irInterface);
      }
    }

    // Objects
    if (schema.objects.length > 0) {
      this.addSectionComment('Objects');
      for (const irObject of schema.objects) {
        this.generateObject(irObject);
      }
    }

    // Inputs
    if (schema.inputs.length > 0) {
      this.addSectionComment('Input Objects');
      for (const irInput of schema.inputs) {
        this.generateInput(irInput);
      }
    }

    // Unions
    if (schema.unions.length > 0) {
      this.addSectionComment('Unions');
      for (const irUnion of schema.unions) {
        this.generateUnion(irUnion);
      }
    }

    // Operations - Interfaces first
    if (schema.operations.length > 0) {
      this.addSectionComment('Root Operations');
      for (const irOperation of schema.operations) {
        this.generateOperationInterface(irOperation);
      }
    }

    // Operations - Helpers second (matching original order)
    if (schema.operations.length > 0) {
      this.addSectionComment('Root Operation Helpers');
      for (const irOperation of schema.operations) {
        this.generateOperationHelpers(irOperation);
      }
    }

    const output = this.lines.join('\n');
    return this.postProcess(output);
  }

  generateHeader(): void {
    this.emit('// ============================================================================');
    this.emit('// AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY');
    this.emit('// Run `bun run generate` after updating any *.graphql schema file.');
    this.emit('// ============================================================================');
    this.emit('');
    this.emit('// Suppress unchecked cast warnings for JSON Map parsing - unavoidable due to Kotlin type erasure');
    this.emit('@file:Suppress("UNCHECKED_CAST")');
    this.emit('');
  }

  // ============================================================================
  // Enums
  // ============================================================================

  generateEnum(irEnum: IREnum): void {
    this.generateDocComment(irEnum.description);
    this.emit(`public enum class ${irEnum.name}(val rawValue: String) {`);

    irEnum.values.forEach((value, index) => {
      this.generateDocComment(value.description, '    ');
      const caseName = this.escapeKeyword(this.enumValueCase(value.name));
      const suffix = index === irEnum.values.length - 1 ? '' : ',';
      this.emit(`    ${caseName}("${value.rawValue}")${suffix}`);
    });

    this.emit('');
    this.emit('    companion object {');
    this.emit(`        fun fromJson(value: String): ${irEnum.name} = when (value) {`);

    for (const value of irEnum.values) {
      const caseName = this.escapeKeyword(this.enumValueCase(value.name));
      const rawValue = value.rawValue;
      this.emit(`            "${rawValue}" -> ${irEnum.name}.${caseName}`);

      // Add legacy aliases (CONSTANT_CASE and PascalCase)
      // Use Set to deduplicate (e.g., "None" as both PascalCase and value.name when name is "None")
      const legacyValues = new Set([toConstantCase(value.name), value.name]);
      for (const legacy of legacyValues) {
        if (legacy !== rawValue) {
          this.emit(`            "${legacy}" -> ${irEnum.name}.${caseName}`);
        }
      }
    }

    this.emit(`            else -> throw IllegalArgumentException("Unknown ${irEnum.name} value: $value")`);
    this.emit('        }');
    this.emit('    }');
    this.emit('');
    this.emit('    fun toJson(): String = rawValue');
    this.emit('}');
    this.emit('');
  }

  // ============================================================================
  // Interfaces
  // ============================================================================

  generateInterface(irInterface: IRInterface): void {
    this.generateDocComment(irInterface.description);
    this.emit(`public interface ${irInterface.name} {`);

    // Sort fields alphabetically for Kotlin
    const sortedFields = [...irInterface.fields].sort((a, b) => a.name.localeCompare(b.name));
    for (const field of sortedFields) {
      this.generateDocComment(field.description, '    ');
      const propertyType = this.getPropertyType(field.type);
      const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
      this.emit(`    val ${propertyName}: ${propertyType}`);
    }

    this.emit('}');
    this.emit('');
  }

  // ============================================================================
  // Objects (Data Classes)
  // ============================================================================

  generateObject(irObject: IRObject): void {
    // Handle VoidResult
    if (irObject.name === 'VoidResult') {
      this.emit('public typealias VoidResult = Unit');
      this.emit('');
      return;
    }

    // Handle result union wrappers
    if (irObject.isResultUnion && irObject.resultUnionEntries) {
      this.generateResultUnionObject(irObject);
      return;
    }

    // Sort fields alphabetically for Kotlin
    const sortedFields = [...irObject.fields].sort((a, b) => a.name.localeCompare(b.name));

    // Handle empty objects
    if (sortedFields.length === 0) {
      this.generateDocComment(irObject.description);
      this.emit(`public class ${irObject.name}`);
      this.emit('');
      return;
    }

    this.generateDocComment(irObject.description);
    this.emit(`public data class ${irObject.name}(`);

    sortedFields.forEach((field, index) => {
      this.generateDocComment(field.description, '    ');
      const propertyType = this.getPropertyType(field.type);
      const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
      const suffix = index === sortedFields.length - 1 ? '' : ',';
      const overrideKeyword = field.isOverride ? 'override ' : '';

      // Handle platform defaults
      const defaults = PLATFORM_TYPE_DEFAULTS[irObject.name];
      let defaultValue = field.type.nullable ? ' = null' : '';
      if (defaults && field.name === 'platform') {
        defaultValue = ` = IapPlatform.${toPascalCase(defaults.platform)}`;
      } else if (defaults && field.name === 'type') {
        defaultValue = ` = ProductType.${toPascalCase(defaults.type)}`;
      }

      this.emit(`    ${overrideKeyword}val ${propertyName}: ${propertyType}${defaultValue}${suffix}`);
    });

    const implementsList = [...irObject.interfaces, ...irObject.unions];
    if (implementsList.length > 0) {
      this.emit(`) : ${implementsList.join(', ')} {`);
    } else {
      this.emit(') {');
    }

    this.emit('');
    this.emit('    companion object {');
    this.emit(`        fun fromJson(json: Map<String, Any?>): ${irObject.name} {`);
    this.emit(`            return ${irObject.name}(`);

    for (const field of sortedFields) {
      const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
      const expression = this.buildFromJsonExpression(field.type, `json["${field.name}"]`);
      this.emit(`                ${propertyName} = ${expression},`);
    }

    this.emit('            )');
    this.emit('        }');
    this.emit('    }');
    this.emit('');

    const overrideKeyword = irObject.unions.length > 0 ? 'override ' : '';
    this.emit(`    ${overrideKeyword}fun toJson(): Map<String, Any?> = mapOf(`);
    this.emit(`        "__typename" to "${irObject.name}",`);

    for (const field of sortedFields) {
      const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
      const expression = this.buildToJsonExpression(field.type, propertyName);
      this.emit(`        "${field.name}" to ${expression},`);
    }

    this.emit('    )');
    this.emit('}');
    this.emit('');
  }

  private generateResultUnionObject(irObject: IRObject): void {
    this.generateDocComment(irObject.description);
    this.emit(`public sealed interface ${irObject.name}`);
    this.emit('');

    // Sort entries alphabetically
    const sortedEntries = [...irObject.resultUnionEntries!].sort((a, b) =>
      a.fieldName.localeCompare(b.fieldName)
    );
    for (const entry of sortedEntries) {
      const className = `${irObject.name}${capitalize(entry.fieldName)}`;
      const propertyType = this.getPropertyType(entry.type);
      this.emit(`public data class ${className}(val value: ${propertyType}) : ${irObject.name}`);
      this.emit('');
    }
  }

  // ============================================================================
  // Inputs (Data Classes)
  // ============================================================================

  generateInput(irInput: IRInput): void {
    // Handle custom types
    if (irInput.isCustomType) {
      this.generateCustomInput(irInput);
      return;
    }

    // Sort fields alphabetically for Kotlin
    const sortedFields = [...irInput.fields].sort((a, b) => a.name.localeCompare(b.name));

    this.generateDocComment(irInput.description);
    this.emit(`public data class ${irInput.name}(`);

    sortedFields.forEach((field, index) => {
      this.generateDocComment(field.description, '    ');
      const propertyType = this.getPropertyType(field.type);
      const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
      const suffix = index === sortedFields.length - 1 ? '' : ',';
      const defaultValue = field.type.nullable ? ' = null' : '';
      this.emit(`    val ${propertyName}: ${propertyType}${defaultValue}${suffix}`);
    });

    this.emit(') {');
    this.emit('    companion object {');

    // Check if input has required fields
    const hasRequiredFields = sortedFields.some((f) => !f.type.nullable);

    if (hasRequiredFields) {
      // Nullable fromJson pattern
      this.emit(`        fun fromJson(json: Map<String, Any?>): ${irInput.name}? {`);
      for (const field of sortedFields) {
        const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
        const expression = this.buildFromJsonExpression(field.type, `json["${field.name}"]`, false, true);
        this.emit(`            val ${propertyName} = ${expression}`);
      }

      // Null check for required fields (excluding enums which have fallbacks)
      const requiredFields = sortedFields.filter(
        (f) => !f.type.nullable && f.type.kind !== 'enum'
      );
      if (requiredFields.length > 0) {
        const nullChecks = requiredFields
          .map((f) => `${this.escapeKeyword(this.fieldNameCase(f.name))} == null`)
          .join(' || ');
        this.emit(`            if (${nullChecks}) return null`);
      }

      this.emit(`            return ${irInput.name}(`);
      for (const field of sortedFields) {
        const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
        this.emit(`                ${propertyName} = ${propertyName},`);
      }
      this.emit('            )');
      this.emit('        }');
    } else {
      // Non-null fromJson pattern
      this.emit(`        fun fromJson(json: Map<String, Any?>): ${irInput.name} {`);
      this.emit(`            return ${irInput.name}(`);
      for (const field of sortedFields) {
        const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
        const expression = this.buildFromJsonExpression(field.type, `json["${field.name}"]`);
        this.emit(`                ${propertyName} = ${expression},`);
      }
      this.emit('            )');
      this.emit('        }');
    }

    this.emit('    }');
    this.emit('');
    this.emit('    fun toJson(): Map<String, Any?> = mapOf(');

    for (const field of sortedFields) {
      const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
      const expression = this.buildToJsonExpression(field.type, propertyName);
      this.emit(`        "${field.name}" to ${expression},`);
    }

    this.emit('    )');
    this.emit('}');
    this.emit('');
  }

  private generateCustomInput(irInput: IRInput): void {
    switch (irInput.customTypeKind) {
      case 'PurchaseInput':
        this.emit('public typealias PurchaseInput = Purchase');
        this.emit('');
        break;
      case 'RequestPurchaseProps':
        this.generateRequestPurchaseProps(irInput);
        break;
      case 'DiscountOfferInputIOS':
        // In Kotlin, DiscountOfferInputIOS uses standard data class generation
        // (unlike Swift which needs custom Decodable for String -> Double conversion)
        this.generateStandardInput(irInput);
        break;
      default:
        this.generateStandardInput(irInput);
    }
  }

  private generateStandardInput(irInput: IRInput): void {
    this.generateDocComment(irInput.description);
    this.emit(`public data class ${irInput.name}(`);

    irInput.fields.forEach((field, index) => {
      this.generateDocComment(field.description, '    ');
      const propertyType = this.getPropertyType(field.type);
      const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
      const suffix = index === irInput.fields.length - 1 ? '' : ',';
      const defaultValue = field.type.nullable ? ' = null' : '';
      this.emit(`    val ${propertyName}: ${propertyType}${defaultValue}${suffix}`);
    });

    this.emit(') {');
    this.emit('    companion object {');

    // Check if input has required fields
    const hasRequiredFields = irInput.fields.some((f) => !f.type.nullable);

    if (hasRequiredFields) {
      // Nullable fromJson pattern
      this.emit(`        fun fromJson(json: Map<String, Any?>): ${irInput.name}? {`);
      for (const field of irInput.fields) {
        const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
        const expression = this.buildFromJsonExpression(field.type, `json["${field.name}"]`, false, true);
        this.emit(`            val ${propertyName} = ${expression}`);
      }

      // Null check for required fields (excluding enums which have fallbacks)
      const requiredFields = irInput.fields.filter(
        (f) => !f.type.nullable && f.type.kind !== 'enum'
      );
      if (requiredFields.length > 0) {
        const nullChecks = requiredFields
          .map((f) => `${this.escapeKeyword(this.fieldNameCase(f.name))} == null`)
          .join(' || ');
        this.emit(`            if (${nullChecks}) return null`);
      }

      this.emit(`            return ${irInput.name}(`);
      for (const field of irInput.fields) {
        const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
        this.emit(`                ${propertyName} = ${propertyName},`);
      }
      this.emit('            )');
      this.emit('        }');
    } else {
      // Non-null fromJson pattern
      this.emit(`        fun fromJson(json: Map<String, Any?>): ${irInput.name} {`);
      this.emit(`            return ${irInput.name}(`);
      for (const field of irInput.fields) {
        const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
        const expression = this.buildFromJsonExpression(field.type, `json["${field.name}"]`);
        this.emit(`                ${propertyName} = ${expression},`);
      }
      this.emit('            )');
      this.emit('        }');
    }

    this.emit('    }');
    this.emit('');
    this.emit('    fun toJson(): Map<String, Any?> = mapOf(');

    for (const field of irInput.fields) {
      const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
      const expression = this.buildToJsonExpression(field.type, propertyName);
      this.emit(`        "${field.name}" to ${expression},`);
    }

    this.emit('    )');
    this.emit('}');
    this.emit('');
  }

  private generateRequestPurchaseProps(irInput: IRInput): void {
    this.generateDocComment(irInput.description);
    this.emit('public data class RequestPurchaseProps(');
    this.emit('    val request: Request,');
    this.emit('    val type: ProductQueryType,');
    this.emit('    val useAlternativeBilling: Boolean? = null');
    this.emit(') {');
    this.emit('    init {');
    this.emit('        when (request) {');
    this.emit('            is Request.Purchase -> require(type == ProductQueryType.InApp) { "type must be IN_APP when request is purchase" }');
    this.emit('            is Request.Subscription -> require(type == ProductQueryType.Subs) { "type must be SUBS when request is subscription" }');
    this.emit('        }');
    this.emit('    }');
    this.emit('');
    this.emit('    companion object {');
    this.emit('        fun fromJson(json: Map<String, Any?>): RequestPurchaseProps {');
    this.emit('            val rawType = (json["type"] as String?)?.let { ProductQueryType.fromJson(it) }');
    this.emit('            val useAlternativeBilling = json["useAlternativeBilling"] as Boolean?');
    this.emit('            val purchaseJson = json["requestPurchase"] as Map<String, Any?>?');
    this.emit('            if (purchaseJson != null) {');
    this.emit('                val request = Request.Purchase(RequestPurchasePropsByPlatforms.fromJson(purchaseJson))');
    this.emit('                val finalType = rawType ?: ProductQueryType.InApp');
    this.emit('                require(finalType == ProductQueryType.InApp) { "type must be IN_APP when requestPurchase is provided" }');
    this.emit('                return RequestPurchaseProps(request = request, type = finalType, useAlternativeBilling = useAlternativeBilling)');
    this.emit('            }');
    this.emit('            val subscriptionJson = json["requestSubscription"] as Map<String, Any?>?');
    this.emit('            if (subscriptionJson != null) {');
    this.emit('                val request = Request.Subscription(RequestSubscriptionPropsByPlatforms.fromJson(subscriptionJson))');
    this.emit('                val finalType = rawType ?: ProductQueryType.Subs');
    this.emit('                require(finalType == ProductQueryType.Subs) { "type must be SUBS when requestSubscription is provided" }');
    this.emit('                return RequestPurchaseProps(request = request, type = finalType, useAlternativeBilling = useAlternativeBilling)');
    this.emit('            }');
    this.emit('            throw IllegalArgumentException("RequestPurchaseProps requires requestPurchase or requestSubscription")');
    this.emit('        }');
    this.emit('    }');
    this.emit('');
    this.emit('    fun toJson(): Map<String, Any?> = when (request) {');
    this.emit('        is Request.Purchase -> mapOf(');
    this.emit('            "requestPurchase" to request.value.toJson(),');
    this.emit('            "type" to type.toJson(),');
    this.emit('            "useAlternativeBilling" to useAlternativeBilling,');
    this.emit('        )');
    this.emit('        is Request.Subscription -> mapOf(');
    this.emit('            "requestSubscription" to request.value.toJson(),');
    this.emit('            "type" to type.toJson(),');
    this.emit('            "useAlternativeBilling" to useAlternativeBilling,');
    this.emit('        )');
    this.emit('    }');
    this.emit('');
    this.emit('    sealed class Request {');
    this.emit('        data class Purchase(val value: RequestPurchasePropsByPlatforms) : Request()');
    this.emit('        data class Subscription(val value: RequestSubscriptionPropsByPlatforms) : Request()');
    this.emit('    }');
    this.emit('}');
    this.emit('');
  }

  // ============================================================================
  // Unions (Sealed Interfaces)
  // ============================================================================

  generateUnion(irUnion: IRUnion): void {
    this.generateDocComment(irUnion.description);

    const implementations = irUnion.sharedInterfaces.length > 0
      ? ` : ${irUnion.sharedInterfaces.join(', ')}`
      : '';
    this.emit(`public sealed interface ${irUnion.name}${implementations} {`);
    this.emit('    fun toJson(): Map<String, Any?>');
    this.emit('');
    this.emit('    companion object {');
    this.emit(`        fun fromJson(json: Map<String, Any?>): ${irUnion.name} {`);
    this.emit('            return when (json["__typename"] as String?) {');

    // Collect all concrete members and their delegate targets
    const nestedUnions = new Set<string>();
    const concreteMembers: Array<{ name: string; delegateTo: string; isNested: boolean }> = [];

    for (const member of irUnion.members) {
      if (member.isNestedUnion) {
        nestedUnions.add(member.name);
        // Get concrete members from nested union
        const nestedUnion = this.schema.unions.find((u) => u.name === member.name);
        if (nestedUnion) {
          for (const nestedMember of nestedUnion.members) {
            concreteMembers.push({
              name: nestedMember.name,
              delegateTo: member.name,
              isNested: true,
            });
          }
        }
      } else {
        concreteMembers.push({
          name: member.name,
          delegateTo: member.name,
          isNested: false,
        });
      }
    }

    // Sort alphabetically (matching original generator)
    concreteMembers.sort((a, b) => a.name.localeCompare(b.name));

    for (const { name, delegateTo, isNested } of concreteMembers) {
      if (isNested) {
        const wrapperName = `${delegateTo}Item`;
        this.emit(`                "${name}" -> ${wrapperName}(${delegateTo}.fromJson(json))`);
      } else {
        this.emit(`                "${name}" -> ${delegateTo}.fromJson(json)`);
      }
    }

    this.emit(`                else -> throw IllegalArgumentException("Unknown __typename for ${irUnion.name}: \${json["__typename"]}")`);
    this.emit('            }');
    this.emit('        }');
    this.emit('    }');

    // Generate wrapper classes for nested unions
    for (const nestedUnionName of nestedUnions) {
      const wrapperName = `${nestedUnionName}Item`;
      this.emit('');
      this.emit(`    data class ${wrapperName}(val value: ${nestedUnionName}) : ${irUnion.name} {`);
      this.emit('        override fun toJson() = value.toJson()');
      this.emit('    }');
    }

    this.emit('}');
    this.emit('');
  }

  // ============================================================================
  // Operations (Interfaces + Helpers)
  // ============================================================================

  generateOperation(irOperation: IROperation): void {
    this.generateOperationInterface(irOperation);
    this.generateOperationHelpers(irOperation);
  }

  private generateOperationInterface(irOperation: IROperation): void {
    const interfaceName = `${irOperation.name}Resolver`;
    this.generateDocComment(irOperation.description ?? `GraphQL root ${irOperation.name.toLowerCase()} operations.`);
    this.emit(`public interface ${interfaceName} {`);

    // Sort fields alphabetically and filter _placeholder
    const sortedFields = irOperation.fields
      .filter((f) => f.name !== '_placeholder')
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const field of sortedFields) {
      this.generateDocComment(field.description, '    ');
      const returnType = this.getOperationReturnType(field);

      const args = field.args.map((arg) => {
        const argType = this.getPropertyType(arg.type);
        const argName = this.escapeKeyword(arg.name);
        const defaultValue = arg.type.nullable ? ' = null' : '';
        return `${argName}: ${argType}${defaultValue}`;
      });
      const params = args.length > 0 ? args.join(', ') : '';
      const paramSegment = `(${params})`;
      this.emit(`    suspend fun ${this.escapeKeyword(field.name)}${paramSegment}: ${returnType}`);
    }

    this.emit('}');
    this.emit('');
  }

  private generateOperationHelpers(irOperation: IROperation): void {
    // Sort fields alphabetically and filter _placeholder
    const sortedFields = irOperation.fields
      .filter((f) => f.name !== '_placeholder')
      .sort((a, b) => a.name.localeCompare(b.name));

    if (sortedFields.length === 0) return;

    this.emit(`// MARK: - ${irOperation.name} Helpers`);
    this.emit('');

    // Generate typealiases for handlers
    for (const field of sortedFields) {
      const aliasName = `${irOperation.name}${capitalize(field.name)}Handler`;
      const returnType = this.getOperationReturnType(field);

      if (field.args.length === 0) {
        this.emit(`public typealias ${aliasName} = suspend () -> ${returnType}`);
      } else {
        const argsSignature = field.args
          .map((arg) => {
            const argType = this.getPropertyType(arg.type);
            return `${this.escapeKeyword(arg.name)}: ${argType}`;
          })
          .join(', ');
        this.emit(`public typealias ${aliasName} = suspend (${argsSignature}) -> ${returnType}`);
      }
    }

    // Generate handlers data class
    const helperClass = `${irOperation.name}Handlers`;
    this.emit('');
    this.emit(`public data class ${helperClass}(`);

    sortedFields.forEach((field, index) => {
      const aliasName = `${irOperation.name}${capitalize(field.name)}Handler`;
      const propertyName = this.escapeKeyword(field.name);
      const suffix = index === sortedFields.length - 1 ? '' : ',';
      this.emit(`    val ${propertyName}: ${aliasName}? = null${suffix}`);
    });

    this.emit(')');
    this.emit('');
  }

  // ============================================================================
  // JSON Serialization Helpers
  // ============================================================================

  private buildFromJsonExpression(
    type: IRType,
    sourceExpr: string,
    isListElement: boolean = false,
    forNullableFromJson: boolean = false
  ): string {
    if (type.kind === 'list') {
      const element = this.buildFromJsonExpression(type.elementType!, 'it', true, forNullableFromJson);
      const mapFn = type.elementType!.nullable ? 'map' : 'mapNotNull';
      if (type.nullable || forNullableFromJson) {
        return `(${sourceExpr} as? List<*>)?.${mapFn} { ${element} }`;
      }
      return `(${sourceExpr} as? List<*>)?.${mapFn} { ${element} } ?: emptyList()`;
    }

    if (type.kind === 'scalar') {
      const useNullable = type.nullable || isListElement || forNullableFromJson;
      switch (type.name) {
        case 'Float':
          return useNullable
            ? `(${sourceExpr} as? Number)?.toDouble()`
            : `(${sourceExpr} as? Number)?.toDouble() ?: 0.0`;
        case 'Int':
          return useNullable
            ? `(${sourceExpr} as? Number)?.toInt()`
            : `(${sourceExpr} as? Number)?.toInt() ?: 0`;
        case 'Boolean':
          return useNullable
            ? `${sourceExpr} as? Boolean`
            : `${sourceExpr} as? Boolean ?: false`;
        case 'ID':
        case 'String':
        default:
          return useNullable
            ? `${sourceExpr} as? String`
            : `${sourceExpr} as? String ?: ""`;
      }
    }

    if (type.kind === 'enum') {
      if (type.nullable) {
        return `(${sourceExpr} as? String)?.let { ${type.name}.fromJson(it) }`;
      }
      // Find if enum has Empty value
      const irEnum = this.schema.enums.find((e) => e.name === type.name);
      const hasEmpty = irEnum?.values.some((v) => v.name.toLowerCase() === 'empty');
      if (hasEmpty) {
        return `(${sourceExpr} as? String)?.let { ${type.name}.fromJson(it) } ?: ${type.name}.Empty`;
      }
      const firstValue = irEnum?.values[0];
      const fallback = firstValue
        ? `${type.name}.${this.escapeKeyword(this.enumValueCase(firstValue.name))}`
        : `throw IllegalArgumentException("Missing required enum value for ${type.name}")`;
      return `(${sourceExpr} as? String)?.let { ${type.name}.fromJson(it) } ?: ${fallback}`;
    }

    if (['object', 'input', 'interface', 'union'].includes(type.kind)) {
      const callTarget = type.name!;
      if (type.nullable || forNullableFromJson) {
        return `(${sourceExpr} as? Map<String, Any?>)?.let { ${callTarget}.fromJson(it) }`;
      }
      // Check if input has required fields (nullable fromJson)
      const isInputWithRequired = this.schema.metadata.inputsWithRequiredFields.has(callTarget);
      if (isInputWithRequired) {
        return `(${sourceExpr} as? Map<String, Any?>)?.let { ${callTarget}.fromJson(it) } ?: throw IllegalArgumentException("Missing or invalid required object for ${callTarget}")`;
      }
      return `(${sourceExpr} as? Map<String, Any?>)?.let { ${callTarget}.fromJson(it) } ?: throw IllegalArgumentException("Missing required object for ${callTarget}")`;
    }

    return type.nullable ? sourceExpr : sourceExpr;
  }

  private buildToJsonExpression(type: IRType, accessorExpr: string): string {
    if (type.kind === 'list') {
      const inner = this.buildToJsonExpression(type.elementType!, 'it');
      if (inner === 'it') {
        return accessorExpr;
      }
      return type.nullable
        ? `${accessorExpr}?.map { ${inner} }`
        : `${accessorExpr}.map { ${inner} }`;
    }

    if (type.kind === 'enum') {
      return type.nullable ? `${accessorExpr}?.toJson()` : `${accessorExpr}.toJson()`;
    }

    if (['object', 'input', 'interface', 'union'].includes(type.kind)) {
      return type.nullable ? `${accessorExpr}?.toJson()` : `${accessorExpr}.toJson()`;
    }

    return accessorExpr;
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private getPropertyType(type: IRType): string {
    const baseType = this.mapType(type);
    return type.nullable ? `${baseType}?` : baseType;
  }

  private getOperationReturnType(field: IROperationField): string {
    const resolved = field.resolvedReturnType;

    // Handle Unit
    if (resolved.kind === 'scalar' && resolved.name === 'Void') {
      return resolved.nullable ? 'Unit?' : 'Unit';
    }

    return this.getPropertyType(resolved);
  }

  protected generateDocComment(description: string | undefined, indent: string = ''): void {
    if (!description) return;
    this.emit(`${indent}/**`);
    for (const line of description.split(/\r?\n/)) {
      this.emit(`${indent} * ${line}`);
    }
    this.emit(`${indent} */`);
  }
}
