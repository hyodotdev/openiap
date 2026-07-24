import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse } from 'graphql';
import { parseSchema } from '../codegen/core/parser.ts';
import { transformSchema } from '../codegen/core/transformer.ts';
import { GRAPHQL_TO_TYPESCRIPT, PLATFORM_TYPE_DEFAULTS, toKebabCase } from '../codegen/core/utils.ts';
import { injectPropertyDeprecationJSDoc, injectTypeDeprecationJSDoc, operationArgsOwnerNames } from './generated-doc-comments.mjs';
import { SCHEMA_FILE_NAMES } from '../schema-files.mjs';
import { GENERATED_SYNC_MANIFEST, gqlPackageRelativePath } from '../generated-sync-manifest.mjs';
import {
  deriveMarkedUnionAlias,
  operationFieldNames,
  renderDocumentedTypeAlias,
  requireExactInterfaceProperties,
  requireExactTypeAlias,
  requireGeneratedEnumContracts,
  requireGeneratedMarkerEffects,
  requireNoGraphqlCodegenScaffolding,
  requireProductDiscriminantContracts,
  requireTypeScriptInputContract,
  resolveOperationArgsOwner,
  rewriteRequestPurchaseTypeAliases,
} from './custom-generated-guards.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const targetPath = resolve(__dirname, '..', gqlPackageRelativePath(GENERATED_SYNC_MANIFEST.typescript.source));
const parsedSchema = parseSchema();
const irSchema = transformSchema(parsedSchema);
const schemaDefinitionSources = parsedSchema.sdlContents;
const schemaDefinitionFiles = [...schemaDefinitionSources.keys()];
const schemaMarkers = parsedSchema.markers;
const schemaDeprecations = parsedSchema.deprecations;
const ROOT_OPERATION_NAMES = Object.freeze(irSchema.operations.map(({ name }) => name));
const typeScriptTypeFromIR = (type, scalarDirection = 'output') => {
  if (type.kind === 'list') {
    const element = typeScriptTypeFromIR(type.elementType, scalarDirection);
    const nullableElement = type.elementType.nullable ? `${element} | null` : element;
    return /[|&]/.test(nullableElement) ? `(${nullableElement})[]` : `${nullableElement}[]`;
  }
  if (type.kind === 'scalar') {
    const scalar = type.name === 'Void' ? 'void' : GRAPHQL_TO_TYPESCRIPT[type.name]?.[scalarDirection];
    if (!scalar) {
      throw new Error(`Unsupported TypeScript scalar: ${type.name}`);
    }
    return scalar;
  }
  if (!type.name) {
    throw new Error(`Unnamed ${type.kind} cannot appear in generated TypeScript.`);
  }
  return type.name;
};
const typeScriptArgumentTypeFromIR = (type) => {
  const base = typeScriptTypeFromIR(type, 'input');
  return type.nullable ? `(${base} | null)` : base;
};
const operationContracts = new Map(
  irSchema.operations.flatMap((operation) =>
    operation.fields.map((field) => [
      `${operation.name}.${field.name}`,
      {
        rootName: operation.name,
        fieldName: field.name,
        arguments: field.args.map((argument) => ({
          name: argument.name,
          optional: argument.type.nullable,
          type: typeScriptArgumentTypeFromIR(argument.type),
        })),
      },
    ]),
  ),
);
const operationFieldsByRoot = new Map(
  irSchema.operations.map((operation) => [
    operation.name,
    operation.fields.map(({ name }) => name).filter((name) => name !== '_placeholder'),
  ]),
);
// Preserve the published TypeScript order for webhook string unions. Those
// unions historically use graphql-codegen's deterministic ordering rather
// than SDL order; changing the shared schema inventory must not churn a public
// generated contract. Deprecation and ownership scans still cover webhook.
const enumOrderSchemaFiles = new Set(
  SCHEMA_FILE_NAMES.filter((fileName) => fileName !== 'webhook.graphql').map((fileName) => resolve(__dirname, `../src/${fileName}`)),
);
const webhookEnumNames = new Set();

