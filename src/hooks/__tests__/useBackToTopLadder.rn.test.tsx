import { useEffect as mockUseEffect, type RefObject } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import * as Sentry from '@sentry/react-native';

import { useBackToTopLadder } from '@/hooks/useBackToTopLadder';
import type { LadderView, SectionRange } from '@/helpers/ladderDecisions';
import type { LadderList } from '@/types/ladderList';

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

/**
 * The slice of the list surface the ladder actually drives.
 *
 * ⚠ Typed as a `Pick` of the real `LadderList` rather than as a free object
 * literal, so the fake's SIGNATURES stay checked against FlashList's own. That
 * is what stops the fake drifting into a shape the real list never has --
 * `getLayout` returning a bare `{ y }` compiles happily on an untyped fake and
 * would let a test pass against a return value that cannot occur. The section
 * rung reads exactly that `y`.
 */
type ListFake = Pick<
  LadderList,
  | 'getAbsoluteLastScrollOffset'
  | 'getFirstItemOffset'
  | 'computeVisibleIndices'
  | 'getLayout'
  | 'scrollToOffset'
>;

function fakeList(offset: number, overrides: Partial<ListFake> = {}): ListFake {
  return {
    getAbsoluteLastScrollOffset: jest.fn(() => offset),
    getFirstItemOffset: jest.fn(() => 38),
    computeVisibleIndices: jest.fn(() => ({ startIndex: 0, endIndex: 5 })),
    getLayout: jest.fn(() => ({ x: 0, y: 0, width: 100, height: 100 })),
    scrollToOffset: jest.fn(),
    ...overrides,
  };
}

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
  ranges = [],
  expanded = new Set<string>(),
}: {
  view?: LadderView;
  list: ListFake | null;
  ranges?: SectionRange[];
  expanded?: Set<string>;
}) {
  const registered = jest.spyOn(BackHandler, 'addEventListener');
  const listRef: { current: ListFake | null } = { current: list };
  // A REF, exactly as the screen owns it: the sectioned list publishes into it
  // from a layout effect WITHOUT re-rendering the screen, so a test that
  // reassigns `.current` between presses is modelling the real channel.
  const sectionRangesRef: { current: SectionRange[] } = { current: ranges };
  const rendered = await renderHook(
    (props: { view: LadderView; expanded: Set<string> }) =>
      useBackToTopLadder({
        listRef: listRef as unknown as RefObject<LadderList | null>,
        view: props.view,
        sectionRangesRef,
        expanded: props.expanded,
      }),
    { initialProps: { view, expanded } },
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

  return { ...rendered, registered, press, listRef, sectionRangesRef };
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
    await rerender({ view: 'booksHome', expanded: new Set<string>() });
    listRef.current = fakeList(10);
    await rerender({ view: 'booksGrid', expanded: new Set<string>() });

    expect(registered).toHaveBeenCalledTimes(1);
  });

  it('still sees changed inputs through its mirror ref', async () => {
    // The other half of the test above: registering once must not mean acting
    // on stale inputs. The drawer guard is the observable, since it is the one
    // input that flips a press from consuming to declining.
    const list = fakeList(4000);
    const { rerender, press } = await mountLadder({ list });

    mockDrawerStatus = 'open';
    await rerender({ view: 'seriesHome', expanded: new Set<string>() });

    expect(await press()).toBe(false);
    expect(list.scrollToOffset).not.toHaveBeenCalled();
  });

  it('removes the handler on cleanup, so a blurred screen has no ladder', async () => {
    const remove = jest.fn();
    jest
      .spyOn(BackHandler, 'addEventListener')
      .mockReturnValue({ remove });

    const { unmount } = await renderHook(() =>
      useBackToTopLadder({
        listRef: { current: fakeList(4000) } as unknown as RefObject<
          LadderList | null
        >,
        view: 'seriesHome',
        sectionRangesRef: { current: [] },
        expanded: new Set<string>(),
      }),
    );
    await unmount();

    expect(remove).toHaveBeenCalledTimes(1);
  });
});

/**
 * The third rung's WIRING. `decideBackPress` already proves the rung's
 * judgement over a snapshot it is handed; what only an exercised hook can prove
 * is that the ranges and the expanded set reach that snapshot at all -- and
 * from the right channel. Ticket 05 shipped this rung already correct and
 * STARVED: the snapshot was built with an empty range list at module scope, so
 * every armed press on `booksHome` fell through to master top.
 */
