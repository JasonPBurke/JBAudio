import { resolveTrackArtwork } from '@/helpers/defaultArtwork';
import {
  getChapterProgressInDB,
  updateChapterIndexInDB,
  updateChapterProgressInDB,
} from '@/db/chapterQueries';
import { Book } from '@/types/Book';
import { getBookById, stampLastPlayed } from '@/db/bookQueries';
import TrackPlayer, { Track } from 'react-native-track-player';
import { updateLastActiveBook } from '@/db/settingsQueries';
import { awaitPlayerReady } from '@/helpers/awaitPlayerReady';
import {
  isSingleFileBook,
  calculateAbsolutePosition,
  hasValidChapterData,
} from '@/helpers/singleFileBook';
import {
  shouldUseClippedChapters,
  buildClippedChapterTracks,
} from '@/helpers/clippedChapters';
import { applyPersistedPlaybackRate } from '@/helpers/applyPlaybackRate';
import { BookProgressState } from '@/helpers/bookProgressState';

// The enum itself lives in a dependency-free module so pure helpers can use
// it; re-exported here because most of the app imports it from this file.
export { BookProgressState };

/**
 * Move a book onto `Started`, reporting whether the write actually LANDED.
 *
 * ⚠ THE RETURN VALUE IS LOAD-BEARING, not a courtesy. §C5's restart is a
 * once-per-listen event that consumes the `Finished` flag, so it may only fire
 * when the flag is known to be gone — see the call site.
 *
 * Two ways to fail, and BOTH used to be silent. `getBookById` catches its own
 * error and returns `null`, so a missing row arrives here as an ordinary falsy
 * value rather than as a throw — a helper that turns errors into `null`
 * reclassifies "broken" as "not there", and the caller's null-check reads like
 * a check for absence.
 */
const demoteToStarted = async (bookId: string | undefined): Promise<boolean> => {
  if (!bookId) return false;
  try {
    const bookModel = await getBookById(bookId);
    if (!bookModel) return false;
    await bookModel.updateBookProgress(BookProgressState.Started);
    return true;
  } catch (error) {
    console.error('Failed to update book progress:', error);
    return false;
  }
};

