import React from 'react';
import {Button, ScrollView, View} from 'react-native';
import {act, fireEvent, render} from '@testing-library/react-native';
import PurchaseFlowDiagram, {
  type PurchaseFlowActivity,
} from '../src/components/PurchaseFlowDiagram';
import usePurchaseFlowScroll from '../src/components/usePurchaseFlowScroll';

function Harness({
  activity,
  showScroll = true,
}: {
  activity: PurchaseFlowActivity | null;
  showScroll?: boolean;
}) {
  const {
    setScrollView,
    expanded,
    changeExpanded,
    beginPurchase,
    onScroll,
    onScrollBeginDrag,
    onContentLayout,
    onDiagramLayout,
    onDiagramBodyLayout,
    onStepLayout,
  } = usePurchaseFlowScroll(activity);
  if (!showScroll) return <View testID="loading" />;
  return (
    <ScrollView
      ref={setScrollView}
      testID="scroll"
      onScroll={onScroll}
      onScrollBeginDrag={onScrollBeginDrag}
    >
      <View testID="content" onLayout={onContentLayout}>
        <PurchaseFlowDiagram
          activity={activity}
          expanded={expanded}
          onExpandedChange={changeExpanded}
          onLayout={onDiagramLayout}
          onBodyLayout={onDiagramBodyLayout}
          onStepLayout={onStepLayout}
        />
        <Button title="Buy" onPress={() => beginPurchase('bulbs')} />
      </View>
    </ScrollView>
  );
}

function purchase(
  finish: PurchaseFlowActivity['steps']['finish'],
  key = 'transaction-1',
  productId = 'bulbs',
): PurchaseFlowActivity {
  return {
    key,
    productId,
    steps: {store: 'done', confirmation: 'done', finish},
    note: 'Observed callback.',
  };
}

