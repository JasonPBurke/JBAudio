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
 * `handleBookPlay` reaches the store through `setChapterIndex`, which imports
 * the library store, which imports WatermelonDB's SQLite adapter —
 * unresolvable in the node lane. So the mock is REQUIRED, not a preference,
 * and it is file-wide because jest module mocks always are; the cases that
 * never touch the store are unaffected by it. Same necessity as
 * `remoteNext.test.ts`.
 *
 * A STATEFUL stand-in, seeded per test. The assertion
 * this file needs on the restart path is the END STATE of the in-memory
 * chapter index, not merely that a write happened — so the setter records into
 * a plain map the tests read back.
 *
 * `getState` is a function on purpose: the factory is hoisted above these
 * consts, so naming `mockSetPlaybackIndex` inside it can only be safe if it is
 * dereferenced when the store is USED rather than when the factory runs. Same
 * shape as `setChapterIndex.test.ts`.
 */
const storePlaybackIndex: Record<string, number> = {};

const mockSetPlaybackIndex = jest.fn((bookId: string, index: number) => {
  storePlaybackIndex[bookId] = index;
});

jest.mock('@/store/library', () => ({
  useLibraryStore: {
    getState: () => ({ setPlaybackIndex: mockSetPlaybackIndex }),
  },
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
  // `clearAllMocks` drops recorded calls but KEEPS implementations, so the
  // recording setter survives; the map it writes into has to be emptied here.
  for (const bookId of Object.keys(storePlaybackIndex)) {
    delete storePlaybackIndex[bookId];
  }
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

/*
 * THE REQUESTED BOOK IS WHAT DECIDES A SWITCH, and this is the only test that
 * proves it. Ticket 11 renamed `store/queue`'s field from `activeBookId` to
 * `requestedBookId` precisely because this argument had the same name as
 * `store/playerState`'s Active Book while answering the opposite question:
 * the Requested Book is an INTENT and LEADS a switch; the Active Book is an
 * OBSERVATION and LAGS one.
 *
 * ⚠ THE HAZARD. Feeding the Active Book in here instead reads, for the length
 * of a switch, as "this Book is already loaded" — so `isChangingBook` is
 * false, the Queue is never rebuilt, and the app seeks inside the OLD Book
 * while every screen names the new one.
 *
 * ⚠ WHAT THESE TWO CASES DO AND DO NOT COVER, stated plainly because an
 * overclaiming comment is the exact defect ticket 11 was filed about. They
 * cover the BRANCH: that this argument, and not some other reading of "what is
 * playing", is what selects rebuild-vs-seek. Before them no case in this file
 * passed a non-null value, so the entire switch branch was decided by one
 * default and never asserted. They do NOT cover the CALL SITES: a caller that
 * passes `store/playerState`'s Active Book here type-checks and leaves this
 * file green. Nothing mechanical catches that — the guard there is the name,
 * which is why the field was renamed rather than merely documented.
 *
 * `Started` keeps the finished/not-started demotion out of the way, so the
 * only thing under test is which branch the fourth argument selects.
 */
describe('the Requested Book decides a switch from a resume', () => {
  const startedBook = (bookId: string): Book => {
    const book = finishedBook();
    (book as { bookId: string }).bookId = bookId;
    (book as { bookProgressValue: number }).bookProgressValue =
      BookProgressState.Started;
    return book;
  };

  it('rebuilds the Queue when the Requested Book differs', async () => {
    const setRequestedBookId = jest.fn();

    await handleBookPlay(
      startedBook('b1'),
      false,
      false,
      'b2', // the Requested Book is something else — this press IS a switch
      setRequestedBookId,
    );

    expect(TrackPlayer.reset).toHaveBeenCalled();
    expect(TrackPlayer.add).toHaveBeenCalled();
    expect(setRequestedBookId).toHaveBeenCalledWith('b1');
  });

  it('seeks in place when the Requested Book is this Book', async () => {
    const setRequestedBookId = jest.fn();

    await handleBookPlay(
      startedBook('b1'),
      false,
      false,
      'b1', // already the Requested Book — this press is a resume
      setRequestedBookId,
    );

    expect(TrackPlayer.reset).not.toHaveBeenCalled();
    expect(TrackPlayer.add).not.toHaveBeenCalled();
    expect(setRequestedBookId).not.toHaveBeenCalled();
    // Still a real resume: the stored position is honoured.
    expect(TrackPlayer.skip).toHaveBeenCalledWith(1);
    expect(TrackPlayer.seekTo).toHaveBeenCalledWith(300);
  });
});

/*
 * Ticket 02 (`.scratch/chapter-position-writes/issues/02-*.md`). The restart
 * zeroed the PERSISTED chapter index and left the in-memory one where the
 * previous listen ended. `chapterList` resolves its highlight as
 * `storeIndex ?? persistedIndex ?? -1` — the store is consulted FIRST — so a
 * correct DB row does not rescue a stale store entry, and the list highlights
 * the chapter the Book was just rewound away from.
 *
 * ⚠ NO PLAYER EVENT IS DELIVERED, on purpose. The window under test is the one
 * BEFORE the first progress tick. On the happy path a tick corrects the store
 * within about a second, but a queue that fails to load, or a pause before the
 * first tick, leaves the drift for the rest of the session. Driving the queue
 * here would exercise the correction and hide the bug.
 */
describe('the restart moves the in-memory chapter index too', () => {
  it('leaves the store at the first chapter, not the previous listen\u2019s', async () => {
    // Where the previous listen left it: deep in the book, never zeroed,
    // because a Book is marked Finished at lead time and the reset that
    // zeroes the store only runs when the queue actually ends.
    storePlaybackIndex.b1 = 1;
    (getBookById as jest.Mock).mockResolvedValue({
      updateBookProgress: jest.fn().mockResolvedValue(undefined),
    });

    await play(finishedBook());

    expect(storePlaybackIndex.b1).toBe(0);
    expect(updateChapterIndexInDB).toHaveBeenCalledWith('b1', 0);
  });

  /*
   * The store write inherits the demotion guard rather than running
   * unconditionally: a restart that did not fire must not move the index it
   * did not rewind.
   */
  it('leaves the in-memory index alone when the demotion does not land', async () => {
    storePlaybackIndex.b1 = 1;
    (getBookById as jest.Mock).mockResolvedValue(null);

    await play(finishedBook());

    expect(storePlaybackIndex.b1).toBe(1);
    expect(mockSetPlaybackIndex).not.toHaveBeenCalled();
  });
});

/*
 * The brief's ordering criterion, which nothing else guarded: BOTH zeroing
 * writes complete before playback starts. The queue, the notification and the
 * floating player all read the persisted row, so a `play()` that overtook the
 * zeroing would surface the finished position for a beat.
 *
 * ⚠ The `setTimeout` is load-bearing for the same reason it is in 'settles the
 * demotion before zeroing the stored position' above: with instantly-resolving
 * mocks the microtasks drain during the next `await` and a moved `play()`
 * would still pass. The write has to span a macrotask for the order to mean
 * anything.
 *
 * `mockImplementationOnce`, not `mockImplementation`: this file clears rather
 * than resets between tests, so a persistent implementation installed here
 * would outlive the test that wanted it.
 */
describe('the restart is fully persisted before playback starts', () => {
  it('completes both zeroing writes before play()', async () => {
    const order: string[] = [];
    (getBookById as jest.Mock).mockResolvedValue({
      updateBookProgress: jest.fn().mockResolvedValue(undefined),
    });
    (updateChapterIndexInDB as jest.Mock).mockImplementationOnce(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      order.push('zero index');
    });
    (updateChapterProgressInDB as jest.Mock).mockImplementationOnce(
      async () => {
        order.push('zero progress');
      },
    );
    (TrackPlayer.play as jest.Mock).mockImplementationOnce(async () => {
      order.push('play');
    });

    await play(finishedBook());

    expect(order).toEqual(['zero index', 'zero progress', 'play']);
  });
});
