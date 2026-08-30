import { seekBack, seekForward } from '../relativeSeek';
import { createFakePlayer, type FakePlayer } from './support/fakePlayer';

/*
 * Regression suite for seeks that span MORE than one queue item.
 *
 * Unlike `relativeSeek.test.ts`, which asserts on the calls issued, these
 * tests run against a simulated player (see `support/fakePlayer.ts`) and
 * assert on where playback actually LANDS — the only assertion that can see
 * this class of bug, because a wrong target still "calls seekTo".
 *
 * The book below is real: a 14s intro, a 13s copyright notice, then a 10m10s
 * first chapter. With a 60s skip, one tap has to cross two boundaries.
 *
 * These cover BOTH shapes the user reproduced on. A multi-file book and a
 * chaptered single-file book are the same shape here: with
 * CLIPPED_CHAPTERS_SPIKE on, `buildClippedChapterTracks` gives a single file
 * one queue item per chapter, with chapter-relative positions. The legacy
 * single-track shape (a book that fails the heap gate, or has auto-generated
 * chapters) keeps absolute positions and is covered separately below.
 */

let mockPlayer: FakePlayer;

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {
    getPlaybackState: (...a: unknown[]) => mockPlayer.api.getPlaybackState(...a),
    getProgress: (...a: unknown[]) => mockPlayer.api.getProgress(...a),
    getQueue: (...a: unknown[]) => mockPlayer.api.getQueue(...a),
    getActiveTrackIndex: (...a: unknown[]) =>
      mockPlayer.api.getActiveTrackIndex(...a),
    getActiveTrack: (...a: unknown[]) => mockPlayer.api.getActiveTrack(...a),
    seekTo: (...a: unknown[]) => mockPlayer.api.seekTo(...a),
    skipToNext: (...a: unknown[]) => mockPlayer.api.skipToNext(...a),
    skipToPrevious: (...a: unknown[]) => mockPlayer.api.skipToPrevious(...a),
    skip: (...a: unknown[]) => mockPlayer.api.skip(...a),
    play: (...a: unknown[]) => mockPlayer.api.play(...a),
    pause: (...a: unknown[]) => mockPlayer.api.pause(...a),
  },
  State: {
    None: 'none',
    Ready: 'ready',
    Playing: 'playing',
    Paused: 'paused',
    Stopped: 'stopped',
    Loading: 'loading',
    Buffering: 'buffering',
    Error: 'error',
    Ended: 'ended',
  },
}));

const mockUpdateBookProgress = jest.fn().mockResolvedValue(undefined);
jest.mock('@/db/bookQueries', () => ({
  getBookById: jest.fn(async () => ({
    updateBookProgress: mockUpdateBookProgress,
  })),
}));
jest.mock('@/helpers/bookProgressState', () => ({
  BookProgressState: { NotStarted: 0, Started: 1, Finished: 2 },
}));
// The finish branch's already-Finished guard reads the library store, which
// reaches WatermelonDB's SQLite adapter — unresolvable in the node lane. No
// Book here is Finished, so an empty map leaves the branch as it was.
jest.mock('@/store/library', () => ({
  useLibraryStore: { getState: () => ({ books: {} }) },
}));
// Same reason: the finish branch's Book rewind reaches the store and the
// chapter tables. What it writes is `resetBookToStart`'s own test's business;
// these tests assert where playback LANDS, so the rewind is stubbed out.
jest.mock('@/helpers/chapterTracking', () => ({
  rewindChapterTracking: jest.fn(async () => {}),
}));

// 14s intro, 13s copyright, 10m10s chapter one.
const SHORT_INTRO_BOOK = [14, 13, 610];

beforeEach(() => {
  mockUpdateBookProgress.mockClear();
});

