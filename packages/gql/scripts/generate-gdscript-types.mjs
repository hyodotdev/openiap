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

// Field name aliases for cleaner API (OpenIAP spec compliance)
// Maps "TypeName.fieldName" to shorter GDScript property names
// This allows different aliases per type
const fieldNameAliases = new Map([
  ['RequestPurchaseProps.requestPurchase', 'request'],
  ['RequestSubscriptionProps.requestSubscription', 'request'],
]);

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

const toKebabCase = (value) => value
  .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
  .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
  .replace(/[_\s]+/g, '-')
  .replace(/-+/g, '-')
  .toLowerCase();

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

// Get the base type info for from_dict deserialization
const getFieldTypeInfo = (graphqlType) => {
  let isArray = false;
  let baseType = graphqlType;

  // Unwrap NonNull
  if (baseType instanceof GraphQLNonNull) {
    baseType = baseType.ofType;
  }

  // Check if it's an array
  if (baseType instanceof GraphQLList) {
    isArray = true;
    baseType = baseType.ofType;
    // Unwrap NonNull inside array
    if (baseType instanceof GraphQLNonNull) {
      baseType = baseType.ofType;
    }
  }

  const typeName = baseType.name;
  const isObjectOrInput = objectNames.has(typeName) || inputNames.has(typeName);
  const isEnum = enumNames.has(typeName);

  return { isArray, isObjectOrInput, isEnum, typeName };
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

// Get the GDScript property name for a GraphQL field
// typeName is optional - used for type-specific aliases
const getGdscriptFieldName = (fieldName, typeName = null) => {
  // Check if there's a type-specific alias for this field
  if (typeName) {
    const typeSpecificKey = `${typeName}.${fieldName}`;
    if (fieldNameAliases.has(typeSpecificKey)) {
      const aliasedName = fieldNameAliases.get(typeSpecificKey);
      return toSnakeCase(escapeGdscriptName(aliasedName));
    }
  }
  // Fall back to regular snake_case conversion
  return toSnakeCase(escapeGdscriptName(fieldName));
};

// Helper function to generate class fields
const generateClassFields = (type, lines, indent = '\t') => {
  const fields = type.getFields();
  const typeName = type.name;
  for (const fieldName of Object.keys(fields)) {
    const field = fields[fieldName];
    const gdscriptType = toGdscriptType(field.type);
    const snakeCaseName = getGdscriptFieldName(fieldName, typeName);

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
      const field = fields[fieldName];
      const snakeCaseName = getGdscriptFieldName(fieldName, objectType.name);
      const typeInfo = getFieldTypeInfo(field.type);

      outputLines.push(`\t\tif data.has("${fieldName}") and data["${fieldName}"] != null:`);

      if (typeInfo.isObjectOrInput && typeInfo.isArray) {
        // Array of objects - need to convert each element
        outputLines.push(`\t\t\tvar arr = []`);
        outputLines.push(`\t\t\tfor item in data["${fieldName}"]:`);
        outputLines.push(`\t\t\t\tif item is Dictionary:`);
        outputLines.push(`\t\t\t\t\tarr.append(${typeInfo.typeName}.from_dict(item))`);
        outputLines.push(`\t\t\t\telse:`);
        outputLines.push(`\t\t\t\t\tarr.append(item)`);
        outputLines.push(`\t\t\tobj.${snakeCaseName} = arr`);
      } else if (typeInfo.isObjectOrInput) {
        // Single object - convert from dictionary
        outputLines.push(`\t\t\tif data["${fieldName}"] is Dictionary:`);
        outputLines.push(`\t\t\t\tobj.${snakeCaseName} = ${typeInfo.typeName}.from_dict(data["${fieldName}"])`);
        outputLines.push(`\t\t\telse:`);
        outputLines.push(`\t\t\t\tobj.${snakeCaseName} = data["${fieldName}"]`);
      } else {
        // Scalar or enum - direct assignment
        outputLines.push(`\t\t\tobj.${snakeCaseName} = data["${fieldName}"]`);
      }
    }
    outputLines.push('\t\treturn obj');

    // Add to_dict method
    outputLines.push('');
    outputLines.push('\tfunc to_dict() -> Dictionary:');
    outputLines.push('\t\tvar result = {}');
    for (const fieldName of Object.keys(fields)) {
      const field = fields[fieldName];
      const snakeCaseName = getGdscriptFieldName(fieldName, objectType.name);
      const typeInfo = getFieldTypeInfo(field.type);
      const enumConstName = toConstantCase(typeInfo.typeName) + '_VALUES';

      if (typeInfo.isObjectOrInput && typeInfo.isArray) {
        outputLines.push(`\t\tif ${snakeCaseName} != null:`);
        outputLines.push(`\t\t\tvar arr = []`);
        outputLines.push(`\t\t\tfor item in ${snakeCaseName}:`);
        outputLines.push(`\t\t\t\tif item != null and item.has_method("to_dict"):`);
        outputLines.push(`\t\t\t\t\tarr.append(item.to_dict())`);
        outputLines.push(`\t\t\t\telse:`);
        outputLines.push(`\t\t\t\t\tarr.append(item)`);
        outputLines.push(`\t\t\tresult["${fieldName}"] = arr`);
        outputLines.push(`\t\telse:`);
        outputLines.push(`\t\t\tresult["${fieldName}"] = null`);
      } else if (typeInfo.isObjectOrInput) {
        outputLines.push(`\t\tif ${snakeCaseName} != null and ${snakeCaseName}.has_method("to_dict"):`);
        outputLines.push(`\t\t\tresult["${fieldName}"] = ${snakeCaseName}.to_dict()`);
        outputLines.push(`\t\telse:`);
        outputLines.push(`\t\t\tresult["${fieldName}"] = ${snakeCaseName}`);
      } else if (typeInfo.isEnum) {
        // Convert enum to string using the _VALUES constant
        outputLines.push(`\t\tif ${enumConstName}.has(${snakeCaseName}):`);
        outputLines.push(`\t\t\tresult["${fieldName}"] = ${enumConstName}[${snakeCaseName}]`);
        outputLines.push(`\t\telse:`);
        outputLines.push(`\t\t\tresult["${fieldName}"] = ${snakeCaseName}`);
      } else {
        outputLines.push(`\t\tresult["${fieldName}"] = ${snakeCaseName}`);
      }
    }
    outputLines.push('\t\treturn result');
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

    // Add from_dict method for inputs
    outputLines.push('');
    outputLines.push('\tstatic func from_dict(data: Dictionary) -> ' + inputType.name + ':');
    outputLines.push('\t\tvar obj = ' + inputType.name + '.new()');
    for (const fieldName of Object.keys(fields)) {
      const field = fields[fieldName];
      const snakeCaseName = getGdscriptFieldName(fieldName, inputType.name);
      const typeInfo = getFieldTypeInfo(field.type);

      outputLines.push(`\t\tif data.has("${fieldName}") and data["${fieldName}"] != null:`);

      if (typeInfo.isObjectOrInput && typeInfo.isArray) {
        outputLines.push(`\t\t\tvar arr = []`);
        outputLines.push(`\t\t\tfor item in data["${fieldName}"]:`);
        outputLines.push(`\t\t\t\tif item is Dictionary:`);
        outputLines.push(`\t\t\t\t\tarr.append(${typeInfo.typeName}.from_dict(item))`);
        outputLines.push(`\t\t\t\telse:`);
        outputLines.push(`\t\t\t\t\tarr.append(item)`);
        outputLines.push(`\t\t\tobj.${snakeCaseName} = arr`);
      } else if (typeInfo.isObjectOrInput) {
        outputLines.push(`\t\t\tif data["${fieldName}"] is Dictionary:`);
        outputLines.push(`\t\t\t\tobj.${snakeCaseName} = ${typeInfo.typeName}.from_dict(data["${fieldName}"])`);
        outputLines.push(`\t\t\telse:`);
        outputLines.push(`\t\t\t\tobj.${snakeCaseName} = data["${fieldName}"]`);
      } else {
        outputLines.push(`\t\t\tobj.${snakeCaseName} = data["${fieldName}"]`);
      }
    }
    outputLines.push('\t\treturn obj');

    // Add to_dict method for inputs
    outputLines.push('');
    outputLines.push('\tfunc to_dict() -> Dictionary:');
    outputLines.push('\t\tvar result = {}');
    for (const fieldName of Object.keys(fields)) {
      const field = fields[fieldName];
      const snakeCaseName = getGdscriptFieldName(fieldName, inputType.name);
      const typeInfo = getFieldTypeInfo(field.type);
      const enumConstName = toConstantCase(typeInfo.typeName) + '_VALUES';

      outputLines.push(`\t\tif ${snakeCaseName} != null:`);

      if (typeInfo.isObjectOrInput && typeInfo.isArray) {
        outputLines.push(`\t\t\tvar arr = []`);
        outputLines.push(`\t\t\tfor item in ${snakeCaseName}:`);
        outputLines.push(`\t\t\t\tif item.has_method("to_dict"):`);
        outputLines.push(`\t\t\t\t\tarr.append(item.to_dict())`);
        outputLines.push(`\t\t\t\telse:`);
        outputLines.push(`\t\t\t\t\tarr.append(item)`);
        outputLines.push(`\t\t\tresult["${fieldName}"] = arr`);
      } else if (typeInfo.isObjectOrInput) {
        outputLines.push(`\t\t\tif ${snakeCaseName}.has_method("to_dict"):`);
        outputLines.push(`\t\t\t\tresult["${fieldName}"] = ${snakeCaseName}.to_dict()`);
        outputLines.push(`\t\t\telse:`);
        outputLines.push(`\t\t\t\tresult["${fieldName}"] = ${snakeCaseName}`);
      } else if (typeInfo.isEnum) {
        // Convert enum to string using the _VALUES constant
        outputLines.push(`\t\t\tif ${enumConstName}.has(${snakeCaseName}):`);
        outputLines.push(`\t\t\t\tresult["${fieldName}"] = ${enumConstName}[${snakeCaseName}]`);
        outputLines.push(`\t\t\telse:`);
        outputLines.push(`\t\t\t\tresult["${fieldName}"] = ${snakeCaseName}`);
      } else {
        outputLines.push(`\t\t\tresult["${fieldName}"] = ${snakeCaseName}`);
      }
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
    const rawValue = toKebabCase(value.name);
    const comma = i < values.length - 1 ? ',' : '';
    outputLines.push(`\t${enumType.name}.${enumValueName}: "${rawValue}"${comma}`);
  }
  outputLines.push('}');
  outputLines.push('');
}

// ============================================================================
// Generate API Operation Types (Query/Mutation fields)
// ============================================================================
outputLines.push('# ============================================================================');
outputLines.push('# Query Types');
outputLines.push('# ============================================================================');
outputLines.push('');

// Collect Query operations
const queryType = operationTypes.find(op => op.name === 'Query');
const mutationType = operationTypes.find(op => op.name === 'Mutation');

// Generate Query class with typed methods
if (queryType) {
  outputLines.push('class Query:');
  const queryFields = queryType.getFields();
  const fieldNames = Object.keys(queryFields);

  if (fieldNames.length === 0) {
    outputLines.push('\tpass');
  } else {
    for (const fieldName of fieldNames) {
      const field = queryFields[fieldName];
      const returnType = toGdscriptType(field.type);
      const snakeCaseName = toSnakeCase(fieldName);
      const args = field.args || [];

      // Add description
      if (field.description) {
        outputLines.push(`\t## ${field.description.split('\n')[0]}`);
      }

      // Generate field info class for each query
      outputLines.push(`\tclass ${fieldName}Field:`);
      outputLines.push(`\t\tconst name = "${fieldName}"`);
      outputLines.push(`\t\tconst snake_name = "${snakeCaseName}"`);

      // Args type
      if (args.length > 0) {
        outputLines.push(`\t\tclass Args:`);
        for (const arg of args) {
          const argType = toGdscriptType(arg.type);
          const argSnakeName = toSnakeCase(arg.name);
          if (arg.description) {
            outputLines.push(`\t\t\t## ${arg.description.split('\n')[0]}`);
          }
          outputLines.push(`\t\t\tvar ${argSnakeName}: ${argType}`);
        }
        outputLines.push('');
        outputLines.push(`\t\t\tstatic func from_dict(data: Dictionary) -> Args:`);
        outputLines.push(`\t\t\t\tvar obj = Args.new()`);
        for (const arg of args) {
          const argSnakeName = toSnakeCase(arg.name);
          outputLines.push(`\t\t\t\tif data.has("${arg.name}") and data["${arg.name}"] != null:`);
          outputLines.push(`\t\t\t\t\tobj.${argSnakeName} = data["${arg.name}"]`);
        }
        outputLines.push(`\t\t\t\treturn obj`);
        outputLines.push('');
        outputLines.push(`\t\t\tfunc to_dict() -> Dictionary:`);
        outputLines.push(`\t\t\t\tvar result = {}`);
        for (const arg of args) {
          const argSnakeName = toSnakeCase(arg.name);
          outputLines.push(`\t\t\t\tresult["${arg.name}"] = ${argSnakeName}`);
        }
        outputLines.push(`\t\t\t\treturn result`);
      } else {
        outputLines.push(`\t\tclass Args:`);
        outputLines.push(`\t\t\tpass`);
      }

      // Return type alias
      const baseReturnType = getFieldTypeInfo(field.type);
      outputLines.push(`\t\tconst return_type = "${baseReturnType.typeName}"`);
      outputLines.push(`\t\tconst is_array = ${baseReturnType.isArray}`);
      outputLines.push('');
    }
  }
  outputLines.push('');
}

// Generate Mutation class with typed methods
outputLines.push('# ============================================================================');
outputLines.push('# Mutation Types');
outputLines.push('# ============================================================================');
outputLines.push('');

if (mutationType) {
  outputLines.push('class Mutation:');
  const mutationFields = mutationType.getFields();
  const fieldNames = Object.keys(mutationFields);

  if (fieldNames.length === 0) {
    outputLines.push('\tpass');
  } else {
    for (const fieldName of fieldNames) {
      const field = mutationFields[fieldName];
      const returnType = toGdscriptType(field.type);
      const snakeCaseName = toSnakeCase(fieldName);
      const args = field.args || [];

      // Add description
      if (field.description) {
        outputLines.push(`\t## ${field.description.split('\n')[0]}`);
      }

      // Generate field info class for each mutation
      outputLines.push(`\tclass ${fieldName}Field:`);
      outputLines.push(`\t\tconst name = "${fieldName}"`);
      outputLines.push(`\t\tconst snake_name = "${snakeCaseName}"`);

      // Args type
      if (args.length > 0) {
        outputLines.push(`\t\tclass Args:`);
        for (const arg of args) {
          const argType = toGdscriptType(arg.type);
          const argSnakeName = toSnakeCase(arg.name);
          if (arg.description) {
            outputLines.push(`\t\t\t## ${arg.description.split('\n')[0]}`);
          }
          outputLines.push(`\t\t\tvar ${argSnakeName}: ${argType}`);
        }
        outputLines.push('');
        outputLines.push(`\t\t\tstatic func from_dict(data: Dictionary) -> Args:`);
        outputLines.push(`\t\t\t\tvar obj = Args.new()`);
        for (const arg of args) {
          const argSnakeName = toSnakeCase(arg.name);
          outputLines.push(`\t\t\t\tif data.has("${arg.name}") and data["${arg.name}"] != null:`);
          outputLines.push(`\t\t\t\t\tobj.${argSnakeName} = data["${arg.name}"]`);
        }
        outputLines.push(`\t\t\t\treturn obj`);
        outputLines.push('');
        outputLines.push(`\t\t\tfunc to_dict() -> Dictionary:`);
        outputLines.push(`\t\t\t\tvar result = {}`);
        for (const arg of args) {
          const argSnakeName = toSnakeCase(arg.name);
          outputLines.push(`\t\t\t\tresult["${arg.name}"] = ${argSnakeName}`);
        }
        outputLines.push(`\t\t\t\treturn result`);
      } else {
        outputLines.push(`\t\tclass Args:`);
        outputLines.push(`\t\t\tpass`);
      }

      // Return type alias
      const baseReturnType = getFieldTypeInfo(field.type);
      outputLines.push(`\t\tconst return_type = "${baseReturnType.typeName}"`);
      outputLines.push(`\t\tconst is_array = ${baseReturnType.isArray}`);
      outputLines.push('');
    }
  }
  outputLines.push('');
}

// ============================================================================
// Generate API Wrapper Functions
// These provide typed wrappers that godot-iap can use directly
// ============================================================================
outputLines.push('# ============================================================================');
outputLines.push('# API Wrapper Functions');
outputLines.push('# These typed functions can be used by godot-iap wrapper');
outputLines.push('# ============================================================================');
outputLines.push('');

// Helper to generate function signature
const generateApiFunction = (fieldName, field, operationType) => {
  const snakeCaseName = toSnakeCase(fieldName);
  const args = field.args || [];
  const returnTypeInfo = getFieldTypeInfo(field.type);
  let returnType = returnTypeInfo.typeName;

  // Map scalar types
  if (returnType === 'Boolean') returnType = 'bool';
  else if (returnType === 'String') returnType = 'String';
  else if (returnType === 'Int') returnType = 'int';
  else if (returnType === 'Float') returnType = 'float';

  // Build return type with array wrapper if needed
  const fullReturnType = returnTypeInfo.isArray ? `Array[${returnType}]` : returnType;

  // Add description
  if (field.description) {
    outputLines.push(`## ${field.description.split('\n')[0]}`);
  }

  // Build function parameters
  const paramList = [];
  for (const arg of args) {
    const argType = toGdscriptType(arg.type);
    const argSnakeName = toSnakeCase(arg.name);
    paramList.push(`${argSnakeName}: ${argType}`);
  }

  // Generate static helper function
  const params = paramList.length > 0 ? paramList.join(', ') : '';
  outputLines.push(`static func ${snakeCaseName}_args(${params}) -> Dictionary:`);

  if (args.length > 0) {
    outputLines.push('\tvar args = {}');
    for (const arg of args) {
      const argSnakeName = toSnakeCase(arg.name);
      const typeInfo = getFieldTypeInfo(arg.type);

      if (typeInfo.isObjectOrInput) {
        outputLines.push(`\tif ${argSnakeName} != null:`);
        outputLines.push(`\t\tif ${argSnakeName}.has_method("to_dict"):`);
        outputLines.push(`\t\t\targs["${arg.name}"] = ${argSnakeName}.to_dict()`);
        outputLines.push(`\t\telse:`);
        outputLines.push(`\t\t\targs["${arg.name}"] = ${argSnakeName}`);
      } else {
        outputLines.push(`\targs["${arg.name}"] = ${argSnakeName}`);
      }
    }
    outputLines.push('\treturn args');
  } else {
    outputLines.push('\treturn {}');
  }
  outputLines.push('');
};

// Generate Query API functions
if (queryType) {
  outputLines.push('# Query API helpers');
  outputLines.push('');
  const queryFields = queryType.getFields();
  for (const fieldName of Object.keys(queryFields)) {
    if (fieldName === '_placeholder') continue;
    generateApiFunction(fieldName, queryFields[fieldName], 'Query');
  }
}

// Generate Mutation API functions
if (mutationType) {
  outputLines.push('# Mutation API helpers');
  outputLines.push('');
  const mutationFields = mutationType.getFields();
  for (const fieldName of Object.keys(mutationFields)) {
    if (fieldName === '_placeholder') continue;
    generateApiFunction(fieldName, mutationFields[fieldName], 'Mutation');
  }
}

// Write output file to src/generated (consistent with other generators)
const generatedDir = resolve(__dirname, '../src/generated');
mkdirSync(generatedDir, { recursive: true });

const outputPath = resolve(generatedDir, 'types.gd');
writeFileSync(outputPath, outputLines.join('\n'), 'utf8');

const queryCount = queryType ? Object.keys(queryType.getFields()).filter(f => f !== '_placeholder').length : 0;
const mutationCount = mutationType ? Object.keys(mutationType.getFields()).filter(f => f !== '_placeholder').length : 0;

console.log(`✅ Generated GDScript types: ${outputPath}`);
console.log(`   - ${enums.length} enums`);
console.log(`   - ${objects.length} types`);
console.log(`   - ${inputs.length} input types`);
console.log(`   - ${queryCount} query operations`);
console.log(`   - ${mutationCount} mutation operations`);
