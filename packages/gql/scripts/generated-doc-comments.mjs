import ts from 'typescript';

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const appendDeprecatedTag = (block, reason, typeName) => {
  if (/(?:\/\*\*|\*)\s*@deprecated\b/.test(block)) {
    throw new Error(`${typeName} already contains a manual @deprecated JSDoc tag.`);
  }

  const normalizedReason = reason.replace(/\s+/g, ' ').trim();
  if (!normalizedReason || normalizedReason.includes('*/')) {
    throw new Error(`${typeName} has an invalid @deprecated reason.`);
  }

  if (block.includes('\n')) {
    const closingIndex = block.lastIndexOf('*/');
    const beforeClosing = block.slice(0, closingIndex).replace(/\s*$/, '');
    return `${beforeClosing}\n * @deprecated ${normalizedReason}\n */`;
  }

  const prose = block.slice(3, -2).trim();
  return ['/**', ...(prose ? [` * ${prose}`] : []), ` * @deprecated ${normalizedReason}`, ' */'].join('\n');
};

/**
 * graphql-codegen emits field-level deprecation tags, but GraphQL object type
 * deprecation is a project extension and is omitted from TypeScript output.
 * Inject the canonical type directive reason into the generated declaration's
 * nearest JSDoc block, failing closed if the declaration or ownership is
 * ambiguous.
 */
export function injectTypeDeprecationJSDoc(source, deprecations) {
  let output = source;

  for (const [typeName, reason] of deprecations) {
    const declarationRe = new RegExp(`(^|\\n)(export\\s+(?:enum|interface|type)\\s+${escapeRegExp(typeName)}\\b)`, 'm');
    const matches = [...output.matchAll(new RegExp(declarationRe.source, 'gm'))];
    if (matches.length !== 1) {
      throw new Error(`${typeName} must have exactly one generated TypeScript declaration; found ${matches.length}.`);
    }

    const declarationIndex = matches[0].index + (matches[0][1]?.length ?? 0);
    const prefix = output.slice(0, declarationIndex);
    const blockStart = prefix.lastIndexOf('/**');
    const jsdoc = blockStart === -1 ? null : /^\/\*\*[\s\S]*?\*\/\s*$/.exec(prefix.slice(blockStart));
    if (!jsdoc) {
      const block = appendDeprecatedTag('/** */', reason, typeName);
      output = `${output.slice(0, declarationIndex)}${block}\n${output.slice(declarationIndex)}`;
      continue;
    }

    const blockEnd = blockStart + jsdoc[0].trimEnd().length;
    const block = output.slice(blockStart, blockEnd);
    const replacement = appendDeprecatedTag(block, reason, typeName);
    output = output.slice(0, blockStart) + replacement + output.slice(blockEnd);
  }

  return output;
}

const staticPropertyName = (member) => {
  if (!ts.isPropertySignature(member)) return null;
  if (ts.isIdentifier(member.name) || ts.isStringLiteral(member.name) || ts.isNumericLiteral(member.name)) {
    return member.name.text;
  }
  return null;
};

export const operationArgsOwnerNames = (rootName, fieldName) => {
  const pascalFieldName = `${fieldName[0]?.toUpperCase() ?? ''}${fieldName.slice(1)}`;
  return [
    `${rootName}${pascalFieldName.replace(/IOS/g, 'Ios')}Args`,
    `${rootName}${pascalFieldName}Args`,
    `${rootName}${pascalFieldName.replace(/Ios/g, 'IOS')}Args`,
  ].filter((name, index, names) => names.indexOf(name) === index);
};

const reindentJSDoc = (block, indent) =>
  block
    .split(/\r?\n/)
    .map((line, index) => {
      const normalized = line.trimStart();
      return index === 0 ? normalized : `${indent}${normalized.startsWith('*') ? ' ' : ''}${normalized}`;
    })
    .join('\n');

/**
 * graphql-codegen does not emit @deprecated tags for operation arguments.
 * Attach canonical directive reasons to their generated Args properties before
 * later compatibility rewrites run.
 */
export function injectPropertyDeprecationJSDoc(source, deprecations) {
  const sourceFile = ts.createSourceFile('generated-types.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  if (sourceFile.parseDiagnostics.length > 0) {
    throw new Error(
      `Generated TypeScript could not be parsed for property deprecations: ${sourceFile.parseDiagnostics
        .map((diagnostic) => diagnostic.messageText)
        .join('; ')}`,
    );
  }

  const replacements = [];
  for (const { ownerName, ownerNames = ownerName ? [ownerName] : [], propertyName, reason } of deprecations) {
    const declarations = sourceFile.statements.filter(
      (statement) => ts.isInterfaceDeclaration(statement) && ownerNames.includes(statement.name.text),
    );
    if (declarations.length !== 1) {
      throw new Error(`${ownerNames.join(' or ')} must have exactly one generated TypeScript interface; found ${declarations.length}.`);
    }
    const resolvedOwnerName = declarations[0].name.text;
    const members = declarations[0].members.filter((member) => staticPropertyName(member) === propertyName);
    if (members.length !== 1) {
      throw new Error(`${resolvedOwnerName}.${propertyName} must have exactly one generated TypeScript property; found ${members.length}.`);
    }

    const member = members[0];
    const memberStart = member.getStart(sourceFile);
    const leadingStart = member.getFullStart();
    const leading = source.slice(leadingStart, memberStart);
    const docs = [...leading.matchAll(/\/\*\*[\s\S]*?\*\//g)];
    if (docs.length > 1) {
      throw new Error(`${resolvedOwnerName}.${propertyName} has ambiguous generated JSDoc; found ${docs.length} blocks.`);
    }
    if (docs.length === 1) {
      const start = leadingStart + docs[0].index;
      const block = docs[0][0];
      const lineStart = source.lastIndexOf('\n', start - 1) + 1;
      const indent = source.slice(lineStart, start);
      replacements.push({
        start,
        end: start + block.length,
        text: reindentJSDoc(appendDeprecatedTag(block, reason, `${resolvedOwnerName}.${propertyName}`), indent),
      });
      continue;
    }

    const lineStart = source.lastIndexOf('\n', memberStart - 1) + 1;
    const indent = source.slice(lineStart, memberStart);
    const block = appendDeprecatedTag('/** */', reason, `${resolvedOwnerName}.${propertyName}`)
      .split('\n')
      .map((line, index) => (index === 0 ? line : `${indent}${line}`))
      .join('\n');
    replacements.push({
      start: memberStart,
      end: memberStart,
      text: `${block}\n${indent}`,
    });
  }

  let output = source;
  for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
    output = output.slice(0, replacement.start) + replacement.text + output.slice(replacement.end);
  }
  return output;
}
