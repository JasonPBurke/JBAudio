import {
  getSeriesRowFacts,
  nextUpLine,
  seriesMetaLine,
} from '@/helpers/seriesRowFacts';
import type { DerivedSeries } from '@/helpers/seriesAssembly';

const mkBook = (
  title: string,
  progress = 0,
  artwork: string | null = `/art/${title}.jpg`,
  dims: [number | null, number | null] = [500, 500],
) =>
  ({
    bookId: title,
    bookTitle: title,
    bookProgressValue: progress,
    artwork,
    artworkWidth: dims[0],
    artworkHeight: dims[1],
    chapters: [{ url: `/${title}/1.mp3` }],
  }) as any;

const mkSeries = (
  books: any[],
  canonicalNumbers?: (number | null)[],
): DerivedSeries => ({
  id: 's1',
  name: 'Discworld',
  artwork: null,
  books,
  canonicalNumbers: canonicalNumbers ?? books.map(() => null),
  progressState: 'playing',
});

describe('completion is a COUNT (K12)', () => {
  test('one finished of seven is 1/7, never the average of a tri-state field', () => {
    const facts = getSeriesRowFacts(
      mkSeries([
        mkBook('a', 2),
        mkBook('b', 1),
        mkBook('c'),
        mkBook('d'),
        mkBook('e'),
        mkBook('f'),
        mkBook('g'),
      ]),
    );
    expect(facts.finishedCount).toBe(1);
    expect(facts.bookCount).toBe(7);
    // Averaging bookProgressValue would render this as 0.214; averaging a
    // half-read book as "half finished" is the defect K12 names.
    expect(facts.completion).toBeCloseTo(1 / 7, 5);
  });

  test('an empty series is 0, not NaN', () => {
    const facts = getSeriesRowFacts(mkSeries([]));
    expect(facts.completion).toBe(0);
    expect(facts.bookCount).toBe(0);
  });
});

describe('next-up', () => {
  test('is the first book that is not finished', () => {
    const facts = getSeriesRowFacts(
      mkSeries([mkBook('a', 2), mkBook('b', 2), mkBook('c', 1), mkBook('d')]),
    );
    expect(facts.nextUp?.bookTitle).toBe('c');
    expect(facts.nextUpIndex).toBe(2);
    expect(facts.nextUpStarted).toBe(true);
  });

  test('is null when every book is finished', () => {
    const facts = getSeriesRowFacts(mkSeries([mkBook('a', 2), mkBook('b', 2)]));
    expect(facts.nextUp).toBeNull();
  });

  test('carries the canonical number of that book, index-aligned', () => {
    const facts = getSeriesRowFacts(
      mkSeries([mkBook('a', 2), mkBook('b')], [8, 9]),
    );
    expect(facts.nextUpNumber).toBe(9);
  });

  test('has no number when the book is unnumbered', () => {
    const facts = getSeriesRowFacts(
      mkSeries([mkBook('a', 2), mkBook('b')], [8, null]),
    );
    expect(facts.nextUpNumber).toBeNull();
  });
});

describe('the three next-up states (B3)', () => {
  test('an untouched next book reads Next', () => {
    const facts = getSeriesRowFacts(
      mkSeries([mkBook('Guards', 2), mkBook('Eric')], [8, 9]),
    );
    expect(nextUpLine(facts)).toEqual({
      state: 'next',
      text: 'Next · #9 Eric',
    });
  });

  test('a part-read next book reads Continue', () => {
    const facts = getSeriesRowFacts(
      mkSeries([mkBook('Guards', 2), mkBook('Eric', 1)], [8, 9]),
    );
    expect(nextUpLine(facts)).toEqual({
      state: 'continue',
      text: 'Continue · #9 Eric',
    });
  });

  test('a finished series reads Series complete — the third state B3 needs', () => {
    const facts = getSeriesRowFacts(
      mkSeries([mkBook('Guards', 2), mkBook('Eric', 2)], [8, 9]),
    );
    expect(nextUpLine(facts)).toEqual({
      state: 'complete',
      text: 'Series complete',
    });
  });

  test('an unnumbered book drops the # rather than showing a blank one', () => {
    const facts = getSeriesRowFacts(mkSeries([mkBook('Eric')], [null]));
    expect(nextUpLine(facts)).toEqual({ state: 'next', text: 'Next · Eric' });
  });

  test('a series with no resolvable books has no next-up line at all', () => {
    expect(nextUpLine(getSeriesRowFacts(mkSeries([])))).toBeNull();
  });
});

