/**
 * Shared Utilities for GraphQL Code Generation
 *
 * Case conversion, keyword escaping, and other common utilities
 * used across all language plugins.
 */

// ============================================================================
// Case Conversion
// ============================================================================

/**
 * Convert to PascalCase (e.g., "my_value" -> "MyValue")
 */
export function toPascalCase(value: string): string {
  const tokens = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-\s]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((token) => token.toLowerCase());
  if (tokens.length === 0) return value;
  return tokens.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join('');
}

/**
 * Convert to camelCase (e.g., "my_value" -> "myValue")
 */
export function toCamelCase(value: string): string {
  const pascal = toPascalCase(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

/**
 * Convert to lowerCamelCase (same as camelCase but preserves more context)
 */
export function toLowerCamelCase(value: string): string {
  const parts = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment.toLowerCase());
  if (parts.length === 0) return value;
  return (
    parts[0] +
    parts
      .slice(1)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join('')
  );
}

/**
 * Convert to kebab-case (e.g., "MyValue" -> "my-value")
 */
export function toKebabCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-')
    .toLowerCase();
}

/**
 * Convert to snake_case (e.g., "MyValue" -> "my_value")
 */
export function toSnakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}

/**
 * Convert to CONSTANT_CASE (e.g., "MyValue" -> "MY_VALUE")
 */
export function toConstantCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toUpperCase();
}

/**
 * Capitalize first letter
 */
export function capitalize(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Uncapitalize first letter
 */
export function uncapitalize(value: string): string {
  return value.length === 0 ? value : value.charAt(0).toLowerCase() + value.slice(1);
}

/**
 * Convert to camelCase preserving IOS suffix (for Dart/GDScript)
 * e.g., "daysUntilExpirationIOS" stays "daysUntilExpirationIOS"
 */
export function toCamelCasePreserveIOS(value: string): string {
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
      return 'ios';
    }
    return first;
  };
  const firstToken = formatFirst();
  const restTokens = rest.map((token) =>
    token === 'IOS' ? 'IOS' : token.charAt(0).toUpperCase() + token.slice(1)
  );
  return [firstToken, ...restTokens].join('');
}

/**
 * Convert to PascalCase preserving IOS suffix (for Dart/GDScript)
 * e.g., "promoted_product_ios" -> "PromotedProductIOS"
 */
export function toPascalCasePreserveIOS(value: string): string {
  const tokens = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_\-\s]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((token) => token.toLowerCase());
  if (tokens.length === 0) return value;
  const normalized = tokens.map((token) => (token === 'ios' ? 'IOS' : token));
  return normalized.map((token) =>
    token === 'IOS' ? 'IOS' : token.charAt(0).toUpperCase() + token.slice(1)
  ).join('');
}

// ============================================================================
// Language Keywords
// ============================================================================

export const SWIFT_KEYWORDS = new Set([
  'associatedtype',
  'class',
  'deinit',
  'enum',
  'extension',
  'func',
  'import',
  'init',
  'inout',
  'internal',
  'let',
  'operator',
  'private',
  'protocol',
  'public',
  'static',
  'struct',
  'subscript',
  'typealias',
  'var',
  'break',
  'case',
  'continue',
  'default',
  'defer',
  'do',
  'else',
  'fallthrough',
  'for',
  'guard',
  'if',
  'in',
  'repeat',
  'return',
  'switch',
  'where',
  'while',
  'as',
  'catch',
  'false',
  'is',
  'nil',
  'rethrows',
  'super',
  'self',
  'Self',
  'throw',
  'throws',
  'true',
  'try',
  'Any',
  'Protocol',
]);

export const KOTLIN_KEYWORDS = new Set([
  'as',
  'break',
  'class',
  'continue',
  'do',
  'else',
  'false',
  'for',
  'fun',
  'if',
  'in',
  'interface',
  'is',
  'null',
  'object',
  'package',
  'return',
  'super',
  'this',
  'throw',
  'true',
  'try',
  'typealias',
  'val',
  'var',
  'when',
  'while',
]);

