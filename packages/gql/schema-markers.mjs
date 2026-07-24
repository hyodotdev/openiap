import { Kind, parse } from 'graphql';
import { collectGraphQLComments, normalizeSchemaSources } from './schema-source-utils.mjs';

const UNION_MARKER_PATTERN = /^#\s*=>\s*Union\s*$/i;
const FUTURE_MARKER_PATTERN = /^#\s*Future\s*$/i;
const ASYNC_ROOT_NAMES = new Set(['Query', 'Mutation']);
const OPERATION_ROOT_NAMES = new Set(['Query', 'Mutation', 'Subscription']);
const FIELD_CONTAINER_KINDS = new Set([
  Kind.INPUT_OBJECT_TYPE_DEFINITION,
  Kind.INPUT_OBJECT_TYPE_EXTENSION,
  Kind.INTERFACE_TYPE_DEFINITION,
  Kind.INTERFACE_TYPE_EXTENSION,
  Kind.OBJECT_TYPE_DEFINITION,
  Kind.OBJECT_TYPE_EXTENSION,
]);

const lineStartOffsets = (sdl) => {
  const offsets = [0];
  for (const match of sdl.matchAll(/\r?\n/g)) {
    offsets.push(match.index + match[0].length);
  }
  return offsets;
};

const nextSignificantTarget = (lines, starts, markerIndex) => {
  for (let index = markerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue;
    return {
      line: index + 1,
      offset: starts[index] + line.search(/\S/),
    };
  }
  return null;
};

const collectTargets = (sdl) => {
  const typeTargets = new Map();
  const fieldTargets = new Map();
  const document = parse(sdl);

  for (const definition of document.definitions) {
    if (!FIELD_CONTAINER_KINDS.has(definition.kind)) continue;

    if (definition.kind === Kind.OBJECT_TYPE_DEFINITION || definition.kind === Kind.OBJECT_TYPE_EXTENSION) {
      if (definition.loc) {
        typeTargets.set(definition.loc.start, definition.name.value);
        for (let token = definition.loc.startToken; token && token.start < definition.name.loc.start; token = token.next) {
          if (token.value === 'type' || token.value === 'extend') {
            typeTargets.set(token.start, definition.name.value);
          }
        }
      }
    }

    for (const field of definition.fields ?? []) {
      if (field.loc) {
        const target = {
          owner: definition.name.value,
          field: field.name.value,
        };
        fieldTargets.set(field.loc.start, target);
        fieldTargets.set(field.name.loc.start, target);
      }
    }
  }

  return { fieldTargets, typeTargets };
};

/**
 * Extract the code-generation markers that live in GraphQL SDL comments.
 *
 * Generation and linting consume this helper so marker recognition, target
 * ownership, and invalid-target behavior cannot drift across pipelines.
 */
