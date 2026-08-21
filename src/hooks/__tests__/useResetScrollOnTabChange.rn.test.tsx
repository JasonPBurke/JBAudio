import { act, renderHook } from '@testing-library/react-native';

import { useResetScrollOnTabChange } from '@/hooks/useResetScrollOnTabChange';
import { CustomTabs } from '@/types/CustomTabs';

/**
 * The proof test for the `rn` jest project: a real hook, really rendered,
 * driving a ref. It is not a smoke test for the preset -- it pins the one
 * invariant in this hook that had no enforcement.
 *
 * Back-ladder spec §I3 says `animated: false` here is load-bearing: an instant
 * programmatic scroll emits NO momentum events, and those events are what
 * trigger the ladder's collapse sweep. "Polishing" it to `animated: true`
 * would start collapsing every off-screen section on each tab change. Until
 * now that invariant was held by a COMMENT -- which is the class of guard this
 * feature has already twice found insufficient.
 *
 * ⚠ Two RNTL 14 traps, both of which fail QUIETLY. Read before adding a suite.
 *
 * 1. `renderHook`, `rerender` and `unmount` are all ASYNC. A missing `await`
 *    does not throw -- the assertion just runs before the render it meant to
 *    observe.
 * 2. `jest.useFakeTimers()` BREAKS the async render: `rerender` returns, but
 *    the effect never re-runs, so a test asserting "was called" fails with
 *    zero calls and a test asserting "was not called" passes for the wrong
 *    reason. Use real timers and `flushFrame()` below. This hook's
 *    `requestAnimationFrame` is `setTimeout(fn, 0)` under the RN preset, so a
 *    real zero-delay await is enough to drive it.
 */

/** The narrow slice of the list surface this hook actually drives. */
function fakeListRef() {
  const scrollToOffset = jest.fn();
  return { ref: { current: { scrollToOffset } }, scrollToOffset };
}

/** Let React commit and let the hook's deferred frame run. See trap 2 above. */
function flushFrame() {
  return act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Render at one tab and settle -- the starting state every case needs. */
async function renderAtFirstTab() {
  const { ref, scrollToOffset } = fakeListRef();
  const view = await renderHook(
    ({ tab }: { tab: CustomTabs }) => useResetScrollOnTabChange(ref, tab),
    { initialProps: { tab: CustomTabs.All } },
  );
  await flushFrame();
  return { ...view, scrollToOffset };
}

describe('useResetScrollOnTabChange', () => {
  it('does not scroll on the first render, where the list is already at the top', async () => {
    const { scrollToOffset } = await renderAtFirstTab();

    expect(scrollToOffset).not.toHaveBeenCalled();
  });

  it('scrolls to the top when the tab changes', async () => {
    const { rerender, scrollToOffset } = await renderAtFirstTab();

    await rerender({ tab: CustomTabs.Started });
    await flushFrame();

    expect(scrollToOffset).toHaveBeenCalledTimes(1);
  });

  it('scrolls INSTANTLY -- animated:false is the §I3 invariant, not a preference', async () => {
    const { rerender, scrollToOffset } = await renderAtFirstTab();

    await rerender({ tab: CustomTabs.Started });
    await flushFrame();

    // An animated scroll emits onMomentumScrollEnd, which is the ladder's
    // collapse-sweep trigger. This assertion is what stops that regression.
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: false });
  });

  it('cancels the pending frame on unmount rather than scrolling a dead list', async () => {
    const { rerender, unmount, scrollToOffset } = await renderAtFirstTab();

    await rerender({ tab: CustomTabs.Started });
    await unmount();
    await flushFrame();

    expect(scrollToOffset).not.toHaveBeenCalled();
  });
});
