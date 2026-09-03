import ts from 'typescript';
import { CUSTOM_INPUT_CONTRACTS, TYPESCRIPT_CUSTOM_INPUT_PROJECTIONS } from '../custom-input-contracts.ts';
import { PLATFORM_TYPE_DEFAULTS } from '../codegen/core/utils.ts';

export const GRAPHQL_CODEGEN_SCAFFOLDING = Object.freeze([
  'export type Scalars',
  'Maybe<',
  'InputMaybe<',
  "Scalars['",
  'MakeOptional',
  'MakeMaybe',
  'MakeEmpty',
  'Incremental',
  'Exact<',
]);

export const requireNoGraphqlCodegenScaffolding = (source) => {
  const remaining = GRAPHQL_CODEGEN_SCAFFOLDING.flatMap((token) => {
    const count = source.split(token).length - 1;
    return count === 0 ? [] : [`${JSON.stringify(token)} (${count})`];
  });
  if (remaining.length > 0) {
    throw new Error(`Generated TypeScript still contains graphql-codegen scaffolding: ${remaining.join(', ')}.`);
  }
};

const indentJSDoc = (block, indent) =>
  block
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trimStart();
      return `${indent}${trimmed.startsWith('*') ? ' ' : ''}${trimmed}`;
    })
    .join('\n');

export const renderDocumentedTypeAlias = (name, declaration, jsdoc = null) => {
  const alias = declaration.startsWith('\n') ? `export type ${name} =${declaration};` : `export type ${name} = ${declaration};`;
  return `${jsdoc ? `${indentJSDoc(jsdoc, '')}\n` : ''}${alias}`;
};

const propertyName = (member, ownerName) => {
  if (!ts.isPropertySignature(member)) {
    throw new Error(`${ownerName} custom generator only supports property signatures; found ${ts.SyntaxKind[member.kind]}.`);
  }

  if (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name) || ts.isNumericLiteral(member.name)) {
    return member.name.text;
  }

  throw new Error(`${ownerName} custom generator requires static property names; found ${member.name.getText()}.`);
};

