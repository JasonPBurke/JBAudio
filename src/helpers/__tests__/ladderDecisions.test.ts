import {
  decideBackPress,
  decideSweep,
  type LadderSnapshot,
  type SweepDecision,
} from '../ladderDecisions';
import { computeRemainingOpen } from '../collapseOffscreenSections';
import { ladderViewFor } from '../ladderView';

/**
 * The default `visible` thunk THROWS. That is B7's ordering rule expressed as a
 * fixture rather than a comment: any case that reaches visibility without first
 * passing the offset predicate fails loudly, and every decline case pins the
 * rule for free.
 */
function snapshot(over: Partial<LadderSnapshot> = {}): LadderSnapshot {
  return {
    view: 'booksHome',
    drawerOpen: false,
    offset: 6421,
    firstItemOffset: 38,
    expanded: new Set<string>(),
    ranges: [],
    visible: () => {
      throw new Error('visible() called before the offset predicate passed (B7)');
    },
    layoutY: () => undefined,
    ...over,
  };
}

describe('decideBackPress — declines', () => {
  it('declines when the drawer is open, even scrolled deep', () => {
    expect(decideBackPress(snapshot({ drawerOpen: true }))).toEqual({
      kind: 'decline',
      reason: 'drawer',
    });
  });

  it('declines when no list is mounted', () => {
    expect(decideBackPress(null)).toEqual({ kind: 'decline', reason: 'no-list' });
  });

  it('declines at rest at visual top', () => {
    expect(decideBackPress(snapshot({ offset: 0, firstItemOffset: 38 }))).toEqual({
      kind: 'decline',
      reason: 'at-top',
    });
  });

  it('declines at the boundary: the predicate is >, not >=', () => {
    expect(decideBackPress(snapshot({ offset: 38, firstItemOffset: 38 }))).toEqual({
      kind: 'decline',
      reason: 'at-top',
    });
  });

  it('declines on a negative offset (overscroll, or post-sweep drift)', () => {
    expect(decideBackPress(snapshot({ offset: -978, firstItemOffset: 38 }))).toEqual({
      kind: 'decline',
      reason: 'at-top',
    });
  });

  it('declines on an empty list reading offset 0', () => {
    const empty = { expanded: new Set<string>(), ranges: [] };
    expect(decideBackPress(snapshot({ ...empty, offset: 0, firstItemOffset: 38 }))).toEqual({
      kind: 'decline',
      reason: 'at-top',
    });
  });

  it('declines on an empty list reading offset === firstItemOffset', () => {
    const empty = { expanded: new Set<string>(), ranges: [] };
    expect(decideBackPress(snapshot({ ...empty, offset: 38, firstItemOffset: 38 }))).toEqual({
      kind: 'decline',
      reason: 'at-top',
    });
  });
});

describe('decideBackPress — the section rung', () => {
  it('lands on the header y exactly, with no firstItemOffset term', () => {
    const result = decideBackPress(
      snapshot({
        offset: 6421,
        firstItemOffset: 38,
        expanded: new Set(['author-M']),
        ranges: [{ sectionId: 'author-M', start: 120, end: 200 }],
        visible: () => ({ startIndex: 150, endIndex: 170 }),
        layoutY: (i) => (i === 120 ? 4820 : undefined),
      }),
    );

    // 4820, NOT 4858. Landing at y + firstItemOffset aligns the header to the
    // VIEWPORT top, which is the strip the dropped-down search bar occupies as
    // an absolute overlay -- the header lands underneath the bar. Found on
    // device, fixed, re-confirmed on a later build. This assertion is that
    // regression test, so it asserts the number and not a formula.
    expect(result).toEqual({ kind: 'scrollTo', offset: 4820, rung: 'section' });
  });
});

