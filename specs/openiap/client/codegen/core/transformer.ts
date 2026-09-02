/**
 * AST to IR Transformer
 *
 * Transforms a GraphQL schema into the language-agnostic Intermediate Representation (IR).
 */

import {
  GraphQLSchema,
  GraphQLList,
  GraphQLNonNull,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isScalarType,
  isUnionType,
  type GraphQLEnumType,
  type GraphQLInputObjectType,
  type GraphQLInterfaceType,
  type GraphQLObjectType,
  type GraphQLUnionType,
  type GraphQLType,
  valueFromASTUntyped,
} from 'graphql';
import type {
  IRSchema,
  IREnum,
  IREnumValue,
  IRInterface,
  IRObject,
  IRInput,
  IRUnion,
  IROperation,
  IRType,
  IRField,
  IRArg,
  IROperationField,
  IRResultUnionEntry,
  SchemaMarkers,
} from './types.js';
import { toKebabCase, PLATFORM_TYPE_DEFAULTS, SUPPORTED_GRAPHQL_SCALARS } from './utils.js';
import type { ParsedSchema } from './parser.js';
import { assertValidSchemaMarkers } from '../../schema-markers.mjs';
import { assertValidSchemaDeprecations } from '../../schema-deprecations.mjs';
import { CUSTOM_INPUT_CONTRACTS, GENERATOR_INPUT_CONTRACTS, type CustomInputKind } from '../../custom-input-contracts.js';

// ============================================================================
// Transformer
// ============================================================================

class SchemaTransformer {
  private schema: GraphQLSchema;
  private markers: SchemaMarkers;
  private typeMap: ReturnType<GraphQLSchema['getTypeMap']>;
  private typeNames: string[];
  private typeDeprecationReasons: Map<string, string>;

  // Computed metadata
  private enumNames = new Set<string>();
  private interfaceNames = new Set<string>();
  private objectNames = new Set<string>();
  private inputNames = new Set<string>();
  private unionNames = new Set<string>();
  private unionMembership = new Map<string, Set<string>>();
  private singleFieldObjects = new Map<string, IRType>();

  constructor(parsedSchema: ParsedSchema) {
    assertValidSchemaMarkers(parsedSchema.markers);
    assertValidSchemaDeprecations(parsedSchema.deprecations);
    this.schema = parsedSchema.schema;
    this.markers = parsedSchema.markers;
    this.typeDeprecationReasons = parsedSchema.deprecations.typeReasons;
    this.typeMap = this.schema.getTypeMap();
    this.typeNames = Object.keys(this.typeMap)
      .filter((name) => !name.startsWith('__'))
      .sort((a, b) => a.localeCompare(b));
  }

  private descriptionWithDeprecation(
    description: string | null | undefined,
    deprecationReason: string | null | undefined,
    label: string,
  ): string | undefined {
    const normalizedDescription = description?.trim() || undefined;
    if (deprecationReason == null) return normalizedDescription;
    const normalizedReason = deprecationReason.replace(/\s+/g, ' ').trim();
    if (!normalizedReason) {
      throw new Error(`${label} @deprecated reason must not be empty.`);
    }
    if (/(?:^|\n)\s*@deprecated\b/.test(normalizedDescription ?? '')) {
      throw new Error(`${label} duplicates @deprecated in its description; keep the canonical reason only in the GraphQL directive.`);
    }
    return [normalizedDescription, `@deprecated ${normalizedReason}`].filter(Boolean).join('\n');
  }