export const requireExactInterfaceProperties = (source, ownerName, expectedProperties) => {
  const sourceFile = ts.createSourceFile('generated-types.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (sourceFile.parseDiagnostics.length > 0) {
    const diagnostics = sourceFile.parseDiagnostics.map((diagnostic) => diagnostic.messageText).join('; ');
    throw new Error(`${ownerName} custom generator could not parse generated TypeScript: ${diagnostics}`);
  }

  const declarations = sourceFile.statements.filter(
    (statement) => ts.isInterfaceDeclaration(statement) && statement.name.text === ownerName,
  );
  if (declarations.length !== 1) {
    throw new Error(`${ownerName} generated interface must appear exactly once; found ${declarations.length}.`);
  }

  const declaration = declarations[0];
  const membersByName = new Map();
  const actualProperties = declaration.members.map((member) => {
    const name = propertyName(member, ownerName);
    membersByName.set(name, member);
    return name;
  });
  const expected = new Set(expectedProperties);
  const hasExactProperties =
    expected.size === expectedProperties.length &&
    new Set(actualProperties).size === actualProperties.length &&
    actualProperties.length === expectedProperties.length &&
    actualProperties.every((property) => expected.has(property));
  if (!hasExactProperties) {
    throw new Error(
      `${ownerName} custom generator fields drifted; expected ${expectedProperties.join(', ')}, found ${actualProperties.join(', ')}.`,
    );
  }

  const start = declaration.getStart(sourceFile);
  const trailingBlankLine = source.slice(declaration.end).match(/^(?:\r?\n)+/)?.[0] ?? '';
  return {
    start,
    end: declaration.end + trailingBlankLine.length,
    source: source.slice(start, declaration.end + trailingBlankLine.length),
    assertPropertyContract(property, expectedContract) {
      const member = membersByName.get(property);
      if (!member) {
        throw new Error(`${ownerName}.${property} is not a generated property.`);
      }
      const actualType = member.type?.getText(sourceFile).replace(/\s+/g, ' ').trim();
      const actualOptional = Boolean(member.questionToken);
      const expectedType = expectedContract.type.replace(/\s+/g, ' ').trim();
      if (actualType !== expectedType || actualOptional !== expectedContract.optional) {
        throw new Error(
          `${ownerName}.${property} generated contract drifted; expected ${expectedContract.optional ? 'optional' : 'required'} ${expectedType}, found ${actualOptional ? 'optional' : 'required'} ${actualType ?? '<missing type>'}.`,
        );
      }
    },
    propertyJSDoc(property, required = true) {
      const member = membersByName.get(property);
      if (!member) {
        throw new Error(`${ownerName}.${property} is not a generated property.`);
      }
      const leading = source.slice(member.getFullStart(), member.getStart(sourceFile));
      const docs = leading.match(/\/\*\*[\s\S]*?\*\//g) ?? [];
      if (docs.length === 0 && !required) return null;
      if (docs.length !== 1) {
        throw new Error(`${ownerName}.${property} must retain exactly one direct generated JSDoc block; found ${docs.length}.`);
      }
      return docs[0];
    },
  };
};

const typescriptContractType = (type) => {
  let base;
  if (type.kind === 'list') {
    if (!type.elementType) {
      throw new Error('Custom input list contract requires an element type.');
    }
    const element = typescriptContractType(type.elementType);
    base = `${/[|&]/.test(element) ? `(${element})` : element}[]`;
  } else if (type.kind === 'scalar') {
    base = {
      Boolean: 'boolean',
      Float: 'number',
      ID: 'string',
      Int: 'number',
      String: 'string',
    }[type.name];
    if (!base) {
      throw new Error(`Unsupported custom input scalar contract ${type.name}.`);
    }
  } else {
    base = type.name;
  }

  if (!base) {
    throw new Error(`Custom input ${type.kind} contract requires a type name.`);
  }
  return type.nullable ? `(${base} | null)` : base;
};

export const requireTypeScriptInputContract = (source, ownerName) => {
  const contract = CUSTOM_INPUT_CONTRACTS[ownerName];
  if (!contract) {
    throw new Error(`${ownerName} has no canonical custom input contract.`);
  }
  const declaration = requireExactInterfaceProperties(
    source,
    ownerName,
    contract.map((field) => field.name),
  );
  for (const field of contract) {
    declaration.assertPropertyContract(field.name, {
      optional: field.type.nullable,
      type: typescriptContractType(field.type),
    });
  }
  return declaration;
};

const generatedSourceFile = (source, label) => {
  const sourceFile = ts.createSourceFile('generated-types.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (sourceFile.parseDiagnostics.length > 0) {
    throw new Error(
      `${label} could not parse generated TypeScript: ${sourceFile.parseDiagnostics
        .map((diagnostic) => diagnostic.messageText)
        .join('; ')}`,
    );
  }
  return sourceFile;
};

const declarationProperty = (sourceFile, ownerName, propertyName) => {
  const owners = sourceFile.statements.filter((statement) => ts.isInterfaceDeclaration(statement) && statement.name.text === ownerName);
  if (owners.length !== 1) {
    throw new Error(`${ownerName} must have exactly one generated TypeScript interface; found ${owners.length}.`);
  }
  const properties = owners[0].members.filter((member) => staticMemberName(member) === propertyName);
  if (properties.length !== 1 || !ts.isPropertySignature(properties[0])) {
    throw new Error(`${ownerName}.${propertyName} must have exactly one generated TypeScript property; found ${properties.length}.`);
  }
  return properties[0];
};

export const requireProductDiscriminantContracts = (source) => {
  const sourceFile = generatedSourceFile(source, 'Product discriminant postcondition');
  const expected = Object.fromEntries(
    Object.entries(PLATFORM_TYPE_DEFAULTS).map(([typeName, defaults]) => [
      typeName,
      {
        platform: `'${defaults.platform}'`,
        type: `'${defaults.type}'`,
      },
    ]),
  );
  expected.ProductCommon = {
    platform: [...new Set(Object.values(PLATFORM_TYPE_DEFAULTS).map(({ platform }) => platform))]
      .map((platform) => `'${platform}'`)
      .sort()
      .join(' | '),
    type: [...new Set(Object.values(PLATFORM_TYPE_DEFAULTS).map(({ type }) => type))]
      .map((type) => `'${type}'`)
      .sort()
      .join(' | '),
  };

  for (const [ownerName, properties] of Object.entries(expected)) {
    for (const [propertyName, expectedType] of Object.entries(properties)) {
      const property = declarationProperty(sourceFile, ownerName, propertyName);
      const actualType = property.type?.getText(sourceFile).replace(/\s+/g, ' ').trim();
      if (actualType !== expectedType) {
        throw new Error(
          `${ownerName}.${propertyName} discriminant drifted; expected ${expectedType}, found ${actualType ?? '<missing type>'}.`,
        );
      }
    }
  }
};

export const requireGeneratedEnumContracts = (source, enumContracts) => {
  const sourceFile = generatedSourceFile(source, 'Enum postcondition');
  for (const [enumName, expectedValues] of enumContracts) {
    const enums = sourceFile.statements.filter((statement) => ts.isEnumDeclaration(statement) && statement.name.text === enumName);
    const aliases = sourceFile.statements.filter((statement) => ts.isTypeAliasDeclaration(statement) && statement.name.text === enumName);
    const expectedEnums = enumName === 'ErrorCode' ? 1 : 0;
    const expectedAliases = enumName === 'ErrorCode' ? 0 : 1;
    if (enums.length !== expectedEnums || aliases.length !== expectedAliases) {
      throw new Error(
        `${enumName} enum contract drifted; expected ${expectedEnums} enum and ${expectedAliases} alias declarations, found ${enums.length} and ${aliases.length}.`,
      );
    }

    const actualValues = [];
    if (enumName === 'ErrorCode') {
      for (const member of enums[0].members) {
        if (!member.initializer || !ts.isStringLiteral(member.initializer)) {
          throw new Error(`${enumName} enum member ${member.name.getText()} lost its string value.`);
        }
        actualValues.push(member.initializer.text);
      }
    } else {
      const collectLiterals = (typeNode) => {
        if (ts.isParenthesizedTypeNode(typeNode)) {
          collectLiterals(typeNode.type);
        } else if (ts.isUnionTypeNode(typeNode)) {
          for (const member of typeNode.types) collectLiterals(member);
        } else if (ts.isLiteralTypeNode(typeNode) && ts.isStringLiteral(typeNode.literal)) {
          actualValues.push(typeNode.literal.text);
        } else {
          throw new Error(`${enumName} enum alias contains unsupported member ${typeNode.getText(sourceFile)}.`);
        }
      };
      collectLiterals(aliases[0].type);
    }

    if (actualValues.length !== expectedValues.length || actualValues.some((value, index) => value !== expectedValues[index])) {
      throw new Error(`${enumName} enum values drifted; expected ${expectedValues.join(', ')}, found ${actualValues.join(', ')}.`);
    }
  }
};

export const requireExactTypeAlias = (source, ownerName, expectedType) => {
  const sourceFile = generatedSourceFile(source, `${ownerName} type alias postcondition`);
  const aliases = sourceFile.statements.filter((statement) => ts.isTypeAliasDeclaration(statement) && statement.name.text === ownerName);
  const interfaces = sourceFile.statements.filter((statement) => ts.isInterfaceDeclaration(statement) && statement.name.text === ownerName);
  if (aliases.length !== 1 || interfaces.length !== 0) {
    throw new Error(
      `${ownerName} must produce exactly one type alias and no interface; found ${aliases.length} aliases and ${interfaces.length} interfaces.`,
    );
  }
  const actualType = aliases[0].type.getText(sourceFile).replace(/\s+/g, ' ').trim();
  if (actualType !== expectedType) {
    throw new Error(`${ownerName} alias drifted; expected ${expectedType}, found ${actualType}.`);
  }
};

export const resolveOperationArgsOwner = (source, { rootName, fieldName, ownerNames, argumentCount, argumentContracts }) => {
  if (argumentContracts && argumentContracts.length !== argumentCount) {
    throw new Error(`${rootName}.${fieldName} argument guard expected ${argumentCount} contracts, found ${argumentContracts.length}.`);
  }
  const sourceFile = generatedSourceFile(source, `${rootName}.${fieldName} args postcondition`);
  const matches = sourceFile.statements.filter(
    (statement) =>
      (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) && ownerNames.includes(statement.name.text),
  );
  if (argumentCount === 0) {
    if (matches.length !== 0) {
      throw new Error(`${rootName}.${fieldName} has no SDL arguments but generated ${matches.length} Args declarations.`);
    }
    return 'never';
  }
  if (matches.length !== 1) {
    throw new Error(
      `${rootName}.${fieldName} has ${argumentCount} SDL arguments and must have exactly one generated Args declaration; found ${matches.length}.`,
    );
  }
  const declaration = matches[0];
  const expectedKind = argumentCount === 1 ? ts.SyntaxKind.TypeAliasDeclaration : ts.SyntaxKind.InterfaceDeclaration;
  if (declaration.kind !== expectedKind) {
    throw new Error(
      `${rootName}.${fieldName} has ${argumentCount} SDL arguments and must generate a ${argumentCount === 1 ? 'type alias' : 'interface'} Args declaration; found ${ts.SyntaxKind[declaration.kind]}.`,
    );
  }
  if (argumentContracts) {
    if (argumentCount === 1) {
      const argument = argumentContracts[0];
      const expectedType = argument.optional ? `${argument.type} | undefined` : argument.type;
      const actualType = declaration.type.getText(sourceFile).replace(/\s+/g, ' ').trim();
      if (actualType !== expectedType) {
        throw new Error(`${rootName}.${fieldName} Args alias drifted; expected ${expectedType}, found ${actualType}.`);
      }
    } else {
      const actualProperties = new Map();
      for (const member of declaration.members) {
        const name = staticMemberName(member);
        if (!name || !ts.isPropertySignature(member) || !member.type) {
          throw new Error(`${rootName}.${fieldName} Args interface only supports typed static properties.`);
        }
        if (actualProperties.has(name)) {
          throw new Error(`${rootName}.${fieldName} Args interface duplicates ${name}.`);
        }
        actualProperties.set(name, {
          optional: Boolean(member.questionToken),
          type: member.type.getText(sourceFile).replace(/\s+/g, ' ').trim(),
        });
      }
      const expectedNames = new Set(argumentContracts.map(({ name }) => name));
      if (actualProperties.size !== argumentContracts.length || [...actualProperties.keys()].some((name) => !expectedNames.has(name))) {
        throw new Error(
          `${rootName}.${fieldName} Args fields drifted; expected ${[...expectedNames].join(', ')}, found ${[...actualProperties.keys()].join(', ')}.`,
        );
      }
      for (const argument of argumentContracts) {
        const actual = actualProperties.get(argument.name);
        if (!actual || actual.optional !== argument.optional || actual.type !== argument.type) {
          throw new Error(
            `${rootName}.${fieldName} Args.${argument.name} drifted; expected ${argument.optional ? 'optional' : 'required'} ${argument.type}, found ${actual ? `${actual.optional ? 'optional' : 'required'} ${actual.type}` : '<missing>'}.`,
          );
        }
      }
    }
  }
  return declaration.name.text;
};

const staticMemberName = (member) => {
  if (
    !ts.isPropertySignature(member) ||
    !(ts.isIdentifier(member.name) || ts.isStringLiteral(member.name) || ts.isNumericLiteral(member.name))
  ) {
    return null;
  }
  return member.name.text;
};

export const operationFieldNames = (source, rootName, expectedFieldNames = null) => {
  const sourceFile = generatedSourceFile(source, `${rootName} operation fields`);
  const roots = sourceFile.statements.filter((statement) => ts.isInterfaceDeclaration(statement) && statement.name.text === rootName);
  if (roots.length !== 1) {
    throw new Error(`${rootName} must have exactly one generated operation interface; found ${roots.length}.`);
  }

  const names = roots[0].members.map((member) => {
    const name = staticMemberName(member);
    if (!name) {
      throw new Error(`${rootName} operation interface only supports static property signatures; found ${ts.SyntaxKind[member.kind]}.`);
    }
    return name;
  });
  if (new Set(names).size !== names.length) {
    throw new Error(`${rootName} operation interface contains duplicate field declarations.`);
  }
  if (expectedFieldNames) {
    const expected = new Set(expectedFieldNames);
    if (
      names.length !== expectedFieldNames.length ||
      expected.size !== expectedFieldNames.length ||
      names.some((name) => !expected.has(name))
    ) {
      throw new Error(`${rootName} operation fields drifted; expected ${expectedFieldNames.join(', ')}, found ${names.join(', ')}.`);
    }
  }
  return names;
};

/**
 * Derive the final TypeScript alias for a schema-marked nullable result
 * wrapper. The generated interface is parsed structurally so one-field
 * wrappers and multiline/nested TypeScript types follow the same path as
 * larger wrappers instead of depending on line-oriented regexes.
 */
export const deriveMarkedUnionAlias = (source, ownerName) => {
  const sourceFile = generatedSourceFile(source, `${ownerName} union wrapper`);
  const declarations = sourceFile.statements.filter(
    (statement) => ts.isInterfaceDeclaration(statement) && statement.name.text === ownerName,
  );
  if (declarations.length !== 1) {
    throw new Error(`${ownerName} Union marker must have exactly one generated interface before rewriting; found ${declarations.length}.`);
  }

  const declaration = declarations[0];
  if (declaration.members.length === 0) {
    throw new Error(`${ownerName} Union marker cannot rewrite an empty generated interface.`);
  }

  const names = declaration.members.map((member) => propertyName(member, ownerName));
  const exactDeclaration = requireExactInterfaceProperties(source, ownerName, names);
  const unionEntries = [];
  const seenTypes = new Set();
  let hasNull = false;

  const collectMembers = (typeNode, jsdoc) => {
    if (ts.isParenthesizedTypeNode(typeNode)) {
      collectMembers(typeNode.type, jsdoc);
      return;
    }
    if (ts.isUnionTypeNode(typeNode)) {
      for (const member of typeNode.types) collectMembers(member, jsdoc);
      return;
    }

    const normalized = typeNode.getText(sourceFile).replace(/\s+/g, ' ').trim();
    if (!normalized || normalized === 'undefined') return;
    if (normalized === 'null') {
      hasNull = true;
      return;
    }
    if (seenTypes.has(normalized)) return;
    seenTypes.add(normalized);
    unionEntries.push({ jsdoc, type: normalized });
  };

  for (const member of declaration.members) {
    const name = propertyName(member, ownerName);
    if (!member.questionToken) {
      throw new Error(`${ownerName}.${name} Union marker field must remain optional.`);
    }
    if (!member.type) {
      throw new Error(`${ownerName}.${name} Union marker field must retain its generated type.`);
    }
    collectMembers(member.type, exactDeclaration.propertyJSDoc(name, false));
  }

  if (hasNull) {
    unionEntries.push({ jsdoc: null, type: 'null' });
  }
  if (unionEntries.length === 0) {
    throw new Error(`${ownerName} Union marker produced no representable alias members.`);
  }

  const flatType = unionEntries.map((entry) => entry.type).join(' | ');
  const documentedType = unionEntries.some((entry) => entry.jsdoc)
    ? ['', ...unionEntries.flatMap((entry) => [...(entry.jsdoc ? [indentJSDoc(entry.jsdoc, '  ')] : []), `  | ${entry.type}`])].join('\n')
    : flatType;

  return {
    declaration: documentedType,
    source: exactDeclaration.source,
    type: flatType,
  };
};

/**
 * Verify that every SDL generation marker has exactly one observable effect in
 * the final TypeScript output. This turns graphql-codegen formatting drift
 * into a hard failure instead of silently publishing a synchronous operation
 * or an unflattened result wrapper.
 */
export const requireGeneratedMarkerEffects = (source, markers, unionContracts) => {
  const sourceFile = generatedSourceFile(source, 'Schema marker postcondition');
  const interfaces = sourceFile.statements.filter(ts.isInterfaceDeclaration);
  const aliases = sourceFile.statements.filter(ts.isTypeAliasDeclaration);

  for (const target of markers.futureFields) {
    const separator = target.indexOf('.');
    const ownerName = target.slice(0, separator);
    const fieldName = target.slice(separator + 1);
    const owners = interfaces.filter((declaration) => declaration.name.text === ownerName);
    const fields = owners.flatMap((owner) => owner.members.filter((member) => staticMemberName(member) === fieldName));
    if (owners.length !== 1 || fields.length !== 1) {
      throw new Error(`${target} Future marker must map to exactly one generated property; found ${fields.length}.`);
    }
    const type = fields[0].type;
    if (
      !type ||
      !ts.isTypeReferenceNode(type) ||
      !ts.isIdentifier(type.typeName) ||
      type.typeName.text !== 'Promise' ||
      type.typeArguments?.length !== 1
    ) {
      throw new Error(`${target} Future marker did not produce exactly one Promise return.`);
    }
  }

  for (const typeName of markers.unionWrappers) {
    const matchingAliases = aliases.filter((declaration) => declaration.name.text === typeName);
    const matchingInterfaces = interfaces.filter((declaration) => declaration.name.text === typeName);
    if (matchingAliases.length !== 1 || matchingInterfaces.length !== 0) {
      throw new Error(
        `${typeName} Union marker must produce exactly one type alias; found ${matchingAliases.length} aliases and ${matchingInterfaces.length} interfaces.`,
      );
    }
    const expectedMembers = unionContracts.get(typeName);
    if (!expectedMembers) {
      throw new Error(`${typeName} Union marker is missing its canonical alias contract.`);
    }
    const members = [];
    const collectMembers = (typeNode) => {
      if (ts.isParenthesizedTypeNode(typeNode)) {
        collectMembers(typeNode.type);
      } else if (ts.isUnionTypeNode(typeNode)) {
        for (const member of typeNode.types) collectMembers(member);
      } else {
        members.push(typeNode.getText(sourceFile).replace(/\s+/g, ' ').trim());
      }
    };
    collectMembers(matchingAliases[0].type);
    const expectedSet = new Set(expectedMembers);
    const actualSet = new Set(members);
    if (
      members.length !== expectedMembers.length ||
      actualSet.size !== members.length ||
      expectedSet.size !== expectedMembers.length ||
      members.some((member) => !expectedSet.has(member))
    ) {
      throw new Error(
        `${typeName} Union marker alias body drifted; expected ${expectedMembers.join(' | ')}, found ${members.join(' | ')}.`,
      );
    }
  }
};

export const rewriteRequestPurchaseTypeAliases = (source) => {
  const projection = TYPESCRIPT_CUSTOM_INPUT_PROJECTIONS.RequestPurchaseProps;
  const requestPurchaseProps = requireTypeScriptInputContract(source, 'RequestPurchaseProps');
  const requestPurchaseJSDoc = requestPurchaseProps.propertyJSDoc('requestPurchase');
  const requestSubscriptionJSDoc = requestPurchaseProps.propertyJSDoc('requestSubscription');
  const purchaseTypeJSDoc = requestPurchaseProps.propertyJSDoc('type');

  let output = [
    source.slice(0, requestPurchaseProps.start),
    [
      'export type RequestPurchaseProps =',
      '  | {',
      indentJSDoc(requestPurchaseJSDoc, '      '),
      '      request: RequestPurchasePropsByPlatforms;',
      indentJSDoc(purchaseTypeJSDoc, '      '),
      "      type: 'in-app';",
      '    }',
      '  | {',
      indentJSDoc(requestSubscriptionJSDoc, '      '),
      '      request: RequestSubscriptionPropsByPlatforms;',
      indentJSDoc(purchaseTypeJSDoc, '      '),
      "      type: 'subs';",
      '    };\n\n',
    ].join('\n'),
    source.slice(requestPurchaseProps.end),
  ].join('');

  const mutationArgs = requireExactInterfaceProperties(output, projection.operationArgsOwner, [projection.sourceProperty]);
  mutationArgs.assertPropertyContract(projection.sourceProperty, {
    optional: false,
    type: 'RequestPurchaseProps',
  });
  const paramsJSDoc = mutationArgs.propertyJSDoc(projection.sourceProperty, false);
  output = [
    output.slice(0, mutationArgs.start),
    `${renderDocumentedTypeAlias(projection.operationArgsOwner, 'RequestPurchaseProps', paramsJSDoc)}\n\n`,
    output.slice(mutationArgs.end),
  ].join('');

  return output;
};
