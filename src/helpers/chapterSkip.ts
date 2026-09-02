import {
  getActiveBookId,
  getActiveTrackIndex,
  getProgress,
  seekTo,
  skipToPrevious,
} from '@/player/trackPlayer';
import { useLibraryStore } from '@/store/library';
import { queueShapeOf } from '@/helpers/queueShape';
import {
  chapterStartInQueueSeconds,
  locateInBook,
} from '@/helpers/bookLocation';
import { Chapter } from '@/types/Book';

/**
 * The two transport press decisions — skip-to-previous below,
 * skip-to-next (`resolveNextPress`) at the bottom of the file. They share one
 * home because they are the same question at opposite ends of the Queue:
 * *where in the Queue is this press happening?* Neither native skip reports
 * that it moved nothing, so both ends have to ASK before they act.
 *
 * ── Skip-to-previous with a restart-current-chapter threshold ──
 *
 * More than RESTART_CHAPTER_THRESHOLD_SECONDS into a chapter, the press
 * restarts that chapter; at or under the threshold it goes to the previous
 * chapter. Shared by the RemotePrevious handler in setup/service.ts
 * (notification / Android Auto) and the in-app SkipToPreviousButton so
 * both press-sites behave identically — same pattern as relativeSeek.ts.
 *
 * The threshold compares playback position, so at 2× speed the window
 * passes in half the wall-clock time.
 *
 * At the START of a book — the first chapter on a one-item Queue, the first
 * QUEUE ITEM on a multi-item one — a within-threshold press restarts the book
 * rather than doing nothing, and reports 'restart' so the footprint names
 * what actually happened.
 *
 * `onBeforeSkip` receives the resolved kind ('restart' | 'previous') and is
 * awaited BEFORE the seek/skip — footprint recording needs the pre-press
 * position, but only this helper knows which action the press resolves to.
 * A callback failure never blocks the playback action.
 *
 * ── Both decisions are pure; only the wiring touches the Player ──
 *
 * `resolvePreviousPress` and `resolveNextPress` take a `PressReading` and
 * return an action. Neither reads the Player, and neither works out where the
 * playhead is: `locateInBook` has already answered that in both coordinates,
 * which is what removed the Queue-shape branch from the middle of each. What
 * survives of the shape is `oneItemQueue`, used only to choose between a seek
 * and a step to another Queue item — see `PressReading` for why that one
 * cannot be dissolved.
 */
const RESTART_CHAPTER_THRESHOLD_SECONDS = 15;

/**
 * Everything a transport press needs to decide, read from the Player ONCE.
 *
 * ⚠ THE PRESS DECISIONS BELOW DO NO IO AND ASK NO "WHERE AM I?" QUESTION OF
 * THEIR OWN. Both used to fetch their own numbers halfway through — the
 * previous press reached for `getActiveTrackIndex()` inside one arm of one
 * branch, the next press for `getProgress()` inside another — so what a press
 * saw depended on which arm it took, and neither could be exercised without a
 * player. The composition root reads once and hands the numbers down.
 *
 * ⚠ THE NUMBERS ONLY — no pre-computed location. Each decision calls
 * `locateInBook` on this reading itself, which is free of IO and so no
 * exception to the rule above. Handing one in would let a caller pass a
 * location computed from a DIFFERENT position or index than the ones beside
 * it — an invalid state the type would happily describe. `locateInBook`
 * returns Book Position and Chapter Position together, so neither decision
 * converts between them and neither asks which Queue shape it is looking at.
 * See `docs/adr/0004-queue-shape-answers-in-coordinates-not-a-verdict.md`.
 */