  /**
   * Transform the GraphQL schema to IR
   */
  transform(): IRSchema {
    this.assertValidUnionWrapperShapes();

    // First pass: categorize types and build name sets
    const categorized = this.categorizeTypes();
    this.assertPlatformTypeDefaultContracts(categorized.objects);

    // Build union membership map
    for (const unionType of categorized.unions) {
      for (const member of unionType.getTypes()) {
        if (!this.unionMembership.has(member.name)) {
          this.unionMembership.set(member.name, new Set());
        }
        this.unionMembership.get(member.name)!.add(unionType.name);
      }
    }

    // Identify single-field Args objects
    for (const objectType of categorized.objects) {
      const fields = Object.values(objectType.getFields());
      if (fields.length === 1 && objectType.name.endsWith('Args')) {
        this.singleFieldObjects.set(objectType.name, this.transformType(fields[0].type));
      }
    }

    // Transform each category
    const enums = categorized.enums.map((e) => this.transformEnum(e));
    const interfaces = categorized.interfaces.map((i) => this.transformInterface(i));
    const objects = categorized.objects.map((o) => this.transformObject(o));
    const inputs = categorized.inputs.map((i) => this.transformInput(i));
    this.assertCustomInputContracts(inputs);
    const unions = categorized.unions.map((u) => this.transformUnion(u));
    const operations = categorized.operations.map((o) => this.transformOperation(o));

    return {
      enums: enums.sort((a, b) => a.name.localeCompare(b.name)),
      interfaces: interfaces.sort((a, b) => a.name.localeCompare(b.name)),
      objects: objects.sort((a, b) => a.name.localeCompare(b.name)),
      inputs: inputs.sort((a, b) => a.name.localeCompare(b.name)),
      unions: unions.sort((a, b) => a.name.localeCompare(b.name)),
      operations: operations.sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  private assertValidUnionWrapperShapes(): void {
    for (const typeName of this.markers.unionWrappers) {
      if (['Query', 'Mutation', 'Subscription'].includes(typeName)) {
        throw new Error(`${typeName} cannot use # => Union because operation root types cannot be union wrappers.`);
      }

      const type = this.typeMap[typeName];
      if (!type || !isObjectType(type)) {
        throw new Error(`${typeName} # => Union marker must resolve to exactly one object type.`);
      }

      const fields = Object.values(type.getFields());
      if (fields.length === 0) {
        throw new Error(`${typeName} # => Union wrapper must declare at least one nullable result field.`);
      }

      const requiredFields = fields.filter((field) => field.type instanceof GraphQLNonNull).map((field) => field.name);
      if (requiredFields.length > 0) {
        throw new Error(`${typeName} # => Union wrapper fields must all be nullable; required: ${requiredFields.join(', ')}.`);
      }
    }
  }

  private assertCustomInputContracts(inputs: IRInput[]): void {
    const typeSignature = (type: IRType): string =>
      [
        type.kind,
        type.name ?? '',
        type.nullable ? 'nullable' : 'required',
        type.elementType ? `[${typeSignature(type.elementType)}]` : '',
      ].join(':');

    for (const [inputName, expectedFields] of Object.entries(GENERATOR_INPUT_CONTRACTS)) {
      const input = inputs.find((candidate) => candidate.name === inputName);
      if (!input) continue;

      const actualNames = input.fields.map((field) => field.name);
      const expectedNames = expectedFields.map((field) => field.name);
      if (actualNames.length !== expectedNames.length || actualNames.some((name, index) => name !== expectedNames[index])) {
        throw new Error(
          `${inputName} custom input contract fields drifted; expected ${expectedNames.join(', ')}, found ${actualNames.join(', ')}.`,
        );
      }

      for (const [index, expected] of expectedFields.entries()) {
        const actual = input.fields[index];
        const expectedType = typeSignature(expected.type as IRType);
        const actualType = typeSignature(actual.type);
        if (actualType !== expectedType || !Object.is(actual.defaultValue, expected.defaultValue)) {
          throw new Error(
            `${inputName}.${expected.name} custom input contract drifted; expected ${expectedType} default ${String(expected.defaultValue)}, found ${actualType} default ${String(actual.defaultValue)}.`,
          );
        }
      }
    }
  }

  // ============================================================================
  // Type Categorization
  // ============================================================================

  private categorizeTypes(): {
    enums: GraphQLEnumType[];
    interfaces: GraphQLInterfaceType[];
    objects: GraphQLObjectType[];
    inputs: GraphQLInputObjectType[];
    unions: GraphQLUnionType[];
    operations: GraphQLObjectType[];
  } {
    const enums: GraphQLEnumType[] = [];
    const interfaces: GraphQLInterfaceType[] = [];
    const objects: GraphQLObjectType[] = [];
    const inputs: GraphQLInputObjectType[] = [];
    const unions: GraphQLUnionType[] = [];
    const operations: GraphQLObjectType[] = [];

    for (const name of this.typeNames) {
      const type = this.typeMap[name];

      if (isScalarType(type)) {
        this.assertSupportedScalar(type.name);
        continue;
      }
      if (isEnumType(type)) {
        enums.push(type);
        this.enumNames.add(type.name);
        continue;
      }
      if (isInterfaceType(type)) {
        interfaces.push(type);
        this.interfaceNames.add(type.name);
        continue;
      }
      if (isUnionType(type)) {
        unions.push(type);
        this.unionNames.add(type.name);
        continue;
      }
      if (isObjectType(type)) {
        if (['Query', 'Mutation', 'Subscription'].includes(name)) {
          operations.push(type);
        } else {
          objects.push(type);
          this.objectNames.add(type.name);
        }
        continue;
      }
      if (isInputObjectType(type)) {
        inputs.push(type);
        this.inputNames.add(type.name);
      }
    }

    return { enums, interfaces, objects, inputs, unions, operations };
  }

  private assertSupportedScalar(typeName: string): void {
    if (!SUPPORTED_GRAPHQL_SCALARS.has(typeName)) {
      throw new Error(`Unsupported GraphQL scalar ${typeName}; add an explicit cross-language mapping before using it.`);
    }
  }

  private assertPlatformTypeDefaultContracts(objects: GraphQLObjectType[]): void {
    const productCommon = this.typeMap.ProductCommon;
    if (!productCommon) return;
    if (!isInterfaceType(productCommon)) {
      throw new Error('ProductCommon platform-default contract must remain a GraphQL interface.');
    }

    const implementors = objects
      .filter((objectType) => objectType.getInterfaces().some((interfaceType) => interfaceType.name === 'ProductCommon'))
      .map((objectType) => objectType.name)
      .sort();
    const configured = Object.keys(PLATFORM_TYPE_DEFAULTS).sort();
    if (implementors.length !== configured.length || implementors.some((typeName, index) => typeName !== configured[index])) {
      throw new Error(
        `ProductCommon platform-default coverage drifted; implementors: ${implementors.join(', ') || '<none>'}; configured: ${configured.join(', ') || '<none>'}.`,
      );
    }

    const fieldContracts = {
      platform: { enumName: 'IapPlatform' },
      type: { enumName: 'ProductType' },
    } as const;
    const rawValues = new Map<string, Set<string>>();
    for (const { enumName } of Object.values(fieldContracts)) {
      const enumeration = this.typeMap[enumName];
      if (!enumeration || !isEnumType(enumeration)) {
        throw new Error(`ProductCommon platform-default contract requires enum ${enumName}.`);
      }
      rawValues.set(enumName, new Set(enumeration.getValues().map((value) => toKebabCase(value.name))));
    }

    const assertFieldShape = (owner: GraphQLInterfaceType | GraphQLObjectType, fieldName: keyof typeof fieldContracts) => {
      const field = owner.getFields()[fieldName];
      const { enumName } = fieldContracts[fieldName];
      const namedType = field?.type instanceof GraphQLNonNull ? field.type.ofType : null;
      if (!namedType || !isEnumType(namedType) || namedType.name !== enumName) {
        throw new Error(`${owner.name}.${fieldName} platform-default contract must remain non-null ${enumName}.`);
      }
    };

    assertFieldShape(productCommon, 'platform');
    assertFieldShape(productCommon, 'type');
    for (const typeName of implementors) {
      const objectType = this.typeMap[typeName];
      if (!objectType || !isObjectType(objectType)) {
        throw new Error(`${typeName} platform-default contract must resolve to an object type.`);
      }
      const defaults = PLATFORM_TYPE_DEFAULTS[typeName];
      for (const fieldName of Object.keys(fieldContracts) as (keyof typeof fieldContracts)[]) {
        assertFieldShape(objectType, fieldName);
        const { enumName } = fieldContracts[fieldName];
        const rawValue = defaults[fieldName];
        if (!rawValues.get(enumName)?.has(rawValue)) {
          throw new Error(`${typeName}.${fieldName} platform default "${rawValue}" is not a ${enumName} wire value.`);
        }
      }
    }
  }

  // ============================================================================
  // Type Transformation
  // ============================================================================

  private transformType(graphqlType: GraphQLType): IRType {
    if (graphqlType instanceof GraphQLNonNull) {
      const inner = this.transformType(graphqlType.ofType);
      return { ...inner, nullable: false };
    }
    if (graphqlType instanceof GraphQLList) {
      const elementType = this.transformType(graphqlType.ofType);
      return {
        kind: 'list',
        nullable: true,
        elementType,
      };
    }

    // Named type
    const typeName = (graphqlType as { name: string }).name;
    let kind: IRType['kind'] = 'object';

    if (this.enumNames.has(typeName)) {
      kind = 'enum';
    } else if (this.interfaceNames.has(typeName)) {
      kind = 'interface';
    } else if (this.inputNames.has(typeName)) {
      kind = 'input';
    } else if (this.unionNames.has(typeName)) {
      kind = 'union';
    } else if (this.objectNames.has(typeName)) {
      kind = 'object';
    } else {
      // Scalar
      this.assertSupportedScalar(typeName);
      kind = 'scalar';
    }

    return {
      kind,
      name: typeName,
      nullable: true,
    };
  }

  // ============================================================================
  // Enum Transformation
  // ============================================================================

  private transformEnum(enumType: GraphQLEnumType): IREnum {
    const values: IREnumValue[] = enumType.getValues().map((value) => {
      const rawValue = toKebabCase(value.name);
      // For Swift compatibility: only use PascalCase name as legacy alias (no CONSTANT_CASE)
      // The enum case matching in Swift uses: kebab-case + PascalCase
      const legacyAliases: string[] = [];

      return {
        name: value.name,
        rawValue,
        description: this.descriptionWithDeprecation(value.description, value.deprecationReason, `${enumType.name}.${value.name}`),
        legacyAliases: [...new Set(legacyAliases)],
      };
    });
    const rawValueOwners = new Map<string, string>();
    for (const value of values) {
      const previousOwner = rawValueOwners.get(value.rawValue);
      if (previousOwner) {
        throw new Error(`${enumType.name} enum values ${previousOwner} and ${value.name} both serialize as "${value.rawValue}".`);
      }
      rawValueOwners.set(value.rawValue, value.name);
    }

    return {
      name: enumType.name,
      description: this.descriptionWithDeprecation(enumType.description, this.typeDeprecationReasons.get(enumType.name), enumType.name),
      values,
      isErrorCode: enumType.name === 'ErrorCode',
    };
  }

  // ============================================================================
  // Interface Transformation
  // ============================================================================

  private transformInterface(interfaceType: GraphQLInterfaceType): IRInterface {
    // Preserve schema field order - individual plugins can sort if needed
    const graphqlFields = Object.values(interfaceType.getFields());

    const fields: IRField[] = graphqlFields.map((field) => ({
      name: field.name,
      description: this.descriptionWithDeprecation(field.description, field.deprecationReason, `${interfaceType.name}.${field.name}`),
      type: this.transformType(field.type),
      isOverride: false,
    }));

    return {
      name: interfaceType.name,
      description: this.descriptionWithDeprecation(
        interfaceType.description,
        this.typeDeprecationReasons.get(interfaceType.name),
        interfaceType.name,
      ),
      fields,
    };
  }

  // ============================================================================
  // Object Transformation
  // ============================================================================

  private transformObject(objectType: GraphQLObjectType): IRObject {
    const interfacesForObject = objectType.getInterfaces().map((i) => i.name);
    const unionsForObject = this.unionMembership.get(objectType.name) ? [...this.unionMembership.get(objectType.name)!] : [];

    // Collect interface fields once for override detection and canonical
    // deprecation projection. The interface owns the reason, while GraphQL
    // requires each concrete field to repeat that exact directive so
    // introspection and concrete-type consumers retain the metadata.
    const interfaceFieldsByName = new Map<string, Array<{ interfaceName: string; deprecationReason?: string }>>();
    for (const iface of objectType.getInterfaces()) {
      for (const [fieldName, field] of Object.entries(iface.getFields())) {
        interfaceFieldsByName.set(fieldName, [
          ...(interfaceFieldsByName.get(fieldName) ?? []),
          {
            interfaceName: iface.name,
            deprecationReason: field.deprecationReason ?? undefined,
          },
        ]);
      }
    }

    // Preserve schema field order - individual plugins can sort if needed
    const graphqlFields = Object.values(objectType.getFields());

    const fields: IRField[] = graphqlFields.map((field) => {
      const interfaceFields = interfaceFieldsByName.get(field.name) ?? [];
      const inheritedReasons = [
        ...new Set(interfaceFields.map((candidate) => candidate.deprecationReason).filter((reason): reason is string => Boolean(reason))),
      ];
      if (inheritedReasons.length > 1) {
        throw new Error(
          `${objectType.name}.${field.name} inherits conflicting deprecation reasons from ${interfaceFields.map((candidate) => candidate.interfaceName).join(', ')}.`,
        );
      }
      const inheritedReason = inheritedReasons[0];
      if (inheritedReason && field.deprecationReason !== inheritedReason) {
        const relation = field.deprecationReason ? 'conflicts with' : 'must repeat';
        throw new Error(
          `${objectType.name}.${field.name} ${relation} the exact interface-owned deprecation guidance for concrete GraphQL introspection.`,
        );
      }

      const irField: IRField = {
        name: field.name,
        description: this.descriptionWithDeprecation(
          field.description,
          field.deprecationReason ?? inheritedReason,
          `${objectType.name}.${field.name}`,
        ),
        type: this.transformType(field.type),
        isOverride: interfaceFields.length > 0,
      };

      // Add platform defaults for discriminated union types
      const defaults = PLATFORM_TYPE_DEFAULTS[objectType.name];
      if (defaults) {
        if (field.name === 'platform') {
          irField.defaultValue = defaults.platform;
        } else if (field.name === 'type') {
          irField.defaultValue = defaults.type;
        }
      }

      return irField;
    });

    // Check if this is a result union wrapper
    const isResultUnion = this.markers.unionWrappers.has(objectType.name);
    let resultUnionEntries: IRResultUnionEntry[] | undefined;

    if (isResultUnion) {
      resultUnionEntries = fields.map((field) => ({
        fieldName: field.name,
        description: field.description,
        type: field.type,
      }));
    }

    return {
      name: objectType.name,
      description: this.descriptionWithDeprecation(
        objectType.description,
        this.typeDeprecationReasons.get(objectType.name),
        objectType.name,
      ),
      fields,
      interfaces: interfacesForObject,
      unions: unionsForObject,
      isResultUnion,
      resultUnionEntries,
    };
  }

  // ============================================================================
  // Input Transformation
  // ============================================================================

  private transformInput(inputType: GraphQLInputObjectType): IRInput {
    // Preserve schema field order - individual plugins can sort if needed
    const graphqlFields = Object.values(inputType.getFields());

    const fields: IRField[] = graphqlFields.map((field) => ({
      name: field.name,
      description: this.descriptionWithDeprecation(field.description, field.deprecationReason, `${inputType.name}.${field.name}`),
      type: this.transformType(field.type),
      isOverride: false,
      defaultValue: field.astNode?.defaultValue ? valueFromASTUntyped(field.astNode.defaultValue) : undefined,
    }));

    const hasRequiredFields = graphqlFields.some((field) => field.type instanceof GraphQLNonNull);

    const isCustomType = Object.hasOwn(CUSTOM_INPUT_CONTRACTS, inputType.name);
    const customTypeKind = isCustomType ? (inputType.name as CustomInputKind) : undefined;

    return {
      name: inputType.name,
      description: this.descriptionWithDeprecation(inputType.description, this.typeDeprecationReasons.get(inputType.name), inputType.name),
      fields,
      hasRequiredFields,
      isCustomType,
      customTypeKind,
    };
  }

  // ============================================================================
  // Union Transformation
  // ============================================================================

  private transformUnion(unionType: GraphQLUnionType): IRUnion {
    const memberTypes = unionType.getTypes();

    // Find shared interfaces across all members
    let sharedInterfaceNames: string[] = [];
    if (memberTypes.length > 0) {
      const [firstMember, ...otherMembers] = memberTypes;
      if (typeof (firstMember as GraphQLObjectType).getInterfaces === 'function') {
        const firstInterfaces = new Set((firstMember as GraphQLObjectType).getInterfaces().map((i) => i.name));
        let allMembersHaveInterfaces = true;

        for (const member of otherMembers) {
          if (typeof (member as GraphQLObjectType).getInterfaces === 'function') {
            const memberInterfaces = new Set((member as GraphQLObjectType).getInterfaces().map((i) => i.name));
            for (const ifaceName of [...firstInterfaces]) {
              if (!memberInterfaces.has(ifaceName)) {
                firstInterfaces.delete(ifaceName);
              }
            }
          } else {
            allMembersHaveInterfaces = false;
            break;
          }
        }

        if (allMembersHaveInterfaces) {
          sharedInterfaceNames = [...firstInterfaces].sort();
        }
      }
    }

    // Keep original schema order for union members (don't sort alphabetically)
    const members = memberTypes.map((member) => ({
      name: member.name,
      isNestedUnion: isUnionType(member),
    }));

    return {
      name: unionType.name,
      description: this.descriptionWithDeprecation(unionType.description, this.typeDeprecationReasons.get(unionType.name), unionType.name),
      members, // Preserve schema order
      sharedInterfaces: sharedInterfaceNames,
    };
  }

  // ============================================================================
  // Operation Transformation
  // ============================================================================

  private transformOperation(operationType: GraphQLObjectType): IROperation {
    const kind = operationType.name as 'Query' | 'Mutation' | 'Subscription';

    // Preserve schema field order - individual plugins can sort and filter as needed
    const graphqlFields = Object.values(operationType.getFields());

    const fields: IROperationField[] = graphqlFields.map((field) => {
      const args: IRArg[] = field.args.map((arg) => ({
        name: arg.name,
        description: this.descriptionWithDeprecation(
          arg.description,
          arg.deprecationReason,
          `${operationType.name}.${field.name}(${arg.name})`,
        ),
        type: this.transformType(arg.type),
      }));

      const returnType = this.transformType(field.type);
      // Resolve return type (VoidResult -> Void, single-field Args inlining)
      const resolvedReturnType = this.resolveOperationReturnType(field.type);

      return {
        name: field.name,
        description: this.descriptionWithDeprecation(field.description, field.deprecationReason, `${operationType.name}.${field.name}`),
        args,
        returnType,
        resolvedReturnType,
      };
    });

    return {
      kind,
      name: operationType.name,
      description: this.descriptionWithDeprecation(
        operationType.description,
        this.typeDeprecationReasons.get(operationType.name),
        operationType.name,
      ),
      fields,
    };
  }

  private resolveOperationReturnType(graphqlType: GraphQLType): IRType {
    const baseType = this.transformType(graphqlType);

    // Handle list types as-is
    if (baseType.kind === 'list') {
      return baseType;
    }

    // Check for VoidResult
    const namedType = this.unwrapNonNull(graphqlType);
    if (namedType && (namedType as { name: string }).name === 'VoidResult') {
      return {
        kind: 'scalar',
        name: 'Void',
        nullable: !(graphqlType instanceof GraphQLNonNull),
      };
    }

    // Check for single-field Args types
    if (namedType) {
      const typeName = (namedType as { name: string }).name;
      const singleFieldType = this.singleFieldObjects.get(typeName);
      if (singleFieldType) {
        return {
          ...singleFieldType,
          nullable: baseType.nullable || singleFieldType.nullable,
        };
      }
    }

    return baseType;
  }

  private unwrapNonNull(graphqlType: GraphQLType): GraphQLType | null {
    let current = graphqlType;
    while (current instanceof GraphQLNonNull) {
      current = current.ofType;
    }
    if (current instanceof GraphQLList) {
      return null;
    }
    return current;
  }
}

// ============================================================================
// Convenience Function
// ============================================================================

export function transformSchema(parsedSchema: ParsedSchema): IRSchema {
  const transformer = new SchemaTransformer(parsedSchema);
  return transformer.transform();
}
