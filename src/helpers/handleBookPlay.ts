import { resolveTrackArtwork } from '@/helpers/defaultArtwork';
import {
  getChapterProgressInDB,
  updateChapterProgressInDB,
} from '@/db/chapterQueries';
import { Book } from '@/types/Book';
import { getBookById, stampLastPlayed } from '@/db/bookQueries';
import {
  add,
  play,
  reset,
  seekTo,
  setVolume,
  skip,
  type Track,
} from '@/player/trackPlayer';
import { updateLastActiveBook } from '@/db/settingsQueries';
import { awaitPlayerReady } from '@/helpers/awaitPlayerReady';
import { hasValidChapterData } from '@/helpers/chapterMetadata';
import { locateInBook } from '@/helpers/bookLocation';
import {
  shouldUseClippedChapters,
  buildClippedChapterTracks,
} from '@/helpers/clippedChapters';
import { queueShapeOf } from '@/helpers/queueShape';
import { applyPersistedPlaybackRate } from '@/helpers/applyPlaybackRate';
import { setChapterIndex } from '@/helpers/setChapterIndex';
import { BookProgressState } from '@/helpers/bookProgressState';

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
const demoteToStarted = async (
  bookId: string | undefined,
): Promise<boolean> => {
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
  alreadyInPlay: boolean,
  requestedBookId: string | null,
  setRequestedBookId: (bookId: string) => void,
) => {
  if (!book) return;
  if (alreadyInPlay && playing) return;
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
  const demoted = needsDemotion
    ? await demoteToStarted(book.bookId)
    : false;

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
  const storedChapterIndex = Math.min(
    storedIndex,
    book.chapters.length - 1,
  );
  const storedChapterProgress = progressInfo?.progress ?? 0;

  /*
   * The zeroed position is written back BEFORE playback starts so the queue and
   * the database agree: the notification, the floating player and the next
   * resume all read the DB, and a later write would race the first progress tick.
   *
   * The INDEX goes through `setChapterIndex` because it lives in two places
   * that must agree; why that pairing is an invariant rather than a tidiness
   * preference is documented on that module, not restated here.
   *
   * The local fact it does not cover: writing the store half HERE is not the
   * race the paragraph above warns about. That warning is about the DB write.
   * The store half is synchronous and in-process, and the first progress tick
   * it could race has not happened yet, because `play()` is below.
   * See `.scratch/chapter-position-writes/issues/02-*.md`.
   *
   * ⚠ The PROGRESS half stays a bare DB write — there is deliberately no
   * `setChapterProgress`. Do not "finish the symmetry" here.
   */
  if (restartFromZero && book.bookId) {
    await setChapterIndex(book.bookId, 0);
    await updateChapterProgressInDB(book.bookId, 0);
  }

  const chapterIndex = restartFromZero ? 0 : storedChapterIndex;
  const chapterProgress = restartFromZero ? 0 : storedChapterProgress;

  const isChangingBook = book.bookId !== requestedBookId;

  // A queue builder is one of the three callers that needs a VERDICT rather
  // than a coordinate — `queueShapeOf`'s header says why, and why that forces
  // it to be pure.
  const oneItemQueue = queueShapeOf(book.chapters) === 'one-item';
  // WHICH multi-item Queue, not WHETHER: the verdict has already folded this
  // gate in, so a Book that clips is already 'multi-item'.
  const useClipped = shouldUseClippedChapters(book.chapters);

  /*
   * WHERE TO PUT THE PLAYHEAD ON A ONE-ITEM QUEUE, in the coordinate the
   * Player speaks.
   *
   * The DB stores a CHAPTER Position (`current_chapter_progress`, seconds into
   * the chapter). One Queue item spanning the whole Book means the Player's
   * coordinate is the BOOK Position instead, so the builder has to translate
   * before it seeks — and `helpers/bookLocation` is the one place in the app
   * that may. See ADR 0004.
   *
   * ⚠ Every other arm needs NO conversion and must not ask for one: a
   * multi-item Queue skips to the chapter's own item, where the position
   * already IS the Chapter Position. That asymmetry is the whole of the
   * difference between the arms below.
   */
  const resumeBookPosition = oneItemQueue
    ? locateInBook(book.chapters, {
        from: 'chapter',
        chapterIndex,
        chapterPositionSeconds: chapterProgress,
      })?.bookPositionSeconds
    : undefined;

  if (isChangingBook) {
    await reset();

    if (oneItemQueue) {
      // One Queue item spanning the whole Book: load only 1 track.
      // Use chapter title/duration when valid chapter data exists — a Book
      // with a single chapter has none to show, so it is labelled with the
      // Book's own title and lets the Player resolve the file's duration.
      const hasChapterData = hasValidChapterData(book.chapters);
      const initialChapter = hasChapterData
        ? book.chapters[chapterIndex]
        : null;

      const track: Track = {
        url: book.chapters[0].url,
        title: initialChapter?.chapterTitle ?? book.bookTitle,
        artist: book.author,
        artwork: resolveTrackArtwork(book.artwork),
        album: book.bookTitle,
        bookId: book.bookId,
        duration: initialChapter?.chapterDuration,
      };
      await add([track]);

      // `null` means the stored index names no chapter, so there is no honest
      // Book Position to seek to; the freshly reset Queue is already at 0:00.
      if (resumeBookPosition != null) await seekTo(resumeBookPosition);
    } else if (useClipped) {
      await add(buildClippedChapterTracks(book));
      if (chapterIndex > 0) await skip(chapterIndex);
      // The DB already stores a Chapter Position, and positions inside a
      // clipped window are chapter-relative too — so no conversion here.
      await seekTo(chapterProgress);
    } else {
      // One item per Chapter, one file each: load N tracks
      const tracks: Track[] = book.chapters.map((chapter) => ({
        url: chapter.url,
        title: chapter.chapterTitle,
        artist: chapter.author,
        artwork: resolveTrackArtwork(book.artwork),
        album: book.bookTitle,
        bookId: book.bookId,
        duration: chapter.chapterDuration,
      }));

      await add(tracks);
      await skip(chapterIndex);
      await seekTo(chapterProgress);
    }

    // reset() above dropped the rate back to 1× — restore before playing
    await applyPersistedPlaybackRate();

    await play();
    await setVolume(1);

    if (book.bookId) {
      setRequestedBookId(book.bookId);
      await updateLastActiveBook(book.bookId);
    }
  } else {
    // Same book - just seek to the correct position
    if (oneItemQueue) {
      // One Queue item: the position is absolute, so there is nothing to skip
      // to and the chapter is a seek offset inside the single track.
      if (resumeBookPosition != null) await seekTo(resumeBookPosition);
    } else {
      // One item per chapter, clipped or one file each: skip to the chapter's
      // item, where the position is chapter-relative.
      await skip(chapterIndex);
      await seekTo(chapterProgress);
    }

    await play();
    await setVolume(1);
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
  alreadyInPlay: boolean,
  requestedBookId: string | null,
  setRequestedBookId: (bookId: string) => void,
): Promise<void> => {
  const next = playChain
    .catch(() => {})
    .then(() =>
      handleBookPlayInner(
        book,
        playing,
        alreadyInPlay,
        requestedBookId,
        setRequestedBookId,
      ),
    );
  playChain = next;
  return next;
};
