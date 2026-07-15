import type { Track } from 'react-native-track-player';
import type { Book, Chapter } from '@/types/Book';
import { unknownBookImageUri } from '@/constants/images';
import { CLIPPED_CHAPTERS_SPIKE } from '@/constants/featureFlags';
import { getHeapLimitBytes } from '@/helpers/deviceHeap';
import {
  isSingleFileBook,
  hasValidChapterData,
} from '@/helpers/singleFileBook';

type GateChapter = Pick<Chapter, 'url' | 'startMs' | 'chapterDuration'>;

/**
 * Estimated Java-heap bytes ExoPlayer needs at a clipped-chapter transition.
 *
 * Each clipped queue item is its own ProgressiveMediaSource, and Mp4Extractor
 * materializes the file's FULL sample table per prepared period: ~24 B per
 * AAC frame (long[] offsets + int[] sizes + long[] timestamps + int[] flags),
 * at 44100/1024 ≈ 43.07 frames per second. Two periods coexist while the
 * next chapter is prepared, hence the ×2. Device-verified: a 28.7 h book
 * measured ~107 MB per period and OOM'd at every boundary on a 256 MiB heap.
 *
 * The sample rate is assumed to be 44.1 kHz (the worst common case) because
 * the real rate isn't available from chapter rows and this function must be
 * a pure function of `chapters` — every call site (queue builders AND the
 * helpers that interpret queue shape) has to reach the same verdict. The
 * assumption overestimates 2× for 22.05 kHz books, which only errs toward
 * the safe legacy path.
 */
const SAMPLE_TABLE_BYTES_PER_SECOND = 24 * (44100 / 1024) * 2;

export function estimateClippedTransitionPeakBytes(
  chapters: readonly GateChapter[],
): number {
  const totalDurationSec = chapters.reduce(
    (sum, ch) => sum + (ch.chapterDuration || 0),
    0,
  );
  return totalDurationSec * SAMPLE_TABLE_BYTES_PER_SECOND;
}

// Fraction of the heap the transition peak may claim; the rest is app
// baseline (RN runtime, images, JS heap) plus safety margin.
const CLIPPED_HEAP_BUDGET_FRACTION = 0.5;

/**
 * True when a book should be loaded as clipped per-chapter queue items:
 * spike flag on, single file, real chapter start offsets present, and the
 * book's sample table small enough to survive chapter transitions (oversized
 * books fall back to the legacy single-track path — see the estimator above).
 * Accepts any chapter-shaped rows that carry `url` + `startMs` +
 * `chapterDuration`. Rows missing `chapterDuration` weaken the memory gate,
 * so projections must include it.
 */
export function shouldUseClippedChapters(
  chapters: readonly GateChapter[] | undefined,
): boolean {
  if (
    !CLIPPED_CHAPTERS_SPIKE ||
    !isSingleFileBook(chapters) ||
    !hasValidChapterData(chapters)
  ) {
    return false;
  }
  return (
    estimateClippedTransitionPeakBytes(chapters!) <=
    getHeapLimitBytes() * CLIPPED_HEAP_BUDGET_FRACTION
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
