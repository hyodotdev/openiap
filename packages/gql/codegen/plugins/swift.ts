/**
 * Swift Code Generation Plugin
 *
 * Generates Swift types with Codable conformance from GraphQL schema.
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
  SWIFT_KEYWORDS,
  GRAPHQL_TO_SWIFT,
  toLowerCamelCase,
  toKebabCase,
  capitalize,
  PLATFORM_TYPE_DEFAULTS,
  ERROR_CODE_LEGACY_ALIASES,
} from '../core/utils.js';

export class SwiftPlugin extends CodegenPlugin {
  readonly name = 'swift';
  readonly fileExtension = '.swift';
  readonly keywords = SWIFT_KEYWORDS;

  private schema!: IRSchema;

  constructor(config: CodegenPluginConfig) {
    super(config);
  }

  // ============================================================================
  // Type Mapping
  // ============================================================================

  mapScalar(name: string): string {
    return GRAPHQL_TO_SWIFT[name] ?? 'String';
  }

  mapType(type: IRType): string {
    if (type.kind === 'list') {
      const elementType = this.mapType(type.elementType!);
      const element = type.elementType!.nullable ? `${elementType}?` : elementType;
      return `[${element}]`;
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
    return toLowerCamelCase(name);
  }

  fieldNameCase(name: string): string {
    return name; // Swift uses camelCase which matches GraphQL field names
  }

  // ============================================================================
  // Code Generation
  // ============================================================================

  generateHeader(): void {
    this.emit('// ============================================================================');
    this.emit('// AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY');
    this.emit('// Run `bun run generate` after updating any *.graphql schema file.');
    this.emit('// ============================================================================');
    this.emit('');
    this.emit('import Foundation');
    this.emit('');
  }

  // ============================================================================
  // Enums
  // ============================================================================

  generateEnum(irEnum: IREnum): void {
    this.generateDocComment(irEnum.description);
    this.emit(`public enum ${irEnum.name}: String, Codable, CaseIterable {`);

    for (const value of irEnum.values) {
      this.generateDocComment(value.description, '    ');
      const caseName = this.escapeKeyword(this.enumValueCase(value.name));
      this.emit(`    case ${caseName} = "${value.rawValue}"`);
    }

    // Add custom initializer for ErrorCode to handle legacy aliases
    if (irEnum.isErrorCode) {
      // Legacy aliases: old error codes that map to new ones
      const legacyAliases: Record<string, string> = {
        'receipt-failed': 'purchaseVerificationFailed',
        'ReceiptFailed': 'purchaseVerificationFailed',
      };

      this.emit('');
      this.emit('    /// Custom initializer to handle both kebab-case and camelCase error codes');
      this.emit('    /// This ensures compatibility with react-native-iap and other libraries that may send camelCase');
      this.emit('    public init?(rawValue: String) {');
      this.emit('        // Try direct match first (kebab-case)');
      this.emit('        switch rawValue {');

      for (const value of irEnum.values) {
        const caseName = this.escapeKeyword(this.enumValueCase(value.name));
        const rawValue = value.rawValue;
        const camelCaseName = value.name.charAt(0).toUpperCase() + value.name.slice(1);

        // Check if this case is a legacy alias that should map to another case
        const aliasTarget = legacyAliases[rawValue] || legacyAliases[camelCaseName];

        if (aliasTarget && aliasTarget === caseName) {
          // This case IS the target - just use normal handling
          this.emit(`        case "${rawValue}", "${camelCaseName}":`);
          this.emit(`            self = .${caseName}`);
        } else if (aliasTarget) {
          // This is a legacy alias - map to the new case
          this.emit(`        case "${rawValue}", "${camelCaseName}":`);
          this.emit(`            self = .${aliasTarget} // Legacy alias`);
        } else {
          // Normal case
          this.emit(`        case "${rawValue}", "${camelCaseName}":`);
          this.emit(`            self = .${caseName}`);
        }
      }

      this.emit('        default:');
      this.emit('            return nil');
      this.emit('        }');
      this.emit('    }');
    }

    this.emit('}');
    this.emit('');
  }

  // ============================================================================
  // Interfaces (Protocols)
  // ============================================================================

  generateInterface(irInterface: IRInterface): void {
    this.generateDocComment(irInterface.description);
    this.emit(`public protocol ${irInterface.name}: Codable {`);

    // Sort fields alphabetically for Swift
    const sortedFields = [...irInterface.fields].sort((a, b) => a.name.localeCompare(b.name));
    for (const field of sortedFields) {
      this.generateDocComment(field.description, '    ');
      const propertyType = this.getPropertyType(field.type);
      const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
      this.emit(`    var ${propertyName}: ${propertyType} { get }`);
    }

    this.emit('}');
    this.emit('');
  }

  // ============================================================================
  // Objects (Structs)
  // ============================================================================

  generateObject(irObject: IRObject): void {
    // Handle VoidResult
    if (irObject.name === 'VoidResult') {
      this.emit('public typealias VoidResult = Void');
      this.emit('');
      return;
    }

    // Handle result union wrappers
    if (irObject.isResultUnion && irObject.resultUnionEntries) {
      this.generateResultUnionObject(irObject);
      return;
    }

    this.generateDocComment(irObject.description);
    const conformances = ['Codable', ...irObject.interfaces];
    this.emit(`public struct ${irObject.name}: ${conformances.join(', ')} {`);

    // Sort fields alphabetically for Swift
    const sortedFields = [...irObject.fields].sort((a, b) => a.name.localeCompare(b.name));

    // Properties
    for (const field of sortedFields) {
      this.generateDocComment(field.description, '    ');
      const propertyType = this.getPropertyType(field.type);
      const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));

      // Handle platform defaults
      const defaults = PLATFORM_TYPE_DEFAULTS[irObject.name];
      let defaultValue = '';
      if (defaults && field.name === 'platform') {
        defaultValue = ` = .${defaults.platform}`;
      } else if (defaults && field.name === 'type') {
        defaultValue = ` = .${defaults.type === 'in-app' ? 'inApp' : 'subs'}`;
      }

      this.emit(`    public var ${propertyName}: ${propertyType}${defaultValue}`);
    }

    // Generate initializer if there are no fields
    if (sortedFields.length === 0) {
      this.emit('    public init() {}');
    }

    this.emit('}');
    this.emit('');
  }

  private generateResultUnionObject(irObject: IRObject): void {
    this.generateDocComment(irObject.description);
    this.emit(`public enum ${irObject.name} {`);

    // Sort entries alphabetically
    const sortedEntries = [...irObject.resultUnionEntries!].sort((a, b) =>
      a.fieldName.localeCompare(b.fieldName)
    );
    for (const entry of sortedEntries) {
      const caseName = this.escapeKeyword(this.enumValueCase(entry.fieldName));
      const payloadType = this.getPropertyType(entry.type);
      this.emit(`    case ${caseName}(${payloadType})`);
    }

    this.emit('}');
    this.emit('');
  }

  // ============================================================================
  // Inputs (Structs)
  // ============================================================================

  generateInput(irInput: IRInput): void {
    // Handle custom types
    if (irInput.isCustomType) {
      this.generateCustomInput(irInput);
      return;
    }

    this.generateDocComment(irInput.description);
    this.emit(`public struct ${irInput.name}: Codable {`);

    // Sort fields alphabetically for Swift
    const sortedFields = [...irInput.fields].sort((a, b) => a.name.localeCompare(b.name));

    // Properties
    for (const field of sortedFields) {
      this.generateDocComment(field.description, '    ');
      const propertyType = this.getPropertyType(field.type);
      const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
      this.emit(`    public var ${propertyName}: ${propertyType}`);
    }

    // Generate public initializer
    if (sortedFields.length > 0) {
      this.emit('');
      const initParams = sortedFields
        .map((field) => {
          const propertyType = this.getPropertyType(field.type);
          const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
          const defaultValue = field.type.nullable ? ' = nil' : '';
          return `        ${propertyName}: ${propertyType}${defaultValue}`;
        })
        .join(',\n');
      this.emit('    public init(');
      this.emit(initParams);
      this.emit('    ) {');
      for (const field of sortedFields) {
        const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
        this.emit(`        self.${propertyName} = ${propertyName}`);
      }
      this.emit('    }');
    } else {
      this.emit('    public init() {}');
    }

    this.emit('}');
    this.emit('');
  }

  private generateCustomInput(irInput: IRInput): void {
    switch (irInput.customTypeKind) {
      case 'PurchaseInput':
        this.emit('public typealias PurchaseInput = Purchase');
        this.emit('');
        break;
      case 'DiscountOfferInputIOS':
        this.generateDiscountOfferInputIOS(irInput);
        break;
      case 'RequestPurchaseProps':
        this.generateRequestPurchaseProps(irInput);
        break;
    }
  }

  private generateDiscountOfferInputIOS(irInput: IRInput): void {
    this.generateDocComment(irInput.description);
    this.emit('public struct DiscountOfferInputIOS: Codable {');
    this.emit('    public var identifier: String');
    this.emit('    public var keyIdentifier: String');
    this.emit('    public var nonce: String');
    this.emit('    public var signature: String');
    this.emit('    public var timestamp: Double');
    this.emit('');
    this.emit('    public init(identifier: String, keyIdentifier: String, nonce: String, signature: String, timestamp: Double) {');
    this.emit('        self.identifier = identifier');
    this.emit('        self.keyIdentifier = keyIdentifier');
    this.emit('        self.nonce = nonce');
    this.emit('        self.signature = signature');
    this.emit('        self.timestamp = timestamp');
    this.emit('    }');
    this.emit('');
    this.emit('    private enum CodingKeys: String, CodingKey {');
    this.emit('        case identifier, keyIdentifier, nonce, signature, timestamp');
    this.emit('    }');
    this.emit('');
    this.emit('    public init(from decoder: Decoder) throws {');
    this.emit('        let container = try decoder.container(keyedBy: CodingKeys.self)');
    this.emit('        identifier = try container.decode(String.self, forKey: .identifier)');
    this.emit('        keyIdentifier = try container.decode(String.self, forKey: .keyIdentifier)');
    this.emit('        nonce = try container.decode(String.self, forKey: .nonce)');
    this.emit('        signature = try container.decode(String.self, forKey: .signature)');
    this.emit('');
    this.emit('        // Flexible timestamp decoding: accept Double or String');
    this.emit('        if let timestampDouble = try? container.decode(Double.self, forKey: .timestamp) {');
    this.emit('            timestamp = timestampDouble');
    this.emit('        } else if let timestampString = try? container.decode(String.self, forKey: .timestamp),');
    this.emit('                  let timestampDouble = Double(timestampString) {');
    this.emit('            timestamp = timestampDouble');
    this.emit('        } else {');
    this.emit('            throw DecodingError.dataCorruptedError(');
    this.emit('                forKey: .timestamp,');
    this.emit('                in: container,');
    this.emit('                debugDescription: "timestamp must be a number or numeric string"');
    this.emit('            )');
    this.emit('        }');
    this.emit('    }');
    this.emit('');
    this.emit('    public func encode(to encoder: Encoder) throws {');
    this.emit('        var container = encoder.container(keyedBy: CodingKeys.self)');
    this.emit('        try container.encode(identifier, forKey: .identifier)');
    this.emit('        try container.encode(keyIdentifier, forKey: .keyIdentifier)');
    this.emit('        try container.encode(nonce, forKey: .nonce)');
    this.emit('        try container.encode(signature, forKey: .signature)');
    this.emit('        try container.encode(timestamp, forKey: .timestamp)');
    this.emit('    }');
    this.emit('}');
    this.emit('');
  }

  private generateRequestPurchaseProps(irInput: IRInput): void {
    this.generateDocComment(irInput.description);
    this.emit('public struct RequestPurchaseProps: Codable {');
    this.emit('    public var request: Request');
    this.emit('    public var type: ProductQueryType');
    this.emit('    public var useAlternativeBilling: Bool?');
    this.emit('');
    this.emit('    public init(request: Request, type: ProductQueryType? = nil, useAlternativeBilling: Bool? = nil) {');
    this.emit('        switch request {');
    this.emit('        case .purchase:');
    this.emit('            let resolved = type ?? .inApp');
    this.emit('            precondition(resolved == .inApp, "RequestPurchaseProps.type must be .inApp when request is purchase")');
    this.emit('            self.type = resolved');
    this.emit('        case .subscription:');
    this.emit('            let resolved = type ?? .subs');
    this.emit('            precondition(resolved == .subs, "RequestPurchaseProps.type must be .subs when request is subscription")');
    this.emit('            self.type = resolved');
    this.emit('        }');
    this.emit('        self.request = request');
    this.emit('        self.useAlternativeBilling = useAlternativeBilling');
    this.emit('    }');
    this.emit('');
    this.emit('    private enum CodingKeys: String, CodingKey {');
    this.emit('        case requestPurchase');
    this.emit('        case requestSubscription');
    this.emit('        case type');
    this.emit('        case useAlternativeBilling');
    this.emit('    }');
    this.emit('');
    this.emit('    public init(from decoder: Decoder) throws {');
    this.emit('        let container = try decoder.container(keyedBy: CodingKeys.self)');
    this.emit('        let decodedType = try container.decodeIfPresent(ProductQueryType.self, forKey: .type)');
    this.emit('        self.useAlternativeBilling = try container.decodeIfPresent(Bool.self, forKey: .useAlternativeBilling)');
    this.emit('        if let purchase = try container.decodeIfPresent(RequestPurchasePropsByPlatforms.self, forKey: .requestPurchase) {');
    this.emit('            let finalType = decodedType ?? .inApp');
    this.emit('            guard finalType == .inApp else {');
    this.emit('                throw DecodingError.dataCorruptedError(forKey: .type, in: container, debugDescription: "type must be IN_APP when requestPurchase is provided")');
    this.emit('            }');
    this.emit('            self.request = .purchase(purchase)');
    this.emit('            self.type = finalType');
    this.emit('            return');
    this.emit('        }');
    this.emit('        if let subscription = try container.decodeIfPresent(RequestSubscriptionPropsByPlatforms.self, forKey: .requestSubscription) {');
    this.emit('            let finalType = decodedType ?? .subs');
    this.emit('            guard finalType == .subs else {');
    this.emit('                throw DecodingError.dataCorruptedError(forKey: .type, in: container, debugDescription: "type must be SUBS when requestSubscription is provided")');
    this.emit('            }');
    this.emit('            self.request = .subscription(subscription)');
    this.emit('            self.type = finalType');
    this.emit('            return');
    this.emit('        }');
    this.emit('        throw DecodingError.dataCorruptedError(forKey: .requestPurchase, in: container, debugDescription: "RequestPurchaseProps requires requestPurchase or requestSubscription.")');
    this.emit('    }');
    this.emit('');
    this.emit('    public func encode(to encoder: Encoder) throws {');
    this.emit('        var container = encoder.container(keyedBy: CodingKeys.self)');
    this.emit('        switch request {');
    this.emit('        case let .purchase(value):');
    this.emit('            try container.encode(value, forKey: .requestPurchase)');
    this.emit('        case let .subscription(value):');
    this.emit('            try container.encode(value, forKey: .requestSubscription)');
    this.emit('        }');
    this.emit('        try container.encode(type, forKey: .type)');
    this.emit('        try container.encodeIfPresent(useAlternativeBilling, forKey: .useAlternativeBilling)');
    this.emit('    }');
    this.emit('');
    this.emit('    public enum Request {');
    this.emit('        case purchase(RequestPurchasePropsByPlatforms)');
    this.emit('        case subscription(RequestSubscriptionPropsByPlatforms)');
    this.emit('    }');
    this.emit('}');
    this.emit('');
  }

  // ============================================================================
  // Unions (Enums)
  // ============================================================================

  generateUnion(irUnion: IRUnion): void {
    this.generateDocComment(irUnion.description);

    const conformances = ['Codable', ...irUnion.sharedInterfaces];
    const conformanceClause = conformances.length > 0 ? `: ${conformances.join(', ')}` : '';

    this.emit(`public enum ${irUnion.name}${conformanceClause} {`);

    for (const member of irUnion.members) {
      const caseName = this.escapeKeyword(this.enumValueCase(member.name));
      this.emit(`    case ${caseName}(${member.name})`);
    }

    // Generate shared interface property accessors
    if (irUnion.sharedInterfaces.length > 0) {
      this.generateUnionInterfaceAccessors(irUnion);
    }

    this.emit('}');
    this.emit('');
  }

  private generateUnionInterfaceAccessors(irUnion: IRUnion): void {
    // Collect fields from shared interfaces
    const interfaceFields = new Map<string, IRField>();
    for (const interfaceName of irUnion.sharedInterfaces) {
      const irInterface = this.schema.interfaces.find((i) => i.name === interfaceName);
      if (!irInterface) continue;
      // Sort interface fields alphabetically
      const sortedFields = [...irInterface.fields].sort((a, b) => a.name.localeCompare(b.name));
      for (const field of sortedFields) {
        if (!interfaceFields.has(field.name)) {
          interfaceFields.set(field.name, field);
        }
      }
    }

    if (interfaceFields.size > 0) {
      this.emit('');
    }

    // Sort the final array alphabetically
    const interfaceFieldsArray = [...interfaceFields.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    interfaceFieldsArray.forEach(([fieldName, field], index) => {
      this.generateDocComment(field.description, '    ');
      const propertyType = this.getPropertyType(field.type);
      const propertyName = this.escapeKeyword(this.fieldNameCase(fieldName));

      this.emit(`    public var ${propertyName}: ${propertyType} {`);
      this.emit('        switch self {');

      for (const member of irUnion.members) {
        const caseName = this.escapeKeyword(this.enumValueCase(member.name));
        this.emit(`        case let .${caseName}(value):`);
        this.emit(`            return value.${propertyName}`);
      }

      this.emit('        }');
      this.emit('    }');
      // Add blank line between properties (except after the last one)
      if (index < interfaceFieldsArray.length - 1) {
        this.emit('');
      }
    });
  }

  // ============================================================================
  // Operations (Protocols + Helpers)
  // ============================================================================

  generateOperation(irOperation: IROperation): void {
    // Note: Protocol and helpers are generated together here,
    // but the order matches the original generator's output
    this.generateOperationProtocol(irOperation);
  }

  /**
   * Override generate to match original output order:
   * 1. All protocols first
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

    // Operations - Protocols first
    if (schema.operations.length > 0) {
      this.addSectionComment('Root Operations');
      for (const irOperation of schema.operations) {
        this.generateOperationProtocol(irOperation);
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

  private generateOperationProtocol(irOperation: IROperation): void {
    const protocolName = `${irOperation.name}Resolver`;
    this.generateDocComment(irOperation.description ?? `GraphQL root ${irOperation.name.toLowerCase()} operations.`);
    this.emit(`public protocol ${protocolName} {`);

    // Sort fields alphabetically and filter _placeholder
    const sortedFields = irOperation.fields
      .filter((f) => f.name !== '_placeholder')
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const field of sortedFields) {
      this.generateDocComment(field.description, '    ');
      const returnType = this.getOperationReturnType(field);

      if (field.args.length === 0) {
        this.emit(`    func ${this.escapeKeyword(field.name)}() async throws -> ${returnType}`);
      } else if (field.args.length === 1) {
        const arg = field.args[0];
        const argType = this.getPropertyType(arg.type);
        const argName = this.escapeKeyword(arg.name);
        this.emit(`    func ${this.escapeKeyword(field.name)}(_ ${argName}: ${argType}) async throws -> ${returnType}`);
      } else {
        const params = field.args
          .map((arg) => {
            const argType = this.getPropertyType(arg.type);
            const argName = this.escapeKeyword(arg.name);
            return `${argName}: ${argType}`;
          })
          .join(', ');
        this.emit(`    func ${this.escapeKeyword(field.name)}(${params}) async throws -> ${returnType}`);
      }
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
        this.emit(`public typealias ${aliasName} = () async throws -> ${returnType}`);
      } else {
        const params = field.args
          .map((arg) => {
            const argType = this.getPropertyType(arg.type);
            return `_ ${this.escapeKeyword(arg.name)}: ${argType}`;
          })
          .join(', ');
        this.emit(`public typealias ${aliasName} = (${params}) async throws -> ${returnType}`);
      }
    }

    // Generate handlers struct
    const structName = `${irOperation.name}Handlers`;
    this.emit('');
    this.emit(`public struct ${structName} {`);

    for (const field of sortedFields) {
      const aliasName = `${irOperation.name}${capitalize(field.name)}Handler`;
      this.emit(`    public var ${this.escapeKeyword(field.name)}: ${aliasName}?`);
    }

    this.emit('');
    const initParams = sortedFields
      .map((field) => {
        const aliasName = `${irOperation.name}${capitalize(field.name)}Handler`;
        return `${this.escapeKeyword(field.name)}: ${aliasName}? = nil`;
      })
      .join(',\n        ');
    this.emit(`    public init(${sortedFields.length > 0 ? `\n        ${initParams}\n    ` : ''}) {`);
    for (const field of sortedFields) {
      const propertyName = this.escapeKeyword(field.name);
      this.emit(`        self.${propertyName} = ${propertyName}`);
    }
    this.emit('    }');
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
    const resolved = field.resolvedReturnType;

    // Handle Void
    if (resolved.kind === 'scalar' && resolved.name === 'Void') {
      return resolved.nullable ? 'Void?' : 'Void';
    }

    return this.getPropertyType(resolved);
  }

  protected generateDocComment(description: string | undefined, indent: string = ''): void {
    if (!description) return;
    for (const line of description.split(/\r?\n/)) {
      this.emit(`${indent}/// ${line}`);
    }
  }
}
