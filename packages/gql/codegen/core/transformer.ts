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
  type GraphQLField,
  type GraphQLInputField,
  type GraphQLArgument,
} from 'graphql';
import type {
  IRSchema,
  IRSchemaMetadata,
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
  IRPlatformDefault,
  SchemaMarkers,
} from './types.js';
import {
  toKebabCase,
  toConstantCase,
  CUSTOM_INPUT_TYPES,
  PLATFORM_TYPE_DEFAULTS,
  ERROR_CODE_LEGACY_ALIASES,
} from './utils.js';
import type { ParsedSchema } from './parser.js';

// ============================================================================
// Transformer
// ============================================================================

export class SchemaTransformer {
  private schema: GraphQLSchema;
  private markers: SchemaMarkers;
  private typeMap: ReturnType<GraphQLSchema['getTypeMap']>;
  private typeNames: string[];

  // Computed metadata
  private enumNames = new Set<string>();
  private interfaceNames = new Set<string>();
  private objectNames = new Set<string>();
  private inputNames = new Set<string>();
  private unionNames = new Set<string>();
  private unionMembership = new Map<string, Set<string>>();
  private singleFieldObjects = new Map<string, IRType>();
  private inputsWithRequiredFields = new Set<string>();

  constructor(parsedSchema: ParsedSchema) {
    this.schema = parsedSchema.schema;
    this.markers = parsedSchema.markers;
    this.typeMap = this.schema.getTypeMap();
    this.typeNames = Object.keys(this.typeMap)
      .filter((name) => !name.startsWith('__'))
      .sort((a, b) => a.localeCompare(b));
  }

