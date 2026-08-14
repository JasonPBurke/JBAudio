import {
  PINNED_ARTWORK_ASPECT,
  editorCoverShape,
  seriesArtworkCaption,
  seriesBackdropUri,
  sharedAuthorName,
} from '@/helpers/seriesArtwork';
import type { DerivedSeries } from '@/helpers/seriesAssembly';

type BookOpts = {
  author?: string;
  artwork?: string | null;
  dims?: [number, number];
};

const mkBook = (id: string, opts: BookOpts = {}) =>
  ({
    bookId: id,
    bookTitle: id,
    author: opts.author ?? 'Terry Pratchett',
    bookProgressValue: 0,
    artwork: opts.artwork === undefined ? `/art/${id}.jpg` : opts.artwork,
    artworkWidth: (opts.dims ?? [500, 500])[0],
    artworkHeight: (opts.dims ?? [500, 500])[1],
    chapters: [{ url: `/${id}/1.mp3` }],
  }) as any;

const mkSeries = (books: any[], artwork: string | null = null): DerivedSeries => ({
  id: 's1',
  name: 'Discworld',
  artwork,
  books,
  canonicalNumbers: books.map(() => null),
  progressState: 'playing',
  origin: 'detected',
  createdAt: 0,
});

/*
 * §C8 AMENDED 2026-08-11, driver ruling: **series art is BACKGROUND-ONLY** —
 * the detail sheet's header and the browse row's card, and nothing else.
 *
 * ⚠ THE POINT OF THIS FUNCTION EXISTING AT ALL is that the backdrop used to be
 * read off `covers[0]`, i.e. off the fan. Sharing that one expression is what
 * made pinning a cover change the fan as a side effect. Two decisions, two
 * expressions.
 */
describe('the backdrop source (C8, amended)', () => {
  test('pinned art paints the backgrounds', () => {
    expect(seriesBackdropUri(mkSeries([mkBook('b1')], '/art/series.jpg'))).toBe(
      '/art/series.jpg',
    );
  });

  test('with nothing pinned it falls back to book 1', () => {
    expect(seriesBackdropUri(mkSeries([mkBook('b1'), mkBook('b2')]))).toBe(
      '/art/b1.jpg',
    );
  });

  test('null when the series has neither', () => {
    expect(seriesBackdropUri(mkSeries([]))).toBeNull();
    expect(
      seriesBackdropUri(mkSeries([mkBook('b1', { artwork: null })])),
    ).toBeNull();
  });

  test('the fallback follows series ORDER, not the saved cover', () => {
    // The backdrop tracks book 1 for the same reason the editor's preview does
    // (§D10): re-sorting a series changes which book that is.
    const reordered = mkSeries([mkBook('b2'), mkBook('b1')]);
    expect(seriesBackdropUri(reordered)).toBe('/art/b2.jpg');
  });
});

describe('the editor cover (D6, D10)', () => {
  test('derives from the first book when nothing is pinned', () => {
    const shape = editorCoverShape(null, mkBook('b1', { dims: [400, 600] }));
    expect(shape.uri).toBe('/art/b1.jpg');
    // The BOOK's real proportions, because a book's artwork is measured.
    expect(shape.aspect).toBeCloseTo(400 / 600);
  });

  /*
   * ⚠ MUTATION GUARD. Reverse this branch and the editor draws the first
   * book's cover on a series that is pinned — which is the exact state §D7's
   * caption claims is impossible, so the caption would say "Use first book's
   * cover instead" over a control already showing it.
   */
  test('a pinned cover wins over the first book', () => {
    const shape = editorCoverShape('/art/series.jpg', mkBook('b1'));
    expect(shape.uri).toBe('/art/series.jpg');
  });

  test('a pinned cover is assumed square, because nothing measures it', () => {
    // `series.artwork` is one nullable column with no dimension companions,
    // unlike a book's `artwork_width`/`_height`. Same assumption the detail
    // sheet's hero makes, from the same constant.
    expect(editorCoverShape('/art/series.jpg', undefined).aspect).toBe(
      PINNED_ARTWORK_ASPECT,
    );
  });

  test('never returns null — an empty series still draws a box', () => {
    // Reachable: a series whose membership rows all failed to resolve, and
    // K16's all-excluded state, which is stable and renders with no books.
    const shape = editorCoverShape(null, undefined);
    expect(shape).toEqual({ uri: null, aspect: PINNED_ARTWORK_ASPECT });
  });
});

describe('the caption (D7)', () => {
  test('null artwork is a statement of fact, not a control', () => {
    expect(seriesArtworkCaption(null)).toEqual({
      text: 'Using first book’s cover',
      reverts: false,
    });
  });

  test('pinned artwork is the escape hatch', () => {
    expect(seriesArtworkCaption('/art/series.jpg')).toEqual({
      text: 'Use first book’s cover instead',
      reverts: true,
    });
  });

  /*
   * §D7's actual ruling, which the two strings above only look like they
   * encode: WORDS RATHER THAN A PIN BADGE. The pressable state names what
   * pressing it DOES; a badge would name the state and leave the user with
   * nothing to press, so reverting would need a second, undiscoverable
   * affordance. A one-word label here is the regression to catch.
   */
  test('the pressable state names the action, not the state', () => {
    const pinned = seriesArtworkCaption('/art/series.jpg');
    expect(pinned.text.split(' ').length).toBeGreaterThan(2);
    expect(pinned.text).not.toBe(seriesArtworkCaption(null).text);
  });
});

describe('the cover search query author', () => {
  test('a single-author series seeds the search with its author', () => {
    expect(sharedAuthorName([mkBook('b1'), mkBook('b2')])).toBe(
      'Terry Pratchett',
    );
  });

  test('a mixed playlist seeds no author at all', () => {
    // Not "the first book's author": that would quietly narrow the results to
    // one author's covers on a hand-built series spanning five.
    expect(
      sharedAuthorName([
        mkBook('b1'),
        mkBook('b2', { author: 'Douglas Adams' }),
      ]),
    ).toBeNull();
  });

  test('an empty series seeds no author', () => {
    expect(sharedAuthorName([])).toBeNull();
    expect(sharedAuthorName([mkBook('b1', { author: '' })])).toBeNull();
  });
});