describe('the meta line and its sacrifice order (H9)', () => {
  const facts = () =>
    getSeriesRowFacts(
      mkSeries(
        [
          mkBook('a', 2),
          mkBook('b', 2),
          mkBook('c'),
          mkBook('d'),
          mkBook('e'),
          mkBook('f'),
        ],
        [1, 2, 3, 4, 5, 6],
      ),
    );

  test('states count, tally and canonical range when it fits', () => {
    expect(seriesMetaLine(facts(), { overflowing: false })).toBe(
      '6 books · 2 finished · #1-6',
    );
  });

  test('drops `M finished` FIRST when the line overflows, keeping the range', () => {
    // The completion bar renders 2/6 directly beneath, so the tally is the one
    // redundant segment; the range has no other home on browse.
    expect(seriesMetaLine(facts(), { overflowing: true })).toBe(
      '6 books · #1-6',
    );
  });

  test('a single book is not pluralised', () => {
    const one = getSeriesRowFacts(mkSeries([mkBook('a')], [1]));
    expect(seriesMetaLine(one, { overflowing: false })).toBe('1 book · #1');
  });

  test('an all-finished series says so without a count', () => {
    const done = getSeriesRowFacts(
      mkSeries([mkBook('a', 2), mkBook('b', 2)], [1, 2]),
    );
    expect(seriesMetaLine(done, { overflowing: false })).toBe(
      '2 books · finished · #1-2',
    );
  });

  test('an untouched series shows no tally to drop', () => {
    const fresh = getSeriesRowFacts(mkSeries([mkBook('a'), mkBook('b')], [1, 2]));
    expect(seriesMetaLine(fresh, { overflowing: false })).toBe(
      '2 books · #1-2',
    );
    expect(seriesMetaLine(fresh, { overflowing: true })).toBe('2 books · #1-2');
  });

  test('an unnumbered series shows no range', () => {
    const bare = getSeriesRowFacts(mkSeries([mkBook('a', 2), mkBook('b')]));
    expect(seriesMetaLine(bare, { overflowing: false })).toBe(
      '2 books · 1 finished',
    );
  });
});

describe('the cover cluster', () => {
  test('takes the first covers in series order, capped at the layer count', () => {
    const facts = getSeriesRowFacts(
      mkSeries([mkBook('a'), mkBook('b'), mkBook('c'), mkBook('d')]),
    );
    expect(facts.cluster.map((c) => c.uri)).toEqual([
      '/art/a.jpg',
      '/art/b.jpg',
      '/art/c.jpg',
    ]);
  });

  test('keeps repeats, so a boxset sharing one cover still fans as a set', () => {
    // Deduping would draw a 22-book series as one lone cover — the very shape
    // K13 exists to prevent.
    const facts = getSeriesRowFacts(
      mkSeries([
        mkBook('a', 0, '/art/set.jpg'),
        mkBook('b', 0, '/art/set.jpg'),
        mkBook('c', 0, '/art/set.jpg'),
      ]),
    );
    expect(facts.cluster).toHaveLength(3);
  });

  test('carries each cover’s true aspect so the artwork is not distorted', () => {
    const facts = getSeriesRowFacts(
      mkSeries([mkBook('tall', 0, '/art/t.jpg', [1000, 1500])]),
    );
    expect(facts.cluster[0].aspect).toBeCloseTo(2 / 3, 5);
  });

  test('falls back to square when artwork dimensions are missing', () => {
    const facts = getSeriesRowFacts(
      mkSeries([mkBook('x', 0, null, [null, null])]),
    );
    expect(facts.cluster[0]).toEqual({ uri: null, aspect: 1 });
  });
});
