import { queueShapeOf, type ShapeChapter } from '@/helpers/queueShape';

/**
 * Where playback has reached, in BOOK terms — both coordinates at once.
 *
 * This is the module the queue-shape work exists for. `queueShapeOf` gives
 * every site the same verdict but leaves each one branching on it; this
 * removes the branch, because the shape question is nothing but THE
 * CONVERSION BETWEEN THE TWO COORDINATES. Once the conversion happens in one
 * place, the question stops being asked. See
 * `docs/adr/0004-queue-shape-answers-in-coordinates-not-a-verdict.md`,
 * ruling 1.
 *
 * It replaced an unguarded inverse pair in `helpers/singleFileBook.ts`
 * (`calculateAbsolutePosition` / `calculateProgressWithinChapter`) which
 * hardcoded the one-item mapping and was correct only because every caller
 * branched on shape first. That is the mechanism that produced nine competing
 * shape mechanisms: a conversion that silently assumes a shape pushes the
 * decision out to every call site, where it multiplies. Both are now deleted,
 * along with the module named after one of the two shapes they translated
 * between; `helpers/chapterMetadata.ts` is the predicate that survived it.
 *
 * ─── Pure, synchronous, and no Player read ──────────────────────────────
 *
 * Nothing here imports `@/player/*` or does IO — ADR 0003's decision 2
 * applied one layer up, and the reason the PERSISTED consumers (library rows,
 * chapter list, footprint list) can use the same function as the live ones.
 * `BookDurationRow` renders once per visible library row and is deliberately
 * unmemoized; a signature that forced a Player read would pull an async
 * bridge call into a FlashList row. ⚠ Do not grow the signature to fetch the
 * Player index "for convenience" — pass it in.
 *
 * ─── Exact-or-null ──────────────────────────────────────────────────────
 *
 * ⚠ `null` means "I could not tell", NEVER "the answer is zero". The house
 * rule is stated four times elsewhere already — `remainingChapterCount`
 * returns `null` for not-known, `evaluateBookEnd` returns `'none'` and never
 * `'clear'` for an undecidable tick, `resolveNextPress` treats an unreadable
 * index as "act" rather than index 0, and `service.ts` documents that
 * fabricating `0` for an unreadable index "would corrupt chapter index".
 *
 * The two coordinates are INDEPENDENTLY nullable because their reliability is
 * opposite and it flips with the shape:
 *
 * |                  | multi-item                        | one-item          |
 * | ---------------- | --------------------------------- | ----------------- |
 * | Chapter Position | exact — the Queue index IS it     | scanned from startMs |
 * | Book Position    | summed from chapterDuration — corruptible | exact — the raw Position |
 *
 * So on the common shape, the coordinate this module must MANUFACTURE is the
 * corruptible one. The corruption is not hypothetical: `scanLibrary`'s
 * `makeErrorChapter` stores `duration: 0` for a file whose metadata
 * extraction failed. See `approximateLocationInBook` for who may have the
 * approximation, and why it has to ask by name.
 *
 * A null RESULT and a result of nulls mean different things: null is "there
 * is no Book here", a record of nulls is "a Book I could not measure".
 */

/**
 * The chapter fields this module reads — the shape verdict's projection
 * verbatim, plus nothing. `queueShapeOf` is asked about every input, so a
 * narrower type here would let a Book be located under a shape its own
 * chapters would not produce.
 */
export type LocationChapter = ShapeChapter;

/** Which Chapter is being heard, and how far into that Chapter. */
export type ChapterPosition = {
  index: number;
  positionSeconds: number;
};

/** Where playback has reached, in both coordinates. */
export type BookLocation = {
  /** How far into the whole Book, or `null` if it could not be told. */
  bookPositionSeconds: number | null;
  /** Which Chapter and how far in, or `null` if it could not be told. */
  chapter: ChapterPosition | null;
};

/**
 * The number a caller already holds, tagged with which coordinate it is.
 *
 * There are two tags because the app genuinely holds both: the Player reports
 * a **Position** (seconds into the playing QUEUE ITEM), while the DB stores a
 * **Chapter Position** (`current_chapter_progress`, seconds into the
 * CHAPTER). On a multi-item Queue those are the same number and the two tags
 * agree; on a one-item Queue they differ by the chapter's `startMs`, and
 * mixing them up is precisely the bug the deleted conversion pair invited.
 *
 * Tag what you have. Never convert before calling — that is this module's job.
 */
export type PositionReading =
  | {
      from: 'queue';
      /** Index of the playing Queue item; `null` when the Player could not say. */
      queueIndex: number | null | undefined;
      /** Position: seconds into the playing Queue item. */
      positionSeconds: number | null | undefined;
    }
  | {
      from: 'chapter';
      /** Which Chapter the stored progress belongs to. */
      chapterIndex: number | null | undefined;
      /** Seconds into that Chapter. */
      chapterPositionSeconds: number | null | undefined;
    };