export type PressReading = {
  /** The Book's chapter rows, as the library store holds them. */
  chapters: readonly Chapter[] | undefined;
  /** Position: seconds into the playing QUEUE ITEM, straight from the Player. */
  positionSeconds: number;
  /** Index of the playing Queue item; `undefined` when it could not be read. */
  queueIndex: number | undefined;
  /**
   * Whether the Book loads as ONE Queue item.
   *
   * ⚠ TRANSPORT ONLY, AND PASSED IN RATHER THAN DERIVED. Nothing below asks
   * it to work out where the playhead is — that is the translator's job.
   * It survives because the two shapes genuinely MOVE differently: a one-item
   * Queue reaches another Chapter by seeking inside its single track, a
   * multi-item Queue by stepping to another track. No arithmetic can dissolve
   * that, so it stays a parameter — the arrangement `resolveNextPress` has
   * carried since the skip-next parity work, now shared by both ends.
   *
   * ⚠ NAMED FOR THE QUEUE, NOT FOR THE BOOK ON DISK. It once carried the name
   * of a since-deleted "treat as single file" predicate — wording CONTEXT.md's
   * **Queue shape** entry lists under _Avoid_ for exactly the confusion it
   * caused here: a Book stored as one file that clears the clipped-chapters
   * memory gate is single-file in the DB and a MULTI-ITEM Queue at runtime.
   */
  oneItemQueue: boolean;
};

/** How a resolved press actually moves the playhead. */
export type PressMove =
  /** Seek to this many seconds inside the playing Queue item. */
  | { to: 'seek'; seekSeconds: number }
  /** Step to the previous Queue item — `skipToPrevious()`. */
  | { to: 'previous-item' };

export type PreviousPressKind = 'restart' | 'previous';

/**
 * What a skip-to-PREVIOUS press resolves to.
 *
 * `kind` is what HAPPENED and drives the footprint label ('Chapter restart'
 * vs 'Chapter changed'); `move` is how to make it happen. They are separate
 * because only the second one still knows about Queue shape.
 */
export type PreviousPressAction = {
  kind: PreviousPressKind;
  move: PressMove;
};

/**
 * More than `thresholdSeconds` into a Chapter, the press restarts that
 * Chapter; at or under the threshold it goes to the previous Chapter. At the
 * START of the Book — the first Chapter, whichever shape the Queue is — a
 * within-threshold press restarts the Book rather than doing nothing, and
 * reports 'restart' so the footprint names what actually happened.
 *
 * The threshold compares playback position, so at 2× speed the window passes
 * in half the wall-clock time.
 *
 * ⚠ HOW THE SHAPE BRANCH DISSOLVED, since it looks like sleight of hand: a
 * Chapter's start expressed in QUEUE coordinates is
 * `positionSeconds - chapter.positionSeconds`. On a one-item Queue the
 * Position IS the Book Position, so that difference is the Chapter's absolute
 * `startMs`; on a multi-item Queue the Position ALREADY IS the Chapter
 * Position, so the difference is 0 — which is where a "restart this chapter"
 * seek has always had to land. One expression, both shapes, no verdict.
 */
