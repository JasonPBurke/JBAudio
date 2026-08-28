import TrackPlayer from 'react-native-track-player';
import { skipToPreviousChapter } from '../chapterSkip';
import { useLibraryStore } from '@/store/library';

/*
 * Call-level tests. The LANDING-SPOT tests for the ends of the queue live in
 * `chapterSkip.queuePosition.test.ts`, against `support/fakePlayer.ts` — a
 * `skipToPrevious` spy cannot see a press that resolved without moving.
 */

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {
    getQueue: jest.fn(),
    getProgress: jest.fn(),
    getActiveTrack: jest.fn(),
    getActiveTrackIndex: jest.fn(),
    seekTo: jest.fn().mockResolvedValue(undefined),
    skipToPrevious: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/store/library', () => ({
  useLibraryStore: { getState: jest.fn() },
}));

const mockGetQueue = TrackPlayer.getQueue as jest.Mock;
const mockGetProgress = TrackPlayer.getProgress as jest.Mock;
const mockGetActiveTrack = TrackPlayer.getActiveTrack as jest.Mock;
const mockGetActiveTrackIndex = TrackPlayer.getActiveTrackIndex as jest.Mock;
const mockSeekTo = TrackPlayer.seekTo as jest.Mock;
const mockSkipToPrevious = TrackPlayer.skipToPrevious as jest.Mock;
const mockGetState = useLibraryStore.getState as jest.Mock;

const queueOf = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i }));

// Chapters at 0:00, 10:00, 20:00
const chapters = [
  { startMs: 0 },
  { startMs: 600_000 },
  { startMs: 1_200_000 },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockSkipToPrevious.mockResolvedValue(undefined);
  mockGetActiveTrack.mockResolvedValue({ bookId: 'book-1' });
  // Mid-queue unless a test says otherwise: index 0 is its own branch.
  mockGetActiveTrackIndex.mockResolvedValue(1);
  mockGetState.mockReturnValue({ books: { 'book-1': { chapters } } });
});

describe('skipToPreviousChapter — single-item queue (legacy single-file book)', () => {
  beforeEach(() => {
    mockGetQueue.mockResolvedValue(queueOf(1));
  });

  it('restarts the current chapter when more than 15s in', async () => {
    // 616s = 16s into chapter 2
    mockGetProgress.mockResolvedValue({ position: 616, duration: 3600 });

    await skipToPreviousChapter();

    expect(mockSeekTo).toHaveBeenCalledWith(600);
    expect(mockSkipToPrevious).not.toHaveBeenCalled();
  });

  it('goes to the previous chapter within the first 15s', async () => {
    // 610s = 10s into chapter 2
    mockGetProgress.mockResolvedValue({ position: 610, duration: 3600 });

    await skipToPreviousChapter();

    expect(mockSeekTo).toHaveBeenCalledWith(0);
    expect(mockSkipToPrevious).not.toHaveBeenCalled();
  });

  it('restarts the track when the book has no chapter data', async () => {
    mockGetState.mockReturnValue({ books: { 'book-1': { chapters: [] } } });
    mockGetProgress.mockResolvedValue({ position: 500, duration: 3600 });

    await skipToPreviousChapter();

    expect(mockSeekTo).toHaveBeenCalledWith(0);
    expect(mockSkipToPrevious).not.toHaveBeenCalled();
  });

  it('restarts the track when the book is not in the library store', async () => {
    mockGetState.mockReturnValue({ books: {} });
    mockGetProgress.mockResolvedValue({ position: 500, duration: 3600 });

    await skipToPreviousChapter();

    expect(mockSeekTo).toHaveBeenCalledWith(0);
    expect(mockSkipToPrevious).not.toHaveBeenCalled();
  });
});

