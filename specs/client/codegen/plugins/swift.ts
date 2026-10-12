/**
 * Swift Code Generation Plugin
 *
 * Generates Swift types with Codable conformance from GraphQL schema.
 */

import {
  renderStoreIds,
  renderStoreIdentityResolver,
  hasStoreIdentity,
} from "../core/store-ids.js";
import { CodegenPlugin, type CodegenPluginConfig } from "./base-plugin.js";
import { generatedFileHeader } from "../core/generated-header.js";
import { ADDITIONAL_OPERATION_FIELDS } from "../core/operation-compatibility.js";
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
} from "../core/types.js";
import {
  SWIFT_KEYWORDS,
  GRAPHQL_TO_SWIFT,
  requireGraphQLScalarMapping,
  toLowerCamelCase,
  capitalize,
} from "../core/utils.js";

const SWIFT_CODING_HELPERS = `/// Union JSON is flat and names its member type in \`__typename\`.
private enum UnionTypenameKey: String, CodingKey {
    case typename = "__typename"
}

/// Input enums reject unrecognized values; only output decoding falls back to \`.unknown\`.
private struct StrictInputEnum<Value: RawRepresentable>: Decodable where Value.RawValue == String {
    let value: Value

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let rawValue = try container.decode(String.self)
        guard let value = Value(rawValue: rawValue) else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unknown \\(Value.self) input value: \\(rawValue)")
        }
        self.value = value
    }
}
`;

export class SwiftPlugin extends CodegenPlugin {
  readonly name = "swift";
  readonly fileExtension = ".swift";
  readonly keywords = SWIFT_KEYWORDS;

  private schema!: IRSchema;

  constructor(config: CodegenPluginConfig) {
    super(config);
  }

  // ============================================================================
  // Type Mapping
  // ============================================================================

  mapScalar(name: string): string {
    return requireGraphQLScalarMapping(GRAPHQL_TO_SWIFT, name, "Swift");
  }

  mapType(type: IRType): string {
    if (type.kind === "list") {
      const elementType = this.mapType(type.elementType!);
      const element = type.elementType!.nullable
        ? `${elementType}?`
        : elementType;
      return `[${element}]`;
    }
    if (type.kind === "scalar") {
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
    for (const line of generatedFileHeader()) this.emit(line);
    this.emit("");
    this.emit("import Foundation");
    this.emit("");
  }

  // ============================================================================
  // Enums
  // ============================================================================

  generateEnum(irEnum: IREnum): void {
    this.generateDocComment(irEnum.description);
    this.emit(`public enum ${irEnum.name}: String, Codable, CaseIterable {`);

    for (const value of irEnum.values) {
      this.generateDocComment(value.description, "    ");
      this.emit(`    case ${this.enumCaseName(value.name)} = "${value.rawValue}"`);
    }

    this.emit("");
    this.emit("    public init?(rawValue: String) {");
    this.emit("        switch rawValue {");
    for (const value of irEnum.values) {
      const spellings = this.enumSpellings(value).map((spelling) => `"${spelling}"`);
      this.emit(`        case ${spellings.join(", ")}:`);
      this.emit(`            self = .${this.enumCaseName(value.name)}`);
    }
    this.emit("        default:");
    this.emit("            return nil");
    this.emit("        }");
    this.emit("    }");

    const unknownValue = this.enumUnknownValue(irEnum);
    if (unknownValue) {
      const unknownCase = this.enumCaseName(unknownValue.name);
      this.emit("");
      this.emit(`    /// Unrecognized wire values decode as \`.${unknownCase}\`.`);
      this.emit("    public init(from decoder: Decoder) throws {");
      this.emit(
        `        self = Self(rawValue: try decoder.singleValueContainer().decode(String.self)) ?? .${unknownCase}`,
      );
      this.emit("    }");
    }

    this.emit("}");
    this.emit("");
  }

  private enumCaseName(valueName: string): string {
    return this.escapeKeyword(this.enumValueCase(valueName));
  }

  // ============================================================================
  // Interfaces (Protocols)
  // ============================================================================

  generateInterface(irInterface: IRInterface): void {
    this.generateDocComment(irInterface.description);
    this.emit(`public protocol ${irInterface.name}: Codable {`);

    // Sort fields alphabetically for Swift
    const sortedFields = [...irInterface.fields].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const field of sortedFields) {
      this.generateDocComment(field.description, "    ");
      const propertyType = this.getPropertyType(field.type);
      const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
      this.emit(`    var ${propertyName}: ${propertyType} { get }`);
    }

    this.emit("}");
    this.emit("");
  }

