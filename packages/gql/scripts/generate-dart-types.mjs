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

const dartKeywords = new Set([
  'abstract', 'as', 'assert', 'async', 'await', 'break', 'case', 'catch', 'class', 'const',
  'continue', 'covariant', 'default', 'deferred', 'do', 'dynamic', 'else', 'enum', 'export',
  'extends', 'extension', 'external', 'factory', 'false', 'final', 'finally', 'for', 'Function',
  'get', 'hide', 'if', 'implements', 'import', 'in', 'interface', 'is', 'late', 'library', 'mixin',
  'new', 'null', 'on', 'operator', 'part', 'required', 'rethrow', 'return', 'set', 'show', 'static',
  'super', 'switch', 'sync', 'this', 'throw', 'true', 'try', 'typedef', 'var', 'void', 'while', 'with',
  'yield',
]);

const dartKeywordOverrides = new Map([
  ['deferred', 'deferred'],
]);

const escapeDartName = (name) => {
  if (dartKeywordOverrides.has(name)) {
    return dartKeywordOverrides.get(name);
  }
  return dartKeywords.has(name) ? `_${name}` : name;
};

const toCamelCase = (value, upper = false) => {
  const tokens = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-\s]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((token) => token.toLowerCase());
  if (tokens.length === 0) return value;
  const normalized = tokens.map((token) => (token === 'ios' ? 'IOS' : token));
  const [first, ...rest] = normalized;
  const formatFirst = () => {
    if (first === 'IOS') {
      return upper ? 'IOS' : 'ios';
    }
    return upper ? first.charAt(0).toUpperCase() + first.slice(1) : first;
  };
  const firstToken = formatFirst();
  const restTokens = rest.map((token) => (token === 'IOS' ? 'IOS' : token.charAt(0).toUpperCase() + token.slice(1)));
  return [firstToken, ...restTokens].join('');
};

const toPascalCase = (value) => toCamelCase(value, true);

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
  ['Boolean', 'bool'],
  ['Int', 'int'],
  ['Float', 'double'],
]);

const addDocComment = (lines, description, indent = '') => {
  if (!description) return;
  for (const docLine of description.split(/\r?\n/)) {
    lines.push(`${indent}/// ${docLine}`);
  }
};

const unionMembership = new Map();
const enums = [];
const interfaces = [];
const objects = [];
const inputs = [];
const unions = [];
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

const enumNames = new Set(enums.map((value) => value.name));
const interfaceNames = new Set(interfaces.map((value) => value.name));
const objectNames = new Set(objects.map((value) => value.name));
const inputNames = new Set(inputs.map((value) => value.name));
const unionNames = new Set(unions.map((value) => value.name));

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
    const innerType = inner.dartType + (inner.nullable ? '?' : '');
    return {
      kind: 'list',
      nullable: true,
      elementType: inner,
      dartType: `List<${innerType}>`,
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
  const dartType = scalarMap.get(typeName) ?? typeName;
  return {
    kind,
    name: typeName,
    nullable: true,
    dartType,
  };
};

const getDartType = (graphqlType) => {
  const metadata = getTypeMetadata(graphqlType);
  return { type: metadata.dartType, nullable: metadata.nullable, metadata };
};

const isNullableGraphQLType = (graphqlType) => !(graphqlType instanceof GraphQLNonNull);

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

