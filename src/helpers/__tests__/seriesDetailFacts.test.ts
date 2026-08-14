import { getSeriesRowFacts } from '@/helpers/seriesRowFacts';
import {
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
  origin: 'detected',
  createdAt: 0,
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

/*
 * ⚠ THE HERO FAN'S TESTS MOVED — §C8 AMENDED 2026-08-11, driver ruling.
 *
 * They used to live here and assert that pinned series art replaced the fan's
 * front card. The ruling reversed that: series art is BACKGROUND-ONLY and never
 * enters the fan, so the hero draws `getSeriesRowFacts().cluster` — the same
 * computation the browse row draws — and `heroClusterCovers` was deleted rather
 * than left forwarding to it.
 *
 * The assertion that pinned art must NOT reach a fan is now in
 * `seriesRowFacts.test.ts`, where ONE test guards both surfaces at once. The
 * backdrop's own expression is asserted in `seriesArtwork.test.ts`.
 */

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
