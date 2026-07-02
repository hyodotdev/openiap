import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {useTVEventHandler} from 'react-native';
import {
  isTvKeyRelease,
  isVegaTvShortcutEnabled,
  type TvRemoteEvent,
} from '../utils/vegaRuntime';

type UseVegaTvSelectionOptions = {
  itemCount: number;
  isItemDisabled?: (index: number) => boolean;
  onSelect: (index: number) => void;
  suppressSelection?: boolean;
};

export function useVegaTvSelection({
  itemCount,
  isItemDisabled,
  onSelect,
  suppressSelection,
}: UseVegaTvSelectionOptions): {
  selectedIndex: number;
  setSelectedIndex: Dispatch<SetStateAction<number>>;
} {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const suppressUntilRef = useRef(0);
  const stateRef = useRef({
    isItemDisabled,
    itemCount,
    onSelect,
    selectedIndex,
  });

  stateRef.current = {
    isItemDisabled,
    itemCount,
    onSelect,
    selectedIndex,
  };

  useEffect(() => {
    setSelectedIndex((currentIndex) =>
      Math.min(currentIndex, Math.max(itemCount - 1, 0)),
    );
  }, [itemCount]);

  useEffect(() => {
    if (suppressSelection) {
      suppressUntilRef.current = Date.now() + 1_500;
    }
  }, [suppressSelection]);

  const handleTvEvent = useCallback((event: TvRemoteEvent) => {
    if (!isVegaTvShortcutEnabled() || !isTvKeyRelease(event)) {
      return;
    }

    const state = stateRef.current;
    if (event.eventType === 'down' || event.eventType === 'right') {
      setSelectedIndex((currentIndex) =>
        Math.min(currentIndex + 1, Math.max(state.itemCount - 1, 0)),
      );
      return;
    }

    if (event.eventType === 'up' || event.eventType === 'left') {
      setSelectedIndex((currentIndex) => Math.max(currentIndex - 1, 0));
      return;
    }

    if (event.eventType !== 'select' && event.eventType !== 'enter') {
      return;
    }

    if (Date.now() < suppressUntilRef.current) {
      return;
    }

    if (
      state.selectedIndex >= state.itemCount ||
      state.isItemDisabled?.(state.selectedIndex)
    ) {
      return;
    }

    state.onSelect(state.selectedIndex);
  }, []);

  useTVEventHandler(handleTvEvent);

  return {selectedIndex, setSelectedIndex};
}
