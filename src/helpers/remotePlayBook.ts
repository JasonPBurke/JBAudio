import { play } from '@/player/trackPlayer';
import type { Book } from '@/types/Book';
import { useLibraryStore } from '@/store/library';
import { useQueueStore } from '@/store/queue';
import { handleBookPlay } from '@/helpers/handleBookPlay';
import { ensurePlayerSetup } from '@/helpers/playerSetup';
import {
  getBookWithChaptersForRestoration,
  getBookProgressValue,
  stampLastPlayed,
} from '@/db/bookQueries';

// True while a remote-initiated book switch is loading its queue. Android
// Auto's onAddMediaItems is followed by a play() command; without this guard
// that play() resumes the OLD queue for a moment (and records a footprint
// for the wrong book) before handleBookPlay resets it.
let bookSwitchInProgress = false;
export const isBookSwitchInProgress = () => bookSwitchInProgress;

/**
 * Handles the native `remote-play-book` event (a browse item tapped in
 * Android Auto). Works in a headless runtime: sets up the player if the UI
 * never did, and falls back to WatermelonDB when the library store (hydrated
 * only by the UI) is empty.
 */
export async function handleRemotePlayBook(bookId: string): Promise<void> {
  await ensurePlayerSetup();

  const { requestedBookId, setRequestedBookId } = useQueueStore.getState();
  if (requestedBookId === bookId) {
    void stampLastPlayed(bookId);
    await play();
    return;
  }

  let book: Book | undefined = useLibraryStore.getState().books[bookId];
  if (!book) {
    const data = await getBookWithChaptersForRestoration(bookId);
    if (!data) return;
    book = {
      ...data,
      bookProgressValue: await getBookProgressValue(bookId),
    } as Book;
  }

  bookSwitchInProgress = true;
  try {
    // playing=true is unused here: alreadyInPlay=false bypasses handleBookPlay's guard
    await handleBookPlay(
      book,
      true,
      false,
      requestedBookId,
      setRequestedBookId,
    );
  } catch (error) {
    // Remote entry point: nothing upstream can handle this, so don't let it
    // become an unhandled rejection in the playback service.
    console.error('remote-play-book failed:', error);
  } finally {
    bookSwitchInProgress = false;
  }
}
