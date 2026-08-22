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
 * ⚠ Three RNTL 14 traps, all of which fail QUIETLY. Read before adding a suite.
 *
 * 1. `renderHook`, `rerender` and `unmount` are all ASYNC. A missing `await`
 *    does not throw -- the assertion just runs before the render it meant to
 *    observe.
 * 2. `jest.useFakeTimers()` BREAKS the async render: `rerender` returns, but
 *    the effect never re-runs, so a test asserting "was called" fails with
 *    zero calls and a test asserting "was not called" passes for the wrong
 *    reason. Use real timers and `settle()` below.
 * 3. The environment's `requestAnimationFrame` is `setTimeout(fn, 0)` under
 *    the RN preset, so a frame this hook defers is ALREADY DUE the instant it
 *    is scheduled and fires inside whichever `await` comes next. A test that
 *    wanted the frame still pending -- the unmount case below -- therefore
 *    raced the event loop and failed roughly one full-suite run in ten, only
 *    ever in company with other suites, because worker contention is what let
 *    the timer win. `installFrameQueue()` replaces rAF for this file so a
 *    deferred frame runs when the TEST says and never in between.
 */

/** The narrow slice of the list surface this hook actually drives. */
function fakeListRef() {
  const scrollToOffset = jest.fn();
  return { ref: { current: { scrollToOffset } }, scrollToOffset };
}

type FrameCallback = FrameRequestCallback;

/**
 * A manual frame queue standing in for the environment's rAF, installed per
 * test and torn down after it.
 *
 * ⚠ This is NOT `jest.useFakeTimers()`, which trap 2 forbids: timers stay
 * real, so RNTL's async render is untouched. Only the two frame functions are
 * swapped, and only for this file.
 *
 * What it buys is the difference between pinning cancellation DIRECTLY and
 * pinning it by absence. `pending()` reads the queue, so the unmount test can
 * assert the frame existed, then assert it is gone -- neither of which depends
 * on how fast the machine ran.
 */
function installFrameQueue() {
  const pending = new Map<number, FrameCallback>();
  let nextHandle = 1;
  const realRequest = globalThis.requestAnimationFrame;
  const realCancel = globalThis.cancelAnimationFrame;

  globalThis.requestAnimationFrame = ((callback: FrameCallback) => {
    const handle = nextHandle++;
    pending.set(handle, callback);
    return handle;
  }) as typeof requestAnimationFrame;

  globalThis.cancelAnimationFrame = ((handle: number) => {
    pending.delete(handle);
  }) as typeof cancelAnimationFrame;

  return {
    /** How many frames are scheduled and not yet run or cancelled. */
    pending: () => pending.size,
    /** Run every scheduled frame, in the order it was scheduled. */
    async drain() {
      const due = [...pending.values()];
      pending.clear();
      await act(async () => {
        for (const callback of due) callback(0);
      });
    },
    restore() {
      globalThis.requestAnimationFrame = realRequest;
      globalThis.cancelAnimationFrame = realCancel;
    },
  };
}

let frames: ReturnType<typeof installFrameQueue>;

beforeEach(() => {
  frames = installFrameQueue();
});

afterEach(() => {
  frames.restore();
});

/** Let React commit. The hook's deferred frame is driven separately now. */
function settle() {
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
  await settle();
  return { ...view, scrollToOffset };
}

describe('useResetScrollOnTabChange', () => {
  it('does not scroll on the first render, where the list is already at the top', async () => {
    const { scrollToOffset } = await renderAtFirstTab();

    // The guard skips the frame entirely rather than scheduling one that
    // scrolls to an offset the list is already at.
    expect(frames.pending()).toBe(0);
    await frames.drain();

    expect(scrollToOffset).not.toHaveBeenCalled();
  });

  it('scrolls to the top when the tab changes', async () => {
    const { rerender, scrollToOffset } = await renderAtFirstTab();

    await rerender({ tab: CustomTabs.Started });
    await settle();
    await frames.drain();

    expect(scrollToOffset).toHaveBeenCalledTimes(1);
  });

  it('scrolls INSTANTLY -- animated:false is the §I3 invariant, not a preference', async () => {
    const { rerender, scrollToOffset } = await renderAtFirstTab();

    await rerender({ tab: CustomTabs.Started });
    await settle();
    await frames.drain();

    // An animated scroll emits onMomentumScrollEnd, which is the ladder's
    // collapse-sweep trigger. This assertion is what stops that regression.
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: false });
  });

  it('cancels the pending frame on unmount rather than scrolling a dead list', async () => {
    const { rerender, unmount, scrollToOffset } = await renderAtFirstTab();

    await rerender({ tab: CustomTabs.Started });
    await settle();
    // The frame the tab change scheduled, still queued: without this the test
    // below could pass because nothing was ever scheduled.
    expect(frames.pending()).toBe(1);

    await unmount();

    // Cancellation asserted DIRECTLY -- the queue is empty because cleanup
    // called `cancelAnimationFrame`, not because the frame never came due.
    expect(frames.pending()).toBe(0);
    await frames.drain();
    expect(scrollToOffset).not.toHaveBeenCalled();
  });
});
