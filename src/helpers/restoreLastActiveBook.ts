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

    const singleFile = isSingleFileBook(chapters);
    const progressInfo = await getChapterProgressInDB(bookInfo.bookId);

    if (shouldUseClippedChapters(chapters)) {
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
    } else if (singleFile) {
      // Single-file book: load only 1 track
      // Use chapter title/duration when valid chapter data exists
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

      // Restore position by calculating absolute position from chapter + progress
      if (progressInfo) {
        const absolutePosition = calculateAbsolutePosition(
          chapters,
          progressInfo.chapterIndex || 0,
          progressInfo.progress || 0,
        );

        // Validate position is within bounds
        if (
          absolutePosition < 0 ||
          absolutePosition > bookInfo.bookDuration
        ) {
          Sentry.captureMessage('Position restoration: Out of bounds', {
            level: 'warning',
            extra: {
              bookId: lastActiveBookId,
              chapterIndex: progressInfo.chapterIndex,
              progress: progressInfo.progress,
              calculatedPosition: absolutePosition,
              bookDuration: bookInfo.bookDuration,
              chapterCount: chapters.length,
            },
          });
          // Clamp to valid range
          const clampedPosition = Math.max(
            0,
            Math.min(absolutePosition, bookInfo.bookDuration - 1),
          );
          await seekTo(clampedPosition);
        } else {
          await seekTo(absolutePosition);
        }

        Sentry.addBreadcrumb({
          category: 'position-restoration',
          message: 'Single-file position restored',
          data: {
            bookId: lastActiveBookId,
            bookTitle: bookInfo.bookTitle,
            chapterIndex: progressInfo.chapterIndex,
            progress: progressInfo.progress,
            absolutePosition,
            chapterCount: chapters.length,
          },
          level: 'info',
        });
      }
    } else {
      // Multi-file book: load N tracks (one per chapter)
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