export const DART_KEYWORDS = new Set([
  'abstract',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'covariant',
  'default',
  'deferred',
  'do',
  'dynamic',
  'else',
  'enum',
  'export',
  'extends',
  'extension',
  'external',
  'factory',
  'false',
  'final',
  'finally',
  'for',
  'Function',
  'get',
  'hide',
  'if',
  'implements',
  'import',
  'in',
  'interface',
  'is',
  'late',
  'library',
  'mixin',
  'new',
  'null',
  'on',
  'operator',
  'part',
  'required',
  'rethrow',
  'return',
  'set',
  'show',
  'static',
  'super',
  'switch',
  'sync',
  'this',
  'throw',
  'true',
  'try',
  'typedef',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

export const GDSCRIPT_KEYWORDS = new Set([
  'if',
  'elif',
  'else',
  'for',
  'while',
  'match',
  'break',
  'continue',
  'pass',
  'return',
  'class',
  'class_name',
  'extends',
  'is',
  'as',
  'self',
  'signal',
  'func',
  'static',
  'const',
  'enum',
  'var',
  'onready',
  'export',
  'setget',
  'tool',
  'yield',
  'assert',
  'breakpoint',
  'preload',
  'await',
  'in',
  'not',
  'and',
  'or',
  'true',
  'false',
  'null',
  'PI',
  'TAU',
  'INF',
  'NAN',
]);

export const TYPESCRIPT_RESERVED = new Set([
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'new',
  'null',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  // Strict mode reserved
  'implements',
  'interface',
  'let',
  'package',
  'private',
  'protected',
  'public',
  'static',
  'yield',
]);

// ============================================================================
// Keyword Escaping
// ============================================================================

export function escapeSwiftKeyword(name: string): string {
  return SWIFT_KEYWORDS.has(name) ? `\`${name}\`` : name;
}

export function escapeKotlinKeyword(name: string): string {
  return KOTLIN_KEYWORDS.has(name) ? `\`${name}\`` : name;
}

export function escapeDartKeyword(name: string): string {
  return DART_KEYWORDS.has(name) ? `${name}_` : name;
}

export function escapeGDScriptKeyword(name: string): string {
  return GDSCRIPT_KEYWORDS.has(name) ? `${name}_` : name;
}

export function escapeTypeScriptKeyword(name: string): string {
  // TypeScript generally doesn't need escaping for property names
  return name;
}

// ============================================================================
// Scalar Mappings
// ============================================================================

export const GRAPHQL_TO_SWIFT: Record<string, string> = {
  ID: 'String',
  String: 'String',
  Boolean: 'Bool',
  Int: 'Int',
  Float: 'Double',
};

export const GRAPHQL_TO_KOTLIN: Record<string, string> = {
  ID: 'String',
  String: 'String',
  Boolean: 'Boolean',
  Int: 'Int',
  Float: 'Double',
};

export const GRAPHQL_TO_DART: Record<string, string> = {
  ID: 'String',
  String: 'String',
  Boolean: 'bool',
  Int: 'int',
  Float: 'double',
};

export const GRAPHQL_TO_GDSCRIPT: Record<string, string> = {
  ID: 'String',
  String: 'String',
  Boolean: 'bool',
  Int: 'int',
  Float: 'float',
};

export const GRAPHQL_TO_TYPESCRIPT: Record<string, string> = {
  ID: 'string',
  String: 'string',
  Boolean: 'boolean',
  Int: 'number',
  Float: 'number',
};

// ============================================================================
// Platform Defaults for Discriminated Unions
// ============================================================================

export const PLATFORM_TYPE_DEFAULTS: Record<
  string,
  { platform: string; type: string }
> = {
  ProductIOS: { platform: 'ios', type: 'in-app' },
  ProductAndroid: { platform: 'android', type: 'in-app' },
  ProductSubscriptionIOS: { platform: 'ios', type: 'subs' },
  ProductSubscriptionAndroid: { platform: 'android', type: 'subs' },
};

// ============================================================================
// Custom Types
// ============================================================================

export const CUSTOM_INPUT_TYPES = new Set([
  'RequestPurchaseProps',
  'DiscountOfferInputIOS',
  'PurchaseInput',
]);

export const TYPE_ALIASES: Record<string, string> = {
  PurchaseInput: 'Purchase',
  VoidResult: 'Void',
};

// ============================================================================
// Legacy Aliases for ErrorCode
// ============================================================================

export const ERROR_CODE_LEGACY_ALIASES: Record<string, string> = {
  'receipt-failed': 'purchaseVerificationFailed',
  ReceiptFailed: 'purchaseVerificationFailed',
};

// ============================================================================
// File Header
// ============================================================================

export function generateFileHeader(language: string): string[] {
  const header = [
    '// ============================================================================',
    '// AUTO-GENERATED TYPES — DO NOT EDIT DIRECTLY',
    '// Run `npm run generate` after updating any *.graphql schema file.',
    '// ============================================================================',
    '',
  ];

  switch (language) {
    case 'swift':
      header.push('import Foundation', '');
      break;
    case 'kotlin':
      header.push(
        '// Suppress unchecked cast warnings for JSON Map parsing - unavoidable due to Kotlin type erasure',
        '@file:Suppress("UNCHECKED_CAST")',
        ''
      );
      break;
    case 'dart':
      header.push("import 'dart:convert';", '');
      break;
  }

  return header;
}

// ============================================================================
// Documentation Comments
// ============================================================================

export function formatDocComment(
  description: string | undefined,
  indent: string,
  style: 'swift' | 'kotlin' | 'typescript' | 'dart' | 'gdscript'
): string[] {
  if (!description) return [];

  const lines = description.split(/\r?\n/);

  switch (style) {
    case 'swift':
      return lines.map((line) => `${indent}/// ${line}`);
    case 'kotlin':
    case 'typescript':
    case 'dart':
      if (lines.length === 1) {
        return [`${indent}/** ${lines[0]} */`];
      }
      return [
        `${indent}/**`,
        ...lines.map((line) => `${indent} * ${line}`),
        `${indent} */`,
      ];
    case 'gdscript':
      return lines.map((line) => `${indent}## ${line}`);
    default:
      return lines.map((line) => `${indent}// ${line}`);
  }
}