let content = readFileSync(targetPath, 'utf8');

// eslint-disable-next-line no-console
console.log('[fix-generated-types] transforming output');

const scalarReplacements = new Map(
  Object.entries(GRAPHQL_TO_TYPESCRIPT).flatMap(([name, { input, output }]) => [
    [`Scalars['${name}']['output']`, output],
    [`Scalars['${name}']['input']`, input],
  ]),
);

for (const [from, to] of scalarReplacements) {
  const pattern = new RegExp(
    from.replace(/[[\]]/g, (m) => `\\${m}`),
    'g',
  );
  content = content.replace(pattern, to);
}

const iosTypeMap = new Map();
const enumValueOrder = new Map();
const typeDeprecations = schemaDeprecations.typeReasons;
const operationArgDeprecations = schemaDeprecations.operationArguments.map(({ rootName, fieldName, argumentName, reason }) => ({
  ownerNames: operationArgsOwnerNames(rootName, fieldName),
  propertyName: argumentName,
  reason,
}));
for (const schemaPath of schemaDefinitionFiles) {
  const sdl = schemaDefinitionSources.get(schemaPath);
  const document = parse(sdl, { noLocation: true });
  for (const definition of document.definitions) {
    if (definition.kind === 'EnumTypeDefinition' || definition.kind === 'EnumTypeExtension') {
      if (!enumOrderSchemaFiles.has(schemaPath)) {
        webhookEnumNames.add(definition.name.value);
      }
    }
    if (enumOrderSchemaFiles.has(schemaPath) && 'name' in definition && definition.name) {
      if (definition.kind === 'EnumTypeDefinition' || definition.kind === 'EnumTypeExtension') {
        const name = definition.name.value;
        const existing = enumValueOrder.get(name) ?? [];
        const values = (definition.values ?? []).map((value) => value.name.value);
        const merged = [...existing, ...values].filter((value, index, array) => array.indexOf(value) === index);
        enumValueOrder.set(name, merged);
      }
    }
    if (!definition.name) continue;
    const name = definition.name.value;
    if (!name.includes('IOS')) continue;
    const tsName = name.replace(/IOS/g, 'Ios');
    iosTypeMap.set(tsName, name);
  }
}

for (const [tsName, iosName] of iosTypeMap) {
  const pattern = new RegExp(`\\b${tsName}\\b`, 'g');
  content = content.replace(pattern, iosName);
}

// Enforce IOS capitalization conventions for enum members and fields.
content = content.replace(/\b([A-Za-z0-9]+)Ios\b/g, (_, prefix) => `${prefix}IOS`);
content = content.replace(/\bIos\b/g, 'IOS');
content = injectPropertyDeprecationJSDoc(content, operationArgDeprecations);

// Convert enums (except ErrorCode) to union literal types with kebab-case values.
content = content.replace(/export enum (\w+) \{[\s\S]*?\}\n?/g, (match) => {
  const enumName = match.match(/export enum (\w+)/)[1];
  if (enumName === 'ErrorCode') return match;
  const schemaValues = enumValueOrder.get(enumName);
  let literals;
  if (schemaValues && schemaValues.length) {
    literals = schemaValues.map((value) => `'${toKebabCase(value)}'`);
  } else {
    const valueMatches = [...match.matchAll(/=\s*'([^']+)'/g)];
    if (valueMatches.length === 0) return match;
    literals = valueMatches.map(([, raw]) => `'${toKebabCase(raw)}'`);
  }
  return `export type ${enumName} = ${literals.join(' | ')};\n`;
});

// ErrorCode is the only enum left after the conversion above.
content = content.replace(/export enum ErrorCode \{[\s\S]*?\}/, (block) =>
  block.replace(/= '([^']+)'/g, (_, value) => `= '${toKebabCase(value)}'`),
);

