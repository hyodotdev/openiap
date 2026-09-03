import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  GRAPHQL_CODEGEN_SCAFFOLDING,
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
} from '../scripts/custom-generated-guards.mjs';

describe('custom generated TypeScript guards', () => {
  it('fails closed when graphql-codegen scaffolding survives post-processing', () => {
    expect(() => requireNoGraphqlCodegenScaffolding('export interface Product { id: string; }')).not.toThrow();
    for (const token of GRAPHQL_CODEGEN_SCAFFOLDING) {
      expect(() => requireNoGraphqlCodegenScaffolding(`before ${token} after`), token).toThrow(
        'still contains graphql-codegen scaffolding',
      );
    }
  });

  it('reads only top-level interface properties through comment and type decoys', () => {
    const declaration = requireExactInterfaceProperties(
      `export interface MutationRequestPurchaseArgs {
  /** A comment containing fake?: string and a closing brace }. */
  params: {
    nested: string;
  };
}

export interface Unrelated {
  extra: string;
}
`,
      'MutationRequestPurchaseArgs',
      ['params'],
    );

    expect(declaration.source).toContain('nested: string');
    expect(declaration.source).not.toContain('Unrelated');
    expect(declaration.propertyJSDoc('params')).toBe('/** A comment containing fake?: string and a closing brace }. */');
  });

  it('supports quoted static properties and rejects extra fields', () => {
    expect(() =>
      requireExactInterfaceProperties(
        `export interface RequestPurchaseProps {
  requestPurchase?: string;
  requestSubscription?: string;
  type?: string;
  futureField?: string;
}`,
        'RequestPurchaseProps',
        ['requestPurchase', 'requestSubscription', 'type'],
      ),
    ).toThrow('found requestPurchase, requestSubscription, type, futureField');

    expect(() =>
      requireExactInterfaceProperties(
        `export interface DuplicateProperty {
  first: string;
  first: string;
}`,
        'DuplicateProperty',
        ['first', 'second'],
      ),
    ).toThrow('expected first, second, found first, first');
  });

  it('fails closed for duplicate, missing, dynamic, and non-property declarations', () => {
    expect(() =>
      requireExactInterfaceProperties(
        'export interface Duplicate { value: string }\nexport interface Duplicate { value: string }',
        'Duplicate',
        ['value'],
      ),
    ).toThrow('must appear exactly once; found 2');

    expect(() => requireExactInterfaceProperties('export interface Present { value: string }', 'Missing', ['value'])).toThrow(
      'must appear exactly once; found 0',
    );

    expect(() => requireExactInterfaceProperties('export interface Dynamic { [key: string]: string }', 'Dynamic', ['key'])).toThrow(
      'only supports property signatures',
    );

    expect(() => requireExactInterfaceProperties('export interface MethodOwner { run(): void }', 'MethodOwner', ['run'])).toThrow(
      'only supports property signatures',
    );
  });

  it('fails closed when a rewritten property loses or duplicates direct JSDoc', () => {
    const missingDoc = requireExactInterfaceProperties('export interface MissingDoc { value: string }', 'MissingDoc', ['value']);
    expect(() => missingDoc.propertyJSDoc('value')).toThrow('must retain exactly one direct generated JSDoc block; found 0');
    expect(missingDoc.propertyJSDoc('value', false)).toBeNull();

    const duplicateDoc = requireExactInterfaceProperties(
      `export interface DuplicateDoc {
  /** First. */
  /** Second. */
  value: string
}`,
      'DuplicateDoc',
      ['value'],
    );
    expect(() => duplicateDoc.propertyJSDoc('value')).toThrow('must retain exactly one direct generated JSDoc block; found 2');
  });

  it('preserves operation argument guidance through the purchase union rewrite', () => {
    const result = rewriteRequestPurchaseTypeAliases(`export interface RequestPurchaseProps {
  /** Per-platform purchase request props */
  requestPurchase?: (RequestPurchasePropsByPlatforms | null);
  /** Per-platform subscription request props */
  requestSubscription?: (RequestSubscriptionPropsByPlatforms | null);
  /** Explicit purchase type hint */
  type?: (ProductQueryType | null);
}

export interface MutationRequestPurchaseArgs {
  /**
   * Purchase request wrapper.
   * @deprecated Use the replacement argument instead.
   */
  params: RequestPurchaseProps;
}

/** Unrelated generated type. */
export interface Unrelated {
  value: string;
}
`);

    expect(result).toContain(
      '/**\n * Purchase request wrapper.\n * @deprecated Use the replacement argument instead.\n */\nexport type MutationRequestPurchaseArgs = RequestPurchaseProps;',
    );
    expect(result).not.toContain('export interface MutationRequestPurchaseArgs');
    expect(result).not.toContain('export interface RequestPurchaseProps');
    expect(result).toContain(
      'export type MutationRequestPurchaseArgs = RequestPurchaseProps;\n\n/** Unrelated generated type. */\nexport interface Unrelated',
    );

    const sourceFile = ts.createSourceFile('generated-types.ts', result, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const alias = sourceFile.statements.find(
      (statement) => ts.isTypeAliasDeclaration(statement) && statement.name.text === 'MutationRequestPurchaseArgs',
    );
    expect(ts.getJSDocTags(alias).map((tag) => [tag.tagName.text, tag.comment])).toContainEqual([
      'deprecated',
      'Use the replacement argument instead.',
    ]);
  });

  it('fails closed when a purchase rewrite input type or optionality drifts', () => {
    const valid = `export interface RequestPurchaseProps {
  /** Purchase. */
  requestPurchase?: (RequestPurchasePropsByPlatforms | null);
  /** Subscription. */
  requestSubscription?: (RequestSubscriptionPropsByPlatforms | null);
  /** Type. */
  type?: (ProductQueryType | null);
}

export interface MutationRequestPurchaseArgs {
  params: RequestPurchaseProps;
}
`;

    expect(() =>
      rewriteRequestPurchaseTypeAliases(
        valid.replace('requestPurchase?: (RequestPurchasePropsByPlatforms | null)', 'requestPurchase?: number'),
      ),
    ).toThrow('RequestPurchaseProps.requestPurchase generated contract drifted');
    expect(() =>
      rewriteRequestPurchaseTypeAliases(
        valid.replace(
          'requestSubscription?: (RequestSubscriptionPropsByPlatforms | null)',
          'requestSubscription: (RequestSubscriptionPropsByPlatforms | null)',
        ),
      ),
    ).toThrow('RequestPurchaseProps.requestSubscription generated contract drifted');
    expect(() => rewriteRequestPurchaseTypeAliases(valid.replace('params: RequestPurchaseProps', 'params?: RequestPurchaseProps'))).toThrow(
      'MutationRequestPurchaseArgs.params generated contract drifted',
    );
  });

  it('enforces the PurchaseInput alias source contract before rewriting', () => {
    const valid = `export interface PurchaseInput {
  id: string;
  productId: string;
  ids?: (string[] | null);
  transactionDate: number;
  purchaseToken?: (string | null);
  store?: (IapStore | null);
  quantity: number;
  purchaseState: PurchaseState;
  isAutoRenewing: boolean;
}`;

    expect(() => requireTypeScriptInputContract(valid, 'PurchaseInput')).not.toThrow();
    expect(() =>
      requireTypeScriptInputContract(valid.replace('transactionDate: number', 'transactionDate?: number'), 'PurchaseInput'),
    ).toThrow('PurchaseInput.transactionDate generated contract drifted');
  });

  it('fails closed when product discriminants drift', () => {
    const valid = `export interface ProductCommon {
  platform: 'android' | 'ios';
  type: 'in-app' | 'subs';
}
export interface ProductAndroid {
  platform: 'android';
  type: 'in-app';
}
export interface ProductIOS {
  platform: 'ios';
  type: 'in-app';
}
export interface ProductSubscriptionAndroid {
  platform: 'android';
  type: 'subs';
}
export interface ProductSubscriptionIOS {
  platform: 'ios';
  type: 'subs';
}`;

    expect(() => requireProductDiscriminantContracts(valid)).not.toThrow();
    expect(() => requireProductDiscriminantContracts(valid.replace("platform: 'android';", 'platform: IapPlatform;'))).toThrow(
      'ProductAndroid.platform discriminant drifted',
    );
  });

  it('fails closed when enum conversion leaves the wrong declaration kind', () => {
    const valid = `export enum ErrorCode { Unknown = 'unknown' }
export type IapStore = 'apple' | 'google';`;

    const contracts = new Map([
      ['ErrorCode', ['unknown']],
      ['IapStore', ['apple', 'google']],
    ]);

    expect(() => requireGeneratedEnumContracts(valid, contracts)).not.toThrow();
    expect(() =>
      requireGeneratedEnumContracts(
        `export enum ErrorCode { Unknown = "unknown" }
export type IapStore = "apple" | 'google';`,
        contracts,
      ),
    ).not.toThrow();
    expect(() =>
      requireGeneratedEnumContracts(
        valid.replace("export type IapStore = 'apple' | 'google';", "export declare enum IapStore { Apple = 'apple' }"),
        contracts,
      ),
    ).toThrow('IapStore enum contract drifted');
    expect(() => requireGeneratedEnumContracts(valid.replace(" | 'google'", ''), contracts)).toThrow('IapStore enum values drifted');
  });

  it('fails closed when VoidResult stops being the canonical void alias', () => {
    expect(() => requireExactTypeAlias('export type VoidResult = void;', 'VoidResult', 'void')).not.toThrow();
    expect(() =>
      requireExactTypeAlias(
        `export interface VoidResult {
  success:
    boolean;
}`,
        'VoidResult',
        'void',
      ),
    ).toThrow('must produce exactly one type alias and no interface');
  });

  it('does not collapse argument-bearing operations to no-argument helpers', () => {
    const source = 'export type QueryFetchProductsArgs = string;';
    const options = {
      rootName: 'Query',
      fieldName: 'fetchProducts',
      ownerNames: ['QueryFetchProductsArgs'],
      argumentCount: 1,
    };

    expect(resolveOperationArgsOwner(source, options)).toBe('QueryFetchProductsArgs');
    expect(() => resolveOperationArgsOwner('', options)).toThrow('must have exactly one generated Args declaration; found 0');
    expect(() =>
      resolveOperationArgsOwner(source, {
        ...options,
        argumentCount: 0,
      }),
    ).toThrow('has no SDL arguments but generated 1 Args declarations');
  });

  it('requires one-argument aliases and multi-argument interfaces', () => {
    const oneArgument = {
      rootName: 'Query',
      fieldName: 'single',
      ownerNames: ['QuerySingleArgs'],
      argumentCount: 1,
      argumentContracts: [{ name: 'value', optional: false, type: 'string' }],
    };
    const multipleArguments = {
      rootName: 'Mutation',
      fieldName: 'multiple',
      ownerNames: ['MutationMultipleArgs'],
      argumentCount: 2,
      argumentContracts: [
        { name: 'first', optional: false, type: 'string' },
        { name: 'second', optional: true, type: '(number | null)' },
      ],
    };

    expect(resolveOperationArgsOwner('export type QuerySingleArgs = string;', oneArgument)).toBe('QuerySingleArgs');
    expect(() => resolveOperationArgsOwner('export interface QuerySingleArgs { value: string }', oneArgument)).toThrow(
      'must generate a type alias Args declaration',
    );

    expect(
      resolveOperationArgsOwner('export interface MutationMultipleArgs { first: string; second?: (number | null) }', multipleArguments),
    ).toBe('MutationMultipleArgs');
    expect(() => resolveOperationArgsOwner('export type MutationMultipleArgs = string;', multipleArguments)).toThrow(
      'must generate a interface Args declaration',
    );
    expect(() => resolveOperationArgsOwner('export type QuerySingleArgs = number;', oneArgument)).toThrow('Args alias drifted');
    expect(() =>
      resolveOperationArgsOwner('export interface MutationMultipleArgs { wrong: string; second?: (number | null) }', multipleArguments),
    ).toThrow('Args fields drifted');
  });

  it('discovers every root operation field structurally across multiline types', () => {
    const source = `export interface Query {
  compact?: Promise<string>;
  multiline?: Promise<
    string | number
  >;
  "quoted"?: Promise<boolean>;
}`;

    expect(operationFieldNames(source, 'Query')).toEqual(['compact', 'multiline', 'quoted']);
    expect(() => operationFieldNames(source, 'Query', ['compact', 'multiline'])).toThrow('Query operation fields drifted');
    expect(() => operationFieldNames('export interface Query { duplicate: string; duplicate: number }', 'Query')).toThrow(
      'contains duplicate field declarations',
    );
    expect(() => operationFieldNames('export interface Query { resolve(): string }', 'Query')).toThrow(
      'only supports static property signatures',
    );
  });

  it('attaches single-field argument guidance to its emitted alias', () => {
    const source = renderDocumentedTypeAlias('QueryLegacyArgs', 'string', '/** @deprecated Use modern instead. */');
    const sourceFile = ts.createSourceFile('generated-types.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const alias = sourceFile.statements[0];

    expect(ts.isTypeAliasDeclaration(alias)).toBe(true);
    expect(ts.getJSDocTags(alias).map((tag) => [tag.tagName.text, tag.comment])).toEqual([['deprecated', 'Use modern instead.']]);
  });

  it('derives one-field marked unions through the canonical rewrite path', () => {
    const alias = deriveMarkedUnionAlias(
      `export interface Result {
  /** Canonical result value. */
  value?: (Promise<string | number> | null);
}
`,
      'Result',
    );

    expect(alias.type).toBe('Promise<string | number> | null');
    expect(renderDocumentedTypeAlias('Result', alias.declaration)).toContain(
      '/** Canonical result value. */\n  | Promise<string | number>\n  | null',
    );
  });

  it('fails closed when marked union fields stop being optional', () => {
    expect(() =>
      deriveMarkedUnionAlias(
        `export interface Result {
  value: string;
}
`,
        'Result',
      ),
    ).toThrow('Result.value Union marker field must remain optional');
  });

  it('fails closed when a generation marker has no exact output effect', () => {
    const markers = {
      futureFields: new Set(['Query.currentValue']),
      issues: [],
      unionWrappers: new Set(['Result']),
    };
    const valid = `export interface Query {
  currentValue: Promise<string>;
}
export type Result = string | null;
`;
    const unionContracts = new Map([['Result', ['string', 'null']]]);

    expect(() => requireGeneratedMarkerEffects(valid, markers, unionContracts)).not.toThrow();
    expect(() =>
      requireGeneratedMarkerEffects(
        valid.replace('string | null', 'number | string | null'),
        markers,
        new Map([['Result', ['number', 'string', 'null']]]),
      ),
    ).not.toThrow();
    expect(() => requireGeneratedMarkerEffects(valid.replace('Promise<string>', 'string'), markers, unionContracts)).toThrow(
      'Query.currentValue Future marker did not produce exactly one Promise return',
    );
    expect(() =>
      requireGeneratedMarkerEffects(
        valid.replace('export type Result = string | null;', 'export interface Result { value?: string }'),
        markers,
        unionContracts,
      ),
    ).toThrow('Result Union marker must produce exactly one type alias; found 0 aliases and 1 interfaces');
    expect(() => requireGeneratedMarkerEffects(valid.replace('string | null', 'never'), markers, unionContracts)).toThrow(
      'Result Union marker alias body drifted; expected string | null, found never',
    );
    expect(() =>
      requireGeneratedMarkerEffects(valid.replace('string | null', 'string | null | WrongType'), markers, unionContracts),
    ).toThrow('Result Union marker alias body drifted; expected string | null, found string | null | WrongType');
  });
});
