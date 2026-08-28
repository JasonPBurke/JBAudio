import { resolveNextPress } from '../chapterSkip';
import { createFakePlayer, type FakePlayer } from './support/fakePlayer';
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
 * Answering that means ASKING where in the Queue we are, which is why this
 * runs against the simulated player rather than call spies.
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
    skipToNext: (...a: unknown[]) => mockPlayer.api.skipToNext(...a),
    skipToPrevious: (...a: unknown[]) => mockPlayer.api.skipToPrevious(...a),
  },
}));

jest.mock('@/store/library', () => ({
  useLibraryStore: { getState: jest.fn(() => ({ books: {} })) },
}));

const chapter = (startMs: number): Chapter => ({
  author: 'A',
  bookTitle: 'B',
  chapterTitle: `Ch ${startMs}`,
  chapterNumber: startMs,
  chapterDuration: 600,
  startMs,
  url: 'file://book.m4b',
});

/** One 1800 s file, three chapters at 0 / 600 / 1200. */
const SINGLE_FILE_CHAPTERS = [chapter(0), chapter(600_000), chapter(1_200_000)];

describe('resolveNextPress — multi-item Queue', () => {
  it('skips when there is a next queue item', async () => {
    mockPlayer = createFakePlayer({
      durations: [600, 600, 600],
      index: 0,
      position: 30,
    });

    await expect(resolveNextPress(undefined, false)).resolves.toEqual({
      kind: 'skip',
    });
  });

  it('resolves to none at the LAST queue item — the press moves nothing', async () => {
    mockPlayer = createFakePlayer({
      durations: [600, 600, 600],
      index: 2,
      position: 14,
    });

    await expect(resolveNextPress(undefined, false)).resolves.toEqual({
      kind: 'none',
    });
  });

  it('acts when the active index cannot be read — unknown is not index 0', async () => {
    mockPlayer = createFakePlayer({
      durations: [600, 600, 600],
      index: 2,
      position: 14,
    });
    mockPlayer.api.getActiveTrackIndex.mockResolvedValue(undefined);

    await expect(resolveNextPress(undefined, false)).resolves.toEqual({
      kind: 'skip',
    });
  });

  it('acts when the queue cannot be read', async () => {
    mockPlayer = createFakePlayer({
      durations: [600, 600, 600],
      index: 2,
      position: 14,
    });
    mockPlayer.api.getQueue.mockResolvedValue([]);

    await expect(resolveNextPress(undefined, false)).resolves.toEqual({
      kind: 'skip',
    });
  });

  it('ignores the chapter list when the book is not treated as single-file', async () => {
    // A clipped-chapter book: single-file in the DB, but ONE QUEUE ITEM PER
    // CHAPTER at runtime, so the queue decides and the chapters must not.
    mockPlayer = createFakePlayer({
      durations: [600, 600, 600],
      index: 2,
      position: 14,
    });

    await expect(
      resolveNextPress({ chapters: SINGLE_FILE_CHAPTERS }, false),
    ).resolves.toEqual({ kind: 'none' });
  });
});

describe('resolveNextPress — legacy single-file Queue', () => {
  it('seeks to the next chapter start', async () => {
    mockPlayer = createFakePlayer({
      durations: [1800],
      index: 0,
      position: 30,
    });

    await expect(
      resolveNextPress({ chapters: SINGLE_FILE_CHAPTERS }, true),
    ).resolves.toEqual({ kind: 'chapter', seekSeconds: 600 });
  });

  it('resolves to finish in the LAST chapter — there is nowhere left to play', async () => {
    mockPlayer = createFakePlayer({
      durations: [1800],
      index: 0,
      position: 1500,
    });

    await expect(
      resolveNextPress({ chapters: SINGLE_FILE_CHAPTERS }, true),
    ).resolves.toEqual({ kind: 'finish' });
  });

  it('falls back to the queue shape when chapters are missing', async () => {
    mockPlayer = createFakePlayer({
      durations: [1800],
      index: 0,
      position: 30,
    });

    // One item, no next item: a press has nowhere to go.
    await expect(resolveNextPress({ chapters: [] }, true)).resolves.toEqual({
      kind: 'none',
    });
  });
});
