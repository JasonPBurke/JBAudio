import {
  getActiveBookId,
  getActiveTrackIndex,
  getProgress,
  getQueue,
} from '@/player/trackPlayer';
import { useLibraryStore } from '@/store/library';
import { findChapterIndexByPosition } from '@/helpers/singleFileBook';

/**
 * How many chapter boundaries are left in the Active Book — the ceiling the
 * sleep timer's chapter stepper steps against.
 *
 * One home for a computation that used to run twice, verbatim down to the
 * queue-shape comment below: once in `src/app/(settings)/timer.tsx` and once in
 * `src/modals/SleepTimerOptions.tsx`. The copies had already drifted at their
 * edges — with no Book loaded the settings screen answered 20 and the modal
 * answered 0 — which is the same defect `stepChapterCount` closed one layer up,
 * where a press resolved differently on each surface. See
 * `.scratch/sleep-timer-stepper/issues/03-*.md`.
 *
 * ⚠ RETURNS `null` FOR "NOT KNOWN", NOT A NUMBER. No Book loaded, or a Player
 * read that failed. The 20 the settings screen falls back to is a UI
 * affordance — an arbitrary seed since the screen was written (`661eb1f`),
 * never a fact about a Book — so it stays at that call site rather than being
 * baked in here and inherited by a surface that never asked for it. Callers
 * that must tell "the ceiling is 0" from "the ceiling has not arrived" get to;
 * `null` is what makes that distinguishable at all.
 *
 * ⚠ SETS NO STATE AND ANSWERS ONLY THIS QUESTION. It does not report whether a
 * Book is active (`timer.tsx` asks that separately, of the same read), and it
 * does not decide what a surface shows for `null`. Returning a value rather
 * than taking a setter is what lets each call site keep its own `isActive`
 * unmount guard around the `setState` that consumes it.
 *
 * Cheap and re-runnable on purpose: both surfaces recompute on mount, and the
 * modal's mount is its sheet-open (`@gorhom/bottom-sheet` gates children until
 * present), so the ceiling is fresh every time the sheet is drawn. Do not hoist
 * this into a provider or a screen-level effect — that would make it
 * mount-once-per-player-session and hand the stepper a stale ceiling.
 *
 * The stepper's pure decisions live beside this in `chapterTimerStepper.ts`.
 */
export async function remainingChapterCount(): Promise<number | null> {
  try {
    // Clipped single-file books have one queue item per chapter, so they take
    // the multi-file (else) path; the single-item branch is legacy-only.
    //
    // ⚠ `queue.length === 1` is one of five competing queue-shape mechanisms
    // in this app, deferred repo-wide to `.scratch/queue-shape/spec.md`; ADR
    // 0003 refuses to answer it inside the adapter. This is a straight port of
    // what both copies did, no verdict changed — and this is now the single
    // site that changes when queue-shape is settled.
    const queue = await getQueue();

    if (queue.length === 0) return null;

    if (queue.length === 1) {
      const activeBookId = await getActiveBookId();
      if (activeBookId) {
        const book = useLibraryStore.getState().books[activeBookId];
        if (book?.chapters && book.chapters.length > 1) {
          const { position } = await getProgress();
          const currentChapterIndex = findChapterIndexByPosition(
            book.chapters,
            position,
          );
          return book.chapters.length - 1 - currentChapterIndex;
        }
      }
      // A single-file Book with no usable chapter list has no boundary left to
      // stop at — the count is known, and it is 0, not unknown.
      return 0;
    }

    // Named for the Queue, not for RNTP's "track" — CONTEXT.md lists that
    // under Chapter's _Avoid_. The adapter keeps RNTP's name; above it, the
    // index is a position in the Queue.
    const activeQueueIndex = await getActiveTrackIndex();
    if (activeQueueIndex === undefined) return 0;
    return queue.length - 1 - activeQueueIndex;
  } catch {
    return null;
  }
}
