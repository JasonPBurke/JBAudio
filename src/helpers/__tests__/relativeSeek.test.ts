import TrackPlayer, { State } from 'react-native-track-player';
import { seekBack, seekForward } from '../relativeSeek';
import { getBookById } from '@/db/bookQueries';

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

jest.mock('@/helpers/handleBookPlay', () => ({
  BookProgressState: { NotStarted: 0, Started: 1, Finished: 2 },
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
const mockGetBookById = getBookById as jest.Mock;

// Queue items carry the chapter's duration (see buildClippedChapterTracks and
// the multi-file branch of handleBookPlay); relativeSeek measures a jump with
// them, so a queue mock without durations would not be a queue.
const queueOf = (n: number, durations: number[] = []) =>
  Array.from({ length: n }, (_, i) => ({
    id: i,
    duration: durations[i] ?? 600,
  }));

beforeEach(() => {
  jest.clearAllMocks();
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
    expect(mockPause).toHaveBeenCalledTimes(1);
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
    expect(mockPause).toHaveBeenCalledTimes(1);
  });

  it('does not force play after the intentional finish-pause', async () => {
    mockGetQueue.mockResolvedValue(queueOf(3));
    mockGetActiveTrackIndex.mockResolvedValue(2);
    mockGetProgress.mockResolvedValue({ position: 590, duration: 600 });
    mockGetPlaybackState.mockResolvedValue({ state: State.Playing });

    await seekForward(30);

    expect(mockPause).toHaveBeenCalledTimes(1);
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
