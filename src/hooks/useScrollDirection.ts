'use no memo'; // SharedValue updates from scroll events

import { useCallback, useRef } from 'react';
import {
  useSharedValue,
  withTiming,
  SharedValue,
} from 'react-native-reanimated';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

const SCROLL_THRESHOLD = 5; // Minimum delta to trigger direction change
const ANIMATION_DURATION = 200;

type ScrollDirection = 'up' | 'down' | 'idle';

interface UseScrollDirectionReturn {
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  isVisible: SharedValue<number>;
}

/**
 * Tracks scroll direction and provides an animated visibility value.
 * - Scrolling DOWN hides (isVisible = 0)
 * - Scrolling UP shows (isVisible = 1)
 *
 * Uses a threshold to prevent jitter from minor scroll fluctuations.
 * Uses regular JS callback instead of worklet for FlashList compatibility.
 */
export function useScrollDirection(): UseScrollDirectionReturn {
  const previousScrollY = useRef(0);
  const direction = useRef<ScrollDirection>('idle');
  const isVisible = useSharedValue(1);

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = event.nativeEvent.contentOffset.y;
      const delta = currentY - previousScrollY.current;

      // Only change direction if delta exceeds threshold
      if (Math.abs(delta) > SCROLL_THRESHOLD) {
        const newDirection: ScrollDirection = delta > 0 ? 'down' : 'up';

        if (direction.current !== newDirection) {
          direction.current = newDirection;
          isVisible.value = withTiming(newDirection === 'up' ? 1 : 0, {
            duration: ANIMATION_DURATION,
          });
        }
      }

      // Always show when at the top
      if (currentY <= 0 && isVisible.value !== 1) {
        isVisible.value = withTiming(1, { duration: ANIMATION_DURATION });
        direction.current = 'idle';
      }

      previousScrollY.current = currentY;
    },
    [isVisible]
  );

  return { onScroll, isVisible };
}
