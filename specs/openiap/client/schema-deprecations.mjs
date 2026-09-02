import { Kind, parse } from 'graphql';
import { collectGraphQLComments, normalizeSchemaSources } from './schema-source-utils.mjs';

const TYPE_DEPRECATION_DIRECTIVE = 'openiapDeprecated';

export const OPENIAP_REMOVAL_NOTICE_PATTERN = /Scheduled for removal in OpenIAP \d+\.\d+\.$/;

const TYPE_DEFINITION_KINDS = new Set([
  Kind.ENUM_TYPE_DEFINITION,
  Kind.ENUM_TYPE_EXTENSION,
  Kind.INPUT_OBJECT_TYPE_DEFINITION,
  Kind.INPUT_OBJECT_TYPE_EXTENSION,
  Kind.INTERFACE_TYPE_DEFINITION,
  Kind.INTERFACE_TYPE_EXTENSION,
  Kind.OBJECT_TYPE_DEFINITION,
  Kind.OBJECT_TYPE_EXTENSION,
  Kind.UNION_TYPE_DEFINITION,
  Kind.UNION_TYPE_EXTENSION,
]);

const canonicalReason = ({ directive, issues, label, line, sourceId }) => {
  const argumentsList = directive.arguments ?? [];
  const reasonArguments = argumentsList.filter((argument) => argument.name.value === 'reason');
  const reason = reasonArguments[0]?.value;
  if (
    argumentsList.length !== 1 ||
    reasonArguments.length !== 1 ||
    !reason ||
    reason.kind !== Kind.STRING ||
    reason.value.trim().length === 0 ||
    reason.value.includes('*/')
  ) {
    issues.push({
      file: sourceId,
      line: directive.loc?.startToken.line ?? line,
      message: `${label} must declare exactly one non-empty string @${directive.name.value} reason and no other arguments`,
      rule: 'deprecated-reason-invalid',
    });
    return null;
  }
  const normalizedReason = reason.value.replace(/\s+/g, ' ').trim();
  if (!OPENIAP_REMOVAL_NOTICE_PATTERN.test(normalizedReason)) {
    issues.push({
      file: sourceId,
      line: directive.loc?.startToken.line ?? line,
      message: `${label} deprecation reason must end with "Scheduled for removal in OpenIAP <major>.<minor>."`,
      rule: 'deprecated-removal-schedule-missing',
    });
    return null;
  }
  return normalizedReason;
};

/**
 * Extract and validate the canonical deprecation metadata shared by linting,
 * IR generation, TypeScript post-processing, and generated-output tests.
 */
