import { useEffect as mockUseEffect, type RefObject } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { BackHandler } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
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
  | 'prepareForLayoutAnimationRender'
>;

/**
 * A drag-end event carrying the vertical velocity the platform reported -- or
 * NO velocity at all, which is a state the real event admits (`velocity` is
 * optional on `NativeScrollEvent`) and which §F5's amendment rules on.
 */
const dragEndAt = (velocityY?: number) =>
  ({
    nativeEvent:
      velocityY === undefined ? {} : { velocity: { x: 0, y: velocityY } },
  }) as NativeSyntheticEvent<NativeScrollEvent>;

function fakeList(offset: number, overrides: Partial<ListFake> = {}): ListFake {
  return {
    getAbsoluteLastScrollOffset: jest.fn(() => offset),
    getFirstItemOffset: jest.fn(() => 38),
    computeVisibleIndices: jest.fn(() => ({ startIndex: 0, endIndex: 5 })),
    getLayout: jest.fn(() => ({ x: 0, y: 0, width: 100, height: 100 })),
    scrollToOffset: jest.fn(),
    prepareForLayoutAnimationRender: jest.fn(),
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
  setExpanded = jest.fn(),
}: {
  view?: LadderView;
  list: ListFake | null;
  ranges?: SectionRange[];
  expanded?: Set<string>;
  setExpanded?: jest.Mock;
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
        setExpanded,
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

  return {
    ...rendered,
    registered,
    press,
    listRef,
    sectionRangesRef,
    setExpanded,
  };
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

  it('never reaches the throwing visibility accessor on a back press, at any offset', async () => {
    // `computeVisibleIndices()` throws with no layout manager. It used to be
    // kept out of reach by §B7's ordering -- a strong guard, but a reasoned one.
    // Since the rung moved to offset space (`containingSection`) the back press
    // does not call it AT ALL, so the hazard is closed at source rather than
    // ordered around. Both offsets: at-top, which declines, and deep, which
    // takes the rung.
    for (const offset of [0, 4000]) {
      const list = fakeList(offset);

      const { press } = await mountLadder({
        view: 'booksHome',
        list,
        ranges: [{ sectionId: 'author-M', start: 10, end: 40 }],
        expanded: new Set(['author-M']),
      });

      await press();
      expect(list.computeVisibleIndices).not.toHaveBeenCalled();
    }
  });

  it('contains a throw from a layout accessor by DECLINING, never by landing on a rung', async () => {
    // ⚠ The ruling this pins is unchanged; only its subject moved. `getLayout`
    // is the accessor the rung now calls, so it is what stands in for "anything
    // on this path throws". Containment must still DECLINE: an uncaught throw
    // inside a `BackHandler` callback is a crash on a back press, and falling
    // through to master top instead would be the silent wrong-landing shape
    // §H5 and §F8 exist to prevent.
    const boom = new Error('no layout manager');
    const list = fakeList(4000, {
      getLayout: jest.fn(() => {
        throw boom;
      }),
    });

    const { press } = await mountLadder({
      view: 'booksHome',
      list,
      ranges: [{ sectionId: 'author-M', start: 10, end: 40 }],
      expanded: new Set(['author-M']),
    });

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
        setExpanded: jest.fn(),
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
    // The §R5 shape, stated once on `useBackToTopLadder`'s `sectionRangesRef`
    // parameter: on the Series view these indices describe the WRONG list.
    // What THIS case pins is the rung's half of the consequence -- without the
    // identity gate back would land at an arbitrary offset in a list it knows
    // nothing about.
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

/**
 * Apply the updater the sweep handed `setExpanded` to a caller-supplied `prev`,
 * and return what React would store.
 *
 * ⚠ The sweep writes an UPDATER, never a value (F-6), so every assertion about
 * WHAT it collapsed has to go through here. That is not ceremony: the argument
 * this indirection exists to make is that the answer depends on `prev` -- the
 * set React actually holds -- and not on the render-time mirror the hook read
 * its snapshot from. A test that could assert the set directly would be
 * asserting the bug.
 */
function sweptFrom(setExpanded: jest.Mock, prev: Set<string>, call = 0): Set<string> {
  const arg = setExpanded.mock.calls[call]?.[0] as unknown;
  if (typeof arg !== 'function') {
    throw new Error(`expected an updater at call ${call}, got ${String(arg)}`);
  }
  return (arg as (p: Set<string>) => Set<string>)(prev);
}

/**
 * The collapse sweep's WIRING -- ticket 07. `decideSweep` has 18 tests and
 * proves every gate over a snapshot it is handed; what only an exercised hook
 * can prove is that the right TRIGGER, the real VELOCITY and the SAME set
 * reference reach it, and that the anchor fix runs before the state update.
 * Each of those is invisible to the pure suite by construction.
 */
describe('useBackToTopLadder — the collapse sweep', () => {
  /** A `booksHome` resting at the top: Recents on screen, two authors below. */
  const RECENTS: SectionRange = { sectionId: 'recentlyAdded', start: 0, end: 25 };
  const AUTHOR_A: SectionRange = { sectionId: 'author-A', start: 26, end: 40 };
  const AUTHOR_B: SectionRange = { sectionId: 'author-B', start: 41, end: 60 };
  const ALL_RANGES = [RECENTS, AUTHOR_A, AUTHOR_B];

  /** Offset 0 against `firstItemOffset` 38, so the at-top gate passes. */
  const atTop = (overrides: Partial<ListFake> = {}) =>
    fakeList(0, {
      computeVisibleIndices: jest.fn(() => ({ startIndex: 0, endIndex: 5 })),
      ...overrides,
    });

  it('collapses the off-screen sections on arrival, and leaves the on-screen one open', async () => {
    const list = atTop();

    const { result, setExpanded } = await mountLadder({
      view: 'booksHome',
      list,
      ranges: ALL_RANGES,
      expanded: new Set(['recentlyAdded', 'author-A', 'author-B']),
    });
    await act(async () => {
      result.current.onMomentumScrollEnd();
    });

    expect(setExpanded).toHaveBeenCalledTimes(1);
    expect(sweptFrom(setExpanded, new Set(['recentlyAdded', 'author-A', 'author-B']))).toEqual(
      new Set(['recentlyAdded']),
    );
  });

  it('reaches the decision as a MOMENTUM trigger, not as a drag', async () => {
    // The whole assertion is that this sweeps AT ALL. A momentum end reports no
    // velocity, and §F5's amendment counts an unreported velocity as FLINGING
    // -- so a handler that passed `'drag'` here would gate every momentum
    // arrival away and the feature would be silently dead. Same-shaped inputs
    // as the test above; the trigger is the only thing under test.
    const list = atTop();

    const { result, setExpanded } = await mountLadder({
      view: 'booksHome',
      list,
      ranges: ALL_RANGES,
      expanded: new Set(['recentlyAdded', 'author-A']),
    });
    await act(async () => {
      result.current.onMomentumScrollEnd();
    });

    expect(setExpanded).toHaveBeenCalledTimes(1);
  });

  it('sweeps on a drag that ENDS at rest, passing the event`s real velocity', async () => {
    // A settled finger-lift at the top is a legitimate arrival (§F3). This is
    // the test that bites if the handler drops `velocityY` on the floor: the
    // absent value defaults to flinging, so the sweep would never run.
    const list = atTop();

    const { result, setExpanded } = await mountLadder({
      view: 'booksHome',
      list,
      ranges: ALL_RANGES,
      expanded: new Set(['recentlyAdded', 'author-A']),
    });
    await act(async () => {
      result.current.onScrollEndDrag(dragEndAt(0));
    });

    expect(setExpanded).toHaveBeenCalledTimes(1);
    expect(sweptFrom(setExpanded, new Set(['recentlyAdded', 'author-A']))).toEqual(
      new Set(['recentlyAdded']),
    );
  });

  it('does NOT sweep on a fling that leaves the top', async () => {
    // §F4, device-measured: a fling DOWN into the list is still at-top at
    // finger-lift, so the at-top gate does not exclude it -- only the velocity
    // gate does, and only if the real value reaches it. A handler that passed a
    // constant `0` would collapse the reader's sections as they fling away.
    const list = atTop();

    const { result, setExpanded } = await mountLadder({
      view: 'booksHome',
      list,
      ranges: ALL_RANGES,
      expanded: new Set(['recentlyAdded', 'author-A']),
    });
    await act(async () => {
      result.current.onScrollEndDrag(dragEndAt(-4.76));
    });

    expect(setExpanded).not.toHaveBeenCalled();
  });

  it('does NOT sweep on a drag end that reports no velocity at all', async () => {
    // §F5, amended: an UNREPORTED velocity counts as flinging, not as settled,
    // because the two errors are not symmetric -- a missed sweep is invisible
    // and the next arrival performs it anyway, while a wrong sweep destroys the
    // reader's expansions. The decision owns that ruling; this pins the wiring
    // half of it, since a `?? 0` on the way in would reverse it from the one
    // place the decision cannot see.
    const list = atTop();

    const { result, setExpanded } = await mountLadder({
      view: 'booksHome',
      list,
      ranges: ALL_RANGES,
      expanded: new Set(['recentlyAdded', 'author-A']),
    });
    await act(async () => {
      result.current.onScrollEndDrag(dragEndAt());
    });

    expect(setExpanded).not.toHaveBeenCalled();
  });

  it('hands the setter the SAME set reference when nothing drops', async () => {
    // §F5 -- the accepted bounce-sweep is free only because of this. React
    // bails out of the re-render when the next state is the same reference, so
    // a spread or a `new Set(...)` anywhere in the wiring turns every bounce at
    // the top into a full re-render of a 355-book list.
    //
    // ⚠ Asserted as reference identity, NOT as a render count: the React
    // Compiler runs in these tests and makes render counts unreliable.
    const list = atTop();
    const expanded = new Set(['recentlyAdded']);

    const { result, setExpanded } = await mountLadder({
      view: 'booksHome',
      list,
      ranges: ALL_RANGES,
      expanded,
    });
    await act(async () => {
      result.current.onMomentumScrollEnd();
    });

    expect(sweptFrom(setExpanded, expanded)).toBe(expanded);
  });

  it('does not arm the anchor suppression when nothing drops', async () => {
    // The other half of the fix, and the half that leaks if it is missed. The
    // argument is written out once, at the `prepareForLayoutAnimationRender()`
    // call in `useBackToTopLadder`: the flag is cleared by a COMMIT, a
    // same-reference set produces no commit, so an unconditional call leaks it
    // onto whatever commits next. This is the case that fails if someone
    // "simplifies" the guard away.
    const list = atTop();

    const { result, setExpanded } = await mountLadder({
      view: 'booksHome',
      list,
      ranges: ALL_RANGES,
      expanded: new Set(['recentlyAdded']),
    });
    await act(async () => {
      result.current.onMomentumScrollEnd();
    });

    expect(list.prepareForLayoutAnimationRender).not.toHaveBeenCalled();
    // ⚠ Load-bearing pairing: the sweep still RAN and still handed the set
    // over. Without this line the test also passes if the sweep declined.
    expect(setExpanded).toHaveBeenCalledTimes(1);
  });

  it('suppresses the MVCP anchor correction BEFORE it mutates the data', async () => {
    // §G1/§G2. The order is the whole fix: `prepareForLayoutAnimationRender()`
    // sets a flag FlashList checks at the `scrollBy` guard and clears on the
    // next commit, so calling it after the state update protects the wrong
    // commit -- and the list drifts back off the top.
    const order: string[] = [];
    const list = atTop({
      prepareForLayoutAnimationRender: jest.fn(() => {
        order.push('prepare');
      }),
    });
    const setExpanded = jest.fn(() => {
      order.push('setExpanded');
    });

    const { result } = await mountLadder({
      view: 'booksHome',
      list,
      ranges: ALL_RANGES,
      expanded: new Set(['recentlyAdded', 'author-A']),
      setExpanded,
    });
    await act(async () => {
      result.current.onMomentumScrollEnd();
    });

    expect(order).toEqual(['prepare', 'setExpanded']);
  });

  it('does nothing when a momentum end arrives away from the top', async () => {
    // §E3 -- touching the screen mid-jump cancels the fling, and the animator
    // dispatches momentum-end on cancel too. At a non-top offset the at-top
    // gate makes it a no-op, which is what makes interruption need no design.
    const list = fakeList(4000, {
      computeVisibleIndices: jest.fn(() => ({ startIndex: 30, endIndex: 36 })),
    });

    const { result, setExpanded } = await mountLadder({
      view: 'booksHome',
      list,
      ranges: ALL_RANGES,
      expanded: new Set(['recentlyAdded', 'author-A']),
    });
    await act(async () => {
      result.current.onMomentumScrollEnd();
    });

    expect(setExpanded).not.toHaveBeenCalled();
    // §I2 rests on the sweep never running at another offset, so the anchor
    // suppression must not fire here either -- same leak, reached from the
    // gate rather than from the no-drop case.
    expect(list.prepareForLayoutAnimationRender).not.toHaveBeenCalled();
  });

  it('never collapses anything on a non-sectioned view (§F9/§R5)', async () => {
    // The §R5 shape again (see `sectionRangesRef`), now on the sweep's side:
    // without the identity gate, arriving at the top of Series would wipe the
    // reader's BooksHome expansions.
    const list = atTop();

    const { result, setExpanded } = await mountLadder({
      view: 'seriesHome',
      list,
      ranges: ALL_RANGES,
      expanded: new Set(['recentlyAdded', 'author-A']),
    });
    await act(async () => {
      result.current.onMomentumScrollEnd();
    });

    expect(setExpanded).not.toHaveBeenCalled();
  });

  it('is idempotent — a second momentum end for the same arrival collapses nothing', async () => {
    // §E4/§I5. When back interrupts an in-flight fling, momentum-end fires
    // TWICE (the cancelled fling's animator and the programmatic scroll's), so
    // the sweep runs twice and must be harmless the second time -- which is
    // exactly the same-reference return again.
    const list = atTop();

    const { result, setExpanded, rerender } = await mountLadder({
      view: 'booksHome',
      list,
      ranges: ALL_RANGES,
      expanded: new Set(['recentlyAdded', 'author-A', 'author-B']),
    });
    await act(async () => {
      result.current.onMomentumScrollEnd();
    });
    const afterFirst = sweptFrom(setExpanded, new Set(['recentlyAdded', 'author-A', 'author-B']));
    // The screen re-renders with the swept set; the hook's mirror follows it.
    await rerender({ view: 'booksHome', expanded: afterFirst });
    await act(async () => {
      result.current.onMomentumScrollEnd();
    });

    expect(setExpanded).toHaveBeenCalledTimes(2);
    expect(sweptFrom(setExpanded, afterFirst, 1)).toBe(afterFirst);
  });

  it('re-derives from the set React HOLDS, not the mirror — a queued open survives', async () => {
    // F-6, consequence 1. The mirror is the last COMMITTED state, so a tap that
    // has queued an expansion but not yet committed is invisible to it. An
    // absolute write of the decision's `open` discards that tap: the section
    // opens and shuts again in the same frame, with no error anywhere.
    //
    // Here the viewport covers Recents AND author-A, so the tap's section is
    // on screen and nothing may drop -- which the updater can only know by
    // reading `prev`.
    const list = atTop({
      computeVisibleIndices: jest.fn(() => ({ startIndex: 0, endIndex: 30 })),
    });
    const queuedOpen = new Set(['recentlyAdded', 'author-A']);

    const { result, setExpanded } = await mountLadder({
      view: 'booksHome',
      list,
      ranges: ALL_RANGES,
      expanded: new Set(['recentlyAdded']),
    });
    await act(async () => {
      result.current.onMomentumScrollEnd();
    });

    // Same REFERENCE, not merely equal: the queued set survives untouched, so
    // React bails out and the tap's own render is the only one that happens.
    expect(sweptFrom(setExpanded, queuedOpen)).toBe(queuedOpen);
  });

  it('is idempotent WITHIN one batch — the second sweep of an arrival is a no-op', async () => {
    // F-6, consequence 2, and the half §E4 actually words: the sweep fires AT
    // LEAST ONCE per arrival and must be idempotent. Two settle events in ONE
    // React batch never see a re-render between them, so both read the same
    // stale mirror -- and two absolute writes both build a FRESH set, which
    // React cannot bail out of. The second one costs a full re-render of a
    // 355-book list for zero change.
    //
    // Chained through the updaters, exactly as React would apply them.
    const list = atTop();

    const { result, setExpanded } = await mountLadder({
      view: 'booksHome',
      list,
      ranges: ALL_RANGES,
      expanded: new Set(['recentlyAdded', 'author-A', 'author-B']),
    });
    await act(async () => {
      result.current.onMomentumScrollEnd();
      result.current.onMomentumScrollEnd();
    });

    expect(setExpanded).toHaveBeenCalledTimes(2);
    const first = sweptFrom(setExpanded, new Set(['recentlyAdded', 'author-A', 'author-B']));
    expect(first).toEqual(new Set(['recentlyAdded']));
    expect(sweptFrom(setExpanded, first, 1)).toBe(first);
  });

  it('does not sweep on mount, or on a re-render', async () => {
    // §F3 -- arriving at the top IS the collapse gesture. Mount is not that
    // gesture, and neither is a tab change: the tab-change reset scrolls
    // `animated: false`, which emits no momentum event at all (§I3).
    const list = atTop();

    const { setExpanded, rerender } = await mountLadder({
      view: 'booksHome',
      list,
      ranges: ALL_RANGES,
      expanded: new Set(['recentlyAdded', 'author-A']),
    });
    await rerender({
      view: 'booksHome',
      expanded: new Set(['recentlyAdded', 'author-A']),
    });

    expect(setExpanded).not.toHaveBeenCalled();
  });
});
