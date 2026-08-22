import { computeRemainingOpen } from './collapseOffscreenSections';

/**
 * The back-to-top ladder's judgement, as pure functions over a snapshot of
 * plain numbers and sets.
 *
 * The ladder's IO lives in the screen-installed hook, which is gather -> decide
 * -> execute. Everything that constitutes a *decision* lives here instead, so
 * that a WRONG LANDING and a WRONG COLLAPSE -- different failures with
 * different owners -- are each verifiable off-device, in plain numbers and
 * sets, on every commit (§J4).
 *
 * ⚠ The extraction's original second reason has EXPIRED and the reason above
 * has not: when this module was written, jest here ran on node with no React
 * Native preset, so a hook or a component could not be tested at all. The `rn`
 * lane removed that constraint (`docs/testing/jest-projects-and-rn-tests.md`)
 * and the hook now has a suite of its own. Two layers, not a replacement --
 * these units test the judgement, that suite tests the wiring.
 */

/**
 * Which library list the ladder is acting on.
 *
 * A NAME, never the view toggle's 0/1/2. That ordinal is a UI toggle position
 * rather than a view identity — it is local state, persisted nowhere, and the
 * two plausible futures for `booksList` (replacing the grid, or joining it as a
 * fourth option) are exactly the changes that renumber it.
 */
export type LadderView = 'booksHome' | 'seriesHome' | 'booksGrid' | 'booksList';

/** The index span one section occupies in a sectioned list's flattened data. */
export type SectionRange = {
  sectionId: string;
  /** index of the section's header item */
  start: number;
  /** index of the section's last item, INCLUSIVE */
  end: number;
};

export type LadderSnapshot = {
  view: LadderView;
  drawerOpen: boolean;
  offset: number;
  firstItemOffset: number;
  expanded: Set<string>;
  ranges: readonly SectionRange[];
  /**
   * LAZY, and THE SWEEP'S ALONE -- the back press never calls it.
   *
   * It throws when the list has no layout manager, so the sweep's own gates
   * (F2) are what keep it out of reach. The rung reads `ranges`/`layoutY`
   * instead, because an index sample answers in a coordinate 38 px away from
   * the one the landing uses (`containingSection`).
   */
  visible: () => { startIndex: number; endIndex: number };
  layoutY: (index: number) => number | undefined;
};

/**
 * Which views the intermediate rung and the collapse sweep are available on.
 *
 * The capability comes from view IDENTITY and is never inferred from data: the
 * expanded-section set persists across view toggles (nothing clears it), so
 * "this view has sections" cannot be read off that set being non-empty.
 */
const SECTIONED_VIEWS = new Set<LadderView>(['booksHome']);

/**
 * The tolerance, in dp, between a scroll offset and a layout `y`.
 *
 * ⚠ It does TWO jobs, and they are not the same job. `containingSection` uses
 * it to decide which header the offset is AT, and `sectionRungTarget` uses it
 * to decide the rung has nothing left to do. Both exist because `scrollTo` can
 * only rest on an integer PHYSICAL PIXEL while a layout `y` is fractional, so
 * the two numbers that D2's arithmetic says are equal never quite are. 1 dp
 * clears that quantization on any density (worst case 0.5 dp at density 1,
 * 0.14 dp at this device's 3.5), and both directions are pinned by tests --
 * narrower and the climb of D-2 returns, wider and a genuine rung 2 px below a
 * header is swallowed.
 *
 * ⚠ The second job is NOT what C1 asks for. C1 rung 2 requires the header be
 * "meaningfully above the fold", and 1 dp makes a 5 px hop qualify: back is
 * consumed for a move the reader cannot see. That is a real deviation, it is
 * recorded against ticket 08, and splitting the two roles is the fix -- but the
 * threshold for "meaningfully" is a spec decision and spec.md is signed off, so
 * it waits for the driver rather than being invented here.
 */
const SUBPIXEL_EPSILON = 1;

/**
 * Is the list at rest at visual top? ONE definition, read by both decisions --
 * the rung declines here and the sweep requires it, so they are exact
 * complements BY CONSTRUCTION rather than by two comments agreeing.
 *
 * That equivalence is load-bearing: it is what makes I2 true, because at this
 * offset no list item is above the fold, so "not visible" and "below the fold"
 * are the same set and the sweep cannot touch anything the user can see. Two
 * separately-maintained inequalities could drift into a band where the rung
 * declines and the sweep also declines, and back would do nothing at all.
 *
 * `firstItemOffset` is exactly the offset at which the first item's top reaches
 * the viewport top, so this reads literally as "is no list item above the
 * fold?". It stays an INEQUALITY: the resting offset can legitimately be
 * negative (an overscroll bounce, or briefly after a sweep), and `<=` is the
 * side every negative value falls on.
 */