export const extractSchemaMarkers = (sdlSources) => {
  const unionWrappers = new Set();
  const futureFields = new Set();
  const issues = [];
  const unionOwners = new Map();
  const futureOwners = new Map();

  for (const { sourceId, sdl } of normalizeSchemaSources(sdlSources)) {
    const lines = sdl.split(/\r?\n/);
    const starts = lineStartOffsets(sdl);
    const { fieldTargets, typeTargets } = collectTargets(sdl);

    for (const comment of collectGraphQLComments(sdl)) {
      const isUnionMarker = UNION_MARKER_PATTERN.test(comment.text.trim());
      const isFutureMarker = FUTURE_MARKER_PATTERN.test(comment.text.trim());
      if (!isUnionMarker && !isFutureMarker) continue;

      const markerLine = comment.line;
      if (!comment.standalone) {
        issues.push({
          kind: isUnionMarker ? 'union' : 'future',
          reason: 'invalid-placement',
          sourceId,
          markerLine,
          targetLine: null,
        });
        continue;
      }

      const index = markerLine - 1;
      const targetPosition = nextSignificantTarget(lines, starts, index);
      const targetLine = targetPosition?.line ?? null;
      if (isUnionMarker) {
        const typeName = targetPosition ? typeTargets.get(targetPosition.offset) : null;
        if (typeName && OPERATION_ROOT_NAMES.has(typeName)) {
          issues.push({
            kind: 'union',
            reason: 'invalid-owner',
            sourceId,
            markerLine,
            targetLine,
            target: typeName,
          });
        } else if (typeName) {
          const previous = unionOwners.get(typeName);
          if (previous) {
            issues.push({
              kind: 'union',
              reason: 'duplicate-marker',
              sourceId,
              markerLine,
              targetLine,
              target: typeName,
              previous,
            });
          } else {
            unionOwners.set(typeName, { sourceId, markerLine });
            unionWrappers.add(typeName);
          }
        } else {
          issues.push({
            kind: 'union',
            reason: 'invalid-target',
            sourceId,
            markerLine,
            targetLine,
          });
        }
      } else {
        const target = targetPosition ? fieldTargets.get(targetPosition.offset) : null;
        if (!target) {
          issues.push({
            kind: 'future',
            reason: 'invalid-target',
            sourceId,
            markerLine,
            targetLine,
          });
        } else if (target.field === '_placeholder') {
          issues.push({
            kind: 'future',
            reason: 'no-effect',
            sourceId,
            markerLine,
            targetLine,
            target: `${target.owner}.${target.field}`,
          });
        } else if (!ASYNC_ROOT_NAMES.has(target.owner)) {
          issues.push({
            kind: 'future',
            reason: 'invalid-owner',
            sourceId,
            markerLine,
            targetLine,
            target: `${target.owner}.${target.field}`,
          });
        } else {
          const key = `${target.owner}.${target.field}`;
          const previous = futureOwners.get(key);
          if (previous) {
            issues.push({
              kind: 'future',
              reason: 'duplicate-marker',
              sourceId,
              markerLine,
              targetLine,
              target: key,
              previous,
            });
          } else {
            futureOwners.set(key, { sourceId, markerLine });
            futureFields.add(key);
          }
        }
      }
    }
  }

  return { futureFields, issues, unionWrappers };
};

export const schemaMarkerIssueMessage = (issue, sourceLabel = (sourceId) => sourceId) => {
  const marker = issue.kind === 'union' ? '# => Union' : '# Future';
  if (issue.reason === 'invalid-placement') {
    return `"${marker}" must be a standalone comment immediately before its target`;
  }
  if (issue.reason === 'duplicate-marker') {
    return `"${marker}" duplicates ${issue.target} ownership from ${sourceLabel(issue.previous.sourceId)}:${issue.previous.markerLine}`;
  }
  if (issue.reason === 'invalid-owner') {
    return issue.kind === 'union'
      ? `"${marker}" targets ${issue.target}; operation root types cannot be union wrappers`
      : `"${marker}" targets ${issue.target}; only Query and Mutation fields may be asynchronous`;
  }
  if (issue.reason === 'no-effect') {
    return `"${marker}" targets ${issue.target}; placeholder fields cannot carry generation markers`;
  }
  const target = issue.kind === 'union' ? 'object type definition' : 'field definition';
  return issue.targetLine ? `"${marker}" is not followed by a valid ${target}` : `"${marker}" has no following ${target} (end of file)`;
};

export const schemaMarkerIssueRule = (issue) =>
  issue.reason === 'duplicate-marker'
    ? 'generation-marker-duplicate'
    : issue.reason === 'invalid-placement'
      ? 'generation-marker-placement'
      : issue.kind === 'union'
        ? 'union-marker-target'
        : 'future-marker-target';

const formatSchemaMarkerIssue = (issue) => `${issue.sourceId}:${issue.markerLine}: ${schemaMarkerIssueMessage(issue)}`;

export const assertValidSchemaMarkers = (markers) => {
  if (markers.issues.length === 0) return;
  throw new Error(
    `Invalid GraphQL generation marker ownership:\n${markers.issues.map((issue) => `- ${formatSchemaMarkerIssue(issue)}`).join('\n')}`,
  );
};
