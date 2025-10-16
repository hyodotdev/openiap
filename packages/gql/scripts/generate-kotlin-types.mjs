import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  GraphQLList,
  GraphQLNonNull,
  buildASTSchema,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isObjectType,
  isScalarType,
  isUnionType,
  parse,
} from 'graphql';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const schemaPaths = [
  '../src/schema.graphql',
  '../src/type.graphql',
  '../src/type-ios.graphql',
  '../src/type-android.graphql',
  '../src/api.graphql',
  '../src/api-ios.graphql',
  '../src/api-android.graphql',
  '../src/error.graphql',
  '../src/event.graphql',
].map((relativePath) => resolve(__dirname, relativePath));

const documentNode = {
  kind: 'Document',
  definitions: schemaPaths.flatMap((schemaPath) => {
    const sdl = readFileSync(schemaPath, 'utf8');
    return parse(sdl).definitions;
  }),
};

const schema = buildASTSchema(documentNode, { assumeValidSDL: true });
const typeMap = schema.getTypeMap();
const typeNames = Object.keys(typeMap)
  .filter((name) => !name.startsWith('__'))
  .sort((a, b) => a.localeCompare(b));

const kotlinKeywords = new Set([
  'as',
  'break',
  'class',
  'continue',
  'do',
  'else',
  'false',
  'for',
  'fun',
  'if',
  'in',
  'interface',
  'is',
  'null',
  'object',
  'package',
  'return',
  'super',
  'this',
  'throw',
  'true',
  'try',
  'typealias',
  'val',
  'var',
  'when',
  'while',
]);

const escapeKotlinName = (name) => (kotlinKeywords.has(name) ? `\`${name}\`` : name);

const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1);

const pascalCase = (value) => {
  const tokens = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-\s]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((token) => token.toLowerCase());
  if (tokens.length === 0) return value;
  return tokens.map(capitalize).join('');
};

const toConstantCase = (value) => value
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
  .replace(/[-\s]+/g, '_')
  .toUpperCase();

const toKebabCase = (value) => value
  .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
  .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
  .replace(/[_\s]+/g, '-')
  .replace(/-+/g, '-')
  .toLowerCase();

const scalarMap = new Map([
  ['ID', 'String'],
  ['String', 'String'],
  ['Boolean', 'Boolean'],
  ['Int', 'Int'],
  ['Float', 'Double'],
]);

const enumNames = new Set();
const interfaceNames = new Set();
const objectNames = new Set();
const inputNames = new Set();
const unionNames = new Set();

const addDocComment = (lines, description, indent = '') => {
  if (!description) return;
  lines.push(`${indent}/**`);
  for (const docLine of description.split(/\r?\n/)) {
    lines.push(`${indent} * ${docLine}`);
  }
  lines.push(`${indent} */`);
};

const unionMembership = new Map();
const unions = [];
const enums = [];
const interfaces = [];
const objects = [];
const inputs = [];
const operationTypes = [];

const unionWrapperNames = new Set();
for (const schemaPath of schemaPaths) {
  let expectTypeName = false;
  for (const line of readFileSync(schemaPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#') && trimmed.toLowerCase().includes('=> union')) {
      expectTypeName = true;
      continue;
    }
    if (expectTypeName) {
      if (trimmed.length === 0) {
        continue;
      }
      if (trimmed.startsWith('#')) {
        continue;
      }
      const typeMatch = trimmed.match(/^type\s+([A-Za-z0-9_]+)/);
      if (typeMatch) {
        unionWrapperNames.add(typeMatch[1]);
      }
      expectTypeName = false;
    }
  }
}

for (const name of typeNames) {
  const type = typeMap[name];
  if (isScalarType(type)) {
    if (scalarMap.has(type.name)) continue;
    continue;
  }
  if (isEnumType(type)) {
    enums.push(type);
    continue;
  }
  if (isInterfaceType(type)) {
    interfaces.push(type);
    continue;
  }
  if (isUnionType(type)) {
    unions.push(type);
    for (const member of type.getTypes()) {
      if (!unionMembership.has(member.name)) {
        unionMembership.set(member.name, new Set());
      }
      unionMembership.get(member.name).add(type.name);
    }
    continue;
  }
  if (isObjectType(type)) {
    if (['Query', 'Mutation', 'Subscription'].includes(name)) {
      operationTypes.push(type);
      continue;
    }
    objects.push(type);
    continue;
  }
  if (isInputObjectType(type)) {
    inputs.push(type);
  }
}

