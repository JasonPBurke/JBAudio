import { BookProgressState } from '@/helpers/bookProgressState';

/**
 * How much audio may remain in a book before it counts as Finished.
 *
 * This is a LISTENING JUDGEMENT, not a measurement: most audiobooks close
 * with credits, an ad for the next title and a narrator sign-off, and the
 * listener is done with the book before that material starts. 60 is a first
 * guess — tune it here and nowhere else.
 */
export const FINISH_LEAD_SECONDS = 60;

/**
 * The only fields of a chapter row this module reads. Deliberately narrower
 * than `Chapter` so the tests can build rows without inventing an author and
 * a book title, and so it is obvious that nothing here reads `startMs` or
 * `chapterNumber` — neither of which orders a multi-file book.
 */
export type QueueChapter = {
  chapterDuration?: number;
  url?: string;
};

export type BookEndInput = {
  /** Playback position in seconds, from the progress event payload. */
  position: number | undefined;
  /** Duration in seconds of the playing queue item, from the same payload. */
  duration: number | undefined;
  /**
   * Which runtime shape the QUEUE is in. `'one-item'` means the single queue
   * item spans the whole book, so `duration` is the book's duration.
   *
   * ⚠ Anything that is not exactly `'one-item'` is treated as `'multi-item'`,
   * which then REQUIRES a usable chapter array and index. The caller is
   * untyped `service.js`, so this direction is the one that fails closed: a
   * forgotten field leaves the book never marked, rather than marked at the
   * end of every track.
   */
  queueShape: 'one-item' | 'multi-item';
  /**
   * The book's chapter rows in QUEUE ORDER, one per queue item, as the store
   * holds them. Only read on a multi-item queue.
   */
  queueChapters?: readonly QueueChapter[] | undefined;
  /** Index of the playing queue item — the progress event payload's `track`. */
  currentIndex?: number | undefined;
  /**
   * `url` of the playing queue item, used to check that the store's array and
   * the queue have not diverged. Only read on a multi-item queue; omitting it
   * skips the check rather than failing it.
   */
  currentTrackUrl?: string | undefined;
  /** The book's progress state as the library store currently holds it. */
  progressState: BookProgressState | undefined;
  /** Whether this book has already been marked in this pass of the window. */
  alreadyMarked: boolean | undefined;
  /** Override, used by the tests. Defaults to FINISH_LEAD_SECONDS. */
  leadSeconds?: number;
};

/**
 * 'mark'  — mark the book Finished now (and latch it).
 * 'none'  — change nothing.
 * 'clear' — outside the window; release the latch so a replay can mark again.
 */
export type BookEndDecision = 'mark' | 'none' | 'clear';

/** How much audio a book holds, and how much of it is still to come. */
type QueueMeasurement = {
  /** Seconds of audio in every queue item AFTER the playing one. */
  laterSeconds: number;
  /** Seconds of audio in the whole book. */
  totalSeconds: number;
};

/**
 * Measures a multi-item queue, or returns `null` when it cannot be trusted.
 *
 * ⚠ "After" means LATER IN THE ARRAY and nothing else. `startMs` is 0 on
 * every row of a multi-file book, and `chapterNumber` is the file's track tag
 * which collapses to 1 across an untagged rip — ordering by either produces a
 * wrong sum on exactly the messy books this feature is aimed at, and does it
 * silently. Both queue builders map the array in order and neither filters
 * nor sorts, so array position IS queue position. See CORRECTION 3 in
 * `.scratch/book-end-detection/issues/01-mark-finished-before-the-credits.md`.
 *
 * ⚠ A row with no usable `chapterDuration` voids the whole measurement rather
 * than counting as zero. `scanLibrary`'s `makeErrorChapter` stores `0` for a
 * file whose metadata extraction failed, and the single-chapter path falls
 * back to `0` whenever the duration tag is missing — so on a book with
 * unreadable files near the end, treating those as zero empties the "still to
 * come" sum and marks the book Finished hours early. There is no cheap way
 * back from a wrong mark: nothing moves a book off Finished except a play
 * press, and that RESTARTS it from 0:00 rather than resuming. Failing closed
 * costs such a book only its early mark — the true-end path still marks it.
 */
