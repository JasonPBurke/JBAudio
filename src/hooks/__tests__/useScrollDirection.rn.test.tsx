import { act, renderHook } from '@testing-library/react-native';

import { useScrollDirection } from '@/hooks/useScrollDirection';

/**
 * The library search bar's visibility, and the one rule it has never held:
 * a SURFACE CHANGE must bring the bar back.
 *
 * The bar is an absolutely-positioned overlay that translates itself off the
 * top of the container when `isVisible` reaches 0, and every list reserves a
 * `SEARCH_BAR_HEIGHT` spacer for it unconditionally. So when the two disagree
 * the user gets a blank gap where the bar should be -- and on a list too short
 * to scroll, no way to scroll it back.
 *
 * `useScrollDirection` is the ONLY writer of that shared value anywhere in the
 * app (verified by grep: `isVisible.set` appears twice, both in the hook). The
 * screen owns one instance of it and hands the value to `SearchBar` and
 * `CreateSeriesFab`, both of which sit OUTSIDE the `toggleView` conditionals.
 * The lists remount on a view switch; the shared value does not.
 *
 * That asymmetry is the whole bug, and it is why these cases live here rather
 * than on the screen: `LibraryScreen` imports FlashList transitively and
 * cannot be rendered under jest at all (trap 7 in
 * docs/testing/jest-projects-and-rn-tests.md). A fix wired as a screen-level
 * effect would be a fix no test in this repo can reach.
 *
 * ⚠ RNTL 14 traps in play here -- see the doc above.
 *  - `renderHook` and `rerender` are ASYNC. A missing `await` does not throw;
 *    the assertion just runs before the render it meant to observe.
 *  - No `jest.useFakeTimers()`. It breaks the async render, and a test
 *    asserting "stayed hidden" would then pass for the wrong reason.
 */

/*
 * Reanimated's shipped `/mock` re-enters the real index and dies inside
 * react-native-worklets' native half, so a suite that imports reanimated
 * carries its own stub (trap 3). Only the three APIs this hook touches.
 *
 * Two things this stub must get right or the suite proves nothing:
 *
 * 1. `useSharedValue` returns a STABLE object across renders, like the real
 *    one. A fresh `{ value }` per render would silently reset the hidden state
 *    on every rerender -- and "rerender, then assert it is still hidden" is
 *    one of the cases below.
 * 2. `withTiming(v)` resolves to `v` immediately. These tests pin WHICH target
 *    the hook asks for, not the curve it travels; the 200 ms ramp is what the
 *    user sees as "slides into view" and is not under test.
 */
jest.mock('react-native-reanimated', () => {
  // Required, not imported: a jest.mock factory is hoisted above imports.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useRef } = require('react');
  return {
    __esModule: true,
    useSharedValue: (initial: number) => {
      // No type argument: `require('react')` above is untyped, and TS rejects
      // type arguments on an untyped call (TS2347).
      const ref = useRef(null);
      if (ref.current === null) {
        ref.current = {
          value: initial,
          get() {
            return this.value;
          },
          set(v: number) {
            this.value = v;
          },
        };
      }
      return ref.current;
    },
    withTiming: (toValue: number) => toValue,
  };
});

/** The only part of a scroll event this hook reads. */
const scrollTo = (y: number) =>
  ({
    nativeEvent: { contentOffset: { y } },
  }) as Parameters<
    ReturnType<typeof useScrollDirection>['onScroll']
  >[0];

/** Let React commit, so an effect keyed on the surface has actually run. */
function settle() {
  return act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/**
 * Mount on one surface and settle. `surface` stands for whatever identifies
 * the mounted surface -- the screen passes `toggleView`.
 */
async function renderOnFirstView() {
  const view = await renderHook(
    ({ surface }: { surface: number }) => useScrollDirection({ surface }),
    { initialProps: { surface: 0 } },
  );
  await settle();
  return view;
}

/** Scroll far enough down to trip the direction change and hide the bar. */
function scrollDownToHide(onScroll: (e: ReturnType<typeof scrollTo>) => void) {
  onScroll(scrollTo(100));
}

describe('useScrollDirection', () => {
  it('starts visible', async () => {
    const { result } = await renderOnFirstView();

    expect(result.current.isVisible.get()).toBe(1);
  });

  it('hides on a downward scroll and shows again on an upward one', async () => {
    const { result } = await renderOnFirstView();

    scrollDownToHide(result.current.onScroll);
    expect(result.current.isVisible.get()).toBe(0);

    result.current.onScroll(scrollTo(40));
    expect(result.current.isVisible.get()).toBe(1);
  });

  it('reveals when a scroll lands back at the top -- the path a TAB change already takes', async () => {
    const { result } = await renderOnFirstView();
    scrollDownToHide(result.current.onScroll);

    /*
     * This is the working behaviour the fix has to match, pinned so the fix
     * can be compared against it rather than described.
     *
     * A tab change never talks to this hook. `useResetScrollOnTabChange`,
     * installed inside each list, calls `scrollToOffset({ offset: 0 })`; the
     * list emits an ordinary scroll event at y=0; and THIS branch reveals the
     * bar. The reveal is a side effect of the list moving, not of the tab
     * changing -- which is exactly why a view switch, where no list moves,
     * gets nothing.
     */
    result.current.onScroll(scrollTo(0));

    expect(result.current.isVisible.get()).toBe(1);
  });

  it('reveals when the mounted view CHANGES while the bar is hidden', async () => {
    const { result, rerender } = await renderOnFirstView();
    scrollDownToHide(result.current.onScroll);
    expect(result.current.isVisible.get()).toBe(0);

    /*
     * THE BUG. Switching BooksHome -> SeriesHome -> BooksGrid unmounts one
     * list and mounts another at offset 0, but the shared value lives on the
     * screen and survives. Nothing emits a scroll event, so before the fix
     * the bar stays translated off-screen above a spacer that still reserves
     * its height -- an unreachable search bar on any list too short to scroll.
     */
    await rerender({ surface: 1 });
    await settle();

    expect(result.current.isVisible.get()).toBe(1);
  });

  it('does NOT reveal when the screen re-renders on the same view', async () => {
    const { result, rerender } = await renderOnFirstView();
    scrollDownToHide(result.current.onScroll);

    /*
     * The guard rail on the fix. `LibraryScreen` re-renders often and for
     * reasons that have nothing to do with the surface -- the library store
     * emits on every mid-scan commit. A reveal that fires on re-render rather
     * than on CHANGE would pop the bar open under the user's thumb mid-scroll.
     */
    await rerender({ surface: 0 });
    await settle();

    expect(result.current.isVisible.get()).toBe(0);
  });

  it('tracks the FRESH list after a view change, so the first scroll down hides again', async () => {
    const { result, rerender } = await renderOnFirstView();
    scrollDownToHide(result.current.onScroll);

    await rerender({ surface: 1 });
    await settle();
    expect(result.current.isVisible.get()).toBe(1);

    /*
     * Revealing the bar is only half of it. The hook also carries the last
     * scroll offset and the last direction, and both describe a list that has
     * just been unmounted. Leaving them behind makes the incoming list's first
     * gesture read as a continuation of the outgoing one's: a scroll to y=100
     * on a list that is really at 0 computes a delta of ZERO against the stale
     * offset, clears no threshold, and the bar stays open over content the
     * user is scrolling away from.
     *
     * This case is what separates a real reset from writing `1` to the shared
     * value and calling it fixed.
     */
    result.current.onScroll(scrollTo(100));

    expect(result.current.isVisible.get()).toBe(0);
  });
});
