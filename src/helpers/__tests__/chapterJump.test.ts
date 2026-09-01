import { performChapterJump, resolveChapterJump } from '../chapterJump';
import { createFakePlayer, type FakePlayer } from './support/fakePlayer';
import {
  multiItemChapters,
  oneChapterBookChapters,
  oneItemChapters,
} from './support/queueShapeFixtures';

jest.mock('@/constants/images', () => ({
  unknownBookImageUri: 'file:///fallback.png',
}));

jest.mock('@/constants/featureFlags', () => ({
  CLIPPED_CHAPTERS_SPIKE: true,
}));

let mockPlayer: FakePlayer;

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {
    seekTo: (...a: unknown[]) => mockPlayer.api.seekTo(...a),
    skip: (...a: unknown[]) => mockPlayer.api.skip(...a),
  },
}));

/** The two primitives the callers hold, as the domain type they belong to. */
const at = (index: number, positionSeconds: number) => ({
  index,
  positionSeconds,
});

/*
 * The decision behind "take me to that chapter", shared by the chapter list
 * and the footprint list. Pure: it names the transport, it does not perform
 * it (ADR 0003 decision 2 — `resolveNextPress` is the pattern).
 */
describe('resolveChapterJump', () => {
  describe('a one-item Queue', () => {
    // Three 600s chapters at 0 / 600s / 1200s in one file.
    const chapters = oneItemChapters([0, 600_000, 1_200_000]);

    it('seeks to the chapter start, in the Queue coordinates the Player speaks', () => {
      expect(resolveChapterJump(chapters, at(2, 0))).toEqual({
        kind: 'seek',
        bookPositionSeconds: 1200,
      });
    });

    it('carries a Chapter Position into the same seek', () => {
      expect(resolveChapterJump(chapters, at(1, 45))).toEqual({
        kind: 'seek',
        bookPositionSeconds: 645,
      });
    });

    it('declines an index that points at no chapter', () => {
      expect(resolveChapterJump(chapters, at(9, 0))).toBeNull();
      expect(resolveChapterJump(chapters, at(-1, 0))).toBeNull();
    });

    it('handles a Book that is one chapter in one file', () => {
      expect(resolveChapterJump(oneChapterBookChapters(), at(0, 30))).toEqual({
        kind: 'seek',
        bookPositionSeconds: 30,
      });
    });
  });

  describe('a multi-item Queue', () => {
    const chapters = multiItemChapters(3);

    it('steps to the chapter own Queue item, position unchanged', () => {
      expect(resolveChapterJump(chapters, at(2, 45))).toEqual({
        kind: 'skip',
        queueIndex: 2,
        chapterPositionSeconds: 45,
      });
    });

    it('declines an index that points at no chapter', () => {
      expect(resolveChapterJump(chapters, at(3, 0))).toBeNull();
    });

    // ⚠ The Book Position of a multi-item chapter is SUMMED from the
    // preceding durations and voids if any is unusable — but stepping to a
    // Queue item needs no such sum, so a damaged earlier chapter must not
    // refuse a jump that works perfectly well.
    it('still jumps when an earlier chapter duration is unusable', () => {
      const damaged = chapters.map((chapter, index) =>
        index === 0 ? { ...chapter, chapterDuration: 0 } : chapter,
      );
      expect(resolveChapterJump(damaged, at(2, 45))).toEqual({
        kind: 'skip',
        queueIndex: 2,
        chapterPositionSeconds: 45,
      });
    });
  });

  it('declines when there is no Book to jump within', () => {
    expect(resolveChapterJump(undefined, at(0, 0))).toBeNull();
    expect(resolveChapterJump([], at(0, 0))).toBeNull();
  });
});

/*
 * The transport half, against the simulated player (`support/fakePlayer.ts`)
 * rather than call spies alone: what matters is where the listener LANDS.
 * It exists so the two screens cannot drift apart — which the inline version
 * already had, one of them seeking after the skip and the other not.
 */
describe('performChapterJump', () => {
  it('seeks within the single item on a one-item Queue', async () => {
    mockPlayer = createFakePlayer({ durations: [1800], index: 0, position: 5 });

    await performChapterJump({ kind: 'seek', bookPositionSeconds: 645 });

    expect(mockPlayer.at()).toEqual({ index: 0, position: 645 });
    expect(mockPlayer.api.skip).not.toHaveBeenCalled();
  });

  it('steps to the Queue item and then into it on a multi-item Queue', async () => {
    mockPlayer = createFakePlayer({
      durations: [600, 600, 600],
      index: 0,
      position: 5,
    });

    await performChapterJump({
      kind: 'skip',
      queueIndex: 2,
      chapterPositionSeconds: 45,
    });

    expect(mockPlayer.at()).toEqual({ index: 2, position: 45 });
  });

  // A freshly skipped-to item already starts at 0, so the second call would
  // buy nothing. Asserted rather than assumed, because the two screens used
  // to disagree about it.
  it('does not seek when the Chapter Position is the chapter start', async () => {
    mockPlayer = createFakePlayer({
      durations: [600, 600, 600],
      index: 0,
      position: 5,
    });

    await performChapterJump({
      kind: 'skip',
      queueIndex: 1,
      chapterPositionSeconds: 0,
    });

    expect(mockPlayer.at()).toEqual({ index: 1, position: 0 });
    expect(mockPlayer.api.seekTo).not.toHaveBeenCalled();
  });
});
