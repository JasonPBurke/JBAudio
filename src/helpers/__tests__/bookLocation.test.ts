import {
  approximateLocationInBook,
  locateInBook,
  type LocationChapter,
} from '../bookLocation';
import { getHeapLimitBytes } from '@/helpers/deviceHeap';
import {
  multiItemChapters,
  oneChapterBookChapters,
  oneItemChapters,
} from './support/queueShapeFixtures';

jest.mock('@/constants/featureFlags', () => ({
  CLIPPED_CHAPTERS_SPIKE: true,
}));

jest.mock('@/helpers/deviceHeap', () => ({
  getHeapLimitBytes: jest.fn(() => 512 * 1024 * 1024),
}));

beforeEach(() => {
  (getHeapLimitBytes as jest.Mock).mockReturnValue(512 * 1024 * 1024);
});

/**
 * ⚠ Shape is signalled by the FIXTURES, never by a queue length — a row
 * carrying only `startMs` reads as multi-item. See the fixtures' header.
 */
const oneItem = () => oneItemChapters([0, 600_000, 1_200_000]);
const multiItem = () => multiItemChapters(3);

/**
 * ⚠ The cast is deliberate and is not a test convenience. `chapterDuration`
 * is typed non-optional, but the rows reaching this module come from the DB
 * and, on the live path, from a native bridge payload — types are erased long
 * before any of them arrive, which is the same argument `bookEndDetection`'s
 * header makes for reading its rows defensively. An `undefined` duration is a
 * real runtime state that the type system alone cannot rule out, so the exact
 * variant has to refuse it.
 */
const voidDurationAt = (
  chapters: LocationChapter[],
  index: number,
  duration: number | undefined,
): LocationChapter[] =>
  chapters.map((c, i) =>
    i === index ? ({ ...c, chapterDuration: duration } as LocationChapter) : c,
  );

describe('locateInBook — no Book to measure', () => {
  it('is null for missing chapters, not a record of nulls', () => {
    expect(
      locateInBook(undefined, {
        from: 'queue',
        queueIndex: 0,
        positionSeconds: 10,
      }),
    ).toBeNull();
  });

  it('is null for an empty chapter array', () => {
    expect(
      locateInBook([], { from: 'queue', queueIndex: 0, positionSeconds: 10 }),
    ).toBeNull();
  });

  it('is a record when there is a Book it cannot measure', () => {
    expect(
      locateInBook(multiItem(), {
        from: 'queue',
        queueIndex: null,
        positionSeconds: 10,
      }),
    ).toEqual({ bookPositionSeconds: null, chapter: null });
  });
});

describe('locateInBook — one-item Queue, a Position reading', () => {
  it('reports Position as Book Position and derives the Chapter from startMs', () => {
    expect(
      locateInBook(oneItem(), {
        from: 'queue',
        queueIndex: 0,
        positionSeconds: 700,
      }),
    ).toEqual({
      bookPositionSeconds: 700,
      chapter: { index: 1, positionSeconds: 100 },
    });
  });

  it('answers both coordinates even when the Queue index is unreadable', () => {
    expect(
      locateInBook(oneItem(), {
        from: 'queue',
        queueIndex: null,
        positionSeconds: 1_250,
      }),
    ).toEqual({
      bookPositionSeconds: 1_250,
      chapter: { index: 2, positionSeconds: 50 },
    });
  });

  it('is unaffected by an unusable chapterDuration — it sums none', () => {
    expect(
      locateInBook(voidDurationAt(oneItem(), 0, 0), {
        from: 'queue',
        queueIndex: 0,
        positionSeconds: 700,
      }),
    ).toEqual({
      bookPositionSeconds: 700,
      chapter: { index: 1, positionSeconds: 100 },
    });
  });

  it('locates inside a one-chapter Book', () => {
    expect(
      locateInBook(oneChapterBookChapters(), {
        from: 'queue',
        queueIndex: 0,
        positionSeconds: 50,
      }),
    ).toEqual({
      bookPositionSeconds: 50,
      chapter: { index: 0, positionSeconds: 50 },
    });
  });

  it('keeps Book Position but nulls the Chapter before the first boundary', () => {
    // A Book whose first chapter starts after a preamble: the position is
    // known exactly, but no chapter contains it — row 0 would be a guess.
    expect(
      locateInBook(oneItemChapters([60_000, 600_000]), {
        from: 'queue',
        queueIndex: 0,
        positionSeconds: 30,
      }),
    ).toEqual({ bookPositionSeconds: 30, chapter: null });
  });

  it('nulls the Chapter when every row sits at startMs 0 — no boundaries to read', () => {
    // The backwards scan would confidently answer the LAST row for every
    // position here. Book Position is still the raw Position, so it stands.
    expect(
      locateInBook(oneItemChapters([0, 0, 0]), {
        from: 'queue',
        queueIndex: 0,
        positionSeconds: 10,
      }),
    ).toEqual({ bookPositionSeconds: 10, chapter: null });
  });

  it('nulls both coordinates when the Position itself is unreadable', () => {
    expect(
      locateInBook(oneItem(), {
        from: 'queue',
        queueIndex: 0,
        positionSeconds: undefined,
      }),
    ).toEqual({ bookPositionSeconds: null, chapter: null });
  });
});

