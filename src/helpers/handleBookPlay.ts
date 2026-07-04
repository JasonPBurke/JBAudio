import { unknownBookImageUri } from '@/constants/images';
import { getChapterProgressInDB } from '@/db/chapterQueries';
import { Book } from '@/types/Book';
import { getBookById } from '@/db/bookQueries';
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

export enum BookProgressState {
  NotStarted = 0,
  Started = 1,
  Finished = 2,
}

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

  // If the book has not been started, update its progress value in the DB
  if (book.bookProgressValue === BookProgressState.NotStarted) {
    (async () => {
      try {
        const bookModel = await getBookById(book.bookId!);
        if (bookModel) {
          await bookModel.updateBookProgress(BookProgressState.Started);
        }
      } catch (error) {
        console.error('Failed to update book progress:', error);
      }
    })();
  }

  const progressInfo = await getChapterProgressInDB(book.bookId!);

  // Default to chapter 0 if no valid progress info exists (prevents silent failure)
  const storedIndex =
    progressInfo?.chapterIndex !== undefined &&
    progressInfo.chapterIndex >= 0
      ? progressInfo.chapterIndex
      : 0;
  // Clamp to the current chapter list — a rescan can shrink a book's chapter
  // count, leaving a stale DB index that would make skip() throw out-of-range.
  const chapterIndex = Math.min(storedIndex, book.chapters.length - 1);
  const chapterProgress = progressInfo?.progress ?? 0;

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
        artwork: book.artwork ?? unknownBookImageUri,
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
        artwork: book.artwork ?? unknownBookImageUri,
        album: book.bookTitle,
        bookId: book.bookId,
        duration: chapter.chapterDuration,
      }));

      await TrackPlayer.add(tracks);
      await TrackPlayer.skip(chapterIndex);
      await TrackPlayer.seekTo(chapterProgress);
    }

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