  // ============================================================================
  // Objects (Structs)
  // ============================================================================

  generateObject(irObject: IRObject): void {
    // Handle VoidResult
    if (irObject.name === "VoidResult") {
      this.generateDocComment(irObject.description);
      this.emit("public typealias VoidResult = Void");
      this.emit("");
      return;
    }

    // Handle result union wrappers
    if (irObject.isResultUnion && irObject.resultUnionEntries) {
      this.generateResultUnionObject(irObject);
      return;
    }

    this.generateDocComment(irObject.description);
    const conformances = ["Codable", ...irObject.interfaces];
    this.emit(`public struct ${irObject.name}: ${conformances.join(", ")} {`);

    // Sort fields alphabetically for Swift
    const sortedFields = [...irObject.fields].sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    // Properties
    for (const field of sortedFields) {
      this.generateDocComment(field.description, "    ");
      const propertyType = this.getPropertyType(field.type);
      const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));

      const schemaDefault = this.buildDefaultValueExpression(field);
      let defaultValue = "";
      if (schemaDefault) {
        defaultValue = ` = ${schemaDefault}`;
      } else if (field.type.nullable) {
        // Default nullable properties to nil so the synthesized memberwise
        // initializer can omit them — existing call sites that construct
        // objects without every optional keep compiling when new nullable
        // fields are added.
        defaultValue = " = nil";
      }