describe('useBackToTopLadder — the section rung', () => {
  /** One expanded author occupying indices 10..40, its header at y = 2000. */
  const author: SectionRange = { sectionId: 'author-A', start: 10, end: 40 };
  const deepInside = () =>
    fakeList(6000, {
      computeVisibleIndices: jest.fn(() => ({ startIndex: 30, endIndex: 36 })),
      getLayout: jest.fn((index: number) => ({
        x: 0,
        y: index === 10 ? 2000 : 9999,
        width: 100,
        height: 100,
      })),
    });

  it('lands on the containing section`s header, at its PLAIN y', async () => {
    const list = deepInside();

    const { press } = await mountLadder({
      view: 'booksHome',
      list,
      ranges: [author],
      expanded: new Set(['author-A']),
    });

    expect(await press()).toBe(true);
    // ⚠ §D2 -- the header's PLAIN `y`, with no `firstItemOffset` term; the
    // argument lives at `sectionRungTarget`. This assertion discriminates only
    // because the fake's `getFirstItemOffset` returns 38: adding the term would
    // read 2038 here.
    expect(list.scrollToOffset).toHaveBeenCalledWith({
      offset: 2000,
      animated: true,
    });
  });

  it('reads the ranges from the REF at press time, not from a render', async () => {
    // §H5's channel. The sectioned list publishes into the screen's ref from a
    // layout effect and the screen does NOT re-render, so a hook that mirrored
    // the ranges into its own state or read them from a render prop would still
    // hold the empty array it mounted with -- and the rung would silently stay
    // a two-rung ladder, which is exactly the state ticket 05 shipped.
    const list = deepInside();

    const { press, sectionRangesRef } = await mountLadder({
      view: 'booksHome',
      list,
      ranges: [],
      expanded: new Set(['author-A']),
    });
    sectionRangesRef.current = [author];

    expect(await press()).toBe(true);
    expect(list.scrollToOffset).toHaveBeenCalledWith({
      offset: 2000,
      animated: true,
    });
  });

  it('sees the expanded set change through its mirror ref', async () => {
    const list = deepInside();

    const { press, rerender } = await mountLadder({
      view: 'booksHome',
      list,
      ranges: [author],
      expanded: new Set<string>(),
    });
    await rerender({ view: 'booksHome', expanded: new Set(['author-A']) });

    expect(await press()).toBe(true);
    expect(list.scrollToOffset).toHaveBeenCalledWith({
      offset: 2000,
      animated: true,
    });
  });

  it('goes to master top from inside a COLLAPSED section', async () => {
    // Story 9. The range still exists -- a collapsed section is a header plus
    // one horizontal row -- so only the expanded set tells the two apart.
    const list = deepInside();

    const { press } = await mountLadder({
      view: 'booksHome',
      list,
      ranges: [author],
      expanded: new Set<string>(),
    });

    expect(await press()).toBe(true);
    expect(list.scrollToOffset).toHaveBeenCalledWith({
      offset: 0,
      animated: true,
    });
  });

  it('IGNORES the ranges on a non-sectioned view (§R5)', async () => {
    // The ranges ref is never emptied and the expanded set persists across view
    // toggles, so on the Series view these indices describe the WRONG list. The
    // identity gate is the only thing that disarms them; without it the rung
    // would land at an arbitrary offset in a list it knows nothing about.
    const list = deepInside();

    const { press } = await mountLadder({
      view: 'seriesHome',
      list,
      ranges: [author],
      expanded: new Set(['author-A']),
    });

    expect(await press()).toBe(true);
    expect(list.scrollToOffset).toHaveBeenCalledWith({
      offset: 0,
      animated: true,
    });
  });

  it('goes to master top on the press AFTER the rung, with no state consulted', async () => {
    // Story 3 and §I6: the ladder holds nothing between presses. At the header
    // the rung's own predicate is simply false -- `offset - headerY` is 0 --
    // so the same code path that fired the rung now falls through to master.
    const list = fakeList(2000, {
      computeVisibleIndices: jest.fn(() => ({ startIndex: 10, endIndex: 16 })),
      getLayout: jest.fn(() => ({ x: 0, y: 2000, width: 100, height: 100 })),
    });

    const { press } = await mountLadder({
      view: 'booksHome',
      list,
      ranges: [author],
      expanded: new Set(['author-A']),
    });

    expect(await press()).toBe(true);
    expect(list.scrollToOffset).toHaveBeenCalledWith({
      offset: 0,
      animated: true,
    });
  });
});