/**
 * "A Book I could not measure" — distinct from a `null` RESULT, which means
 * there is no Book at all.
 *
 * A fresh object every time, deliberately. A shared constant returned by
 * identity would let one caller's mutation poison every future null answer,
 * and the null path is not hot enough for the allocation to matter.
 */
const unmeasurable = (): BookLocation => ({
  bookPositionSeconds: null,
  chapter: null,
});

/**
 * A count of seconds that arithmetic may trust.
 *
 * ⚠ `>= 0`, where `usableDuration` below demands `> 0`. The one-character
 * difference is the whole point of each: a POSITION of zero is the start of
 * the Book and perfectly ordinary, while a DURATION of zero is
 * `scanLibrary`'s `makeErrorChapter` reporting that it could not read the
 * file.
 */
function usableSeconds(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * A chapter duration that may be summed. Matches the standard
 * `bookEndDetection`'s `measureQueue` holds its rows to — the two are kept in
 * step by this comment rather than by shared code, because the modules void
 * on different ranges (see `secondsBefore`).
 */
function usableDuration(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** Where a chapter begins, in the seconds the rest of this module speaks. */
function chapterStartSeconds(
  chapters: readonly LocationChapter[],
  index: number,
): number {
  return (chapters[index]?.startMs || 0) / 1000;
}

/**
 * Which chapter contains `seconds`, or `null` when the rows cannot say.
 *
 * The backwards walk used to be an exported helper of its own
 * (`findChapterIndexByPosition`), which is how it came to be called from
 * places that had no guard for either refusal below. It is an internal step of
 * the translator now: the scan and the two questions it cannot answer are one
 * function, and the only way to reach it is to ask where a Book is.
 *
 * ⚠ The walk answers `0` when it finds no row, so on its own it manufactures a
 * chapter index in exactly the two situations this module must refuse:
 *
 * - the position precedes every boundary (a Book whose first chapter starts
 *   after a preamble) — row 0 is a guess, not a reading;
 * - every row sits at `startMs: 0`, so there are no boundaries at all and the
 *   backwards walk confidently returns the LAST row for every position. The
 *   test fixtures' header documents this trap; production had no guard for it
 *   until now.
 *
 * Book Position is unaffected either way — on this shape it is the raw
 * Position, and it stays exact.
 */
function chapterIndexAtPosition(
  chapters: readonly LocationChapter[],
  seconds: number,
): number | null {
  if (seconds < chapterStartSeconds(chapters, 0)) return null;
  if (
    chapters.length > 1 &&
    chapters.every((c) => !((c?.startMs || 0) > 0))
  ) {
    return null;
  }

  // The last row starting at or before the position.
  for (let i = chapters.length - 1; i >= 0; i--) {
    if (chapterStartSeconds(chapters, i) <= seconds) return i;
  }
  return null;
}

/** An index that genuinely points at a row, rather than defaulting to one. */
function usableIndex(
  value: number | null | undefined,
  length: number,
): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value < length
  );
}

/**
 * Seconds of audio in the chapters BEFORE `index`, or `null` if any of them
 * cannot be trusted.
 *
 * ⚠ Only the chapters before the playing one are read, so an unusable
 * duration LATER in the Book leaves this answer exact. That is narrower than
 * `bookEndDetection`'s `measureQueue`, which voids on any row — correctly,
 * because it sums what is still to come and this sums what is already past.
 */
function secondsBefore(
  chapters: readonly LocationChapter[],
  index: number,
  policy: DurationPolicy,
): number | null {
  let total = 0;
  for (let i = 0; i < index; i++) {
    const seconds = chapters[i]?.chapterDuration;
    if (usableDuration(seconds)) {
      total += seconds;
    } else if (policy === 'exact') {
      return null;
    }
  }
  return total;
}

/**
 * What to do with a chapter whose duration cannot be trusted. Named rather
 * than a boolean so the private half agrees with the public argument in
 * `approximateLocationInBook`'s header: a policy this consequential should
 * never be a bare `true` at a call site.
 */
type DurationPolicy = 'exact' | 'count-unusable-as-zero';

