import {
  useCallback,
  useLayoutEffect,
  useRef,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import { BackHandler } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useDrawerStatus } from '@react-navigation/drawer';
import { useFocusEffect } from '@react-navigation/native';
import * as Sentry from '@sentry/react-native';

import {
  decideBackPress,
  decideSweep,
  type LadderSnapshot,
  type LadderView,
  type SectionRange,
} from '@/helpers/ladderDecisions';
import type { LadderList } from '@/types/ladderList';

/**
 * The back-to-top ladder, installed by the library screen (spec §J1).
 *
 * IO only -- gather, decide, execute. It reads a snapshot from the mounted
 * list's ref at the moment of the event, hands it to the already-tested
 * decision, and carries out whatever comes back. It adds no judgement of its
 * own.
 *
 * Two events reach it, and they share the gather step exactly: a BACK PRESS,
 * which it answers with a scroll or by declining, and a SETTLE -- the two
 * handlers it returns for the screen to thread into every list -- which it
 * answers with the collapse sweep.
 *
 * ⚠ It also holds NO STATE between presses (§C3/§I6): no counter, no timer, no
 * "which rung was last" memory. Every press re-derives its answer from the live
 * scroll offset and the live layout, which is what makes the ladder
 * self-healing when the user scrolls by hand between presses, toggles the view,
 * or lets the library rescan under them. A press counter would be the obvious
 * way to build this and it is a redesign of the ladder's core property, not an
 * addition to it.
 */

/** The mutable inputs the handler reads, mirrored so it never re-registers. */
type LadderInputs = {
  view: LadderView;
  drawerOpen: boolean;
  expanded: Set<string>;
  setExpanded: Dispatch<SetStateAction<Set<string>>>;
};