function isAtTop(s: LadderSnapshot): boolean {
  return s.offset <= s.firstItemOffset;
}

/**
 * Does `r` overlap the index span `from..to`, with EVERY bound inclusive?
 *
 * The one place `end`'s inclusiveness (H4) is encoded. Any sliver counts: that
 * is the semantics the deleted viewability plumbing bought with
 * `itemVisiblePercentThreshold: 1` (F6).
 *
 * ⚠ THE SWEEP'S ALONE. The rung used to ask containment through this with a
 * degenerate one-index span, and that shared use is exactly what carried the
 * 38 px sample skew into the rung -- see `containingSection`. Both bounds are
 * pinned from either side by the sweep's two any-sliver cases; if a future
 * change leaves this with no caller, delete it rather than finding a second
 * one.
 */
function overlapsSpan(r: SectionRange, from: number, to: number): boolean {
  return r.start <= to && r.end >= from;
}

/**
 * Below this the finger-lift counts as settled rather than flung. Device-
 * measured: a fling that scrolls DOWN into the list reports -4.76 and is
 * at-top at finger-lift, so the at-top guard alone would collapse everything
 * as the user flings away. Only this gate excludes that case (F4).
 */
const SETTLED_VELOCITY_THRESHOLD = 0.01;

export type BackPressDecision =
  | { kind: 'decline'; reason: 'drawer' | 'no-list' | 'at-top' }
  | { kind: 'scrollTo'; offset: number; rung: 'section' | 'master' };

/**
 * Decide where a back press should land.
 *
 * `null` means no list is mounted. The absence of a snapshot IS the absence of
 * a list: `visible` and `layoutY` can only be built from a live ref, so a
 * snapshot cannot exist without one. A `hasList` field would instead admit the
 * impossible state of "no list" alongside a real offset and live thunks, and
 * would make the caller fabricate numbers it does not have.
 */
export function decideBackPress(s: LadderSnapshot | null): BackPressDecision {
  if (s === null) return { kind: 'decline', reason: 'no-list' };

  // The drawer consumes back upstream. Guarding here rather than at the call
  // site is what stops it being forgotten.
  if (s.drawerOpen) return { kind: 'decline', reason: 'drawer' };

  // The arm predicate, read live from the list's own ref.
  if (isAtTop(s)) return { kind: 'decline', reason: 'at-top' };

  // The rung reads `ranges`, `layoutY` and `offset` and NOTHING else. In
  // particular it does not sample visibility: `visible()` belongs to the sweep
  // alone, for the reason argued on `containingSection` below.
  const headerY = sectionRungTarget(s);
  if (headerY !== null) return { kind: 'scrollTo', offset: headerY, rung: 'section' };

  return { kind: 'scrollTo', offset: 0, rung: 'master' };
}

/**
 * The section the reader is inside, resolved in OFFSET space: the nearest
 * section header at or above the current scroll offset.
 *
 * ⚠ MEASURED IN THE SAME COORDINATE THE LANDING IS EXPRESSED IN, and that is
 * the whole point rather than an implementation detail. The obvious way to ask
 * this question is to take `visible().startIndex` and find the range containing
 * it -- and that was the original implementation, and it was WRONG on device.
 *
 * `computeVisibleIndices()` samples from `offset - firstItemOffset`
 * (`RecyclerViewManager.ts:117` hands the tracker the SUBTRACTED value, which
 * `EngagedIndicesTracker` then uses as `viewportStart`), while D2 lands the rung
 * at the header's PLAIN `y`. Those differ by exactly the list header spacer --
 * 38 px on BooksHome. So the instant a rung landed, the sample window opened
 * 38 px above that header, inside the PREVIOUS section's last item, and
 * any-sliver bounds reported that item's index.
 *
 * When the previous section was collapsed the expanded check swallowed it and
 * the press fell through to master top, which is why it looked correct for a
 * year of reading and passed 943 tests and three reviewers. With CONSECUTIVE
 * sections expanded, back climbed ONE SECTION PER PRESS: reproduced on a Pixel 7
 * Pro preview build against the real library as Aaronovitch -> Andy Weir ->
 * Agatha Christie -> master top, terminating only at the first collapsed
 * predecessor.
 *
 * Resolving in offset space also makes the rung SELF-TERMINATING rather than
 * guarded: after a landing the very same section resolves again and the
 * sub-pixel guard below declines to master top on its own. There is no separate
 * "have I already landed here?" state, which is what C3/I6's
 * no-state-between-presses rule requires.
 *
 * ⚠ That self-termination needs the SUBPIXEL_EPSILON below, and reading it as
 * `offset === headerY` is what broke it a second time (D-2, ticket 08).
 * `scrollTo` can only come to rest on an integer PHYSICAL PIXEL, while a layout
 * `y` is a sum of measured dp heights and is freely fractional -- so a landing
 * aimed at `y_h` rests at `y_h` SNAPPED TO THE GRID, up to half a pixel either
 * side (0.14 dp at density 3.5). Snapped short, a strict `y <= offset` drops the
 * header the press just landed on out of its OWN candidate set, the maximum
 * falls through to the section below, and back climbs one open section per
 * press -- the very symptom this function was written to fix, reached by a
 * different mechanism and hidden behind a shortfall too small to see: on device
 * the landed header renders on the SAME PIXEL ROW it occupies at master top
 * (measured, m1..m4).
 *
 * So the containment test carries the same tolerance as the guard it feeds. A
 * filter that discards its own subject can never be rescued by a check
 * downstream of it, which is exactly what the first version tried to do.
 *
 * ⚠ Independent of range ORDER, deliberately. H4 promises ranges are inclusive
 * and non-overlapping but says nothing about ordering, so this takes the
 * maximum rather than the first or last match. A section whose header has no
 * resolved layout is skipped rather than fatal: an unresolved `y` cannot be
 * compared, and abandoning the rung on one would lose it for the whole list.
 *
 * Cost is one `layoutY` read per section -- an array index inside FlashList's
 * layout manager -- on a BACK PRESS, never in the per-frame path (H9).
 */