describe('decideBackPress — master top', () => {
  /** A deep viewport sitting inside `author-M`, whose header is well above the fold. */
  const sectioned = {
    offset: 6421,
    firstItemOffset: 38,
    expanded: new Set(['author-M']),
    ranges: [{ sectionId: 'author-M', start: 120, end: 200 }],
    visible: () => ({ startIndex: 150, endIndex: 170 }),
    layoutY: (i: number) => (i === 120 ? 4820 : undefined),
  };

  it('never selects the rung on a non-sectioned view, even with ranges and expansions present', () => {
    // The gate is identity, not data: `expanded` and `ranges` here are exactly
    // the inputs that select the rung on booksHome. Only the view differs.
    for (const view of ['seriesHome', 'booksGrid', 'booksList'] as const) {
      expect(decideBackPress(snapshot({ ...sectioned, view }))).toEqual({
        kind: 'scrollTo',
        offset: 0,
        rung: 'master',
      });
    }
  });

  it('falls through when the containing section is collapsed', () => {
    expect(
      decideBackPress(snapshot({ ...sectioned, expanded: new Set<string>() })),
    ).toEqual({ kind: 'scrollTo', offset: 0, rung: 'master' });
  });

  it('falls through when the header is at the fold', () => {
    expect(decideBackPress(snapshot({ ...sectioned, offset: 4820 }))).toEqual({
      kind: 'scrollTo',
      offset: 0,
      rung: 'master',
    });
  });

  it('falls through when the header is within 1px of the fold', () => {
    expect(decideBackPress(snapshot({ ...sectioned, offset: 4821 }))).toEqual({
      kind: 'scrollTo',
      offset: 0,
      rung: 'master',
    });
  });

  /*
   * The two cases below USED to select master top, back when the rung resolved
   * its section from `visible().startIndex`. They now assert the opposite, and
   * that inversion is the point: a sample pointing outside every range, and
   * FlashList's own inverted empty sentinel, are both incapable of moving the
   * rung. Kept rather than deleted because each was a real hazard for the rung
   * before offset space made it structurally unreachable.
   */
  it('ignores a visible sample that overlaps no range at all', () => {
    expect(
      decideBackPress(
        snapshot({ ...sectioned, visible: () => ({ startIndex: 900, endIndex: 950 }) }),
      ),
    ).toEqual({ kind: 'scrollTo', offset: 4820, rung: 'section' });
  });

  it('falls through when the header has no resolved layout', () => {
    expect(decideBackPress(snapshot({ ...sectioned, layoutY: () => undefined }))).toEqual({
      kind: 'scrollTo',
      offset: 0,
      rung: 'master',
    });
  });

  it("ignores FlashList's degenerate empty sample (F8)", () => {
    expect(
      decideBackPress(
        snapshot({ ...sectioned, visible: () => ({ startIndex: -1, endIndex: -1 }) }),
      ),
    ).toEqual({ kind: 'scrollTo', offset: 4820, rung: 'section' });
  });

  it('degenerates to master when the containing header is index 0', () => {
    // y === 0 IS master top's target, so this reports what it actually does
    // rather than claiming a section rung that goes to the same place.
    expect(
      decideBackPress(
        snapshot({
          ...sectioned,
          expanded: new Set(['recents']),
          ranges: [{ sectionId: 'recents', start: 0, end: 40 }],
          visible: () => ({ startIndex: 12, endIndex: 30 }),
          layoutY: (i) => (i === 0 ? 0 : undefined),
        }),
      ),
    ).toEqual({ kind: 'scrollTo', offset: 0, rung: 'master' });
  });
});

describe('decideBackPress — nearest, and re-derivation', () => {
  /** Recently Added open at index 0, and a later author section also open. */
  const twoOpen = {
    offset: 6421,
    firstItemOffset: 38,
    expanded: new Set(['recents', 'author-M']),
    ranges: [
      { sectionId: 'recents', start: 0, end: 40 },
      { sectionId: 'author-M', start: 120, end: 200 },
    ],
    visible: () => ({ startIndex: 150, endIndex: 170 }),
    layoutY: (i: number) => (i === 0 ? 0 : i === 120 ? 4820 : undefined),
  };

  it('targets the section containing the viewport top, not the earliest open one', () => {
    // Under the earliest reading this resolves to recents at index 0, y === 0,
    // which is master top -- and the rung becomes a guaranteed dead press.
    expect(decideBackPress(snapshot(twoOpen))).toEqual({
      kind: 'scrollTo',
      offset: 4820,
      rung: 'section',
    });
  });

  it('returns master when fed back the snapshot its own section rung produces', () => {
    // The ladder holds no state: feeding the landing offset back in must select
    // the next rung down, so it cannot get out of step with the list.
    //
    // The thunk moves with the offset. After the rung lands, the viewport top IS
    // the header, so the real post-landing sample reads startIndex === 120 --
    // keeping the pre-jump 150 here would test a snapshot that never occurs.
    expect(
      decideBackPress(
        snapshot({
          ...twoOpen,
          offset: 4820,
          visible: () => ({ startIndex: 120, endIndex: 140 }),
        }),
      ),
    ).toEqual({ kind: 'scrollTo', offset: 0, rung: 'master' });
  });
});