for (const enumType of enums) {
  enumNames.add(enumType.name);
}
for (const interfaceType of interfaces) {
  interfaceNames.add(interfaceType.name);
}
for (const objectType of objects) {
  objectNames.add(objectType.name);
}
for (const inputType of inputs) {
  inputNames.add(inputType.name);
}
for (const unionType of unions) {
  unionNames.add(unionType.name);
}

const singleFieldObjects = new Map();
for (const objectType of objects) {
  const fields = Object.values(objectType.getFields());
  if (fields.length === 1 && objectType.name.endsWith('Args')) {
    singleFieldObjects.set(objectType.name, fields[0].type);
  }
}

const getTypeMetadata = (graphqlType) => {
  if (graphqlType instanceof GraphQLNonNull) {
    const inner = getTypeMetadata(graphqlType.ofType);
    return { ...inner, nullable: false };
  }
  if (graphqlType instanceof GraphQLList) {
    const inner = getTypeMetadata(graphqlType.ofType);
    const elementType = { ...inner };
    const elementKotlin = inner.kotlinType + (inner.nullable ? '?' : '');
    return {
      kind: 'list',
      nullable: true,
      elementType,
      kotlinType: `List<${elementKotlin}>`,
    };
  }
  const typeName = graphqlType.name;
  let kind = 'object';
  if (scalarMap.has(typeName)) {
    kind = 'scalar';
  } else if (enumNames.has(typeName)) {
    kind = 'enum';
  } else if (interfaceNames.has(typeName)) {
    kind = 'interface';
  } else if (inputNames.has(typeName)) {
    kind = 'input';
  } else if (unionNames.has(typeName)) {
    kind = 'union';
  } else if (objectNames.has(typeName)) {
    kind = 'object';
  }
  const kotlinType = scalarMap.get(typeName) ?? typeName;
  return {
    kind,
    name: typeName,
    nullable: true,
    kotlinType,
  };
};

const getKotlinType = (graphqlType) => {
  const metadata = getTypeMetadata(graphqlType);
  return { type: metadata.kotlinType, nullable: metadata.nullable, metadata };
};

const resultUnionObjects = new Map();
for (const objectType of objects) {
  const fields = Object.values(objectType.getFields()).sort((a, b) => a.name.localeCompare(b.name));
  if (fields.length === 0) continue;
  if (!unionWrapperNames.has(objectType.name)) continue;
  const unionEntries = [];
  let allOptional = true;
  for (const field of fields) {
    if (field.type instanceof GraphQLNonNull) {
      allOptional = false;
      break;
    }
    const { type, nullable } = getKotlinType(field.type);
    unionEntries.push({ field, type, nullable });
  }
  if (!allOptional) continue;
  if (unionEntries.length === 0) continue;
  resultUnionObjects.set(objectType.name, unionEntries);
}

const unwrapNonNull = (graphqlType) => {
  let current = graphqlType;
  while (current instanceof GraphQLNonNull) {
    current = current.ofType;
  }
  return current;
};

const getNamedGraphQLType = (graphqlType) => {
  const unwrapped = unwrapNonNull(graphqlType);
  if (unwrapped instanceof GraphQLList) {
    return null;
  }
  return unwrapped;
};

const isNullableGraphQLType = (graphqlType) => !(graphqlType instanceof GraphQLNonNull);

