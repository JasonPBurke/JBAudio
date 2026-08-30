import { remainingChapterCount } from '../remainingChapterCount';
import { useLibraryStore } from '@/store/library';
import { createFakePlayer, type FakePlayer } from './support/fakePlayer';

/*
 * The stepper's ceiling, driven through the fake player so the real adapter
 * runs on top of it. Every case here was a branch that existed twice — once in
 * `timer.tsx`, once in `SleepTimerOptions.tsx` — before the unit landed.
 */

let mockPlayer: FakePlayer;

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {
    getQueue: (...a: unknown[]) => mockPlayer.api.getQueue(...a),
    getProgress: (...a: unknown[]) => mockPlayer.api.getProgress(...a),
    getActiveTrack: (...a: unknown[]) => mockPlayer.api.getActiveTrack(...a),
    getActiveTrackIndex: (...a: unknown[]) =>
      mockPlayer.api.getActiveTrackIndex(...a),
  },
}));

// The store imports WatermelonDB's SQLite adapter, unresolvable in the node
// lane. The single-file branch genuinely reads it, so each test that needs
// chapters sets them.
jest.mock('@/store/library', () => ({
  useLibraryStore: { getState: jest.fn(() => ({ books: {} })) },
}));

const mockGetState = useLibraryStore.getState as jest.Mock;

// Chapters at 0:00, 10:00, 20:00, 30:00 — four boundaries, three left from the
// first.
const chapters = [
  { startMs: 0 },
  { startMs: 600_000 },
  { startMs: 1_200_000 },
  { startMs: 1_800_000 },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockGetState.mockReturnValue({ books: {} });
});

describe('remainingChapterCount — multi-file book', () => {
  it('counts the queue items after the active one', async () => {
    mockPlayer = createFakePlayer({
      durations: [600, 600, 600, 600],
      index: 1,
      position: 0,
    });

    expect(await remainingChapterCount()).toBe(2);
  });

  it('is 0 on the last queue item', async () => {
    mockPlayer = createFakePlayer({
      durations: [600, 600, 600],
      index: 2,
      position: 0,
    });

    expect(await remainingChapterCount()).toBe(0);
  });

  it('is 0 when nothing is loaded but the queue is not empty', async () => {
    mockPlayer = createFakePlayer({
      durations: [600, 600, 600],
      index: 0,
      position: 0,
    });
    mockPlayer.api.getActiveTrackIndex.mockResolvedValue(undefined);

    expect(await remainingChapterCount()).toBe(0);
  });
});

describe('remainingChapterCount — legacy single-file book', () => {
  it('counts the chapter boundaries after the playhead', async () => {
    // 1250s is inside chapter 3 (index 2), so one boundary is left.
    mockPlayer = createFakePlayer({
      durations: [3600],
      index: 0,
      position: 1250,
    });
    mockGetState.mockReturnValue({ books: { 'book-1': { chapters } } });

    expect(await remainingChapterCount()).toBe(1);
  });

  it('counts from the start of the book', async () => {
    mockPlayer = createFakePlayer({ durations: [3600], index: 0, position: 0 });
    mockGetState.mockReturnValue({ books: { 'book-1': { chapters } } });

    expect(await remainingChapterCount()).toBe(3);
  });

  it('is 0 when the book has no usable chapters', async () => {
    mockPlayer = createFakePlayer({ durations: [3600], index: 0, position: 0 });
    mockGetState.mockReturnValue({
      books: { 'book-1': { chapters: [{ startMs: 0 }] } },
    });

    expect(await remainingChapterCount()).toBe(0);
  });

  it('is 0 when the book is not in the library store', async () => {
    mockPlayer = createFakePlayer({ durations: [3600], index: 0, position: 0 });

    expect(await remainingChapterCount()).toBe(0);
  });

  it('is 0 when the single queue item carries no bookId', async () => {
    mockPlayer = createFakePlayer({
      durations: [3600],
      index: 0,
      position: 0,
    });
    mockPlayer.api.getActiveTrack.mockResolvedValue({});
    mockGetState.mockReturnValue({ books: { 'book-1': { chapters } } });

    expect(await remainingChapterCount()).toBe(0);
  });
});

describe('remainingChapterCount — the ceiling is not known', () => {
  it('is null with no Book loaded (empty queue)', async () => {
    mockPlayer = createFakePlayer({ durations: [], index: 0, position: 0 });

    expect(await remainingChapterCount()).toBeNull();
  });

  it('is null when a Player read throws', async () => {
    mockPlayer = createFakePlayer({
      durations: [600, 600],
      index: 0,
      position: 0,
    });
    mockPlayer.api.getQueue.mockRejectedValue(new Error('no player'));

    expect(await remainingChapterCount()).toBeNull();
  });

  it('is null when a later read throws mid-computation', async () => {
    mockPlayer = createFakePlayer({
      durations: [3600],
      index: 0,
      position: 0,
    });
    mockPlayer.api.getProgress.mockRejectedValue(new Error('no player'));
    mockGetState.mockReturnValue({ books: { 'book-1': { chapters } } });

    expect(await remainingChapterCount()).toBeNull();
  });
});
