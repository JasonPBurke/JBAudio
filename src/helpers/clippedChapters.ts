import type { Track } from 'react-native-track-player';
import type { Book, Chapter } from '@/types/Book';
import { unknownBookImageUri } from '@/constants/images';
import { CLIPPED_CHAPTERS_SPIKE } from '@/constants/featureFlags';
import {
  isSingleFileBook,
  hasValidChapterData,
} from '@/helpers/singleFileBook';

/**
 * True when a book should be loaded as clipped per-chapter queue items:
 * spike flag on, single file, and real chapter start offsets present.
 * Accepts any chapter-shaped rows that carry `url` + `startMs`.
 */
export function shouldUseClippedChapters(
  chapters: readonly Pick<Chapter, 'url' | 'startMs'>[] | undefined,
): boolean {
  return (
    CLIPPED_CHAPTERS_SPIKE &&
    isSingleFileBook(chapters) &&
    hasValidChapterData(chapters)
  );
}

/**
 * Builds one Track per chapter, all pointing at the same file, each playing
 * only its chapter's time window. `clipStartMs`/`clipEndMs` are consumed by
 * the patched native Track → MediaItem.ClippingConfiguration. The last
 * chapter leaves clipEndMs undefined (plays to end of source). Positions and
 * durations inside each queue item are chapter-relative, matching how
 * multi-file books already behave — and matching the chapter-relative
 * progress the DB already stores for single-file books.
 */
export function buildClippedChapterTracks(book: Book): Track[] {
  const chapters = book.chapters ?? [];
  return chapters.map((ch, i) => ({
    url: chapters[0].url,
    title: ch.chapterTitle,
    artist: book.author,
    artwork: book.artwork ?? unknownBookImageUri,
    album: book.bookTitle,
    bookId: book.bookId,
    duration: ch.chapterDuration,
    mediaId: `${book.bookId}_ch${i}`,
    clipStartMs: ch.startMs ?? 0,
    clipEndMs: chapters[i + 1]?.startMs,
  }));
}
