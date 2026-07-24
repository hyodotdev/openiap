/**
 * GraphQL Schema Convention Linter
 *
 * Validates GraphQL schema files against OpenIAP naming conventions:
 * - iOS types/fields must end with "IOS" suffix
 * - Android types/fields must end with "Android" suffix
 * - Union markers ("# => Union") must have corresponding union types
 * - Query and Mutation fields require valid Future markers ("# Future")
 * - Platform-specific files should only contain platform-specific types
 */

import { Kind, parse, type DefinitionNode, type TypeNode } from 'graphql';
import type { ParsedSchema } from './parser.js';
import { schemaMarkerIssueMessage, schemaMarkerIssueRule } from '../../schema-markers.mjs';

export interface LintResult {
  level: 'error' | 'warning';
  file?: string;
  line?: number;
  message: string;
  rule: string;
}

const IOS_TYPE_SUFFIX_EXCEPTIONS = new Set([
  // StoreKit names this payload AppTransaction; keep the public OpenIAP type stable.
  'AppTransaction',
  // StoreKit names this enum ExternalPurchaseNotice.Action.
  'ExternalPurchaseNoticeAction',
  // Platform selector naming retained by the public verification contract.
  'VerifyPurchaseAppleOptions',
]);

const ANDROID_TYPE_SUFFIX_EXCEPTIONS = new Set([
  // Legacy public type name from the User Choice Billing API.
  'UserChoiceBillingDetails',
  // Meta Horizon verification result is Android-flavor specific but keeps the
  // store suffix for API clarity.
  'VerifyPurchaseResultHorizon',
  // Platform selector naming retained by the public verification contract.
  'VerifyPurchaseGoogleOptions',
]);

const PLATFORM_SELECTOR_TYPE_TOKENS: Record<string, readonly string[]> = {
  apple: ['Apple', 'IOS', 'Ios'],
  google: ['Google', 'Android'],
  ios: ['Apple', 'IOS', 'Ios'],
  android: ['Google', 'Android'],
  horizon: ['Horizon'],
  amazon: ['Amazon'],
};

function isAllowedPlatformTypeName(typeName: string, platform: 'ios' | 'android'): boolean {
  if (typeName === 'Query' || typeName === 'Mutation' || typeName === 'Subscription') {
    return true;
  }

  if (platform === 'ios') {
    return typeName.endsWith('IOS') || (typeName.includes('Ios') && !typeName.endsWith('Ios')) || IOS_TYPE_SUFFIX_EXCEPTIONS.has(typeName);
  }

  return (
    typeName.includes('Android') ||
    typeName.includes('Horizon') ||
    typeName.includes('Amazon') ||
    ANDROID_TYPE_SUFFIX_EXCEPTIONS.has(typeName)
  );
}

function namedTypeName(type: TypeNode): string {
  let current = type;
  while (current.kind === Kind.LIST_TYPE || current.kind === Kind.NON_NULL_TYPE) {
    current = current.type;
  }
  return current.name.value;
}

function platformTypeName(definition: DefinitionNode): string | null {
  return 'name' in definition && definition.kind.includes('Type') ? definition.name.value : null;
}

function referencedPlatform(typeName: string): 'ios' | 'android' | null {
  if (
    typeName.includes('Android') ||
    typeName.includes('Horizon') ||
    typeName.includes('Amazon') ||
    ANDROID_TYPE_SUFFIX_EXCEPTIONS.has(typeName)
  ) {
    return 'android';
  }
  if (typeName.includes('IOS') || typeName.includes('Ios') || IOS_TYPE_SUFFIX_EXCEPTIONS.has(typeName)) {
    return 'ios';
  }
  return null;
}

function parentProvidesPlatformContext(typeName: string, platform: 'ios' | 'android'): boolean {
  return referencedPlatform(typeName) === platform;
}

function isPlatformSelectorField(fieldName: string, referencedType: string): boolean {
  return PLATFORM_SELECTOR_TYPE_TOKENS[fieldName]?.some((token) => referencedType.includes(token)) ?? false;
}

/**
 * Lint schema conventions and return findings.
 */