describe('purchase progress scrolling', () => {
  let scrollTo: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  async function prepare(expanded = true) {
    const screen = await render(<Harness activity={null} />);
    await fireEvent(screen.getByTestId('content'), 'layout', {
      nativeEvent: {layout: {x: 0, y: 100, width: 375, height: 2000}},
    });
    await fireEvent(screen.getByTestId('purchase-steps'), 'layout', {
      nativeEvent: {layout: {x: 0, y: 30, width: 335, height: 80}},
    });
    await fireEvent.scroll(screen.getByTestId('scroll'), {
      nativeEvent: {contentOffset: {x: 0, y: 640}},
    });
    if (expanded)
      await fireEvent.press(
        screen.getByRole('button', {name: 'Show purchase steps'}),
      );
    return screen;
  }

  it('keeps a closed panel closed without moving after purchase or finish', async () => {
    const screen = await prepare(false);
    await fireEvent.press(screen.getByText('Buy'));
    await screen.rerender(<Harness activity={purchase('done')} />);
    await act(() => jest.advanceTimersByTime(1000));
    expect(scrollTo).not.toHaveBeenCalled();
    expect(screen.getByText('Show')).toBeDefined();
    expect(screen.getByText('Purchase steps')).toBeDefined();
    expect(screen.queryByText('−')).toBeNull();
  });

  it('shows open progress and returns to the purchase position only after finish', async () => {
    const screen = await prepare();
    await fireEvent.press(screen.getByText('Buy'));
    expect(scrollTo).toHaveBeenLastCalledWith({y: 118, animated: true});
    await screen.rerender(<Harness activity={purchase('running')} />);
    await act(() => jest.advanceTimersByTime(1000));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    await screen.rerender(<Harness activity={purchase('done')} />);
    await act(() => jest.advanceTimersByTime(799));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    await act(() => jest.advanceTimersByTime(1));
    expect(scrollTo).toHaveBeenLastCalledWith({y: 640, animated: true});
    await screen.rerender(<Harness activity={purchase('done')} />);
    await act(() => jest.advanceTimersByTime(1000));
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it.each(['close', 'drag'] as const)(
    'respects %s while the purchase is finishing',
    async (action) => {
      const screen = await prepare();
      await fireEvent.press(screen.getByText('Buy'));
      await screen.rerender(<Harness activity={purchase('done')} />);
      if (action === 'close')
        await fireEvent.press(
          screen.getByRole('button', {name: 'Hide purchase steps'}),
        );
      else await fireEvent(screen.getByTestId('scroll'), 'scrollBeginDrag');
      await act(() => jest.advanceTimersByTime(1000));
      expect(scrollTo).toHaveBeenCalledTimes(1);
    },
  );

  it('does not start following when a panel opens after the purchase started', async () => {
    const screen = await prepare(false);
    await fireEvent.press(screen.getByText('Buy'));
    await fireEvent.press(
      screen.getByRole('button', {name: 'Show purchase steps'}),
    );
    await screen.rerender(<Harness activity={purchase('done')} />);
    await act(() => jest.advanceTimersByTime(1000));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('leaves failed finishing visible and returns after a successful retry', async () => {
    const screen = await prepare();
    await fireEvent.press(screen.getByText('Buy'));
    await screen.rerender(<Harness activity={purchase('failed')} />);
    await act(() => jest.advanceTimersByTime(1000));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    await screen.rerender(<Harness activity={purchase('done')} />);
    await act(() => jest.advanceTimersByTime(800));
    expect(scrollTo).toHaveBeenLastCalledWith({y: 640, animated: true});
  });

  it('ignores another product and an older transaction after a new purchase', async () => {
    const screen = await prepare();
    await fireEvent.press(screen.getByText('Buy'));
    await screen.rerender(
      <Harness activity={purchase('done', 'old', 'premium')} />,
    );
    await act(() => jest.advanceTimersByTime(1000));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    await screen.rerender(<Harness activity={purchase('done', 'old')} />);
    await fireEvent.press(screen.getByText('Buy'));
    await act(() => jest.advanceTimersByTime(1000));
    expect(scrollTo).toHaveBeenCalledTimes(2);
    await screen.rerender(<Harness activity={purchase('done', 'new')} />);
    await act(() => jest.advanceTimersByTime(800));
    expect(scrollTo).toHaveBeenCalledTimes(3);
  });

  it('follows the real transaction after a deferred purchase request', async () => {
    const screen = await prepare();
    await fireEvent.press(screen.getByText('Buy'));
    const deferred: PurchaseFlowActivity = {
      key: 'request-1',
      productId: 'bulbs',
      steps: {store: 'waiting', confirmation: 'idle', finish: 'idle'},
      note: 'Payment is pending at the store.',
    };
    await screen.rerender(<Harness activity={deferred} />);
    await act(() => jest.advanceTimersByTime(1000));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    await screen.rerender(<Harness activity={purchase('done')} />);
    await act(() => jest.advanceTimersByTime(800));
    expect(scrollTo).toHaveBeenLastCalledWith({y: 640, animated: true});
    expect(scrollTo).toHaveBeenCalledTimes(2);
  });

  it('brings the current finish stage into view before returning', async () => {
    const screen = await prepare();
    await fireEvent(screen.getByTestId('purchase-steps-body'), 'layout', {
      nativeEvent: {layout: {x: 0, y: 80, width: 335, height: 500}},
    });
    await fireEvent(screen.getByTestId('purchase-step-finish'), 'layout', {
      nativeEvent: {layout: {x: 0, y: 300, width: 335, height: 100}},
    });
    await fireEvent.press(screen.getByText('Buy'));
    await screen.rerender(<Harness activity={purchase('running')} />);
    expect(scrollTo).toHaveBeenLastCalledWith({y: 486, animated: true});
    await screen.rerender(<Harness activity={purchase('done')} />);
    await act(() => jest.advanceTimersByTime(800));
    expect(scrollTo).toHaveBeenLastCalledWith({y: 640, animated: true});
    expect(scrollTo).toHaveBeenCalledTimes(3);
  });

  it('cancels the old return when the account activity is reset', async () => {
    const screen = await prepare();
    await fireEvent.press(screen.getByText('Buy'));
    await screen.rerender(<Harness activity={purchase('done')} />);
    await screen.rerender(<Harness activity={null} />);
    await act(() => jest.advanceTimersByTime(1000));
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('does not return into a replacement scroll view after reconnecting', async () => {
    const screen = await prepare();
    await fireEvent.press(screen.getByText('Buy'));
    await screen.rerender(<Harness activity={purchase('done')} />);
    await screen.rerender(
      <Harness activity={purchase('done')} showScroll={false} />,
    );
    await screen.rerender(<Harness activity={purchase('done')} />);
    await act(() => jest.advanceTimersByTime(800));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByText('Buy'));
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending return on unmount', async () => {
    const screen = await prepare();
    await fireEvent.press(screen.getByText('Buy'));
    await screen.rerender(<Harness activity={purchase('done')} />);
    await screen.unmount();
    await act(() => jest.advanceTimersByTime(1000));
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });
});
