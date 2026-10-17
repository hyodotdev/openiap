import {useCallback, useRef, useState} from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import {ErrorCode, type Purchase} from 'expo-iap';

type Stage = 'store' | 'confirmation' | 'finish';
type StepState = 'idle' | 'running' | 'done' | 'waiting' | 'failed' | 'skipped';

export interface PurchaseFlowActivity {
  key: string;
  productId: string;
  steps: Record<Stage, StepState>;
  note: string;
}

type ObservedPurchase = Pick<Purchase, 'id' | 'productId' | 'purchaseState'>;

function receivedPurchase(purchase: ObservedPurchase): PurchaseFlowActivity {
  return {
    key: purchase.id,
    productId: purchase.productId,
    steps: {
      store: purchase.purchaseState === 'purchased' ? 'done' : 'waiting',
      confirmation: 'idle',
      finish: 'idle',
    },
    note:
      purchase.purchaseState === 'purchased'
        ? 'Purchase received from the store, including recovered purchases.'
        : 'The store has not reported a completed purchase.',
  };
}

const STEP_LABELS: Record<StepState, string> = {
  idle: 'Not observed',
  running: 'Running',
  done: 'Completed',
  waiting: 'Waiting',
  failed: 'Needs retry',
  skipped: 'Skipped',
};

/** One visible attempt; late events from another purchase cannot advance it. */
export function usePurchaseFlowActivity() {
  const [activity, setActivity] = useState<PurchaseFlowActivity | null>(null);
  const requestNumber = useRef(0);
  const activityVersion = useRef(0);
  const startStore = useCallback((productId: string): string => {
    const key = `request-${++requestNumber.current}`;
    activityVersion.current++;
    setActivity({
      key,
      productId,
      steps: {store: 'running', confirmation: 'idle', finish: 'idle'},
      note: 'Waiting for the store. Opening its sheet does not confirm payment.',
    });
    return key;
  }, []);
  const startPurchase = useCallback((purchase: ObservedPurchase): void => {
    activityVersion.current++;
    setActivity(receivedPurchase(purchase));
  }, []);
  const update = useCallback(
    (key: string, stage: Stage, state: StepState, note: string): void => {
      activityVersion.current++;
      setActivity((current) =>
        current?.key === key
          ? {...current, steps: {...current.steps, [stage]: state}, note}
          : current,
      );
    },
    [],
  );
  const captureVersion = useCallback((): number => activityVersion.current, []);
  const storeError = useCallback(
    (key: string, code: string | undefined): void => {
      update(
        key,
        'store',
        code === ErrorCode.UserCancelled
          ? 'skipped'
          : code === ErrorCode.DeferredPayment
            ? 'waiting'
            : 'failed',
        code === ErrorCode.UserCancelled
          ? 'Purchase cancelled. No new payment was confirmed.'
          : code === ErrorCode.DeferredPayment
            ? 'Payment is pending at the store.'
            : 'The store reported a purchase error.',
      );
    },
    [update],
  );
  const observeRecoveredPending = useCallback(
    (purchase: ObservedPurchase, version: number): void => {
      setActivity((current) => {
        if (
          activityVersion.current !== version ||
          (current && Object.values(current.steps).includes('running'))
        )
          return current;
        return {
          ...receivedPurchase(purchase),
          note: 'Recovered a pending store payment. No backend confirmation or finish was attempted.',
        };
      });
    },
    [],
  );
  const reset = useCallback((): void => {
    activityVersion.current++;
    setActivity(null);
  }, []);
  return {
    activity,
    startStore,
    startPurchase,
    update,
    reset,
    captureVersion,
    observeRecoveredPending,
    storeError,
  };
}

interface Props {
  backend?: boolean;
  activity: PurchaseFlowActivity | null;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onLayout: (event: LayoutChangeEvent) => void;
  onBodyLayout: (event: LayoutChangeEvent) => void;
  onStepLayout: (stage: Stage, event: LayoutChangeEvent) => void;
}