export const extractSchemaDeprecations = (sources) => {
  const entries = [];
  const issues = [];
  const typeReasons = new Map();
  const operationArguments = [];
  const entryOwners = new Map();

  for (const { sourceId, sdl } of normalizeSchemaSources(sources)) {
    const document = parse(sdl);
    for (const comment of collectGraphQLComments(sdl)) {
      if (/^#\s*@deprecated\b/i.test(comment.text.trim())) {
        issues.push({
          file: sourceId,
          line: comment.line,
          message: 'Legacy "# @deprecated" comments are not canonical; use a GraphQL deprecation directive',
          rule: 'deprecated-comment-legacy',
        });
      }
    }

    const processNode = ({ node, parentKind, parentName, ownerPath, typeLevel = false }) => {
      const directives = node.directives ?? [];
      const canonicalName = typeLevel ? TYPE_DEPRECATION_DIRECTIVE : 'deprecated';
      const wrongName = typeLevel ? 'deprecated' : TYPE_DEPRECATION_DIRECTIVE;
      const canonical = directives.filter((directive) => directive.name.value === canonicalName);
      const wrong = directives.filter((directive) => directive.name.value === wrongName);
      const label = `${node.kind} "${ownerPath}"`;
      const line = node.loc?.startToken.line;
      const descriptionTag = node.description && /(?:^|\n)\s*@deprecated\b/.test(node.description.value);

      for (const directive of wrong) {
        issues.push({
          file: sourceId,
          line: directive.loc?.startToken.line ?? line,
          message: typeLevel
            ? `${label} must use @${TYPE_DEPRECATION_DIRECTIVE}; standard @deprecated does not support type definitions`
            : `${label} must use standard @deprecated; @${TYPE_DEPRECATION_DIRECTIVE} is reserved for type definitions`,
          rule: 'deprecated-directive-location',
        });
      }

      if (canonical.length > 1) {
        issues.push({
          file: sourceId,
          line,
          message: `${label} declares @${canonicalName} more than once`,
          rule: 'deprecated-directive-duplicate',
        });
      }

      if (descriptionTag) {
        issues.push({
          file: sourceId,
          line,
          message:
            canonical.length > 0
              ? `${label} duplicates directive-owned @deprecated guidance in its description`
              : `${label} declares @deprecated guidance only in its description; move the canonical reason to a directive`,
          rule: canonical.length > 0 ? 'deprecated-description-duplicate' : 'deprecated-directive-missing',
        });
      }

      if (canonical.length !== 1) return null;
      const reason = canonicalReason({
        directive: canonical[0],
        issues,
        label,
        line,
        sourceId,
      });
      if (!reason) return null;

      const name = node.name?.value ?? node.kind;
      const previous = entryOwners.get(ownerPath);
      if (previous) {
        issues.push({
          file: sourceId,
          line,
          message: `${label} duplicates @${canonicalName} ownership from ${previous.sourceId}${previous.line ? `:${previous.line}` : ''}`,
          rule: 'deprecated-directive-duplicate',
        });
        return null;
      }

      const entry = {
        kind: node.kind,
        name,
        parentKind,
        parentName,
        ownerPath,
        reason,
        sourceId,
        line,
      };
      entryOwners.set(ownerPath, { line, sourceId });
      entries.push(entry);

      if (typeLevel) {
        typeReasons.set(name, { reason, sourceId, line });
      }
      return entry;
    };

    for (const definition of document.definitions) {
      if (!TYPE_DEFINITION_KINDS.has(definition.kind)) continue;
      const typeName = definition.name.value;
      processNode({
        node: definition,
        ownerPath: typeName,
        typeLevel: true,
      });

      if (definition.kind === Kind.ENUM_TYPE_DEFINITION || definition.kind === Kind.ENUM_TYPE_EXTENSION) {
        for (const value of definition.values ?? []) {
          processNode({
            node: value,
            ownerPath: `${typeName}.${value.name.value}`,
            parentKind: definition.kind,
            parentName: typeName,
          });
        }
        continue;
      }

      if (!('fields' in definition)) continue;
      for (const field of definition.fields ?? []) {
        const fieldPath = `${typeName}.${field.name.value}`;
        processNode({
          node: field,
          ownerPath: fieldPath,
          parentKind: definition.kind,
          parentName: typeName,
        });
        if (!('arguments' in field)) continue;
        for (const argument of field.arguments ?? []) {
          const argumentPath = `${fieldPath}.${argument.name.value}`;
          const entry = processNode({
            node: argument,
            ownerPath: argumentPath,
            parentKind: field.kind,
            parentName: fieldPath,
          });
          const directive = (argument.directives ?? []).find((candidate) => candidate.name.value === 'deprecated');
          if (entry && directive && (typeName === 'Query' || typeName === 'Mutation' || typeName === 'Subscription')) {
            operationArguments.push({
              rootName: typeName,
              fieldName: field.name.value,
              argumentName: argument.name.value,
              reason: entry.reason,
            });
          }
        }
      }
    }
  }

  return {
    entries,
    issues,
    operationArguments,
    typeReasons: new Map([...typeReasons].map(([name, metadata]) => [name, metadata.reason])),
  };
};

export const assertValidSchemaDeprecations = (deprecations) => {
  if (deprecations.issues.length === 0) return;
  throw new Error(
    `Invalid GraphQL deprecation metadata:\n${deprecations.issues
      .map((issue) => `- ${issue.file}${issue.line ? `:${issue.line}` : ''}: ${issue.message}`)
      .join('\n')}`,
  );
};
