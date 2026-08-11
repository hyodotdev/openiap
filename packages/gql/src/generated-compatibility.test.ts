import { readFileSync } from 'node:fs';
import { Kind, parse } from 'graphql';
import { describe, expect, it } from 'vitest';
import { SCHEMA_FILE_NAMES } from '../schema-files.mjs';
import { extractSchemaMarkers } from '../schema-markers.mjs';
import { assertValidSchemaDeprecations, extractSchemaDeprecations } from '../schema-deprecations.mjs';
import { requireNoGraphqlCodegenScaffolding } from '../scripts/custom-generated-guards.mjs';

function generated(name: string): string {
  return readFileSync(new URL(`./generated/${name}`, import.meta.url), 'utf8');
}

const schemaSources = () => SCHEMA_FILE_NAMES.map((fileName) => readFileSync(new URL(`./${fileName}`, import.meta.url), 'utf8'));

function canonicalDeprecations() {
  const deprecations = extractSchemaDeprecations(schemaSources());
  assertValidSchemaDeprecations(deprecations);
  return deprecations.entries;
}

function interfaceUnionOwners(): Map<string, string[]> {
  const document = parse(schemaSources().join('\n'));
  const objectInterfaces = new Map<string, Set<string>>();
  const unionMembers = new Map<string, string[]>();

  for (const definition of document.definitions) {
    if (definition.kind === Kind.OBJECT_TYPE_DEFINITION || definition.kind === Kind.OBJECT_TYPE_EXTENSION) {
      const interfaces = objectInterfaces.get(definition.name.value) ?? new Set<string>();
      for (const implemented of definition.interfaces ?? []) {
        interfaces.add(implemented.name.value);
      }
      objectInterfaces.set(definition.name.value, interfaces);
    } else if (definition.kind === Kind.UNION_TYPE_DEFINITION) {
      unionMembers.set(
        definition.name.value,
        (definition.types ?? []).map((member) => member.name.value),
      );
    }
  }

  const resolved = new Map<string, Set<string>>();
  const interfacesFor = (typeName: string, visiting = new Set<string>()): Set<string> => {
    const cached = resolved.get(typeName);
    if (cached) return cached;
    if (visiting.has(typeName)) {
      throw new Error(`Cyclic union membership while resolving ${typeName}`);
    }
    const direct = objectInterfaces.get(typeName);
    if (direct) return direct;
    const members = unionMembers.get(typeName);
    if (!members || members.length === 0) return new Set();

    const nextVisiting = new Set(visiting).add(typeName);
    const memberInterfaces = members.map((member) => interfacesFor(member, nextVisiting));
    const shared = new Set(
      [...memberInterfaces[0]].filter((name) => memberInterfaces.slice(1).every((interfaces) => interfaces.has(name))),
    );
    resolved.set(typeName, shared);
    return shared;
  };

  const owners = new Map<string, string[]>();
  for (const unionName of unionMembers.keys()) {
    for (const interfaceName of interfacesFor(unionName)) {
      owners.set(interfaceName, [...(owners.get(interfaceName) ?? []), unionName]);
    }
  }
  return owners;
}

function declarationAfterDeprecationTag(source: string, tagOffset: number): string {
  const blockStart = source.lastIndexOf('/**', tagOffset);
  const priorBlockEnd = source.lastIndexOf('*/', tagOffset);
  let cursor: number;

  if (blockStart > priorBlockEnd) {
    const blockEnd = source.indexOf('*/', tagOffset);
    if (blockEnd === -1) return '';
    cursor = blockEnd + 2;
  } else {
    const lineEnd = source.indexOf('\n', tagOffset);
    cursor = lineEnd === -1 ? source.length : lineEnd + 1;
  }

  for (const line of source.slice(cursor).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed.startsWith('///') ||
      trimmed.startsWith('##') ||
      trimmed.startsWith('/**') ||
      trimmed.startsWith('*') ||
      trimmed === '*/' ||
      /^@\w/.test(trimmed) ||
      /^\[[^\]]+\]$/.test(trimmed)
    ) {
      continue;
    }
    return trimmed;
  }

  return '';
}

type GeneratedFileName = 'types.ts' | 'Types.swift' | 'Types.kt' | 'types.dart' | 'types.gd' | 'Types.cs';

const generatedFiles: GeneratedFileName[] = ['types.ts', 'Types.swift', 'Types.kt', 'types.dart', 'types.gd', 'Types.cs'];