/**
 * THE 38 PX SAMPLE SKEW -- a device-found defect (2026-08-22, Pixel 7 Pro
 * preview build, real 355-book library).
 *
 * `computeVisibleIndices()` samples from `offset - firstItemOffset`
 * (`RecyclerViewManager.ts:117` hands the tracker the SUBTRACTED value and
 * `EngagedIndicesTracker` uses it as `viewportStart`), while D2 lands the rung
 * at the header's PLAIN `y`. So the instant a rung lands, the sample window
 * opens 38 px ABOVE that header -- inside the PREVIOUS section's last item --
 * and any-sliver bounds (`findVisibleIndex.ts`) report that item's index.
 *
 * With the previous section COLLAPSED the lookup died on the expanded check and
 * the press fell through to master top, which is why this survived 943 tests and
 * three reviewers. With CONSECUTIVE sections expanded it climbed one section per
 * press instead: on device, back went Aaronovitch -> Andy Weir -> Agatha
 * Christie -> master top, terminating only at the first collapsed predecessor.
 *
 * The fix resolves the containing section in OFFSET space -- the same number the
 * landing is expressed in -- so the question and the answer cannot disagree, and
 * the rung is self-terminating by construction rather than by a guard.
 */
describe('decideBackPress — the containing section is resolved in offset space', () => {
  /** The device repro: three consecutive expanded sections above a deep viewport. */
  const consecutive = {
    firstItemOffset: 38,
    expanded: new Set(['agatha', 'weir', 'aaronovitch']),
    ranges: [
      { sectionId: 'recents', start: 0, end: 19 },
      { sectionId: 'agatha', start: 20, end: 40 },
      { sectionId: 'weir', start: 41, end: 70 },
      { sectionId: 'aaronovitch', start: 71, end: 120 },
    ],
    layoutY: (i: number) =>
      i === 0 ? 0 : i === 20 ? 500 : i === 41 ? 1500 : i === 71 ? 4820 : undefined,
  };

  /** What the real device sample reads once the rung has landed on 4820. */
  const laggedSample = { visible: () => ({ startIndex: 70, endIndex: 90 }) };

  it('returns master at the landing instead of climbing to the previous open section', () => {
    // THE REGRESSION. The sample says index 70 -- Andy Weir's last item -- and
    // Andy Weir is open, so the index-space lookup targeted its header and back
    // became an N-rung ladder up the list.
    expect(
      decideBackPress(snapshot({ ...consecutive, ...laggedSample, offset: 4820 })),
    ).toEqual({ kind: 'scrollTo', offset: 0, rung: 'master' });
  });

  it('lands on the section it is INSIDE when the sample has lagged into the previous one', () => {
    // 30 px past the header: inside Aaronovitch, while the sample is still 8 px
    // short of it. Offset space answers with the section the reader can see.
    expect(
      decideBackPress(snapshot({ ...consecutive, ...laggedSample, offset: 4850 })),
    ).toEqual({ kind: 'scrollTo', offset: 4820, rung: 'section' });
  });

  it('never consults the visibility sample at all — the default thunk throws', () => {
    // The rung's whole input is now `ranges` + `layoutY` + `offset`. This is the
    // structural claim, and the fixture's throwing `visible` is what enforces
    // it: reintroduce a sample read here and every case in this block fails
    // loudly rather than drifting back into the skew.
    expect(decideBackPress(snapshot({ ...consecutive, offset: 6421 }))).toEqual({
      kind: 'scrollTo',
      offset: 4820,
      rung: 'section',
    });
  });

  it('picks the NEAREST header at or above the offset, not the earliest', () => {
    expect(decideBackPress(snapshot({ ...consecutive, offset: 1600 }))).toEqual({
      kind: 'scrollTo',
      offset: 1500,
      rung: 'section',
    });
  });

  it('applies the expanded check to the section the offset resolves to', () => {
    // Andy Weir is the section containing 1600 and it is shut, so the press
    // falls through -- it does NOT walk on to the next open section above.
    expect(
      decideBackPress(
        snapshot({
          ...consecutive,
          offset: 1600,
          expanded: new Set(['agatha', 'aaronovitch']),
        }),
      ),
    ).toEqual({ kind: 'scrollTo', offset: 0, rung: 'master' });
  });

  it('skips a section whose header has no resolved layout', () => {
    // An unresolved `y` cannot be compared, so that section is passed over and
    // the nearest RESOLVED header above wins -- it does not abandon the rung.
    expect(
      decideBackPress(
        snapshot({
          ...consecutive,
          offset: 6421,
          layoutY: (i) => (i === 0 ? 0 : i === 20 ? 500 : i === 41 ? 1500 : undefined),
        }),
      ),
    ).toEqual({ kind: 'scrollTo', offset: 1500, rung: 'section' });
  });

  it('falls through when every section header lies below the offset', () => {
    expect(
      decideBackPress(
        snapshot({
          ...consecutive,
          offset: 400,
          layoutY: (i) => (i === 20 ? 500 : i === 41 ? 1500 : i === 71 ? 4820 : undefined),
        }),
      ),
    ).toEqual({ kind: 'scrollTo', offset: 0, rung: 'master' });
  });
});

