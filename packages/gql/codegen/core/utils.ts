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
  const restTokens = rest.map((token) => (token === 'IOS' ? 'IOS' : token.charAt(0).toUpperCase() + token.slice(1)));
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
  return normalized.map((token) => (token === 'IOS' ? 'IOS' : token.charAt(0).toUpperCase() + token.slice(1))).join('');
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

// ============================================================================
// Scalar Mappings
// ============================================================================

type GraphQLScalarContract = Readonly<{
  typescript: Readonly<{ input: string; output: string }>;
  swift: string;
  kotlin: string;
  dart: string;
  gdscript: string;
  csharp: string;
}>;

const GRAPHQL_SCALAR_CONTRACTS: Readonly<Record<string, GraphQLScalarContract>> = Object.freeze({
  ID: Object.freeze({
    typescript: Object.freeze({ input: 'string', output: 'string' }),
    swift: 'String',
    kotlin: 'String',
    dart: 'String',
    gdscript: 'String',
    csharp: 'string',
  }),
  String: Object.freeze({
    typescript: Object.freeze({ input: 'string', output: 'string' }),
    swift: 'String',
    kotlin: 'String',
    dart: 'String',
    gdscript: 'String',
    csharp: 'string',
  }),
  Boolean: Object.freeze({
    typescript: Object.freeze({ input: 'boolean', output: 'boolean' }),
    swift: 'Bool',
    kotlin: 'Boolean',
    dart: 'bool',
    gdscript: 'bool',
    csharp: 'bool',
  }),
  Int: Object.freeze({
    typescript: Object.freeze({ input: 'number', output: 'number' }),
    swift: 'Int',
    kotlin: 'Int',
    dart: 'int',
    gdscript: 'int',
    csharp: 'int',
  }),
  Float: Object.freeze({
    typescript: Object.freeze({ input: 'number', output: 'number' }),
    swift: 'Double',
    kotlin: 'Double',
    dart: 'double',
    gdscript: 'float',
    csharp: 'double',
  }),
});

const scalarMapping = <Key extends keyof GraphQLScalarContract>(key: Key): Record<string, GraphQLScalarContract[Key]> =>
  Object.fromEntries(Object.entries(GRAPHQL_SCALAR_CONTRACTS).map(([name, contract]) => [name, contract[key]]));

export const SUPPORTED_GRAPHQL_SCALARS = new Set(Object.keys(GRAPHQL_SCALAR_CONTRACTS));
export const GRAPHQL_TO_TYPESCRIPT = scalarMapping('typescript');
export const GRAPHQL_TO_SWIFT = scalarMapping('swift');
export const GRAPHQL_TO_KOTLIN = scalarMapping('kotlin');
export const GRAPHQL_TO_DART = scalarMapping('dart');
export const GRAPHQL_TO_GDSCRIPT = scalarMapping('gdscript');
export const GRAPHQL_TO_CSHARP = scalarMapping('csharp');

export const requireGraphQLScalarMapping = (mapping: Readonly<Record<string, string>>, name: string, language: string): string => {
  const mapped = mapping[name];
  if (!mapped) {
    throw new Error(`Unsupported ${language} GraphQL scalar mapping: ${name}`);
  }
  return mapped;
};

// ============================================================================
// Platform Defaults for Discriminated Unions
// ============================================================================

export const PLATFORM_TYPE_DEFAULTS: Record<string, { platform: string; type: string }> = {
  ProductIOS: { platform: 'ios', type: 'in-app' },
  ProductAndroid: { platform: 'android', type: 'in-app' },
  ProductSubscriptionIOS: { platform: 'ios', type: 'subs' },
  ProductSubscriptionAndroid: { platform: 'android', type: 'subs' },
};

// ============================================================================
// Legacy Aliases for ErrorCode
// ============================================================================

export const ERROR_CODE_LEGACY_ALIASES: Record<string, string> = {
  'receipt-failed': 'purchaseVerificationFailed',
  ReceiptFailed: 'purchaseVerificationFailed',
};
