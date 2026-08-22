import {
  decideBackPress,
  decideSweep,
  type LadderSnapshot,
  type SweepDecision,
} from '../ladderDecisions';
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

  it('falls through when no range contains the viewport top', () => {
    expect(
      decideBackPress(
        snapshot({ ...sectioned, visible: () => ({ startIndex: 900, endIndex: 950 }) }),
      ),
    ).toEqual({ kind: 'scrollTo', offset: 0, rung: 'master' });
  });

  it('falls through when the header has no resolved layout', () => {
    expect(decideBackPress(snapshot({ ...sectioned, layoutY: () => undefined }))).toEqual({
      kind: 'scrollTo',
      offset: 0,
      rung: 'master',
    });
  });

  it('falls through on a degenerate visible range', () => {
    expect(
      decideBackPress(
        snapshot({ ...sectioned, visible: () => ({ startIndex: -1, endIndex: -1 }) }),
      ),
    ).toEqual({ kind: 'scrollTo', offset: 0, rung: 'master' });
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
 * `SectionRange.end` is INCLUSIVE, and both bounds of the containment test are
 * therefore `<=` / `>=`. Nothing above pins that: the interior samples these
 * cases surround pass under strict bounds too, so a range producer written to
 * an exclusive `end` would leave this suite green while landing the rung on the
 * previous section's header -- a wrong landing that passes every sanity check
 * an implementer would think to write.
 */
describe('decideBackPress — the containment bounds are inclusive', () => {
  const base = {
    offset: 6421,
    firstItemOffset: 38,
    expanded: new Set(['author-M']),
    ranges: [{ sectionId: 'author-M', start: 120, end: 200 }],
    layoutY: (i: number) => (i === 120 ? 4820 : undefined),
  };

  it('a viewport top ON the header index is inside the section', () => {
    expect(
      decideBackPress(
        snapshot({ ...base, visible: () => ({ startIndex: 120, endIndex: 140 }) }),
      ),
    ).toEqual({ kind: 'scrollTo', offset: 4820, rung: 'section' });
  });

  it('a viewport top ON the last item index is still inside the section', () => {
    expect(
      decideBackPress(
        snapshot({ ...base, visible: () => ({ startIndex: 200, endIndex: 240 }) }),
      ),
    ).toEqual({ kind: 'scrollTo', offset: 4820, rung: 'section' });
  });
});

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
    expect(result).toEqual({ kind: 'collapse', open: new Set(['recents']) });
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
    expect(result).toEqual({ kind: 'collapse', open: new Set(['recents', 'author:king']) });
  });

  it('counts a section whose start equals endIndex as visible (any sliver)', () => {
    const result = decideSweep(
      sweepSnapshot({ expanded: allOpen, visible: () => ({ startIndex: 30, endIndex: 45 }) }),
      'momentum',
    );
    expect(result).toEqual({
      kind: 'collapse',
      open: new Set(['author:king', 'author:pratchett']),
    });
  });
});
