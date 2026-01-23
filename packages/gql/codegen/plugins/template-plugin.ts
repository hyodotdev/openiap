/**
 * Template-based Plugin for Code Generation
 *
 * Base class that uses Handlebars templates for common structures
 * while allowing language-specific customization through hooks.
 */

import Handlebars from 'handlebars';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// Template Context Types
// ============================================================================

export interface EnumValueContext {
  name: string;
  caseName: string;
  rawValue: string;
  camelCaseName: string;
  description?: string;
  legacyValues: string[];
  isLast: boolean;
}

export interface FieldContext {
  name: string;
  graphqlName: string;
  propertyName: string;
  paramName: string;
  type: string;
  declarationType: string;
  description?: string;
  nullable: boolean;
  isOverride: boolean;
  defaultValue: string;
  annotation: string;
  fromJsonExpr: string;
  toJsonExpr: string;
  isLast: boolean;
}

export interface OperationFieldContext {
  name: string;
  escapedName: string;
  propertyName: string;
  paramName: string;
  description?: string;
  returnType: string;
  args: ArgContext[];
  hasArgs: boolean;
  hasSingleArg: boolean;
  hasMultipleArgs: boolean;
  aliasName: string;
  argsSignature: string;
  paramsSignature: string;
  isLast: boolean;
}

export interface ArgContext {
  name: string;
  escapedName: string;
  type: string;
  defaultValue: string;
  isLast: boolean;
}

export interface ConcreteMemberContext {
  typeName: string;
  delegateTo: string;
  isNested: boolean;
  wrapperName: string;
}

export interface NestedUnionWrapperContext {
  wrapperName: string;
  unionName: string;
  parentUnionName: string;
  interfaceFields: FieldContext[];
}

export interface ResultUnionEntryContext {
  fieldName: string;
  caseName: string;
  className: string;
  type: string;
  isLast: boolean;
}

// ============================================================================
// Template Plugin Base Class
// ============================================================================

export abstract class TemplatePlugin extends CodegenPlugin {
  protected handlebars: typeof Handlebars;
  protected templates: Map<string, Handlebars.TemplateDelegate> = new Map();
  protected schema!: IRSchema;

  constructor(config: CodegenPluginConfig) {
    super(config);
    this.handlebars = Handlebars.create();
    this.registerHelpers();
    this.loadTemplates();
  }

  // ============================================================================
  // Abstract Methods for Language-Specific Logic
  // ============================================================================

  /** Template directory name (e.g., 'swift', 'kotlin') */
  protected abstract get templateDir(): string;

  /** Get property type string with nullability */
  abstract getPropertyType(type: IRType): string;

  /** Build fromJson expression for a field */
  abstract buildFromJsonExpression(type: IRType, sourceExpr: string): string;

  /** Build toJson expression for a field */
  abstract buildToJsonExpression(type: IRType, accessorExpr: string): string;

  /** Get default value for a field (including platform defaults) */
  abstract getFieldDefaultValue(field: IRField, objectName: string): string;

  /** Get field annotation (e.g., @override) */
  abstract getFieldAnnotation(field: IRField): string;

  /** Get declaration type (for Dart final vs var) */
  abstract getDeclarationType(type: IRType): string;

  /** Get constructor params signature */
  abstract getConstructorParams(fields: FieldContext[]): string;

  /** Get init params signature (for GDScript) */
  abstract getInitParams(fields: FieldContext[]): string;

  /** Get implements/extends clause */
  abstract getImplementsClause(interfaces: string[], unions: string[]): string;

  /** Check if fields should be sorted */
  abstract get sortFields(): boolean;

  /** Section comment style */
  abstract getSectionComment(title: string): string;

  // ============================================================================
  // Template Loading
  // ============================================================================

  protected loadTemplates(): void {
    const templatePath = join(__dirname, '..', 'templates', this.templateDir);
    const templateFiles = [
      'header',
      'enum',
      'interface',
      'object',
      'result-union',
      'input',
      'union',
      'operation-protocol',
      'operation-helpers',
      'operation',
    ];

    for (const name of templateFiles) {
      try {
        const content = readFileSync(join(templatePath, `${name}.hbs`), 'utf-8');
        this.templates.set(name, this.handlebars.compile(content));
      } catch {
        // Template not found - plugin will use code generation instead
      }
    }
  }