const getOperationReturnType = (graphqlType) => {
  const base = getKotlinType(graphqlType);
  if (base.metadata.kind === 'list') {
    return base;
  }
  const namedType = getNamedGraphQLType(graphqlType);
  if (namedType && namedType.name === 'VoidResult') {
    return {
      type: 'Unit',
      nullable: isNullableGraphQLType(graphqlType),
      metadata: base.metadata,
    };
  }
  if (!namedType) {
    return base;
  }
  const singleFieldType = singleFieldObjects.get(namedType.name);
  if (!singleFieldType) {
    return base;
  }
  const fieldInfo = getKotlinType(singleFieldType);
  const finalNullable = base.nullable || fieldInfo.nullable || isNullableGraphQLType(graphqlType);
  return {
    type: fieldInfo.type,
    nullable: finalNullable,
    metadata: fieldInfo.metadata,
  };
};

const buildFromJsonExpression = (metadata, sourceExpression) => {
  if (metadata.kind === 'list') {
    const element = buildFromJsonExpression(metadata.elementType, 'it');
    if (metadata.nullable) {
      return `(${sourceExpression} as List<*>?)?.map { ${element} }`;
    }
    return `(${sourceExpression} as List<*>).map { ${element} }`;
  }
  if (metadata.kind === 'scalar') {
    switch (metadata.name) {
      case 'Float':
        return metadata.nullable
          ? `(${sourceExpression} as Number?)?.toDouble()`
          : `(${sourceExpression} as Number).toDouble()`;
      case 'Int':
        return metadata.nullable
          ? `(${sourceExpression} as Number?)?.toInt()`
          : `(${sourceExpression} as Number).toInt()`;
      case 'Boolean':
        return metadata.nullable
          ? `${sourceExpression} as Boolean?`
          : `${sourceExpression} as Boolean`;
      case 'ID':
      case 'String':
        return metadata.nullable
          ? `${sourceExpression} as String?`
          : `${sourceExpression} as String`;
      default:
        return metadata.nullable ? `${sourceExpression}` : `${sourceExpression}`;
    }
  }
  if (metadata.kind === 'enum') {
    return metadata.nullable
      ? `(${sourceExpression} as String?)?.let { ${metadata.name}.fromJson(it) }`
      : `${metadata.name}.fromJson(${sourceExpression} as String)`;
  }
  if (['object', 'input', 'interface', 'union'].includes(metadata.kind)) {
    const cast = metadata.nullable
      ? `(${sourceExpression} as Map<String, Any?>?)`
      : `(${sourceExpression} as Map<String, Any?>)`;
    const callTarget = metadata.name ?? metadata.kotlinType;
    return metadata.nullable
      ? `${cast}?.let { ${callTarget}.fromJson(it) }`
      : `${callTarget}.fromJson(${cast})`;
  }
  return metadata.nullable ? `${sourceExpression}` : `${sourceExpression}`;
};

const buildToJsonExpression = (metadata, accessorExpression) => {
  if (metadata.kind === 'list') {
    const inner = buildToJsonExpression(metadata.elementType, 'it');
    return metadata.nullable
      ? `${accessorExpression}?.map { ${inner} }`
      : `${accessorExpression}.map { ${inner} }`;
  }
  if (metadata.kind === 'enum') {
    return metadata.nullable ? `${accessorExpression}?.toJson()` : `${accessorExpression}.toJson()`;
  }
  if (['object', 'input', 'interface', 'union'].includes(metadata.kind)) {
    return metadata.nullable ? `${accessorExpression}?.toJson()` : `${accessorExpression}.toJson()`;
  }
  return accessorExpression;
};

const lines = [];
lines.push(
  '// ============================================================================',
  '// AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY',
  "// Run `npm run generate` after updating any *.graphql schema file.",
  '// ============================================================================',
  '',
  '@file:Suppress("unused", "UNCHECKED_CAST")',
  ''
);