const removeDefinition = (keyword) => {
  const pattern = new RegExp(`^export type ${keyword}[^]*?;\n`, 'm');
  if (pattern.test(content)) {
    content = content.replace(pattern, '');
  }
};

const removeScalarsBlock = () => {
  const pattern = /\/\*\* All built-in and custom scalars[^]*?}\n\n/;
  content = content.replace(pattern, '');
};

removeScalarsBlock();
removeDefinition('Maybe');
removeDefinition('InputMaybe');
removeDefinition('Exact');
removeDefinition('MakeOptional');
removeDefinition('MakeMaybe');
removeDefinition('MakeEmpty');
removeDefinition('Incremental');

const replaceMaybeLike = (keyword) => {
  const token = `${keyword}<`;
  let index = content.indexOf(token);
  while (index !== -1) {
    const definitionPrefix = `export type ${keyword}`;
    const prefixStart = index - definitionPrefix.length;
    if (prefixStart >= 0 && content.slice(prefixStart, index) === definitionPrefix) {
      index = content.indexOf(token, index + token.length);
      continue;
    }
    let i = index + token.length;
    let depth = 1;
    while (i < content.length && depth > 0) {
      const ch = content[i];
      if (ch === '<') depth += 1;
      else if (ch === '>') depth -= 1;
      i += 1;
    }
    if (depth !== 0) break;
    const inner = content.slice(index + token.length, i - 1).trim();
    const replacement = `(${inner} | null)`;
    content = content.slice(0, index) + replacement + content.slice(i);
    index = content.indexOf(token, index + replacement.length);
  }
};

replaceMaybeLike('InputMaybe');
replaceMaybeLike('Maybe');

const convertArrays = () => {
  const token = 'Array<';
  let index = content.indexOf(token);
  while (index !== -1) {
    let i = index + token.length;
    let depth = 1;
    while (i < content.length && depth > 0) {
      const ch = content[i];
      if (ch === '<') depth += 1;
      else if (ch === '>') depth -= 1;
      i += 1;
    }
    if (depth !== 0) break;
    const innerRaw = content.slice(index + token.length, i - 1).trim();
    const needsParens = /[|&]/.test(innerRaw) && !(innerRaw.startsWith('(') && innerRaw.endsWith(')'));
    const inner = needsParens ? `(${innerRaw})` : innerRaw;
    content = content.slice(0, index) + inner + '[]' + content.slice(i);
    index = content.indexOf(token, index + inner.length + 2);
  }
};

convertArrays();

// Convert platform/type fields to literals and introduce a shared base for products
// This keeps ProductCommon android-focused while reusing field definitions
for (const [typeName, defaults] of Object.entries(PLATFORM_TYPE_DEFAULTS)) {
  const literals = {
    platform: `'${defaults.platform}'`,
    type: `'${defaults.type}'`,
  };
  const interfacePattern = new RegExp(
    `(export interface ${typeName} extends ProductCommon \\{[\\s\\S]*?)` + `(platform: [^;]+;)` + `([\\s\\S]*?)` + `(type: [^;]+;)`,
    'g',
  );

  content = content.replace(interfacePattern, (_match, before, _platformField, middle) => {
    return `${before}platform: ${literals.platform};${middle}type: ${literals.type};`;
  });
}

// Normalize ProductCommon to a single definition with literal union platform/type
const productDefaultUnion = (key) =>
  [...new Set(Object.values(PLATFORM_TYPE_DEFAULTS).map((defaults) => defaults[key]))]
    .sort()
    .map((value) => `'${value}'`)
    .join(' | ');
const productPlatformUnion = productDefaultUnion('platform');
const productTypeUnion = productDefaultUnion('type');
const productCommonMatch = content.match(/export interface ProductCommon \{([\s\S]*?)\}\n/);
if (productCommonMatch) {
  const body = productCommonMatch[1]
    .replace(/platform: 'android';/, `platform: ${productPlatformUnion};`)
    .replace(/platform: IapPlatform;/, `platform: ${productPlatformUnion};`)
    .replace(/type: 'in-app' \| 'subs';/, `type: ${productTypeUnion};`)
    .replace(/type: ProductType;/, `type: ${productTypeUnion};`);
  content = content.replace(productCommonMatch[0], `export interface ProductCommon {${body}} \n`);
}