describe('decideBackPress — the landing is quantized to the pixel grid (D-2)', () => {
  /**
   * The SAME device repro as the block above, at the offset the device actually
   * reports rather than the exact one arithmetic predicts.
   *
   * `scrollTo` can only come to rest on an integer PHYSICAL PIXEL, while a
   * layout `y` is a sum of measured dp heights and is freely fractional. So a
   * landing aimed at 4820 rests at 4820 snapped to the grid -- 4819.71 on a
   * density-3.5 device -- and the shortfall is smaller than one pixel BY
   * CONSTRUCTION. It is invisible on screen: the header renders on the same
   * pixel row it occupies at master top, which is how this survived a device
   * pass that measured exactly that (ticket 08, m1..m4).
   */
  const consecutive = {
    firstItemOffset: 38,
    expanded: new Set(['agatha', 'weir', 'aaronovitch']),
    ranges: [
      { sectionId: 'recents', start: 0, end: 19 },
      { sectionId: 'agatha', start: 20, end: 40 },
      { sectionId: 'weir', start: 41, end: 70 },
      { sectionId: 'aaronovitch', start: 71, end: 120 },
    ],
    layoutY: (i: number) =>
      i === 0 ? 0 : i === 20 ? 500 : i === 41 ? 1500 : i === 71 ? 4820 : undefined,
  };

  it('declines to master when the landing snapped a fraction of a pixel SHORT', () => {
    // THE DEVICE DEFECT. A strict `y <= offset` drops the header the press just
    // landed on out of its own candidate set, so the maximum falls through to
    // the section below it and back climbs one open section per press -- the
    // D-1 symptom exactly, reached by a completely different mechanism.
    expect(
      decideBackPress(snapshot({ ...consecutive, offset: 4820 - 0.29 })),
    ).toEqual({ kind: 'scrollTo', offset: 0, rung: 'master' });
  });

  it('declines to master anywhere inside the sub-pixel band, either side of the header', () => {
    // The grid can snap either way and the fractional part is a property of the
    // header, not of the press, so both signs must terminate the ladder.
    for (const offset of [4819, 4819.01, 4819.5, 4820, 4820.99]) {
      expect(decideBackPress(snapshot({ ...consecutive, offset }))).toEqual({
        kind: 'scrollTo',
        offset: 0,
        rung: 'master',
      });
    }
  });

  it('does NOT let the tolerance swallow a genuine rung sitting just below a header', () => {
    // 2 px above Andy Weir's header is not a landing on it -- it is a reader
    // inside Agatha Christie, and the rung they are owed is Agatha's. This is
    // the bound that stops the fix for D-2 from becoming a fall-through.
    expect(decideBackPress(snapshot({ ...consecutive, offset: 1498 }))).toEqual({
      kind: 'scrollTo',
      offset: 500,
      rung: 'section',
    });
  });
});


