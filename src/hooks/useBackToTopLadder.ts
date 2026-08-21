import {
  useCallback,
  useLayoutEffect,
  useRef,
  type RefObject,
} from 'react';
import { BackHandler } from 'react-native';
import { useDrawerStatus } from '@react-navigation/drawer';
import { useFocusEffect } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';

import {
  decideBackPress,
  type LadderSnapshot,
  type LadderView,
  type SectionRange,
} from '@/helpers/ladderDecisions';
import type { LadderList } from '@/types/ladderList';

/**
 * The back-to-top ladder, installed by the library screen (spec §J1).
 *
 * IO only -- gather, decide, execute. It reads a snapshot from the mounted
 * list's ref at press time, hands it to the already-tested `decideBackPress`,
 * and carries out whatever comes back. It adds no judgement of its own.
 *
 * ⚠ It also holds NO STATE between presses (§C3/§I6): no counter, no timer, no
 * "which rung was last" memory. Every press re-derives its answer from the live
 * scroll offset and the live layout, which is what makes the ladder
 * self-healing when the user scrolls by hand between presses, toggles the view,
 * or lets the library rescan under them. A press counter would be the obvious
 * way to build this and it is a redesign of the ladder's core property, not an
 * addition to it.
 */

/**
 * Section ranges and the expanded-section set, absent until the sectioned
 * rung and the collapse sweep arrive.
 *
 * With no ranges, `decideBackPress` finds no section containing the viewport
 * top and every armed press falls through to master top -- which IS the
 * two-rung ladder, on every view including `booksHome`. Module scope so the
 * snapshot does not allocate a set and an array on each press.
 */
const NO_RANGES: SectionRange[] = [];
const NO_EXPANDED = new Set<string>();

/** The mutable inputs the handler reads, mirrored so it never re-registers. */
type LadderInputs = {
  view: LadderView;
  drawerOpen: boolean;
};

export type UseBackToTopLadderParams = {
  /** The ONE ref the library screen owns, per §H6/§I1. */
  listRef: RefObject<LadderList | null>;
  /** A NAMED view (§H1), never the toggle's 0/1/2 ordinal. */
  view: LadderView;
};

/**
 * Read the list's live state into the shape the decision takes.
 *
 * ⚠ `visible` is a THUNK and must stay one. `computeVisibleIndices()` throws
 * when the list has no layout manager, and the decision's contract is that it
 * is not called until the offset predicate has passed (§B7). Evaluating it
 * eagerly here would reintroduce that throw on every press -- and no test in
 * the decision's own suite could catch it, because that suite only ever sees
 * the thunk it is handed.
 */
function buildSnapshot(list: LadderList, inputs: LadderInputs): LadderSnapshot {
  return {
    view: inputs.view,
    drawerOpen: inputs.drawerOpen,
    offset: list.getAbsoluteLastScrollOffset(),
    firstItemOffset: list.getFirstItemOffset(),
    expanded: NO_EXPANDED,
    ranges: NO_RANGES,
    visible: () => list.computeVisibleIndices(),
    layoutY: (index) => list.getLayout(index)?.y,
  };
}