const purchaseInput = requireTypeScriptInputContract(content, 'PurchaseInput');
content = [content.slice(0, purchaseInput.start), 'export type PurchaseInput = Purchase;\n\n', content.slice(purchaseInput.end)].join('');

content = rewriteRequestPurchaseTypeAliases(content);

const needsParentheses = (value) => {
  const trimmed = value.trim();
  if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
    let depth = 0;
    for (let i = 0; i < trimmed.length; i += 1) {
      const ch = trimmed[i];
      if (ch === '(') depth += 1;
      else if (ch === ')') depth -= 1;
      if (depth === 0 && i < trimmed.length - 1) {
        return true;
      }
    }
    return false;
  }
  return /[|&]/.test(trimmed);
};

const unionWrapperNames = schemaMarkers.unionWrappers;

const singleFieldInterfaceTypes = new Map();
const optionalUnionInterfaces = new Map();
const interfacePattern = /export interface (\w+) \{\n([\s\S]*?)\n\}\n/g;
let interfaceMatch;
while ((interfaceMatch = interfacePattern.exec(content)) !== null) {
  const [, name, body] = interfaceMatch;
  if (ROOT_OPERATION_NAMES.includes(name)) {
    continue;
  }
  const rawLines = body.split(/\r?\n/);
  const fieldLines = rawLines
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('/**') && !line.startsWith('*'));
  const propertyLines = fieldLines.filter((line) => /^[A-Za-z0-9_]+\??:/.test(line));

  const propertyMatches = propertyLines.map((line) => line.match(/^([A-Za-z0-9_]+)(\??): ([^;]+);$/)).filter(Boolean);

  if (unionWrapperNames.has(name)) {
    optionalUnionInterfaces.set(name, deriveMarkedUnionAlias(content, name));
    continue;
  }

  if (propertyMatches.length === 0) {
    continue;
  }

  if (propertyMatches.length === 1) {
    const shouldAlias = name.endsWith('Args') || name === 'VoidResult';
    if (!shouldAlias) {
      continue;
    }
    const [propertyMatch] = propertyMatches;
    const [, propertyName, optionalMarker, rawType] = propertyMatch;
    const declaration = requireExactInterfaceProperties(content, name, [propertyName]);
    const grouped = needsParentheses(rawType.trim()) ? `(${rawType.trim()})` : rawType.trim();
    let finalType = optionalMarker === '?' ? `${grouped} | undefined` : rawType.trim();
    if (name === 'VoidResult') {
      finalType = 'void';
    }
    const propertyJSDoc = declaration.propertyJSDoc(propertyName, false);
    singleFieldInterfaceTypes.set(name, {
      declaration: finalType,
      jsdoc: propertyJSDoc,
      source: declaration.source,
      type: finalType,
    });
    continue;
  }
}