describe('skipToPreviousChapter — multi-item queue (multi-file / clipped chapters)', () => {
  beforeEach(() => {
    mockGetQueue.mockResolvedValue(queueOf(3));
  });

  it('restarts the current item when more than 15s in (position is chapter-relative)', async () => {
    mockGetProgress.mockResolvedValue({ position: 42, duration: 600 });

    await skipToPreviousChapter();

    expect(mockSeekTo).toHaveBeenCalledWith(0);
    expect(mockSkipToPrevious).not.toHaveBeenCalled();
  });

  it('skips to the previous item within the first 15s', async () => {
    mockGetProgress.mockResolvedValue({ position: 10, duration: 600 });

    await skipToPreviousChapter();

    expect(mockSkipToPrevious).toHaveBeenCalledTimes(1);
    expect(mockSeekTo).not.toHaveBeenCalled();
  });

  it('skips to the previous item at exactly 15s (inclusive)', async () => {
    mockGetProgress.mockResolvedValue({ position: 15, duration: 600 });

    await skipToPreviousChapter();

    expect(mockSkipToPrevious).toHaveBeenCalledTimes(1);
    expect(mockSeekTo).not.toHaveBeenCalled();
  });

  it('restarts the book at the first queue item within the first 15s', async () => {
    mockGetProgress.mockResolvedValue({ position: 10, duration: 600 });
    mockGetActiveTrackIndex.mockResolvedValue(0);

    await skipToPreviousChapter();

    expect(mockSeekTo).toHaveBeenCalledWith(0);
    expect(mockSkipToPrevious).not.toHaveBeenCalled();
  });

  it('takes the previous-chapter path when the queue index cannot be read', async () => {
    // `undefined` is "unknown", not 0 — guessing 0 would turn a transient
    // read failure into a restart the user never asked for.
    mockGetProgress.mockResolvedValue({ position: 10, duration: 600 });
    mockGetActiveTrackIndex.mockResolvedValue(undefined);

    await skipToPreviousChapter();

    expect(mockSkipToPrevious).toHaveBeenCalledTimes(1);
    expect(mockSeekTo).not.toHaveBeenCalled();
  });
});

describe('skipToPreviousChapter — onBeforeSkip callback', () => {
  it('reports "restart" and is awaited before the seek (single-item queue)', async () => {
    mockGetQueue.mockResolvedValue(queueOf(1));
    // 16s into chapter 2
    mockGetProgress.mockResolvedValue({ position: 616, duration: 3600 });

    const calls: string[] = [];
    const onBeforeSkip = jest.fn(async (kind: string) => {
      calls.push(`callback:${kind}`);
    });
    mockSeekTo.mockImplementation(async () => {
      calls.push('seek');
    });

    await skipToPreviousChapter(onBeforeSkip);

    expect(onBeforeSkip).toHaveBeenCalledWith('restart');
    expect(calls).toEqual(['callback:restart', 'seek']);
  });

  it('reports "previous" for a press within the threshold (single-item queue)', async () => {
    mockGetQueue.mockResolvedValue(queueOf(1));
    // 10s into chapter 2
    mockGetProgress.mockResolvedValue({ position: 610, duration: 3600 });

    const onBeforeSkip = jest.fn().mockResolvedValue(undefined);
    await skipToPreviousChapter(onBeforeSkip);

    expect(onBeforeSkip).toHaveBeenCalledWith('previous');
  });

  it('reports "restart" at the first queue item within the threshold', async () => {
    mockGetQueue.mockResolvedValue(queueOf(3));
    mockGetActiveTrackIndex.mockResolvedValue(0);
    mockGetProgress.mockResolvedValue({ position: 10, duration: 600 });

    const onBeforeSkip = jest.fn().mockResolvedValue(undefined);
    await skipToPreviousChapter(onBeforeSkip);

    expect(onBeforeSkip).toHaveBeenCalledWith('restart');
  });

  it('reports "restart" beyond the threshold on a multi-item queue', async () => {
    mockGetQueue.mockResolvedValue(queueOf(3));
    mockGetProgress.mockResolvedValue({ position: 42, duration: 600 });

    const onBeforeSkip = jest.fn().mockResolvedValue(undefined);
    await skipToPreviousChapter(onBeforeSkip);

    expect(onBeforeSkip).toHaveBeenCalledWith('restart');
  });

  it('reports "previous" within the threshold on a multi-item queue, before the skip', async () => {
    mockGetQueue.mockResolvedValue(queueOf(3));
    mockGetProgress.mockResolvedValue({ position: 10, duration: 600 });

    const calls: string[] = [];
    const onBeforeSkip = jest.fn(async (kind: string) => {
      calls.push(`callback:${kind}`);
    });
    mockSkipToPrevious.mockImplementation(async () => {
      calls.push('skip');
    });

    await skipToPreviousChapter(onBeforeSkip);

    expect(calls).toEqual(['callback:previous', 'skip']);
  });

  it('still performs the seek when the callback rejects', async () => {
    mockGetQueue.mockResolvedValue(queueOf(3));
    mockGetProgress.mockResolvedValue({ position: 42, duration: 600 });

    const onBeforeSkip = jest.fn().mockRejectedValue(new Error('db down'));
    await skipToPreviousChapter(onBeforeSkip);

    expect(mockSeekTo).toHaveBeenCalledWith(0);
  });
});
