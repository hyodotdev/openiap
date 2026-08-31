/**
 * Kotlin Code Generation Plugin
 *
 * Generates Kotlin data classes with JSON serialization from GraphQL schema.
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
  KOTLIN_KEYWORDS,
  GRAPHQL_TO_KOTLIN,
  requireGraphQLScalarMapping,
  toPascalCase,
  toConstantCase,
  capitalize,
} from '../core/utils.js';

interface CompatibleDataClassShape {
  primaryFields: string[];
  extraFields: string[];
  legacyExtraFieldCounts?: number[];
}

const COMPATIBLE_DATA_CLASS_SHAPES: Record<string, CompatibleDataClassShape> = {
  PurchaseError: {
    primaryFields: ['code', 'debugMessage', 'isEmptyProductList', 'message', 'productId', 'productIds', 'productType', 'responseCode'],
    extraFields: ['subResponseCodeAndroid'],
  },
  UserChoiceBillingDetails: {
    primaryFields: ['externalTransactionToken', 'products'],
    extraFields: ['productDetailsAndroid', 'originalExternalTransactionId'],
  },
  RequestVerifyPurchaseWithIapkitResult: {
    primaryFields: ['isValid', 'state', 'store'],
    extraFields: ['clientPayload', 'productId', 'environment'],
    legacyExtraFieldCounts: [2],
  },
};

const COMPATIBLE_INPUT_DATA_CLASS_SHAPES: Record<string, CompatibleDataClassShape> = {
  RequestVerifyPurchaseWithIapkitAmazonProps: {
    primaryFields: ['receiptId', 'sandbox', 'userId'],
    extraFields: ['expectedProductId'],
  },
  RequestVerifyPurchaseWithIapkitProps: {
    primaryFields: ['amazon', 'apiKey', 'apple', 'baseUrl', 'google'],
    extraFields: ['includeClientPayload', 'horizon'],
    legacyExtraFieldCounts: [1],
  },
};

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
    return requireGraphQLScalarMapping(GRAPHQL_TO_KOTLIN, name, 'Kotlin');
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
    for (const line of generatedFileHeader()) this.emit(line);
    this.emit('');
    this.emit('// Generated JSON decoders use unchecked casts for nested wire values.');
    this.emit('@file:Suppress("UNCHECKED_CAST")');
    this.emit('');
  }

  // ============================================================================
  // Enums
  // ============================================================================

  generateEnum(irEnum: IREnum): void {
    this.generateDocComment(irEnum.description);
    this.generateDeprecationAnnotation(irEnum.description);
    this.emit(`public enum class ${irEnum.name}(val rawValue: String) {`);

    irEnum.values.forEach((value, index) => {
      this.generateDocComment(value.description, '    ');
      this.generateEnumValueDeprecationAnnotation(
        irEnum,
        value.description,
        '    ',
      );
      const caseName = this.escapeKeyword(this.enumValueCase(value.name));
      const suffix = index === irEnum.values.length - 1 ? '' : ',';
      this.emit(`    ${caseName}("${value.rawValue}")${suffix}`);
    });

    this.emit('');
    this.emit('    companion object {');
    this.emit(`        private fun fromKnownJson(value: String): ${irEnum.name}? = when (value) {`);

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

    this.emit('            else -> null');
    this.emit('        }');
    this.emit('');
    const unknownValue = this.enumUnknownValue(irEnum);
    const unknownExpression = unknownValue
      ? `${irEnum.name}.${this.escapeKeyword(this.enumValueCase(unknownValue.name))}`
      : `throw IllegalArgumentException("Unknown ${irEnum.name} value: $value")`;
    this.emit(`        fun fromJson(value: String): ${irEnum.name} = fromKnownJson(value) ?: ${unknownExpression}`);
    this.emit('');
    this.emit(`        fun fromJsonStrict(value: String): ${irEnum.name} =`);
    this.emit(`            fromKnownJson(value) ?: throw IllegalArgumentException("Unknown ${irEnum.name} input value: $value")`);
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
    this.generateDeprecationAnnotation(irInterface.description);
    this.emit(`public interface ${irInterface.name} {`);

    // Sort fields alphabetically for Kotlin
    const sortedFields = [...irInterface.fields].sort((a, b) => a.name.localeCompare(b.name));
    for (const field of sortedFields) {
      this.generateDocComment(field.description, '    ');
      this.generateDeprecationAnnotation(field.description, '    ');
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
      this.generateDocComment(irObject.description);
      this.generateDeprecationAnnotation(irObject.description);
      this.emit('public typealias VoidResult = Unit');
      this.emit('');
      return;
    }

    // Handle result union wrappers
    if (irObject.isResultUnion && irObject.resultUnionEntries) {
      this.generateResultUnionObject(irObject);
      return;
    }

    const compatibleShape = COMPATIBLE_DATA_CLASS_SHAPES[irObject.name];
    if (compatibleShape) {
      this.generateCompatibleDataClass(irObject, compatibleShape);
      return;
    }

    // Sort fields alphabetically for Kotlin
    const sortedFields = [...irObject.fields].sort((a, b) => a.name.localeCompare(b.name));

    // Handle empty objects
    if (sortedFields.length === 0) {
      this.generateDocComment(irObject.description);
      this.generateDeprecationAnnotation(irObject.description);
      this.emit(`public class ${irObject.name}`);
      this.emit('');
      return;
    }

    this.generateDocComment(irObject.description);
    this.generateDeprecationAnnotation(irObject.description);
    this.emit(`public data class ${irObject.name}(`);

    sortedFields.forEach((field, index) => {
      this.generateDocComment(field.description, '    ');
      this.generateDeprecationAnnotation(field.description, '    ');
      const propertyType = this.getPropertyType(field.type);
      const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
      const suffix = index === sortedFields.length - 1 ? '' : ',';
      const overrideKeyword = field.isOverride ? 'override ' : '';

      const defaultValue = this.getObjectFieldDefault(field);

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

    const rejectMissingStrictEnums = this.typeHasRequiredEnumWithoutUnknown(irObject.name, this.schema);

    for (const field of sortedFields) {
      const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
      const expression = this.buildFromJsonExpression(
        field.type,
        `json["${field.name}"]`,
        false,
        false,
        this.buildDefaultValueExpression(field),
        rejectMissingStrictEnums,
      );
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

  /** Preserve published data-class JVM descriptors for additive fields. */
  private generateCompatibleDataClass(irObject: IRObject, shape: CompatibleDataClassShape): void {
    const field = (name: string): IRField => {
      const value = irObject.fields.find((candidate) => candidate.name === name);
      if (!value) throw new Error(`${irObject.name} is missing ${name}`);
      return value;
    };
    const primaryFields = shape.primaryFields.map(field);
    const extraFields = shape.extraFields.map(field);
    if (primaryFields.length + extraFields.length !== irObject.fields.length) {
      throw new Error(`${irObject.name} compatibility shape is incomplete`);
    }
    if (extraFields.some((value) => !value.type.nullable)) {
      throw new Error(`${irObject.name} compatibility fields must be nullable`);
    }

    this.generateDocComment(irObject.description);
    this.generateDeprecationAnnotation(irObject.description);
    this.emit(`public data class ${irObject.name}(`);
    primaryFields.forEach((value, index) => {
      this.generateDocComment(value.description, '    ');
      this.generateDeprecationAnnotation(value.description, '    ');
      const suffix = index === primaryFields.length - 1 ? '' : ',';
      const defaultValue = this.getObjectFieldDefault(value);
      this.emit(`    val ${value.name}: ${this.getPropertyType(value.type)}${defaultValue}${suffix}`);
    });
    this.emit(') {');
    this.emit('');

    for (const value of extraFields) {
      this.generateDocComment(value.description, '    ');
      this.generateDeprecationAnnotation(value.description, '    ');
      this.emit(`    var ${value.name}: ${this.getPropertyType(value.type)} = null`);
      this.emit('        private set');
      this.emit('');
    }

    const constructorExtraFieldCounts = [
      ...new Set([...(shape.legacyExtraFieldCounts ?? []), extraFields.length]),
    ];
    for (const extraFieldCount of constructorExtraFieldCounts) {
      if (extraFieldCount < 1 || extraFieldCount > extraFields.length) {
        throw new Error(`${irObject.name} has an invalid compatibility constructor size`);
      }
      const constructorExtraFields = extraFields.slice(0, extraFieldCount);
      const isCurrentConstructor = extraFieldCount === extraFields.length;
      const hasLegacyConstructor = (shape.legacyExtraFieldCounts?.length ?? 0) > 0;
      this.emit('    constructor(');
      for (const value of primaryFields) {
        const defaultValue = this.getObjectFieldDefault(value);
        this.emit(`        ${value.name}: ${this.getPropertyType(value.type)}${defaultValue},`);
      }
      constructorExtraFields.forEach((value, index) => {
        const defaultValue = index === 0 || (isCurrentConstructor && hasLegacyConstructor) ? '' : ' = null';
        this.emit(`        ${value.name}: ${this.getPropertyType(value.type)}${defaultValue},`);
      });
      this.emit('    ) : this(');
      for (const value of primaryFields) {
        this.emit(`        ${value.name} = ${value.name},`);
      }
      this.emit('    ) {');
      for (const value of constructorExtraFields) {
        this.emit(`        this.${value.name} = ${value.name}`);
      }
      this.emit('    }');
      this.emit('');
    }

    this.emit('    companion object {');
    this.emit(`        fun fromJson(json: Map<String, Any?>): ${irObject.name} {`);
    this.emit(`            return ${irObject.name}(`);
    const rejectMissingStrictEnums = this.typeHasRequiredEnumWithoutUnknown(irObject.name, this.schema);
    for (const value of [...primaryFields, ...extraFields]) {
      const expression = this.buildFromJsonExpression(
        value.type,
        `json["${value.name}"]`,
        false,
        false,
        this.buildDefaultValueExpression(value),
        rejectMissingStrictEnums,
      );
      this.emit(`                ${value.name} = ${expression},`);
    }
    this.emit('            )');
    this.emit('        }');
    this.emit('    }');
    this.emit('');
    this.emit('    fun toJson(): Map<String, Any?> = mapOf(');
    this.emit(`        "__typename" to "${irObject.name}",`);
    for (const value of irObject.fields) {
      const expression = this.buildToJsonExpression(value.type, value.name);
      this.emit(`        "${value.name}" to ${expression},`);
    }
    this.emit('    )');
    this.emit('}');
    this.emit('');
  }

  private getObjectFieldDefault(field: IRField): string {
    const schemaDefault = this.buildDefaultValueExpression(field);
    if (schemaDefault) return ` = ${schemaDefault}`;
    return field.type.nullable ? ' = null' : '';
  }

  private generateResultUnionObject(irObject: IRObject): void {
    this.generateDocComment(irObject.description);
    this.generateDeprecationAnnotation(irObject.description);
    this.emit(`public sealed interface ${irObject.name}`);
    this.emit('');

    // Sort entries alphabetically
    const sortedEntries = [...irObject.resultUnionEntries!].sort((a, b) => a.fieldName.localeCompare(b.fieldName));
    for (const entry of sortedEntries) {
      this.generateDocComment(entry.description);
      this.generateDeprecationAnnotation(entry.description);
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

    const compatibleShape = COMPATIBLE_INPUT_DATA_CLASS_SHAPES[irInput.name];
    if (compatibleShape) {
      this.generateCompatibleInputDataClass(irInput, compatibleShape);
      return;
    }

    // Sort fields alphabetically for Kotlin
    const sortedFields = [...irInput.fields].sort((a, b) => a.name.localeCompare(b.name));
    const rejectMissingStrictEnums = this.typeHasRequiredEnumWithoutUnknown(irInput.name, this.schema);

    this.generateDocComment(irInput.description);
    this.generateDeprecationAnnotation(irInput.description);
    this.emit(`public data class ${irInput.name}(`);

    sortedFields.forEach((field, index) => {
      this.generateDocComment(field.description, '    ');
      this.generateDeprecationAnnotation(field.description, '    ');
      const propertyType = this.getPropertyType(field.type);
      const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
      const suffix = index === sortedFields.length - 1 ? '' : ',';
      const schemaDefault = this.buildDefaultValueExpression(field);
      const defaultValue = schemaDefault ? ` = ${schemaDefault}` : field.type.nullable ? ' = null' : '';
      this.emit(`    val ${propertyName}: ${propertyType}${defaultValue}${suffix}`);
    });

    this.emit(') {');
    this.emit('    companion object {');

    // Check if input has required fields
    const hasRequiredFields = sortedFields.some((f) => !f.type.nullable && !this.hasSchemaDefault(f));

    if (hasRequiredFields) {
      // Nullable fromJson pattern
      this.emit(`        fun fromJson(json: Map<String, Any?>): ${irInput.name}? {`);
      for (const field of sortedFields) {
        const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
        const expression = this.buildFromJsonExpression(
          field.type,
          `json["${field.name}"]`,
          false,
          true,
          this.buildDefaultValueExpression(field),
          rejectMissingStrictEnums,
          true,
        );
        this.emit(`            val ${propertyName} = ${expression}`);
      }

      // Null check for required fields (excluding enums which have fallbacks)
      const requiredFields = sortedFields.filter(
        (f) => !f.type.nullable && !this.hasSchemaDefault(f) && !['enum', 'input', 'list'].includes(f.type.kind),
      );
      if (requiredFields.length > 0) {
        const nullChecks = requiredFields.map((f) => `${this.escapeKeyword(this.fieldNameCase(f.name))} == null`).join(' || ');
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
        const expression = this.buildFromJsonExpression(
          field.type,
          `json["${field.name}"]`,
          false,
          false,
          this.buildDefaultValueExpression(field),
          rejectMissingStrictEnums,
          true,
        );
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

  /** Preserve published input data-class JVM descriptors for additive fields. */
  private generateCompatibleInputDataClass(irInput: IRInput, shape: CompatibleDataClassShape): void {
    const field = (name: string): IRField => {
      const value = irInput.fields.find((candidate) => candidate.name === name);
      if (!value) throw new Error(`${irInput.name} is missing ${name}`);
      return value;
    };
    const primaryFields = shape.primaryFields.map(field);
    const extraFields = shape.extraFields.map(field);
    if (primaryFields.length + extraFields.length !== irInput.fields.length) {
      throw new Error(`${irInput.name} compatibility shape is incomplete`);
    }
    if (extraFields.some((value) => !value.type.nullable)) {
      throw new Error(`${irInput.name} compatibility fields must be nullable`);
    }

    const defaultValue = (value: IRField): string => {
      const schemaDefault = this.buildDefaultValueExpression(value);
      if (schemaDefault) return ` = ${schemaDefault}`;
      return value.type.nullable ? ' = null' : '';
    };

    this.generateDocComment(irInput.description);
    this.generateDeprecationAnnotation(irInput.description);
    this.emit(`public data class ${irInput.name}(`);
    primaryFields.forEach((value, index) => {
      this.generateDocComment(value.description, '    ');
      this.generateDeprecationAnnotation(value.description, '    ');
      const suffix = index === primaryFields.length - 1 ? '' : ',';
      this.emit(`    val ${value.name}: ${this.getPropertyType(value.type)}${defaultValue(value)}${suffix}`);
    });
    this.emit(') {');
    this.emit('');

    for (const value of extraFields) {
      this.generateDocComment(value.description, '    ');
      this.generateDeprecationAnnotation(value.description, '    ');
      this.emit(`    var ${value.name}: ${this.getPropertyType(value.type)} = null`);
      this.emit('        private set');
      this.emit('');
    }

    const constructorExtraFieldCounts = [
      ...new Set([...(shape.legacyExtraFieldCounts ?? []), extraFields.length]),
    ];
    for (const extraFieldCount of constructorExtraFieldCounts) {
      if (extraFieldCount < 1 || extraFieldCount > extraFields.length) {
        throw new Error(`${irInput.name} has an invalid compatibility constructor size`);
      }
      const constructorExtraFields = extraFields.slice(0, extraFieldCount);
      const isCurrentConstructor = extraFieldCount === extraFields.length;
      const hasLegacyConstructor = (shape.legacyExtraFieldCounts?.length ?? 0) > 0;
      this.emit('    constructor(');
      for (const value of primaryFields) {
        this.emit(`        ${value.name}: ${this.getPropertyType(value.type)}${defaultValue(value)},`);
      }
      constructorExtraFields.forEach((value, index) => {
        const isNewestField = index === constructorExtraFields.length - 1;
        let extraDefault = index === 0 ? '' : ' = null';
        if (isCurrentConstructor && hasLegacyConstructor) {
          extraDefault = isNewestField ? '' : ' = null';
        }
        this.emit(`        ${value.name}: ${this.getPropertyType(value.type)}${extraDefault},`);
      });
      this.emit('    ) : this(');
      for (const value of primaryFields) {
        this.emit(`        ${value.name} = ${value.name},`);
      }
      this.emit('    ) {');
      for (const value of constructorExtraFields) {
        this.emit(`        this.${value.name} = ${value.name}`);
      }
      this.emit('    }');
      this.emit('');
    }

    const allFields = [...primaryFields, ...extraFields];
    const requiredFields = allFields.filter(
      (value) => !value.type.nullable && !this.hasSchemaDefault(value) && value.type.kind !== 'enum',
    );
    const hasRequiredFields = requiredFields.length > 0;

    this.emit('    companion object {');
    this.emit(`        fun fromJson(json: Map<String, Any?>): ${irInput.name}${hasRequiredFields ? '?' : ''} {`);
    if (hasRequiredFields) {
      for (const value of allFields) {
        const expression = this.buildFromJsonExpression(
          value.type,
          `json["${value.name}"]`,
          false,
          true,
          this.buildDefaultValueExpression(value),
          false,
          true,
        );
        this.emit(`            val ${value.name} = ${expression}`);
      }
      const nullChecks = requiredFields.map((value) => `${value.name} == null`).join(' || ');
      this.emit(`            if (${nullChecks}) return null`);
      this.emit(`            return ${irInput.name}(`);
      for (const value of allFields) {
        this.emit(`                ${value.name} = ${value.name},`);
      }
    } else {
      this.emit(`            return ${irInput.name}(`);
      for (const value of allFields) {
        const expression = this.buildFromJsonExpression(
          value.type,
          `json["${value.name}"]`,
          false,
          false,
          this.buildDefaultValueExpression(value),
          false,
          true,
        );
        this.emit(`                ${value.name} = ${expression},`);
      }
    }
    this.emit('            )');
    this.emit('        }');
    this.emit('    }');
    this.emit('');
    this.emit('    fun toJson(): Map<String, Any?> = mapOf(');
    for (const value of irInput.fields) {
      const expression = this.buildToJsonExpression(value.type, value.name);
      this.emit(`        "${value.name}" to ${expression},`);
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
        throw new Error(`${irInput.name} is marked as a custom input without a Kotlin generator strategy.`);
    }
  }

  private generateStandardInput(irInput: IRInput): void {
    const rejectMissingStrictEnums = this.typeHasRequiredEnumWithoutUnknown(irInput.name, this.schema);
    this.generateDocComment(irInput.description);
    this.generateDeprecationAnnotation(irInput.description);
    this.emit(`public data class ${irInput.name}(`);

    irInput.fields.forEach((field, index) => {
      this.generateDocComment(field.description, '    ');
      this.generateDeprecationAnnotation(field.description, '    ');
      const propertyType = this.getPropertyType(field.type);
      const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
      const suffix = index === irInput.fields.length - 1 ? '' : ',';
      const schemaDefault = this.buildDefaultValueExpression(field);
      const defaultValue = schemaDefault ? ` = ${schemaDefault}` : field.type.nullable ? ' = null' : '';
      this.emit(`    val ${propertyName}: ${propertyType}${defaultValue}${suffix}`);
    });

    this.emit(') {');
    this.emit('    companion object {');

    // Check if input has required fields
    const hasRequiredFields = irInput.fields.some((f) => !f.type.nullable && !this.hasSchemaDefault(f));

    if (hasRequiredFields) {
      // Nullable fromJson pattern
      this.emit(`        fun fromJson(json: Map<String, Any?>): ${irInput.name}? {`);
      for (const field of irInput.fields) {
        const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
        const expression = this.buildFromJsonExpression(
          field.type,
          `json["${field.name}"]`,
          false,
          true,
          this.buildDefaultValueExpression(field),
          rejectMissingStrictEnums,
          true,
        );
        this.emit(`            val ${propertyName} = ${expression}`);
      }

      // Null check for required fields (excluding enums which have fallbacks)
      const requiredFields = irInput.fields.filter((f) => !f.type.nullable && !this.hasSchemaDefault(f) && f.type.kind !== 'enum');
      if (requiredFields.length > 0) {
        const nullChecks = requiredFields.map((f) => `${this.escapeKeyword(this.fieldNameCase(f.name))} == null`).join(' || ');
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
        const expression = this.buildFromJsonExpression(
          field.type,
          `json["${field.name}"]`,
          false,
          false,
          this.buildDefaultValueExpression(field),
          rejectMissingStrictEnums,
          true,
        );
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
    const [requestPurchase, requestSubscription, type] = this.requireCustomInputFields(irInput);
    this.generateDocComment(irInput.description);
    this.generateDeprecationAnnotation(irInput.description);
    this.emit('public data class RequestPurchaseProps(');
    this.emit('    val request: Request,');
    this.generateDocComment(type.description, '    ');
    this.emit('    val type: ProductQueryType');
    this.emit(') {');
    this.emit('    init {');
    this.emit('        when (request) {');
    this.emit(
      '            is Request.Purchase -> require(type == ProductQueryType.InApp) { "type must be IN_APP when request is purchase" }',
    );
    this.emit(
      '            is Request.Subscription -> require(type == ProductQueryType.Subs) { "type must be SUBS when request is subscription" }',
    );
    this.emit('        }');
    this.emit('    }');
    this.emit('');
    this.emit('    companion object {');
    this.emit('        fun fromJson(json: Map<String, Any?>): RequestPurchaseProps {');
    this.emit('            val rawType = (json["type"] as String?)?.let { ProductQueryType.fromJson(it) }');
    this.emit('            val purchaseJson = json["requestPurchase"] as Map<String, Any?>?');
    this.emit('            val subscriptionJson = json["requestSubscription"] as Map<String, Any?>?');
    this.emit('            require((purchaseJson == null) != (subscriptionJson == null)) {');
    this.emit('                "RequestPurchaseProps requires exactly one of requestPurchase or requestSubscription"');
    this.emit('            }');
    this.emit('            if (purchaseJson != null) {');
    this.emit('                val request = Request.Purchase(RequestPurchasePropsByPlatforms.fromJson(purchaseJson))');
    this.emit('                val finalType = rawType ?: ProductQueryType.InApp');
    this.emit('                require(finalType == ProductQueryType.InApp) { "type must be IN_APP when requestPurchase is provided" }');
    this.emit(
      '                return RequestPurchaseProps(request = request, type = finalType)',
    );
    this.emit('            }');
    this.emit('            if (subscriptionJson != null) {');
    this.emit('                val request = Request.Subscription(RequestSubscriptionPropsByPlatforms.fromJson(subscriptionJson))');
    this.emit('                val finalType = rawType ?: ProductQueryType.Subs');
    this.emit('                require(finalType == ProductQueryType.Subs) { "type must be SUBS when requestSubscription is provided" }');
    this.emit(
      '                return RequestPurchaseProps(request = request, type = finalType)',
    );
    this.emit('            }');
    this.emit('            error("RequestPurchaseProps branch validation failed")');
    this.emit('        }');
    this.emit('    }');
    this.emit('');
    this.emit('    fun toJson(): Map<String, Any?> = when (request) {');
    this.emit('        is Request.Purchase -> mapOf(');
    this.emit('            "requestPurchase" to request.value.toJson(),');
    this.emit('            "type" to type.toJson(),');
    this.emit('        )');
    this.emit('        is Request.Subscription -> mapOf(');
    this.emit('            "requestSubscription" to request.value.toJson(),');
    this.emit('            "type" to type.toJson(),');
    this.emit('        )');
    this.emit('    }');
    this.emit('');
    this.emit('    sealed class Request {');
    this.generateDocComment(requestPurchase.description, '        ');
    this.emit('        data class Purchase(val value: RequestPurchasePropsByPlatforms) : Request()');
    this.generateDocComment(requestSubscription.description, '        ');
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
    this.generateDeprecationAnnotation(irUnion.description);

    const implementations = irUnion.sharedInterfaces.length > 0 ? ` : ${irUnion.sharedInterfaces.join(', ')}` : '';
    this.emit(`public sealed interface ${irUnion.name}${implementations} {`);
    this.emit('    fun toJson(): Map<String, Any?>');
    this.emit('');
    this.emit('    companion object {');
    this.emit(`        fun fromJson(json: Map<String, Any?>): ${irUnion.name} {`);
    this.emit('            return when (json["__typename"] as String?) {');

    // Collect all concrete members and their delegate targets
    const nestedUnions = new Set<string>();
    const concreteMembers: Array<{
      name: string;
      delegateTo: string;
      isNested: boolean;
    }> = [];

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
    this.generateDeprecationAnnotation(irOperation.description);
    this.emit(`public interface ${interfaceName} {`);

    // Sort fields alphabetically and filter _placeholder
    const sortedFields = irOperation.fields.filter((f) => f.name !== '_placeholder').sort((a, b) => a.name.localeCompare(b.name));

    for (const field of sortedFields) {
      this.generateDocComment(this.operationFieldDescription(field), '    ');
      // Operation replacements may require new arguments, so prose alone
      // cannot safely produce a Kotlin ReplaceWith code fragment.
      this.generateDeprecationAnnotation(
        this.operationFieldDescription(field),
        '    ',
        false,
      );
      const returnType = this.getOperationReturnType(field);

      const args = field.args.map((arg) => {
        const argType = this.getPropertyType(arg.type);
        const argName = this.escapeKeyword(arg.name);
        const defaultValue = arg.type.nullable ? ' = null' : '';
        // Kotlin's Deprecated annotation cannot target value parameters.
        // operationFieldDescription keeps the canonical argument reason in
        // resolver KDoc without generating an invalid annotation.
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
    const sortedFields = irOperation.fields.filter((f) => f.name !== '_placeholder').sort((a, b) => a.name.localeCompare(b.name));

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
      this.generateDocComment(this.operationFieldDescription(field), '    ');
      this.generateDeprecationAnnotation(
        this.operationFieldDescription(field),
        '    ',
        false,
      );
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
    forNullableFromJson: boolean = false,
    defaultExpression?: string | null,
    rejectMissingStrictEnums: boolean = false,
    isInputContext: boolean = false,
  ): string {
    if (type.kind === 'list') {
      const element = this.buildFromJsonExpression(
        type.elementType!,
        'it',
        true,
        forNullableFromJson,
        undefined,
        rejectMissingStrictEnums,
        isInputContext,
      );
      const mapFn = isInputContext || type.elementType!.nullable ? 'map' : 'mapNotNull';
      const decodedList = `(${sourceExpr} as? List<*>)?.${mapFn} { ${element} }`;
      if (isInputContext) {
        const invalidInput = 'throw IllegalArgumentException("Invalid input list")';
        if (defaultExpression) {
          return `if (${sourceExpr} == null) ${defaultExpression} else ${decodedList} ?: ${invalidInput}`;
        }
        if (type.nullable) {
          return `${sourceExpr}?.let { raw -> (raw as? List<*>)?.${mapFn} { ${element} } ?: ${invalidInput} }`;
        }
        return `${decodedList} ?: ${invalidInput}`;
      }
      if (defaultExpression) {
        return `${decodedList} ?: ${defaultExpression}`;
      }
      if (type.nullable || forNullableFromJson) {
        return decodedList;
      }
      return `${decodedList} ?: emptyList()`;
    }

    if (type.kind === 'scalar') {
      const useNullable = type.nullable || isListElement || forNullableFromJson;
      const strictInputScalar = (cast: string): string => {
        const location = isListElement ? 'input list element' : 'input value';
        const invalidInput = `throw IllegalArgumentException("Invalid ${type.name} ${location}")`;
        if (isListElement && !type.nullable) return `${cast} ?: ${invalidInput}`;
        if (defaultExpression) {
          return `if (${sourceExpr} == null) ${defaultExpression} else (${cast}) ?: ${invalidInput}`;
        }
        if (type.nullable) {
          return `${sourceExpr}?.let { raw -> (${cast.replace(sourceExpr, 'raw')}) ?: ${invalidInput} }`;
        }
        return cast;
      };
      switch (type.name) {
        case 'Float':
          if (isInputContext) {
            return strictInputScalar(`(${sourceExpr} as? Number)?.toDouble()`);
          }
          if (defaultExpression) {
            return `(${sourceExpr} as? Number)?.toDouble() ?: ${defaultExpression}`;
          }
          return useNullable ? `(${sourceExpr} as? Number)?.toDouble()` : `(${sourceExpr} as? Number)?.toDouble() ?: 0.0`;
        case 'Int':
          if (isInputContext) {
            return strictInputScalar(
              `(${sourceExpr} as? Number)?.let { number -> number.toLong().takeIf { value -> value >= Int.MIN_VALUE.toLong() && value <= Int.MAX_VALUE.toLong() && value.toDouble() == number.toDouble() }?.toInt() }`,
            );
          }
          if (defaultExpression) {
            return `(${sourceExpr} as? Number)?.toInt() ?: ${defaultExpression}`;
          }
          return useNullable ? `(${sourceExpr} as? Number)?.toInt()` : `(${sourceExpr} as? Number)?.toInt() ?: 0`;
        case 'Boolean':
          if (isInputContext) {
            return strictInputScalar(`${sourceExpr} as? Boolean`);
          }
          if (defaultExpression) {
            return `${sourceExpr} as? Boolean ?: ${defaultExpression}`;
          }
          return useNullable ? `${sourceExpr} as? Boolean` : `${sourceExpr} as? Boolean ?: false`;
        case 'ID':
        case 'String':
        default:
          if (isInputContext) {
            return strictInputScalar(`${sourceExpr} as? String`);
          }
          if (defaultExpression) {
            return `${sourceExpr} as? String ?: ${defaultExpression}`;
          }
          return useNullable ? `${sourceExpr} as? String` : `${sourceExpr} as? String ?: ""`;
      }
    }

    if (type.kind === 'enum') {
      const unknownFallback = this.buildUnknownEnumFallbackExpression(type);
      const enumDecoder = isInputContext ? 'fromJsonStrict' : 'fromJson';
      const enumRead = `(${sourceExpr} as? String)?.let { ${type.name}.${enumDecoder}(it) }`;
      if (isInputContext) {
        const invalidInput = `throw IllegalArgumentException("Missing or invalid enum input value for ${type.name}")`;
        if (defaultExpression) {
          return `if (${sourceExpr} == null) ${defaultExpression} else ${enumRead} ?: ${invalidInput}`;
        }
        if (type.nullable) {
          return `${sourceExpr}?.let { raw -> (raw as? String)?.let { ${type.name}.fromJsonStrict(it) } ?: ${invalidInput} }`;
        }
        return `${enumRead} ?: ${invalidInput}`;
      }
      if (defaultExpression) {
        return `${enumRead} ?: ${defaultExpression}`;
      }
      if (unknownFallback) {
        if (type.nullable) {
          return enumRead;
        }
        return `${enumRead} ?: ${unknownFallback}`;
      }
      if (type.nullable) {
        return enumRead;
      }
      // Find if enum has Empty value
      const irEnum = this.schema.enums.find((e) => e.name === type.name);
      const hasEmpty = irEnum?.values.some((v) => v.name.toLowerCase() === 'empty');
      if (hasEmpty) {
        return `(${sourceExpr} as? String)?.let { ${type.name}.fromJson(it) } ?: ${type.name}.Empty`;
      }
      const firstValue = irEnum?.values[0];
      const fallback =
        rejectMissingStrictEnums || !firstValue
          ? `throw IllegalArgumentException("Missing required enum value for ${type.name}")`
          : `${type.name}.${this.escapeKeyword(this.enumValueCase(firstValue.name))}`;
      return `(${sourceExpr} as? String)?.let { ${type.name}.fromJson(it) } ?: ${fallback}`;
    }

    if (['object', 'input', 'interface', 'union'].includes(type.kind)) {
      const callTarget = type.name!;
      if (isInputContext && type.kind === 'input') {
        const invalidInput = `throw IllegalArgumentException("Invalid input object for ${callTarget}")`;
        if (type.nullable) {
          return `${sourceExpr}?.let { value -> (value as? Map<String, Any?>)?.let { ${callTarget}.fromJson(it) } ?: ${invalidInput} }`;
        }
        return `(${sourceExpr} as? Map<String, Any?>)?.let { ${callTarget}.fromJson(it) } ?: ${invalidInput}`;
      }
      if (type.nullable || forNullableFromJson) {
        if (this.typeNeedsTolerantNullableDecoder(callTarget, this.schema)) {
          return `(${sourceExpr} as? Map<String, Any?>)?.let { runCatching { ${callTarget}.fromJson(it) }.getOrNull() }`;
        }
        return `(${sourceExpr} as? Map<String, Any?>)?.let { ${callTarget}.fromJson(it) }`;
      }
      // Check if input has required fields (nullable fromJson)
      const isInputWithRequired = this.schema.inputs.find(({ name }) => name === callTarget)?.hasRequiredFields ?? false;
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
      return type.nullable ? `${accessorExpr}?.map { ${inner} }` : `${accessorExpr}.map { ${inner} }`;
    }

    if (type.kind === 'enum') {
      return type.nullable ? `${accessorExpr}?.toJson()` : `${accessorExpr}.toJson()`;
    }

    if (['object', 'input', 'interface', 'union'].includes(type.kind)) {
      return type.nullable ? `${accessorExpr}?.toJson()` : `${accessorExpr}.toJson()`;
    }

    return accessorExpr;
  }

  private hasSchemaDefault(field: IRField): boolean {
    return field.defaultValue !== undefined;
  }

  private buildDefaultValueExpression(field: IRField): string | null {
    if (!this.hasSchemaDefault(field)) return null;
    return this.buildDefaultValueForType(field.type, field.defaultValue);
  }

  private buildDefaultValueForType(type: IRType, defaultValue: unknown): string | null {
    if (type.kind === 'list') {
      if (!Array.isArray(defaultValue)) return null;
      const items = defaultValue
        .map((value) => this.buildDefaultValueForType(type.elementType!, value))
        .filter((value): value is string => value !== null);
      return `listOf(${items.join(', ')})`;
    }
    if (type.kind === 'enum' && typeof defaultValue === 'string') {
      return `${type.name}.${this.escapeKeyword(this.enumValueCase(defaultValue))}`;
    }
    if (type.kind === 'scalar') {
      if (typeof defaultValue === 'string') return `"${defaultValue}"`;
      if (typeof defaultValue === 'boolean') return String(defaultValue);
      if (typeof defaultValue === 'number') {
        if (type.name === 'Float' && Number.isInteger(defaultValue)) {
          return `${defaultValue}.0`;
        }
        return String(defaultValue);
      }
    }
    return null;
  }

  private buildUnknownEnumFallbackExpression(type: IRType): string | null {
    if (type.kind !== 'enum' || !type.name) return null;
    const irEnum = this.schema.enums.find((e) => e.name === type.name);
    const unknownValue = irEnum ? this.enumUnknownValue(irEnum) : null;
    return unknownValue ? `${type.name}.${this.escapeKeyword(this.enumValueCase(unknownValue.name))}` : null;
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
      this.emit(line.length === 0 ? `${indent} *` : `${indent} * ${line}`);
    }
    this.emit(`${indent} */`);
  }

  private deprecationReason(description: string | undefined): string | null {
    if (!description) return null;
    const match = description.match(/(?:^|\n)@deprecated\s+([^\n]+)/);
    return match?.[1]?.trim() || null;
  }

  private deprecationAnnotation(
    description: string | undefined,
    includeReplaceWith: boolean = true,
    verifiedReplacement?: string,
  ): string | null {
    const reason = this.deprecationReason(description);
    if (!reason) return null;

    const escapedReason = reason
      .replaceAll('\\', '\\\\')
      .replaceAll('"', '\\"')
      .replaceAll('$', '\\$')
      .replaceAll('\r', '\\r')
      .replaceAll('\n', '\\n')
      .replaceAll('\t', '\\t');
    const simpleReplacement =
      verifiedReplacement ??
      (includeReplaceWith
        ? reason.match(
            /^Use\s+([A-Za-z_][A-Za-z0-9_.]*)\s+instead\./,
          )?.[1]
        : undefined);
    if (simpleReplacement) {
      return `@Deprecated("${escapedReason}", ReplaceWith("${simpleReplacement}"))`;
    }
    return `@Deprecated("${escapedReason}")`;
  }

  private generateDeprecationAnnotation(
    description: string | undefined,
    indent: string = '',
    includeReplaceWith: boolean = true,
  ): void {
    const annotation = this.deprecationAnnotation(
      description,
      includeReplaceWith,
    );
    if (annotation) this.emit(`${indent}${annotation}`);
  }

  private generateEnumValueDeprecationAnnotation(
    irEnum: IREnum,
    description: string | undefined,
    indent: string,
  ): void {
    const reason = this.deprecationReason(description);
    if (!reason) return;

    const namedTarget = reason.match(
      /^Use\s+([A-Za-z_][A-Za-z0-9_]*)\s+instead\./,
    )?.[1];
    const replacement = namedTarget
      ? irEnum.values.find((value) => value.name === namedTarget)
      : undefined;
    const annotation = this.deprecationAnnotation(
      description,
      false,
      replacement ? this.enumValueCase(replacement.name) : undefined,
    );
    if (annotation) this.emit(`${indent}${annotation}`);
  }
}
