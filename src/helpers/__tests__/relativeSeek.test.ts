import TrackPlayer, { State } from 'react-native-track-player';
import { seekBack, seekForward } from '../relativeSeek';
import { getBookById } from '@/db/bookQueries';
import { addFootprint } from '@/db/footprintQueries';
import { rewindChapterTracking } from '@/helpers/chapterTracking';

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {
    getPlaybackState: jest.fn(),
    getProgress: jest.fn(),
    getQueue: jest.fn(),
    getActiveTrackIndex: jest.fn(),
    getActiveTrack: jest.fn(),
    seekTo: jest.fn().mockResolvedValue(undefined),
    skipToPrevious: jest.fn().mockResolvedValue(undefined),
    skipToNext: jest.fn().mockResolvedValue(undefined),
    skip: jest.fn().mockResolvedValue(undefined),
    play: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
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

jest.mock('@/db/bookQueries', () => ({
  getBookById: jest.fn(),
}));

jest.mock('@/helpers/bookProgressState', () => ({
  BookProgressState: { NotStarted: 0, Started: 1, Finished: 2 },
}));

// The library store reaches WatermelonDB's SQLite adapter, which does not
// resolve in the node lane. Only the finish branch reads it — for the
// already-Finished guard — so the stub is a books map the tests fill.
let mockBooks: Record<string, { bookProgressValue?: number }>;
jest.mock('@/store/library', () => ({
  useLibraryStore: { getState: () => ({ books: mockBooks }) },
}));

// Nothing in this module may write a footprint; see the regression describe
// at the bottom of this file for why that is asserted rather than assumed.
jest.mock('@/db/footprintQueries', () => ({
  addFootprint: jest.fn(),
}));

// The rewind is asserted as a CALL, not by its four writes: those belong to
// `resetBookToStart`'s own test, and the real module reaches WatermelonDB.
// `callOrder` is what the finish-branch ordering tests read — the rewind is
// bookkeeping behind a press and must land AFTER the transport calls.
const callOrder: string[] = [];
jest.mock('@/helpers/chapterTracking', () => ({
  rewindChapterTracking: jest.fn(async () => {
    callOrder.push('rewindChapterTracking');
  }),
}));

const mockGetPlaybackState = TrackPlayer.getPlaybackState as jest.Mock;
const mockGetProgress = TrackPlayer.getProgress as jest.Mock;
const mockGetQueue = TrackPlayer.getQueue as jest.Mock;
const mockGetActiveTrackIndex = TrackPlayer.getActiveTrackIndex as jest.Mock;
const mockGetActiveTrack = TrackPlayer.getActiveTrack as jest.Mock;
const mockSeekTo = TrackPlayer.seekTo as jest.Mock;
const mockSkip = TrackPlayer.skip as jest.Mock;
const mockPlay = TrackPlayer.play as jest.Mock;
const mockPause = TrackPlayer.pause as jest.Mock;
const mockStop = TrackPlayer.stop as jest.Mock;
const mockGetBookById = getBookById as jest.Mock;
const mockRewindChapterTracking = rewindChapterTracking as jest.Mock;

// Queue items carry the chapter's duration (see buildClippedChapterTracks and
// the multi-file branch of handleBookPlay); relativeSeek measures a jump with
// them, so a queue mock without durations would not be a queue.
const queueOf = (n: number, durations: number[] = []) =>
  Array.from({ length: n }, (_, i) => ({
    id: i,
    duration: durations[i] ?? 600,
  }));

beforeEach(() => {
  mockBooks = {};
  callOrder.length = 0;
  jest.clearAllMocks();
  // clearAllMocks strips implementations, not just calls — re-arm the ones
  // that feed `callOrder`, or the ordering tests silently see an empty list.
  mockRewindChapterTracking.mockImplementation(async () => {
    callOrder.push('rewindChapterTracking');
  });
  mockSkip.mockImplementation(async () => {
    callOrder.push('skip');
  });
  mockSeekTo.mockImplementation(async () => {
    callOrder.push('seekTo');
  });
  mockPause.mockImplementation(async () => {
    callOrder.push('pause');
  });
  mockStop.mockImplementation(async () => {
    callOrder.push('stop');
  });
  // Default: paused player so the play-state guard stays inert
  mockGetPlaybackState.mockResolvedValue({ state: State.Paused });
  mockGetActiveTrack.mockResolvedValue({ bookId: 'book-1' });
  mockGetBookById.mockResolvedValue(null);
});

describe('seekBack', () => {
  it('seeks within the current track when no boundary is crossed', async () => {
    mockGetQueue.mockResolvedValue(queueOf(3));
    mockGetActiveTrackIndex.mockResolvedValue(1);
    mockGetProgress.mockResolvedValue({ position: 100, duration: 600 });

    await seekBack(30);

    expect(mockSeekTo).toHaveBeenCalledWith(70);
    expect(mockSkip).not.toHaveBeenCalled();
  });

  it('crosses into the previous track with the remainder (15s into ch2, -30s => 15s before end of ch1)', async () => {
    mockGetQueue.mockResolvedValue(queueOf(3, [900, 600, 600]));
    mockGetActiveTrackIndex.mockResolvedValue(1);
    mockGetProgress.mockResolvedValue({ position: 15, duration: 600 });

    await seekBack(30);

    expect(mockSkip).toHaveBeenCalledWith(0);
    // newPosition = 15 - 30 = -15; target = 900 + (-15) = 885
    expect(mockSeekTo).toHaveBeenCalledWith(885);
  });

  it('clamps to 0 on the first track', async () => {
    mockGetQueue.mockResolvedValue(queueOf(3));
    mockGetActiveTrackIndex.mockResolvedValue(0);
    mockGetProgress.mockResolvedValue({ position: 10, duration: 600 });

    await seekBack(30);

    expect(mockSeekTo).toHaveBeenCalledWith(0);
    expect(mockSkip).not.toHaveBeenCalled();
  });

  it('clamps to 0 for a single-item queue (legacy single-file book)', async () => {
    mockGetQueue.mockResolvedValue(queueOf(1));
    mockGetActiveTrackIndex.mockResolvedValue(0);
    mockGetProgress.mockResolvedValue({ position: 10, duration: 3600 });

    await seekBack(30);

    expect(mockSeekTo).toHaveBeenCalledWith(0);
    expect(mockSkip).not.toHaveBeenCalled();
  });

  it('restores playback if the seek caused an unexpected pause', async () => {
    mockGetQueue.mockResolvedValue(queueOf(3));
    mockGetActiveTrackIndex.mockResolvedValue(1);
    mockGetProgress.mockResolvedValue({ position: 100, duration: 600 });
    mockGetPlaybackState
      .mockResolvedValueOnce({ state: State.Playing }) // before seek
      .mockResolvedValueOnce({ state: State.Paused }); // after seek

    await seekBack(30);

    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  it('does not force play when the player was paused before the seek', async () => {
    mockGetQueue.mockResolvedValue(queueOf(3));
    mockGetActiveTrackIndex.mockResolvedValue(1);
    mockGetProgress.mockResolvedValue({ position: 100, duration: 600 });

    await seekBack(30);

    expect(mockPlay).not.toHaveBeenCalled();
  });
});

describe('seekForward', () => {
  it('seeks within the current track when no boundary is crossed', async () => {
    mockGetQueue.mockResolvedValue(queueOf(3));
    mockGetActiveTrackIndex.mockResolvedValue(1);
    mockGetProgress.mockResolvedValue({ position: 100, duration: 600 });

    await seekForward(30);

    expect(mockSeekTo).toHaveBeenCalledWith(130);
    expect(mockSkip).not.toHaveBeenCalled();
  });

  it('crosses into the next track with the overshoot', async () => {
    mockGetQueue.mockResolvedValue(queueOf(3));
    mockGetActiveTrackIndex.mockResolvedValue(1);
    mockGetProgress.mockResolvedValue({ position: 590, duration: 600 });

    await seekForward(30);

    expect(mockSkip).toHaveBeenCalledWith(2);
    // overshoot = (590 + 30) - 600 = 20
    expect(mockSeekTo).toHaveBeenCalledWith(20);
  });

  it('marks the book finished and resets when overshooting the last track', async () => {
    const updateBookProgress = jest.fn().mockResolvedValue(undefined);
    mockGetBookById.mockResolvedValue({ updateBookProgress });
    mockGetQueue.mockResolvedValue(queueOf(3));
    mockGetActiveTrackIndex.mockResolvedValue(2);
    mockGetProgress.mockResolvedValue({ position: 590, duration: 600 });

    await seekForward(30);

    expect(updateBookProgress).toHaveBeenCalledWith(2); // Finished
    expect(mockSkip).toHaveBeenCalledWith(0);
    expect(mockSeekTo).toHaveBeenCalledWith(0);
    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it('marks finished without skip() for a single-item queue', async () => {
    const updateBookProgress = jest.fn().mockResolvedValue(undefined);
    mockGetBookById.mockResolvedValue({ updateBookProgress });
    mockGetQueue.mockResolvedValue(queueOf(1));
    mockGetActiveTrackIndex.mockResolvedValue(0);
    mockGetProgress.mockResolvedValue({ position: 3590, duration: 3600 });

    await seekForward(30);

    expect(updateBookProgress).toHaveBeenCalledWith(2);
    expect(mockSkip).not.toHaveBeenCalled();
    expect(mockSeekTo).toHaveBeenCalledWith(0);
    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it('does not re-mark a book the store already reports Finished', async () => {
    // D5's invariant: three of the four sites that can mark a Book Finished
    // guard the mark on the stored progress value, so a press inside the
    // book-end lead window cannot rewrite an already-set `finished_at`. This
    // was the fourth. The seek and the pause still happen — the guard is on
    // the MARK only.
    const updateBookProgress = jest.fn().mockResolvedValue(undefined);
    mockGetBookById.mockResolvedValue({ updateBookProgress });
    mockBooks = { 'book-1': { bookProgressValue: 2 } };
    mockGetQueue.mockResolvedValue(queueOf(3));
    mockGetActiveTrackIndex.mockResolvedValue(2);
    mockGetProgress.mockResolvedValue({ position: 590, duration: 600 });

    await seekForward(30);

    expect(updateBookProgress).not.toHaveBeenCalled();
    expect(mockGetBookById).not.toHaveBeenCalled();
    expect(mockSkip).toHaveBeenCalledWith(0);
    expect(mockSeekTo).toHaveBeenCalledWith(0);
    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  it('still marks a book the store reports as merely Started', async () => {
    const updateBookProgress = jest.fn().mockResolvedValue(undefined);
    mockGetBookById.mockResolvedValue({ updateBookProgress });
    mockBooks = { 'book-1': { bookProgressValue: 1 } };
    mockGetQueue.mockResolvedValue(queueOf(3));
    mockGetActiveTrackIndex.mockResolvedValue(2);
    mockGetProgress.mockResolvedValue({ position: 590, duration: 600 });

    await seekForward(30);

    expect(updateBookProgress).toHaveBeenCalledWith(2);
  });

  it('does not force play after the intentional finish-stop', async () => {
    mockGetQueue.mockResolvedValue(queueOf(3));
    mockGetActiveTrackIndex.mockResolvedValue(2);
    mockGetProgress.mockResolvedValue({ position: 590, duration: 600 });
    mockGetPlaybackState.mockResolvedValue({ state: State.Playing });

    await seekForward(30);

    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(mockPause).not.toHaveBeenCalled();
    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('restores playback if the seek caused an unexpected pause', async () => {
    mockGetQueue.mockResolvedValue(queueOf(3));
    mockGetActiveTrackIndex.mockResolvedValue(1);
    mockGetProgress.mockResolvedValue({ position: 100, duration: 600 });
    mockGetPlaybackState
      .mockResolvedValueOnce({ state: State.Playing })
      .mockResolvedValueOnce({ state: State.Paused });

    await seekForward(30);

    expect(mockPlay).toHaveBeenCalledTimes(1);
  });
});

/*
 * Finishing a Book by jumping off the end must leave it in EXACTLY the state
 * playing it to its true end leaves it in. This branch used to do only the
 * player half — mark, seek, pause — and none of the persisted half, which is
 * a fourth copy of the finish triple and a re-run of
 * `.scratch/remote-noop-footprint/issues/02-*.md`: the chapter list resolves
 * its highlight from the playback-index STORE and falls back to the DB row
 * only when that selector is `undefined`, so a stale store entry beat a
 * correct DB row and the list kept highlighting the last chapter of a Book
 * sitting at 0.
 *
 * ⚠ The defect was invisible on most Books, and the reason is the trap here.
 * A single-file Book with real chapter markers loads as a CLIPPED chapter
 * queue, so `shape.index !== 0`, so this branch calls `skip(0)`, which fires
 * `Event.PlaybackActiveTrackChanged`, whose multi-file branch writes
 * `setChapterIndex(bookId, 0)`. Store and DB were zeroed correctly BY
 * ACCIDENT, by a different handler. The rewind added here therefore has to be
 * idempotent with that write rather than a second conflicting one — it writes
 * the same zeroes — and the multi-item test below exists to keep it that way.
 */
describe('seekForward finishing a Book', () => {
  const finishFrom = async (queueLength: number, index: number) => {
    mockGetBookById.mockResolvedValue({
      updateBookProgress: jest.fn().mockResolvedValue(undefined),
    });
    mockGetQueue.mockResolvedValue(queueOf(queueLength));
    mockGetActiveTrackIndex.mockResolvedValue(index);
    mockGetProgress.mockResolvedValue({ position: 590, duration: 600 });
    await seekForward(30);
  };

  it('rewinds the Book on the legacy single-file path', async () => {
    await finishFrom(1, 0);

    expect(mockRewindChapterTracking).toHaveBeenCalledWith('book-1');
  });

  it('rewinds the Book exactly once on the clipped/multi-item path', async () => {
    // Not double-written: this branch issues ONE rewind, and the write
    // `ActiveTrackChanged` makes off the `skip(0)` is the same zero.
    await finishFrom(3, 2);

    expect(mockSkip).toHaveBeenCalledWith(0);
    expect(mockRewindChapterTracking).toHaveBeenCalledTimes(1);
    expect(mockRewindChapterTracking).toHaveBeenCalledWith('book-1');
  });

  it('rewinds AFTER the transport calls, never before them', async () => {
    // Order is load-bearing in both directions. A 1 Hz progress tick can land
    // on any await here: after the seek the Book really is at 0, so the worst
    // such a tick can write is the zeroes we are about to write anyway.
    // Rewinding FIRST would leave the tracker at chapter 0 while the position
    // is still in the last chapter, and that tick would put the stale index
    // straight back.
    await finishFrom(3, 2);

    expect(callOrder).toEqual([
      'skip',
      'seekTo',
      'stop',
      'rewindChapterTracking',
    ]);
  });

  it('does not rewind when the player cannot name an active Book', async () => {
    mockGetActiveTrack.mockResolvedValue(undefined);

    await finishFrom(1, 0);

    expect(mockRewindChapterTracking).not.toHaveBeenCalled();
    expect(mockSeekTo).toHaveBeenCalledWith(0);
    expect(mockStop).toHaveBeenCalledTimes(1);
  });

  describe('bookkeeping failure never costs the user the press', () => {
    // The swallow now lives inside `markBookFinishedOnce`, which is why this
    // branch no longer wraps its mark in `withoutBlockingThePress`. The
    // assertions below are what makes that safe to rely on from here: a
    // rejection must cost neither the three transport calls nor the rewind,
    // all four of which sit BELOW the mark.
    it('survives a throw while marking the Book Finished', async () => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockGetBookById.mockRejectedValue(new Error('db is gone'));
      mockGetQueue.mockResolvedValue(queueOf(3));
      mockGetActiveTrackIndex.mockResolvedValue(2);
      mockGetProgress.mockResolvedValue({ position: 590, duration: 600 });

      await expect(seekForward(30)).resolves.toBeUndefined();

      expect(mockSkip).toHaveBeenCalledWith(0);
      expect(mockSeekTo).toHaveBeenCalledWith(0);
      expect(mockStop).toHaveBeenCalledTimes(1);
      expect(mockRewindChapterTracking).toHaveBeenCalledWith('book-1');
      // The failure is now REPORTED as well as survived; the wrapper this
      // replaced swallowed it silently.
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    // The other half of the same guarantee: the lookup can succeed and the
    // WRITE still throw, which is the shape a concurrent scan's
    // removeMissingFiles actually produces.
    it('survives a throw from the write itself', async () => {
      const consoleError = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockGetBookById.mockResolvedValue({
        updateBookProgress: jest
          .fn()
          .mockRejectedValue(new Error('row destroyed')),
      });
      mockGetQueue.mockResolvedValue(queueOf(3));
      mockGetActiveTrackIndex.mockResolvedValue(2);
      mockGetProgress.mockResolvedValue({ position: 590, duration: 600 });

      await expect(seekForward(30)).resolves.toBeUndefined();

      expect(mockSkip).toHaveBeenCalledWith(0);
      expect(mockSeekTo).toHaveBeenCalledWith(0);
      expect(mockStop).toHaveBeenCalledTimes(1);
      expect(mockRewindChapterTracking).toHaveBeenCalledWith('book-1');
      expect(consoleError).toHaveBeenCalled();
      consoleError.mockRestore();
    });

    it('survives a throw inside the rewind', async () => {
      mockRewindChapterTracking.mockRejectedValue(new Error('db is gone'));
      mockGetBookById.mockResolvedValue({
        updateBookProgress: jest.fn().mockResolvedValue(undefined),
      });
      mockGetQueue.mockResolvedValue(queueOf(1));
      mockGetActiveTrackIndex.mockResolvedValue(0);
      mockGetProgress.mockResolvedValue({ position: 3590, duration: 3600 });

      await expect(seekForward(30)).resolves.toBeUndefined();

      expect(mockSeekTo).toHaveBeenCalledWith(0);
      expect(mockStop).toHaveBeenCalledTimes(1);
    });
  });
});

/*
 * The 30-second jumps record NOTHING, and that is deliberate.
 *
 * Both surfaces route through this module — the in-app SeekBack/SeekForward
 * buttons call `seekBack`/`seekForward` directly, and
 * `Event.RemoteJumpBackward`/`Forward` call the same two functions rather
 * than native seekBy — so one assertion here covers both. That symmetry is
 * the point: the footprint rule is that the PRESS TYPE decides, and a jump
 * is not a departure the user would ever want to come back to.
 *
 * `Event.RemoteSeek` is a different press — the notification's seek-BAR drag
 * — and it does record, mirroring the in-app scrub. Do not "fix" the jumps
 * into recording by analogy with it.
 *
 * This asserts against the DB WRITER, not against a helper: every route into
 * footprint recording, `activeBookFootprints` included, lands on that one
 * call — which is the whole of what `db/footprintQueries` still does.
 */
describe('the 30-second jumps never record a footprint', () => {
  const noFootprints = () => {
    expect(addFootprint).not.toHaveBeenCalled();
  };

  it('records nothing on a jump inside the current track', async () => {
    mockGetQueue.mockResolvedValue(queueOf(3));
    mockGetActiveTrackIndex.mockResolvedValue(1);
    mockGetProgress.mockResolvedValue({ position: 100, duration: 600 });

    await seekForward(30);
    await seekBack(30);

    noFootprints();
  });

  it('records nothing on a jump that crosses a chapter boundary', async () => {
    mockGetQueue.mockResolvedValue(queueOf(3));
    mockGetActiveTrackIndex.mockResolvedValue(1);
    mockGetProgress.mockResolvedValue({ position: 590, duration: 600 });

    await seekForward(30);

    expect(mockSkip).toHaveBeenCalledWith(2);
    noFootprints();
  });

  it('records nothing on a jump that finishes the book', async () => {
    mockGetBookById.mockResolvedValue({
      updateBookProgress: jest.fn().mockResolvedValue(undefined),
    });
    mockGetQueue.mockResolvedValue(queueOf(3));
    mockGetActiveTrackIndex.mockResolvedValue(2);
    mockGetProgress.mockResolvedValue({ position: 590, duration: 600 });

    await seekForward(30);

    expect(mockStop).toHaveBeenCalledTimes(1);
    noFootprints();
  });
});