const handleBookPlayInner = async (
  book: Book | undefined,
  playing: boolean | undefined,
  isActiveBook: boolean,
  activeBookId: string | null,
  setActiveBookId: (bookId: string) => void,
) => {
  if (!book) return;
  if (isActiveBook && playing) return;
  // No chapters means nothing to load (possible transiently mid-rescan);
  // bail rather than crash on chapters[0].url below.
  if (!book.chapters || book.chapters.length === 0) return;

  await awaitPlayerReady();

  // Most-recently-played ordering for the library's Started tab
  if (book.bookId) void stampLastPlayed(book.bookId);

  /*
   * A FINISHED BOOK RESTARTS FROM ZERO, AND BECOMES A BOOK YOU ARE LISTENING TO
   * (spec §C5; the demotion is the driver's ruling of 2026-08-10).
   *
   * Without the restart, playing a finished book resumes at its last few
   * seconds: the playback service marks a book finished and, for a multi-file
   * book, parks the stored position on the final chapter's end. The series
   * detail sheet forced the question, but the rule is not that screen's — it is
   * the better behaviour everywhere, so it lives HERE and the library grid, the
   * list row, the book details screen and Android Auto all inherit it. The
   * browse row's own copy of the rewind was deleted when this landed.
   *
   * ⚠ THE DEMOTION IS WHAT MAKES THE RESTART SAFE, and it is not optional.
   * NOTHING ELSE IN THE APP EVER MOVES A BOOK OFF `Finished` — the playback
   * service, `relativeSeek` and the player only ever set it, and the one path
   * back is the manual progress control on the book details screen. So without
   * this line the restart fires again on EVERY later press: restart a finished
   * book, listen ten minutes, pause, press play from any card, and the ten
   * minutes are gone. Flipping the flag here consumes it, so the restart is
   * structurally a once-per-listen event.
   *
   * It also stops a second lie: `computeBookProgress` short-circuits `Finished`
   * to 100% / `0m`, so a re-listen used to render a full progress capsule and
   * the total duration for its whole duration.
   *
   * ⚠ SO THE RESTART IS CONDITIONAL ON THE DEMOTION LANDING, and the write is
   * AWAITED (code review finding 10). It used to be an unawaited IIFE with a
   * swallowed error, which made the invariant above enforced by nothing: the
   * zeroing below IS awaited and does land, so a failed demotion left the book
   * at position 0 and STILL `Finished` — armed to discard every later listen,
   * permanently, because nothing else moves it off. `bookProgressValue` is read
   * from a props snapshot and never re-read, so "flipping the flag consumes it"
   * only holds if we know the flip happened.
   *
   * Declining the restart is the cheap failure: the book resumes near its end
   * and the user seeks back once. Firing it unconsumed costs them the whole
   * listen, every time.
   */
  const wasFinished = book.bookProgressValue === BookProgressState.Finished;

  // Both states mean the same thing to the rest of the app once you press play:
  // this is now a book you are listening to.
  const needsDemotion =
    wasFinished || book.bookProgressValue === BookProgressState.NotStarted;
  const demoted = needsDemotion ? await demoteToStarted(book.bookId) : false;

  const restartFromZero = wasFinished && demoted;

  const progressInfo = await getChapterProgressInDB(book.bookId!);

  // Default to chapter 0 if no valid progress info exists (prevents silent failure)
  const storedIndex =
    progressInfo?.chapterIndex !== undefined &&
    progressInfo.chapterIndex >= 0
      ? progressInfo.chapterIndex
      : 0;
  // Clamp to the current chapter list — a rescan can shrink a book's chapter
  // count, leaving a stale DB index that would make skip() throw out-of-range.
  const storedChapterIndex = Math.min(storedIndex, book.chapters.length - 1);
  const storedChapterProgress = progressInfo?.progress ?? 0;

  /*
   * The zeroed position is written back BEFORE playback starts so the queue and
   * the database agree: the notification, the floating player and the next
   * resume all read the DB, and a later write would race the first progress tick.
   */
  if (restartFromZero && book.bookId) {
    await updateChapterIndexInDB(book.bookId, 0);
    await updateChapterProgressInDB(book.bookId, 0);
  }

  const chapterIndex = restartFromZero ? 0 : storedChapterIndex;
  const chapterProgress = restartFromZero ? 0 : storedChapterProgress;

  const isChangingBook = book.bookId !== activeBookId;

  const singleFile = isSingleFileBook(book.chapters);
  // SPIKE (Bug B): clipped per-chapter queue — behaves like a multi-file book
  const useClipped = shouldUseClippedChapters(book.chapters);

  if (isChangingBook) {
    await TrackPlayer.reset();

    if (useClipped) {
      await TrackPlayer.add(buildClippedChapterTracks(book));
      if (chapterIndex > 0) await TrackPlayer.skip(chapterIndex);
      // DB progress for single-file books is already chapter-relative, and
      // positions inside a clipped window are chapter-relative too.
      await TrackPlayer.seekTo(chapterProgress);
    } else if (singleFile) {
      // Single-file book: load only 1 track
      // Use chapter title/duration when valid chapter data exists
      const hasChapterData = hasValidChapterData(book.chapters);
      const initialChapter = hasChapterData ? book.chapters[chapterIndex] : null;

      const track: Track = {
        url: book.chapters[0].url,
        title: initialChapter?.chapterTitle ?? book.bookTitle,
        artist: book.author,
        artwork: resolveTrackArtwork(book.artwork),
        album: book.bookTitle,
        bookId: book.bookId,
        duration: initialChapter?.chapterDuration,
      };
      await TrackPlayer.add(track);

      // Seek to absolute position (chapter start + progress within chapter)
      const absolutePosition = calculateAbsolutePosition(
        book.chapters,
        chapterIndex,
        chapterProgress,
      );
      await TrackPlayer.seekTo(absolutePosition);
    } else {
      // Multi-file book: load N tracks (one per chapter)
      const tracks: Track[] = book.chapters.map((chapter) => ({
        url: chapter.url,
        title: chapter.chapterTitle,
        artist: chapter.author,
        artwork: resolveTrackArtwork(book.artwork),
        album: book.bookTitle,
        bookId: book.bookId,
        duration: chapter.chapterDuration,
      }));

      await TrackPlayer.add(tracks);
      await TrackPlayer.skip(chapterIndex);
      await TrackPlayer.seekTo(chapterProgress);
    }

    // reset() above dropped the rate back to 1× — restore before playing
    await applyPersistedPlaybackRate();

    await TrackPlayer.play();
    await TrackPlayer.setVolume(1);

    if (book.bookId) {
      setActiveBookId(book.bookId);
      await updateLastActiveBook(book.bookId);
    }
  } else {
    // Same book - just seek to the correct position
    if (useClipped) {
      await TrackPlayer.skip(chapterIndex);
      await TrackPlayer.seekTo(chapterProgress);
    } else if (singleFile) {
      // Single-file book: seek to absolute position
      const absolutePosition = calculateAbsolutePosition(
        book.chapters,
        chapterIndex,
        chapterProgress,
      );
      await TrackPlayer.seekTo(absolutePosition);
    } else {
      // Multi-file book: skip to chapter and seek
      await TrackPlayer.skip(chapterIndex);
      await TrackPlayer.seekTo(chapterProgress);
    }

    await TrackPlayer.play();
    await TrackPlayer.setVolume(1);
  }
};

// Serializes play requests. Concurrent calls (double-tap, grid item +
// floating player) each pass awaitPlayerReady and then interleave
// reset()/add()/skip()/seekTo(), producing a doubled queue or out-of-range
// skip errors. Chaining makes the second request start only after the first
// has fully loaded the queue.
let playChain: Promise<void> = Promise.resolve();

export const handleBookPlay = (
  book: Book | undefined,
  playing: boolean | undefined,
  isActiveBook: boolean,
  activeBookId: string | null,
  setActiveBookId: (bookId: string) => void,
): Promise<void> => {
  const next = playChain
    .catch(() => {})
    .then(() =>
      handleBookPlayInner(
        book,
        playing,
        isActiveBook,
        activeBookId,
        setActiveBookId,
      ),
    );
  playChain = next;
  return next;
};