      this.emit(
        `    public var ${propertyName}: ${propertyType}${defaultValue}`,
      );
    }

    this.generatePublicInitializer(sortedFields);

    if (hasStoreIdentity(sortedFields)) {
      this.emit("    private enum CodingKeys: String, CodingKey {");
      this.emit(
        `        case ${sortedFields.map((field) => this.escapeKeyword(field.name)).join(", ")}`,
      );
      this.emit("    }");
    }
    this.emit("}");
    this.emit("");
    if (hasStoreIdentity(sortedFields)) {
      this.emit(`extension ${irObject.name} {`);
      this.emit("    public init(from decoder: Decoder) throws {");
      this.emit(
        "        let container = try decoder.container(keyedBy: CodingKeys.self)",
      );
      this.emit(
        "        let store = try container.decode(IapStore.self, forKey: .store)",
      );
      for (const field of sortedFields) {
        const name = this.escapeKeyword(field.name);
        if (field.name === "store") {
          this.emit("        self.store = store");
        } else if (field.name === "storeId") {
          this.emit(
            "        guard let storeId = resolveStoreId(store, try container.decodeIfPresent(String.self, forKey: .storeId)) else {",
          );
          this.emit(
            '            throw DecodingError.dataCorruptedError(forKey: .storeId, in: container, debugDescription: "Invalid store identity")',
          );
          this.emit("        }");
          this.emit("        self.storeId = storeId");
        } else {
          this.emit(
            `        self.${name} = try container.${field.type.nullable ? "decodeIfPresent" : "decode"}(${this.mapType(field.type)}.self, forKey: .${name})`,
          );
        }
      }
      this.emit("    }");
      this.emit("}");
      this.emit("");
    }
  }

  private generateResultUnionObject(irObject: IRObject): void {
    this.generateDocComment(irObject.description);
    this.emit(`public enum ${irObject.name} {`);

    // Sort entries alphabetically
    const sortedEntries = [...irObject.resultUnionEntries!].sort((a, b) =>
      a.fieldName.localeCompare(b.fieldName),
    );
    for (const entry of sortedEntries) {
      this.generateDocComment(entry.description, "    ");
      const caseName = this.enumCaseName(entry.fieldName);
      const payloadType = this.getPropertyType(entry.type);
      this.emit(`    case ${caseName}(${payloadType})`);
    }

    this.emit("}");
    this.emit("");
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
    const sortedFields = [...irInput.fields].sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    // Properties
    for (const field of sortedFields) {
      this.generateDocComment(field.description, "    ");
      const propertyType = this.getPropertyType(field.type);
      const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
      this.emit(`    public var ${propertyName}: ${propertyType}`);
    }

    this.generatePublicInitializer(sortedFields);

    this.emit("}");
    this.emit("");
    this.generateInputDecoder(irInput.name, sortedFields);
  }

  /** Apply SDL defaults to missing keys and keep input enums strict, matching the other languages. */
  private generateInputDecoder(typeName: string, sortedFields: IRField[]): void {
    const decoded = sortedFields.map((field) => ({
      field,
      schemaDefault: this.buildDefaultValueExpression(field),
      strict: this.strictInputEnumDecoding(field.type),
    }));
    if (!decoded.some(({ schemaDefault, strict }) => schemaDefault || strict)) return;

    this.emit(`extension ${typeName} {`);
    this.emit("    public init(from decoder: Decoder) throws {");
    this.emit("        let container = try decoder.container(keyedBy: CodingKeys.self)");
    for (const { field, schemaDefault, strict } of decoded) {
      const name = this.escapeKeyword(this.fieldNameCase(field.name));
      const optional = field.type.nullable || schemaDefault !== null;
      const decodedType = strict?.decodedType ?? this.mapType(field.type);
      let expression = `try container.${optional ? "decodeIfPresent" : "decode"}(${decodedType}.self, forKey: .${name})`;
      if (strict) expression += `${optional ? "?" : ""}${strict.unwrap}`;
      if (schemaDefault) expression += ` ?? ${schemaDefault}`;
      this.emit(`        self.${name} = ${expression}`);
    }
    this.emit("    }");
    this.emit("}");
    this.emit("");
  }

  /** How to decode an input field whose enum falls back to `.unknown` for outputs. */
  private strictInputEnumDecoding(type: IRType): { decodedType: string; unwrap: string } | null {
    const isTolerantEnum = (candidate: IRType): boolean => {
      if (candidate.kind !== "enum") return false;
      const irEnum = this.schema.enums.find((item) => item.name === candidate.name);
      return irEnum !== undefined && this.enumUnknownValue(irEnum) !== null;
    };
    if (isTolerantEnum(type)) {
      return { decodedType: `StrictInputEnum<${type.name}>`, unwrap: ".value" };
    }
    const element = type.elementType;
    if (type.kind === "list" && element && isTolerantEnum(element)) {
      return element.nullable
        ? { decodedType: `[StrictInputEnum<${element.name}>?]`, unwrap: ".map { $0?.value }" }
        : { decodedType: `[StrictInputEnum<${element.name}>]`, unwrap: ".map(\\.value)" };
    }
    return null;
  }

  private generatePublicInitializer(sortedFields: IRField[]): void {
    if (sortedFields.length > 0) {
      this.emit("");
      const initParams = sortedFields
        .map((field) => {
          const propertyType = this.getPropertyType(field.type);
          const propertyName = this.escapeKeyword(
            this.fieldNameCase(field.name),
          );
          const schemaDefault = this.buildDefaultValueExpression(field);
          const defaultValue = schemaDefault
            ? ` = ${schemaDefault}`
            : field.type.nullable
              ? " = nil"
              : "";
          return `        ${propertyName}: ${propertyType}${defaultValue}`;
        })
        .join(",\n");
      this.emit("    public init(");
      this.emit(initParams);
      this.emit("    ) {");
      for (const field of sortedFields) {
        const propertyName = this.escapeKeyword(this.fieldNameCase(field.name));
        this.emit(`        self.${propertyName} = ${propertyName}`);
      }
      this.emit("    }");
    } else {
      this.emit("    public init() {}");
    }
  }

  private generateCustomInput(irInput: IRInput): void {
    switch (irInput.customTypeKind) {
      case "PurchaseInput":
        this.emit("public typealias PurchaseInput = Purchase");
        this.emit("");
        break;
      case "DiscountOfferInputIOS":
        this.generateDiscountOfferInputIOS(irInput);
        break;
      case "RequestPurchaseProps":
        this.generateRequestPurchaseProps(irInput);
        break;
      default:
        throw new Error(
          `${irInput.name} is marked as a custom input without a Swift generator strategy.`,
        );
    }
  }

  private buildDefaultValueExpression(field: IRField): string | null {
    if (field.defaultValue === undefined) return null;
    return this.buildDefaultValueForType(field.type, field.defaultValue);
  }

  private buildDefaultValueForType(
    type: IRType,
    defaultValue: unknown,
  ): string | null {
    if (type.kind === "list") {
      if (!Array.isArray(defaultValue)) return null;
      const items = defaultValue
        .map((value) => this.buildDefaultValueForType(type.elementType!, value))
        .filter((value): value is string => value !== null);
      return `[${items.join(", ")}]`;
    }
    if (type.kind === "enum" && typeof defaultValue === "string") {
      return `.${this.enumCaseName(defaultValue)}`;
    }
    if (type.kind === "scalar") {
      if (typeof defaultValue === "string") return `"${defaultValue}"`;
      if (
        typeof defaultValue === "number" ||
        typeof defaultValue === "boolean"
      ) {
        return String(defaultValue);
      }
    }
    return null;
  }

  private generateDiscountOfferInputIOS(irInput: IRInput): void {
    const fields = this.requireCustomInputFields(irInput);
    this.generateDocComment(irInput.description);
    this.emit("public struct DiscountOfferInputIOS: Codable {");
    for (const field of fields) {
      this.generateDocComment(field.description, "    ");
      this.emit(
        `    public var ${field.name}: ${this.getPropertyType(field.type)}`,
      );
    }
    this.emit("");
    this.emit(
      "    public init(identifier: String, keyIdentifier: String, nonce: String, signature: String, timestamp: Double) {",
    );
    this.emit("        self.identifier = identifier");
    this.emit("        self.keyIdentifier = keyIdentifier");
    this.emit("        self.nonce = nonce");
    this.emit("        self.signature = signature");
    this.emit("        self.timestamp = timestamp");
    this.emit("    }");
    this.emit("");
    this.emit("    private enum CodingKeys: String, CodingKey {");
    this.emit(
      "        case identifier, keyIdentifier, nonce, signature, timestamp",
    );
    this.emit("    }");
    this.emit("");
    this.emit("    public init(from decoder: Decoder) throws {");
    this.emit(
      "        let container = try decoder.container(keyedBy: CodingKeys.self)",
    );
    this.emit(
      "        identifier = try container.decode(String.self, forKey: .identifier)",
    );
    this.emit(
      "        keyIdentifier = try container.decode(String.self, forKey: .keyIdentifier)",
    );
    this.emit(
      "        nonce = try container.decode(String.self, forKey: .nonce)",
    );
    this.emit(
      "        signature = try container.decode(String.self, forKey: .signature)",
    );
    this.emit("");
    this.emit(
      "        // Flexible timestamp decoding: accept Double or String",
    );
    this.emit(
      "        if let timestampDouble = try? container.decode(Double.self, forKey: .timestamp) {",
    );
    this.emit("            timestamp = timestampDouble");
    this.emit(
      "        } else if let timestampString = try? container.decode(String.self, forKey: .timestamp),",
    );
    this.emit(
      "                  let timestampDouble = Double(timestampString) {",
    );
    this.emit("            timestamp = timestampDouble");
    this.emit("        } else {");
    this.emit("            throw DecodingError.dataCorruptedError(");
    this.emit("                forKey: .timestamp,");
    this.emit("                in: container,");
    this.emit(
      '                debugDescription: "timestamp must be a number or numeric string"',
    );
    this.emit("            )");
    this.emit("        }");
    this.emit("    }");
    this.emit("");
    this.emit("    public func encode(to encoder: Encoder) throws {");
    this.emit(
      "        var container = encoder.container(keyedBy: CodingKeys.self)",
    );
    this.emit("        try container.encode(identifier, forKey: .identifier)");
    this.emit(
      "        try container.encode(keyIdentifier, forKey: .keyIdentifier)",
    );
    this.emit("        try container.encode(nonce, forKey: .nonce)");
    this.emit("        try container.encode(signature, forKey: .signature)");
    this.emit("        try container.encode(timestamp, forKey: .timestamp)");
    this.emit("    }");
    this.emit("}");
    this.emit("");
  }

  private generateRequestPurchaseProps(irInput: IRInput): void {
    const [requestPurchase, requestSubscription, type] =
      this.requireCustomInputFields(irInput);
    this.generateDocComment(irInput.description);
    this.emit("public struct RequestPurchaseProps: Codable {");
    this.emit("    public var request: Request");
    this.generateDocComment(type.description, "    ");
    this.emit("    public var type: ProductQueryType");
    this.emit("");
    this.emit(
      "    public init(request: Request, type: ProductQueryType? = nil) {",
    );
    this.emit("        switch request {");
    this.emit("        case .purchase:");
    this.emit("            let resolved = type ?? .inApp");
    this.emit(
      '            precondition(resolved == .inApp, "RequestPurchaseProps.type must be .inApp when request is purchase")',
    );
    this.emit("            self.type = resolved");
    this.emit("        case .subscription:");
    this.emit("            let resolved = type ?? .subs");
    this.emit(
      '            precondition(resolved == .subs, "RequestPurchaseProps.type must be .subs when request is subscription")',
    );
    this.emit("            self.type = resolved");
    this.emit("        }");
    this.emit("        self.request = request");
    this.emit("    }");
    this.emit("");
    this.emit("    private enum CodingKeys: String, CodingKey {");
    this.emit("        case requestPurchase");
    this.emit("        case requestSubscription");
    this.emit("        case type");
    this.emit("    }");
    this.emit("");
    this.emit("    public init(from decoder: Decoder) throws {");
    this.emit(
      "        let container = try decoder.container(keyedBy: CodingKeys.self)",
    );
    this.emit(
      "        let decodedType = try container.decodeIfPresent(ProductQueryType.self, forKey: .type)",
    );
    this.emit(
      "        let purchase = try container.decodeIfPresent(RequestPurchasePropsByPlatforms.self, forKey: .requestPurchase)",
    );
    this.emit(
      "        let subscription = try container.decodeIfPresent(RequestSubscriptionPropsByPlatforms.self, forKey: .requestSubscription)",
    );
    this.emit(
      "        guard (purchase == nil) != (subscription == nil) else {",
    );
    this.emit(
      '            throw DecodingError.dataCorruptedError(forKey: .requestPurchase, in: container, debugDescription: "RequestPurchaseProps requires exactly one of requestPurchase or requestSubscription.")',
    );
    this.emit("        }");
    this.emit("        if let purchase {");
    this.emit("            let finalType = decodedType ?? .inApp");
    this.emit("            guard finalType == .inApp else {");
    this.emit(
      '                throw DecodingError.dataCorruptedError(forKey: .type, in: container, debugDescription: "type must be IN_APP when requestPurchase is provided")',
    );
    this.emit("            }");
    this.emit("            self.request = .purchase(purchase)");
    this.emit("            self.type = finalType");
    this.emit("            return");
    this.emit("        }");
    this.emit("        if let subscription {");
    this.emit("            let finalType = decodedType ?? .subs");
    this.emit("            guard finalType == .subs else {");
    this.emit(
      '                throw DecodingError.dataCorruptedError(forKey: .type, in: container, debugDescription: "type must be SUBS when requestSubscription is provided")',
    );
    this.emit("            }");
    this.emit("            self.request = .subscription(subscription)");
    this.emit("            self.type = finalType");
    this.emit("            return");
    this.emit("        }");
    this.emit(
      '        throw DecodingError.dataCorruptedError(forKey: .requestPurchase, in: container, debugDescription: "RequestPurchaseProps branch validation failed.")',
    );
    this.emit("    }");
    this.emit("");
    this.emit("    public func encode(to encoder: Encoder) throws {");
    this.emit(
      "        var container = encoder.container(keyedBy: CodingKeys.self)",
    );
    this.emit("        switch request {");
    this.emit("        case let .purchase(value):");
    this.emit(
      "            try container.encode(value, forKey: .requestPurchase)",
    );
    this.emit("        case let .subscription(value):");
    this.emit(
      "            try container.encode(value, forKey: .requestSubscription)",
    );
    this.emit("        }");
    this.emit("        try container.encode(type, forKey: .type)");
    this.emit("    }");
    this.emit("");
    this.emit("    public enum Request {");
    this.generateDocComment(requestPurchase.description, "        ");
    this.emit("        case purchase(RequestPurchasePropsByPlatforms)");
    this.generateDocComment(requestSubscription.description, "        ");
    this.emit("        case subscription(RequestSubscriptionPropsByPlatforms)");
    this.emit("    }");
    this.emit("}");
    this.emit("");
  }

  // ============================================================================
  // Unions (Enums)
  // ============================================================================

  generateUnion(irUnion: IRUnion): void {
    this.generateDocComment(irUnion.description);

    const conformances = ["Codable", ...irUnion.sharedInterfaces];
    const conformanceClause =
      conformances.length > 0 ? `: ${conformances.join(", ")}` : "";

    this.emit(`public enum ${irUnion.name}${conformanceClause} {`);

    for (const member of irUnion.members) {
      const caseName = this.enumCaseName(member.name);
      this.emit(`    case ${caseName}(${member.name})`);
    }

    this.generateUnionCoding(irUnion);

    // Generate shared interface property accessors
    if (irUnion.sharedInterfaces.length > 0) {
      this.generateUnionInterfaceAccessors(irUnion);
    }

    this.emit("}");
    this.emit("");
  }

  /** Flat JSON: the member's own fields plus `__typename`, dispatched on the leaf type name like every other language. */
  private generateUnionCoding(irUnion: IRUnion): void {
    const leafTypenames = (member: IRUnion["members"][number]): string[] => {
      if (!member.isNestedUnion) return [member.name];
      const nested = this.schema.unions.find((candidate) => candidate.name === member.name);
      if (!nested) throw new Error(`${irUnion.name} member ${member.name} is not a known union.`);
      return nested.members.flatMap(leafTypenames);
    };

    this.emit("");
    this.emit("    public init(from decoder: Decoder) throws {");
    this.emit("        let container = try decoder.container(keyedBy: UnionTypenameKey.self)");
    this.emit("        let typename = try container.decode(String.self, forKey: .typename)");
    this.emit("        switch typename {");
    for (const member of irUnion.members) {
      const caseName = this.enumCaseName(member.name);
      const labels = leafTypenames(member).map((name) => `"${name}"`);
      this.emit(`        case ${labels.join(", ")}:`);
      this.emit(`            self = .${caseName}(try ${member.name}(from: decoder))`);
    }
    this.emit("        default:");
    this.emit(
      `            throw DecodingError.dataCorruptedError(forKey: .typename, in: container, debugDescription: "Unknown __typename for ${irUnion.name}: \\(typename)")`,
    );
    this.emit("        }");
    this.emit("    }");
    this.emit("");
    this.emit("    public func encode(to encoder: Encoder) throws {");
    this.emit("        switch self {");
    for (const member of irUnion.members) {
      const caseName = this.enumCaseName(member.name);
      this.emit(`        case let .${caseName}(value):`);
      this.emit("            try value.encode(to: encoder)");
      if (!member.isNestedUnion) {
        // A nested union already wrote its leaf member's __typename.
        this.emit("            var container = encoder.container(keyedBy: UnionTypenameKey.self)");
        this.emit(`            try container.encode("${member.name}", forKey: .typename)`);
      }
    }
    this.emit("        }");
    this.emit("    }");
  }

  private generateUnionInterfaceAccessors(irUnion: IRUnion): void {
    // Collect fields from shared interfaces
    const interfaceFields = new Map<string, IRField>();
    for (const interfaceName of irUnion.sharedInterfaces) {
      const irInterface = this.schema.interfaces.find(
        (i) => i.name === interfaceName,
      );
      if (!irInterface) continue;
      // Sort interface fields alphabetically
      const sortedFields = [...irInterface.fields].sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      for (const field of sortedFields) {
        if (!interfaceFields.has(field.name)) {
          interfaceFields.set(field.name, field);
        }
      }
    }

    if (interfaceFields.size > 0) {
      this.emit("");
    }

    // Sort the final array alphabetically
    const interfaceFieldsArray = [...interfaceFields.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    );
    interfaceFieldsArray.forEach(([fieldName, field], index) => {
      this.generateDocComment(field.description, "    ");
      const propertyType = this.getPropertyType(field.type);
      const propertyName = this.escapeKeyword(this.fieldNameCase(fieldName));

      this.emit(`    public var ${propertyName}: ${propertyType} {`);
      this.emit("        switch self {");

      for (const member of irUnion.members) {
        const caseName = this.enumCaseName(member.name);
        this.emit(`        case let .${caseName}(value):`);
        this.emit(`            return value.${propertyName}`);
      }

      this.emit("        }");
      this.emit("    }");
      // Add blank line between properties (except after the last one)
      if (index < interfaceFieldsArray.length - 1) {
        this.emit("");
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
    this.emit(renderStoreIds("swift"));
    if (schema.enums.some((item) => item.name === "IapStore"))
      this.emit(renderStoreIdentityResolver("swift"));
    this.emit(SWIFT_CODING_HELPERS);

    // Enums
    if (schema.enums.length > 0) {
      this.addSectionComment("Enums");
      for (const irEnum of schema.enums) {
        this.generateEnum(irEnum);
      }
    }

    // Interfaces
    if (schema.interfaces.length > 0) {
      this.addSectionComment("Interfaces");
      for (const irInterface of schema.interfaces) {
        this.generateInterface(irInterface);
      }
    }

    // Objects
    if (schema.objects.length > 0) {
      this.addSectionComment("Objects");
      for (const irObject of schema.objects) {
        this.generateObject(irObject);
      }
    }

    // Inputs
    if (schema.inputs.length > 0) {
      this.addSectionComment("Input Objects");
      for (const irInput of schema.inputs) {
        this.generateInput(irInput);
      }
    }

    // Unions
    if (schema.unions.length > 0) {
      this.addSectionComment("Unions");
      for (const irUnion of schema.unions) {
        this.generateUnion(irUnion);
      }
    }

    // Operations - Protocols first
    if (schema.operations.length > 0) {
      this.addSectionComment("Root Operations");
      for (const irOperation of schema.operations) {
        this.generateOperationProtocol(irOperation);
      }
    }

    // Operations - Helpers second (matching original order)
    if (schema.operations.length > 0) {
      this.addSectionComment("Root Operation Helpers");
      for (const irOperation of schema.operations) {
        this.generateOperationHelpers(irOperation);
      }
    }

    const output = this.lines.join("\n");
    return this.postProcess(output);
  }

  private generateOperationProtocol(irOperation: IROperation): void {
    const protocolName = `${irOperation.name}Resolver`;
    this.generateDocComment(
      irOperation.description ??
        `GraphQL root ${irOperation.name.toLowerCase()} operations.`,
    );
    this.emit(`public protocol ${protocolName} {`);

    // Sort fields alphabetically and filter _placeholder
    const sortedFields = irOperation.fields
      .filter((f) => f.name !== "_placeholder")
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const field of sortedFields) {
      this.generateDocComment(this.operationFieldDescription(field), "    ");
      this.emit(`    ${this.operationMethodSignature(field)}`);
    }

    this.emit("}");
    this.emit("");

    const additionalFields = sortedFields.filter((field) =>
      ADDITIONAL_OPERATION_FIELDS[irOperation.name]?.includes(field.name),
    );
    if (additionalFields.length > 0) {
      this.emit(`public extension ${protocolName} {`);
      for (const field of additionalFields) {
        this.emit(`    ${this.operationMethodSignature(field)} {`);
        this.emit('        throw CocoaError(.featureUnsupported)');
        this.emit("    }");
      }
      this.emit("}");
      this.emit("");
    }
  }

  private operationMethodSignature(field: IROperationField): string {
    const params = field.args.map((arg) => {
      const label = field.args.length === 1 ? "_ " : "";
      return `${label}${this.escapeKeyword(arg.name)}: ${this.getPropertyType(arg.type)}`;
    }).join(", ");
    return `func ${this.escapeKeyword(field.name)}(${params}) async throws -> ${this.getOperationReturnType(field)}`;
  }

  private generateOperationHelpers(irOperation: IROperation): void {
    // Sort fields alphabetically and filter _placeholder
    const sortedFields = irOperation.fields
      .filter((f) => f.name !== "_placeholder")
      .sort((a, b) => a.name.localeCompare(b.name));

    if (sortedFields.length === 0) return;

    this.emit(`// MARK: - ${irOperation.name} Helpers`);
    this.emit("");

    // Generate typealiases for handlers
    for (const field of sortedFields) {
      const aliasName = `${irOperation.name}${capitalize(field.name)}Handler`;
      const returnType = this.getOperationReturnType(field);

      if (field.args.length === 0) {
        this.emit(
          `public typealias ${aliasName} = () async throws -> ${returnType}`,
        );
      } else {
        const params = field.args
          .map((arg) => {
            const argType = this.getPropertyType(arg.type);
            return `_ ${this.escapeKeyword(arg.name)}: ${argType}`;
          })
          .join(", ");
        this.emit(
          `public typealias ${aliasName} = (${params}) async throws -> ${returnType}`,
        );
      }
    }

    // Generate handlers struct
    const structName = `${irOperation.name}Handlers`;
    this.emit("");
    this.emit(`public struct ${structName} {`);

    for (const field of sortedFields) {
      const aliasName = `${irOperation.name}${capitalize(field.name)}Handler`;
      this.generateDeprecationAnnotation(this.operationFieldDescription(field), "    ");
      this.emit(
        `    public var ${this.escapeKeyword(field.name)}: ${aliasName}?`,
      );
    }

    this.emit("");
    const initParams = sortedFields
      .map((field) => {
        const aliasName = `${irOperation.name}${capitalize(field.name)}Handler`;
        return `${this.escapeKeyword(field.name)}: ${aliasName}? = nil`;
      })
      .join(",\n        ");
    this.emit(
      `    public init(${sortedFields.length > 0 ? `\n        ${initParams}\n    ` : ""}) {`,
    );
    for (const field of sortedFields) {
      const propertyName = this.escapeKeyword(field.name);
      this.emit(`        self.${propertyName} = ${propertyName}`);
    }
    this.emit("    }");
    this.emit("}");
    this.emit("");
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
    if (resolved.kind === "scalar" && resolved.name === "Void") {
      return resolved.nullable ? "Void?" : "Void";
    }

    return this.getPropertyType(resolved);
  }

  /** Doc lines, then the canonical deprecation so Swift callers get a compiler warning. */
  protected generateDocComment(
    description: string | undefined,
    indent: string = "",
  ): void {
    if (!description) return;
    for (const line of description.split(/\r?\n/)) {
      this.emit(line ? `${indent}/// ${line}` : `${indent}///`);
    }
    this.generateDeprecationAnnotation(description, indent);
  }

  private generateDeprecationAnnotation(
    description: string | undefined,
    indent: string = "",
  ): void {
    const reason = this.deprecationReason(description);
    if (!reason) return;
    const escapedReason = reason
      .replaceAll("\\", "\\\\")
      .replaceAll('"', '\\"');
    this.emit(
      `${indent}@available(*, deprecated, message: "${escapedReason}")`,
    );
  }
}
