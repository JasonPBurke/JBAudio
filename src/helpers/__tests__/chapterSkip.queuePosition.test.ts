import { skipToPreviousChapter } from '../chapterSkip';
import { createFakePlayer, type FakePlayer } from './support/fakePlayer';

/*
 * Regression suite for skip-previous AT THE ENDS OF THE QUEUE.
 *
 * `chapterSkip.test.ts` asserts on the calls issued; these tests run against
 * the simulated player (see `support/fakePlayer.ts`) and assert on where
 * playback actually LANDS. That is the only assertion that can see this class
 * of bug: at the first queue item `skipToPrevious()` RESOLVES having moved
 * nothing (native `seekToPreviousMediaItem()` is a documented no-op there and
 * the bridge resolves unconditionally), so a `skipToPrevious` spy is perfectly
 * happy while the user's press did nothing at all.
 *
 * The book below is a multi-file Book: three queue items, one per chapter, so
 * positions are chapter-relative.
 */

let mockPlayer: FakePlayer;

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {
    getProgress: (...a: unknown[]) => mockPlayer.api.getProgress(...a),
    getQueue: (...a: unknown[]) => mockPlayer.api.getQueue(...a),
    getActiveTrackIndex: (...a: unknown[]) =>
      mockPlayer.api.getActiveTrackIndex(...a),
    getActiveTrack: (...a: unknown[]) => mockPlayer.api.getActiveTrack(...a),
    seekTo: (...a: unknown[]) => mockPlayer.api.seekTo(...a),
    skipToPrevious: (...a: unknown[]) => mockPlayer.api.skipToPrevious(...a),
  },
}));

jest.mock('@/store/library', () => ({
  useLibraryStore: { getState: jest.fn(() => ({ books: {} })) },
}));

const CHAPTERS = [600, 600, 600];

describe('skipToPreviousChapter — first queue item of a multi-item book', () => {
  it('restarts the book within the first 15s instead of doing nothing', async () => {
    mockPlayer = createFakePlayer({
      durations: CHAPTERS,
      index: 0,
      position: 10,
    });

    await skipToPreviousChapter();

    expect(mockPlayer.at()).toEqual({ index: 0, position: 0 });
  });

  it('still restarts the chapter past 15s', async () => {
    mockPlayer = createFakePlayer({
      durations: CHAPTERS,
      index: 0,
      position: 42,
    });

    await skipToPreviousChapter();

    expect(mockPlayer.at()).toEqual({ index: 0, position: 0 });
  });
});

describe('skipToPreviousChapter — later queue items are unchanged', () => {
  it('lands at the start of the previous chapter within the first 15s', async () => {
    mockPlayer = createFakePlayer({
      durations: CHAPTERS,
      index: 1,
      position: 10,
    });

    await skipToPreviousChapter();

    expect(mockPlayer.at()).toEqual({ index: 0, position: 0 });
    expect(mockPlayer.api.skipToPrevious).toHaveBeenCalledTimes(1);
  });

  it('restarts the current chapter past 15s, staying on the same item', async () => {
    mockPlayer = createFakePlayer({
      durations: CHAPTERS,
      index: 2,
      position: 42,
    });

    await skipToPreviousChapter();

    expect(mockPlayer.at()).toEqual({ index: 2, position: 0 });
    expect(mockPlayer.api.skipToPrevious).not.toHaveBeenCalled();
  });
});
