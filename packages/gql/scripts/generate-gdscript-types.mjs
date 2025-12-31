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

// GDScript reserved words
const gdscriptKeywords = new Set([
  'if', 'elif', 'else', 'for', 'while', 'match', 'break', 'continue',
  'pass', 'return', 'class', 'class_name', 'extends', 'is', 'in', 'as',
  'self', 'signal', 'func', 'static', 'const', 'enum', 'var', 'onready',
  'export', 'setget', 'tool', 'await', 'yield', 'assert', 'preload',
  'true', 'false', 'null', 'not', 'and', 'or',
]);

const escapeGdscriptName = (name) => gdscriptKeywords.has(name.toLowerCase()) ? `_${name}` : name;

const toSnakeCase = (value) => value
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
  .replace(/[-\s]+/g, '_')
  .toLowerCase();

const toPascalCase = (value) => {
  const tokens = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-\s]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase());
  return tokens.join('');
};

const toConstantCase = (value) => value
  .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
  .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
  .replace(/[-\s]+/g, '_')
  .toUpperCase();

// GDScript type mapping
const scalarMap = new Map([
  ['ID', 'String'],
  ['String', 'String'],
  ['Boolean', 'bool'],
  ['Int', 'int'],
  ['Float', 'float'],
]);

const enumNames = new Set();
const interfaceNames = new Set();
const objectNames = new Set();
const inputNames = new Set();
const unionNames = new Set();

const addDocComment = (lines, description, indent = '') => {
  if (!description) return;
  // Convert multiline to single line for GDScript
  const singleLine = description.replace(/\r?\n/g, ' ').trim();
  lines.push(`${indent}## ${singleLine}`);
};

const unionMembership = new Map();
const unions = [];
const enums = [];
const interfaces = [];
const objects = [];
const inputs = [];
const operationTypes = [];

// Process union wrappers
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
      if (trimmed.length === 0) continue;
      if (trimmed.startsWith('#')) continue;
      const typeMatch = trimmed.match(/^type\s+([A-Za-z0-9_]+)/);
      if (typeMatch) {
        unionWrapperNames.add(typeMatch[1]);
      }
      expectTypeName = false;
    }
  }
}

// Categorize types
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

// Convert GraphQL type to GDScript type
const toGdscriptType = (graphqlType, nullable = true, seenUnions = new Set()) => {
  if (graphqlType instanceof GraphQLNonNull) {
    return toGdscriptType(graphqlType.ofType, false, seenUnions);
  }
  if (graphqlType instanceof GraphQLList) {
    const innerType = toGdscriptType(graphqlType.ofType, true, seenUnions);
    return `Array[${innerType}]`;
  }
  const typeName = graphqlType.name;
  if (scalarMap.has(typeName)) {
    return scalarMap.get(typeName);
  }
  if (enumNames.has(typeName)) {
    return typeName;
  }
  if (unionNames.has(typeName)) {
    // For unions, use Variant (can be any type)
    return 'Variant';
  }
  if (objectNames.has(typeName) || inputNames.has(typeName) || interfaceNames.has(typeName)) {
    return typeName;
  }
  return 'Variant';
};

// Generate GDScript output
const outputLines = [];

outputLines.push('# ============================================================================');
outputLines.push('# AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY');
outputLines.push('# Generated from OpenIAP GraphQL schema (https://openiap.dev)');
outputLines.push('# Run `npm run generate:gdscript` to regenerate this file.');
outputLines.push('# ============================================================================');
outputLines.push('# Usage: const Types = preload("types.gd")');
outputLines.push('#        var store: Types.IapStore = Types.IapStore.APPLE');
outputLines.push('# ============================================================================');
outputLines.push('');

// Generate enums
outputLines.push('# ============================================================================');
outputLines.push('# Enums');
outputLines.push('# ============================================================================');
outputLines.push('');

for (const enumType of enums) {
  addDocComment(outputLines, enumType.description);
  outputLines.push(`enum ${enumType.name} {`);
  const values = enumType.getValues();
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    const enumValueName = toConstantCase(value.name);
    if (value.description) {
      const singleLineDesc = value.description.replace(/\r?\n/g, ' ').trim();
      outputLines.push(`\t## ${singleLineDesc}`);
    }
    outputLines.push(`\t${enumValueName} = ${i},`);
  }
  outputLines.push('}');
  outputLines.push('');
}

// Generate interface/object classes
outputLines.push('# ============================================================================');
outputLines.push('# Types');
outputLines.push('# ============================================================================');
outputLines.push('');

