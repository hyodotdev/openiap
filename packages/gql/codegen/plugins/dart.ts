/**
 * Dart Code Generation Plugin
 *
 * Generates Dart types with fromJson/toJson methods from GraphQL schema.
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
  DART_KEYWORDS,
  GRAPHQL_TO_DART,
  toPascalCasePreserveIOS,
  toKebabCase,
  PLATFORM_TYPE_DEFAULTS,
} from '../core/utils.js';

export class DartPlugin extends CodegenPlugin {
  readonly name = 'dart';
  readonly fileExtension = '.dart';
  readonly keywords = DART_KEYWORDS;

  private schema!: IRSchema;
  private enumNames = new Set<string>();
  private objectNames = new Set<string>();
  private inputNames = new Set<string>();
  private unionNames = new Set<string>();
  private interfaceNames = new Set<string>();

  constructor(config: CodegenPluginConfig) {
    super(config);
  }

  // ============================================================================
  // Type Mapping
  // ============================================================================

  mapScalar(name: string): string {
    return GRAPHQL_TO_DART[name] ?? 'dynamic';
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
    return this.keywords.has(name) ? `_${name}` : name;
  }

  enumValueCase(name: string): string {
    return toPascalCasePreserveIOS(name);
  }

  fieldNameCase(name: string): string {
    return name; // Dart uses camelCase which matches GraphQL field names
  }

  // ============================================================================
  // Code Generation
  // ============================================================================

  generate(schema: IRSchema): string {
    this.schema = schema;

    // Build type name sets for reference
    for (const e of schema.enums) this.enumNames.add(e.name);
    for (const o of schema.objects) this.objectNames.add(o.name);
    for (const i of schema.inputs) this.inputNames.add(i.name);
    for (const u of schema.unions) this.unionNames.add(u.name);
    for (const i of schema.interfaces) this.interfaceNames.add(i.name);

    this.lines = [];
    this.generateHeader();

    // Enums
    if (schema.enums.length > 0) {
      this.emit('// MARK: - Enums');
      this.emit('');
      for (const irEnum of schema.enums) {
        this.generateEnum(irEnum);
      }
    }

    // Interfaces
    if (schema.interfaces.length > 0) {
      this.emit('// MARK: - Interfaces');
      this.emit('');
      for (const irInterface of schema.interfaces) {
        this.generateInterface(irInterface);
      }
    }

    // Objects
    if (schema.objects.length > 0) {
      this.emit('// MARK: - Objects');
      this.emit('');
      for (const irObject of schema.objects) {
        this.generateObject(irObject);
      }
    }

    // Inputs
    if (schema.inputs.length > 0) {
      this.emit('// MARK: - Input Objects');
      this.emit('');
      for (const irInput of schema.inputs) {
        this.generateInput(irInput);
      }
    }

    // Unions
    if (schema.unions.length > 0) {
      this.emit('// MARK: - Unions');
      this.emit('');
      for (const irUnion of schema.unions) {
        this.generateUnion(irUnion);
      }
    }

    // Operations
    if (schema.operations.length > 0) {
      this.emit('// MARK: - Root Operations');
      this.emit('');
      for (const irOperation of schema.operations) {
        this.generateOperation(irOperation);
      }

      this.emit('// MARK: - Root Operation Helpers');
      this.emit('');
      for (const irOperation of schema.operations) {
        this.generateOperationHelpers(irOperation);
      }
    }

    return this.lines.join('\n');
  }

  generateHeader(): void {
    this.emit('// ============================================================================');
    this.emit('// AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY');
    this.emit('// Run `npm run generate` after updating any *.graphql schema file.');
    this.emit('// ============================================================================');
    this.emit('');
    this.emit('// ignore_for_file: unused_element, unused_field');
    this.emit('');
    this.emit("import 'dart:async';");
    this.emit('');
  }

  protected generateDocComment(description: string | undefined, indent: string = ''): void {
    if (!description) return;
    for (const line of description.split(/\r?\n/)) {
      this.emit(`${indent}/// ${line}`);
    }
  }

  // ============================================================================
  // Enums
  // ============================================================================

  generateEnum(irEnum: IREnum): void {
    this.generateDocComment(irEnum.description);
    this.emit(`enum ${irEnum.name} {`);

    const values = irEnum.values;
    values.forEach((value, index) => {
      this.generateDocComment(value.description, '  ');
      const caseName = this.escapeKeyword(this.enumValueCase(value.name));
      const suffix = index === values.length - 1 ? ';' : ',';
      this.emit(`  ${caseName}('${value.rawValue}')${suffix}`);
    });

    this.emit('');
    this.emit(`  const ${irEnum.name}(this.value);`);
    this.emit('  final String value;');
    this.emit('');
    this.emit(`  factory ${irEnum.name}.fromJson(String value) {`);
    this.emit("    final normalized = value.toLowerCase().replaceAll('_', '-');");
    this.emit('    switch (normalized) {');

    for (const value of values) {
      const caseName = this.escapeKeyword(this.enumValueCase(value.name));
      this.emit(`      case '${value.rawValue}':`);
      this.emit(`        return ${irEnum.name}.${caseName};`);
    }

    this.emit('    }');
    this.emit(`    throw ArgumentError('Unknown ${irEnum.name} value: \$value');`);
    this.emit('  }');
    this.emit('');
    this.emit('  String toJson() => value;');
    this.emit('}');
    this.emit('');
  }

  // ============================================================================
  // Interfaces
  // ============================================================================

  generateInterface(irInterface: IRInterface): void {
    this.generateDocComment(irInterface.description);
    this.emit(`abstract class ${irInterface.name} {`);

    // Sort fields alphabetically for Dart
    const sortedFields = [...irInterface.fields].sort((a, b) => a.name.localeCompare(b.name));
    for (const field of sortedFields) {
      this.generateDocComment(field.description, '  ');
      const propertyType = this.getPropertyType(field.type);
      const propertyName = this.escapeKeyword(field.name);
      this.emit(`  ${propertyType} get ${propertyName};`);
    }

    this.emit('}');
    this.emit('');
  }

  // ============================================================================
  // Objects
  // ============================================================================

  generateObject(irObject: IRObject): void {
    // Handle VoidResult
    if (irObject.name === 'VoidResult') {
      this.emit('typedef VoidResult = void;');
      this.emit('');
      return;
    }

    // Handle result union wrappers (FetchProductsResult, etc.)
    if (irObject.isResultUnion && irObject.resultUnionEntries) {
      this.generateResultUnionObject(irObject);
      return;
    }

    this.generateDocComment(irObject.description);

    // Build extends and implements clauses
    const unionsForObject = irObject.unions || [];
    const baseUnion = unionsForObject.length > 0 ? unionsForObject[0] : null;
    const otherUnions = unionsForObject.slice(1);
    const implementsTargets = [...irObject.interfaces, ...otherUnions];

    const extendsClause = baseUnion ? ` extends ${baseUnion}` : '';
    const implementsClause = implementsTargets.length > 0
      ? ` implements ${implementsTargets.join(', ')}`
      : '';

    this.emit(`class ${irObject.name}${extendsClause}${implementsClause} {`);
    this.emit(`  const ${irObject.name}({`);

    // Sort fields alphabetically for Dart
    const sortedFields = [...irObject.fields].sort((a, b) => a.name.localeCompare(b.name));

    // Constructor parameters
    for (const field of sortedFields) {
      const defaults = PLATFORM_TYPE_DEFAULTS[irObject.name];
      let defaultValue = '';

      if (defaults) {
        if (field.name === 'platform') {
          const platformEnum = defaults.platform === 'ios' ? 'IapPlatform.IOS' : 'IapPlatform.Android';
          defaultValue = ` = ${platformEnum}`;
        } else if (field.name === 'type') {
          const typeEnum = defaults.type === 'in-app' ? 'ProductType.InApp' : 'ProductType.Subs';
          defaultValue = ` = ${typeEnum}`;
        }
      }

      if (defaultValue) {
        this.emit(`    this.${this.escapeKeyword(field.name)}${defaultValue},`);
      } else if (field.type.nullable) {
        this.emit(`    this.${this.escapeKeyword(field.name)},`);
      } else {
        this.emit(`    required this.${this.escapeKeyword(field.name)},`);
      }
    }

    // Special handling for PurchaseAndroid and PurchaseIOS
    const needsAlternativeBilling = (irObject.name === 'PurchaseAndroid' || irObject.name === 'PurchaseIOS')
      && !sortedFields.some(f => f.name === 'isAlternativeBilling');
    if (needsAlternativeBilling) {
      this.emit('    this.isAlternativeBilling,');
    }

    this.emit('  });');
    this.emit('');

    // Field declarations
    for (const field of sortedFields) {
      this.generateDocComment(field.description, '  ');
      const propertyType = this.getPropertyType(field.type);
      this.emit(`  final ${propertyType} ${this.escapeKeyword(field.name)};`);
    }
    if (needsAlternativeBilling) {
      this.emit('  final bool? isAlternativeBilling;');
    }

    // fromJson factory
    this.emit('');
    this.emit(`  factory ${irObject.name}.fromJson(Map<String, dynamic> json) {`);
    this.emit(`    return ${irObject.name}(`);
    for (const field of sortedFields) {
      const jsonExpr = this.buildFromJsonExpression(field.type, `json['${field.name}']`);
      this.emit(`      ${this.escapeKeyword(field.name)}: ${jsonExpr},`);
    }
    if (needsAlternativeBilling) {
      this.emit(`      isAlternativeBilling: json['isAlternativeBilling'] as bool?,`);
    }
    this.emit('    );');
    this.emit('  }');

    // toJson method
    this.emit('');
    if (baseUnion) {
      this.emit('  @override');
    }
    this.emit('  Map<String, dynamic> toJson() {');
    this.emit('    return {');
    this.emit(`      '__typename': '${irObject.name}',`);
    for (const field of sortedFields) {
      const toJsonExpr = this.buildToJsonExpression(field.type, this.escapeKeyword(field.name));
      this.emit(`      '${field.name}': ${toJsonExpr},`);
    }
    if (needsAlternativeBilling) {
      this.emit(`      'isAlternativeBilling': isAlternativeBilling,`);
    }
    this.emit('    };');
    this.emit('  }');

    this.emit('}');
    this.emit('');
  }

  private generateResultUnionObject(irObject: IRObject): void {
    this.generateDocComment(irObject.description);
    this.emit(`abstract class ${irObject.name} {`);
    this.emit(`  const ${irObject.name}();`);
    this.emit('}');
    this.emit('');

    // Sort entries alphabetically
    const sortedEntries = [...irObject.resultUnionEntries!].sort((a, b) =>
      a.fieldName.localeCompare(b.fieldName)
    );
    for (const entry of sortedEntries) {
      const className = `${irObject.name}${toPascalCasePreserveIOS(entry.fieldName)}`;
      const valueType = this.getPropertyType(entry.type);
      this.emit(`class ${className} extends ${irObject.name} {`);
      this.emit(`  const ${className}(this.value);`);
      this.emit(`  final ${valueType} value;`);
      this.emit('}');
      this.emit('');
    }
  }

  // ============================================================================
  // Inputs
  // ============================================================================

  generateInput(irInput: IRInput): void {
    // Handle PurchaseInput alias
    if (irInput.name === 'PurchaseInput') {
      this.emit('typedef PurchaseInput = Purchase;');
      this.emit('');
      return;
    }

    // Handle RequestPurchaseProps special case
    if (irInput.name === 'RequestPurchaseProps') {
      this.generateRequestPurchaseProps(irInput);
      return;
    }

    this.generateDocComment(irInput.description);
    this.emit(`class ${irInput.name} {`);
    this.emit(`  const ${irInput.name}({`);

    // Sort fields alphabetically for Dart
    const sortedFields = [...irInput.fields].sort((a, b) => a.name.localeCompare(b.name));

    for (const field of sortedFields) {
      if (field.type.nullable) {
        this.emit(`    this.${this.escapeKeyword(field.name)},`);
      } else {
        this.emit(`    required this.${this.escapeKeyword(field.name)},`);
      }
    }

    this.emit('  });');
    this.emit('');

    // Field declarations
    for (const field of sortedFields) {
      this.generateDocComment(field.description, '  ');
      const propertyType = this.getPropertyType(field.type);
      this.emit(`  final ${propertyType} ${this.escapeKeyword(field.name)};`);
    }

    // fromJson factory
    this.emit('');
    this.emit(`  factory ${irInput.name}.fromJson(Map<String, dynamic> json) {`);
    this.emit(`    return ${irInput.name}(`);
    for (const field of sortedFields) {
      const jsonExpr = this.buildFromJsonExpression(field.type, `json['${field.name}']`);
      this.emit(`      ${this.escapeKeyword(field.name)}: ${jsonExpr},`);
    }
    this.emit('    );');
    this.emit('  }');

    // toJson method
    this.emit('');
    this.emit('  Map<String, dynamic> toJson() {');
    this.emit('    return {');
    for (const field of sortedFields) {
      const toJsonExpr = this.buildToJsonExpression(field.type, this.escapeKeyword(field.name));
      this.emit(`      '${field.name}': ${toJsonExpr},`);
    }
    this.emit('    };');
    this.emit('  }');

    this.emit('}');
    this.emit('');
  }

  private generateRequestPurchaseProps(irInput: IRInput): void {
    this.generateDocComment(irInput.description);

    // Find the platform-specific types from schema
    const purchaseByPlatforms = this.schema.inputs.find(i => i.name === 'RequestPurchasePropsByPlatforms');
    const subsByPlatforms = this.schema.inputs.find(i => i.name === 'RequestSubscriptionPropsByPlatforms');

    // Log warnings if fallback types are used (schema drift detection)
    if (!purchaseByPlatforms) {
      console.warn('[dart] RequestPurchasePropsByPlatforms not found in schema, using fallback types');
    }
    if (!subsByPlatforms) {
      console.warn('[dart] RequestSubscriptionPropsByPlatforms not found in schema, using fallback types');
    }

    const appleName = 'apple';
    const googleName = 'google';
    const appleType = purchaseByPlatforms?.fields.find(f => f.name === 'apple')
      ? this.mapType(purchaseByPlatforms.fields.find(f => f.name === 'apple')!.type)
      : 'RequestPurchaseIosProps';
    const googleType = purchaseByPlatforms?.fields.find(f => f.name === 'google')
      ? this.mapType(purchaseByPlatforms.fields.find(f => f.name === 'google')!.type)
      : 'RequestPurchaseAndroidProps';
    const appleSubsType = subsByPlatforms?.fields.find(f => f.name === 'apple')
      ? this.mapType(subsByPlatforms.fields.find(f => f.name === 'apple')!.type)
      : 'RequestSubscriptionIosProps';
    const googleSubsType = subsByPlatforms?.fields.find(f => f.name === 'google')
      ? this.mapType(subsByPlatforms.fields.find(f => f.name === 'google')!.type)
      : 'RequestSubscriptionAndroidProps';

    this.emit('sealed class RequestPurchaseProps {');
    this.emit('  const RequestPurchaseProps._();');
    this.emit('');
    this.emit('  const factory RequestPurchaseProps.inApp(({');
    this.emit(`    ${appleType}? ${appleName},`);
    this.emit(`    ${googleType}? ${googleName},`);
    this.emit('    bool? useAlternativeBilling,');
    this.emit('  }) props) = _InAppPurchase;');
    this.emit('');
    this.emit('  const factory RequestPurchaseProps.subs(({');
    this.emit(`    ${appleSubsType}? ${appleName},`);
    this.emit(`    ${googleSubsType}? ${googleName},`);
    this.emit('    bool? useAlternativeBilling,');
    this.emit('  }) props) = _SubsPurchase;');
    this.emit('');
    this.emit('  Map<String, dynamic> toJson();');
    this.emit('}');
    this.emit('');

    // _InAppPurchase implementation
    this.emit('class _InAppPurchase extends RequestPurchaseProps {');
    this.emit('  const _InAppPurchase(this.props) : super._();');
    this.emit('  final ({');
    this.emit(`    ${appleType}? ${appleName},`);
    this.emit(`    ${googleType}? ${googleName},`);
    this.emit('    bool? useAlternativeBilling,');
    this.emit('  }) props;');
    this.emit('');
    this.emit('  @override');
    this.emit('  Map<String, dynamic> toJson() {');
    this.emit('    return {');
    this.emit("      'requestPurchase': {");
    this.emit(`        if (props.${appleName} != null) 'ios': props.${appleName}!.toJson(),`);
    this.emit(`        if (props.${googleName} != null) 'android': props.${googleName}!.toJson(),`);
    this.emit('      },');
    this.emit("      'type': ProductQueryType.InApp.toJson(),");
    this.emit("      if (props.useAlternativeBilling != null) 'useAlternativeBilling': props.useAlternativeBilling,");
    this.emit('    };');
    this.emit('  }');
    this.emit('}');
    this.emit('');

    // _SubsPurchase implementation
    this.emit('class _SubsPurchase extends RequestPurchaseProps {');
    this.emit('  const _SubsPurchase(this.props) : super._();');
    this.emit('  final ({');
    this.emit(`    ${appleSubsType}? ${appleName},`);
    this.emit(`    ${googleSubsType}? ${googleName},`);
    this.emit('    bool? useAlternativeBilling,');
    this.emit('  }) props;');
    this.emit('');
    this.emit('  @override');
    this.emit('  Map<String, dynamic> toJson() {');
    this.emit('    return {');
    this.emit("      'requestSubscription': {");
    this.emit(`        if (props.${appleName} != null) 'ios': props.${appleName}!.toJson(),`);
    this.emit(`        if (props.${googleName} != null) 'android': props.${googleName}!.toJson(),`);
    this.emit('      },');
    this.emit("      'type': ProductQueryType.Subs.toJson(),");
    this.emit("      if (props.useAlternativeBilling != null) 'useAlternativeBilling': props.useAlternativeBilling,");
    this.emit('    };');
    this.emit('  }');
    this.emit('}');
    this.emit('');
  }

  // ============================================================================
  // Unions
  // ============================================================================

  generateUnion(irUnion: IRUnion): void {
    this.generateDocComment(irUnion.description);

    // Find shared interfaces
    const sharedInterfaces = irUnion.sharedInterfaces || [];
    const implementsClause = sharedInterfaces.length > 0
      ? ` implements ${sharedInterfaces.join(', ')}`
      : '';

    this.emit(`sealed class ${irUnion.name}${implementsClause} {`);
    this.emit(`  const ${irUnion.name}();`);
    this.emit('');

    // fromJson factory
    this.emit(`  factory ${irUnion.name}.fromJson(Map<String, dynamic> json) {`);
    this.emit(`    final typeName = json['__typename'] as String?;`);
    this.emit('    switch (typeName) {');

    // Handle nested unions by getting concrete members
    const concreteMembers: string[] = [];
    const nestedUnionWrappers = new Map<string, string>();

    for (const member of irUnion.members) {
      const nestedUnion = this.schema.unions.find(u => u.name === member.name);
      if (nestedUnion) {
        // This member is a union - add its concrete members
        for (const nestedMember of nestedUnion.members) {
          concreteMembers.push(nestedMember.name);
          nestedUnionWrappers.set(nestedMember.name, member.name);
        }
      } else {
        concreteMembers.push(member.name);
      }
    }

    for (const member of concreteMembers.sort()) {
      const nestedUnionName = nestedUnionWrappers.get(member);
      if (nestedUnionName) {
        const wrapperName = `${irUnion.name}${nestedUnionName}`;
        this.emit(`      case '${member}':`);
        this.emit(`        return ${wrapperName}(${nestedUnionName}.fromJson(json));`);
      } else {
        this.emit(`      case '${member}':`);
        this.emit(`        return ${member}.fromJson(json);`);
      }
    }

    this.emit('    }');
    this.emit(`    throw ArgumentError('Unknown __typename for ${irUnion.name}: \$typeName');`);
    this.emit('  }');

    // Generate interface getters if there are shared interfaces
    if (sharedInterfaces.length > 0) {
      this.emit('');
      for (const interfaceName of sharedInterfaces) {
        const iface = this.schema.interfaces.find(i => i.name === interfaceName);
        if (iface) {
          // Sort fields alphabetically
          const sortedFields = [...iface.fields].sort((a, b) => a.name.localeCompare(b.name));
          for (const field of sortedFields) {
            this.generateDocComment(field.description, '  ');
            const propertyType = this.getPropertyType(field.type);
            this.emit('  @override');
            this.emit(`  ${propertyType} get ${this.escapeKeyword(field.name)};`);
          }
        }
      }
    }

    this.emit('');
    this.emit('  Map<String, dynamic> toJson();');
    this.emit('}');
    this.emit('');

    // Generate wrapper classes for nested unions
    const nestedUnionNames = new Set(nestedUnionWrappers.values());
    for (const nestedUnionName of Array.from(nestedUnionNames).sort()) {
      const wrapperName = `${irUnion.name}${nestedUnionName}`;
      this.emit(`class ${wrapperName} extends ${irUnion.name} {`);
      this.emit(`  const ${wrapperName}(this.value);`);
      this.emit(`  final ${nestedUnionName} value;`);
      this.emit('');
      this.emit('  @override');
      this.emit('  Map<String, dynamic> toJson() => value.toJson();');
      this.emit('}');
      this.emit('');
    }
  }

  // ============================================================================
  // Operations
  // ============================================================================

  generateOperation(irOperation: IROperation): void {
    const interfaceName = `${irOperation.name}Resolver`;
    this.generateDocComment(irOperation.description ?? `GraphQL root ${irOperation.name.toLowerCase()} operations.`);
    this.emit(`abstract class ${interfaceName} {`);

    // Sort fields alphabetically and filter _placeholder
    const sortedFields = irOperation.fields
      .filter((f) => f.name !== '_placeholder')
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const field of sortedFields) {
      this.generateDocComment(field.description, '  ');
      const returnType = this.getOperationReturnType(field);

      if (field.args.length === 0) {
        this.emit(`  Future<${returnType}> ${this.escapeKeyword(field.name)}();`);
        continue;
      }

      // Check if we should expand params
      const expandableParams = ['params', 'options', 'config', 'props'];
      const expandableArg = field.args.find(arg => expandableParams.includes(arg.name));

      if (expandableArg && expandableArg.type.name) {
        const inputType = this.schema.inputs.find(i => i.name === expandableArg.type.name);
        if (inputType && inputType.name !== 'RequestPurchaseProps') {
          const otherArgs = field.args.filter(arg => arg !== expandableArg);
          this.emit(`  Future<${returnType}> ${this.escapeKeyword(field.name)}({`);

          // Sort expanded fields alphabetically
          const sortedInputFields = [...inputType.fields].sort((a, b) => a.name.localeCompare(b.name));
          for (const f of sortedInputFields) {
            const argType = this.getPropertyType(f.type);
            const prefix = f.type.nullable ? '' : 'required ';
            this.emit(`    ${prefix}${argType} ${this.escapeKeyword(f.name)},`);
          }

          for (const arg of otherArgs) {
            const argType = this.getPropertyType(arg.type);
            const prefix = arg.type.nullable ? '' : 'required ';
            this.emit(`    ${prefix}${argType} ${this.escapeKeyword(arg.name)},`);
          }

          this.emit('  });');
          continue;
        }
      }

      if (field.args.length === 1) {
        const arg = field.args[0];
        const argType = this.getPropertyType(arg.type);
        const argName = this.escapeKeyword(arg.name);
        if (arg.type.nullable) {
          this.emit(`  Future<${returnType}> ${this.escapeKeyword(field.name)}([${argType} ${argName}]);`);
        } else {
          this.emit(`  Future<${returnType}> ${this.escapeKeyword(field.name)}(${argType} ${argName});`);
        }
        continue;
      }

      this.emit(`  Future<${returnType}> ${this.escapeKeyword(field.name)}({`);
      for (const arg of field.args) {
        const argType = this.getPropertyType(arg.type);
        const prefix = arg.type.nullable ? '' : 'required ';
        this.emit(`    ${prefix}${argType} ${this.escapeKeyword(arg.name)},`);
      }
      this.emit('  });');
    }

    this.emit('}');
    this.emit('');
  }

  private generateOperationHelpers(irOperation: IROperation): void {
    const rootName = irOperation.name;

    this.emit(`// MARK: - ${rootName} Helpers`);
    this.emit('');

    // Sort fields alphabetically and filter _placeholder
    const sortedFields = irOperation.fields
      .filter((f) => f.name !== '_placeholder')
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const field of sortedFields) {
      const pascalField = toPascalCasePreserveIOS(field.name);
      const aliasName = `${rootName}${pascalField}Handler`;
      const returnType = this.getOperationReturnType(field);

      if (field.args.length === 0) {
        this.emit(`typedef ${aliasName} = Future<${returnType}> Function();`);
        continue;
      }

      // Check if we should expand params
      const expandableParams = ['params', 'options', 'config', 'props'];
      const expandableArg = field.args.find(arg => expandableParams.includes(arg.name));

      if (expandableArg && expandableArg.type.name) {
        const inputType = this.schema.inputs.find(i => i.name === expandableArg.type.name);
        if (inputType && inputType.name !== 'RequestPurchaseProps') {
          const otherArgs = field.args.filter(arg => arg !== expandableArg);
          this.emit(`typedef ${aliasName} = Future<${returnType}> Function({`);

          // Sort expanded fields alphabetically
          const sortedInputFields = [...inputType.fields].sort((a, b) => a.name.localeCompare(b.name));
          for (const f of sortedInputFields) {
            const argType = this.getPropertyType(f.type);
            const prefix = f.type.nullable ? '' : 'required ';
            this.emit(`  ${prefix}${argType} ${this.escapeKeyword(f.name)},`);
          }

          for (const arg of otherArgs) {
            const argType = this.getPropertyType(arg.type);
            const prefix = arg.type.nullable ? '' : 'required ';
            this.emit(`  ${prefix}${argType} ${this.escapeKeyword(arg.name)},`);
          }

          this.emit('});');
          continue;
        }
      }

      if (field.args.length === 1) {
        const arg = field.args[0];
        const argType = this.getPropertyType(arg.type);
        const argName = this.escapeKeyword(arg.name);
        if (arg.type.nullable) {
          this.emit(`typedef ${aliasName} = Future<${returnType}> Function([${argType} ${argName}]);`);
        } else {
          this.emit(`typedef ${aliasName} = Future<${returnType}> Function(${argType} ${argName});`);
        }
        continue;
      }

      this.emit(`typedef ${aliasName} = Future<${returnType}> Function({`);
      for (const arg of field.args) {
        const argType = this.getPropertyType(arg.type);
        const prefix = arg.type.nullable ? '' : 'required ';
        this.emit(`  ${prefix}${argType} ${this.escapeKeyword(arg.name)},`);
      }
      this.emit('});');
    }

    // Handler class
    const helperClass = `${rootName}Handlers`;
    this.emit('');
    this.emit(`class ${helperClass} {`);
    this.emit(`  const ${helperClass}({`);

    for (const field of sortedFields) {
      this.emit(`    this.${this.escapeKeyword(field.name)},`);
    }

    this.emit('  });');
    this.emit('');

    for (const field of sortedFields) {
      const pascalField = toPascalCasePreserveIOS(field.name);
      const aliasName = `${rootName}${pascalField}Handler`;
      this.emit(`  final ${aliasName}? ${this.escapeKeyword(field.name)};`);
    }

    this.emit('}');
    this.emit('');
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private getPropertyType(type: IRType): string {
    const baseType = this.mapType(type);
    return type.nullable ? `${baseType}?` : baseType;
  }

  private getOperationReturnType(field: IROperationField): string {
    // Handle VoidResult
    if (field.returnType.name === 'VoidResult') {
      return 'void'; // void cannot be nullable in Dart
    }

    // Handle single-field wrapper types (e.g., ProductsArgs -> List<Product>)
    if (field.returnType.name && field.returnType.name.endsWith('Args')) {
      const wrapperObj = this.schema.objects.find(o => o.name === field.returnType.name);
      if (wrapperObj && wrapperObj.fields.length === 1) {
        const innerType = this.getPropertyType(wrapperObj.fields[0].type);
        return field.returnType.nullable ? `${innerType}?` : innerType;
      }
    }

    return this.getPropertyType(field.returnType);
  }

  private buildFromJsonExpression(type: IRType, sourceExpr: string): string {
    if (type.kind === 'list') {
      const listCast = `(${sourceExpr} as List<dynamic>${type.nullable ? '?' : ''})`;
      const elementExpr = this.buildFromJsonExpression(type.elementType!, 'e');
      const mapCall = (target: string) => `${target}.map((e) => ${elementExpr}).toList()`;
      if (type.nullable) {
        return `${listCast} == null ? null : ${mapCall(`${listCast}!`)}`;
      }
      return mapCall(listCast);
    }

    if (type.kind === 'scalar') {
      switch (type.name) {
        case 'Float':
          return type.nullable
            ? `(${sourceExpr} as num?)?.toDouble()`
            : `(${sourceExpr} as num).toDouble()`;
        case 'Int':
          return type.nullable ? `${sourceExpr} as int?` : `${sourceExpr} as int`;
        case 'Boolean':
          return type.nullable ? `${sourceExpr} as bool?` : `${sourceExpr} as bool`;
        case 'ID':
        case 'String':
          return type.nullable ? `${sourceExpr} as String?` : `${sourceExpr} as String`;
        default:
          return sourceExpr;
      }
    }

    if (type.kind === 'enum') {
      return type.nullable
        ? `${sourceExpr} != null ? ${type.name}.fromJson(${sourceExpr} as String) : null`
        : `${type.name}.fromJson(${sourceExpr} as String)`;
    }

    if (['object', 'input', 'interface', 'union'].includes(type.kind)) {
      return type.nullable
        ? `${sourceExpr} != null ? ${type.name}.fromJson(${sourceExpr} as Map<String, dynamic>) : null`
        : `${type.name}.fromJson(${sourceExpr} as Map<String, dynamic>)`;
    }

    return sourceExpr;
  }

  private buildToJsonExpression(type: IRType, accessorExpr: string): string {
    if (type.kind === 'list') {
      const inner = this.buildToJsonExpression(type.elementType!, 'e');
      if (inner === 'e') return accessorExpr;
      if (type.nullable) {
        return `${accessorExpr} == null ? null : ${accessorExpr}!.map((e) => ${inner}).toList()`;
      }
      return `${accessorExpr}.map((e) => ${inner}).toList()`;
    }

    if (type.kind === 'enum') {
      return type.nullable ? `${accessorExpr}?.toJson()` : `${accessorExpr}.toJson()`;
    }

    if (['object', 'input', 'interface', 'union'].includes(type.kind)) {
      return type.nullable ? `${accessorExpr}?.toJson()` : `${accessorExpr}.toJson()`;
    }

    return accessorExpr;
  }
}
