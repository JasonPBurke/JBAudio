import { markBookFinishedOnce } from '../markBookFinishedOnce';
import { getBookById } from '@/db/bookQueries';

/*
 * The one store-guarded `Finished` mark, which three finish branches share.
 *
 * Two properties, and the second is the reason the verb exists at all:
 *
 *  - the GUARD. A press that lands inside the book-end lead window arrives at
 *    a Book the 1 Hz tick has already marked, and `updateBookProgress`
 *    rewrites `finished_at` unconditionally. Re-marking would drag that
 *    timestamp forward to the true end.
 *  - the SWALLOW. `updateBookProgress` is a raw WatermelonDB writer and throws
 *    if the row was destroyed underneath it by a concurrent scan. Before this
 *    module the swallow existed at one of the three sites as an outer wrapper
 *    and was simply absent at the other two, where the escaping rejection
 *    aborted the transport calls that follow. Owning it here removes the
 *    choice.
 */

jest.mock('@/db/bookQueries', () => ({
  getBookById: jest.fn(),
}));

const mockGetBookById = getBookById as jest.Mock;
let updateBookProgress: jest.Mock;
let consoleError: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  updateBookProgress = jest.fn().mockResolvedValue(undefined);
  mockGetBookById.mockResolvedValue({ updateBookProgress });
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe('markBookFinishedOnce — the guard', () => {
  it('marks a Book whose store entry is not yet Finished', async () => {
    await markBookFinishedOnce('book-1', { bookProgressValue: 1 });

    expect(mockGetBookById).toHaveBeenCalledWith('book-1');
    expect(updateBookProgress).toHaveBeenCalledWith(2);
  });

  it('marks a Book with no progress value at all', async () => {
    await markBookFinishedOnce('book-1', {});

    expect(updateBookProgress).toHaveBeenCalledWith(2);
  });

  // The cold-start path: the playback service can run before the library
  // store is populated, so an absent entry is legitimate and must not be
  // read as "already finished".
  it('marks a Book that has no store entry', async () => {
    await markBookFinishedOnce('book-1', undefined);

    expect(updateBookProgress).toHaveBeenCalledWith(2);
  });

  it('does NOT re-mark a Book whose store entry is already Finished', async () => {
    await markBookFinishedOnce('book-1', { bookProgressValue: 2 });

    expect(mockGetBookById).not.toHaveBeenCalled();
    expect(updateBookProgress).not.toHaveBeenCalled();
  });

  // `getBookById` catches its own error and returns null, so a missing row
  // arrives as an ordinary falsy value rather than as a throw.
  it('is a no-op when the Book model cannot be resolved', async () => {
    mockGetBookById.mockResolvedValue(null);

    await expect(
      markBookFinishedOnce('book-1', undefined),
    ).resolves.toBeUndefined();
    expect(updateBookProgress).not.toHaveBeenCalled();
  });
});

describe('markBookFinishedOnce — the swallow', () => {
  it('never throws when the write rejects, and logs instead', async () => {
    updateBookProgress.mockRejectedValue(new Error('row destroyed'));

    await expect(
      markBookFinishedOnce('book-1', undefined),
    ).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });

  it('never throws when the lookup itself rejects', async () => {
    mockGetBookById.mockRejectedValue(new Error('database closed'));

    await expect(
      markBookFinishedOnce('book-1', undefined),
    ).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });
});