export function resolvePreviousPress(
  { chapters, positionSeconds, queueIndex, oneItemQueue }: PressReading,
  thresholdSeconds: number,
): PreviousPressAction {
  const restartHere: PreviousPressAction = {
    kind: 'restart',
    move: { to: 'seek', seekSeconds: 0 },
  };

  const chapter = locateInBook(chapters, {
    from: 'queue',
    queueIndex,
    positionSeconds,
  })?.chapter;

  if (chapter) {
    if (chapter.positionSeconds > thresholdSeconds) {
      return {
        kind: 'restart',
        move: {
          to: 'seek',
          seekSeconds: chapterStartInQueueSeconds(positionSeconds, chapter),
        },
      };
    }

    if (chapter.index === 0) return restartHere;

    if (!oneItemQueue) return { kind: 'previous', move: { to: 'previous-item' } };

    /*
     * ⚠ THE PREVIOUS CHAPTER'S START IS A CONVERSION, and it goes through the
     * translator like every other one. A chapter index in, a Book Position
     * out — which on a one-item Queue is what `seekTo` wants. This was a hand
     * -rolled `startMs / 1000` until ticket `11`'s spec review caught that
     * "both sides are the same coordinate" was wrong: the INPUT is a Chapter
     * and only the OUTPUT is a Position, which is exactly the conversion the
     * deleted `calculateAbsolutePosition(chapters, i, 0)` performed.
     *
     * `null` is unreachable from here — the index is one below a chapter the
     * translator itself just resolved, so it is in range — but a restart is
     * the honest collapse if it ever happens, and it is the collapse this
     * function already uses for "I cannot place you".
     */
    const previousChapterStart = locateInBook(chapters, {
      from: 'chapter',
      chapterIndex: chapter.index - 1,
      chapterPositionSeconds: 0,
    })?.bookPositionSeconds;

    if (previousChapterStart == null) return restartHere;

    return {
      kind: 'previous',
      move: { to: 'seek', seekSeconds: previousChapterStart },
    };
  }

  // ── The Chapter could not be told ──────────────────────────────────────
  //
  // No chapter rows at all, or rows with no usable boundaries. `null` is "I
  // could not tell", never "chapter 0", so nothing below reads an index off
  // the location — the raw Position and the Queue index are all there is.

  // One Queue item with nothing to navigate WITHIN: the only move that means
  // anything is back to the start, and that is a restart.
  if (oneItemQueue) return restartHere;

  if (positionSeconds > thresholdSeconds) return restartHere;

  // At the first Queue item there is no previous Chapter, so the press
  // restarts the Book.
  //
  // This has to be ASKED, not discovered from a failure: `skipToPrevious()`
  // at index 0 RESOLVES having moved nothing. Native `previous()` is
  // `exoPlayer.seekToPreviousMediaItem()`, documented as "does nothing if
  // there is no previous item", and `MusicModule` resolves the promise
  // unconditionally — there is no rejection to catch.
  //
  // `undefined` means the index could not be READ, NOT index 0: treating it
  // as 0 would turn a transient read failure into a spurious restart, so an
  // unknown index takes the ordinary previous-chapter path. That path is
  // deliberately unguarded — it always acts, so a "did anything move?" check
  // would be dead code — which leaves one accepted residual: an unreadable
  // index that was really 0 still records a `chapter_change` for a press that
  // went nowhere.
  if (queueIndex === 0) return restartHere;

  return { kind: 'previous', move: { to: 'previous-item' } };
}

export async function skipToPreviousChapter(
  onBeforeSkip?: (kind: PreviousPressKind) => void | Promise<void>,
): Promise<void> {
  // ONE read, three numbers, and the shape comes from the BOOK rather than
  // from `queue.length`. A Queue read answers about whichever Book happens to
  // be loaded — which disagrees with the Book this press is about for the
  // length of every Book switch — and it marshals the whole track list across
  // the bridge to learn one boolean.
  const [activeBookId, { position }, queueIndex] = await Promise.all([
    getActiveBookId(),
    getProgress(),
    getActiveTrackIndex(),
  ]);
  const chapters = activeBookId
    ? useLibraryStore.getState().books[activeBookId]?.chapters
    : undefined;

  const action = resolvePreviousPress(
    {
      chapters,
      positionSeconds: position,
      queueIndex,
      oneItemQueue: queueShapeOf(chapters) === 'one-item',
    },
    RESTART_CHAPTER_THRESHOLD_SECONDS,
  );

  // Awaited BEFORE the seek/skip — footprint recording needs the pre-press
  // position, but only the decision above knows which action the press
  // resolved to. A callback failure never blocks the playback action.
  if (onBeforeSkip) {
    try {
      await onBeforeSkip(action.kind);
    } catch {
      // Footprint/bookkeeping failures must not block the seek.
    }
  }

  if (action.move.to === 'seek') {
    await seekTo(action.move.seekSeconds);
    return;
  }
  await skipToPrevious();
}