export type UseBackToTopLadderParams = {
  /** The ONE ref the library screen owns, per §H6/§I1. */
  listRef: RefObject<LadderList | null>;
  /** A NAMED view (§H1), never the toggle's 0/1/2 ordinal. */
  view: LadderView;
  /**
   * The sectioned view's index ranges, owned by the screen and written by the
   * mounted list from a layout effect (§H4/§H5).
   *
   * ⚠ A REF rather than a value, and this is the ONE deliberate exception to
   * §J2's "callers pass ordinary values". The publication path exists precisely
   * so it does NOT re-render the screen -- the library store emits mid-scan and
   * a re-render per emission is what holding ranges in state would cost. A
   * value would therefore only refresh on some LATER unrelated render, which
   * may never come, and the mirror would sit stale for exactly as long as the
   * ranges mattered.
   *
   * ⚠ It is never emptied on a view toggle. On another view these indices
   * describe the WRONG list, and §H2's identity gate inside `decideBackPress`
   * is the only thing that disarms them (§R5).
   */
  sectionRangesRef: RefObject<SectionRange[]>;
  /**
   * The expanded-section set. An ordinary value, per §J2: it is screen state,
   * so every change already re-renders the screen and the mirror below cannot
   * fall behind it.
   */
  expanded: Set<string>;
  /**
   * The expanded-section setter, called by the collapse sweep and by nothing
   * else. The sweep hands it `decideSweep`'s `open` set DIRECTLY -- see the
   * sweep below for why it must not be copied on the way through.
   */
  setExpanded: Dispatch<SetStateAction<Set<string>>>;
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
function buildSnapshot(
  list: LadderList,
  inputs: LadderInputs,
  /*
   * ⚠ A THIRD ARGUMENT rather than a field of `LadderInputs`, deliberately, and
   * a review has already proposed folding it in as an obvious tidy-up. It must
   * not be: `LadderInputs` is the RENDER-TIME mirror, and the ranges are the one
   * input that must NOT be captured at render time -- they are published without
   * re-rendering the screen, so a mirrored copy would be stale for exactly as
   * long as it mattered. The separate parameter is what makes that visible at
   * every call site, and a test fails if the mirror is used instead.
   */
  ranges: SectionRange[],
): LadderSnapshot {
  return {
    view: inputs.view,
    drawerOpen: inputs.drawerOpen,
    offset: list.getAbsoluteLastScrollOffset(),
    firstItemOffset: list.getFirstItemOffset(),
    expanded: inputs.expanded,
    ranges,
    visible: () => list.computeVisibleIndices(),
    // The RAW layout `y`, handed over untouched: §D2's arithmetic lives at the
    // decision that turns it into a landing offset, not here.
    layoutY: (index) => list.getLayout(index)?.y,
  };
}

export function useBackToTopLadder({
  listRef,
  view,
  sectionRangesRef,
  expanded,
  setExpanded,
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
  const inputsRef = useRef<LadderInputs>({
    view,
    drawerOpen,
    expanded,
    setExpanded,
  });
  useLayoutEffect(() => {
    inputsRef.current = { view, drawerOpen, expanded, setExpanded };
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
        list
          ? buildSnapshot(list, inputsRef.current, sectionRangesRef.current)
          : null,
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
  }, [listRef, sectionRangesRef]);

  /**
   * The collapse sweep -- §F1/§F3. Gather, decide, execute, exactly as the back
   * press does, and the ONLY reason this is a second function rather than a
   * second branch of one is that a wrong landing and a wrong collapse are
   * different failures (§J4).
   *
   * ⚠ It runs ONLY on an event that PROVES the list has settled at the top.
   * Never before the jump, never after issuing it. Both of those are the same
   * bug (§F2): `computeVisibleIndices()` is a pure function of the last
   * OBSERVED scroll offset, so sampling it right after a scroll is issued
   * returns the PRE-JUMP viewport -- plausible data, not an error, so nothing
   * downstream can detect it. That is also why `visible` stays a thunk built by
   * `buildSnapshot` and is never pre-computed here.
   *
   * ⚠ No try/catch, and that is not an oversight -- it is the asymmetry with
   * the back handler above. There, containment exists because a press can land
   * at any moment and §B7's protection of the throwing accessor is reasoned
   * rather than measured. Here the TRIGGER ITSELF is the proof: a momentum or
   * drag end cannot fire on a list that never scrolled, and a list that
   * scrolled has a layout manager. A `catch` would also have nothing safe to
   * do -- declining a press restores the pre-feature behaviour, while
   * swallowing a failed sweep just loses the gesture silently.
   */
  const sweep = useCallback(
    (trigger: 'momentum' | 'drag', velocityY?: number) => {
      const list = listRef.current;
      if (list === null) return;

      const inputs = inputsRef.current;
      const decision = decideSweep(
        buildSnapshot(list, inputs, sectionRangesRef.current),
        trigger,
        velocityY,
      );
      if (decision.kind !== 'collapse') return;

      /*
       * ⚠ §G1/§G2 -- THE MVCP ANCHOR FIX. This looks like a no-op and is not;
       * it is exactly the kind of line a future cleanup deletes.
       *
       * The sweep fires on the NATIVE momentum end, while FlashList re-anchors
       * MVCP on its own 100 ms scroll-idle debounce that every scroll event
       * during the jump keeps resetting. So at this instant the anchor is still
       * a PRE-JUMP item deep in the list. Mutate the data now and MVCP re-finds
       * it, sees the content above it has shrunk, and issues `scrollBy(diff)`
       * -- moving the list back OFF the top. Proven to the pixel on device: the
       * correction's `diff` equalled the resting drift exactly in all three
       * reproductions (-978.55, -1803.89, -617.20 px). A/B: fix off, 4 of 6
       * jumps drifted; fix on, 0 of 20.
       *
       * Both signs of that drift are bad. A positive one leaves the list not
       * at-top, so back stops backgrounding the app; a negative one keeps
       * at-top true but makes the NEXT sweep run at a negative offset with an
       * empty visible set, which is §F8's collapse-everything.
       *
       * ⚠ ARMED ONLY WHEN A MUTATION IS ACTUALLY COMING, and that condition is
       * not tidiness -- it is what stops the fix leaking. The flag FlashList
       * sets here is cleared in `onCommitEffect`, i.e. by a COMMIT rather than
       * by time. When nothing drops, `decideSweep` returns the SAME set
       * reference, React bails out, no commit follows, and an unconditional
       * call would leave the flag armed until some LATER, unrelated commit --
       * swallowing that commit's correction instead of this one's. The
       * no-drop arrival is the common case, not a corner: a bounce at the top
       * with only Recents open reaches here every time.
       *
       * Skipping it there is safe for a checkable reason: nothing dropped
       * means the data is unchanged, so MVCP's `diff` is 0 and there is no
       * correction to suppress even if React does render. No timer, no
       * constant, no state.
       */
      if (decision.open !== inputs.expanded) {
        list.prepareForLayoutAnimationRender();
      }

      /*
       * ⚠ Handed over as-is. `decideSweep` returns the SAME reference it was
       * given whenever nothing drops, which is what makes an accepted
       * bounce-sweep (§F5) free: React bails out of the re-render entirely.
       * A spread, a copy or a `new Set(...)` anywhere on this line discards
       * that bail-out silently and costs a full re-render of a 355-book list.
       */
      inputs.setExpanded(decision.open);
    },
    [listRef, sectionRangesRef],
  );

  /*
   * §F3 -- trigger 1, and the back jump's own arrival event (§E2): an animated
   * programmatic scroll emits this by itself, so the jump needs no arrival
   * machinery. Interruption needs none either (§E3) -- the fling animator
   * dispatches momentum-end on CANCEL too, at a non-top offset, where the
   * at-top gate makes it a no-op.
   *
   * ⚠ The trigger passed here is what selects the velocity gate, and `'drag'`
   * in this call would silently disable the sweep on every momentum arrival --
   * a momentum end reports no velocity, and `decideSweep` classifies an absent
   * one as flinging. The ruling lives there; this is only the call site that
   * must not misreport which event it is.
   */
  const onMomentumScrollEnd = useCallback(() => {
    sweep('momentum');
  }, [sweep]);

  /*
   * §F3 -- trigger 2, gated on velocity. The gate itself lives in `decideSweep`
   * and this handler's ONE job is to hand it the number the platform actually
   * reported.
   *
   * ⚠ `velocity` is optional on the event and the value is passed through
   * UNTOUCHED -- no `?? 0` default. §F5's amendment makes an unreported
   * velocity count as FLINGING, and defaulting it to 0 here would quietly
   * reverse that ruling from the one place the decision cannot see. Dropping
   * the value entirely fails the other way: every settled drag would read as a
   * fling and the trigger would never sweep.
   */
  const onScrollEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      sweep('drag', e.nativeEvent.velocity?.y);
    },
    [sweep],
  );

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

  /*
   * §J1 -- the two settle handlers the screen threads into whichever list is
   * mounted. They are the ladder's ONLY per-view wiring: §H9 keeps `onScroll`
   * out of the contract, so the screen's own scroll handler stays uncomposed
   * and the ladder never sits in the per-frame path.
   */
  return { onMomentumScrollEnd, onScrollEndDrag };
}
