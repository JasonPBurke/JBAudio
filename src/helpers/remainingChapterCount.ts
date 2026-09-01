import {
  getActiveBookId,
  getActiveTrackIndex,
  getProgress,
} from '@/player/trackPlayer';
import { useLibraryStore } from '@/store/library';
import { locateInBook } from '@/helpers/bookLocation';

/**
 * How many chapter boundaries are left in the Active Book — the ceiling the
 * sleep timer's chapter stepper steps against.
 *
 * One home for a computation that used to run twice, verbatim down to its
 * queue-shape comment: once in `src/app/(settings)/timer.tsx` and once in
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
    const activeBookId = await getActiveBookId();
    if (!activeBookId) return null;

    const chapters =
      useLibraryStore.getState().books[activeBookId]?.chapters;

    // An Active Book whose chapter list is not visible has no boundary left to
    // stop at — the count is known, and it is 0, not unknown. `null` above is
    // reserved for its own question: is a Book loaded at all?
    if (!chapters || chapters.length === 0) return 0;

    // ⚠ ONE PLAYER READ, THEN ARITHMETIC. Both numbers are fetched together
    // and handed to the translator; nothing below asks the Player again, and
    // nothing below asks which shape the Queue is. Which coordinate the
    // Player just reported — a Chapter's worth of seconds or the whole
    // Book's — is exactly what `locateInBook` exists to absorb.
    //
    // The Queue itself is still never read: a Queue read answers about
    // whichever Book happens to be loaded, and it marshals the whole track
    // list across the bridge — hundreds of items on a clipped Book — to
    // learn one number.
    //
    // Named for the Queue, not for RNTP's "track" — CONTEXT.md lists that
    // under Chapter's _Avoid_. The adapter keeps RNTP's name; above it, the
    // index is a position in the Queue.
    const [activeQueueIndex, { position }] = await Promise.all([
      getActiveTrackIndex(),
      getProgress(),
    ]);

    const chapter = locateInBook(chapters, {
      from: 'queue',
      queueIndex: activeQueueIndex,
      positionSeconds: position,
    })?.chapter;

    // ⚠ `null` HERE IS "NOT KNOWN", AND IT USED TO BE A FABRICATED `0`.
    // An unreadable Queue index answered `0` — "no boundaries left" — which
    // is a claim, not a reading, and it contradicted this function's own
    // header two screens up: `null` is documented as covering "a Player read
    // that failed". The stepper's surfaces already handle `null` (the
    // settings screen seeds 20, the modal shows 0); a fabricated `0` instead
    // pinned the stepper to its floor and looked like a fact about the Book.
    if (!chapter) return null;

    return chapters.length - 1 - chapter.index;
  } catch {
    return null;
  }
}