/**
 * ⚠ `overlapsSpan`'s INCLUSIVE bounds were pinned here, by two rung cases, until
 * the rung stopped resolving its section from an index sample (2026-08-22). They
 * are NOT unpinned: both sides now live in the sweep, as
 * "counts a section whose end equals startIndex" and "whose start equals
 * endIndex". Mutation-verified after the move -- `r.start <= to && r.end >= from`
 * to either strict comparison fails one of those two.
 *
 * Recorded rather than silently dropped because this exact coverage was found
 * MISSING once before, by review, while the whole suite read green.
 */

/**
 * The sweep's fixture is deliberately HOSTILE by default: `visible` throws and
 * `expanded`/`ranges` are non-empty and mismatched. Every gate that returns
 * `none` therefore proves two things at once — the right reason, and that it
 * declined before touching visibility.
 */
function sweepSnapshot(over: Partial<LadderSnapshot> = {}): LadderSnapshot {
  return snapshot({
    offset: 0,
    expanded: new Set(['author:king', 'author:pratchett']),
    ranges: [
      { sectionId: 'recents', start: 0, end: 19 },
      { sectionId: 'author:king', start: 20, end: 44 },
      { sectionId: 'author:pratchett', start: 45, end: 80 },
      { sectionId: 'author:tolkien', start: 81, end: 120 },
    ],
    visible: () => {
      throw new Error('visible() called before the sweep gates passed (F2)');
    },
    ...over,
  });
}

/**
 * Narrow a sweep to its collapsed set. Every test whose claim is about the
 * CONTENTS or the REFERENCE of that set reads it through here, so the claim
 * stays on one line and a `none` shows up as a named failure rather than as a
 * confusing set mismatch.
 */
function collapsedSet(result: SweepDecision): Set<string> {
  if (result.kind !== 'collapse') {
    throw new Error(`expected a collapse, got none('${result.reason}')`);
  }
  return result.open;
}

/** The same narrowing for the sweep's viewport answer (F-6). */
function visibleIdsOf(result: SweepDecision): Set<string> {
  if (result.kind !== 'collapse') {
    throw new Error(`expected a collapse, got none('${result.reason}')`);
  }
  return result.visibleIds;
}

describe('decideSweep — the capability gate (R5)', () => {
  it('declines on a non-sectioned view even with stale ranges and live expansions', () => {
    expect(
      decideSweep(sweepSnapshot({ view: 'seriesHome' }), 'momentum'),
    ).toEqual({ kind: 'none', reason: 'not-sectioned' });
  });

  /*
   * The gate joined to the mount site's ordinal mapping. `ladderView.test.ts`
   * pins the mapping alone; this pins the CONSEQUENCE, which is the thing that
   * matters: a fourth view added to the toggle and not mapped here cannot reach
   * the sweep at all. Those stale ranges and live expansions in the fixture are
   * exactly what it would otherwise destroy.
   */
  it('declines for a view an UNMAPPED toggle ordinal resolves to', () => {
    expect(
      decideSweep(sweepSnapshot({ view: ladderViewFor(3) }), 'momentum'),
    ).toEqual({ kind: 'none', reason: 'not-sectioned' });
  });
});