for (const root of ROOT_OPERATION_NAMES) {
  const pattern = new RegExp(`export interface ${root} \\{\\n([\\s\\S]*?)\\n\\}(\\n*)`);
  content = content.replace(pattern, (_match, body) => {
    const lines = body.split(/\r?\n/);
    const transformed = lines
      .map((line) => {
        const fieldMatch = line.match(/^(\s*)([A-Za-z0-9_]+)(\??):\s*([^;]+);$/);
        if (!fieldMatch) {
          return line;
        }
        const [, indent, fieldName, optionalMarker, typeSegmentRaw] = fieldMatch;
        let typeSegment = typeSegmentRaw;
        if (!typeSegment.includes('Promise<')) {
          return line;
        }
        let updated = false;
        for (const [interfaceName, replacement] of singleFieldInterfaceTypes) {
          const namePattern = new RegExp(`\\b${interfaceName}\\b`);
          if (!namePattern.test(typeSegment)) {
            continue;
          }
          const replacePattern = new RegExp(`\\b${interfaceName}\\b`, 'g');
          typeSegment = typeSegment.replace(replacePattern, replacement.type);
          updated = true;
        }
        for (const [interfaceName, union] of optionalUnionInterfaces) {
          const namePattern = new RegExp(`\\b${interfaceName}\\b`);
          if (!namePattern.test(typeSegment)) {
            continue;
          }
          const replacePattern = new RegExp(`\\b${interfaceName}\\b`, 'g');
          typeSegment = typeSegment.replace(replacePattern, `(${union.type})`);
          updated = true;
        }
        if (!updated) {
          return line;
        }
        return `${indent}${fieldName}${optionalMarker}: ${typeSegment};`;
      })
      .join('\n');
    return `export interface ${root} {\n${transformed}\n}\n\n`;
  });
}

for (const [name, alias] of singleFieldInterfaceTypes) {
  const occurrences = content.split(alias.source).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${name} generated interface replacement must match exactly once; found ${occurrences}.`);
  }
  content = content.replace(alias.source, `${renderDocumentedTypeAlias(name, alias.declaration, alias.jsdoc)}\n\n`);
}

for (const [name, union] of optionalUnionInterfaces) {
  const occurrences = content.split(union.source).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${name} generated interface replacement must match exactly once; found ${occurrences}.`);
  }
  content = content.replace(union.source, `${renderDocumentedTypeAlias(name, union.declaration)}\n\n`);
}

const wrapReturns = (interfaceName) => {
  const pattern = new RegExp(`export interface ${interfaceName} \\\{\\n([\\s\\S]*?)\\n\\}`, 'g');
  content = content.replace(pattern, (_match, body) => {
    // Use multiline mode and [^;\n]+ to prevent matching across lines
    const transformed = body.replace(/^(\s*)([A-Za-z0-9_]+)(\??: )(?!Promise<)([^;\n]+);$/gm, (line, indent, name, sep, type) => {
      if (!schemaMarkers.futureFields.has(`${interfaceName}.${name}`)) {
        return line;
      }
      return `${indent}${name}${sep}Promise<${type}>;`;
    });
    return `export interface ${interfaceName} {\n${transformed}\n}`;
  });
};

wrapReturns('Query');
wrapReturns('Mutation');

for (const [name, alias] of singleFieldInterfaceTypes) {
  content = content.replaceAll(`Promise<${name}>`, `Promise<${alias.type}>`);
}

for (const [name, union] of optionalUnionInterfaces) {
  content = content.replaceAll(`Promise<${name}>`, `Promise<(${union.type})>`);
  const nullableToken = `Promise<(${name} | null)>`;
  if (content.includes(nullableToken)) {
    const unionWithNull = union.type.includes('null') ? union.type : `${union.type} | null`;
    content = content.replaceAll(nullableToken, `Promise<(${unionWithNull})>`);
  }
}

content = content.replace(/^\s*_placeholder\??: [^;]+;\n/gm, '');

const helperMarkers = (root) => ({
  start: `// -- ${root} helper types (auto-generated)`,
  end: `// -- End ${root.toLowerCase()} helper types`,
});

const removeRootHelpers = (root) => {
  const { start, end } = helperMarkers(root);
  const startIdx = content.indexOf(start);
  if (startIdx === -1) return;
  const endIdx = content.indexOf(end);
  if (endIdx === -1) return;
  const sliceEnd = content.indexOf('\n', endIdx + end.length);
  const finalEnd = sliceEnd === -1 ? content.length : sliceEnd + 1;
  content = content.slice(0, startIdx) + content.slice(finalEnd);
};