const getOperationReturnType = (graphqlType) => {
  const base = getDartType(graphqlType);
  if (base.metadata.kind === 'list') {
    return base;
  }
  const namedType = getNamedGraphQLType(graphqlType);
  if (namedType && namedType.name === 'VoidResult') {
    return {
      type: 'void',
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
  const fieldInfo = getDartType(singleFieldType);
  const finalNullable = base.nullable || fieldInfo.nullable || isNullableGraphQLType(graphqlType);
  return {
    type: fieldInfo.type,
    nullable: finalNullable,
    metadata: fieldInfo.metadata,
  };
};

const resultUnionObjects = new Map();
for (const objectType of objects) {
  if (!unionWrapperNames.has(objectType.name)) continue;
  const fields = Object.values(objectType.getFields()).sort((a, b) => a.name.localeCompare(b.name));
  if (fields.length === 0) continue;
  const unionEntries = [];
  let allOptional = true;
  for (const field of fields) {
    if (field.type instanceof GraphQLNonNull) {
      allOptional = false;
      break;
    }
    const { type, nullable, metadata } = getDartType(field.type);
    unionEntries.push({ field, type, nullable, metadata });
  }
  if (!allOptional) continue;
  if (unionEntries.length === 0) continue;
  resultUnionObjects.set(objectType.name, unionEntries);
}

const buildFromJsonExpression = (metadata, sourceExpression) => {
  if (metadata.kind === 'list') {
    const listCast = `(${sourceExpression} as List<dynamic>${metadata.nullable ? '?' : ''})`;
    const elementExpression = buildFromJsonExpression(metadata.elementType, 'e');
    const mapCall = (target) => `${target}.map((e) => ${elementExpression}).toList()`;
    if (metadata.nullable) {
      return `${listCast} == null ? null : ${mapCall(`${listCast}!`)}`;
    }
    return mapCall(listCast);
  }
  if (metadata.kind === 'scalar') {
    switch (metadata.name) {
      case 'Float':
        return metadata.nullable
          ? `(${sourceExpression} as num?)?.toDouble()`
          : `(${sourceExpression} as num).toDouble()`;
      case 'Int':
        return metadata.nullable
          ? `${sourceExpression} as int?`
          : `${sourceExpression} as int`;
      case 'Boolean':
        return metadata.nullable
          ? `${sourceExpression} as bool?`
          : `${sourceExpression} as bool`;
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
      ? `${sourceExpression} != null ? ${metadata.name}.fromJson(${sourceExpression} as String) : null`
      : `${metadata.name}.fromJson(${sourceExpression} as String)`;
  }
  if (['object', 'input', 'interface', 'union'].includes(metadata.kind)) {
    return metadata.nullable
      ? `${sourceExpression} != null ? ${metadata.dartType}.fromJson(${sourceExpression} as Map<String, dynamic>) : null`
      : `${metadata.dartType}.fromJson(${sourceExpression} as Map<String, dynamic>)`;
  }
  return metadata.nullable ? `${sourceExpression}` : `${sourceExpression}`;
};

const buildToJsonExpression = (metadata, accessorExpression) => {
  if (metadata.kind === 'list') {
    const inner = buildToJsonExpression(metadata.elementType, 'e');
    if (metadata.nullable) {
      return `${accessorExpression} == null ? null : ${accessorExpression}!.map((e) => ${inner}).toList()`;
    }
    return `${accessorExpression}.map((e) => ${inner}).toList()`;
  }
  if (metadata.kind === 'enum') {
    return metadata.nullable
      ? `${accessorExpression}?.toJson()`
      : `${accessorExpression}.toJson()`;
  }
  if (['object', 'input', 'interface', 'union'].includes(metadata.kind)) {
    return metadata.nullable
      ? `${accessorExpression}?.toJson()`
      : `${accessorExpression}.toJson()`;
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
  '// ignore_for_file: unused_element, unused_field',
  '',
  "import 'dart:async';",
  '',
);

const printEnum = (enumType) => {
  addDocComment(lines, enumType.description);
  lines.push(`enum ${enumType.name} {`);
  const values = enumType.getValues();
  values.forEach((value, index) => {
    addDocComment(lines, value.description, '  ');
    const name = escapeDartName(toPascalCase(value.name));
    const rawValue = toKebabCase(value.name);
    const suffix = index === values.length - 1 ? ';' : ',';
    lines.push(`  ${name}('${rawValue}')${suffix}`);
  });
  lines.push(
    '',
    `  const ${enumType.name}(this.value);`,
    '  final String value;',
    '',
    `  factory ${enumType.name}.fromJson(String value) {`,
    '    switch (value) {'
  );
  values.forEach((value) => {
    const name = escapeDartName(toPascalCase(value.name));
    const rawValue = toKebabCase(value.name);
    const legacyValues = Array.from(new Set([toConstantCase(value.name), value.name]))
      .filter((candidate) => candidate !== rawValue);
    lines.push(`      case '${rawValue}':`);
    legacyValues.forEach((legacy) => {
      lines.push(`      case '${legacy}':`);
    });
    lines.push(`        return ${enumType.name}.${name};`);
  });
  lines.push(
    '    }',
    `    throw ArgumentError('Unknown ${enumType.name} value: $value');`,
    '  }',
    '',
    '  String toJson() => value;',
    '}',
    ''
  );
};

const printInterface = (interfaceType) => {
  addDocComment(lines, interfaceType.description);
  lines.push(`abstract class ${interfaceType.name} {`);
  const fields = Object.values(interfaceType.getFields()).sort((a, b) => a.name.localeCompare(b.name));
  for (const field of fields) {
    addDocComment(lines, field.description, '  ');
    const { type, nullable } = getDartType(field.type);
    const fieldType = `${type}${nullable ? '?' : ''}`;
    const fieldName = escapeDartName(field.name);
    lines.push(`  ${fieldType} get ${fieldName};`);
  }
  lines.push('}', '');
};

const printObject = (objectType) => {
  if (objectType.name === 'VoidResult') {
    lines.push('typedef VoidResult = void;', '');
    return;
  }
  if (resultUnionObjects.has(objectType.name)) {
    const unionEntries = resultUnionObjects.get(objectType.name);
    addDocComment(lines, objectType.description);
    lines.push(`abstract class ${objectType.name} {`);
    lines.push(`  const ${objectType.name}();`);
    lines.push('}', '');
    unionEntries.forEach(({ field, type, nullable }) => {
      const className = `${objectType.name}${toPascalCase(field.name)}`;
      const valueType = `${type}${nullable ? '?' : ''}`;
      lines.push(`class ${className} extends ${objectType.name} {`);
      lines.push(`  const ${className}(this.value);`);
      lines.push(`  final ${valueType} value;`);
      lines.push('}', '');
    });
    return;
  }
  addDocComment(lines, objectType.description);
  const interfacesForObject = objectType.getInterfaces().map((iface) => iface.name);
  const unionsForObject = unionMembership.has(objectType.name)
    ? Array.from(unionMembership.get(objectType.name)).sort()
    : [];
  const baseUnion = unionsForObject.shift() ?? null;
  const extendsClause = baseUnion ? ` extends ${baseUnion}` : '';
  const implementsTargets = [...interfacesForObject, ...unionsForObject];
  const implementsClause = implementsTargets.length ? ` implements ${implementsTargets.join(', ')}` : '';
  lines.push(`class ${objectType.name}${extendsClause}${implementsClause} {`);
  lines.push(`  const ${objectType.name}({`);
  const fields = Object.values(objectType.getFields()).sort((a, b) => a.name.localeCompare(b.name));

  // Special handling for PurchaseAndroid and PurchaseIOS to add isAlternativeBilling if missing
  const needsAlternativeBilling = (objectType.name === 'PurchaseAndroid' || objectType.name === 'PurchaseIOS')
    && !fields.some(f => f.name === 'isAlternativeBilling');

  const fieldInfos = fields.map((field) => {
    const { type, nullable, metadata } = getDartType(field.type);
    const fieldName = escapeDartName(field.name);
    return { field, fieldName, type, nullable, metadata };
  });

  fieldInfos.forEach(({ field, nullable, fieldName }) => {
    addDocComment(lines, field.description, '    ');
    const line = `    ${nullable ? '' : 'required '}this.${fieldName},`;
    lines.push(line);
  });

  if (needsAlternativeBilling) {
    lines.push('    this.isAlternativeBilling,');
  }

  lines.push('  });', '');
  fieldInfos.forEach(({ field, type, nullable, fieldName }) => {
    addDocComment(lines, field.description, '  ');
    const fieldType = `${type}${nullable ? '?' : ''}`;
    lines.push(`  final ${fieldType} ${fieldName};`);
  });

  if (needsAlternativeBilling) {
    lines.push('  final bool? isAlternativeBilling;');
  }

  lines.push('');
  lines.push(`  factory ${objectType.name}.fromJson(Map<String, dynamic> json) {`);
  lines.push(`    return ${objectType.name}(`);
  fieldInfos.forEach(({ field, fieldName, metadata }) => {
    const jsonExpression = buildFromJsonExpression(metadata, `json['${field.name}']`);
    lines.push(`      ${fieldName}: ${jsonExpression},`);
  });
  if (needsAlternativeBilling) {
    lines.push(`      isAlternativeBilling: json['isAlternativeBilling'] as bool?,`);
  }
  lines.push('    );');
  lines.push('  }', '');
  if (baseUnion) {
    lines.push('  @override');
  }
  lines.push('  Map<String, dynamic> toJson() {');
  lines.push('    return {');
  lines.push(`      '__typename': '${objectType.name}',`);
  fieldInfos.forEach(({ field, fieldName, metadata }) => {
    const toJsonExpression = buildToJsonExpression(metadata, fieldName);
    lines.push(`      '${field.name}': ${toJsonExpression},`);
  });
  if (needsAlternativeBilling) {
    lines.push(`      'isAlternativeBilling': isAlternativeBilling,`);
  }
  lines.push('    };');
  lines.push('  }');
  lines.push('}', '');
};

const printInput = (inputType) => {
  // Alias PurchaseInput to Purchase for cleaner API
  if (inputType.name === 'PurchaseInput') {
    lines.push('typedef PurchaseInput = Purchase;');
    lines.push('');
    return;
  }

  // TypeScript-style discriminated union with compile-time safety
  if (inputType.name === 'RequestPurchaseProps') {
    addDocComment(lines, inputType.description);

    // Sealed class for compile-time type safety
    lines.push('sealed class RequestPurchaseProps {');
    lines.push('  const RequestPurchaseProps._();');
    lines.push('');
    lines.push('  const factory RequestPurchaseProps.inApp(({');
    lines.push('    RequestPurchaseIosProps? ios,');
    lines.push('    RequestPurchaseAndroidProps? android,');
    lines.push('    bool? useAlternativeBilling,');
    lines.push('  }) props) = _InAppPurchase;');
    lines.push('');
    lines.push('  const factory RequestPurchaseProps.subs(({');
    lines.push('    RequestSubscriptionIosProps? ios,');
    lines.push('    RequestSubscriptionAndroidProps? android,');
    lines.push('    bool? useAlternativeBilling,');
    lines.push('  }) props) = _SubsPurchase;');
    lines.push('');
    lines.push('  Map<String, dynamic> toJson();');
    lines.push('}');
    lines.push('');

    // Purchase implementation
    lines.push('class _InAppPurchase extends RequestPurchaseProps {');
    lines.push('  const _InAppPurchase(this.props) : super._();');
    lines.push('  final ({');
    lines.push('    RequestPurchaseIosProps? ios,');
    lines.push('    RequestPurchaseAndroidProps? android,');
    lines.push('    bool? useAlternativeBilling,');
    lines.push('  }) props;');
    lines.push('');
    lines.push('  @override');
    lines.push('  Map<String, dynamic> toJson() {');
    lines.push('    return {');
    lines.push("      'requestPurchase': {");
    lines.push("        if (props.ios != null) 'ios': props.ios!.toJson(),");
    lines.push("        if (props.android != null) 'android': props.android!.toJson(),");
    lines.push('      },');
    lines.push("      'type': ProductQueryType.InApp.toJson(),");
    lines.push("      if (props.useAlternativeBilling != null) 'useAlternativeBilling': props.useAlternativeBilling,");
    lines.push('    };');
    lines.push('  }');
    lines.push('}');
    lines.push('');

    // Subscription implementation
    lines.push('class _SubsPurchase extends RequestPurchaseProps {');
    lines.push('  const _SubsPurchase(this.props) : super._();');
    lines.push('  final ({');
    lines.push('    RequestSubscriptionIosProps? ios,');
    lines.push('    RequestSubscriptionAndroidProps? android,');
    lines.push('    bool? useAlternativeBilling,');
    lines.push('  }) props;');
    lines.push('');
    lines.push('  @override');
    lines.push('  Map<String, dynamic> toJson() {');
    lines.push('    return {');
    lines.push("      'requestSubscription': {");
    lines.push("        if (props.ios != null) 'ios': props.ios!.toJson(),");
    lines.push("        if (props.android != null) 'android': props.android!.toJson(),");
    lines.push('      },');
    lines.push("      'type': ProductQueryType.Subs.toJson(),");
    lines.push("      if (props.useAlternativeBilling != null) 'useAlternativeBilling': props.useAlternativeBilling,");
    lines.push('    };');
    lines.push('  }');
    lines.push('}');
    lines.push('');
    return;
  }

  addDocComment(lines, inputType.description);
  lines.push(`class ${inputType.name} {`);
  lines.push(`  const ${inputType.name}({`);
  const fields = Object.values(inputType.getFields()).sort((a, b) => a.name.localeCompare(b.name));
  const fieldInfos = fields.map((field) => {
    const { type, nullable, metadata } = getDartType(field.type);
    const fieldName = escapeDartName(field.name);
    return { field, fieldName, type, nullable, metadata };
  });
  fieldInfos.forEach(({ field, nullable, fieldName }) => {
    addDocComment(lines, field.description, '    ');
    const line = `    ${nullable ? '' : 'required '}this.${fieldName},`;
    lines.push(line);
  });
  lines.push('  });', '');
  fieldInfos.forEach(({ field, type, nullable, fieldName }) => {
    addDocComment(lines, field.description, '  ');
    const fieldType = `${type}${nullable ? '?' : ''}`;
    lines.push(`  final ${fieldType} ${fieldName};`);
  });
  lines.push('');
  lines.push(`  factory ${inputType.name}.fromJson(Map<String, dynamic> json) {`);
  lines.push(`    return ${inputType.name}(`);
  fieldInfos.forEach(({ field, fieldName, metadata }) => {
    const jsonExpression = buildFromJsonExpression(metadata, `json['${field.name}']`);
    lines.push(`      ${fieldName}: ${jsonExpression},`);
  });
  lines.push('    );');
  lines.push('  }', '');
  lines.push('  Map<String, dynamic> toJson() {');
  lines.push('    return {');
  fieldInfos.forEach(({ field, fieldName, metadata }) => {
    const toJsonExpression = buildToJsonExpression(metadata, fieldName);
    lines.push(`      '${field.name}': ${toJsonExpression},`);
  });
  lines.push('    };');
  lines.push('  }');
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

  const implementsClause = sharedInterfaceNames.length ? ` implements ${sharedInterfaceNames.join(', ')}` : '';

  lines.push(`sealed class ${unionType.name}${implementsClause} {`);
  lines.push(`  const ${unionType.name}();`, '');
  lines.push(`  factory ${unionType.name}.fromJson(Map<String, dynamic> json) {`);
  lines.push(`    final typeName = json['__typename'] as String?;`);
  lines.push('    switch (typeName) {');
  members.forEach((member) => {
    lines.push(`      case '${member}':`, `        return ${member}.fromJson(json);`);
  });
  lines.push('    }');
  lines.push(`    throw ArgumentError('Unknown __typename for ${unionType.name}: $typeName');`);
  lines.push('  }', '');

  if (sharedInterfaceNames.length) {
    const interfaceFieldMap = new Map();
    for (const interfaceName of sharedInterfaceNames) {
      const interfaceType = schema.getType(interfaceName);
      if (!interfaceType || !isInterfaceType(interfaceType)) continue;
      const fields = Object.values(interfaceType.getFields()).sort((a, b) => a.name.localeCompare(b.name));
      for (const field of fields) {
        if (interfaceFieldMap.has(field.name)) continue;
        const { type, nullable } = getDartType(field.type);
        interfaceFieldMap.set(field.name, { field, type, nullable });
      }
    }

    const interfaceFields = Array.from(interfaceFieldMap.values()).sort((a, b) => a.field.name.localeCompare(b.field.name));
    interfaceFields.forEach(({ field, type, nullable }) => {
      addDocComment(lines, field.description, '  ');
      const fieldType = `${type}${nullable ? '?' : ''}`;
      const fieldName = escapeDartName(field.name);
      lines.push('  @override');
      lines.push(`  ${fieldType} get ${fieldName};`);
    });
    if (interfaceFields.length) {
      lines.push('');
    }
  }

  lines.push('  Map<String, dynamic> toJson();');
  lines.push('}', '');
};

const expandInputToParams = (inputTypeName) => {
  const inputType = typeMap[inputTypeName];
  if (!inputType || !isInputObjectType(inputType)) return [];

  // Don't expand RequestPurchaseProps - it's now a sealed class union type
  if (inputTypeName === 'RequestPurchaseProps') {
    return [];
  }

  const fields = Object.values(inputType.getFields()).sort((a, b) => a.name.localeCompare(b.name));
  return fields;
};

const printOperationInterface = (operationType) => {
  const interfaceName = `${operationType.name}Resolver`;
  addDocComment(lines, operationType.description ?? `GraphQL root ${operationType.name.toLowerCase()} operations.`);
  lines.push(`abstract class ${interfaceName} {`);
  const fields = Object.values(operationType.getFields())
    .filter((field) => field.name !== '_placeholder')
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const field of fields) {
    addDocComment(lines, field.description, '  ');
    const { type, nullable } = getOperationReturnType(field.type);
    const returnType = `${type}${nullable ? '?' : ''}`;
    if (field.args.length === 0) {
      lines.push(`  Future<${returnType}> ${escapeDartName(field.name)}();`);
      continue;
    }

    // Special handling for v5.x style APIs - expand input objects
    // Don't expand 'purchase' - keep it as an object
    const expandableParams = ['params', 'options', 'config', 'props'];
    const expandableArg = field.args.find(arg => expandableParams.includes(arg.name));

    if (expandableArg) {
      const namedType = getNamedGraphQLType(expandableArg.type);
      if (namedType && isInputObjectType(namedType)) {
        const expandedFields = expandInputToParams(namedType.name);
        const otherArgs = field.args.filter(arg => arg !== expandableArg);

        if (expandedFields.length > 0) {
          // Always use named params when expanding
          lines.push(`  Future<${returnType}> ${escapeDartName(field.name)}({`);

          // Add expanded fields first
          expandedFields.forEach((f) => {
            // Handle synthetic fields (e.g., 'request' field in RequestPurchaseProps)
            if (f.isSynthetic) {
              lines.push(`    required RequestPurchaseRequest ${escapeDartName(f.name)},`);
            } else {
              const { type: argType, nullable: argNullable } = getDartType(f.type);
              const finalType = `${argType}${argNullable ? '?' : ''}`;
              const prefix = argNullable ? '' : 'required ';
              lines.push(`    ${prefix}${finalType} ${escapeDartName(f.name)},`);
            }
          });

          // Add other args
          otherArgs.forEach((arg) => {
            const { type: argType, nullable: argNullable } = getDartType(arg.type);
            const finalType = `${argType}${argNullable ? '?' : ''}`;
            const prefix = argNullable ? '' : 'required ';
            lines.push(`    ${prefix}${finalType} ${escapeDartName(arg.name)},`);
          });

          lines.push('  });');
          continue;
        }
      }
    }

    if (field.args.length === 1) {
      const arg = field.args[0];
      const { type: argType, nullable: argNullable } = getDartType(arg.type);
      const finalType = `${argType}${argNullable ? '?' : ''}`;
      const argName = escapeDartName(arg.name);
      const open = argNullable ? '[' : '';
      const close = argNullable ? ']' : '';
      lines.push(`  Future<${returnType}> ${escapeDartName(field.name)}(${open}${finalType} ${argName}${close});`);
      continue;
    }
    lines.push('  Future<' + returnType + `> ${escapeDartName(field.name)}({`);
    field.args.forEach((arg) => {
      const { type: argType, nullable: argNullable } = getDartType(arg.type);
      const finalType = `${argType}${argNullable ? '?' : ''}`;
      const argName = escapeDartName(arg.name);
      const prefix = argNullable ? '' : 'required ';
      lines.push(`    ${prefix}${finalType} ${argName},`);
    });
    lines.push('  });');
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
    const pascalField = toPascalCase(field.name);
    const aliasName = `${rootName}${pascalField}Handler`;
    const { type, nullable } = getOperationReturnType(field.type);
    const returnType = `${type}${nullable ? '?' : ''}`;
    if (field.args.length === 0) {
      lines.push(`typedef ${aliasName} = Future<${returnType}> Function();`);
      return;
    }

    // Special handling for v5.x style APIs - expand input objects
    // Don't expand 'purchase' - keep it as an object
    const expandableParams = ['params', 'options', 'config', 'props'];
    const expandableArg = field.args.find(arg => expandableParams.includes(arg.name));

    if (expandableArg) {
      const namedType = getNamedGraphQLType(expandableArg.type);
      if (namedType && isInputObjectType(namedType)) {
        const expandedFields = expandInputToParams(namedType.name);
        const otherArgs = field.args.filter(arg => arg !== expandableArg);

        if (expandedFields.length > 0) {
          // Always use named params when expanding
          lines.push(`typedef ${aliasName} = Future<${returnType}> Function({`);

          // Add expanded fields first
          expandedFields.forEach((f) => {
            // Handle synthetic fields (e.g., 'request' field in RequestPurchaseProps)
            if (f.isSynthetic) {
              lines.push(`  required RequestPurchaseRequest ${escapeDartName(f.name)},`);
            } else {
              const { type: argType, nullable: argNullable } = getDartType(f.type);
              const finalType = `${argType}${argNullable ? '?' : ''}`;
              const prefix = argNullable ? '' : 'required ';
              lines.push(`  ${prefix}${finalType} ${escapeDartName(f.name)},`);
            }
          });

          // Add other args
          otherArgs.forEach((arg) => {
            const { type: argType, nullable: argNullable } = getDartType(arg.type);
            const finalType = `${argType}${argNullable ? '?' : ''}`;
            const prefix = argNullable ? '' : 'required ';
            lines.push(`  ${prefix}${finalType} ${escapeDartName(arg.name)},`);
          });

          lines.push('});');
          return;
        }
      }
    }

    if (field.args.length === 1) {
      const arg = field.args[0];
      const { type: argType, nullable: argNullable } = getDartType(arg.type);
      const finalType = `${argType}${argNullable ? '?' : ''}`;
      const argName = escapeDartName(arg.name);
      if (argNullable) {
        lines.push(`typedef ${aliasName} = Future<${returnType}> Function([${finalType} ${argName}]);`);
      } else {
        lines.push(`typedef ${aliasName} = Future<${returnType}> Function(${finalType} ${argName});`);
      }
      return;
    }
    lines.push(`typedef ${aliasName} = Future<${returnType}> Function({`);
    field.args.forEach((arg) => {
      const { type: argType, nullable: argNullable } = getDartType(arg.type);
      const finalType = `${argType}${argNullable ? '?' : ''}`;
      const prefix = argNullable ? '' : 'required ';
      lines.push(`  ${prefix}${finalType} ${escapeDartName(arg.name)},`);
    });
    lines.push('});');
  });

  const helperClass = `${rootName}Handlers`;
  lines.push('', `class ${helperClass} {`);
  lines.push(`  const ${helperClass}({`);
  fields.forEach((field) => {
    lines.push(`    this.${escapeDartName(field.name)},`);
  });
  lines.push('  });', '');
  fields.forEach((field) => {
    const pascalField = toPascalCase(field.name);
    const aliasName = `${rootName}${pascalField}Handler`;
    const propertyName = escapeDartName(field.name);
    lines.push(`  final ${aliasName}? ${propertyName};`);
  });
  lines.push('}', '');
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
  objects.sort((a, b) => a.name.localeCompare(b.name)).forEach(printObject);
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

const outputPath = resolve(__dirname, '../src/generated/types.dart');
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, lines.join('\n'));

// eslint-disable-next-line no-console
console.log('[generate-dart-types] wrote', outputPath);
