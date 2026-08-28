import { resetBookToStart } from '../resetBookToStart';
import {
  updateChapterIndexInDB,
  updateChapterProgressInDB,
} from '@/db/chapterQueries';

/*
 * The reset that `Event.PlaybackQueueEnded` and `RemoteNext`'s finish branch
 * both perform: four state writes plus the chapter-detector rewind. It exists as a helper precisely because the two
 * copies drifted: the remote branch reset playback and forgot the chapter
 * index, so the chapter list kept highlighting the last chapter of a Book
 * that had just been rewound. See
 * .scratch/remote-noop-footprint/issues/02-*.md.
 */

const mockSetPlaybackProgress = jest.fn();
const mockSetPlaybackIndex = jest.fn();

jest.mock('@/store/library', () => ({
  useLibraryStore: {
    getState: () => ({
      setPlaybackProgress: mockSetPlaybackProgress,
      setPlaybackIndex: mockSetPlaybackIndex,
    }),
  },
}));

jest.mock('@/db/chapterQueries', () => ({
  updateChapterProgressInDB: jest.fn(),
  updateChapterIndexInDB: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('resetBookToStart', () => {
  it('zeroes the in-memory AND the persisted halves of both index and progress', async () => {
    const tracking = { lastChapterIndex: 2, bookId: 'book-1' };

    await resetBookToStart('book-1', tracking);

    expect(mockSetPlaybackProgress).toHaveBeenCalledWith('book-1', 0);
    expect(mockSetPlaybackIndex).toHaveBeenCalledWith('book-1', 0);
    expect(updateChapterProgressInDB).toHaveBeenCalledWith('book-1', 0);
    expect(updateChapterIndexInDB).toHaveBeenCalledWith('book-1', 0);
  });

  it('rewinds the chapter-change detector so the next tick is not read as a chapter change', async () => {
    const tracking = { lastChapterIndex: 2, bookId: 'book-1' };

    await resetBookToStart('book-1', tracking);

    expect(tracking).toEqual({ lastChapterIndex: 0, bookId: 'book-1' });
  });

  it('adopts the Book it reset, even when the detector was tracking another one', async () => {
    const tracking = { lastChapterIndex: 5, bookId: 'other-book' };

    await resetBookToStart('book-1', tracking);

    expect(tracking).toEqual({ lastChapterIndex: 0, bookId: 'book-1' });
  });
});
