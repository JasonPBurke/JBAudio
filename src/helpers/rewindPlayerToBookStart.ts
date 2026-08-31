import { seekTo, skip } from '@/player/trackPlayer';
import type { QueueShape } from '@/helpers/queueShape';

/**
 * Returns the Player to the start of the Book, in whichever way the Queue's
 * shape makes honest.
 *
 * The transport half of finishing a Book. `resetBookToStart` is the state
 * half — store, DB and the chapter-change tracker — and the two are kept
 * apart because only one of them is shape-dependent: the rewind of a Book's
 * bookkeeping is the same four writes whatever the Queue looks like, while
 * the rewind of the PLAYER is a different call per shape.
 *
 *  - **One item.** The Book is one track, so the start of the Book is
 *    position 0 inside it. There is no earlier item to skip to, and
 *    `skip(0)` would be asking to move to the item already active.
 *  - **Multi item.** The start of the Book is the FIRST item, so the queue
 *    position has to move; a seek would only restart the last chapter and
 *    leave the Book sitting at its end.
 *
 * ⚠ The two arms land in the same place on a one-item Queue, which is what
 * made this branch easy to get wrong for years: a Book claimed as multi-item
 * by one predicate and one-item by another still put the listener at 0:00
 * either way. The arms diverge only on a genuine multi-item Queue.
 *
 * The verdict is a PARAMETER, not something derived here — `resolveNextPress`
 * is the pattern (`helpers/chapterSkip.ts`), and `helpers/queueShape.ts` is
 * the app's one answer. A helper that does Player IO must not also decide;
 * that split is ADR 0003's decision 2, and it is what lets this be tested
 * against the fake player with no Book, no store and no DB.
 */
export async function rewindPlayerToBookStart(
  queueShape: QueueShape,
): Promise<void> {
  if (queueShape === 'one-item') {
    await seekTo(0);
    return;
  }
  await skip(0);
}