describe('seekBack across several short chapters', () => {
  it('lands 60s earlier in the book, not at the boundary it passed', () => {
    // 10s into chapter three: only 37s of book has been heard.
    mockPlayer = createFakePlayer({
      durations: SHORT_INTRO_BOOK,
      index: 2,
      position: 10,
    });

    return seekBack(60).then(() => {
      // 37 - 60 is before the book starts, so clamp to the very beginning.
      expect(mockPlayer.at()).toEqual({ index: 0, position: 0 });
    });
  });

  it('crosses two boundaries and keeps the remainder', async () => {
    // 5s into chapter three (absolute 32s); back 20s lands at absolute 12s,
    // which is 12s into the 14s intro.
    mockPlayer = createFakePlayer({
      durations: SHORT_INTRO_BOOK,
      index: 2,
      position: 5,
    });

    await seekBack(20);

    expect(mockPlayer.at()).toEqual({ index: 0, position: 12 });
  });

  it('still crosses a single boundary correctly', async () => {
    // 15s into chapter three, back 30s => absolute 42 - 30 = 12s.
    mockPlayer = createFakePlayer({
      durations: [600, 600, 600],
      index: 1,
      position: 15,
    });

    await seekBack(30);

    expect(mockPlayer.at()).toEqual({ index: 0, position: 585 });
  });
});

describe('seekForward across several short chapters', () => {
  it('lands 60s later in the book, not at the boundary it passed', async () => {
    // Start of the book: 60s forward is 33s into chapter three.
    mockPlayer = createFakePlayer({
      durations: SHORT_INTRO_BOOK,
      index: 0,
      position: 0,
    });

    await seekForward(60);

    expect(mockPlayer.at()).toEqual({ index: 2, position: 33 });
  });

  it('finishes the book when the overshoot clears every remaining chapter', async () => {
    // 5s into the 13s copyright notice, with only a 14s chapter after it.
    mockPlayer = createFakePlayer({
      durations: [600, 13, 14],
      index: 1,
      position: 5,
      playing: true,
    });

    await seekForward(60);

    expect(mockUpdateBookProgress).toHaveBeenCalledWith(2); // Finished
    expect(mockPlayer.at()).toEqual({ index: 0, position: 0 });
    expect(mockPlayer.isPlaying()).toBe(false);
  });

  it('still crosses a single boundary correctly', async () => {
    mockPlayer = createFakePlayer({
      durations: [600, 600, 600],
      index: 1,
      position: 590,
    });

    await seekForward(30);

    expect(mockPlayer.at()).toEqual({ index: 2, position: 20 });
  });
});

describe('the legacy single-track queue is unaffected', () => {
  // A single-file book that fails the clipped-chapters gate loads as ONE item
  // with absolute positions, so a seek crosses virtual chapters with no
  // boundary to stop at. Only the book's own edges need clamping.
  it('seeks straight through virtual chapter boundaries', async () => {
    mockPlayer = createFakePlayer({
      durations: [3600],
      index: 0,
      position: 20,
    });

    await seekForward(60);

    expect(mockPlayer.at()).toEqual({ index: 0, position: 80 });
  });

  it('clamps to the start of the book', async () => {
    mockPlayer = createFakePlayer({
      durations: [3600],
      index: 0,
      position: 20,
    });

    await seekBack(60);

    expect(mockPlayer.at()).toEqual({ index: 0, position: 0 });
  });
});

describe('chapters with no duration metadata', () => {
  // `duration` comes from the chapter row's `chapterDuration`, which an
  // untagged rip can leave missing. A seek must then stop at the boundary it
  // cannot measure past rather than guess — no worse than today's behavior,
  // and never a landing in the wrong place.
  it('stops at the boundary it cannot measure past, going back', async () => {
    mockPlayer = createFakePlayer({
      durations: [14, 13, 610],
      index: 2,
      position: 10,
      withoutTrackDurations: true,
    });

    await seekBack(60);

    expect(mockPlayer.at()).toEqual({ index: 2, position: 0 });
  });
});
