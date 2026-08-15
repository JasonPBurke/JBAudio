import TrackPlayer from 'react-native-track-player';

import { handleBookPlay, BookProgressState } from '../handleBookPlay';
import { getBookById } from '@/db/bookQueries';
import {
  getChapterProgressInDB,
  updateChapterIndexInDB,
  updateChapterProgressInDB,
} from '@/db/chapterQueries';
import { Book } from '@/types/Book';

jest.mock('react-native-track-player', () => ({
  __esModule: true,
  default: {
    reset: jest.fn().mockResolvedValue(undefined),
    add: jest.fn().mockResolvedValue(undefined),
    skip: jest.fn().mockResolvedValue(undefined),
    seekTo: jest.fn().mockResolvedValue(undefined),
    play: jest.fn().mockResolvedValue(undefined),
    setVolume: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('@/helpers/awaitPlayerReady', () => ({
  awaitPlayerReady: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/helpers/applyPlaybackRate', () => ({
  applyPersistedPlaybackRate: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/helpers/defaultArtwork', () => ({
  resolveTrackArtwork: jest.fn().mockReturnValue(undefined),
}));

jest.mock('@/db/bookQueries', () => ({
  getBookById: jest.fn(),
  stampLastPlayed: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/db/chapterQueries', () => ({
  getChapterProgressInDB: jest.fn(),
  updateChapterIndexInDB: jest.fn().mockResolvedValue(undefined),
  updateChapterProgressInDB: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/db/settingsQueries', () => ({
  updateLastActiveBook: jest.fn().mockResolvedValue(undefined),
}));

/*
 * Two chapters with DIFFERENT urls, so `isSingleFileBook` is false and the
 * clipped-chapter gate is shut with it. That puts every case below in the
 * plain multi-file branch, where the resume position is readable straight off
 * `skip()` + `seekTo()` instead of through `calculateAbsolutePosition`.
 */
const finishedBook = (): Book =>
  ({
    bookId: 'b1',
    bookTitle: 'Dune',
    author: 'Frank Herbert',
    bookProgressValue: BookProgressState.Finished,
    chapters: [
      { url: '/one.mp3', chapterTitle: 'One', chapterDuration: 600 },
      { url: '/two.mp3', chapterTitle: 'Two', chapterDuration: 600 },
    ],
  }) as unknown as Book;

const play = (book: Book) =>
  handleBookPlay(book, false, false, null, jest.fn());

let errorSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  // Parked deep in the book, the way the service leaves a finished one.
  (getChapterProgressInDB as jest.Mock).mockResolvedValue({
    chapterIndex: 1,
    progress: 300,
  });
});

afterEach(() => errorSpy.mockRestore());

/*
 * §C5 — a finished book restarts from zero AND is demoted to `Started`, and
 * the comment in `handleBookPlay` is emphatic that the demotion is what makes
 * the restart safe: NOTHING ELSE in the app moves a book off `Finished`, so an
 * unconsumed flag re-arms the restart on every later press.
 *
 * ⚠ The two halves must share a fate. The zeroing is awaited and always lands;
 * the demotion used to be an unawaited IIFE with a swallowed error, so a failed
 * demotion left the book at position 0 and STILL `Finished` — the one state
 * worse than either endpoint, and permanent. Code review finding 10.
 */
describe('a finished book restarts only when the demotion actually lands', () => {
  it('restarts from zero when the flag is consumed', async () => {
    const updateBookProgress = jest.fn().mockResolvedValue(undefined);
    (getBookById as jest.Mock).mockResolvedValue({ updateBookProgress });

    await play(finishedBook());

    expect(updateBookProgress).toHaveBeenCalledWith(BookProgressState.Started);
    expect(updateChapterIndexInDB).toHaveBeenCalledWith('b1', 0);
    expect(updateChapterProgressInDB).toHaveBeenCalledWith('b1', 0);
    expect(TrackPlayer.skip).toHaveBeenCalledWith(0);
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(0);
  });

  /*
   * `getBookById` catches its own error and returns `null`, so a missing row
   * arrives as an ordinary falsy value rather than a throw — which is exactly
   * why this path was invisible.
   */
  it('resumes at the stored position when the row cannot be read', async () => {
    (getBookById as jest.Mock).mockResolvedValue(null);

    await play(finishedBook());

    expect(updateChapterIndexInDB).not.toHaveBeenCalled();
    expect(updateChapterProgressInDB).not.toHaveBeenCalled();
    expect(TrackPlayer.skip).toHaveBeenCalledWith(1);
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(300);
  });

  it('resumes at the stored position when the write throws', async () => {
    (getBookById as jest.Mock).mockResolvedValue({
      updateBookProgress: jest.fn().mockRejectedValue(new Error('db locked')),
    });

    await play(finishedBook());

    expect(updateChapterIndexInDB).not.toHaveBeenCalled();
    expect(TrackPlayer.skip).toHaveBeenCalledWith(1);
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(300);
  });

  /*
   * The ordering IS the fix. Deciding the restart from a props snapshot while
   * the write that clears the flag is still in flight is what let the two
   * halves disagree, so the demotion has to have SETTLED before anything acts
   * on it.
   *
   * ⚠ THE `setTimeout` IS LOAD-BEARING, not padding. With an
   * instantly-resolving mock the unawaited original passes this too — its
   * microtasks drain during the very next `await` — so the write has to span a
   * macrotask before the assertion can tell the two apart. Verified by
   * mutation: without the delay, restoring the fire-and-forget IIFE leaves
   * this test green.
   */
  it('settles the demotion before zeroing the stored position', async () => {
    const order: string[] = [];
    (getBookById as jest.Mock).mockResolvedValue({
      updateBookProgress: jest.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        order.push('demote');
      }),
    });
    (updateChapterIndexInDB as jest.Mock).mockImplementation(async () => {
      order.push('zero');
    });

    await play(finishedBook());

    expect(order).toEqual(['demote', 'zero']);
  });
});

/*
 * The other half of the same branch, and the reason the demotion is not simply
 * skipped on failure: a NOT-STARTED book is promoted for the library's Started
 * tab, and nothing about that promotion is load-bearing for playback. It must
 * keep working, and it must NOT trigger a restart.
 */
describe('a not-started book is promoted without restarting', () => {
  it('leaves the stored position alone', async () => {
    const updateBookProgress = jest.fn().mockResolvedValue(undefined);
    (getBookById as jest.Mock).mockResolvedValue({ updateBookProgress });
    const book = finishedBook();
    (book as { bookProgressValue: number }).bookProgressValue =
      BookProgressState.NotStarted;

    await play(book);

    expect(updateBookProgress).toHaveBeenCalledWith(BookProgressState.Started);
    expect(updateChapterIndexInDB).not.toHaveBeenCalled();
    expect(TrackPlayer.skip).toHaveBeenCalledWith(1);
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(300);
  });
});
