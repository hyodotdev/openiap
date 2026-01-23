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
  IRType,
  IRField,
} from '../core/types.js';

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
   * Add multiple lines to the output
   */
  protected emitLines(lines: string[]): void {
    for (const line of lines) {
      this.emit(line);
    }
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
  protected generateDocComment(
    description: string | undefined,
    indent: string = ''
  ): void {
    // Override in subclasses for language-specific doc comments
    if (!description) return;
    for (const line of description.split(/\r?\n/)) {
      this.emit(`${indent}// ${line}`);
    }
  }

  /**
   * Check if a type is nullable
   */
  protected isNullable(type: IRType): boolean {
    return type.nullable;
  }

  /**
   * Get the element type for a list type
   */
  protected getListElementType(type: IRType): IRType | undefined {
    return type.kind === 'list' ? type.elementType : undefined;
  }

  /**
   * Check if type is a scalar
   */
  protected isScalar(type: IRType): boolean {
    return type.kind === 'scalar';
  }

  /**
   * Check if type is an enum
   */
  protected isEnum(type: IRType): boolean {
    return type.kind === 'enum';
  }

  /**
   * Check if type is a list
   */
  protected isList(type: IRType): boolean {
    return type.kind === 'list';
  }

  /**
   * Get the base type name for a named type
   */
  protected getTypeName(type: IRType): string | undefined {
    return type.name;
  }
}
