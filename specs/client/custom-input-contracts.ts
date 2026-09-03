type InputContractType = Readonly<{
  kind: 'scalar' | 'enum' | 'input' | 'list';
  name?: string;
  nullable: boolean;
  elementType?: InputContractType;
}>;

type InputContractField = Readonly<{
  name: string;
  type: InputContractType;
  defaultValue?: unknown;
}>;

const field = (
  name: string,
  kind: InputContractType['kind'],
  typeName: string | undefined,
  nullable: boolean,
  options: {
    elementType?: InputContractType;
    defaultValue?: unknown;
  } = {},
): InputContractField =>
  Object.freeze({
    name,
    type: Object.freeze({
      kind,
      name: typeName,
      nullable,
      ...(options.elementType ? { elementType: Object.freeze(options.elementType) } : {}),
    }),
    defaultValue: options.defaultValue,
  });

/**
 * Inputs whose generated public shape is intentionally customized by one or
 * more language plugins. Keep this as the only custom-type discriminator SSOT.
 */
export const CUSTOM_INPUT_CONTRACTS = Object.freeze({
  DiscountOfferInputIOS: Object.freeze([
    field('identifier', 'scalar', 'String', false),
    field('keyIdentifier', 'scalar', 'String', false),
    field('nonce', 'scalar', 'String', false),
    field('signature', 'scalar', 'String', false),
    field('timestamp', 'scalar', 'Float', false),
  ]),
  PurchaseInput: Object.freeze([
    field('id', 'scalar', 'ID', false),
    field('productId', 'scalar', 'String', false),
    field('ids', 'list', undefined, true, {
      elementType: {
        kind: 'scalar',
        name: 'String',
        nullable: false,
      },
    }),
    field('transactionDate', 'scalar', 'Float', false),
    field('purchaseToken', 'scalar', 'String', true),
    field('store', 'enum', 'IapStore', true),
    field('quantity', 'scalar', 'Int', false),
    field('purchaseState', 'enum', 'PurchaseState', false),
    field('isAutoRenewing', 'scalar', 'Boolean', false),
  ]),
  RequestPurchaseProps: Object.freeze([
    field('requestPurchase', 'input', 'RequestPurchasePropsByPlatforms', true),
    field('requestSubscription', 'input', 'RequestSubscriptionPropsByPlatforms', true),
    field('type', 'enum', 'ProductQueryType', true, {
      defaultValue: 'InApp',
    }),
  ]),
} as const);

/**
 * Nested inputs that custom RequestPurchaseProps generators project directly.
 * They remain standard generated inputs, but their exact schema shape is just
 * as compatibility-sensitive as the outer custom type.
 */
const REQUEST_PLATFORM_INPUT_CONTRACTS = Object.freeze({
  RequestPurchasePropsByPlatforms: Object.freeze([
    field('apple', 'input', 'RequestPurchaseIosProps', true),
    field('google', 'input', 'RequestPurchaseAndroidProps', true),
  ]),
  RequestSubscriptionPropsByPlatforms: Object.freeze([
    field('apple', 'input', 'RequestSubscriptionIosProps', true),
    field('google', 'input', 'RequestSubscriptionAndroidProps', true),
  ]),
} as const);

export const GENERATOR_INPUT_CONTRACTS = Object.freeze({
  ...CUSTOM_INPUT_CONTRACTS,
  ...REQUEST_PLATFORM_INPUT_CONTRACTS,
});

/**
 * Generated declarations that intentionally project a custom input's fields
 * rather than retaining the input as a nested property.
 */
export const TYPESCRIPT_CUSTOM_INPUT_PROJECTIONS = Object.freeze({
  RequestPurchaseProps: Object.freeze({
    operationArgsOwner: 'MutationRequestPurchaseArgs',
    sourceProperty: 'params',
  }),
});

export type CustomInputKind = keyof typeof CUSTOM_INPUT_CONTRACTS;