function containingSection(
  s: LadderSnapshot,
): { sectionId: string; headerY: number } | null {
  let sectionId: string | null = null;
  let headerY = -Infinity;

  for (const r of s.ranges) {
    const y = s.layoutY(r.start);
    if (y === undefined) continue;
    // The NEAREST header at or above, not the earliest open one. Recently Added
    // is the first item of every non-empty BooksHome, so an earliest reading
    // targets index 0 whenever it is open -- which is master top, i.e. a
    // guaranteed dead press.
    if (y <= s.offset + SUBPIXEL_EPSILON && y > headerY) {
      headerY = y;
      sectionId = r.sectionId;
    }
  }

  /*
   * ⚠ `>` vs `>=` on that second comparison is PROVABLY EQUIVALENT here, which
   * is why no test pins it -- recorded so the surviving mutation is a known
   * quantity rather than a gap someone re-derives later.
   *
   * They can only differ on a TIE, i.e. two section headers reporting the same
   * `y`, which in a vertical list means a zero-height section. The one real
   * source of that is FlashList synthesising `{x: 0, y: 0, ...}` for an index
   * whose layout is missing (`LayoutManager.getLayout`), and every tie it
   * produces is at `y === 0` -- where `>` keeps the first and `>=` keeps the
   * last, both leave `headerY === 0`, and the `headerY <= 0` guard below
   * declines either way. Same decision, both directions.
   *
   * That synthesis is also why an unresolved header fails SAFE rather than
   * loudly: it reads as `y === 0`, loses the maximum to any real measured
   * header above the offset, and if every header is unresolved it yields
   * `headerY === 0` and the press falls through to master top.
   */

  return sectionId === null ? null : { sectionId, headerY };
}

/**
 * The intermediate rung's landing offset, or `null` when the rung does not
 * apply and the press falls through to master top.
 */
function sectionRungTarget(s: LadderSnapshot): number | null {
  if (!SECTIONED_VIEWS.has(s.view)) return null;

  const containing = containingSection(s);
  if (containing === null) return null;
  if (!s.expanded.has(containing.sectionId)) return null;

  const { headerY } = containing;

  // An intermediate rung is by definition a stop STRICTLY BETWEEN master top
  // and where you already are. Both halves fall out of that one idea:
  //
  //   0 < headerY                          it is below master's own target
  //   headerY < offset - SUBPIXEL_EPSILON  it is meaningfully above you
  //
  // The lower bound is why a header at index 0 (y === 0) needs no special case:
  // its target IS master top, so it degenerates into the master branch and the
  // ladder reports what it actually did.
  if (headerY <= 0) return null;
  if (s.offset - headerY <= SUBPIXEL_EPSILON) return null;

  /*
   * ⚠ §D2 -- the landing offset is the header's PLAIN `y`, with NO conversion
   * term. This is the one number here a reasonable implementer gets wrong in
   * the obvious direction, and the prototype did:
   *
   *   at raw offset S, item i's top sits at screen position
   *     (y_i + firstItemOffset) - S
   *   we want the header at screen position firstItemOffset  =>  S = y_h
   *
   * Landing at `y_h + firstItemOffset` aligns the header to the VIEWPORT top
   * instead, which is exactly the strip the dropped-down search bar occupies as
   * an absolute overlay -- so the header lands UNDERNEATH the bar and the user
   * cannot read the name of the section they returned to. Found on device,
   * fixed, re-confirmed on a later build. Plain `y_h` puts the header precisely
   * where item 0 sits at master top: the visual slot the user already knows.
   *
   * Rejected alternative: hiding the search bar during auto-scrolls. It only
   * defers the occlusion -- the bar returns on any upward delta -- and it would
   * give the ladder a second job, owning chrome visibility, with a new failure
   * mode.
   */
  return headerY;
}