export function useBackToTopLadder({
  listRef,
  view,
}: UseBackToTopLadderParams) {
  /*
   * §A7 -- defence in depth, and ONLY that. On device the drawer consumes back
   * upstream in React Navigation and this handler is never reached at all; the
   * same is true of the IME. The guard is one comparison and it makes the hook
   * self-contained, so it stays -- but it is NOT the thing that makes the
   * drawer case work, and must not be described as such.
   */
  const drawerOpen = useDrawerStatus() === 'open';

  /*
   * §J2 -- every mutable input is mirrored into a ref INTERNALLY, so callers
   * pass ordinary values and this module itself guarantees §A6's
   * empty-dependency registration rather than leaving it to call-site
   * discipline a later edit can quietly break.
   *
   * ⚠ That registration being stable is load-bearing, not tidiness:
   * `BackHandler` dispatches strict LIFO BY REGISTRATION TIME, so a handler
   * that re-registered while the drawer was open would sit ABOVE the drawer's
   * own handler and scroll the list instead of closing the drawer.
   *
   * One effect with no dependency array, rather than one per input: it runs
   * after every commit, so the mirror cannot fall out of step with a new input
   * someone adds later and forgets to list.
   *
   * A LAYOUT effect, not a passive one. A passive effect runs after paint,
   * leaving a frame-wide window in which the screen shows the new view while
   * the handler still reads the old one -- and a back press can land in that
   * window. It costs nothing to close.
   */
  const inputsRef = useRef<LadderInputs>({ view, drawerOpen });
  useLayoutEffect(() => {
    inputsRef.current = { view, drawerOpen };
  });

  const onBackPress = useCallback(() => {
    try {
      /*
       * §J3 -- read the offset SYNCHRONOUSLY from the mounted list's ref, at
       * the moment of the decision. A screen-tracked scroll offset goes stale
       * across a view toggle (the old list unmounts, the new one mounts at
       * offset 0, and NO scroll event fires), so the first press would consume
       * itself scrolling an already-at-top list to the top: nothing visible
       * happens and the app does not background.
       */
      const list = listRef.current;
      const decision = decideBackPress(
        list ? buildSnapshot(list, inputsRef.current) : null,
      );

      /*
       * A `scrollTo` decision can only come from a snapshot, and a snapshot can
       * only be built from a live list -- but TypeScript cannot see that
       * through the decision's discriminant, so the null check is restated.
       */
      if (decision.kind !== 'scrollTo' || list === null) return false;

      /*
       * §E1/§E2 -- the master rung is two statements: the scroll, then consume.
       * The animated jump needs no arrival machinery, because an animated
       * programmatic scroll emits `onMomentumScrollEnd` by itself.
       *
       * ⚠ §E6 -- do NOT consult `ReducedMotionConfig` here. It is Reanimated's
       * and has no path to the platform animator this scroll runs on; reduced
       * motion is handled by the OS animator scale, for free and correctly.
       */
      list.scrollToOffset({ offset: decision.offset, animated: true });
      return true;
    } catch (error) {
      /*
       * ⚠ Containment DECLINES the press. It must never fall through to a rung.
       *
       * The known candidate is `computeVisibleIndices()`, which throws when the
       * list has no layout manager. §B7 orders the offset predicate first so
       * that throw is unreachable -- but that argument needs the OFFSET to read
       * 0 as well as `firstItemOffset`, and that half is reasoned rather than
       * measured. A strong guard, not a proof, and an uncaught throw inside a
       * `BackHandler` callback is a crash on a back press.
       *
       * Declining hands control back to the system, so back backgrounds the app
       * exactly as it did before this feature existed. Swallowing the throw and
       * landing on master top instead would be the silent wrong-landing shape
       * §H5 and §F8 exist to prevent: a press that goes somewhere plausible and
       * wrong is worse than one that does what it always did.
       *
       * Reported rather than swallowed, so containment does not make a real bug
       * invisible -- the user gets the old behaviour, telemetry still gets the
       * throw.
       *
       * The `try` deliberately spans the SCROLL as well, and that is safe for a
       * checked reason rather than an assumed one: FlashList's
       * `scrollToOffset` does pure arithmetic and then dispatches
       * `scrollTo` as its LAST statement, so a call that throws has not
       * scrolled. Declining after it is therefore still exactly the
       * pre-feature behaviour. The alternative -- leaving the scroll outside
       * the guard -- turns any throw there into a crash on a back press, which
       * is the failure this whole block exists to avoid.
       */
      Sentry.captureException(error);
      return false;
    }
  }, [listRef]);

  /*
   * §A1 -- `BackHandler` inside React Navigation's `useFocusEffect`. Not
   * expo-router (it exposes no facility for this) and not native.
   *
   * §A8 comes free from the focus scoping: every modal route in this app is a
   * sibling of the drawer on the root stack, so pushing one blurs the library
   * screen, this cleanup runs, and the ladder is disarmed with no code.
   */
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        onBackPress,
      );
      return () => subscription.remove();
    }, [onBackPress]),
  );
}
