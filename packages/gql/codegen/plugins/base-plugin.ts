/**
 * Base Plugin for Code Generation
 *
 * Abstract base class that defines the interface for all language-specific plugins.
 * Each plugin must implement the abstract methods to generate code for their target language.
 */

import type {
  IRSchema,
  IREnum,
  IRInterface,
  IRObject,
  IRInput,
  IRUnion,
  IROperation,
  IROperationField,
  IRType,
  IRField,
} from '../core/types.js';
import { CUSTOM_INPUT_CONTRACTS } from '../../custom-input-contracts.js';

// ============================================================================
// Plugin Interface
// ============================================================================

export interface CodegenPluginConfig {
  /** Output file path (relative to package root) */
  outputPath: string;
  /** Package name for languages that require it (e.g., Kotlin) */
  packageName?: string;
}

export abstract class CodegenPlugin {
  /** Plugin name (e.g., 'swift', 'kotlin') */
  abstract readonly name: string;

  /** File extension (e.g., '.swift', '.kt') */
  abstract readonly fileExtension: string;

  /** Plugin configuration */
  protected config: CodegenPluginConfig;

  /** Output lines buffer */
  protected lines: string[] = [];

  constructor(config: CodegenPluginConfig) {
    this.config = config;
  }

  // ============================================================================
  // Abstract Methods - Must be implemented by each plugin
  // ============================================================================

  /** Map GraphQL scalar to language type */
  abstract mapScalar(name: string): string;

  /** Map IR type to language type string */
  abstract mapType(type: IRType): string;

  /** Set of language keywords that need escaping */
  abstract readonly keywords: Set<string>;

  /** Escape a name if it conflicts with language keywords */
  abstract escapeKeyword(name: string): string;

  /** Convert enum value name to language convention */
  abstract enumValueCase(name: string): string;

  /** Convert field name to language convention */
  abstract fieldNameCase(name: string): string;

  /** Generate file header (imports, package declaration, etc.) */
  abstract generateHeader(): void;

  /** Generate enum type */
  abstract generateEnum(irEnum: IREnum): void;

  /** Generate interface/protocol type */
  abstract generateInterface(irInterface: IRInterface): void;

  /** Generate object/struct/data class type */
  abstract generateObject(irObject: IRObject): void;

  /** Generate input type */
  abstract generateInput(irInput: IRInput): void;

  /** Generate union type */
  abstract generateUnion(irUnion: IRUnion): void;

  /** Generate operation resolver interface and helpers */
  abstract generateOperation(irOperation: IROperation): void;

  /** Post-process the generated output (optional) */
  postProcess(output: string): string {
    return output;
  }

  // ============================================================================
  // Common Methods
  // ============================================================================

  /**
   * Generate code for the entire schema
   */
  generate(schema: IRSchema): string {
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

    // Operations
    if (schema.operations.length > 0) {
      this.addSectionComment('Root Operations');
      for (const irOperation of schema.operations) {
        this.generateOperation(irOperation);
      }
    }

    const output = this.lines.join('\n');
    return this.postProcess(output);
  }

  /**
   * Add a line to the output
   */
  protected emit(line: string = ''): void {
    this.lines.push(line);
  }

  /**
   * Add a section comment
   */
  protected addSectionComment(title: string): void {
    this.emit(`// MARK: - ${title}`);
    this.emit('');
  }

  /**
   * Get the output file path
   */
  getOutputPath(): string {
    return this.config.outputPath;
  }

  // ============================================================================
  // Helper Methods for Subclasses
  // ============================================================================

  /**
   * Generate documentation comment
   */
  protected generateDocComment(description: string | undefined, indent: string = ''): void {
    // Override in subclasses for language-specific doc comments
    if (!description) return;
    for (const line of description.split(/\r?\n/)) {
      this.emit(`${indent}// ${line}`);
    }
  }

  /**
   * Keep operation argument docs attached to the resolver declaration. Most
   * target languages inline GraphQL arguments as method parameters instead of
   * generating a separate Args type, so dropping these descriptions would
   * also drop directive-owned deprecation guidance.
   */
  protected operationFieldDescription(field: IROperationField): string | undefined {
    const argumentDescriptions = field.args
      .filter((arg) => arg.description)
      .map((arg) => `Parameter ${arg.name}: ${arg.description!.replace(/\s+/g, ' ').trim()}`);
    return [field.description, ...argumentDescriptions].filter((value): value is string => Boolean(value)).join('\n') || undefined;
  }

  /**
   * Resolve a schema field used by a custom generator path. Custom shapes must
   * fail closed instead of silently dropping metadata when the schema drifts.
   */
  protected requireField(container: { name: string; fields: IRField[] }, fieldName: string): IRField {
    const field = container.fields.find((candidate) => candidate.name === fieldName);
    if (!field) {
      throw new Error(`${container.name}.${fieldName} is required by the custom generator.`);
    }
    return field;
  }

  /**
   * Resolve an entire custom shape and reject additive schema drift. A custom
   * generator that silently omits a new field creates a phantom cross-language
   * contract, so every custom shape must opt into its exact supported fields.
   */
  protected requireExactFields(container: { name: string; fields: IRField[] }, fieldNames: readonly string[]): IRField[] {
    const fields = fieldNames.map((fieldName) => this.requireField(container, fieldName));
    const expected = new Set(fieldNames);
    const unexpected = container.fields.map((field) => field.name).filter((fieldName) => !expected.has(fieldName));
    if (unexpected.length > 0 || container.fields.length !== fields.length) {
      throw new Error(
        `${container.name} custom generator fields drifted; expected ${fieldNames.join(', ')}, found ${container.fields.map((field) => field.name).join(', ')}.`,
      );
    }
    return fields;
  }

  protected enumUnknownValue(irEnum: IREnum): IREnum['values'][number] | null {
    return irEnum.values.find((value) => value.name.toLowerCase().startsWith('unknown')) ?? null;
  }

  protected typeHasRequiredEnumWithoutUnknown(typeName: string, schema: IRSchema): boolean {
    const container = [...schema.objects, ...schema.inputs].find((candidate) => candidate.name === typeName);
    return (
      container?.fields.some((field) => {
        if (field.type.kind !== 'enum' || field.type.nullable || !field.type.name) return false;
        const irEnum = schema.enums.find((candidate) => candidate.name === field.type.name);
        return irEnum !== undefined && this.enumUnknownValue(irEnum) === null;
      }) ?? false
    );
  }

  protected typeNeedsTolerantNullableDecoder(typeName: string, schema: IRSchema): boolean {
    if (!this.typeHasRequiredEnumWithoutUnknown(typeName, schema)) return false;
    return [...schema.objects, ...schema.inputs].some((container) =>
      container.fields.some(
        (field) => field.type.nullable && ['object', 'input'].includes(field.type.kind) && field.type.name === typeName,
      ),
    );
  }

  /**
   * Resolve a custom input in canonical contract order. Language plugins own
   * rendering only; the field set and order live in CUSTOM_INPUT_CONTRACTS.
   */
  protected requireCustomInputFields(irInput: IRInput): IRField[] {
    const customTypeKind = irInput.customTypeKind;
    if (!customTypeKind || irInput.name !== customTypeKind) {
      throw new Error(`${irInput.name} custom generator requires a matching customTypeKind discriminator.`);
    }
    const contract = CUSTOM_INPUT_CONTRACTS[customTypeKind];
    return this.requireExactFields(
      irInput,
      contract.map((field) => field.name),
    );
  }
}