function locate(
  chapters: readonly LocationChapter[] | undefined,
  reading: PositionReading,
  policy: DurationPolicy,
): BookLocation | null {
  if (!chapters || chapters.length === 0) return null;

  const oneItem = queueShapeOf(chapters) === 'one-item';

  // One item spanning the whole Book, holding a Position: the Position IS
  // Book Position, and the Chapter is found by scanning `startMs`. The Queue
  // index is not read at all — it can only ever be 0 here, which is why a
  // one-item Book must not be refused for an unreadable one.
  if (oneItem && reading.from === 'queue') {
    if (!usableSeconds(reading.positionSeconds)) return unmeasurable();
    const bookPositionSeconds = reading.positionSeconds;
    const index = chapterIndexAtPosition(chapters, bookPositionSeconds);
    if (index === null) return { bookPositionSeconds, chapter: null };
    const startSeconds = chapterStartSeconds(chapters, index);
    return {
      bookPositionSeconds,
      chapter: {
        index,
        positionSeconds: Math.max(0, bookPositionSeconds - startSeconds),
      },
    };
  }

  // Every other case is indexed: the caller names a row, and both coordinates
  // depend on it. An unreadable index yields nulls rather than row 0 — the
  // under-strict direction is the destructive one (a footprint silently
  // recorded at chapter 0 loses the spot the user meant to keep).
  const index =
    reading.from === 'queue' ? reading.queueIndex : reading.chapterIndex;
  const positionSeconds =
    reading.from === 'queue'
      ? reading.positionSeconds
      : reading.chapterPositionSeconds;

  if (!usableIndex(index, chapters.length)) return unmeasurable();
  if (!usableSeconds(positionSeconds)) return unmeasurable();

  const chapter: ChapterPosition = { index, positionSeconds };

  // One item, holding a Chapter Position: the chapter's own start is the
  // whole conversion, and it is exact — no durations are summed.
  if (oneItem) {
    const startSeconds = chapterStartSeconds(chapters, index);
    return { bookPositionSeconds: startSeconds + positionSeconds, chapter };
  }

  // One item per Chapter: the index is the Chapter, and Book Position has to
  // be manufactured by summing what came before.
  const earlier = secondsBefore(chapters, index, policy);
  return {
    bookPositionSeconds: earlier === null ? null : earlier + positionSeconds,
    chapter,
  };
}

/**
 * Where a Chapter starts, expressed in the coordinates the PLAYER reports —
 * what has to come off a raw Position to leave a Chapter Position.
 *
 * ⚠ QUEUE COORDINATES, NOT BOOK ONES. On a one-item Queue the Position is the
 * Book Position, so this is the Chapter's absolute `startMs`; on a multi-item
 * Queue the Position ALREADY IS the Chapter Position, so this is `0`. One
 * expression, both shapes, no verdict — which is why three live surfaces
 * (the progress bar's per-frame worklet, the chapter hook, and the
 * restart-this-chapter seek) can share it instead of each keeping a branch.
 *
 * It lives here rather than at those three call sites because they had each
 * written it out by hand and had already drifted on whether to clamp.
 */
export function chapterStartInQueueSeconds(
  positionSeconds: number,
  chapter: ChapterPosition,
): number {
  return Math.max(0, positionSeconds - chapter.positionSeconds);
}

/**
 * Where playback has reached, in both coordinates — exact, or `null` where it
 * cannot be told. `null` for the whole result means there is no Book.
 *
 * This is the default and should stay it. Reach for
 * `approximateLocationInBook` only where an undercounted Book Position is
 * cosmetic, and say so at the call site.
 */
export function locateInBook(
  chapters: readonly LocationChapter[] | undefined,
  reading: PositionReading,
): BookLocation | null {
  return locate(chapters, reading, 'exact');
}

/**
 * The same location, but counting an unusable `chapterDuration` as ZERO so
 * that Book Position always has a value — an APPROXIMATION, and named to
 * admit it.
 *
 * ⚠ This is the arithmetic that shipped a bug: a chapter storing
 * `duration: 0` emptied a remaining-time sum and marked a TWENTY-FILE BOOK
 * FINISHED AT CHAPTER FIVE. Recovery cost the user their position — nothing
 * moves a Book off Finished except a play press, and that restarts it from
 * 0:00.
 *
 * It is a separate function rather than a `?? 0` default because THE SAME
 * ARITHMETIC ERROR HAS DIFFERENT SEVERITY PER CONSUMER, and severity is a
 * property of what the caller does with the number — which this module cannot
 * see. In a library row an undercount reads the progress capsule a little
 * low: cosmetic. In book-end detection the identical undercount is
 * destructive. A flag would let the destructive caller inherit the cosmetic
 * policy by omission; a name cannot be passed by accident.
 *
 * ⚠ It approximates DURATIONS ONLY. An unreadable index still yields nulls
 * here — there is no honest approximation of "which Chapter".
 */
export function approximateLocationInBook(
  chapters: readonly LocationChapter[] | undefined,
  reading: PositionReading,
): BookLocation | null {
  return locate(chapters, reading, 'count-unusable-as-zero');
}
