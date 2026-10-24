import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {
  createPurchaseFlow,
  describePurchaseFlowStatus,
  type PurchaseConfirmation,
  type PurchaseFlowOutcome,
  type PurchaseFlowPurchase,
  type PurchaseFlowStatus,
} from '../purchase-flow-core';
import {
  createDeviceConfirmationIOS,
  createIapkitConfirmation,
  type IapkitVerificationProps,
  type IapkitVerificationResult,
} from '../purchase-flow-confirmers';

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

  it.each(vectors.sequences.map((v) => [v.name, v] as const))(
    'sequence: %s',
    async (_, vector) => {
      const {purchases, answers, pendingIOS} = vector;
      const purchaseAt = (key: string) => {
        const purchase = purchases[key];
        if (purchase === undefined) {
          throw new Error(`Missing purchase fixture: ${key}`);
        }
        return purchase;
      };
      const confirms: Record<string, number> = {};
      const finishes: Record<string, number> = {};
      const published: PurchaseFlowOutcome<PurchaseFlowPurchase>[] = [];
      const consumables = new Set(vector.consumables);
      const requested = new Set(vector.requested);
      const store: {deliver?: (purchase: PurchaseFlowPurchase) => void} = {};
      const flow = createPurchaseFlow<PurchaseFlowPurchase>({
        confirmWithBackend: async (purchase) => {
          const count = (confirms[purchase.id] =
            (confirms[purchase.id] ?? 0) + 1);
          const list = answers[purchase.id] ?? answers['*'];
          const answer = list?.[Math.min(count, list.length) - 1];
          if (answer === undefined) {
            throw new Error(`Missing confirmation fixture: ${purchase.id}`);
          }
          if (answer === 'throw') throw new Error('backend down');
          return answer;
        },
        finishTransaction: async ({purchase}) => {
          finishes[purchase.id] = (finishes[purchase.id] ?? 0) + 1;
        },
        isConsumable: (productId) => consumables.has(productId),
        getAvailablePurchases: async () =>
          (vector.available ?? []).map(purchaseAt),
        getPendingTransactionsIOS:
          pendingIOS === undefined
            ? undefined
            : async () => {
                if (pendingIOS === 'throw') throw new Error('unverified');
                return pendingIOS.map(purchaseAt);
              },
        listenForPurchases: (onPurchase) => {
          store.deliver = onPurchase;
          return {
            remove: () => {
              store.deliver = undefined;
            },
          };
        },
        wasRequested: (purchase) =>
          vector.requestedOnce
            ? requested.delete(purchase.id)
            : requested.has(purchase.id),
      });
      flow.subscribe((outcome) => published.push(outcome));
      const comparable = (status: PurchaseFlowStatus) => {
        const {error, finishError, ...rest} = status as Record<string, unknown>;
        return {
          ...rest,
          ...(error === undefined ? {} : {error: true}),
          ...(finishError === undefined ? {} : {finishError: true}),
        };
      };
      const byId = (outcomes: PurchaseFlowOutcome<PurchaseFlowPurchase>[]) =>
        outcomes.map(({purchase, status}) => ({
          id: purchase.id,
          status: comparable(status),
        }));

      try {
        for (const step of vector.steps) {
          if (step.dispose) flow.dispose();
          for (const key of step.listener ?? [])
            store.deliver?.(purchaseAt(key));
          const processed = (step.process ?? []).map((key) =>
            flow.processPurchase(purchaseAt(key)),
          );
          const recovered = step.recover
            ? flow.recoverPurchases(step.recover)
            : undefined;
          await Promise.all(processed);
          if (recovered) expect(byId(await recovered)).toEqual(step.outcomes);
          // Listener deliveries settle without a promise to wait on.
          await new Promise((resolve) => setTimeout(resolve, 0));
        }

        expect(confirms).toEqual(vector.confirms);
        expect(finishes).toEqual(vector.finishes);
        if (vector.published) {
          expect(byId(published)).toEqual(vector.published);
        }
      } finally {
        flow.dispose();
      }
    },
  );
});
