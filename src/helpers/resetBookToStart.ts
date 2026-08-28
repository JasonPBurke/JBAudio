import { useLibraryStore } from '@/store/library';
import { updateChapterProgressInDB } from '@/db/chapterQueries';
import { setChapterIndex } from '@/helpers/setChapterIndex';

/**
 * The chapter-change detector the playback service keeps at module scope for
 * single-file Books: the last chapter index it saw, and the Book it saw it
 * in. It is passed in rather than owned here because the progress handler
 * reads and writes it on every tick — this module only rewinds it.
 */
export type SingleFileChapterTracking = {
  lastChapterIndex: number;
  bookId: string | null;
};

/**
 * Rewinds a Book to its first chapter: the one reset shared by the two paths
 * that finish a Book — `Event.PlaybackQueueEnded` (playing to the true end)
 * and `RemoteNext`'s finish branch (pressing Next on the last chapter).
 *
 * It exists because those two copies drifted. The remote branch reset
 * playback and nothing else, so the chapter list kept highlighting the last
 * chapter of a Book that had just been rewound: `chapterList` resolves its
 * highlight from `playbackIndex[bookId]` and only falls back to the DB row
 * when that selector is `undefined`, so a stale STORE entry beats a correct
 * DB row. Both halves of both values have to move together, which is why all
 * four writes live here and neither caller writes them itself. The index pair
 * is delegated to `setChapterIndex` — see that module for why the pairing is
 * an invariant rather than a preference — and this module stays the home for
 * the whole rewind.
 *
 * The tracking rewind is the fifth piece and the least obvious: leaving
 * `lastChapterIndex` at the final chapter makes the next progress tick — the
 * first one after the user presses play again — read as a chapter change and
 * record a spurious `chapter_change` footprint.
 */
export async function resetBookToStart(
  bookId: string,
  tracking: SingleFileChapterTracking,
): Promise<void> {
  const { setPlaybackProgress } = useLibraryStore.getState();

  // In-memory first: the UI reads the store, and the DB writes below are a
  // bridge round-trip away. `setChapterIndex` writes its store half
  // synchronously before it awaits, so both in-memory writes still land in
  // this one block; only the two independent DB writes swap order.
  setPlaybackProgress(bookId, 0);
  await setChapterIndex(bookId, 0);

  await updateChapterProgressInDB(bookId, 0);

  tracking.lastChapterIndex = 0;
  tracking.bookId = bookId;
}
