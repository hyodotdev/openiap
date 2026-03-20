/**
 * GraphQL Schema Convention Linter
 *
 * Validates GraphQL schema files against OpenIAP naming conventions:
 * - iOS types/fields must end with "IOS" suffix
 * - Android types/fields must end with "Android" suffix
 * - Union markers ("# => Union") must have corresponding union types
 * - Future markers ("# Future") must precede valid fields
 * - Platform-specific files should only contain platform-specific types
 */

import type { ParsedSchema } from './parser.js';

export interface LintResult {
  level: 'error' | 'warning';
  file?: string;
  line?: number;
  message: string;
  rule: string;
}

export interface LintOptions {
  /** Treat warnings as errors */
  strict?: boolean;
}

/**
 * Lint schema conventions and return findings.
 */
export function lintSchema(
  parsedSchema: ParsedSchema,
  _options: LintOptions = {},
): LintResult[] {
  const results: LintResult[] = [];

  for (const [filePath, sdl] of parsedSchema.sdlContents.entries()) {
    const fileName = filePath.split('/').pop() ?? filePath;
    const lines = sdl.split(/\r?\n/);
    const isIOSFile = fileName.includes('-ios') || fileName.includes('_ios');
    const isAndroidFile =
      fileName.includes('-android') || fileName.includes('_android');

    let pendingUnionMarker = false;
    let pendingUnionLine = 0;
    let pendingFutureMarker = false;
    let pendingFutureLine = 0;
    let currentTypeName: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      const lineNum = i + 1;

      // Track type definitions
      const typeMatch = trimmed.match(/^type\s+([A-Za-z0-9_]+)/);
      if (typeMatch) {
        const typeName = typeMatch[1];
        currentTypeName = typeName;

        // Check union marker resolution
        if (pendingUnionMarker) {
          pendingUnionMarker = false;
        }

        // Platform suffix checks for types in platform-specific files
        if (isIOSFile && !typeName.endsWith('IOS') && !typeName.startsWith('Query') && !typeName.startsWith('Mutation')) {
          results.push({
            level: 'warning',
            file: fileName,
            line: lineNum,
            message: `Type "${typeName}" in iOS file should end with "IOS" suffix`,
            rule: 'ios-type-suffix',
          });
        }

        if (isAndroidFile && !typeName.endsWith('Android') && !typeName.startsWith('Query') && !typeName.startsWith('Mutation')) {
          results.push({
            level: 'warning',
            file: fileName,
            line: lineNum,
            message: `Type "${typeName}" in Android file should end with "Android" suffix`,
            rule: 'android-type-suffix',
          });
        }

        continue;
      }

      // Track union marker
      if (trimmed.startsWith('#') && trimmed.toLowerCase().includes('=> union')) {
        pendingUnionMarker = true;
        pendingUnionLine = lineNum;
        continue;
      }

      // Track Future marker
      if (/^#\s*future\b/i.test(trimmed)) {
        pendingFutureMarker = true;
        pendingFutureLine = lineNum;
        continue;
      }

      // Check Future marker is followed by a valid field
      if (pendingFutureMarker && currentTypeName) {
        const fieldMatch = trimmed.match(/^([A-Za-z0-9_]+)\s*[:(]/);
        if (fieldMatch) {
          pendingFutureMarker = false;
        } else if (trimmed.length > 0 && !trimmed.startsWith('#') && trimmed !== '}') {
          results.push({
            level: 'warning',
            file: fileName,
            line: pendingFutureLine,
            message: `"# Future" marker at line ${pendingFutureLine} is not followed by a valid field definition`,
            rule: 'future-marker-target',
          });
          pendingFutureMarker = false;
        }
      }

      // Check for orphaned union markers (hit non-type content without resolving)
      if (
        pendingUnionMarker &&
        trimmed.length > 0 &&
        !trimmed.startsWith('#') &&
        !trimmed.startsWith('type ')
      ) {
        results.push({
          level: 'error',
          file: fileName,
          line: pendingUnionLine,
          message: `"# => Union" marker at line ${pendingUnionLine} is not followed by a type definition`,
          rule: 'union-marker-target',
        });
        pendingUnionMarker = false;
      }

      // Check field naming in platform-specific types
      if (currentTypeName && trimmed.match(/^[a-zA-Z]/)) {
        const fieldMatch = trimmed.match(/^([A-Za-z0-9_]+)\s*[:(]/);
        if (fieldMatch) {
          const fieldName = fieldMatch[1];

          // iOS fields in iOS types should have IOS suffix
          if (
            isIOSFile &&
            currentTypeName.endsWith('IOS') &&
            fieldName.endsWith('Ios') &&
            !fieldName.endsWith('IOS')
          ) {
            results.push({
              level: 'error',
              file: fileName,
              line: lineNum,
              message: `Field "${fieldName}" uses "Ios" suffix — should be "IOS" (all caps)`,
              rule: 'ios-field-case',
            });
          }
        }
      }

      // Reset type context on closing brace
      if (trimmed === '}') {
        currentTypeName = null;
      }
    }

    // End-of-file checks
    if (pendingUnionMarker) {
      results.push({
        level: 'error',
        file: fileName,
        line: pendingUnionLine,
        message: `"# => Union" marker at line ${pendingUnionLine} has no following type definition (end of file)`,
        rule: 'union-marker-target',
      });
    }

    if (pendingFutureMarker) {
      results.push({
        level: 'warning',
        file: fileName,
        line: pendingFutureLine,
        message: `"# Future" marker at line ${pendingFutureLine} has no following field definition (end of file)`,
        rule: 'future-marker-target',
      });
    }
  }

  return results;
}

/**
 * Format lint results for console output.
 */
export function formatLintResults(results: LintResult[]): string {
  if (results.length === 0) {
    return '[schema-lint] All conventions passed!';
  }

  const lines = results.map((r) => {
    const location = r.file ? `${r.file}${r.line ? `:${r.line}` : ''}` : 'unknown';
    const icon = r.level === 'error' ? '✗' : '⚠';
    return `  ${icon} ${location}: ${r.message} (${r.rule})`;
  });

  const errors = results.filter((r) => r.level === 'error').length;
  const warnings = results.filter((r) => r.level === 'warning').length;

  lines.push('');
  lines.push(
    `[schema-lint] ${errors} error(s), ${warnings} warning(s)`,
  );

  return lines.join('\n');
}