/**
 * What a skip-to-NEXT press resolves to, before anything acts on it.
 *
 * Deciding this up front is the whole point: at the LAST item of a multi-item
 * Queue `skipToNext()` RESOLVES having moved nothing (native
 * `seekToNextMediaItem()` is documented as "does nothing if there is no next
 * item" and `MusicModule` resolves the promise unconditionally), so a caller
 * that acts first and records afterwards cannot tell a real chapter change
 * from a press that went nowhere. That is how `Event.RemoteNext` came to write
 * a `chapter_change` footprint for a no-op press. A footprint is a breadcrumb
 * back to a spot the user left; if the press does not leave, there is no
 * breadcrumb — so the caller needs the verdict BEFORE it records.
 *
 * The mirror of `skipToPreviousChapter`'s index check at the other end of the
 * Queue, and it reads the same way: `undefined` from `getActiveTrackIndex()`
 * means the index could not be READ, not that it is the last item, so an
 * unreadable index takes the ordinary acting path rather than silently
 * swallowing a press.
 *
 * `'finish'` is the last chapter on a ONE-ITEM Queue: a deliberate press
 * asking to leave a chapter there has nowhere left to play, so the caller
 * marks the Book finished instead of seeking. It is NOT a chapter change, and
 * its footprint is labeled accordingly by the caller.
 */
export type NextPressAction =
  /** One-item Queue: seek to the next chapter's absolute start. */
  | { kind: 'chapter'; seekSeconds: number }
  /** Chapter queue: `skipToNext()` will move to the next queue item. */
  | { kind: 'skip' }
  /** Last chapter on a one-item Queue: end of the Book. */
  | { kind: 'finish' }
  /** Last queue item: the press moves nothing, so nothing should be recorded. */
  | { kind: 'none' };

/** A `PressReading` plus the one number only the forward end needs. */
export type NextPressReading = PressReading & {
  /** How many items the Queue holds; `0` when the read failed. */
  queueLength: number;
};

/**
 * Pure and synchronous, like its mirror above. It used to fetch its own
 * progress inside the one-item arm and its own index and queue inside the
 * other, which meant the two arms of one decision saw the Player at two
 * different moments; the composition root in `nextPress.ts` now reads once
 * and hands the numbers down.
 *
 * ⚠ THE NEXT BOUNDARY IS FOUND FROM BOOK POSITION, NOT FROM A CHAPTER INDEX.
 * The deleted `getNextChapterStartSeconds` re-derived the current chapter and
 * took the row after it, which answered row 0 when the playhead preceded
 * every boundary — so a press inside a Book's preamble skipped PAST the first
 * chapter to the second. Scanning for the first boundary after the exact Book
 * Position is the same answer everywhere else and the right one there.
 */
export function resolveNextPress({
  chapters,
  positionSeconds,
  queueIndex,
  queueLength,
  oneItemQueue,
}: NextPressReading): NextPressAction {
  if (oneItemQueue && chapters && chapters.length > 1) {
    const bookPositionSeconds = locateInBook(chapters, {
      from: 'queue',
      queueIndex,
      positionSeconds,
    })?.bookPositionSeconds;

    // ⚠ NOTHING, rather than the acting path the other arm takes for an
    // unreadable index. Acting here means deciding between a seek we cannot
    // compute and FINISHING THE BOOK, and marking a Book finished by accident
    // costs the user their position — nothing moves a Book off Finished
    // except a play press, which restarts it from 0:00. The asymmetry is
    // deliberate: the destructive direction never gets the benefit of the
    // doubt.
    if (bookPositionSeconds == null) return { kind: 'none' };

    const nextStart = nextBoundaryAfter(chapters, bookPositionSeconds);
    return nextStart !== null
      ? { kind: 'chapter', seekSeconds: nextStart }
      : { kind: 'finish' };
  }

  // An unreadable index or an empty queue read is not evidence that the press
  // is a no-op — act, exactly as the previous side does.
  if (
    queueIndex !== undefined &&
    queueLength > 0 &&
    queueIndex >= queueLength - 1
  ) {
    return { kind: 'none' };
  }

  return { kind: 'skip' };
}

/**
 * The start of the first Chapter that begins strictly after `seconds`, in
 * seconds, or `null` when the playhead is already past the last boundary.
 */
function nextBoundaryAfter(
  chapters: readonly Chapter[],
  seconds: number,
): number | null {
  for (const chapter of chapters) {
    const startSeconds = (chapter.startMs || 0) / 1000;
    if (startSeconds > seconds) return startSeconds;
  }
  return null;
}
