import { useLibraryStore } from '@/store/library';
import { updateChapterIndexInDB } from '@/db/chapterQueries';

/**
 * Writes a Book's current chapter index to both places that hold it: the
 * Zustand store the UI reads, and the WatermelonDB row that survives a
 * restart.
 *
 * The two halves are one unit because they are a correctness invariant rather
 * than a tidiness preference. `chapterList` resolves its highlight as
 * `storeIndex ?? book.bookProgress?.currentChapterIndex ?? -1` — the store is
 * consulted FIRST and the DB row is only a fallback for `undefined`, so a
 * stale store entry beats a correct DB row and highlights the wrong chapter.
 * `BookDurationRow` reads `playbackIndex[bookId]` the same way. The pair used
 * to be open-coded at four sites and one of them drifted exactly that way: the
 * `RemoteNext` finish branch reset the position and never wrote the index.
 *
 * Store first, DB second, and the DB write is awaited: the in-memory half is
 * what the UI reads on the next render, and the persisted half is a bridge
 * round-trip away.
 *
 * NOT in here: the chapter PROGRESS pair. Progress writes store and DB on
 * deliberately different cadences (store every 1 Hz tick, DB only on a chapter
 * change or via the 30 s `savePeriodicProgress` throttle), so a matching
 * `setChapterProgress` would have to swallow the throttle to exist. Nor the
 * single-file chapter-change detector: that is the dedupe cache which decides
 * WHETHER to call this, not part of writing the index.
 */
export const setChapterIndex = async (
  bookId: string,
  index: number,
): Promise<void> => {
  useLibraryStore.getState().setPlaybackIndex(bookId, index);

  await updateChapterIndexInDB(bookId, index);
};
