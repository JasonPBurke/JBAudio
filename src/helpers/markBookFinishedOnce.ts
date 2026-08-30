import { getBookById } from '@/db/bookQueries';
import { BookProgressState } from '@/helpers/bookProgressState';

/**
 * Marks a Book `Finished` — once, and without ever throwing.
 *
 * The step every finish path shares. Three of them exist: the skip-forward
 * press's `finish` branch (`helpers/nextPress.ts`), the forward relative
 * seek's (`helpers/relativeSeek.ts`), and the playback service's
 * `Event.PlaybackQueueEnded`. They kept three hand-maintained copies of the
 * two lines below, agreeing by inspection rather than by construction.
 *
 * ── The guard, and why it reads the STORE ──
 *
 * `updateBookProgress` rewrites `finished_at = new Date()` unconditionally, so
 * a second mark does not merely re-set a flag — it drags the finish TIMESTAMP
 * forward. A press that lands inside the book-end lead window arrives at a
 * Book the 1 Hz tick marked up to a minute ago, and that earlier time is the
 * one worth keeping.
 *
 * Guarded on the store's `bookProgressValue`, never on the service's
 * `finishMarkedBookId` latch: that latch is process-lifetime state a previous
 * listen can leave set, so trusting it here would silently skip the mark and
 * lose the ✓ on exactly the Books whose ticks were undecidable. The store
 * cannot go stale that way — a lead-time mark happened a whole lead window
 * ago, and the WatermelonDB observer refreshes within about one tick.
 *
 * `book` is the CALLER's store entry, passed in rather than read here. That
 * keeps `handleNextPress`'s ordering property assertable without a store,
 * which is the reason that function takes its Book as a parameter at all.
 * What stays duplicated at the call sites is therefore a lookup, not a guard —
 * and a lookup is not the thing that drifts.
 *
 * ── The swallow, which is intrinsic on purpose ──
 *
 * `updateBookProgress` is a raw WatermelonDB writer and throws if the row was
 * destroyed underneath it (a concurrent scan's `removeMissingFiles`). Every
 * caller runs it behind a user press or a queue-ended event and then issues
 * transport calls, so an escaping rejection would cost the seek, the stop and
 * the chapter-tracking rewind that follow — and surface as an unhandled
 * rejection, since none of the call sites catches. The swallow used to be
 * spelled three ways across the family and was missing at two sites; owning it
 * here removes the choice.
 *
 * Marking is ALL this does. No seek, skip, pause, stop or chapter-tracking
 * rewind: those legitimately differ per site (which queue shapes can reach it,
 * and whether an armed sleep timer survives) and stay at the call sites.
 *
 * Not for the progress tick's marker in `setup/service.ts`. That one guards on
 * the process-lifetime latch instead of the store and must latch only AFTER
 * the write lands — an invariant a verb that swallows cannot serve, because
 * the caller could not tell whether the write happened.
 */
export async function markBookFinishedOnce(
  bookId: string,
  book: { bookProgressValue?: number } | undefined,
): Promise<void> {
  // An absent entry is legitimate on the cold-start path, where the playback
  // service runs before the library store is populated. Absent means "not
  // known to be finished", so the mark proceeds.
  if (book?.bookProgressValue === BookProgressState.Finished) return;

  try {
    const bookModel = await getBookById(bookId);
    if (!bookModel) return;
    await bookModel.updateBookProgress(BookProgressState.Finished);
  } catch (error) {
    // Reported the same way the progress tick's marker reports the same
    // failure, so one grep finds both.
    console.error('[markBookFinishedOnce] mark failed:', error);
  }
}
