import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {
  createPurchaseFlow,
  describePurchaseFlowStatus,
  type PurchaseConfirmation,
  type PurchaseFlowPurchase,
} from '../purchase-flow-core';
import {
  createDeviceConfirmationIOS,
  createIapkitConfirmation,
  type IapkitVerificationProps,
  type IapkitVerificationResult,
} from '../purchase-flow-confirmers';
import * as legacy from '../purchase-flow';

interface StepVector {
  listener?: string[];
  process?: string[];
  recover?: {includeFinished?: boolean};
  outcomes?: {id: string; status: unknown}[];
  dispose?: boolean;
}

// The cases every port runs; see the file's $comment.
const vectors: {
  process: {
    name: string;
    purchase: PurchaseFlowPurchase;
    isConsumable: boolean;
    confirmation?: unknown;
    confirmThrows?: true;
    finishThrows?: true;
    confirms?: boolean;
    finishes: boolean;
    status: unknown;
    guidance: unknown;
  }[];
  iapkit: {
    name: string;
    purchase: PurchaseFlowPurchase;
    isConsumable: boolean;
    apiKey?: string | null;
    baseUrl?: string;
    amazon?: {sandbox: boolean; verifiedProductIds: Record<string, string>};
    verifyAs?: Record<string, 'apple' | 'google' | 'amazon' | 'horizon'>;
    noGrant?: true;
    props: IapkitVerificationProps | null;
    result?: IapkitVerificationResult;
    verifies?: boolean;
    confirmation?: PurchaseConfirmation;
    error?: true;
    granted: boolean;
  }[];
  device: {
    name: string;
    clock?: {beforeRead: number; afterRead: number};
    purchase: PurchaseFlowPurchase;
    pending: PurchaseFlowPurchase[];
    isConsumable: boolean;
    noGrant?: true;
    reads?: boolean;
    confirmation?: PurchaseConfirmation;
    error?: true;
    granted: boolean;
  }[];
  sequences: {
    name: string;
    consumables?: string[];
    purchases: Record<string, PurchaseFlowPurchase>;
    answers: Record<string, (PurchaseConfirmation | 'throw')[]>;
    requested?: string[];
    requestedOnce?: true;
    pendingIOS?: string[] | 'throw';
    available?: string[];
    steps: StepVector[];
    confirms: Record<string, number>;
    finishes: Record<string, number>;
    published?: {id: string; status: unknown}[];
  }[];
} = JSON.parse(
  readFileSync(join(__dirname, 'fixtures/purchase-flow.vectors.json'), 'utf8'),
);

