import { getSeriesRowFacts } from '@/helpers/seriesRowFacts';
import {
  heroClusterCovers,
  heroPlayAction,
  seriesDetailRows,
} from '@/helpers/seriesDetailFacts';
import type { DerivedSeries } from '@/helpers/seriesAssembly';

const mkBook = (
  id: string,
  title: string,
  prog = 0,
  artwork: string | null = `/art/${id}.jpg`,
  dims: [number, number] = [500, 500],
) =>
  ({
    bookId: id,
    bookTitle: title,
    author: 'Terry Pratchett',
    bookProgressValue: prog,
    artwork,
    artworkWidth: dims[0],
    artworkHeight: dims[1],
    chapters: [{ url: `/${title}/1.mp3` }],
  }) as any;

const mkSeries = (
  books: any[],
  {
    canonicalNumbers,
    artwork = null,
  }: { canonicalNumbers?: (number | null)[]; artwork?: string | null } = {},
): DerivedSeries => ({
  id: 's1',
  name: 'Discworld',
  artwork,
  books,
  canonicalNumbers: canonicalNumbers ?? books.map(() => null),
  progressState: 'playing',
});

describe('rows (C9)', () => {
  test('one row per book, in series order, with its own canonical number', () => {
    const series = mkSeries(
      [mkBook('b1', 'Mort'), mkBook('b2', 'Sourcery'), mkBook('b3', 'Eric')],
      // A real series with gaps: the user owns 1, 3 and 8.
      { canonicalNumbers: [1, 3, 8] },
    );
    const rows = seriesDetailRows(series);

    expect(rows.map((r) => r.book.bookTitle)).toEqual([
      'Mort',
      'Sourcery',
      'Eric',
    ]);
    expect(rows.map((r) => r.canonicalNumber)).toEqual([1, 3, 8]);
  });

  test('an unnumbered book carries null, never its position', () => {
    const rows = seriesDetailRows(
      mkSeries([mkBook('b1', 'Mort'), mkBook('b2', 'Sourcery')], {
        canonicalNumbers: [1, null],
      }),
    );
    expect(rows[1].canonicalNumber).toBeNull();
  });

  test('finished is the tri-state 2, not "any progress"', () => {
    const rows = seriesDetailRows(
      mkSeries([
        mkBook('b1', 'Mort', 0),
        mkBook('b2', 'Sourcery', 1),
        mkBook('b3', 'Eric', 2),
      ]),
    );
    expect(rows.map((r) => r.finished)).toEqual([false, false, true]);
  });

  /*
   * Multi-membership is real (one book can sit in two series) and the harness
   * repeats real books to build a 22-book series, so `bookId` alone collides.
   */
  test('keys stay unique when the same book appears twice', () => {
    const mort = mkBook('b1', 'Mort');
    const rows = seriesDetailRows(mkSeries([mort, mort]));
    expect(new Set(rows.map((r) => r.key)).size).toBe(2);
  });

  test('a cover shape falls back to square when artwork was never measured', () => {
    const rows = seriesDetailRows(
      mkSeries([mkBook('b1', 'Mort', 0, null, [0, 0])]),
    );
    expect(rows[0].shape.aspect).toBe(1);
  });
});

describe('the hero fan (C8) — pinned art REPLACES card 0', () => {
  const books = [
    mkBook('b1', 'Mort'),
    mkBook('b2', 'Sourcery'),
    mkBook('b3', 'Eric'),
    mkBook('b4', 'Guards! Guards!'),
  ];

  test('derived art is the first book, and the fan caps at three layers', () => {
    const covers = heroClusterCovers(mkSeries(books));
    expect(covers).toHaveLength(3);
    expect(covers[0].uri).toBe('/art/b1.jpg');
  });

  test('pinned art rides the FRONT card without changing the layer count', () => {
    const derived = heroClusterCovers(mkSeries(books));
    const pinned = heroClusterCovers(
      mkSeries(books, { artwork: '/art/series.jpg' }),
    );

    // Same width and peek — that is the whole point of replacing rather than
    // prepending.
    expect(pinned).toHaveLength(derived.length);
    expect(pinned[0].uri).toBe('/art/series.jpg');
    // The cards BEHIND it are unchanged: book 1 is displaced, not shuffled.
    expect(pinned.slice(1)).toEqual(derived.slice(1));
  });

  test('a pinned cover is assumed square, because nothing measures it', () => {
    const [front] = heroClusterCovers(
      mkSeries(books, { artwork: '/art/series.jpg' }),
    );
    expect(front.aspect).toBe(1);
  });

  test('a series with no resolvable books still shows its pinned cover', () => {
    expect(heroClusterCovers(mkSeries([], { artwork: '/art/series.jpg' })))
      .toEqual([{ uri: '/art/series.jpg', aspect: 1 }]);
    expect(heroClusterCovers(mkSeries([]))).toEqual([]);
  });
});

describe('the hero play button (C9) — it keeps its word here', () => {
  const action = (series: DerivedSeries) =>
    heroPlayAction(series, getSeriesRowFacts(series));

  test('Start, when the next book has not been begun', () => {
    const series = mkSeries(
      [mkBook('b1', 'Mort', 2), mkBook('b2', 'Sourcery', 0)],
      { canonicalNumbers: [1, 2] },
    );
    expect(action(series)).toMatchObject({
      word: 'Start',
      label: 'Start · #2 Sourcery',
    });
    expect(action(series)!.book.bookId).toBe('b2');
  });

  test('Continue, when you are mid-book', () => {
    const series = mkSeries(
      [mkBook('b1', 'Mort', 2), mkBook('b2', 'Sourcery', 1)],
      { canonicalNumbers: [1, 2] },
    );
    expect(action(series)).toMatchObject({
      word: 'Continue',
      label: 'Continue · #2 Sourcery',
    });
  });

  /*
   * B3's rule: a finished series targets the FIRST book. Getting there without
   * landing in the credits is `handleBookPlay`'s job now (C5), not this
   * screen's.
   */
  test('Restart, targeting the first book, when the series is finished', () => {
    const series = mkSeries(
      [mkBook('b1', 'Mort', 2), mkBook('b2', 'Sourcery', 2)],
      { canonicalNumbers: [1, 2] },
    );
    expect(action(series)).toMatchObject({
      word: 'Restart',
      label: 'Restart · #1 Mort',
    });
    expect(action(series)!.book.bookId).toBe('b1');
  });

  test('an unnumbered book is named without a badge', () => {
    const series = mkSeries([mkBook('b1', 'Mort', 0)]);
    expect(action(series)!.label).toBe('Start · Mort');
  });

  /*
   * K16 leaves an all-excluded series standing, and a moved library can empty
   * one. There is nothing to play, and a button promising otherwise would lie.
   */
  test('null when there is nothing to play', () => {
    expect(action(mkSeries([]))).toBeNull();
  });
});