const printEnum = (enumType) => {
  addDocComment(lines, enumType.description);
  lines.push(`public enum class ${enumType.name}(val rawValue: String) {`);
  const values = enumType.getValues();
  values.forEach((value, index) => {
    addDocComment(lines, value.description, '    ');
    const caseName = escapeKotlinName(pascalCase(value.name));
    const rawValue = toKebabCase(value.name);
    const suffix = index === values.length - 1 ? '' : ',';
    lines.push(`    ${caseName}("${rawValue}")${suffix}`);
  });
  lines.push('', '    companion object {');
  lines.push(`        fun fromJson(value: String): ${enumType.name} = when (value) {`);
  values.forEach((value) => {
    const caseName = escapeKotlinName(pascalCase(value.name));
    const rawValue = toKebabCase(value.name);
    const legacyValues = Array.from(new Set([toConstantCase(value.name), value.name]))
      .filter((candidate) => candidate !== rawValue);
    lines.push(`            "${rawValue}" -> ${enumType.name}.${caseName}`);
    legacyValues.forEach((legacy) => {
      lines.push(`            "${legacy}" -> ${enumType.name}.${caseName}`);
    });
  });
  lines.push(`            else -> throw IllegalArgumentException("Unknown ${enumType.name} value: $value")`, '        }');
  lines.push('    }', '');
  lines.push('    fun toJson(): String = rawValue');
  lines.push('}', '');
};

const printInterface = (interfaceType) => {
  addDocComment(lines, interfaceType.description);
  lines.push(`public interface ${interfaceType.name} {`);
  const fields = Object.values(interfaceType.getFields()).sort((a, b) => a.name.localeCompare(b.name));
  for (const field of fields) {
    addDocComment(lines, field.description, '    ');
    const { type, nullable } = getKotlinType(field.type);
    const propertyType = type + (nullable ? '?' : '');
    const propertyName = escapeKotlinName(field.name);
    lines.push(`    val ${propertyName}: ${propertyType}`);
  }
  lines.push('}', '');
};

const printDataClass = (objectType) => {
  if (objectType.name === 'VoidResult') {
    lines.push('public typealias VoidResult = Unit', '');
    return;
  }
  if (resultUnionObjects.has(objectType.name)) {
    addDocComment(lines, objectType.description);
    lines.push(`public sealed interface ${objectType.name}`, '');
    const unionEntries = resultUnionObjects.get(objectType.name);
    unionEntries.forEach(({ field, type, nullable }) => {
      const className = `${objectType.name}${capitalize(field.name)}`;
      const propertyType = `${type}${nullable ? '?' : ''}`;
      lines.push(`public data class ${className}(val value: ${propertyType}) : ${objectType.name}`, '');
    });
    return;
  }
  addDocComment(lines, objectType.description);
  const interfacesForObject = objectType.getInterfaces().map((iface) => iface.name);
  const unionInterfaces = unionMembership.has(objectType.name)
    ? Array.from(unionMembership.get(objectType.name)).sort()
    : [];
  const fields = Object.values(objectType.getFields()).sort((a, b) => a.name.localeCompare(b.name));
  if (fields.length === 0) {
    lines.push(`public class ${objectType.name}`);
    lines.push('');
    return;
  }
  const fieldInfos = fields.map((field) => {
    const { type, nullable, metadata } = getKotlinType(field.type);
    const propertyType = type + (nullable ? '?' : '');
    const propertyName = escapeKotlinName(field.name);
    const defaultValue = nullable ? ' = null' : '';
    return { field, propertyName, propertyType, defaultValue, metadata };
  });
  lines.push(`public data class ${objectType.name}(`);
  fieldInfos.forEach(({ field, propertyName, propertyType, defaultValue }, index) => {
    addDocComment(lines, field.description, '    ');
    const suffix = index === fieldInfos.length - 1 ? '' : ',';
    lines.push(`    val ${propertyName}: ${propertyType}${defaultValue}${suffix}`);
  });
  const implementsList = [...interfacesForObject, ...unionInterfaces];
  if (implementsList.length > 0) {
    lines.push(`) : ${implementsList.join(', ')} {`);
  } else {
    lines.push(') {');
  }
  lines.push('');
  lines.push('    companion object {');
  lines.push(`        fun fromJson(json: Map<String, Any?>): ${objectType.name} {`);
  lines.push(`            return ${objectType.name}(`);
  fieldInfos.forEach(({ field, propertyName, metadata }) => {
    const expression = buildFromJsonExpression(metadata, `json["${field.name}"]`);
    lines.push(`                ${propertyName} = ${expression},`);
  });
  lines.push('            )');
  lines.push('        }');
  lines.push('    }', '');
  const overrideKeyword = unionInterfaces.length > 0 ? 'override ' : '';
  lines.push(`    ${overrideKeyword}fun toJson(): Map<String, Any?> = mapOf(`);
  lines.push(`        "__typename" to "${objectType.name}",`);
  fieldInfos.forEach(({ field, propertyName, metadata }) => {
    const expression = buildToJsonExpression(metadata, propertyName);
    lines.push(`        "${field.name}" to ${expression},`);
  });
  lines.push('    )');
  lines.push('}', '');
};