  /**
   * Transform the GraphQL schema to IR
   */
  transform(): IRSchema {
    // First pass: categorize types and build name sets
    const categorized = this.categorizeTypes();

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

    // Identify inputs with required fields
    for (const inputType of categorized.inputs) {
      const fields = Object.values(inputType.getFields());
      const hasRequired = fields.some((field) => field.type instanceof GraphQLNonNull);
      if (hasRequired) {
        this.inputsWithRequiredFields.add(inputType.name);
      }
    }

    // Transform each category
    const enums = categorized.enums.map((e) => this.transformEnum(e));
    const interfaces = categorized.interfaces.map((i) => this.transformInterface(i));
    const objects = categorized.objects.map((o) => this.transformObject(o));
    const inputs = categorized.inputs.map((i) => this.transformInput(i));
    const unions = categorized.unions.map((u) => this.transformUnion(u));
    const operations = categorized.operations.map((o) => this.transformOperation(o));

    // Build metadata
    const metadata = this.buildMetadata();

    return {
      enums: enums.sort((a, b) => a.name.localeCompare(b.name)),
      interfaces: interfaces.sort((a, b) => a.name.localeCompare(b.name)),
      objects: objects.sort((a, b) => a.name.localeCompare(b.name)),
      inputs: inputs.sort((a, b) => a.name.localeCompare(b.name)),
      unions: unions.sort((a, b) => a.name.localeCompare(b.name)),
      operations: operations.sort((a, b) => a.name.localeCompare(b.name)),
      metadata,
    };
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

      // Add special legacy aliases for ErrorCode
      // receipt-failed -> purchaseVerificationFailed
      if (enumType.name === 'ErrorCode') {
        const caseNameLower = value.name.charAt(0).toLowerCase() + value.name.slice(1);
        const extraAliases = Object.entries(ERROR_CODE_LEGACY_ALIASES)
          .filter(([_, target]) => target === caseNameLower)
          .map(([alias]) => alias);
        legacyAliases.push(...extraAliases);
      }

      return {
        name: value.name,
        rawValue,
        description: value.description ?? undefined,
        legacyAliases: [...new Set(legacyAliases)],
      };
    });

    return {
      name: enumType.name,
      description: enumType.description ?? undefined,
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
      description: field.description ?? undefined,
      type: this.transformType(field.type),
      isOverride: false,
    }));

    return {
      name: interfaceType.name,
      description: interfaceType.description ?? undefined,
      fields,
    };
  }

  // ============================================================================
  // Object Transformation
  // ============================================================================

  private transformObject(objectType: GraphQLObjectType): IRObject {
    const interfacesForObject = objectType.getInterfaces().map((i) => i.name);
    const unionsForObject = this.unionMembership.get(objectType.name)
      ? [...this.unionMembership.get(objectType.name)!]
      : [];

    // Collect interface fields for override detection
    const interfaceFieldNames = new Set<string>();
    for (const iface of objectType.getInterfaces()) {
      for (const fieldName of Object.keys(iface.getFields())) {
        interfaceFieldNames.add(fieldName);
      }
    }

    // Preserve schema field order - individual plugins can sort if needed
    const graphqlFields = Object.values(objectType.getFields());

    const fields: IRField[] = graphqlFields.map((field) => {
      const irField: IRField = {
        name: field.name,
        description: field.description ?? undefined,
        type: this.transformType(field.type),
        isOverride: interfaceFieldNames.has(field.name),
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
      const allOptional = graphqlFields.every(
        (field) => !(field.type instanceof GraphQLNonNull)
      );
      if (allOptional && graphqlFields.length > 0) {
        resultUnionEntries = graphqlFields.map((field) => ({
          fieldName: field.name,
          type: this.transformType(field.type),
        }));
      }
    }

    // Check if single-field Args type
    const isSingleFieldArgs =
      graphqlFields.length === 1 && objectType.name.endsWith('Args');
    const singleFieldType = isSingleFieldArgs
      ? this.transformType(graphqlFields[0].type)
      : undefined;

    return {
      name: objectType.name,
      description: objectType.description ?? undefined,
      fields,
      interfaces: interfacesForObject,
      unions: unionsForObject,
      isResultUnion: isResultUnion && !!resultUnionEntries,
      resultUnionEntries,
      isSingleFieldArgs,
      singleFieldType,
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
      description: field.description ?? undefined,
      type: this.transformType(field.type),
      isOverride: false,
    }));

    const hasRequiredFields = graphqlFields.some(
      (field) => field.type instanceof GraphQLNonNull
    );

    const isCustomType = CUSTOM_INPUT_TYPES.has(inputType.name);
    let customTypeKind: IRInput['customTypeKind'];
    if (inputType.name === 'RequestPurchaseProps') {
      customTypeKind = 'RequestPurchaseProps';
    } else if (inputType.name === 'DiscountOfferInputIOS') {
      customTypeKind = 'DiscountOfferInputIOS';
    } else if (inputType.name === 'PurchaseInput') {
      customTypeKind = 'PurchaseInput';
    }

    return {
      name: inputType.name,
      description: inputType.description ?? undefined,
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
        const firstInterfaces = new Set(
          (firstMember as GraphQLObjectType).getInterfaces().map((i) => i.name)
        );
        let allMembersHaveInterfaces = true;

        for (const member of otherMembers) {
          if (typeof (member as GraphQLObjectType).getInterfaces === 'function') {
            const memberInterfaces = new Set(
              (member as GraphQLObjectType).getInterfaces().map((i) => i.name)
            );
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
      description: unionType.description ?? undefined,
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
        description: arg.description ?? undefined,
        type: this.transformType(arg.type),
      }));

      const returnType = this.transformType(field.type);
      const isFuture = this.markers.futureFields.has(
        `${operationType.name}.${field.name}`
      );

      // Resolve return type (VoidResult -> Void, single-field Args inlining)
      const resolvedReturnType = this.resolveOperationReturnType(field.type);

      return {
        name: field.name,
        description: field.description ?? undefined,
        args,
        returnType,
        isFuture,
        resolvedReturnType,
      };
    });

    return {
      kind,
      name: operationType.name,
      description: operationType.description ?? undefined,
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

  // ============================================================================
  // Metadata
  // ============================================================================

  private buildMetadata(): IRSchemaMetadata {
    const platformDefaults = new Map<string, IRPlatformDefault>();
    for (const [typeName, defaults] of Object.entries(PLATFORM_TYPE_DEFAULTS)) {
      platformDefaults.set(typeName, defaults);
    }

    return {
      unionWrapperNames: this.markers.unionWrappers,
      futureFieldNames: this.markers.futureFields,
      platformDefaults,
      singleFieldObjects: this.singleFieldObjects,
      unionMembership: this.unionMembership,
      inputsWithRequiredFields: this.inputsWithRequiredFields,
    };
  }
}

// ============================================================================
// Convenience Function
// ============================================================================

export function transformSchema(parsedSchema: ParsedSchema): IRSchema {
  const transformer = new SchemaTransformer(parsedSchema);
  return transformer.transform();
}
