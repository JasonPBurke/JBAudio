import { useCallback, useEffect, useRef } from 'react';
import {
  useSharedValue,
  withTiming,
  SharedValue,
} from 'react-native-reanimated';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

const SCROLL_THRESHOLD = 5; // Minimum delta to trigger direction change
const ANIMATION_DURATION = 200;

type ScrollDirection = 'up' | 'down' | 'idle';

interface UseScrollDirectionOptions {
  /**
   * Identifies the scrollable surface currently mounted -- the library screen
   * passes its `toggleView`. Its VALUE is never read; only a CHANGE matters,
   * and a change means the list this hook was tracking has been replaced.
   *
   * Pass a constant from a screen that only ever mounts one list.
   */
  surface: unknown;
}

interface UseScrollDirectionReturn {
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  isVisible: SharedValue<number>;
}

/**
 * Tracks scroll direction and provides an animated visibility value.
 * - Scrolling DOWN hides (isVisible = 0)
 * - Scrolling UP shows (isVisible = 1)
 * - Arriving at the top shows, whatever the direction
 * - Swapping the mounted surface shows, and forgets the old list
 *
 * Uses a threshold to prevent jitter from minor scroll fluctuations.
 * Uses regular JS callback instead of worklet for FlashList compatibility.
 *
 * ⚠ The three pieces of state below must move TOGETHER. `isVisible` is what
 * the user sees, but `previousScrollY` and `direction` are what decide the
 * next move, and a reset that touches only the first leaves the hook
 * describing a list that no longer exists. See the surface-change effect at
 * the foot of the hook.
 */
export function useScrollDirection({
  surface,
}: UseScrollDirectionOptions): UseScrollDirectionReturn {
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
          isVisible.set(
            withTiming(newDirection === 'up' ? 1 : 0, {
              duration: ANIMATION_DURATION,
            }),
          );
        }
      }

      // Always show when at the top
      if (currentY <= 0 && isVisible.get() !== 1) {
        isVisible.set(withTiming(1, { duration: ANIMATION_DURATION }));
        direction.current = 'idle';
      }

      previousScrollY.current = currentY;
    },
    [isVisible],
  );

  /*
   * A view switch replaces the list, and the incoming one mounts at the top.
   * Show the bar and forget everything the outgoing list taught us.
   *
   * ── Why this has to exist at all ──
   *
   * A TAB change already behaves correctly, and it gets there without this
   * hook's help: `useResetScrollOnTabChange` (installed inside each list)
   * calls `scrollToOffset({ offset: 0 })`, the list emits a scroll event at
   * y=0, and the "always show when at the top" branch above reveals the bar.
   * The reveal is a side effect of the LIST MOVING.
   *
   * On a view switch no list moves -- one unmounts and another mounts already
   * at 0 -- so no scroll event is ever emitted. Worse, that hook's own
   * first-render guard is back to `true` on the fresh mount, so it does not
   * scroll either. Meanwhile `isVisible` lives on the screen, outside the
   * `toggleView` conditionals, and survives with the outgoing list's hidden
   * state intact. The bar stays translated off-screen above a spacer that
   * still reserves its height: a blank gap, and on a list too short to scroll,
   * no gesture that can bring it back.
   *
   * ⚠ All three assignments are load-bearing. `previousScrollY` still holds
   * the OLD list's offset, so leaving it makes the new list's first gesture
   * compute a delta against a position it was never at -- a scroll to 100 on a
   * list really at 0 reads as a delta of zero, clears no threshold, and the
   * bar refuses to hide. `direction` is what the threshold branch compares
   * against, so a stale 'down' swallows the first genuine downward scroll.
   * Writing `1` to `isVisible` alone LOOKS fixed and is not.
   */
  const isFirstSurface = useRef(true);
  useEffect(() => {
    // The first surface is the mount, where the bar is already visible and the
    // list is already at the top. Only a CHANGE is a switch.
    if (isFirstSurface.current) {
      isFirstSurface.current = false;
      return;
    }
    previousScrollY.current = 0;
    direction.current = 'idle';
    // Animated, not instant: the bar SLIDES in, matching what a tab change
    // already does. Both go through withTiming at the same duration.
    isVisible.set(withTiming(1, { duration: ANIMATION_DURATION }));
  }, [surface, isVisible]);

  return { onScroll, isVisible };
}
