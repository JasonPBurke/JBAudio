import { decideBackPress, type LadderSnapshot } from '../ladderDecisions';

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