describe('locateInBook — one-item Queue, a Chapter Position reading', () => {
  it('adds the chapter start to reach Book Position', () => {
    expect(
      locateInBook(oneItem(), {
        from: 'chapter',
        chapterIndex: 1,
        chapterPositionSeconds: 100,
      }),
    ).toEqual({
      bookPositionSeconds: 700,
      chapter: { index: 1, positionSeconds: 100 },
    });
  });

  it('nulls BOTH coordinates for an unreadable chapter index — never chapter 0', () => {
    expect(
      locateInBook(oneItem(), {
        from: 'chapter',
        chapterIndex: null,
        chapterPositionSeconds: 100,
      }),
    ).toEqual({ bookPositionSeconds: null, chapter: null });
  });

  it('nulls both coordinates when the stored Chapter Position is unreadable', () => {
    expect(
      locateInBook(oneItem(), {
        from: 'chapter',
        chapterIndex: 1,
        chapterPositionSeconds: undefined,
      }),
    ).toEqual({ bookPositionSeconds: null, chapter: null });
  });

  it('locates a one-chapter Book from a Chapter Position reading', () => {
    expect(
      locateInBook(oneChapterBookChapters(), {
        from: 'chapter',
        chapterIndex: 0,
        chapterPositionSeconds: 50,
      }),
    ).toEqual({
      bookPositionSeconds: 50,
      chapter: { index: 0, positionSeconds: 50 },
    });
  });

  it('nulls both coordinates for an out-of-range chapter index', () => {
    expect(
      locateInBook(oneItem(), {
        from: 'chapter',
        chapterIndex: 3,
        chapterPositionSeconds: 100,
      }),
    ).toEqual({ bookPositionSeconds: null, chapter: null });
  });
});