const printInput = (inputType) => {
  // Alias PurchaseInput to Purchase for cleaner API
  if (inputType.name === 'PurchaseInput') {
    lines.push('public typealias PurchaseInput = Purchase');
    lines.push('');
    return;
  }
  if (inputType.name === 'RequestPurchaseProps') {
    addDocComment(lines, inputType.description);
    lines.push('public data class RequestPurchaseProps(');
    lines.push('    val request: Request,');
    lines.push('    val type: ProductQueryType,');
    lines.push('    val useAlternativeBilling: Boolean? = null');
    lines.push(') {');
    lines.push('    init {');
    lines.push('        when (request) {');
    lines.push('            is Request.Purchase -> require(type == ProductQueryType.InApp) { "type must be IN_APP when request is purchase" }');
    lines.push('            is Request.Subscription -> require(type == ProductQueryType.Subs) { "type must be SUBS when request is subscription" }');
    lines.push('        }');
    lines.push('    }');
    lines.push('');
    lines.push('    companion object {');
    lines.push('        fun fromJson(json: Map<String, Any?>): RequestPurchaseProps {');
    lines.push('            val rawType = (json["type"] as String?)?.let { ProductQueryType.fromJson(it) }');
    lines.push('            val useAlternativeBilling = json["useAlternativeBilling"] as Boolean?');
    lines.push('            val purchaseJson = json["requestPurchase"] as Map<String, Any?>?');
    lines.push('            if (purchaseJson != null) {');
    lines.push('                val request = Request.Purchase(RequestPurchasePropsByPlatforms.fromJson(purchaseJson))');
    lines.push('                val finalType = rawType ?: ProductQueryType.InApp');
    lines.push('                require(finalType == ProductQueryType.InApp) { "type must be IN_APP when requestPurchase is provided" }');
    lines.push('                return RequestPurchaseProps(request = request, type = finalType, useAlternativeBilling = useAlternativeBilling)');
    lines.push('            }');
    lines.push('            val subscriptionJson = json["requestSubscription"] as Map<String, Any?>?');
    lines.push('            if (subscriptionJson != null) {');
    lines.push('                val request = Request.Subscription(RequestSubscriptionPropsByPlatforms.fromJson(subscriptionJson))');
    lines.push('                val finalType = rawType ?: ProductQueryType.Subs');
    lines.push('                require(finalType == ProductQueryType.Subs) { "type must be SUBS when requestSubscription is provided" }');
    lines.push('                return RequestPurchaseProps(request = request, type = finalType, useAlternativeBilling = useAlternativeBilling)');
    lines.push('            }');
    lines.push('            throw IllegalArgumentException("RequestPurchaseProps requires requestPurchase or requestSubscription")');
    lines.push('        }');
    lines.push('    }');
    lines.push('');
    lines.push('    fun toJson(): Map<String, Any?> = when (request) {');
    lines.push('        is Request.Purchase -> mapOf(');
    lines.push('            "requestPurchase" to request.value.toJson(),');
    lines.push('            "type" to type.toJson(),');
    lines.push('            "useAlternativeBilling" to useAlternativeBilling,');
    lines.push('        )');
    lines.push('        is Request.Subscription -> mapOf(');
    lines.push('            "requestSubscription" to request.value.toJson(),');
    lines.push('            "type" to type.toJson(),');
    lines.push('            "useAlternativeBilling" to useAlternativeBilling,');
    lines.push('        )');
    lines.push('    }');
    lines.push('');
    lines.push('    sealed class Request {');
    lines.push('        data class Purchase(val value: RequestPurchasePropsByPlatforms) : Request()');
    lines.push('        data class Subscription(val value: RequestSubscriptionPropsByPlatforms) : Request()');
    lines.push('    }');
    lines.push('}');
    lines.push('');
    return;
  }
  addDocComment(lines, inputType.description);
  lines.push(`public data class ${inputType.name}(`);
  const fields = Object.values(inputType.getFields()).sort((a, b) => a.name.localeCompare(b.name));
  const fieldInfos = fields.map((field) => {
    const { type, nullable, metadata } = getKotlinType(field.type);
    const propertyType = type + (nullable ? '?' : '');
    const propertyName = escapeKotlinName(field.name);
    const defaultValue = nullable ? ' = null' : '';
    return { field, propertyName, propertyType, defaultValue, metadata };
  });
  fieldInfos.forEach(({ field, propertyName, propertyType, defaultValue }, index) => {
    addDocComment(lines, field.description, '    ');
    const suffix = index === fieldInfos.length - 1 ? '' : ',';
    lines.push(`    val ${propertyName}: ${propertyType}${defaultValue}${suffix}`);
  });
  lines.push(') {');
  lines.push('    companion object {');
  lines.push(`        fun fromJson(json: Map<String, Any?>): ${inputType.name} {`);
  lines.push(`            return ${inputType.name}(`);
  fieldInfos.forEach(({ field, propertyName, metadata }) => {
    const expression = buildFromJsonExpression(metadata, `json["${field.name}"]`);
    lines.push(`                ${propertyName} = ${expression},`);
  });
  lines.push('            )');
  lines.push('        }');
  lines.push('    }', '');
  lines.push('    fun toJson(): Map<String, Any?> = mapOf(');
  fieldInfos.forEach(({ field, propertyName, metadata }) => {
    const expression = buildToJsonExpression(metadata, propertyName);
    lines.push(`        "${field.name}" to ${expression},`);
  });
  lines.push('    )');
  lines.push('}', '');
};

