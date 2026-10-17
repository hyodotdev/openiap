import {useCallback, useEffect, useRef, useState} from 'react';
import {
  ScrollView,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import type {PurchaseFlowActivity} from './PurchaseFlowDiagram';

type Stage = keyof PurchaseFlowActivity['steps'];

interface FollowedPurchase {
  productId: string;
  previousKey: string | undefined;
  purchaseKey?: string;
  returnY: number;
  stage: Stage;
}

/** Follow only a purchase started while its diagram is open. */
export default function usePurchaseFlowScroll(
  activity: PurchaseFlowActivity | null,
) {
  const scrollRef = useRef<ScrollView>(null);
  const offsetY = useRef(0);
  const contentY = useRef(0);
  const diagramY = useRef<number | null>(null);
  const followed = useRef<FollowedPurchase | null>(null);
  const bodyY = useRef(0);
  const stepY = useRef<Partial<Record<Stage, number>>>({});
  const [layoutVersion, setLayoutVersion] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const setScrollView = useCallback((view: ScrollView | null): void => {
    scrollRef.current = view;
    if (view) return;
    followed.current = null;
    offsetY.current = 0;
    contentY.current = 0;
    diagramY.current = null;
    bodyY.current = 0;
    stepY.current = {};
  }, []);

  const changeExpanded = useCallback((value: boolean): void => {
    if (!value) followed.current = null;
    setExpanded(value);
  }, []);

  const beginPurchase = (productId: string): void => {
    followed.current = null;
    if (!expanded || diagramY.current === null) return;
    followed.current = {
      productId,
      previousKey: activity?.key,
      returnY: offsetY.current,
      stage: 'store',
    };
    scrollRef.current?.scrollTo({
      y: Math.max(0, contentY.current + diagramY.current - 12),
      animated: true,
    });
  };

  useEffect(() => {
    const current = followed.current;
    if (!activity) {
      followed.current = null;
      return;
    }
    if (
      !expanded ||
      !current ||
      activity.productId !== current.productId ||
      activity.key === current.previousKey
    )
      return;
    if (activity.steps.store === 'running') return;
    if (
      activity.steps.store === 'failed' ||
      activity.steps.store === 'skipped'
    ) {
      followed.current = null;
      return;
    }
    if (activity.steps.store !== 'done') return;
    current.purchaseKey ??= activity.key;
    const stage: Stage =
      activity.steps.finish !== 'idle'
        ? 'finish'
        : activity.steps.confirmation !== 'idle'
          ? 'confirmation'
          : 'store';
    const stageY = stepY.current[stage];
    if (
      activity.key === current.purchaseKey &&
      current.stage !== stage &&
      stageY !== undefined &&
      diagramY.current !== null
    ) {
      current.stage = stage;
      scrollRef.current?.scrollTo({
        y: Math.max(
          0,
          contentY.current + diagramY.current + bodyY.current + stageY - 24,
        ),
        animated: true,
      });
    }
    if (
      activity.key !== current.purchaseKey ||
      activity.steps.finish !== 'done'
    )
      return;

    // Leave the completed step visible briefly before returning to the product.
    const timer = setTimeout(() => {
      if (followed.current !== current) return;
      followed.current = null;
      scrollRef.current?.scrollTo({y: current.returnY, animated: true});
    }, 800);
    return () => clearTimeout(timer);
  }, [activity, expanded, layoutVersion]);

  return {
    setScrollView,
    expanded,
    changeExpanded,
    beginPurchase,
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>): void => {
      offsetY.current = event.nativeEvent.contentOffset.y;
    },
    onScrollBeginDrag: (): void => {
      followed.current = null;
    },
    onContentLayout: (event: LayoutChangeEvent): void => {
      contentY.current = event.nativeEvent.layout.y;
    },
    onDiagramLayout: (event: LayoutChangeEvent): void => {
      diagramY.current = event.nativeEvent.layout.y;
    },
    onDiagramBodyLayout: (event: LayoutChangeEvent): void => {
      const y = event.nativeEvent.layout.y;
      if (bodyY.current === y) return;
      bodyY.current = y;
      setLayoutVersion((version) => version + 1);
    },
    onStepLayout: (stage: Stage, event: LayoutChangeEvent): void => {
      const y = event.nativeEvent.layout.y;
      if (stepY.current[stage] === y) return;
      stepY.current[stage] = y;
      setLayoutVersion((version) => version + 1);
    },
  };
}
