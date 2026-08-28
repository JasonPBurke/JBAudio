import { setChapterIndex } from '../setChapterIndex';
import { updateChapterIndexInDB } from '@/db/chapterQueries';

/*
 * The store+DB pair for a Book's chapter INDEX. It exists as one unit because
 * the two halves are a correctness invariant, not a tidiness preference:
 * `chapterList.tsx` resolves its highlight as
 * `storeIndex ?? book.bookProgress?.currentChapterIndex ?? -1`, so the store is
 * consulted FIRST and a stale store entry beats a correct DB row. The pair was
 * open-coded at four sites and one of them drifted — see
 * .scratch/chapter-position-writes/issues/01-*.md and
 * .scratch/remote-noop-footprint/issues/02-*.md.
 */

const mockSetPlaybackIndex = jest.fn();

jest.mock('@/store/library', () => ({
  useLibraryStore: {
    getState: () => ({
      setPlaybackIndex: mockSetPlaybackIndex,
    }),
  },
}));

jest.mock('@/db/chapterQueries', () => ({
  updateChapterIndexInDB: jest.fn(),
}));

beforeEach(() => {
  // resetAllMocks, not clearAllMocks: the pending-promise test below installs
  // a mockImplementation, and `clear` drops recorded calls but KEEPS
  // implementations — which leaks a never-resolving DB write into the next
  // test and fails it as a timeout, pointing at the innocent test.
  jest.resetAllMocks();
});

describe('setChapterIndex', () => {
  it('writes the in-memory AND the persisted half of the chapter index', async () => {
    await setChapterIndex('book-1', 3);

    expect(mockSetPlaybackIndex).toHaveBeenCalledWith('book-1', 3);
    expect(updateChapterIndexInDB).toHaveBeenCalledWith('book-1', 3);
  });

  it('writes the store BEFORE awaiting the DB, so the UI never reads a stale index across the bridge round-trip', async () => {
    let storeWrittenBeforeDb = false;
    (updateChapterIndexInDB as jest.Mock).mockImplementation(async () => {
      storeWrittenBeforeDb = mockSetPlaybackIndex.mock.calls.length === 1;
    });

    await setChapterIndex('book-1', 2);

    expect(storeWrittenBeforeDb).toBe(true);
  });

  it('awaits the DB write, so a caller that awaits it can rely on the row being on disk', async () => {
    let resolveDb: () => void = () => {};
    (updateChapterIndexInDB as jest.Mock).mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveDb = resolve;
        }),
    );

    let settled = false;
    const pending = setChapterIndex('book-1', 1).then(() => {
      settled = true;
    });

    await Promise.resolve();
    expect(settled).toBe(false);

    resolveDb();
    await pending;
    expect(settled).toBe(true);
  });

  it('writes index 0 like any other index — the rewind case is not special-cased away', async () => {
    await setChapterIndex('book-1', 0);

    expect(mockSetPlaybackIndex).toHaveBeenCalledWith('book-1', 0);
    expect(updateChapterIndexInDB).toHaveBeenCalledWith('book-1', 0);
  });
});