describe('decideSweep — the at-top gate (I2)', () => {
  it('declines when the list is not at the top', () => {
    expect(decideSweep(sweepSnapshot({ offset: 500, firstItemOffset: 38 }), 'momentum')).toEqual({
      kind: 'none',
      reason: 'not-at-top',
    });
  });

  it('sweeps AT the boundary: the resting offset at the top is firstItemOffset', () => {
    expect(
      decideSweep(
        sweepSnapshot({
          offset: 38,
          firstItemOffset: 38,
          visible: () => ({ startIndex: 0, endIndex: 12 }),
        }),
        'momentum',
      ).kind,
    ).toBe('collapse');
  });

  it('declines one pixel above the fold, the boundary the rung declines at', () => {
    expect(decideSweep(sweepSnapshot({ offset: 39, firstItemOffset: 38 }), 'momentum')).toEqual({
      kind: 'none',
      reason: 'not-at-top',
    });
  });
});

describe('decideSweep — the velocity gate (F4, F5)', () => {
  const settled = { visible: () => ({ startIndex: 0, endIndex: 12 }) };

  it('declines the device-measured fling away from the top', () => {
    expect(decideSweep(sweepSnapshot({ offset: 0 }), 'drag', -4.76)).toEqual({
      kind: 'none',
      reason: 'flinging',
    });
  });

  it('declines a drag whose velocity was not reported at all', () => {
    expect(decideSweep(sweepSnapshot({ offset: 0 }), 'drag')).toEqual({
      kind: 'none',
      reason: 'flinging',
    });
  });

  it.each([0, -120])(
    'sweeps on the overscroll bounce at offset %p, which reports velocity 0',
    (offset) => {
      expect(decideSweep(sweepSnapshot({ offset, ...settled }), 'drag', 0).kind).toBe('collapse');
    },
  );

  it('does not consult velocity on the momentum trigger', () => {
    expect(decideSweep(sweepSnapshot({ offset: 0, ...settled }), 'momentum', -4.76).kind).toBe(
      'collapse',
    );
  });
});

describe('decideSweep — the degenerate sample (F8)', () => {
  // endIndex 12, NOT -1. A -1/-1 sample also trips the empty-overlap guard,
  // which returns the identical reason -- so that fixture cannot tell the two
  // guards apart and leaves this one unpinned. With endIndex 12 the overlap is
  // non-empty, so removing this guard yields a collapse and the test bites.
  it('declines on a negative startIndex, even where sections would overlap', () => {
    expect(
      decideSweep(sweepSnapshot({ visible: () => ({ startIndex: -1, endIndex: 12 }) }), 'momentum'),
    ).toEqual({ kind: 'none', reason: 'no-visible-sample' });
  });

  it("declines on FlashList's own empty sample, which is INVERTED (-1, -2)", () => {
    expect(
      decideSweep(sweepSnapshot({ visible: () => ({ startIndex: -1, endIndex: -2 }) }), 'momentum'),
    ).toEqual({ kind: 'none', reason: 'no-visible-sample' });
  });

  it('declines on an inverted visible range', () => {
    expect(
      decideSweep(sweepSnapshot({ visible: () => ({ startIndex: 12, endIndex: 4 }) }), 'momentum'),
    ).toEqual({ kind: 'none', reason: 'no-visible-sample' });
  });
});

describe('decideSweep — an empty overlap (F8, R5)', () => {
  it('declines when a valid visible range overlaps no section', () => {
    expect(
      decideSweep(
        sweepSnapshot({ visible: () => ({ startIndex: 900, endIndex: 940 }) }),
        'momentum',
      ),
    ).toEqual({ kind: 'none', reason: 'no-visible-sample' });
  });

  it('declines when no ranges have been published yet but expansions persist', () => {
    expect(
      decideSweep(
        sweepSnapshot({ ranges: [], visible: () => ({ startIndex: 0, endIndex: 12 }) }),
        'momentum',
      ),
    ).toEqual({ kind: 'none', reason: 'no-visible-sample' });
  });
});