// Helper function to generate class fields
const generateClassFields = (type, lines, indent = '\t') => {
  const fields = type.getFields();
  for (const fieldName of Object.keys(fields)) {
    const field = fields[fieldName];
    const gdscriptType = toGdscriptType(field.type);
    const snakeCaseName = toSnakeCase(escapeGdscriptName(fieldName));

    if (field.description) {
      lines.push(`${indent}## ${field.description.split('\n')[0]}`);
    }
    lines.push(`${indent}var ${snakeCaseName}: ${gdscriptType}`);
  }
};

// Generate classes for objects
for (const objectType of objects) {
  // Skip union wrapper types
  if (unionWrapperNames.has(objectType.name)) continue;

  addDocComment(outputLines, objectType.description);
  outputLines.push(`class ${objectType.name}:`);

  const fields = objectType.getFields();
  if (Object.keys(fields).length === 0) {
    outputLines.push('\tpass');
  } else {
    generateClassFields(objectType, outputLines);

    // Add from_dict method
    outputLines.push('');
    outputLines.push('\tstatic func from_dict(data: Dictionary) -> ' + objectType.name + ':');
    outputLines.push('\t\tvar obj = ' + objectType.name + '.new()');
    for (const fieldName of Object.keys(fields)) {
      const snakeCaseName = toSnakeCase(escapeGdscriptName(fieldName));
      outputLines.push(`\t\tif data.has("${fieldName}"):`);
      outputLines.push(`\t\t\tobj.${snakeCaseName} = data["${fieldName}"]`);
    }
    outputLines.push('\t\treturn obj');

    // Add to_dict method
    outputLines.push('');
    outputLines.push('\tfunc to_dict() -> Dictionary:');
    outputLines.push('\t\treturn {');
    const fieldNames = Object.keys(fields);
    for (let i = 0; i < fieldNames.length; i++) {
      const fieldName = fieldNames[i];
      const snakeCaseName = toSnakeCase(escapeGdscriptName(fieldName));
      const comma = i < fieldNames.length - 1 ? ',' : '';
      outputLines.push(`\t\t\t"${fieldName}": ${snakeCaseName}${comma}`);
    }
    outputLines.push('\t\t}');
  }
  outputLines.push('');
}

// Generate classes for inputs
outputLines.push('# ============================================================================');
outputLines.push('# Input Types');
outputLines.push('# ============================================================================');
outputLines.push('');

for (const inputType of inputs) {
  addDocComment(outputLines, inputType.description);
  outputLines.push(`class ${inputType.name}:`);

  const fields = inputType.getFields();
  if (Object.keys(fields).length === 0) {
    outputLines.push('\tpass');
  } else {
    generateClassFields(inputType, outputLines);

    // Add to_dict method for inputs
    outputLines.push('');
    outputLines.push('\tfunc to_dict() -> Dictionary:');
    outputLines.push('\t\tvar result = {}');
    for (const fieldName of Object.keys(fields)) {
      const snakeCaseName = toSnakeCase(escapeGdscriptName(fieldName));
      outputLines.push(`\t\tif ${snakeCaseName} != null:`);
      outputLines.push(`\t\t\tresult["${fieldName}"] = ${snakeCaseName}`);
    }
    outputLines.push('\t\treturn result');
  }
  outputLines.push('');
}

// Generate helper constants for enum string values
outputLines.push('# ============================================================================');
outputLines.push('# Enum String Helpers');
outputLines.push('# ============================================================================');
outputLines.push('');

for (const enumType of enums) {
  outputLines.push(`const ${toConstantCase(enumType.name)}_VALUES = {`);
  const values = enumType.getValues();
  for (let i = 0; i < values.length; i++) {
    const value = values[i];
    const enumValueName = toConstantCase(value.name);
    const comma = i < values.length - 1 ? ',' : '';
    outputLines.push(`\t${enumType.name}.${enumValueName}: "${value.name}"${comma}`);
  }
  outputLines.push('}');
  outputLines.push('');
}

// Write output file to src/generated (consistent with other generators)
const generatedDir = resolve(__dirname, '../src/generated');
mkdirSync(generatedDir, { recursive: true });

const outputPath = resolve(generatedDir, 'types.gd');
writeFileSync(outputPath, outputLines.join('\n'), 'utf8');

console.log(`✅ Generated GDScript types: ${outputPath}`);
console.log(`   - ${enums.length} enums`);
console.log(`   - ${objects.length} types`);
console.log(`   - ${inputs.length} input types`);