describe('shared vectors', () => {
  it.each(vectors.process.map((v) => [v.name, v] as const))(
    'process: %s',
    async (_, vector) => {
      const confirmWithBackend = jest.fn(async () => {
        if (vector.confirmThrows) throw new Error('backend down');
        // Raw JSON on purpose: the flow must reject malformed answers itself.
        return vector.confirmation as PurchaseConfirmation;
      });
      const finishTransaction = jest.fn(
        async (_args: {
          purchase: PurchaseFlowPurchase;
          isConsumable: boolean;
        }) => {
          if (vector.finishThrows) throw new Error('store down');
        },
      );
      const flow = createPurchaseFlow({
        confirmWithBackend,
        finishTransaction,
        isConsumable: () => vector.isConsumable,
        getAvailablePurchases: async () => [],
        getPendingTransactionsIOS: undefined,
      });
      const item = vector.purchase;

      const status = await flow.processPurchase(item);

      expect(confirmWithBackend).toHaveBeenCalledTimes(
        vector.confirms === false ? 0 : 1,
      );
      if (vector.finishes) {
        expect(finishTransaction).toHaveBeenCalledTimes(1);
        expect(finishTransaction).toHaveBeenCalledWith({
          purchase: item,
          isConsumable: vector.isConsumable,
        });
      } else {
        expect(finishTransaction).not.toHaveBeenCalled();
      }
      const {error, finishError, ...rest} = status as Record<string, unknown>;
      expect({
        ...rest,
        ...(error === undefined ? {} : {error: true}),
        ...(finishError === undefined ? {} : {finishError: true}),
      }).toEqual(vector.status);
      expect(describePurchaseFlowStatus(status)).toEqual(vector.guidance);
    },
  );

  it.each(vectors.iapkit.map((v) => [v.name, v] as const))(
    'iapkit: %s',
    async (_, vector) => {
      const item = vector.purchase;
      const {amazon} = vector;
      const productIds = amazon?.verifiedProductIds ?? {};
      const stores = vector.verifyAs ?? {};
      const grant = jest.fn(async () => {});
      const apiKey = vector.apiKey === undefined ? 'pk' : vector.apiKey;
      const options = {
        ...(apiKey === null ? {} : {apiKey}),
        baseUrl: vector.baseUrl,
        ...(amazon
          ? {
              amazon: {
                sandbox: amazon.sandbox,
                verifiedProductId: (id: string) => productIds[id] ?? id,
              },
            }
          : {}),
        verifyAs: (p: PurchaseFlowPurchase) => stores[p.storeId ?? ''],
        ...(vector.noGrant ? {} : {grant}),
      };
      const verify = jest.fn(
        async (_props: IapkitVerificationProps) => vector.result ?? {},
      );
      const confirm = createIapkitConfirmation(verify, options);

      const answer = confirm(item, {isConsumable: vector.isConsumable});

      if (vector.error) {
        await expect(answer).rejects.toThrow();
      } else {
        await expect(answer).resolves.toEqual(vector.confirmation);
      }
      if (vector.props === null || vector.verifies === false) {
        expect(verify).not.toHaveBeenCalled();
      } else {
        expect(verify).toHaveBeenCalledTimes(1);
        expect(verify).toHaveBeenCalledWith(vector.props);
      }
      expect(grant).toHaveBeenCalledTimes(vector.granted ? 1 : 0);
    },
  );

  it.each(vectors.device.map((v) => [v.name, v] as const))(
    'device: %s',
    async (_, vector) => {
      const {clock} = vector;
      if (clock) jest.useFakeTimers({now: clock.beforeRead});
      try {
        const grant = jest.fn(async () => {});
        const read = jest.fn(async () => {
          if (clock) jest.setSystemTime(clock.afterRead);
          return vector.pending;
        });
        const confirm = createDeviceConfirmationIOS(
          read,
          vector.noGrant ? {} : {grant},
        );

        const answer = confirm(vector.purchase, {
          isConsumable: vector.isConsumable,
        });

        if (vector.error) {
          await expect(answer).rejects.toThrow();
        } else {
          await expect(answer).resolves.toEqual(vector.confirmation);
        }
        expect(read).toHaveBeenCalledTimes(vector.reads === false ? 0 : 1);
        expect(grant).toHaveBeenCalledTimes(vector.granted ? 1 : 0);
      } finally {
        jest.useRealTimers();
      }
    },
  );
});

it('keeps the retained compatibility facade callable without native bindings', async () => {
  const purchase: PurchaseFlowPurchase = {
    id: 'tx',
    productId: 'premium',
    store: 'apple',
    storeId: 'apple',
    purchaseToken: 'synthetic-jws',
    purchaseState: 'purchased',
  };
  const result: IapkitVerificationResult = {
    iapkit: {
      store: 'apple',
      storeId: 'apple',
      isValid: true,
      state: 'entitled',
      productId: 'premium',
    },
  };
  expect(legacy.toIapkitVerificationProps(purchase, {})).toEqual({
    provider: 'iapkit',
    iapkit: {apple: {jws: 'synthetic-jws'}},
  });
  const expected = {status: 'entitled', alreadyGranted: false};
  expect(
    legacy.readIapkitVerification(result, purchase, {isConsumable: false}),
  ).toEqual(expected);
  await expect(
    legacy.createIapkitConfirmation(async () => result, {})(purchase, {
      isConsumable: false,
    }),
  ).resolves.toEqual(expected);
  await expect(
    legacy.createDeviceConfirmationIOS(async () => [purchase])(purchase, {
      isConsumable: false,
    }),
  ).resolves.toEqual(expected);
});