export function lintSchema(parsedSchema: ParsedSchema): LintResult[] {
  const results: LintResult[] = [];

  for (const issue of parsedSchema.markers.issues) {
    const fileName = issue.sourceId.split('/').pop() ?? issue.sourceId;
    const message = schemaMarkerIssueMessage(issue, (sourceId) => sourceId.split('/').pop() ?? sourceId);
    results.push({
      level: 'error',
      file: fileName,
      line: issue.markerLine,
      message,
      rule: schemaMarkerIssueRule(issue),
    });
  }

  for (const issue of parsedSchema.deprecations.issues) {
    results.push({
      level: 'error',
      file: issue.file.split('/').pop() ?? issue.file,
      line: issue.line,
      message: issue.message,
      rule: issue.rule,
    });
  }

  for (const [filePath, sdl] of parsedSchema.sdlContents.entries()) {
    const fileName = filePath.split('/').pop() ?? filePath;
    const isIOSFile = fileName.includes('-ios') || fileName.includes('_ios');
    const isAndroidFile = fileName.includes('-android') || fileName.includes('_android');

    const document = parse(sdl);

    for (const definition of document.definitions) {
      const typeName = platformTypeName(definition);

      if (typeName && isIOSFile && !isAllowedPlatformTypeName(typeName, 'ios')) {
        results.push({
          level: 'error',
          file: fileName,
          line: 'name' in definition ? definition.name?.loc?.startToken.line : undefined,
          message: `Type "${typeName}" in iOS file should end with "IOS" suffix`,
          rule: 'ios-type-suffix',
        });
      }
      if (typeName && isAndroidFile && !isAllowedPlatformTypeName(typeName, 'android')) {
        results.push({
          level: 'error',
          file: fileName,
          line: 'name' in definition ? definition.name?.loc?.startToken.line : undefined,
          message: `Type "${typeName}" in Android file should end with "Android" suffix`,
          rule: 'android-type-suffix',
        });
      }

      if (!('name' in definition) || !definition.name || !('fields' in definition) || !definition.fields) {
        continue;
      }

      const operationName = definition.name.value;

      for (const field of definition.fields ?? []) {
        const fieldName = field.name.value;
        if (isIOSFile && fieldName.endsWith('Ios')) {
          results.push({
            level: 'error',
            file: fileName,
            line: field.name.loc?.startToken.line,
            message: `Field "${fieldName}" uses "Ios" suffix — should be "IOS" (all caps)`,
            rule: 'ios-field-case',
          });
        }
        const references = [
          { selector: fieldName, type: namedTypeName(field.type) },
          ...('arguments' in field ? (field.arguments ?? []) : []).map((argument) => ({
            selector: argument.name.value,
            type: namedTypeName(argument.type),
          })),
        ];
        const reportedPlatforms = new Set<'ios' | 'android'>();

        for (const reference of references) {
          const fieldPlatform = referencedPlatform(reference.type);
          if (
            !fieldPlatform ||
            reportedPlatforms.has(fieldPlatform) ||
            parentProvidesPlatformContext(operationName, fieldPlatform) ||
            isPlatformSelectorField(reference.selector, reference.type) ||
            fieldName.endsWith(fieldPlatform === 'ios' ? 'IOS' : 'Android')
          ) {
            continue;
          }

          reportedPlatforms.add(fieldPlatform);
          const suffix = fieldPlatform === 'ios' ? 'IOS' : 'Android';
          results.push({
            level: 'error',
            file: fileName,
            line: field.name.loc?.startToken.line ?? field.loc?.startToken.line,
            message: `Field "${operationName}.${fieldName}" references platform-specific type "${reference.type}" and must end with "${suffix}"`,
            rule: 'platform-field-suffix',
          });
        }

        if (
          (operationName === 'Query' || operationName === 'Mutation') &&
          fieldName !== '_placeholder' &&
          !parsedSchema.markers.futureFields.has(`${operationName}.${fieldName}`)
        ) {
          results.push({
            level: 'error',
            file: fileName,
            line: field.name.loc?.startToken.line ?? field.loc?.startToken.line,
            message: `Async operation "${operationName}.${fieldName}" must be preceded by "# Future"`,
            rule: 'future-marker-required',
          });
        }
      }
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
  lines.push(`[schema-lint] ${errors} error(s), ${warnings} warning(s)`);

  return lines.join('\n');
}