export type SweepDecision =
  | { kind: 'none'; reason: 'not-sectioned' | 'not-at-top' | 'flinging' | 'no-visible-sample' }
  | {
      kind: 'collapse';
      /**
       * The surviving set, computed against the `expanded` in the snapshot --
       * i.e. against the last COMMITTED state. It answers "did anything drop?"
       * by identity and nothing else; it is NOT what gets written.
       */
      open: Set<string>;
      /**
       * The raw viewport answer: every section id with a sliver on screen,
       * whether or not it is expanded.
       *
       * ⚠ Reported SEPARATELY so the caller can re-run `computeRemainingOpen`
       * inside React's state updater, against the set React actually holds
       * rather than the render-time mirror this snapshot was built from. The
       * whole point is that it does NOT depend on `s.expanded`: a section a
       * queued tap has just opened is not in the mirror, and filtering this by
       * `expanded` would collapse it the instant it opened.
       *
       * This is a §J4 widening, not a leak of the decision into the caller: the
       * RULE (visible or protected survives) still lives in
       * `computeRemainingOpen`, and this hands over the input that rule takes.
       */
      visibleIds: Set<string>;
    };

/**
 * Decide whether an arrival at the top should collapse the off-screen sections,
 * and which sections survive.
 */
export function decideSweep(
  s: LadderSnapshot,
  trigger: 'momentum' | 'drag',
  velocityY?: number,
): SweepDecision {
  if (!SECTIONED_VIEWS.has(s.view)) return { kind: 'none', reason: 'not-sectioned' };

  // The exact complement of the rung's arm predicate, by sharing it. I2 rests
  // on this: the sweep can only ever reach below-fold sections.
  if (!isAtTop(s)) return { kind: 'none', reason: 'not-at-top' };

  // Drag-end only: a momentum END is by definition the motion having stopped,
  // so there is no velocity left to gate on.
  //
  // An UNREPORTED velocity is treated as a fling, not as a settle. The two
  // errors are not symmetric: a missed sweep is invisible and the next arrival
  // at the top performs it anyway, whereas a wrong sweep destroys the user's
  // expansions. J4 types `velocityY` as optional and does not say which way
  // `undefined` falls; this is the safe side.
  if (trigger === 'drag' && !(Math.abs(velocityY ?? Infinity) < SETTLED_VELOCITY_THRESHOLD)) {
    return { kind: 'none', reason: 'flinging' };
  }

  // Past every gate, so the list has PROVEN it is at the top and at rest --
  // which is what makes this sample trustworthy. Sampling any earlier reads the
  // pre-jump viewport, because computeVisibleIndices() is a pure function of
  // the last OBSERVED offset (F2).
  const { startIndex, endIndex } = s.visible();

  // A degenerate sample is a NO-OP, never a collapse. At the top of a list with
  // data the ranges tile it, so index 0 always belongs to a section: an empty
  // sample here is always a bug signal, never a legitimate state -- and because
  // the collapse helper iterates the OPEN set, letting it through would collapse
  // EVERYTHING, wiping exactly the sections F7 protects.
  if (startIndex < 0 || endIndex < startIndex) {
    return { kind: 'none', reason: 'no-visible-sample' };
  }

  // Overlap, not containment (H4): any sliver on screen counts as visible.
  const visibleIds = new Set<string>();
  for (const r of s.ranges) {
    if (overlapsSpan(r, startIndex, endIndex)) visibleIds.add(r.sectionId);
  }

  // The same bail-out, reached the other way: the sample was well-formed but
  // matched nothing. NOT qualified by `ranges.length > 0` as F8 words it --
  // unpublished ranges with a persisted `expanded` set is the R5 shape exactly,
  // and it is the input for which letting it through is most destructive.
  if (visibleIds.size === 0) return { kind: 'none', reason: 'no-visible-sample' };

  // NO protected section: Recently Added survives by POSITION, because it is
  // the first item of every non-empty BooksHome and is therefore on screen
  // whenever the sweep is allowed to run (F7). The helper returns `expanded`
  // itself when nothing drops, so a no-op sweep hands React the same reference
  // and it bails out of re-rendering the list -- which is what makes every
  // accepted bounce-sweep (F5) cheap.
  return { kind: 'collapse', open: computeRemainingOpen(s.expanded, visibleIds), visibleIds };
}
