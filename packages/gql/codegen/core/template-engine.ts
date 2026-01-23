/**
 * Template Engine for Code Generation
 *
 * Provides Handlebars-based template rendering with language-specific helpers.
 */

import Handlebars from 'handlebars';
import type { IRType, IRField, IREnum, IREnumValue, IROperationField } from './types.js';

// ============================================================================
// Template Context Types
// ============================================================================

export interface EnumContext {
  name: string;
  description?: string;
  values: EnumValueContext[];
  isErrorCode: boolean;
}

export interface EnumValueContext {
  name: string;
  caseName: string;
  rawValue: string;
  description?: string;
  legacyAliases: string[];
  isLast: boolean;
}

export interface FieldContext {
  name: string;
  propertyName: string;
  type: string;
  description?: string;
  nullable: boolean;
  isOverride: boolean;
  defaultValue: string;
  isLast: boolean;
}

export interface InterfaceContext {
  name: string;
  description?: string;
  fields: FieldContext[];
}

export interface ObjectContext {
  name: string;
  description?: string;
  fields: FieldContext[];
  conformances: string[];
  hasFields: boolean;
  isResultUnion: boolean;
  resultUnionEntries?: ResultUnionEntryContext[];
}

export interface ResultUnionEntryContext {
  fieldName: string;
  caseName: string;
  type: string;
  isLast: boolean;
}

export interface InputContext {
  name: string;
  description?: string;
  fields: FieldContext[];
  hasRequiredFields: boolean;
  isCustomType: boolean;
  customTypeKind?: string;
}

export interface UnionContext {
  name: string;
  description?: string;
  members: UnionMemberContext[];
  sharedInterfaces: string[];
  conformances: string;
  hasNestedUnions: boolean;
  nestedUnionWrappers: NestedUnionWrapperContext[];
  concreteMembers: ConcreteMemberContext[];
}

export interface UnionMemberContext {
  name: string;
  caseName: string;
  isNested: boolean;
}

export interface NestedUnionWrapperContext {
  wrapperName: string;
  unionName: string;
  parentUnionName: string;
}

export interface ConcreteMemberContext {
  typeName: string;
  delegateTo: string;
  isNested: boolean;
  wrapperName?: string;
}

export interface OperationContext {
  kind: 'Query' | 'Mutation' | 'Subscription';
  name: string;
  description?: string;
  protocolName: string;
  fields: OperationFieldContext[];
}

export interface OperationFieldContext {
  name: string;
  escapedName: string;
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
  type: string;
  defaultValue: string;
  isLast: boolean;
}

// ============================================================================
// Template Engine
// ============================================================================

export class TemplateEngine {
  private handlebars: typeof Handlebars;
  private templates: Map<string, Handlebars.TemplateDelegate> = new Map();

  constructor() {
    this.handlebars = Handlebars.create();
    this.registerBuiltinHelpers();
  }

  private registerBuiltinHelpers(): void {
    // Conditional helpers
    this.handlebars.registerHelper('if_eq', function (a: unknown, b: unknown, options: Handlebars.HelperOptions) {
      return a === b ? options.fn(this) : options.inverse(this);
    });

    this.handlebars.registerHelper('unless_eq', function (a: unknown, b: unknown, options: Handlebars.HelperOptions) {
      return a !== b ? options.fn(this) : options.inverse(this);
    });

    this.handlebars.registerHelper('if_gt', function (a: unknown, b: unknown, options: Handlebars.HelperOptions) {
      return (a as number) > (b as number) ? options.fn(this) : options.inverse(this);
    });

    // String helpers
    this.handlebars.registerHelper('capitalize', (str: string) => {
      return str ? str.charAt(0).toUpperCase() + str.slice(1) : '';
    });

    this.handlebars.registerHelper('lowercase', (str: string) => {
      return str ? str.toLowerCase() : '';
    });

    // Array helpers
    this.handlebars.registerHelper('join', (arr: string[], separator: string) => {
      return Array.isArray(arr) ? arr.join(separator) : '';
    });

    this.handlebars.registerHelper('length', (arr: unknown[]) => {
      return Array.isArray(arr) ? arr.length : 0;
    });

    // Logic helpers
    this.handlebars.registerHelper('and', (...args: unknown[]) => {
      const options = args.pop() as Handlebars.HelperOptions;
      return args.every(Boolean) ? options.fn(this) : options.inverse(this);
    });

    this.handlebars.registerHelper('or', (...args: unknown[]) => {
      const options = args.pop() as Handlebars.HelperOptions;
      return args.some(Boolean) ? options.fn(this) : options.inverse(this);
    });

    this.handlebars.registerHelper('not', (value: unknown) => {
      return !value;
    });

    // Index helpers
    this.handlebars.registerHelper('is_last', function (index: number, array: unknown[], options: Handlebars.HelperOptions) {
      return index === array.length - 1 ? options.fn(this) : options.inverse(this);
    });

    this.handlebars.registerHelper('is_not_last', function (index: number, array: unknown[], options: Handlebars.HelperOptions) {
      return index !== array.length - 1 ? options.fn(this) : options.inverse(this);
    });
  }

  /**
   * Register a custom helper function
   */
  registerHelper(name: string, fn: Handlebars.HelperDelegate): void {
    this.handlebars.registerHelper(name, fn);
  }

  /**
   * Register a template string
   */
  registerTemplate(name: string, template: string): void {
    this.templates.set(name, this.handlebars.compile(template));
  }

  /**
   * Register a partial template
   */
  registerPartial(name: string, template: string): void {
    this.handlebars.registerPartial(name, template);
  }

  /**
   * Render a registered template with context
   */
  render(templateName: string, context: Record<string, unknown>): string {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }
    return template(context);
  }

  /**
   * Render a template string directly
   */
  renderString(template: string, context: Record<string, unknown>): string {
    const compiled = this.handlebars.compile(template);
    return compiled(context);
  }
}

// ============================================================================
// Context Builders
// ============================================================================

export interface ContextBuilderConfig {
  mapType: (type: IRType) => string;
  mapScalar: (name: string) => string;
  escapeKeyword: (name: string) => string;
  enumValueCase: (name: string) => string;
  fieldNameCase: (name: string) => string;
  getPropertyType: (type: IRType) => string;
}

export function buildEnumContext(
  irEnum: IREnum,
  config: ContextBuilderConfig
): EnumContext {
  return {
    name: irEnum.name,
    description: irEnum.description,
    isErrorCode: irEnum.isErrorCode,
    values: irEnum.values.map((value, index) => ({
      name: value.name,
      caseName: config.escapeKeyword(config.enumValueCase(value.name)),
      rawValue: value.rawValue,
      description: value.description,
      legacyAliases: value.legacyAliases,
      isLast: index === irEnum.values.length - 1,
    })),
  };
}

export function buildFieldContext(
  field: IRField,
  config: ContextBuilderConfig,
  isLast: boolean
): FieldContext {
  return {
    name: field.name,
    propertyName: config.escapeKeyword(config.fieldNameCase(field.name)),
    type: config.getPropertyType(field.type),
    description: field.description,
    nullable: field.type.nullable,
    isOverride: field.isOverride,
    defaultValue: field.defaultValue || '',
    isLast,
  };
}

export function buildFieldsContext(
  fields: IRField[],
  config: ContextBuilderConfig,
  sort: boolean = false
): FieldContext[] {
  const sortedFields = sort
    ? [...fields].sort((a, b) => a.name.localeCompare(b.name))
    : fields;
  return sortedFields.map((field, index) =>
    buildFieldContext(field, config, index === sortedFields.length - 1)
  );
}
