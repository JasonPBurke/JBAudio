import { handleRemoteNextPress } from '../remoteNext';
import { createFakePlayer, type FakePlayer } from './support/fakePlayer';
import { getBookById } from '@/db/bookQueries';
import { BookProgressState } from '@/helpers/bookProgressState';
import { Chapter } from '@/types/Book';

/*
 * The RemoteNext press, end to end, minus the subscribe() wiring.
 *
 * The property that matters most here is ORDER, and it cannot be seen from
 * `resolveNextPress` alone: the footprint must be written BEFORE the
 * seek/skip (it is a breadcrumb back to the PRE-press spot) and only on a
 * branch that actually moves. Recording after the transport call would still
 * produce a footprint and still pass every "was it recorded?" assertion — so
 * these tests assert the call ORDER, not just the calls.
 */

let mockPlayer: FakePlayer;
/** Call order across the recorder callbacks and the transport calls. */
let mockOrder: string[];

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {
    getProgress: (...a: unknown[]) => mockPlayer.api.getProgress(...a),
    getQueue: (...a: unknown[]) => mockPlayer.api.getQueue(...a),
    getActiveTrackIndex: (...a: unknown[]) =>
      mockPlayer.api.getActiveTrackIndex(...a),
    getActiveTrack: (...a: unknown[]) => mockPlayer.api.getActiveTrack(...a),
    seekTo: (...a: unknown[]) => {
      mockOrder.push('seekTo');
      return mockPlayer.api.seekTo(...a);
    },
    skipToNext: (...a: unknown[]) => {
      mockOrder.push('skipToNext');
      return mockPlayer.api.skipToNext(...a);
    },
    pause: (...a: unknown[]) => {
      mockOrder.push('pause');
      return mockPlayer.api.pause(...a);
    },
  },
}));

// `chapterSkip` imports the library store, which imports WatermelonDB's
// SQLite adapter — unresolvable in the node lane. Stubbed here even though
// this handler's path never reads it.
jest.mock('@/store/library', () => ({
  useLibraryStore: { getState: jest.fn(() => ({ books: {} })) },
}));

jest.mock('@/db/bookQueries', () => ({
  getBookById: jest.fn(),
}));

const mockGetBookById = getBookById as jest.Mock;
let updateBookProgress: jest.Mock;

const chapter = (startMs: number): Chapter => ({
  author: 'A',
  bookTitle: 'B',
  chapterTitle: `Ch ${startMs}`,
  chapterNumber: startMs,
  chapterDuration: 600,
  startMs,
  url: 'file://book.m4b',
});

const SINGLE_FILE_CHAPTERS = [chapter(0), chapter(600_000), chapter(1_200_000)];

const recorders = () => ({
  onBeforeChapterChange: jest.fn(async () => {
    mockOrder.push('chapter_change');
  }),
  onBeforeLeaveBook: jest.fn(async () => {
    mockOrder.push('seek_footprint');
  }),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockOrder = [];
  updateBookProgress = jest.fn(async () => {
    mockOrder.push('markFinished');
  });
  mockGetBookById.mockResolvedValue({ updateBookProgress });
});

describe('handleRemoteNextPress — a press that moves', () => {
  it('records the footprint BEFORE skipping to the next queue item', async () => {
    mockPlayer = createFakePlayer({
      durations: [600, 600, 600],
      index: 0,
      position: 30,
    });
    const rec = recorders();

    await handleRemoteNextPress({
      bookId: 'book-1',
      book: undefined,
      treatAsSingleFile: false,
      ...rec,
    });

    expect(mockOrder).toEqual(['chapter_change', 'skipToNext']);
    expect(mockPlayer.at()).toEqual({ index: 1, position: 0 });
    expect(rec.onBeforeLeaveBook).not.toHaveBeenCalled();
  });

  it('records the footprint BEFORE seeking within a single-file book', async () => {
    mockPlayer = createFakePlayer({
      durations: [1800],
      index: 0,
      position: 30,
    });
    const rec = recorders();

    await handleRemoteNextPress({
      bookId: 'book-1',
      book: { chapters: SINGLE_FILE_CHAPTERS },
      treatAsSingleFile: true,
      ...rec,
    });

    expect(mockOrder).toEqual(['chapter_change', 'seekTo']);
    expect(mockPlayer.at()).toEqual({ index: 0, position: 600 });
  });

  it('does not let a footprint failure block the transport call', async () => {
    mockPlayer = createFakePlayer({
      durations: [600, 600, 600],
      index: 0,
      position: 30,
    });
    const rec = recorders();
    rec.onBeforeChapterChange.mockRejectedValue(new Error('db down'));

    await handleRemoteNextPress({
      bookId: 'book-1',
      book: undefined,
      treatAsSingleFile: false,
      ...rec,
    });

    expect(mockPlayer.at()).toEqual({ index: 1, position: 0 });
  });
});

describe('handleRemoteNextPress — a press that moves nothing', () => {
  it('records nothing and leaves playback alone at the last queue item', async () => {
    mockPlayer = createFakePlayer({
      durations: [600, 600, 600],
      index: 2,
      position: 14,
      playing: true,
    });
    const rec = recorders();

    await handleRemoteNextPress({
      bookId: 'book-1',
      book: undefined,
      treatAsSingleFile: false,
      ...rec,
    });

    expect(mockOrder).toEqual([]);
    expect(rec.onBeforeChapterChange).not.toHaveBeenCalled();
    expect(rec.onBeforeLeaveBook).not.toHaveBeenCalled();
    expect(mockPlayer.at()).toEqual({ index: 2, position: 14 });
    expect(mockPlayer.isPlaying()).toBe(true);
    expect(mockGetBookById).not.toHaveBeenCalled();
  });
});

describe('handleRemoteNextPress — the last chapter of a single-file book', () => {
  const pressAtEnd = async (
    rec: ReturnType<typeof recorders>,
    bookProgressValue?: number,
  ) => {
    mockPlayer = createFakePlayer({
      durations: [1800],
      index: 0,
      position: 1500,
      playing: true,
    });

    await handleRemoteNextPress({
      bookId: 'book-1',
      book: { chapters: SINGLE_FILE_CHAPTERS, bookProgressValue },
      treatAsSingleFile: true,
      ...rec,
    });
  };

  it('records the breadcrumb BEFORE the reset destroys the position', async () => {
    const rec = recorders();

    await pressAtEnd(rec);

    // The footprint precedes the mark as well as the seek: a throw from the
    // DB write must not cost the last reading of a position about to be lost.
    expect(mockOrder).toEqual([
      'seek_footprint',
      'markFinished',
      'seekTo',
      'pause',
    ]);
    expect(rec.onBeforeChapterChange).not.toHaveBeenCalled();
    expect(mockPlayer.at()).toEqual({ index: 0, position: 0 });
    expect(mockPlayer.isPlaying()).toBe(false);
  });

  it('does not rewrite an already-set finished mark', async () => {
    const rec = recorders();

    await pressAtEnd(rec, BookProgressState.Finished);

    expect(mockGetBookById).not.toHaveBeenCalled();
    expect(updateBookProgress).not.toHaveBeenCalled();
    // Still resets and still leaves a breadcrumb.
    expect(mockOrder).toEqual(['seek_footprint', 'seekTo', 'pause']);
    expect(mockPlayer.at()).toEqual({ index: 0, position: 0 });
  });
});
