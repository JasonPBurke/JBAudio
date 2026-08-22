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
  /** LAZY — must not be called before the offset predicate passes (B7). */
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
 * Sub-pixel guard. An index-based test alone re-fires the rung when the landing
 * offset settles a hair past the header's y.
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
 * The one place `end`'s inclusiveness (H4) is encoded, so a range producer that
 * emits an exclusive `end` breaks visibly here instead of subtly at two call
 * sites. Any sliver counts: that is the semantics the deleted viewability
 * plumbing bought with `itemVisiblePercentThreshold: 1` (F6).
 *
 * The rung asks CONTAINMENT and the sweep asks OVERLAP (H4) -- containment is
 * simply this question with a degenerate one-index span.
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

  // Past this point the predicate has passed, which is what makes `visible()`
  // safe to call: it throws when the list has no layout manager, and such a
  // list reads BOTH accessors as 0 -- so the predicate is `0 > 0`, false, and
  // has declined above. Predicate true => layout exists.
  //
  // The premise needs the OFFSET to read 0 as well, not just firstItemOffset,
  // and that half is reasoned rather than measured -- reaching the throw takes
  // a scrolled list that has lost its layout manager. Deliberately NOT wrapped
  // in try/catch: swallowing it would turn a loud bug into a silent scroll to
  // master top, and the boundary with the back handler belongs to the hook,
  // not to a pure decision.
  const headerY = sectionRungTarget(s);
  if (headerY !== null) return { kind: 'scrollTo', offset: headerY, rung: 'section' };

  return { kind: 'scrollTo', offset: 0, rung: 'master' };
}

/**
 * The intermediate rung's landing offset, or `null` when the rung does not
 * apply and the press falls through to master top.
 */
function sectionRungTarget(s: LadderSnapshot): number | null {
  if (!SECTIONED_VIEWS.has(s.view)) return null;

  const { startIndex } = s.visible();

  // The section CONTAINING the viewport top -- the nearest one, not the
  // earliest expanded one in the list. Recently Added is the first item of
  // every non-empty BooksHome, so the earliest reading targets index 0 whenever
  // it is open, which is master top: a guaranteed dead press.
  const containing = s.ranges.find((r) => overlapsSpan(r, startIndex, startIndex));
  if (containing === undefined) return null;
  if (!s.expanded.has(containing.sectionId)) return null;

  const headerY = s.layoutY(containing.start);
  if (headerY === undefined) return null;

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
  | { kind: 'collapse'; open: Set<string> };

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
  return { kind: 'collapse', open: computeRemainingOpen(s.expanded, visibleIds) };
}
