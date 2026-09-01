import { resolveNextPress, type NextPressReading } from '../chapterSkip';
import {
  oneItemChapters,
  multiItemChapters,
} from './support/queueShapeFixtures';
import { Chapter } from '@/types/Book';

/*
 * What a remote Next press RESOLVES TO, at both ends of both Queue shapes.
 *
 * The defect this suite pins: at the last item of a multi-item Queue,
 * `skipToNext()` RESOLVES having moved nothing (native
 * `seekToNextMediaItem()` is a documented no-op there and the bridge resolves
 * unconditionally), so the caller cannot learn from the call that the press
 * went nowhere. `Event.RemoteNext` wrote a `chapter_change` footprint before
 * finding out — a breadcrumb back to a spot the user never left.
 *
 * ⚠ NO PLAYER HERE ANY MORE. The decision is pure: `nextPress.ts` reads the
 * Player once and hands the numbers down, so these cases are built by feeding
 * the same numbers through `locateInBook` — the real translator, not a stub,
 * because half of what is being pinned is that the two modules compose.
 */

/*
 * `chapterSkip` still imports the player adapter and the library store for
 * `skipToPreviousChapter`'s wiring; neither resolves in the node lane, and
 * nothing in this suite touches either.
 */
jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@/store/library', () => ({
  useLibraryStore: { getState: jest.fn(() => ({ books: {} })) },
}));

/** One 1800 s file, three chapters at 0 / 600 / 1200. */
const oneItemBook = oneItemChapters([0, 600_000, 1_200_000]) as Chapter[];
/** Three files, one chapter each. */
const multiItemBook = multiItemChapters(3) as Chapter[];

const reading = (
  chapters: readonly Chapter[] | undefined,
  {
    positionSeconds,
    queueIndex,
    queueLength,
    oneItemQueue,
  }: {
    positionSeconds: number;
    queueIndex: number | undefined;
    queueLength: number;
    oneItemQueue: boolean;
  },
): NextPressReading => ({
  chapters,
  positionSeconds,
  queueIndex,
  queueLength,
  oneItemQueue,
});

describe('resolveNextPress — multi-item Queue', () => {
  it('skips when there is a next queue item', () => {
    expect(
      resolveNextPress(
        reading(multiItemBook, {
          positionSeconds: 30,
          queueIndex: 0,
          queueLength: 3,
          oneItemQueue: false,
        }),
      ),
    ).toEqual({ kind: 'skip' });
  });

  it('resolves to none at the LAST queue item — the press moves nothing', () => {
    expect(
      resolveNextPress(
        reading(multiItemBook, {
          positionSeconds: 14,
          queueIndex: 2,
          queueLength: 3,
          oneItemQueue: false,
        }),
      ),
    ).toEqual({ kind: 'none' });
  });

  it('acts when the active index cannot be read — unknown is not index 0', () => {
    expect(
      resolveNextPress(
        reading(multiItemBook, {
          positionSeconds: 14,
          queueIndex: undefined,
          queueLength: 3,
          oneItemQueue: false,
        }),
      ),
    ).toEqual({ kind: 'skip' });
  });

  it('acts when the queue cannot be read', () => {
    expect(
      resolveNextPress(
        reading(multiItemBook, {
          positionSeconds: 14,
          queueIndex: 2,
          queueLength: 0,
          oneItemQueue: false,
        }),
      ),
    ).toEqual({ kind: 'skip' });
  });

  it('ignores the chapter list when the Queue is not one item', () => {
    // A clipped-chapter book: single-file in the DB, but ONE QUEUE ITEM PER
    // CHAPTER at runtime, so the queue decides and the chapters must not.
    expect(
      resolveNextPress(
        reading(oneItemBook, {
          positionSeconds: 14,
          queueIndex: 2,
          queueLength: 3,
          oneItemQueue: false,
        }),
      ),
    ).toEqual({ kind: 'none' });
  });
});

describe('resolveNextPress — one-item Queue', () => {
  it('seeks to the next chapter start', () => {
    expect(
      resolveNextPress(
        reading(oneItemBook, {
          positionSeconds: 30,
          queueIndex: 0,
          queueLength: 1,
          oneItemQueue: true,
        }),
      ),
    ).toEqual({ kind: 'chapter', seekSeconds: 600 });
  });

  it('resolves to finish in the LAST chapter — there is nowhere left to play', () => {
    expect(
      resolveNextPress(
        reading(oneItemBook, {
          positionSeconds: 1500,
          queueIndex: 0,
          queueLength: 1,
          oneItemQueue: true,
        }),
      ),
    ).toEqual({ kind: 'finish' });
  });

  it('seeks to the FIRST boundary from inside a preamble', () => {
    // The playhead precedes every boundary, so no Chapter can be named — and
    // the old index-first derivation named chapter 0 anyway and skipped past
    // the first chapter to the second. Book Position is exact here, so the
    // next boundary is.
    const preamble = oneItemChapters([90_000, 600_000]) as Chapter[];

    expect(
      resolveNextPress(
        reading(preamble, {
          positionSeconds: 30,
          queueIndex: 0,
          queueLength: 1,
          oneItemQueue: true,
        }),
      ),
    ).toEqual({ kind: 'chapter', seekSeconds: 90 });
  });

  it('does NOTHING when Book Position cannot be read — never finishes on a guess', () => {
    // An unusable Position voids both coordinates, so there is no boundary to
    // seek to and no honest way to tell "past the last chapter" from "could
    // not tell". Resolving to 'finish' on that would mark the Book Finished.
    expect(
      resolveNextPress(
        reading(oneItemBook, {
          positionSeconds: -1,
          queueIndex: 0,
          queueLength: 1,
          oneItemQueue: true,
        }),
      ),
    ).toEqual({ kind: 'none' });
  });

  it('falls back to the queue shape when chapters are missing', () => {
    // One item, no next item: a press has nowhere to go.
    expect(
      resolveNextPress(
        reading([], {
          positionSeconds: 30,
          queueIndex: 0,
          queueLength: 1,
          oneItemQueue: true,
        }),
      ),
    ).toEqual({ kind: 'none' });
  });
});