function measureQueue(
  queueChapters: readonly QueueChapter[] | undefined,
  currentIndex: number | undefined,
  currentTrackUrl: string | undefined,
): QueueMeasurement | null {
  if (!Array.isArray(queueChapters) || queueChapters.length === 0) return null;
  if (
    typeof currentIndex !== 'number' ||
    !Number.isInteger(currentIndex) ||
    currentIndex < 0 ||
    currentIndex >= queueChapters.length
  ) {
    return null;
  }
  if (queueDisagreesWithStore(queueChapters, currentIndex, currentTrackUrl)) {
    return null;
  }

  let laterSeconds = 0;
  let totalSeconds = 0;
  for (let i = 0; i < queueChapters.length; i++) {
    const seconds = queueChapters[i]?.chapterDuration;
    if (
      typeof seconds !== 'number' ||
      !Number.isFinite(seconds) ||
      seconds <= 0
    ) {
      return null;
    }
    totalSeconds += seconds;
    if (i > currentIndex) laterSeconds += seconds;
  }
  return { laterSeconds, totalSeconds };
}

/**
 * Whether the array we are summing demonstrably disagrees with the queue that
 * is actually playing.
 *
 * The tick handler reads the STORE's chapter array but indexes it with the
 * QUEUE's track index, and those come from two independent producers —
 * `convertBookModelToBook` and `getBookWithChaptersForRestoration` — whose
 * queries are both unsorted. They agree in practice; nothing enforces it, and
 * on a multi-file book a disagreement has no other consumer to catch it.
 *
 * Comparing the playing item's url against the row at that index is the
 * cheapest available check, and it is deliberately one-sided:
 *
 * - url sits at the index we used → they agree.
 * - url sits at a DIFFERENT index → they genuinely disagree; refuse to guess.
 * - url is nowhere in the array → INCONCLUSIVE, so proceed. The player may
 *   hand back a url it has normalised, which says nothing about ordering.
 *
 * On a clipped single-file book every item carries the same url, so the first
 * case always holds and this is inert — which is correct, since that shape
 * validates its own ordering through the clip windows it derives.
 */
function queueDisagreesWithStore(
  queueChapters: readonly QueueChapter[],
  currentIndex: number,
  currentTrackUrl: string | undefined,
): boolean {
  if (!currentTrackUrl) return false;
  if (queueChapters[currentIndex]?.url === currentTrackUrl) return false;
  return queueChapters.some((ch) => ch?.url === currentTrackUrl);
}

/**
 * Decides, from numbers the 1 Hz progress tick already holds, whether a book
 * has reached its end for the purposes of the ✓.
 *
 * This function decides ONLY about the flag. It says nothing about stopping,
 * pausing or seeking, and its return type cannot express those: the point of
 * the lead time is that playback runs on through the credits untouched.
 */
export function evaluateBookEnd({
  position,
  duration,
  queueShape,
  queueChapters,
  currentIndex,
  currentTrackUrl,
  progressState,
  alreadyMarked,
  leadSeconds = FINISH_LEAD_SECONDS,
}: BookEndInput): BookEndDecision {
  // Undecidable ticks return 'none', never 'clear': releasing the latch on a
  // tick we could not measure would let the next measurable one mark the book
  // a second time, and every mark rewrites `finished_at`. 'clear' means "this
  // is outside the window", never "I could not tell".
  if (!Number.isFinite(position) || !(duration! > 0)) return 'none';

  // On a one-item queue `duration` already spans the whole book, so nothing
  // follows the playing item and the sum is empty by definition.
  //
  // ⚠ That claim is checked, not taken: a one-item queue can only ever tick
  // at index 0. The caller re-derives the shape from the store's CURRENT
  // chapter rows while the queue was built from an earlier snapshot, and the
  // clipped-chapters gate can answer differently between the two — believing
  // a contradicted claim would read a chapter-relative `duration` as the
  // whole book's and mark at the end of whichever chapter is playing.
  const measurement =
    queueShape === 'one-item'
      ? currentIndex !== undefined && currentIndex !== 0
        ? null
        : { laterSeconds: 0, totalSeconds: duration! }
      : measureQueue(queueChapters, currentIndex, currentTrackUrl);
  if (measurement === null) return 'none';

  // A book with less audio in it than the lead time would be Finished from
  // its first tick, and could never be seen as Started: a play press demotes
  // it and the next tick promotes it straight back. This rule is about the
  // credits at the end of a real book — a book shorter than the credits is
  // left to the true-end path, exactly as it was before this rule existed.
  if (measurement.totalSeconds <= leadSeconds) return 'none';

  const remaining = duration! - position! + measurement.laterSeconds;

  if (remaining > leadSeconds) return 'clear';

  if (alreadyMarked || progressState === BookProgressState.Finished) {
    return 'none';
  }
  return 'mark';
}