describe('decideSweep — the collapse', () => {
  const atTop = { visible: () => ({ startIndex: 0, endIndex: 12 }) };
  const allOpen = new Set(['recents', 'author:king', 'author:pratchett', 'author:tolkien']);

  it('keeps only Recently Added, by position rather than by exemption', () => {
    const result = decideSweep(sweepSnapshot({ ...atTop, expanded: allOpen }), 'momentum');
    expect(result).toEqual({
      kind: 'collapse',
      open: new Set(['recents']),
      visibleIds: new Set(['recents']),
    });
  });

  it('returns the SAME set reference when every open section is visible', () => {
    const open = new Set(['recents']);
    const result = decideSweep(sweepSnapshot({ ...atTop, expanded: open }), 'momentum');
    expect(collapsedSet(result)).toBe(open);
  });

  it('returns the SAME set reference when nothing is expanded at all', () => {
    const open = new Set<string>();
    const result = decideSweep(sweepSnapshot({ ...atTop, expanded: open }), 'momentum');
    expect(collapsedSet(result)).toBe(open);
  });

  it('is idempotent: feeding a sweep result back collapses nothing (E4, I5)', () => {
    const first = collapsedSet(decideSweep(sweepSnapshot({ ...atTop, expanded: allOpen }), 'momentum'));
    const second = collapsedSet(decideSweep(sweepSnapshot({ ...atTop, expanded: first }), 'momentum'));
    expect(second).toBe(first);
  });

  it('counts a section whose end equals startIndex as visible (any sliver)', () => {
    const result = decideSweep(
      sweepSnapshot({ expanded: allOpen, visible: () => ({ startIndex: 19, endIndex: 30 }) }),
      'momentum',
    );
    expect(result).toEqual({
      kind: 'collapse',
      open: new Set(['recents', 'author:king']),
      visibleIds: new Set(['recents', 'author:king']),
    });
  });

  it('counts a section whose start equals endIndex as visible (any sliver)', () => {
    const result = decideSweep(
      sweepSnapshot({ expanded: allOpen, visible: () => ({ startIndex: 30, endIndex: 45 }) }),
      'momentum',
    );
    expect(result).toEqual({
      kind: 'collapse',
      open: new Set(['author:king', 'author:pratchett']),
      visibleIds: new Set(['author:king', 'author:pratchett']),
    });
  });

  /*
   * `visibleIds` is reported ALONGSIDE `open` so the hook can re-derive the
   * collapse inside React's state updater, against the set React actually
   * holds rather than against the render-time mirror the snapshot was built
   * from (F-6). The two tests below are what stop it degenerating back into a
   * second view of `open`.
   */
  it('reports the visible ids even when NOTHING is expanded', () => {
    const result = decideSweep(sweepSnapshot({ ...atTop, expanded: new Set() }), 'momentum');
    // `open` is empty here and must stay empty; `visibleIds` is the VIEWPORT's
    // answer and is independent of it. Deriving `visibleIds` from `expanded`
    // -- the obvious "reuse what we already filtered" tidy-up -- would return
    // an empty set here, and the updater would then collapse every section a
    // queued tap had just opened.
    expect(collapsedSet(result)).toEqual(new Set());
    expect(visibleIdsOf(result)).toEqual(new Set(['recents']));
  });

  it('reports visible ids that are not in the expanded set at all', () => {
    const result = decideSweep(
      sweepSnapshot({ expanded: new Set(['author:tolkien']), visible: () => ({ startIndex: 19, endIndex: 30 }) }),
      'momentum',
    );
    // Tolkien is open and off-screen, so it drops. The claim is the other half:
    // the two on-screen sections are reported even though neither is open, which
    // is precisely what a queued tap on one of them needs.
    expect(collapsedSet(result)).toEqual(new Set());
    expect(visibleIdsOf(result)).toEqual(new Set(['recents', 'author:king']));
  });

  it('agrees with `open`: re-collapsing the mirror through `visibleIds` reproduces it', () => {
    // The seam's consistency condition, and the reason the hook may arm the
    // anchor fix from `open` while writing through `visibleIds`: for the very
    // set the snapshot was built from, the two paths cannot disagree.
    const result = decideSweep(sweepSnapshot({ ...atTop, expanded: allOpen }), 'momentum');
    expect(computeRemainingOpen(allOpen, visibleIdsOf(result))).toEqual(collapsedSet(result));
  });
});