describe('locateInBook — multi-item Queue', () => {
  it('takes the Chapter from the Queue index and sums the chapters before it', () => {
    expect(
      locateInBook(multiItem(), {
        from: 'queue',
        queueIndex: 2,
        positionSeconds: 100,
      }),
    ).toEqual({
      bookPositionSeconds: 1_300,
      chapter: { index: 2, positionSeconds: 100 },
    });
  });

  it('reads a Chapter Position reading identically — the coordinates coincide', () => {
    expect(
      locateInBook(multiItem(), {
        from: 'chapter',
        chapterIndex: 2,
        chapterPositionSeconds: 100,
      }),
    ).toEqual(
      locateInBook(multiItem(), {
        from: 'queue',
        queueIndex: 2,
        positionSeconds: 100,
      }),
    );
  });

  it('nulls both coordinates for an unreadable Queue index, never chapter 0', () => {
    expect(
      locateInBook(multiItem(), {
        from: 'queue',
        queueIndex: undefined,
        positionSeconds: 100,
      }),
    ).toEqual({ bookPositionSeconds: null, chapter: null });
  });

  it.each([
    ['out of range', 3],
    ['negative', -1],
    ['fractional', 1.5],
    ['not a number', Number.NaN],
  ])('refuses a %s Queue index', (_label, queueIndex) => {
    expect(
      locateInBook(multiItem(), {
        from: 'queue',
        queueIndex,
        positionSeconds: 100,
      }),
    ).toEqual({ bookPositionSeconds: null, chapter: null });
  });

  it.each([
    ['zero', 0],
    ['negative', -5],
    ['missing', undefined],
    ['not finite', Number.NaN],
  ])(
    'voids Book Position ONLY when a preceding chapterDuration is %s',
    (_label, duration) => {
      expect(
        locateInBook(voidDurationAt(multiItem(), 0, duration), {
          from: 'queue',
          queueIndex: 2,
          positionSeconds: 100,
        }),
      ).toEqual({
        bookPositionSeconds: null,
        chapter: { index: 2, positionSeconds: 100 },
      });
    },
  );

  it('still answers exactly when the unusable chapter is AFTER the playing one', () => {
    expect(
      locateInBook(voidDurationAt(multiItem(), 2, 0), {
        from: 'queue',
        queueIndex: 1,
        positionSeconds: 100,
      }),
    ).toEqual({
      bookPositionSeconds: 700,
      chapter: { index: 1, positionSeconds: 100 },
    });
  });

  it('nulls both coordinates when the Position is unreadable', () => {
    expect(
      locateInBook(multiItem(), {
        from: 'queue',
        queueIndex: 2,
        positionSeconds: Number.NaN,
      }),
    ).toEqual({ bookPositionSeconds: null, chapter: null });
  });
});

describe('approximateLocationInBook', () => {
  it('counts an unusable duration as zero where the exact answer is null', () => {
    const chapters = voidDurationAt(multiItem(), 0, 0);
    const reading = {
      from: 'queue' as const,
      queueIndex: 2,
      positionSeconds: 100,
    };

    expect(locateInBook(chapters, reading)).toEqual({
      bookPositionSeconds: null,
      chapter: { index: 2, positionSeconds: 100 },
    });
    expect(approximateLocationInBook(chapters, reading)).toEqual({
      bookPositionSeconds: 700,
      chapter: { index: 2, positionSeconds: 100 },
    });
  });

  it('agrees with the exact answer when every duration is usable', () => {
    const chapters = multiItem();
    const reading = {
      from: 'queue' as const,
      queueIndex: 2,
      positionSeconds: 100,
    };

    expect(approximateLocationInBook(chapters, reading)).toEqual(
      locateInBook(chapters, reading),
    );
  });

  it('approximates durations only — an unreadable index is still null', () => {
    expect(
      approximateLocationInBook(multiItem(), {
        from: 'queue',
        queueIndex: null,
        positionSeconds: 100,
      }),
    ).toEqual({ bookPositionSeconds: null, chapter: null });
  });

  it('has nothing to approximate on a one-item Queue — durations are unread', () => {
    const chapters = voidDurationAt(oneItem(), 0, 0);
    const reading = {
      from: 'queue' as const,
      queueIndex: 0,
      positionSeconds: 700,
    };

    expect(approximateLocationInBook(chapters, reading)).toEqual(
      locateInBook(chapters, reading),
    );
    expect(approximateLocationInBook(chapters, reading)).toEqual({
      bookPositionSeconds: 700,
      chapter: { index: 1, positionSeconds: 100 },
    });
  });

  it('does not fabricate a Chapter the exact variant refused', () => {
    expect(
      approximateLocationInBook(oneItemChapters([0, 0, 0]), {
        from: 'queue',
        queueIndex: 0,
        positionSeconds: 10,
      }),
    ).toEqual({ bookPositionSeconds: 10, chapter: null });
  });

  it('returns a fresh record each time, so a caller cannot poison the next', () => {
    const reading = {
      from: 'queue' as const,
      queueIndex: null,
      positionSeconds: 100,
    };
    const first = locateInBook(multiItem(), reading);
    const second = locateInBook(multiItem(), reading);

    expect(first).not.toBe(second);
  });

  it('is null for no Book, like the exact variant', () => {
    expect(
      approximateLocationInBook(undefined, {
        from: 'queue',
        queueIndex: 0,
        positionSeconds: 10,
      }),
    ).toBeNull();
  });
});
