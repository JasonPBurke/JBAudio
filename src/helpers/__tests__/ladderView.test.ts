import { ladderViewFor } from '../ladderView';

describe('ladderViewFor', () => {
  it('maps the three shelves, and the Books shelf by its LAYOUT', () => {
    expect(ladderViewFor(0, 'grid')).toBe('booksHome');
    expect(ladderViewFor(1, 'grid')).toBe('seriesHome');
    expect(ladderViewFor(2, 'grid')).toBe('booksGrid');
    expect(ladderViewFor(2, 'list')).toBe('booksList');
  });

  /*
   * ADR 0006's two axes, from the consumer's side: Layout is a property of the
   * BOOKS SHELF, so "what layout is the Series shelf in?" is not a question --
   * and a layout the reader set on the Books shelf must not change what the
   * other two shelves resolve to.
   */
  it('ignores the layout on the shelves that do not have one', () => {
    expect(ladderViewFor(0, 'list')).toBe('booksHome');
    expect(ladderViewFor(1, 'list')).toBe('seriesHome');
  });

  /*
   * The reason the cascade is written the way it is. A view this helper does
   * not know must not inherit `booksHome`'s capabilities by falling through to
   * it, because that is the ONE view that arms the section rung and the
   * collapse sweep against a ranges ref that describes a different list (§R5).
   *
   * Written as "is not the sectioned view" rather than "is booksGrid": what
   * matters is the capability, not which of the safe names it lands on. Now
   * that `booksList` is mapped properly there are three safe names, which is
   * exactly the day this phrasing was written to survive -- so it is widened
   * across both layouts here rather than narrowed to a result.
   */
  it('degrades an UNMAPPED ordinal away from the sectioned view', () => {
    for (const ordinal of [3, 4, 99, -1, NaN]) {
      for (const layout of ['grid', 'list'] as const) {
        expect(ladderViewFor(ordinal, layout)).not.toBe('booksHome');
      }
    }
  });
});