const printUnion = (unionType) => {
  addDocComment(lines, unionType.description);
  const memberTypes = unionType.getTypes();
  const members = memberTypes.map((member) => member.name).sort();

  let sharedInterfaceNames = [];
  if (memberTypes.length > 0) {
    const [firstMember, ...otherMembers] = memberTypes;
    const firstInterfaces = new Set(firstMember.getInterfaces().map((iface) => iface.name));
    for (const member of otherMembers) {
      const memberInterfaces = new Set(member.getInterfaces().map((iface) => iface.name));
      for (const ifaceName of Array.from(firstInterfaces)) {
        if (!memberInterfaces.has(ifaceName)) {
          firstInterfaces.delete(ifaceName);
        }
      }
    }
    sharedInterfaceNames = Array.from(firstInterfaces).sort();
  }

  const implementations = sharedInterfaceNames.length ? ` : ${sharedInterfaceNames.join(', ')}` : '';
  lines.push(`public sealed interface ${unionType.name}${implementations} {`);
  lines.push('    fun toJson(): Map<String, Any?>', '');
  lines.push('    companion object {');
  lines.push(`        fun fromJson(json: Map<String, Any?>): ${unionType.name} {`);
  lines.push('            return when (json["__typename"] as String?) {');
  members.forEach((member) => {
    lines.push(`                "${member}" -> ${member}.fromJson(json)`);
  });
  lines.push(`                else -> throw IllegalArgumentException("Unknown __typename for ${unionType.name}: ${'$'}{json["__typename"]}")`);
  lines.push('            }');
  lines.push('        }');
  lines.push('    }');
  lines.push('}', '');
};

