import { seekTo, skip } from '@/player/trackPlayer';
import {
  locateInBook,
  type ChapterPosition,
  type LocationChapter,
} from '@/helpers/bookLocation';
import { queueShapeOf } from '@/helpers/queueShape';

/**
 * Landing the Player on a Chapter Position — the decision, and then the
 * transport that carries it out. Split the way `helpers/chapterSkip.ts`
 * splits `resolvePreviousPress` from `skipToPreviousChapter`: the resolver is
 * pure and testable with no Player at all, and the transport DECIDES NOTHING
 * — it is handed the answer as a parameter (ADR 0003 decision 2, the same
 * shape as `helpers/rewindPlayerToBookStart.ts`).
 *
 * ⚠ THE SHAPE SURVIVES HERE BECAUSE IT IS A TRANSPORT QUESTION, not a
 * coordinate one. Stepping to another Queue item and seeking inside the
 * current one are different operations, and no arithmetic dissolves that;
 * ADR 0004's addendum lists this class alongside `PressReading.oneItemQueue`.
 * What HAS dissolved is the conversion the two callers each wrote by hand.
 *
 * Both arms come from ONE `locateInBook` call, and each reads only the
 * coordinate its shape makes exact:
 *
 * - **One item.** The Position IS the Book Position, so the target's Book
 *   Position is the seek target — `startMs` plus the Chapter Position, with
 *   no durations summed, so nothing can void it.
 * - **Multi item.** The Chapter Position IS the Position, so the translator's
 *   validated chapter is the whole answer. ⚠ Its Book Position is summed from
 *   the PRECEDING chapter durations and may be `null`; reading it here would
 *   refuse a jump that a damaged EARLIER chapter has nothing to do with.
 *
 * Because each arm reads a coordinate no duration policy touches, the exact
 * and best-effort variants would answer identically here — `locateInBook` is
 * the right default rather than a load-bearing choice.
 */
export type ChapterJump =
  | {
      kind: 'seek';
      /** Where to seek to, in the Queue coordinates the Player speaks. */
      bookPositionSeconds: number;
    }
  | {
      kind: 'skip';
      /** The Queue item to step to. */
      queueIndex: number;
      /** How far into that item, which is the Chapter Position unchanged. */
      chapterPositionSeconds: number;
    };

/**
 * How to reach `target`, or `null` when it cannot be placed — an index
 * pointing at no row, or no Book. Callers do nothing on `null` rather than
 * landing somewhere else.
 */
export function resolveChapterJump(
  chapters: readonly LocationChapter[] | undefined,
  target: ChapterPosition,
): ChapterJump | null {
  if (!chapters || chapters.length === 0) return null;

  const location = locateInBook(chapters, {
    from: 'chapter',
    chapterIndex: target.index,
    chapterPositionSeconds: target.positionSeconds,
  });
  if (!location) return null;

  if (queueShapeOf(chapters) === 'one-item') {
    const bookPositionSeconds = location.bookPositionSeconds;
    return bookPositionSeconds == null
      ? null
      : { kind: 'seek', bookPositionSeconds };
  }

  const chapter = location.chapter;
  return chapter == null
    ? null
    : {
        kind: 'skip',
        queueIndex: chapter.index,
        chapterPositionSeconds: chapter.positionSeconds,
      };
}

/**
 * Carry out a resolved jump. Decides nothing — both screens call this so the
 * transport cannot drift between them, which it had already started to do
 * while this lived inline at two call sites.
 */
export async function performChapterJump(jump: ChapterJump): Promise<void> {
  if (jump.kind === 'seek') {
    await seekTo(jump.bookPositionSeconds);
    return;
  }
  await skip(jump.queueIndex);
  // A freshly skipped-to Queue item already starts at 0, so only a non-zero
  // Chapter Position needs the second call.
  if (jump.chapterPositionSeconds > 0) {
    await seekTo(jump.chapterPositionSeconds);
  }
}