export default function PurchaseFlowDiagram({
  backend = false,
  activity,
  expanded,
  onExpandedChange,
  onLayout,
  onBodyLayout,
  onStepLayout,
}: Props) {
  const stages: {id: Stage; owner: string; title: string; detail: string}[] = [
    {
      id: 'store',
      owner: 'STORE',
      title: 'Store purchase',
      detail:
        'The store returns a purchase or a pending payment. Recovery can deliver an existing purchase without a new charge.',
    },
    {
      id: 'confirmation',
      owner: backend ? 'YOUR SERVER' : 'APP + SDK',
      title: backend ? 'Backend decision' : 'Verify the receipt',
      detail: backend
        ? 'Your backend verifies store evidence, checks account ownership and decides access. The app observes one confirmation response.'
        : 'Use the selected receipt provider. A valid receipt does not grant app-account access; skipping verification leaves the transaction unfinished.',
    },
    {
      id: 'finish',
      owner: 'SDK → STORE',
      title: 'Finish transaction',
      detail: backend
        ? 'Settle an allowed decision: finish on Apple, acknowledge or consume on Google. A settled rejection or another account’s grant never grants access here.'
        : 'After verification, finish on Apple or acknowledge/consume on Google. App access remains your responsibility.',
    },
  ];
  const latestStage = activity
    ? [...stages].reverse().find((stage) => activity.steps[stage.id] !== 'idle')
    : undefined;

  return (
    <View testID="purchase-steps" style={styles.card} onLayout={onLayout}>
      <View style={styles.toggle}>
        <View style={styles.heading}>
          <Text style={styles.title}>Purchase steps</Text>
          <Text style={styles.summary} accessibilityLiveRegion="polite">
            {activity && latestStage
              ? `${latestStage.title} · ${
                  STEP_LABELS[activity.steps[latestStage.id]]
                }`
              : 'See who handles each step before you buy.'}
          </Text>
        </View>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={
            expanded ? 'Hide purchase steps' : 'Show purchase steps'
          }
          accessibilityState={{expanded}}
          onPress={() => onExpandedChange(!expanded)}
          style={styles.toggleButton}
        >
          <Text style={styles.toggleText}>{expanded ? 'Hide' : 'Show'}</Text>
        </TouchableOpacity>
      </View>
      {expanded ? (
        <View
          testID="purchase-steps-body"
          style={styles.diagram}
          onLayout={onBodyLayout}
        >
          {activity ? (
            <Text style={styles.summary}>{activity.note}</Text>
          ) : null}
          <Text style={styles.caption}>
            {activity
              ? `Latest purchase activity · ${activity.productId}`
              : 'Steps highlight only when the app observes them.'}
          </Text>
          {stages.map((stage, index) => {
            const state = activity?.steps[stage.id] ?? 'idle';
            const color =
              state === 'done'
                ? '#166534'
                : state === 'running'
                  ? '#1D4ED8'
                  : state === 'failed'
                    ? '#B91C1C'
                    : state === 'waiting' || state === 'skipped'
                      ? '#92400E'
                      : '#64748B';
            return (
              <View
                key={stage.id}
                testID={`purchase-step-${stage.id}`}
                style={styles.step}
                onLayout={(event) => onStepLayout(stage.id, event)}
              >
                <View style={styles.rail}>
                  <View style={[styles.node, {borderColor: color}]}>
                    {state === 'running' ? (
                      <ActivityIndicator size="small" color={color} />
                    ) : (
                      <Text style={[styles.number, {color}]}>
                        {state === 'done' ? '✓' : index + 1}
                      </Text>
                    )}
                  </View>
                  {index < stages.length - 1 ? (
                    <View style={styles.connector} />
                  ) : null}
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.owner}>{stage.owner}</Text>
                  <Text style={styles.stepTitle}>{stage.title}</Text>
                  <Text style={[styles.state, {color}]}>
                    {STEP_LABELS[state]}
                  </Text>
                  <Text style={styles.detail}>{stage.detail}</Text>
                </View>
              </View>
            );
          })}
          <Text style={styles.caption}>
            This view follows app callbacks, not the store’s internal
            processing.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  toggle: {flexDirection: 'row', alignItems: 'center', padding: 16, gap: 12},
  heading: {flex: 1},
  title: {fontSize: 15, fontWeight: '600', color: '#0F172A', lineHeight: 22},
  summary: {fontSize: 13, lineHeight: 19, color: '#475569', marginTop: 4},
  toggleButton: {
    minHeight: 44,
    minWidth: 60,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  toggleText: {fontSize: 13, fontWeight: '600', color: '#1D4ED8'},
  diagram: {paddingHorizontal: 16, paddingBottom: 16, gap: 16},
  caption: {fontSize: 12, lineHeight: 18, color: '#64748B'},
  step: {flexDirection: 'row', gap: 12},
  rail: {alignItems: 'center', width: 30},
  node: {
    width: 30,
    height: 30,
    borderWidth: 1.5,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  number: {fontSize: 14, fontWeight: '600'},
  connector: {width: 1, backgroundColor: '#CBD5E1', flex: 1, marginTop: 6},
  stepContent: {flex: 1, paddingBottom: 10, gap: 3},
  owner: {fontSize: 10, letterSpacing: 1, color: '#64748B', fontWeight: '600'},
  stepTitle: {
    fontSize: 16,
    lineHeight: 22,
    color: '#0F172A',
    fontWeight: '600',
  },
  state: {fontSize: 12, fontWeight: '600', lineHeight: 18},
  detail: {fontSize: 13, lineHeight: 19, color: '#475569'},
});