const findArgsType = (root, fieldName) => {
  const operationPath = `${root}.${fieldName}`;
  const contract = operationContracts.get(operationPath);
  if (!contract) {
    throw new Error(`${operationPath} exists in generated TypeScript but not in the canonical SDL operation root.`);
  }
  const argsType = resolveOperationArgsOwner(content, {
    rootName: root,
    fieldName,
    ownerNames: operationArgsOwnerNames(root, fieldName),
    argumentCount: contract.arguments.length,
    argumentContracts: contract.arguments,
  });
  const allOptional = contract.arguments.length > 0 && contract.arguments.every(({ optional }) => optional);
  return {
    argsType,
    mapType: contract.arguments.length > 1 && allOptional ? `${argsType} | undefined` : argsType,
  };
};

const buildRootHelpers = (root) => {
  const expectedFields = operationFieldsByRoot.get(root);
  if (!expectedFields) {
    throw new Error(`${root} is missing from the canonical IR operation roots.`);
  }
  const entries = operationFieldNames(content, root, expectedFields).map((fieldName) => {
    const { mapType } = findArgsType(root, fieldName);
    return { fieldName, mapType };
  });
  if (entries.length === 0) return '';
  const { start, end } = helperMarkers(root);
  const mapName = `${root}ArgsMap`;
  const fieldAlias = `${root}Field`;
  const mapAlias = `${root}FieldMap`;
  const lines = [];
  lines.push(start);
  lines.push(`export type ${mapName} = {`);
  for (const { fieldName, mapType } of entries) {
    lines.push(`  ${fieldName}: ${mapType};`);
  }
  lines.push('};');
  lines.push('');
  lines.push(`export type ${fieldAlias}<K extends keyof ${root}> =`);
  lines.push(`  ${mapName}[K] extends never`);
  lines.push(`    ? () => NonNullable<${root}[K]>`);
  lines.push(`    : undefined extends ${mapName}[K]`);
  lines.push(`      ? (args?: ${mapName}[K]) => NonNullable<${root}[K]>`);
  lines.push(`      : (args: ${mapName}[K]) => NonNullable<${root}[K]>;`);
  lines.push('');
  lines.push(`export type ${mapAlias} = {`);
  lines.push(`  [K in keyof ${root}]?: ${fieldAlias}<K>;`);
  lines.push('};');
  lines.push(end);
  lines.push('');
  return lines.join('\n');
};

const helperBlocks = [];
for (const root of ROOT_OPERATION_NAMES) {
  removeRootHelpers(root);
  const block = buildRootHelpers(root);
  if (block) helperBlocks.push(block);
}

if (helperBlocks.length > 0) {
  if (!content.endsWith('\n')) {
    content += '\n';
  }
  content += helperBlocks.join('\n');
}

content = injectTypeDeprecationJSDoc(content, typeDeprecations);
content = content.replace(/(?:\r?\n){3,}(?=export )/g, '\n\n');
const enumContracts = new Map(
  irSchema.enums.map((irEnum) => {
    const values = irEnum.values.map(({ rawValue }) => rawValue);
    return [irEnum.name, irEnum.name === 'ErrorCode' || webhookEnumNames.has(irEnum.name) ? values.sort() : values];
  }),
);
requireGeneratedEnumContracts(content, enumContracts);
requireExactTypeAlias(content, 'VoidResult', 'void');
requireProductDiscriminantContracts(content);

const unionContracts = new Map(
  irSchema.objects
    .filter((object) => object.isResultUnion)
    .map((object) => {
      const entries = object.resultUnionEntries ?? [];
      const members = [];
      let hasNull = false;
      for (const entry of entries) {
        const member = typeScriptTypeFromIR(entry.type);
        if (!members.includes(member)) members.push(member);
        hasNull ||= entry.type.nullable;
      }
      if (hasNull) members.push('null');
      return [object.name, members];
    }),
);
requireGeneratedMarkerEffects(content, schemaMarkers, unionContracts);
requireNoGraphqlCodegenScaffolding(content);

writeFileSync(targetPath, content);