  protected registerHelpers(): void {
    this.handlebars.registerHelper('if_eq', function (this: unknown, a: unknown, b: unknown, options: Handlebars.HelperOptions) {
      return a === b ? options.fn(this) : options.inverse(this);
    });

    this.handlebars.registerHelper('unless_last', function (this: unknown, index: number, array: unknown[], options: Handlebars.HelperOptions) {
      return index !== array.length - 1 ? options.fn(this) : options.inverse(this);
    });

    this.handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);
  }

  // ============================================================================
  // Context Builders
  // ============================================================================

  protected buildEnumValueContext(value: IREnumValue, index: number, total: number): EnumValueContext {
    return {
      name: value.name,
      caseName: this.escapeKeyword(this.enumValueCase(value.name)),
      rawValue: value.rawValue,
      camelCaseName: value.name.charAt(0).toUpperCase() + value.name.slice(1),
      description: value.description,
      legacyValues: value.legacyAliases,
      isLast: index === total - 1,
    };
  }

  protected buildFieldContext(field: IRField, objectName: string, index: number, total: number): FieldContext {
    const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
    return {
      name: field.name,
      graphqlName: field.name,
      propertyName,
      paramName: `p_${this.fieldNameCase(field.name)}`,
      type: this.getPropertyType(field.type),
      declarationType: this.getDeclarationType(field.type),
      description: field.description,
      nullable: field.type.nullable,
      isOverride: field.isOverride,
      defaultValue: this.getFieldDefaultValue(field, objectName),
      annotation: this.getFieldAnnotation(field),
      fromJsonExpr: this.buildFromJsonExpression(field.type, `json["${field.name}"]`),
      toJsonExpr: this.buildToJsonExpression(field.type, propertyName),
      isLast: index === total - 1,
    };
  }

  protected buildFieldsContext(fields: IRField[], objectName: string): FieldContext[] {
    const sortedFields = this.sortFields
      ? [...fields].sort((a, b) => a.name.localeCompare(b.name))
      : fields;
    return sortedFields.map((field, index) =>
      this.buildFieldContext(field, objectName, index, sortedFields.length)
    );
  }

  protected buildOperationFieldContext(
    field: IROperationField,
    operationName: string,
    index: number,
    total: number
  ): OperationFieldContext {
    const escapedName = this.escapeKeyword(field.name);
    const args = field.args.map((arg, i) => ({
      name: arg.name,
      escapedName: this.escapeKeyword(arg.name),
      type: this.getPropertyType(arg.type),
      defaultValue: arg.type.nullable ? this.getNullDefault() : '',
      isLast: i === field.args.length - 1,
    }));

    return {
      name: field.name,
      escapedName,
      propertyName: this.escapeKeyword(this.fieldNameCase(field.name)),
      paramName: `p_${this.fieldNameCase(field.name)}`,
      description: field.description,
      returnType: this.getOperationReturnType(field),
      args,
      hasArgs: args.length > 0,
      hasSingleArg: args.length === 1,
      hasMultipleArgs: args.length > 1,
      aliasName: `${operationName}${this.capitalize(field.name)}Handler`,
      argsSignature: this.buildArgsSignature(args),
      paramsSignature: this.buildParamsSignature(args),
      isLast: index === total - 1,
    };
  }

  protected abstract getNullDefault(): string;
  protected abstract getOperationReturnType(field: IROperationField): string;
  protected abstract buildArgsSignature(args: ArgContext[]): string;
  protected abstract buildParamsSignature(args: ArgContext[]): string;

  protected capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  // ============================================================================
  // Rendering
  // ============================================================================

  protected render(templateName: string, context: Record<string, unknown>): string {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }
    return template(context);
  }

  protected hasTemplate(name: string): boolean {
    return this.templates.has(name);
  }
}

// Re-export IREnumValue for context builders
import type { IREnumValue } from '../core/types.js';
