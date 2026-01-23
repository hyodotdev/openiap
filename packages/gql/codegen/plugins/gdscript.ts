/**
 * GDScript Code Generation Plugin
 *
 * Generates GDScript types with from_dict/to_dict methods from GraphQL schema.
 * Uses the IR (Intermediate Representation) for maintainable code generation.
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
  GDSCRIPT_KEYWORDS,
  GRAPHQL_TO_GDSCRIPT,
  toSnakeCase,
  toConstantCase,
  toKebabCase,
} from '../core/utils.js';

export class GDScriptPlugin extends CodegenPlugin {
  readonly name = 'gdscript';
  readonly fileExtension = '.gd';
  readonly keywords = GDSCRIPT_KEYWORDS;

  private schema!: IRSchema;
  private enumNames = new Set<string>();
  private objectNames = new Set<string>();
  private inputNames = new Set<string>();
  private unionNames = new Set<string>();

  // Field name aliases for cleaner API
  private readonly fieldNameAliases = new Map([
    ['RequestPurchaseProps.requestPurchase', 'request'],
    ['RequestSubscriptionProps.requestSubscription', 'request'],
  ]);

  constructor(config: CodegenPluginConfig) {
    super(config);
  }

  // ============================================================================
  // Type Mapping
  // ============================================================================

  mapScalar(name: string): string {
    return GRAPHQL_TO_GDSCRIPT[name] ?? 'Variant';
  }

  mapType(type: IRType): string {
    if (type.kind === 'list') {
      const elementType = this.mapType(type.elementType!);
      return `Array[${elementType}]`;
    }
    if (type.kind === 'scalar') {
      return this.mapScalar(type.name!);
    }
    if (type.kind === 'union') {
      return 'Variant';
    }
    return type.name!;
  }

  escapeKeyword(name: string): string {
    return this.keywords.has(name.toLowerCase()) ? `_${name}` : name;
  }

  enumValueCase(name: string): string {
    return toConstantCase(name);
  }

  fieldNameCase(name: string): string {
    return toSnakeCase(name);
  }

  private getGdscriptFieldName(fieldName: string, typeName: string | null = null): string {
    if (typeName) {
      const key = `${typeName}.${fieldName}`;
      if (this.fieldNameAliases.has(key)) {
        return toSnakeCase(this.escapeKeyword(this.fieldNameAliases.get(key)!));
      }
    }
    return toSnakeCase(this.escapeKeyword(fieldName));
  }

  // ============================================================================
  // Code Generation
  // ============================================================================

  generate(schema: IRSchema): string {
    this.schema = schema;

    // Clear caches to support plugin reuse
    this.enumNames.clear();
    this.objectNames.clear();
    this.inputNames.clear();
    this.unionNames.clear();

    // Build type name sets for reference
    for (const e of schema.enums) this.enumNames.add(e.name);
    for (const o of schema.objects) this.objectNames.add(o.name);
    for (const i of schema.inputs) this.inputNames.add(i.name);
    for (const u of schema.unions) this.unionNames.add(u.name);

    this.lines = [];
    this.generateHeader();

    // Enums
    this.emit('# ============================================================================');
    this.emit('# Enums');
    this.emit('# ============================================================================');
    this.emit('');
    for (const irEnum of schema.enums) {
      this.generateEnum(irEnum);
    }

    // Objects (Types)
    this.emit('# ============================================================================');
    this.emit('# Types');
    this.emit('# ============================================================================');
    this.emit('');
    for (const irObject of schema.objects) {
      // Skip union wrapper types
      if (irObject.isResultUnion) continue;
      this.generateObject(irObject);
    }

    // Inputs
    this.emit('# ============================================================================');
    this.emit('# Input Types');
    this.emit('# ============================================================================');
    this.emit('');
    for (const irInput of schema.inputs) {
      this.generateInput(irInput);
    }

    // Enum helpers
    this.emit('# ============================================================================');
    this.emit('# Enum String Helpers');
    this.emit('# ============================================================================');
    this.emit('');
    for (const irEnum of schema.enums) {
      this.generateEnumValueHelper(irEnum);
    }

    this.emit('# ============================================================================');
    this.emit('# Enum Reverse Lookup (string -> enum for deserialization)');
    this.emit('# ============================================================================');
    this.emit('');
    for (const irEnum of schema.enums) {
      this.generateEnumReverseLookup(irEnum);
    }

    // Operations
    if (schema.operations.length > 0) {
      this.emit('# ============================================================================');
      this.emit('# Query Types');
      this.emit('# ============================================================================');
      this.emit('');
      const queryOp = schema.operations.find(op => op.name === 'Query');
      if (queryOp) {
        this.generateOperation(queryOp);
      }

      this.emit('# ============================================================================');
      this.emit('# Mutation Types');
      this.emit('# ============================================================================');
      this.emit('');
      const mutationOp = schema.operations.find(op => op.name === 'Mutation');
      if (mutationOp) {
        this.generateOperation(mutationOp);
      }

      this.emit('# ============================================================================');
      this.emit('# API Wrapper Functions');
      this.emit('# These typed functions can be used by godot-iap wrapper');
      this.emit('# ============================================================================');
      this.emit('');

      if (queryOp) {
        this.emit('# Query API helpers');
        this.emit('');
        this.generateApiHelpers(queryOp);
      }

      if (mutationOp) {
        this.emit('# Mutation API helpers');
        this.emit('');
        this.generateApiHelpers(mutationOp);
      }
    }

    return this.lines.join('\n');
  }

  generateHeader(): void {
    this.emit('# ============================================================================');
    this.emit('# AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY');
    this.emit('# Generated from OpenIAP GraphQL schema (https://openiap.dev)');
    this.emit('# Run `bun run generate` to regenerate this file.');
    this.emit('# ============================================================================');
    this.emit('# Usage: const Types = preload("types.gd")');
    this.emit('#        var store: Types.IapStore = Types.IapStore.APPLE');
    this.emit('# ============================================================================');
    this.emit('');
  }

  protected generateDocComment(description: string | undefined, indent: string = ''): void {
    if (!description) return;
    const singleLine = description.replace(/\r?\n/g, ' ').trim();
    this.emit(`${indent}## ${singleLine}`);
  }

  // ============================================================================
  // Enums
  // ============================================================================

  generateEnum(irEnum: IREnum): void {
    this.generateDocComment(irEnum.description);
    this.emit(`enum ${irEnum.name} {`);

    irEnum.values.forEach((value, index) => {
      if (value.description) {
        const singleLine = value.description.replace(/\r?\n/g, ' ').trim();
        this.emit(`\t## ${singleLine}`);
      }
      this.emit(`\t${this.enumValueCase(value.name)} = ${index},`);
    });

    this.emit('}');
    this.emit('');
  }

  private generateEnumValueHelper(irEnum: IREnum): void {
    this.emit(`const ${toConstantCase(irEnum.name)}_VALUES = {`);
    irEnum.values.forEach((value, index) => {
      const comma = index < irEnum.values.length - 1 ? ',' : '';
      this.emit(`\t${irEnum.name}.${this.enumValueCase(value.name)}: "${value.rawValue}"${comma}`);
    });
    this.emit('}');
    this.emit('');
  }

  private generateEnumReverseLookup(irEnum: IREnum): void {
    this.emit(`const ${toConstantCase(irEnum.name)}_FROM_STRING = {`);
    irEnum.values.forEach((value, index) => {
      const comma = index < irEnum.values.length - 1 ? ',' : '';
      this.emit(`\t"${value.rawValue}": ${irEnum.name}.${this.enumValueCase(value.name)}${comma}`);
    });
    this.emit('}');
    this.emit('');
  }

  // ============================================================================
  // Interfaces (not used in GDScript, but required by base class)
  // ============================================================================

  generateInterface(irInterface: IRInterface): void {
    // GDScript doesn't have interfaces, skip
  }

  // ============================================================================
  // Objects
  // ============================================================================

  generateObject(irObject: IRObject): void {
    this.generateDocComment(irObject.description);
    this.emit(`class ${irObject.name}:`);

    const fields = irObject.fields;
    if (fields.length === 0) {
      this.emit('\tpass');
    } else {
      // Field declarations
      for (const field of fields) {
        if (field.description) {
          this.emit(`\t## ${field.description.split('\n')[0]}`);
        }
        const gdType = this.mapType(field.type);
        const fieldName = this.getGdscriptFieldName(field.name, irObject.name);
        this.emit(`\tvar ${fieldName}: ${gdType}`);
      }

      // from_dict method
      this.emit('');
      this.emit(`\tstatic func from_dict(data: Dictionary) -> ${irObject.name}:`);
      this.emit(`\t\tvar obj = ${irObject.name}.new()`);
      for (const field of fields) {
        const fieldName = this.getGdscriptFieldName(field.name, irObject.name);
        this.generateFromDictField(field, fieldName);
      }
      this.emit('\t\treturn obj');

      // to_dict method
      this.emit('');
      this.emit('\tfunc to_dict() -> Dictionary:');
      this.emit('\t\tvar dict = {}');
      for (const field of fields) {
        const fieldName = this.getGdscriptFieldName(field.name, irObject.name);
        this.generateToDictField(field, fieldName);
      }
      this.emit('\t\treturn dict');
    }

    this.emit('');
  }

  private generateFromDictField(field: IRField, fieldName: string): void {
    const graphqlName = field.name;
    const type = field.type;

    this.emit(`\t\tif data.has("${graphqlName}") and data["${graphqlName}"] != null:`);

    if (this.isObjectOrInput(type) && type.kind === 'list') {
      const elementTypeName = type.elementType!.name!;
      this.emit(`\t\t\tvar arr = []`);
      this.emit(`\t\t\tfor item in data["${graphqlName}"]:`);
      this.emit(`\t\t\t\tif item is Dictionary:`);
      this.emit(`\t\t\t\t\tarr.append(${elementTypeName}.from_dict(item))`);
      this.emit(`\t\t\t\telse:`);
      this.emit(`\t\t\t\t\tarr.append(item)`);
      this.emit(`\t\t\tobj.${fieldName} = arr`);
    } else if (this.isObjectOrInput(type)) {
      const typeName = type.name!;
      this.emit(`\t\t\tif data["${graphqlName}"] is Dictionary:`);
      this.emit(`\t\t\t\tobj.${fieldName} = ${typeName}.from_dict(data["${graphqlName}"])`);
      this.emit(`\t\t\telse:`);
      this.emit(`\t\t\t\tobj.${fieldName} = data["${graphqlName}"]`);
    } else if (type.kind === 'enum') {
      const enumReverseLookup = toConstantCase(type.name!) + '_FROM_STRING';
      this.emit(`\t\t\tvar enum_str = data["${graphqlName}"]`);
      this.emit(`\t\t\tif enum_str is String and ${enumReverseLookup}.has(enum_str):`);
      this.emit(`\t\t\t\tobj.${fieldName} = ${enumReverseLookup}[enum_str]`);
      this.emit(`\t\t\telse:`);
      this.emit(`\t\t\t\tobj.${fieldName} = enum_str`);
    } else {
      this.emit(`\t\t\tobj.${fieldName} = data["${graphqlName}"]`);
    }
  }

  private generateToDictField(field: IRField, fieldName: string): void {
    const graphqlName = field.name;
    const type = field.type;
    const enumConstName = type.name ? toConstantCase(type.name) + '_VALUES' : '';

    if (this.isObjectOrInput(type) && type.kind === 'list') {
      this.emit(`\t\tif ${fieldName} != null:`);
      this.emit(`\t\t\tvar arr = []`);
      this.emit(`\t\t\tfor item in ${fieldName}:`);
      this.emit(`\t\t\t\tif item != null and item.has_method("to_dict"):`);
      this.emit(`\t\t\t\t\tarr.append(item.to_dict())`);
      this.emit(`\t\t\t\telse:`);
      this.emit(`\t\t\t\t\tarr.append(item)`);
      this.emit(`\t\t\tdict["${graphqlName}"] = arr`);
      this.emit(`\t\telse:`);
      this.emit(`\t\t\tdict["${graphqlName}"] = null`);
    } else if (this.isObjectOrInput(type)) {
      this.emit(`\t\tif ${fieldName} != null and ${fieldName}.has_method("to_dict"):`);
      this.emit(`\t\t\tdict["${graphqlName}"] = ${fieldName}.to_dict()`);
      this.emit(`\t\telse:`);
      this.emit(`\t\t\tdict["${graphqlName}"] = ${fieldName}`);
    } else if (type.kind === 'enum') {
      this.emit(`\t\tif ${enumConstName}.has(${fieldName}):`);
      this.emit(`\t\t\tdict["${graphqlName}"] = ${enumConstName}[${fieldName}]`);
      this.emit(`\t\telse:`);
      this.emit(`\t\t\tdict["${graphqlName}"] = ${fieldName}`);
    } else {
      this.emit(`\t\tdict["${graphqlName}"] = ${fieldName}`);
    }
  }

  private isObjectOrInput(type: IRType): boolean {
    if (type.kind === 'list') {
      return type.elementType ? this.isObjectOrInput(type.elementType) : false;
    }
    return this.objectNames.has(type.name!) || this.inputNames.has(type.name!);
  }

  // ============================================================================
  // Inputs
  // ============================================================================

  generateInput(irInput: IRInput): void {
    this.generateDocComment(irInput.description);
    this.emit(`class ${irInput.name}:`);

    const fields = irInput.fields;
    if (fields.length === 0) {
      this.emit('\tpass');
    } else {
      // Field declarations
      for (const field of fields) {
        if (field.description) {
          this.emit(`\t## ${field.description.split('\n')[0]}`);
        }
        const gdType = this.mapType(field.type);
        const fieldName = this.getGdscriptFieldName(field.name, irInput.name);
        this.emit(`\tvar ${fieldName}: ${gdType}`);
      }

      // from_dict method
      this.emit('');
      this.emit(`\tstatic func from_dict(data: Dictionary) -> ${irInput.name}:`);
      this.emit(`\t\tvar obj = ${irInput.name}.new()`);
      for (const field of fields) {
        const fieldName = this.getGdscriptFieldName(field.name, irInput.name);
        this.generateInputFromDictField(field, fieldName);
      }
      this.emit('\t\treturn obj');

      // to_dict method
      this.emit('');
      this.emit('\tfunc to_dict() -> Dictionary:');
      this.emit('\t\tvar dict = {}');
      for (const field of fields) {
        const fieldName = this.getGdscriptFieldName(field.name, irInput.name);
        this.generateInputToDictField(field, fieldName);
      }
      this.emit('\t\treturn dict');
    }

    this.emit('');
  }

  private generateInputFromDictField(field: IRField, fieldName: string): void {
    const graphqlName = field.name;
    const type = field.type;

    this.emit(`\t\tif data.has("${graphqlName}") and data["${graphqlName}"] != null:`);

    if (this.isObjectOrInput(type) && type.kind === 'list') {
      const elementTypeName = type.elementType!.name!;
      this.emit(`\t\t\tvar arr = []`);
      this.emit(`\t\t\tfor item in data["${graphqlName}"]:`);
      this.emit(`\t\t\t\tif item is Dictionary:`);
      this.emit(`\t\t\t\t\tarr.append(${elementTypeName}.from_dict(item))`);
      this.emit(`\t\t\t\telse:`);
      this.emit(`\t\t\t\t\tarr.append(item)`);
      this.emit(`\t\t\tobj.${fieldName} = arr`);
    } else if (this.isObjectOrInput(type)) {
      const typeName = type.name!;
      this.emit(`\t\t\tif data["${graphqlName}"] is Dictionary:`);
      this.emit(`\t\t\t\tobj.${fieldName} = ${typeName}.from_dict(data["${graphqlName}"])`);
      this.emit(`\t\t\telse:`);
      this.emit(`\t\t\t\tobj.${fieldName} = data["${graphqlName}"]`);
    } else if (type.kind === 'enum') {
      const enumReverseLookup = toConstantCase(type.name!) + '_FROM_STRING';
      this.emit(`\t\t\tvar enum_str = data["${graphqlName}"]`);
      this.emit(`\t\t\tif enum_str is String and ${enumReverseLookup}.has(enum_str):`);
      this.emit(`\t\t\t\tobj.${fieldName} = ${enumReverseLookup}[enum_str]`);
      this.emit(`\t\t\telse:`);
      this.emit(`\t\t\t\tobj.${fieldName} = enum_str`);
    } else {
      this.emit(`\t\t\tobj.${fieldName} = data["${graphqlName}"]`);
    }
  }

  private generateInputToDictField(field: IRField, fieldName: string): void {
    const graphqlName = field.name;
    const type = field.type;
    const enumConstName = type.name ? toConstantCase(type.name) + '_VALUES' : '';

    this.emit(`\t\tif ${fieldName} != null:`);

    if (this.isObjectOrInput(type) && type.kind === 'list') {
      this.emit(`\t\t\tvar arr = []`);
      this.emit(`\t\t\tfor item in ${fieldName}:`);
      this.emit(`\t\t\t\tif item.has_method("to_dict"):`);
      this.emit(`\t\t\t\t\tarr.append(item.to_dict())`);
      this.emit(`\t\t\t\telse:`);
      this.emit(`\t\t\t\t\tarr.append(item)`);
      this.emit(`\t\t\tdict["${graphqlName}"] = arr`);
    } else if (this.isObjectOrInput(type)) {
      this.emit(`\t\t\tif ${fieldName}.has_method("to_dict"):`);
      this.emit(`\t\t\t\tdict["${graphqlName}"] = ${fieldName}.to_dict()`);
      this.emit(`\t\t\telse:`);
      this.emit(`\t\t\t\tdict["${graphqlName}"] = ${fieldName}`);
    } else if (type.kind === 'enum') {
      this.emit(`\t\t\tif ${enumConstName}.has(${fieldName}):`);
      this.emit(`\t\t\t\tdict["${graphqlName}"] = ${enumConstName}[${fieldName}]`);
      this.emit(`\t\t\telse:`);
      this.emit(`\t\t\t\tdict["${graphqlName}"] = ${fieldName}`);
    } else {
      this.emit(`\t\t\tdict["${graphqlName}"] = ${fieldName}`);
    }
  }

  // ============================================================================
  // Unions (not used directly in GDScript)
  // ============================================================================

  generateUnion(irUnion: IRUnion): void {
    // GDScript doesn't have unions, use Variant
  }

  // ============================================================================
  // Operations
  // ============================================================================

  generateOperation(irOperation: IROperation): void {
    this.emit(`class ${irOperation.name}:`);
    // Use schema field order, don't filter _placeholder
    const fields = irOperation.fields;

    if (fields.length === 0) {
      this.emit('\tpass');
    } else {
      for (const field of fields) {
        if (field.description) {
          this.emit(`\t## ${field.description.split('\n')[0]}`);
        }

        this.emit(`\tclass ${field.name}Field:`);
        this.emit(`\t\tconst name = "${field.name}"`);
        this.emit(`\t\tconst snake_name = "${toSnakeCase(field.name)}"`);

        // Args class
        if (field.args.length > 0) {
          this.emit(`\t\tclass Args:`);
          for (const arg of field.args) {
            const argType = this.mapType(arg.type);
            const argSnakeName = this.escapeKeyword(toSnakeCase(arg.name));
            if (arg.description) {
              this.emit(`\t\t\t## ${arg.description.split('\n')[0]}`);
            }
            this.emit(`\t\t\tvar ${argSnakeName}: ${argType}`);
          }
          this.emit('');
          this.emit(`\t\t\tstatic func from_dict(data: Dictionary) -> Args:`);
          this.emit(`\t\t\t\tvar obj = Args.new()`);
          for (const arg of field.args) {
            const argSnakeName = this.escapeKeyword(toSnakeCase(arg.name));
            this.emit(`\t\t\t\tif data.has("${arg.name}") and data["${arg.name}"] != null:`);
            this.emit(`\t\t\t\t\tobj.${argSnakeName} = data["${arg.name}"]`);
          }
          this.emit(`\t\t\t\treturn obj`);
          this.emit('');
          this.emit(`\t\t\tfunc to_dict() -> Dictionary:`);
          this.emit(`\t\t\t\tvar dict = {}`);
          for (const arg of field.args) {
            const argSnakeName = this.escapeKeyword(toSnakeCase(arg.name));
            this.emit(`\t\t\t\tdict["${arg.name}"] = ${argSnakeName}`);
          }
          this.emit(`\t\t\t\treturn dict`);
        } else {
          this.emit(`\t\tclass Args:`);
          this.emit(`\t\t\tpass`);
        }

        // Return type info
        const returnTypeName = field.returnType.kind === 'list'
          ? field.returnType.elementType?.name || 'Variant'
          : field.returnType.name || 'Variant';
        const isArray = field.returnType.kind === 'list';
        this.emit(`\t\tconst return_type = "${returnTypeName}"`);
        this.emit(`\t\tconst is_array = ${isArray}`);
        this.emit('');
      }
    }
    this.emit('');
  }

  private generateApiHelpers(irOperation: IROperation): void {
    const fields = irOperation.fields.filter(f => f.name !== '_placeholder');

    for (const field of fields) {
      const snakeName = toSnakeCase(field.name);

      if (field.description) {
        this.emit(`## ${field.description.split('\n')[0]}`);
      }

      // Build parameters
      const params: string[] = [];
      for (const arg of field.args) {
        const argType = this.mapType(arg.type);
        const argSnakeName = toSnakeCase(arg.name);
        params.push(`${argSnakeName}: ${argType}`);
      }

      const paramStr = params.join(', ');
      this.emit(`static func ${snakeName}_args(${paramStr}) -> Dictionary:`);

      if (field.args.length > 0) {
        this.emit('\tvar args = {}');
        for (const arg of field.args) {
          const argSnakeName = this.escapeKeyword(toSnakeCase(arg.name));
          const isObjOrInput = this.isObjectOrInputType(arg.type);
          if (isObjOrInput && arg.type.kind === 'list') {
            // Handle list of objects/inputs
            this.emit(`\tif ${argSnakeName} != null:`);
            this.emit(`\t\tvar arr = []`);
            this.emit(`\t\tfor item in ${argSnakeName}:`);
            this.emit(`\t\t\tif item != null and item.has_method("to_dict"):`);
            this.emit(`\t\t\t\tarr.append(item.to_dict())`);
            this.emit(`\t\t\telse:`);
            this.emit(`\t\t\t\tarr.append(item)`);
            this.emit(`\t\targs["${arg.name}"] = arr`);
          } else if (isObjOrInput) {
            // Handle single object/input
            this.emit(`\tif ${argSnakeName} != null:`);
            this.emit(`\t\tif ${argSnakeName}.has_method("to_dict"):`);
            this.emit(`\t\t\targs["${arg.name}"] = ${argSnakeName}.to_dict()`);
            this.emit(`\t\telse:`);
            this.emit(`\t\t\targs["${arg.name}"] = ${argSnakeName}`);
          } else {
            this.emit(`\targs["${arg.name}"] = ${argSnakeName}`);
          }
        }
        this.emit('\treturn args');
      } else {
        this.emit('\treturn {}');
      }
      this.emit('');
    }
  }

  private isObjectOrInputByName(typeName: string | undefined): boolean {
    if (!typeName) return false;
    return this.objectNames.has(typeName) || this.inputNames.has(typeName);
  }

  private isObjectOrInputType(type: IRType): boolean {
    if (type.kind === 'list' && type.elementType) {
      return this.isObjectOrInputByName(type.elementType.name);
    }
    return this.isObjectOrInputByName(type.name);
  }
}