const printOperationInterface = (operationType) => {
  const interfaceName = `${operationType.name}Resolver`;
  addDocComment(lines, operationType.description ?? `GraphQL root ${operationType.name.toLowerCase()} operations.`);
  lines.push(`public interface ${interfaceName} {`);
  const fields = Object.values(operationType.getFields())
    .filter((field) => field.name !== '_placeholder')
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const field of fields) {
    addDocComment(lines, field.description, '    ');
    const { type, nullable } = getOperationReturnType(field.type);
    const returnType = type + (nullable ? '?' : '');
    const args = field.args.map((arg) => {
      const { type: argType, nullable: argNullable } = getKotlinType(arg.type);
      const argumentType = argType + (argNullable ? '?' : '');
      const defaultValue = argNullable ? ' = null' : '';
      return `${escapeKotlinName(arg.name)}: ${argumentType}${defaultValue}`;
    });
    const params = args.length > 0 ? args.join(', ') : '';
    const paramSegment = params ? `(${params})` : '()';
    lines.push(`    suspend fun ${escapeKotlinName(field.name)}${paramSegment}: ${returnType}`);
  }
  lines.push('}', '');
};

const printOperationHelpers = (operationType) => {
  const rootName = operationType.name;
  const fields = Object.values(operationType.getFields())
    .filter((field) => field.name !== '_placeholder')
    .sort((a, b) => a.name.localeCompare(b.name));
  if (fields.length === 0) return;

  lines.push(`// MARK: - ${rootName} Helpers`, '');

  fields.forEach((field) => {
    const aliasName = `${rootName}${capitalize(field.name)}Handler`;
    const { type, nullable } = getOperationReturnType(field.type);
    const returnType = type + (nullable ? '?' : '');
    if (field.args.length === 0) {
      lines.push(`public typealias ${aliasName} = suspend () -> ${returnType}`);
      return;
    }
    const argsSignature = field.args.map((arg) => {
      const { type: argType, nullable: argNullable } = getKotlinType(arg.type);
      const argumentType = argType + (argNullable ? '?' : '');
      return `${escapeKotlinName(arg.name)}: ${argumentType}`;
    }).join(', ');
    lines.push(`public typealias ${aliasName} = suspend (${argsSignature}) -> ${returnType}`);
  });

  const helperClass = `${rootName}Handlers`;
  lines.push('', `public data class ${helperClass}(`);
  fields.forEach((field, index) => {
    const aliasName = `${rootName}${capitalize(field.name)}Handler`;
    const propertyName = escapeKotlinName(field.name);
    const suffix = index === fields.length - 1 ? '' : ',';
    lines.push(`    val ${propertyName}: ${aliasName}? = null${suffix}`);
  });
  lines.push(')', '');
};

if (enums.length) {
  lines.push('// MARK: - Enums', '');
  enums.sort((a, b) => a.name.localeCompare(b.name)).forEach(printEnum);
}

if (interfaces.length) {
  lines.push('// MARK: - Interfaces', '');
  interfaces.sort((a, b) => a.name.localeCompare(b.name)).forEach(printInterface);
}

if (objects.length) {
  lines.push('// MARK: - Objects', '');
  objects.sort((a, b) => a.name.localeCompare(b.name)).forEach(printDataClass);
}

if (inputs.length) {
  lines.push('// MARK: - Input Objects', '');
  inputs.sort((a, b) => a.name.localeCompare(b.name)).forEach(printInput);
}

if (unions.length) {
  lines.push('// MARK: - Unions', '');
  unions.sort((a, b) => a.name.localeCompare(b.name)).forEach(printUnion);
}

if (operationTypes.length) {
  lines.push('// MARK: - Root Operations', '');
  operationTypes.sort((a, b) => a.name.localeCompare(b.name)).forEach(printOperationInterface);
}

if (operationTypes.length) {
  lines.push('// MARK: - Root Operation Helpers', '');
  operationTypes.sort((a, b) => a.name.localeCompare(b.name)).forEach(printOperationHelpers);
}

const outputPath = resolve(__dirname, '../src/generated/Types.kt');
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, lines.join('\n'));

// eslint-disable-next-line no-console
console.log('[generate-kotlin-types] wrote', outputPath);
