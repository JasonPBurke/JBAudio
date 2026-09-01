import { resolvePreviousPress, type PressReading } from '../chapterSkip';
import {
  oneItemChapters,
  multiItemChapters,
} from './support/queueShapeFixtures';
import { Chapter } from '@/types/Book';

/*
 * What a skip-to-PREVIOUS press resolves to, as arithmetic.
 *
 * These cases moved here from `singleFileBook.test.ts`, which pinned them
 * against `getPreviousPressTarget` — a one-item-only target calculator that
 * was correct only because its caller had branched on Queue shape first. The
 * decision now takes a `PressReading` and answers for both shapes, so the
 * cases belong beside it.
 *
 * ⚠ NO PLAYER. `skipToPreviousChapter` reads once and hands the numbers down;
 * the readings below are built through the real `locateInBook`, because half
 * of what is pinned here is that the two modules compose.
 */

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@/store/library', () => ({
  useLibraryStore: { getState: jest.fn(() => ({ books: {} })) },
}));

const THRESHOLD = 15;

/** One file, chapters at 0:00, 10:00, 20:00. */
const oneItemBook = oneItemChapters([0, 600_000, 1_200_000]) as Chapter[];
/** Three files, one chapter each. */
const multiItemBook = multiItemChapters(3) as Chapter[];

const reading = (
  chapters: readonly Chapter[] | undefined,
  positionSeconds: number,
  queueIndex: number | undefined,
  oneItemQueue: boolean,
): PressReading => ({
  chapters,
  positionSeconds,
  queueIndex,
  oneItemQueue,
});

describe('resolvePreviousPress — one-item Queue', () => {
  it('restarts the current chapter when more than the threshold has elapsed', () => {
    // 16s into chapter 2 (starts at 600s)
    expect(resolvePreviousPress(reading(oneItemBook, 616, 0, true), THRESHOLD))
      .toEqual({ kind: 'restart', move: { to: 'seek', seekSeconds: 600 } });
  });

  it('goes to the previous chapter when at most the threshold has elapsed', () => {
    // 10s into chapter 2
    expect(resolvePreviousPress(reading(oneItemBook, 610, 0, true), THRESHOLD))
      .toEqual({ kind: 'previous', move: { to: 'seek', seekSeconds: 0 } });
  });

  it('goes to the previous chapter at exactly the threshold (inclusive)', () => {
    // exactly 15s into chapter 3 → chapter 2 start
    expect(resolvePreviousPress(reading(oneItemBook, 1215, 0, true), THRESHOLD))
      .toEqual({ kind: 'previous', move: { to: 'seek', seekSeconds: 600 } });
  });

  it('restarts the current chapter just past the threshold', () => {
    const action = resolvePreviousPress(
      reading(oneItemBook, 1215.5, 0, true),
      THRESHOLD,
    );
    expect(action.kind).toBe('restart');
    expect(action.move).toEqual({
      to: 'seek',
      seekSeconds: expect.closeTo(1200, 6),
    });
  });

  /*
   * ⚠ THIS USED TO REPORT 'previous'. The seek target is unchanged — the
   * start of the Book either way — but a press that stays in chapter 1 did
   * not change chapter, so labelling it 'previous' wrote a `chapter_change`
   * footprint for a chapter that never changed. 'restart' is what the
   * multi-item side has always answered at the first Queue item, and what
   * this file's header has always claimed for both shapes.
   */
  it('restarts the Book — not "previous" — early in the first chapter', () => {
    expect(resolvePreviousPress(reading(oneItemBook, 10, 0, true), THRESHOLD))
      .toEqual({ kind: 'restart', move: { to: 'seek', seekSeconds: 0 } });
  });

  it('restarts the first chapter when beyond the threshold in it', () => {
    expect(resolvePreviousPress(reading(oneItemBook, 300, 0, true), THRESHOLD))
      .toEqual({ kind: 'restart', move: { to: 'seek', seekSeconds: 0 } });
  });

  it('treats a single-chapter or empty list as a restart to 0', () => {
    const single = oneItemChapters([0]) as Chapter[];

    expect(resolvePreviousPress(reading(single, 500, 0, true), THRESHOLD))
      .toEqual({ kind: 'restart', move: { to: 'seek', seekSeconds: 0 } });
    expect(resolvePreviousPress(reading([], 500, 0, true), THRESHOLD))
      .toEqual({ kind: 'restart', move: { to: 'seek', seekSeconds: 0 } });
  });

  it('restarts when the rows carry no boundaries to navigate between', () => {
    // Every row at startMs 0: the translator refuses to name a Chapter rather
    // than answering the LAST row for every position, which is what the raw
    // backwards scan does. A one-item Queue with nothing to navigate WITHIN
    // has one honest move left.
    const noBoundaries = oneItemChapters([0, 0, 0]) as Chapter[];

    expect(
      resolvePreviousPress(reading(noBoundaries, 900, 0, true), THRESHOLD),
    ).toEqual({ kind: 'restart', move: { to: 'seek', seekSeconds: 0 } });
  });
});

describe('resolvePreviousPress — multi-item Queue', () => {
  it('restarts the current item beyond the threshold — the Position is already chapter-relative', () => {
    expect(
      resolvePreviousPress(reading(multiItemBook, 42, 1, false), THRESHOLD),
    ).toEqual({ kind: 'restart', move: { to: 'seek', seekSeconds: 0 } });
  });

  it('steps to the previous Queue item within the threshold', () => {
    expect(
      resolvePreviousPress(reading(multiItemBook, 10, 1, false), THRESHOLD),
    ).toEqual({ kind: 'previous', move: { to: 'previous-item' } });
  });

  it('restarts the Book at the first Queue item', () => {
    expect(
      resolvePreviousPress(reading(multiItemBook, 10, 0, false), THRESHOLD),
    ).toEqual({ kind: 'restart', move: { to: 'seek', seekSeconds: 0 } });
  });

  it('acts when the Queue index cannot be read — unknown is not index 0', () => {
    expect(
      resolvePreviousPress(
        reading(multiItemBook, 10, undefined, false),
        THRESHOLD,
      ),
    ).toEqual({ kind: 'previous', move: { to: 'previous-item' } });
  });

  it('falls back to the raw Position when there are no chapter rows', () => {
    expect(resolvePreviousPress(reading([], 500, 1, false), THRESHOLD)).toEqual(
      { kind: 'restart', move: { to: 'seek', seekSeconds: 0 } },
    );
  });
});