function mergeAttachmentMultiplicity(existing: string[], additional: string[]): string[] {
  const maximumCounts = new Map<string, number>();
  for (const entries of [existing, additional]) {
    const counts = new Map<string, number>();
    for (const entry of entries) {
      counts.set(entry, (counts.get(entry) ?? 0) + 1);
    }
    for (const [entry, count] of counts) {
      maximumCounts.set(entry, Math.max(maximumCounts.get(entry) ?? 0, count));
    }
  }
  return [...maximumCounts].flatMap(([entry, count]) => Array.from({ length: count }, () => entry));
}

const pascalCase = (value: string): string =>
  value
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1).toLowerCase()}`)
    .join('');

const upperCamelName = (value: string): string =>
  value.includes('_') ? pascalCase(value) : `${value.charAt(0).toUpperCase()}${value.slice(1)}`;

const snakeCase = (value: string): string =>
  value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();

function topLevelDeclarationName(file: GeneratedFileName, line: string): string | null {
  if (/^\s/.test(line)) return null;
  const patterns: Record<GeneratedFileName, RegExp> = {
    'types.ts': /^export (?:interface|type|enum) ([A-Za-z_$][\w$]*)\b/,
    'Types.swift': /^public (?:struct|enum|protocol|typealias) ([A-Za-z_]\w*)\b/,
    'Types.kt': /^public (?:data class|enum class|sealed interface|interface|typealias) ([A-Za-z_]\w*)\b/,
    'types.dart': /^(?:(?:abstract|sealed) )?class ([A-Za-z_]\w*)\b|^enum ([A-Za-z_]\w*)\b|^typedef ([A-Za-z_]\w*)\b/,
    'types.gd': /^class ([A-Za-z_]\w*):|^enum ([A-Za-z_]\w*)\b/,
    'Types.cs': /^public (?:(?:sealed|abstract) )?(?:record(?: class)?|class|interface|enum) ([A-Za-z_]\w*)\b/,
  };
  const match = patterns[file].exec(line);
  return match?.slice(1).find(Boolean) ?? null;
}

function declarationSymbol(file: GeneratedFileName, declaration: string): string | null {
  const topLevel = topLevelDeclarationName(file, declaration);
  if (topLevel) return topLevel;

  const line = declaration.trim();
  const patterns: Record<GeneratedFileName, RegExp[]> = {
    'types.ts': [/^(?:readonly\s+)?([A-Za-z_$][\w$]*)\??\s*:/, /^([A-Za-z_$][\w$]*)\s*=/],
    'Types.swift': [/^(?:public\s+)?(?:var|let)\s+([A-Za-z_]\w*)\b/, /^(?:public\s+)?func\s+([A-Za-z_]\w*)\b/, /^case\s+([A-Za-z_]\w*)\b/],
    'Types.kt': [
      /^(?:override\s+)?(?:val|var)\s+([A-Za-z_]\w*)\b/,
      /^(?:suspend\s+)?fun\s+([A-Za-z_]\w*)\b/,
      /^([A-Za-z_]\w*)\s*(?:\(|,|$)/,
    ],
    'types.dart': [/\bget\s+([A-Za-z_]\w*)\s*;/, /\b([A-Za-z_]\w*)\s*\(/, /\b([A-Za-z_]\w*)\s*;$/, /\b([A-Za-z_]\w*)\s*,?$/],
    'types.gd': [/^var\s+([A-Za-z_]\w*)\b/, /^class\s+([A-Za-z_]\w*):/, /^([A-Z][A-Z0-9_]*)\s*=/, /^static func\s+([A-Za-z_]\w*)\b/],
    'Types.cs': [/\b([A-Za-z_]\w*)\s*\{\s*get\b/, /\b([A-Za-z_]\w*)\s*\(/, /^([A-Za-z_]\w*)\s*,?$/],
  };

  for (const pattern of patterns[file]) {
    const match = pattern.exec(line);
    if (match) return match[1];
  }
  return null;
}

function normalizedOwner(_file: GeneratedFileName, generatedOwner: string): string {
  if (generatedOwner.endsWith('Resolver')) {
    return generatedOwner.slice(0, -'Resolver'.length);
  }
  return generatedOwner;
}

function gdscriptOperationHelperOwners(): Map<string, string> {
  const owners = new Map<string, string>();
  for (const definition of parse(schemaSources().join('\n')).definitions) {
    if (definition.kind !== Kind.OBJECT_TYPE_DEFINITION && definition.kind !== Kind.OBJECT_TYPE_EXTENSION) {
      continue;
    }
    if (!['Query', 'Mutation', 'Subscription'].includes(definition.name.value)) {
      continue;
    }
    for (const field of definition.fields ?? []) {
      owners.set(`${snakeCase(field.name.value)}_args`, definition.name.value);
    }
  }
  return owners;
}

function expectedGeneratedSymbol(file: GeneratedFileName, entry: ReturnType<typeof canonicalDeprecations>[number]): string {
  if (!entry.parentName) return entry.name;
  if (entry.kind === Kind.ENUM_VALUE_DEFINITION) {
    if (file === 'types.gd') {
      return entry.name.includes('_') ? entry.name : snakeCase(entry.name).toUpperCase();
    }
    const value = entry.name.includes('_') ? pascalCase(entry.name) : entry.name;
    return file === 'Types.swift' ? `${value.charAt(0).toLowerCase()}${value.slice(1)}` : value;
  }
  if (entry.parentName === 'Query' || entry.parentName === 'Mutation' || entry.parentName === 'Subscription') {
    if (file === 'Types.cs') return `${upperCamelName(entry.name)}Async`;
    if (file === 'types.gd') return `${entry.name}Field`;
    return entry.name;
  }
  if (file === 'Types.cs') {
    return entry.name === 'ios' ? 'IOS' : upperCamelName(entry.name);
  }
  if (file === 'types.gd') return snakeCase(entry.name);
  return entry.name;
}

function collectDeprecationAttachments(file: GeneratedFileName, source: string, reason: string): Array<{ owner: string; symbol: string }> {
  const gdscriptHelperOwners = file === 'types.gd' ? gdscriptOperationHelperOwners() : null;
  const topLevels: Array<{ name: string; offset: number }> = [];
  let lineOffset = 0;
  for (const line of source.split(/\r?\n/)) {
    const name = topLevelDeclarationName(file, line);
    if (name) topLevels.push({ name, offset: lineOffset });
    lineOffset += line.length + 1;
  }

  const tag = `@deprecated ${reason}`;
  const attachments: Array<{ owner: string; symbol: string }> = [];
  let tagOffset = source.indexOf(tag);
  while (tagOffset !== -1) {
    const declaration = declarationAfterDeprecationTag(source, tagOffset);
    const symbol = declarationSymbol(file, declaration);
    const declarationOffset = source.indexOf(declaration, tagOffset);
    const declarationLineStart = declarationOffset === -1 ? -1 : source.lastIndexOf('\n', declarationOffset - 1) + 1;
    const declarationOwner =
      declarationOffset !== -1 && declarationLineStart === declarationOffset ? topLevelDeclarationName(file, declaration) : null;
    const precedingOwner = [...topLevels].reverse().find((candidate) => candidate.offset < tagOffset);
    const owner = (file === 'types.gd' && symbol ? gdscriptHelperOwners?.get(symbol) : null) ?? declarationOwner ?? precedingOwner?.name;
    if (owner && symbol) {
      attachments.push({
        owner: normalizedOwner(file, owner),
        symbol,
      });
    }
    tagOffset = source.indexOf(tag, tagOffset + tag.length);
  }
  return attachments;
}

function interfaceImplementors(): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const sdl of schemaSources()) {
    for (const definition of parse(sdl).definitions) {
      if (definition.kind !== Kind.OBJECT_TYPE_DEFINITION && definition.kind !== Kind.OBJECT_TYPE_EXTENSION) {
        continue;
      }
      for (const implemented of definition.interfaces ?? []) {
        result.set(implemented.name.value, [...(result.get(implemented.name.value) ?? []), definition.name.value]);
      }
    }
  }
  return new Map([...result].map(([name, owners]) => [name, [...new Set(owners)]]));
}

describe('generated compatibility', () => {
  it('contains no graphql-codegen scaffolding after TypeScript post-processing', () => {
    expect(() => requireNoGraphqlCodegenScaffolding(generated('types.ts'))).not.toThrow();
  });

  it('keeps the canonical DiscountOffer type reference in the schema', () => {
    const schema = readFileSync(new URL('./type.graphql', import.meta.url), 'utf8');
    const typeIndex = schema.indexOf('type DiscountOffer {');
    const descriptionEnd = schema.lastIndexOf('"""', typeIndex);
    const descriptionStart = schema.lastIndexOf('"""', descriptionEnd - 1);
    const description = schema.slice(descriptionStart, descriptionEnd);

    expect(description).toContain('@see https://openiap.dev/docs/types/discount-offer');
    expect(description).not.toContain('@see https://openiap.dev/docs/features/discount');
  });

  it('emits one deprecation tag per TypeScript doc block', () => {
    const typescript = generated('types.ts');
    const duplicateBlocks = (typescript.match(/\/\*\*[\s\S]*?\*\//g) ?? []).filter(
      (block) => (block.match(/^\s*(?:\/\*\*|\*)\s*@deprecated\b/gm) ?? []).length > 1,
    );

    expect(duplicateBlocks).toEqual([]);
    expect(typescript).not.toContain('Scheduled for removal in OpenIAP 3.0.');
  });

  it('keeps generated TypeScript aliases separated by one blank line', () => {
    const typescript = generated('types.ts');
    expect(typescript).not.toMatch(/(?:\r?\n){3,}export /);
  });

  it('preserves complete offer guidance in generated GDScript docs', () => {
    const gdscript = generated('types.gd');

    expect(gdscript).toContain(
      '## Standardized Android one-time product purchase options and offers. Native metadata uses Android-suffixed fields. @see https://openiap.dev/docs/types/discount-offer',
    );
    expect(gdscript).not.toContain('Legacy nullable compatibility field.');
  });

  it('contains no scheduled OpenIAP 3 deprecation guidance in generated languages', () => {
    const generatedFiles = ['types.ts', 'Types.swift', 'Types.kt', 'types.dart', 'types.gd', 'Types.cs'];
    for (const file of generatedFiles) {
      const source = generated(file);
      expect(source).not.toContain('Scheduled for removal in OpenIAP 3.0.');
    }
  });

  it('covers every representable canonical deprecation in generated docs', () => {
    const entries = canonicalDeprecations();
    const { unionWrappers } = extractSchemaMarkers(schemaSources());
    const implementors = interfaceImplementors();
    const unionOwners = interfaceUnionOwners();

    expect(entries).toEqual([]);
    for (const file of generatedFiles) {
      const source = generated(file);
      const representableEntries = entries.filter((entry) => {
        if (file === 'types.ts' && entry.kind === Kind.ENUM_VALUE_DEFINITION && entry.parentName !== 'ErrorCode') {
          return false;
        }
        if (
          file === 'types.gd' &&
          (entry.kind.includes('Interface') ||
            entry.parentName === 'Subscription' ||
            (entry.parentName && unionWrappers.has(entry.parentName)))
        ) {
          return false;
        }
        if (entry.ownerPath === 'PurchaseInput.platform' && file !== 'types.gd') {
          // Only GDScript retains PurchaseInput as a field-bearing class.
          // Other targets intentionally alias/wrap it without declarations.
          return false;
        }
        return true;
      });

      const expectedByReason = new Map<string, string[]>();
      for (const entry of representableEntries) {
        let expectedOwners = [entry.parentName ?? entry.name];
        if (entry.parentKind?.includes('Interface') && entry.parentName) {
          const generatedImplementors = implementors.get(entry.parentName) ?? [];
          expectedOwners =
            file === 'types.ts'
              ? [entry.parentName]
              : file === 'types.gd'
                ? generatedImplementors
                : [entry.parentName, ...generatedImplementors];
          if (file === 'Types.swift' || file === 'types.dart') {
            expectedOwners.push(...(unionOwners.get(entry.parentName) ?? []));
          }
        }
        if (
          file === 'Types.kt' &&
          (entry.parentName === 'Query' || entry.parentName === 'Mutation' || entry.parentName === 'Subscription')
        ) {
          // Kotlin exposes root operations through both the suspending
          // operation interface and an optional handler bundle. Both are
          // consumer-facing declarations and must warn consistently.
          expectedOwners.push(`${entry.parentName}Handlers`);
        }
        const expectedSymbols = [expectedGeneratedSymbol(file, entry)];
        if (
          file === 'types.gd' &&
          (entry.parentName === 'Query' || entry.parentName === 'Mutation' || entry.parentName === 'Subscription')
        ) {
          // GDScript exposes each operation through both its metadata field
          // class and a public argument-builder helper. Both are generated
          // from the same schema description and must carry the canonical
          // deprecation reason.
          expectedSymbols.push(`${snakeCase(entry.name)}_args`);
        }
        for (const owner of expectedOwners) {
          for (const expectedSymbol of expectedSymbols) {
            const expectedCount =
              (file === 'types.ts' || file === 'types.dart') && entry.ownerPath === 'RequestPurchaseProps.useAlternativeBilling' ? 2 : 1;
            const key = `${owner}.${expectedSymbol}`;
            expectedByReason.set(
              entry.reason,
              mergeAttachmentMultiplicity(
                expectedByReason.get(entry.reason) ?? [],
                Array.from({ length: expectedCount }, () => key),
              ),
            );
          }
        }
      }

      for (const [reason, expectedAttachments] of expectedByReason) {
        const actualAttachments = collectDeprecationAttachments(file, source, reason).map(
          (attachment) => `${attachment.owner}.${attachment.symbol}`,
        );
        expect(actualAttachments.sort(), `${file} must attach "${reason}" only to the canonical generated owners`).toEqual(
          expectedAttachments.sort(),
        );
      }
    }
  });

  it('does not let same-name tags on another owner satisfy ownership', () => {
    const source = `export interface ExpectedOwner {
  platform: string;
}
export interface WrongOwner {
  /** @deprecated Use store instead */
  platform: string;
}
/** @deprecated Use Target instead. */
export interface TargetCompat {}
export interface Target {}`;

    expect(collectDeprecationAttachments('types.ts', source, 'Use store instead')).toEqual([{ owner: 'WrongOwner', symbol: 'platform' }]);
    expect(collectDeprecationAttachments('types.ts', source, 'Use Target instead.')).toEqual([
      { owner: 'TargetCompat', symbol: 'TargetCompat' },
    ]);
    expect(declarationSymbol('types.ts', 'export interface TargetCompat {}')).not.toBe('Target');
  });

  it('rejects correct-owner tags accompanied by same-reason wrong-owner tags', () => {
    const source = `export interface ExpectedOwner {
  /** @deprecated Use store instead */
  platform: string;
}
export interface WrongOwner {
  /** @deprecated Use store instead */
  platform: string;
}`;
    const actual = collectDeprecationAttachments('types.ts', source, 'Use store instead').map(
      (attachment) => `${attachment.owner}.${attachment.symbol}`,
    );

    expect(actual).toContain('ExpectedOwner.platform');
    expect(actual).toContain('WrongOwner.platform');
    expect(actual.sort()).not.toEqual(['ExpectedOwner.platform']);
  });

  it('preserves the published MAUI 1.x string signatures', () => {
    const csharp = generated('Types.cs');

    for (const method of ['DeepLinkToSubscriptions', 'FinishTransaction', 'RestorePurchases']) {
      expect(csharp).toContain(`Task<string> ${method}Async(`);
      expect(csharp).not.toContain(`Task<VoidResult> ${method}Async(`);
    }
  });

  it('keeps new user-choice details optional outside Kotlin', () => {
    expect(generated('types.ts')).toContain('productDetailsAndroid?: (DeveloperProvidedBillingProductAndroid[] | null);');
    expect(generated('types.dart')).toContain('final List<DeveloperProvidedBillingProductAndroid>? productDetailsAndroid;');
    expect(generated('Types.swift')).toContain('public var productDetailsAndroid: [DeveloperProvidedBillingProductAndroid]? = nil');
    expect(generated('Types.cs')).toContain(
      'public IReadOnlyList<DeveloperProvidedBillingProductAndroid>? ProductDetailsAndroid { get; init; }',
    );
  });

  it('keeps additive Kotlin fields out of published data-class constructors', () => {
    const kotlin = generated('Types.kt');
    const userChoice = kotlin.slice(
      kotlin.indexOf('public data class UserChoiceBillingDetails('),
      kotlin.indexOf('public data class ValidTimeWindowAndroid('),
    );
    const purchaseError = kotlin.slice(
      kotlin.indexOf('public data class PurchaseError('),
      kotlin.indexOf('public data class PurchaseIOS('),
    );
    const iapkitResult = kotlin.slice(
      kotlin.indexOf('public data class RequestVerifyPurchaseWithIapkitResult('),
      kotlin.indexOf('public data class SubscriptionCommitmentInfoIOS('),
    );
    const iapkitAmazonProps = kotlin.slice(
      kotlin.indexOf('public data class RequestVerifyPurchaseWithIapkitAmazonProps('),
      kotlin.indexOf('public data class RequestVerifyPurchaseWithIapkitAppleProps('),
    );
    const iapkitProps = kotlin.slice(
      kotlin.indexOf('public data class RequestVerifyPurchaseWithIapkitProps('),
      kotlin.indexOf('public data class SubscriptionProductReplacementParamsAndroid('),
    );
    const withoutDocComments = (value: string) => value.replace(/\/\*\*[\s\S]*?\*\//g, '').replace(/\s+/g, ' ');
    const iapkitResultPrimary = withoutDocComments(iapkitResult.slice(0, iapkitResult.indexOf(') {') + 3));
    const iapkitAmazonPropsPrimary = withoutDocComments(
      iapkitAmazonProps.slice(0, iapkitAmazonProps.indexOf(') {') + 3),
    );
    const iapkitPropsPrimary = withoutDocComments(iapkitProps.slice(0, iapkitProps.indexOf(') {') + 3));

    expect(userChoice).toContain('val externalTransactionToken: String,');
    expect(userChoice).toContain('val products: List<String>');
    expect(userChoice).toContain('var productDetailsAndroid: List<DeveloperProvidedBillingProductAndroid>? = null');
    expect(purchaseError).toContain('var subResponseCodeAndroid: SubResponseCodeAndroid? = null');
    expect(userChoice).toContain('private set');
    expect(purchaseError).toContain('private set');
    expect(iapkitResultPrimary).toContain(
      'public data class RequestVerifyPurchaseWithIapkitResult( val isValid: Boolean, val state: IapkitPurchaseState, val store: IapStore ) {',
    );
    expect(iapkitResult).toContain('var clientPayload: IapkitProductClientPayload? = null');
    expect(iapkitResult).toContain('var productId: String? = null');
    expect(iapkitResult).toContain('var environment: String? = null');
    expect(iapkitResult).toContain(`        productId: String? = null,
    ) : this(`);
    expect(iapkitResult).toContain(`        productId: String?,
        environment: String?,
    ) : this(`);
    expect(iapkitResultPrimary).not.toContain('clientPayload');
    expect(iapkitResultPrimary).not.toContain('productId');
    expect(iapkitResultPrimary).not.toContain('environment');
    expect(iapkitAmazonPropsPrimary).toContain(
      'public data class RequestVerifyPurchaseWithIapkitAmazonProps( val receiptId: String, val sandbox: Boolean? = null, val userId: String? = null ) {',
    );
    expect(iapkitAmazonProps).toContain('var expectedProductId: String? = null');
    expect(iapkitAmazonPropsPrimary).not.toContain('expectedProductId');
    expect(iapkitAmazonProps).toContain(
      'fun fromJson(json: Map<String, Any?>): RequestVerifyPurchaseWithIapkitAmazonProps?',
    );
    expect(iapkitAmazonProps).toContain('if (receiptId == null) return null');
    expect(iapkitPropsPrimary).toContain(
      'public data class RequestVerifyPurchaseWithIapkitProps( val amazon: RequestVerifyPurchaseWithIapkitAmazonProps? = null, val apiKey: String? = null, val apple: RequestVerifyPurchaseWithIapkitAppleProps? = null, val baseUrl: String? = null, val google: RequestVerifyPurchaseWithIapkitGoogleProps? = null ) {',
    );
    expect(iapkitProps).toContain('var includeClientPayload: Boolean? = null');
    expect(iapkitResult).toContain('private set');
    expect(iapkitAmazonProps).toContain('private set');
    expect(iapkitProps).toContain('private set');
    expect(iapkitPropsPrimary).not.toContain('includeClientPayload');
  });

  it('preserves schema prose in custom purchase and discount generators', () => {
    const swift = generated('Types.swift');
    const kotlin = generated('Types.kt');
    const dart = generated('types.dart');
    const csharp = generated('Types.cs');

    for (const fieldDescription of [
      'Discount identifier',
      'Key identifier for validation',
      'Cryptographic nonce',
      'Signature for validation',
      'Timestamp of discount offer',
    ]) {
      expect(swift).toContain(`/// ${fieldDescription}`);
    }

    for (const source of [swift, kotlin, csharp]) {
      expect(source).toContain('Explicit purchase type hint (defaults to in-app)');
      expect(source).toContain('Per-platform purchase request props');
      expect(source).toContain('Per-platform subscription request props');
    }
    expect(dart).toContain('Per-platform purchase request props');
    expect(dart).toContain('Per-platform subscription request props');
  });
});
