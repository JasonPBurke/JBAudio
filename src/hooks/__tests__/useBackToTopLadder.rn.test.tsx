import { useEffect as mockUseEffect } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import * as Sentry from '@sentry/react-native';

import { useBackToTopLadder } from '@/hooks/useBackToTopLadder';
import type { LadderView } from '@/helpers/ladderDecisions';

/**
 * The ladder hook's `rn`-lane suite.
 *
 * `decideBackPress` already has 18 tests and proves the JUDGEMENT. This suite
 * proves the GATHER and EXECUTE halves wrapped around it -- the wiring the pure
 * suite structurally cannot see, because it only ever receives a snapshot
 * someone else built.
 *
 * ⚠ The list is a FAKE, deliberately, and a real FlashList must not be
 * substituted here. It has no layout manager under jest, so
 * `computeVisibleIndices()` throws -- which is the same fact spec §B7 is built
 * on, and the fact this suite's containment test exercises on purpose.
 *
 * ⚠ Two RNTL 14 traps, both silent: `renderHook`/`rerender`/`unmount` are all
 * ASYNC (a missing `await` just asserts too early), and `jest.useFakeTimers()`
 * breaks the async render outright. Real timers only.
 */

/**
 * `useFocusEffect` and `useDrawerStatus` both need a live navigation tree.
 * Modelling focus as mount/unmount is enough for everything asserted here --
 * what the handler DOES, and that it is installed once and removed on cleanup.
 * That the effect is scoped to focus rather than to mount is a navigation fact
 * this lane cannot reach; it is covered by the device pass.
 */
jest.mock('@react-navigation/native', () => ({
  // `mock`-prefixed so babel-plugin-jest-hoist allows the reference out of the
  // hoisted factory; a plain `useEffect` import is rejected there.
  useFocusEffect: (effect: () => void) => mockUseEffect(effect, [effect]),
}));

let mockDrawerStatus: 'open' | 'closed' = 'closed';
jest.mock('@react-navigation/drawer', () => ({
  useDrawerStatus: () => mockDrawerStatus,
}));

/** The slice of the list surface the ladder actually drives. */
function fakeList(offset: number, overrides: Record<string, unknown> = {}) {
  return {
    getAbsoluteLastScrollOffset: jest.fn(() => offset),
    getFirstItemOffset: jest.fn(() => 38),
    computeVisibleIndices: jest.fn(() => ({ startIndex: 0, endIndex: 5 })),
    getLayout: jest.fn(() => ({ y: 0 })),
    scrollToOffset: jest.fn(),
    ...overrides,
  };
}

type ListFake = ReturnType<typeof fakeList>;

/**
 * Render the hook and hand back the handler it registered, so a test can press
 * back by calling it and read the boolean it returns -- which is the whole of
 * the hook's contract with Android: `true` consumes, `false` declines.
 *
 * ⚠ The ref object is created ONCE and reused across rerenders, because that is
 * what the library screen does (`useRef`). Building a fresh `{ current }` per
 * render instead makes the hook re-register on every render and the
 * registration assertions below fail -- correctly, since that would be a real
 * §A6 violation at any call site that did it.
 */
async function mountLadder({
  view = 'seriesHome' as LadderView,
  list,
}: {
  view?: LadderView;
  list: ListFake | null;
}) {
  const registered = jest.spyOn(BackHandler, 'addEventListener');
  const listRef = { current: list };
  const rendered = await renderHook(
    (props: { view: LadderView }) =>
      useBackToTopLadder({ listRef: listRef as never, view: props.view }),
    { initialProps: { view } },
  );

  const press = async () => {
    // The most recent registration is the live one; how MANY there are is
    // asserted separately.
    const handler = registered.mock.calls.at(-1)![1];
    let consumed: boolean | null | undefined;
    await act(async () => {
      consumed = handler();
    });
    return consumed;
  };

  return { ...rendered, registered, press, listRef };
}

