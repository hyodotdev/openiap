import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
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
};

export function getVegaTvNavigationStep(event: TvRemoteEvent): -1 | 0 | 1 {
  if (!isVegaTvShortcutEnabled() || !isTvKeyRelease(event)) {
    return 0;
  }
  if (event.eventType === 'down' || event.eventType === 'right') {
    return 1;
  }
  if (event.eventType === 'up' || event.eventType === 'left') {
    return -1;
  }
  return 0;
}

export function useVegaTvSelection({itemCount}: UseVegaTvSelectionOptions): {
  selectedIndex: number;
  setSelectedIndex: Dispatch<SetStateAction<number>>;
} {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex((currentIndex) =>
      Math.min(currentIndex, Math.max(itemCount - 1, 0)),
    );
  }, [itemCount]);

  const handleTvEvent = useCallback(
    (event: TvRemoteEvent) => {
      const navigationStep = getVegaTvNavigationStep(event);

      if (navigationStep === 1) {
        setSelectedIndex((currentIndex) =>
          Math.min(currentIndex + 1, Math.max(itemCount - 1, 0)),
        );
        return;
      }

      if (navigationStep === -1) {
        setSelectedIndex((currentIndex) => Math.max(currentIndex - 1, 0));
      }
    },
    [itemCount],
  );

  useTVEventHandler(handleTvEvent);

  return {selectedIndex, setSelectedIndex};
}
