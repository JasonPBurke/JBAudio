import {
  add,
  getQueue,
  reset,
  seekTo,
  skip,
  type Track,
} from '@/player/trackPlayer';
import * as Sentry from '@sentry/react-native';
import { getLastActiveBook } from '@/db/settingsQueries';
import { getBookWithChaptersForRestoration } from '@/db/bookQueries';
import { getChapterProgressInDB } from '@/db/chapterQueries';
import { resolveTrackArtwork } from '@/helpers/defaultArtwork';
import { useQueueStore } from '@/store/queue';
import { hasValidChapterData } from '@/helpers/chapterMetadata';
import { locateInBook } from '@/helpers/bookLocation';
import { queueShapeOf } from '@/helpers/queueShape';
import {
  shouldUseClippedChapters,
  buildClippedChapterTracks,
} from '@/helpers/clippedChapters';
import { applyPersistedPlaybackRate } from '@/helpers/applyPlaybackRate';
import type { Book } from '@/types/Book';

/**
 * Loads the last active book into the Player's queue (paused) and seeks
 * to the persisted position. Moved verbatim from useSetupTrackPlayer so the
 * playback service can also run it headlessly (Android Auto / media
 * resumption when the UI never mounted). Errors propagate — callers decide
 * how to report them.
 */
export async function restoreLastActiveBook(): Promise<void> {
  const lastActiveBookId = await getLastActiveBook();
  if (!lastActiveBookId) return;

  // Read directly from WatermelonDB to avoid race condition with Zustand store
  // The store may not be populated yet when this runs during app startup
  const bookData = await getBookWithChaptersForRestoration(lastActiveBookId);
  if (!bookData) {
    console.warn('Position restoration: Book not found in database');
    return;
  }

  const { chapters, ...bookInfo } = bookData;

  const queue = await getQueue();
  // Only load tracks if queue is empty or has the wrong book.
  if (!queue.length || queue[0]?.bookId !== lastActiveBookId) {
    await reset();

    // A queue builder is one of the three callers that needs a VERDICT rather
    // than a coordinate — see `queueShapeOf`'s header, and `handleBookPlay`,
    // which builds the same three shapes for a play press.
    const oneItemQueue = queueShapeOf(chapters) === 'one-item';
    const progressInfo = await getChapterProgressInDB(bookInfo.bookId);

    if (oneItemQueue) {
      // One Queue item spanning the whole Book: load only 1 track.
      // Use chapter title/duration when valid chapter data exists — a Book
      // with a single chapter has none to show, so it is labelled with the
      // Book's own title and lets the Player resolve the file's duration.
      const hasChapterData = hasValidChapterData(chapters);
      const chapterIndex = progressInfo?.chapterIndex || 0;
      const validChapterIndex = Math.min(chapterIndex, chapters.length - 1);
      const initialChapter = hasChapterData
        ? chapters[validChapterIndex]
        : null;

      const track: Track = {
        url: chapters[0].url,
        title: initialChapter?.chapterTitle ?? bookInfo.bookTitle,
        artist: bookInfo.author,
        artwork: resolveTrackArtwork(bookInfo.artwork),
        album: bookInfo.bookTitle,
        bookId: bookInfo.bookId,
        duration: initialChapter?.chapterDuration,
      };
      await add([track]);

      /*
       * The DB stores a CHAPTER Position; one Queue item spanning the whole
       * Book means the Player wants a BOOK Position. `helpers/bookLocation` is
       * the one place in the app that converts between the two — see ADR 0004.
       *
       * ⚠ It is handed the index ALREADY CLAMPED, the same
       * `validChapterIndex` the track above is labelled with, so a stale index
       * left by a rescan resumes at the last chapter rather than being
       * refused. Clamping is the CALLER's judgement to make here — the label
       * and the seek must agree about which chapter this is — and the
       * translator declining an out-of-range index is what makes that
       * judgement visible instead of silent.
       */
      if (progressInfo) {
        const resumeBookPosition = locateInBook(chapters, {
          from: 'chapter',
          chapterIndex: validChapterIndex,
          chapterPositionSeconds: progressInfo.progress || 0,
        })?.bookPositionSeconds;

        /*
         * ⚠ TWO DIFFERENT FAILURES, kept in separate branches on purpose.
         *
         * `null` is the translator declining — it could not tell where this
         * is, so there is NO NUMBER TO CLAMP and the Book opens at its start.
         * Out of bounds is a number it could tell and we do not believe.
         * Folding them together would report a missing reading as a bad one.
         */
        if (resumeBookPosition == null) {
          Sentry.captureMessage('Position restoration: Unmeasurable', {
            level: 'warning',
            extra: {
              bookId: lastActiveBookId,
              chapterIndex: progressInfo.chapterIndex,
              progress: progressInfo.progress,
              chapterCount: chapters.length,
            },
          });
          await seekTo(0);
        } else if (
          resumeBookPosition < 0 ||
          resumeBookPosition > bookInfo.bookDuration
        ) {
          Sentry.captureMessage('Position restoration: Out of bounds', {
            level: 'warning',
            extra: {
              bookId: lastActiveBookId,
              chapterIndex: progressInfo.chapterIndex,
              progress: progressInfo.progress,
              calculatedPosition: resumeBookPosition,
              bookDuration: bookInfo.bookDuration,
              chapterCount: chapters.length,
            },
          });
          // Clamp to valid range
          await seekTo(
            Math.max(
              0,
              Math.min(resumeBookPosition, bookInfo.bookDuration - 1),
            ),
          );
        } else {
          await seekTo(resumeBookPosition);
        }

        Sentry.addBreadcrumb({
          category: 'position-restoration',
          message: 'One-item queue position restored',
          data: {
            bookId: lastActiveBookId,
            bookTitle: bookInfo.bookTitle,
            chapterIndex: progressInfo.chapterIndex,
            progress: progressInfo.progress,
            resumeBookPosition,
            chapterCount: chapters.length,
          },
          level: 'info',
        });
      }
    } else if (shouldUseClippedChapters(chapters)) {
      // WHICH multi-item Queue, not WHETHER: the verdict has already folded
      // this gate in, so a Book that clips is already 'multi-item'.
      // SPIKE (Bug B): clipped per-chapter queue — restore like a multi-file book
      await add(
        buildClippedChapterTracks({ ...bookInfo, chapters } as unknown as Book),
      );
      const clampedIndex = Math.min(
        progressInfo?.chapterIndex || 0,
        chapters.length - 1,
      );
      if (clampedIndex > 0) await skip(clampedIndex);
      await seekTo(progressInfo?.progress || 0);
    } else {
      // One item per Chapter, one file each: load N tracks
      const tracks: Track[] = chapters.map((chapter) => ({
        url: chapter.url,
        title: chapter.chapterTitle,
        artist: bookInfo.author,
        artwork: resolveTrackArtwork(bookInfo.artwork),
        album: bookInfo.bookTitle,
        bookId: bookInfo.bookId,
        duration: chapter.chapterDuration,
      }));

      await add(tracks);

      if (
        progressInfo?.chapterIndex !== undefined &&
        progressInfo.chapterIndex !== null
      ) {
        // Validate chapter index is within bounds
        if (progressInfo.chapterIndex >= chapters.length) {
          Sentry.captureMessage(
            'Position restoration: Invalid chapter index',
            {
              level: 'warning',
              extra: {
                bookId: lastActiveBookId,
                chapterIndex: progressInfo.chapterIndex,
                chapterCount: chapters.length,
              },
            },
          );
          // Fall back to last valid chapter
          const safeChapterIndex = Math.max(0, chapters.length - 1);
          await skip(safeChapterIndex);
        } else if (progressInfo.chapterIndex > 0) {
          await skip(progressInfo.chapterIndex);
          await seekTo(progressInfo.progress || 0);
        } else {
          // chapterIndex is 0, just seek within first track
          await seekTo(progressInfo.progress || 0);
        }

        Sentry.addBreadcrumb({
          category: 'position-restoration',
          message: 'Multi-file position restored',
          data: {
            bookId: lastActiveBookId,
            bookTitle: bookInfo.bookTitle,
            chapterIndex: progressInfo.chapterIndex,
            progress: progressInfo.progress,
            chapterCount: chapters.length,
          },
          level: 'info',
        });
      }
    }

    // reset() above dropped the rate back to 1× — restore it
    await applyPersistedPlaybackRate();
  }
  // Always update the active book in our own state
  useQueueStore.getState().setRequestedBookId(bookInfo.bookId);
}