beforeEach(() => {
  mockDrawerStatus = 'closed';
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('useBackToTopLadder — the master rung', () => {
  it('scrolls a scrolled list to the top, animated, and consumes the press', async () => {
    const list = fakeList(4000);

    const { press } = await mountLadder({ list });

    expect(await press()).toBe(true);
    expect(list.scrollToOffset).toHaveBeenCalledWith({
      offset: 0,
      animated: true,
    });
  });

  it('declines at the top so ONE press backgrounds the app, never two', async () => {
    // `firstItemOffset` is 38 on this fake: at rest the list reads 0, which is
    // at-top. An empty tab and a no-results search are this same state.
    const list = fakeList(0);

    const { press } = await mountLadder({ list });

    expect(await press()).toBe(false);
    expect(list.scrollToOffset).not.toHaveBeenCalled();
  });

  it('declines when no list is mounted', async () => {
    const { press } = await mountLadder({ list: null });

    expect(await press()).toBe(false);
    // ⚠ Load-bearing. Without it this test passes for the wrong reason if the
    // hook fabricates a snapshot for the no-list case: the fabricated read
    // throws, containment catches it, and back declines anyway. "No list" is a
    // NORMAL state that the decision handles, not an error that containment
    // mops up, and this is the only observable that tells the two apart.
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('declines while the drawer is open, and moves nothing', async () => {
    mockDrawerStatus = 'open';
    const list = fakeList(4000);

    const { press } = await mountLadder({ list });

    expect(await press()).toBe(false);
    expect(list.scrollToOffset).not.toHaveBeenCalled();
  });
});

describe('useBackToTopLadder — gathering the snapshot', () => {
  it('reads the offset from the ref at PRESS time, not at render time', async () => {
    // §J3: a screen-tracked offset goes stale across a view toggle. Here the
    // list is scrolled AFTER the hook rendered at the top; the press must still
    // see the new offset and fire.
    let offset = 0;
    const list = fakeList(0, {
      getAbsoluteLastScrollOffset: jest.fn(() => offset),
    });

    const { press } = await mountLadder({ list });
    offset = 4000;

    expect(await press()).toBe(true);
    expect(list.scrollToOffset).toHaveBeenCalledWith({
      offset: 0,
      animated: true,
    });
  });

  it('passes `visible` lazily — an at-top press never reaches the throwing accessor', async () => {
    // §B7: `computeVisibleIndices()` throws with no layout manager, and the
    // offset predicate is what keeps it out of reach. A snapshot that evaluated
    // it eagerly would throw here, and no test in the decision's own suite
    // could catch that -- it only ever sees the thunk it is handed.
    const list = fakeList(0);

    const { press } = await mountLadder({ view: 'booksHome', list });

    expect(await press()).toBe(false);
    expect(list.computeVisibleIndices).not.toHaveBeenCalled();
  });

  it('contains a throw from the visibility accessor by DECLINING, never by landing on a rung', async () => {
    const boom = new Error('no layout manager');
    const list = fakeList(4000, {
      computeVisibleIndices: jest.fn(() => {
        throw boom;
      }),
    });

    const { press } = await mountLadder({ view: 'booksHome', list });

    // Back means exactly what it meant before this feature existed.
    expect(await press()).toBe(false);
    // ⚠ The failure this asserts against is a SILENT one: falling through to
    // master top would look right and be wrong (§H5, §F8).
    expect(list.scrollToOffset).not.toHaveBeenCalled();
    // Contained is not the same as swallowed.
    expect(Sentry.captureException).toHaveBeenCalledWith(boom);
  });
});

describe('useBackToTopLadder — registration', () => {
  it('installs exactly one handler per focus', async () => {
    const { registered } = await mountLadder({ list: fakeList(4000) });

    expect(registered).toHaveBeenCalledTimes(1);
    expect(registered.mock.calls[0][0]).toBe('hardwareBackPress');
  });

  it('does NOT re-register when its inputs change', async () => {
    // §A6: `BackHandler` dispatches strict LIFO BY REGISTRATION TIME, so a
    // handler that re-registered while the drawer was open would sit above the
    // drawer's own and scroll the list instead of closing the drawer.
    const list = fakeList(4000);
    const { rerender, registered, listRef } = await mountLadder({ list });

    mockDrawerStatus = 'open';
    await rerender({ view: 'booksHome' });
    listRef.current = fakeList(10);
    await rerender({ view: 'booksGrid' });

    expect(registered).toHaveBeenCalledTimes(1);
  });

  it('still sees changed inputs through its mirror ref', async () => {
    // The other half of the test above: registering once must not mean acting
    // on stale inputs. The drawer guard is the observable, since it is the one
    // input that flips a press from consuming to declining.
    const list = fakeList(4000);
    const { rerender, press } = await mountLadder({ list });

    mockDrawerStatus = 'open';
    await rerender({ view: 'seriesHome' });

    expect(await press()).toBe(false);
    expect(list.scrollToOffset).not.toHaveBeenCalled();
  });

  it('removes the handler on cleanup, so a blurred screen has no ladder', async () => {
    const remove = jest.fn();
    jest
      .spyOn(BackHandler, 'addEventListener')
      .mockReturnValue({ remove } as never);

    const { unmount } = await renderHook(() =>
      useBackToTopLadder({
        listRef: { current: fakeList(4000) } as never,
        view: 'seriesHome',
      }),
    );
    await unmount();

    expect(remove).toHaveBeenCalledTimes(1);
  });
});
