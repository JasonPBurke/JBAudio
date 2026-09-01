import {
  getActiveBookId,
  getActiveTrackIndex,
  getPlaybackState,
  getProgress,
  getQueue,
  play,
  seekTo,
  skip,
  stop,
  State,
} from '@/player/trackPlayer';
import { markBookFinishedOnce } from '@/helpers/markBookFinishedOnce';
import { rewindChapterTracking } from '@/helpers/chapterTracking';
import { useLibraryStore } from '@/store/library';
import { withoutBlockingThePress } from '@/helpers/withoutBlockingThePress';

/**
 * Relative seek with chapter/track-boundary crossing.
 *
 * Native seekBy() clamps within the CURRENT queue item, so on a MULTI-ITEM
 * Queue (one file per Chapter, and one file under clipped chapters — either
 * way, one queue item per Chapter) a remote jump-back would stop dead at the
 * chapter start. These helpers compute the landing spot in JS and issue an
 * explicit skip + seek instead, so the notification player, Android Auto
 * (RemoteJumpBackward/Forward) and the in-app buttons all behave the same:
 * 15s into chapter 2 minus 30s lands 15s before the end of chapter 1.
 *
 * A jump may span ANY number of chapters. Books routinely open with a 14s
 * intro and a 13s copyright notice, so a 60s skip has to cross two boundaries
 * in one tap; landing the whole remainder in the adjacent chapter would
 * produce an impossible position that native clamps back to the boundary —
 * which is exactly the "the seek stopped at the chapter edge" symptom this
 * file exists to prevent. The walk below is therefore over the WHOLE queue,
 * not just the neighbor.
 *
 * A ONE-ITEM Queue keeps absolute positions, so
 * an in-track seek already crosses virtual chapters; only the book edges
 * need clamping/finishing. The walker handles that as the degenerate case.
 */

/** A queue item's playable length, or null when the metadata is unusable. */
function usableDuration(duration: unknown): number | null {
  return typeof duration === 'number' && Number.isFinite(duration) && duration > 0
    ? duration
    : null;
}

export type RelativeSeekTarget =
  | { kind: 'seek'; index: number; position: number }
  | { kind: 'finished' };

export interface RelativeSeekInput {
  /** Per-queue-item durations in seconds, in queue order. */
  durations: readonly (number | undefined)[];
  /** Index of the active queue item. */
  index: number;
  /** Position within the active item, in seconds. */
  position: number;
  /** Seconds to move; negative seeks back, positive seeks forward. */
  delta: number;
}

/** Everything a relative seek walks except the jump itself. */
export type SeekInputs = Omit<RelativeSeekInput, 'delta'>;

/**
 * Where a relative seek lands, as a queue index plus a position inside it.
 *
 * Pure, so the boundary arithmetic can be tested without a player. Kept
 * separate from the two async helpers below because the arithmetic is the
 * part that has been wrong twice.
 *
 * A queue item whose duration is missing cannot be traversed — there is no
 * way to know how much of the jump it absorbs. Rather than guess, the walk
 * stops at that boundary, which degrades to the pre-walk behavior instead
 * of landing somewhere wrong.
 */
export function resolveRelativeSeek({
  durations,
  index,
  position,
  delta,
}: RelativeSeekInput): RelativeSeekTarget {
  const lastIndex = durations.length - 1;
  let landingIndex = Math.max(0, Math.min(index, lastIndex));
  let remaining = position + delta;

  if (delta < 0) {
    while (remaining < 0 && landingIndex > 0) {
      const previous = usableDuration(durations[landingIndex - 1]);
      if (previous === null) break;
      landingIndex -= 1;
      remaining += previous;
    }
    // Still negative means the start of the book (or of the last item we can
    // measure) — clamp rather than hand native a negative position.
    return { kind: 'seek', index: landingIndex, position: Math.max(0, remaining) };
  }

  let landingDuration = usableDuration(durations[landingIndex]);
  while (landingDuration !== null && remaining > landingDuration) {
    if (landingIndex === lastIndex) return { kind: 'finished' };
    remaining -= landingDuration;
    landingIndex += 1;
    landingDuration = usableDuration(durations[landingIndex]);
  }
  return { kind: 'seek', index: landingIndex, position: Math.max(0, remaining) };
}

async function isPlayingNow(): Promise<boolean> {
  const { state } = await getPlaybackState();
  return state === State.Playing || state === State.Buffering;
}

// Guard: restore play state if the seek/skip caused an unexpected pause
async function restorePlayStateIfNeeded(wasPlaying: boolean): Promise<void> {
  if (!wasPlaying) return;
  if (!(await isPlayingNow())) {
    await play();
  }
}

/**
 * Reads the numbers a relative seek walks — every queue item's duration, plus
 * where playback currently is — once, in one place, so both helpers below
 * walk the same ones.
 *
 * ⚠ This resolves NO Queue shape, despite once being called `readQueueShape`.
 * That name outlived the design it came from: the walker in
 * `resolveRelativeSeek` is annotated "correct for BOTH queue shapes" because
 * a per-item duration list makes the shape question disappear rather than
 * answer it — a one-item Queue is simply a list of one. `queueShapeOf` owns
 * the verdict; nothing here asks it.
 *
 * The ACTIVE item's duration comes from the player rather than the queue: it
 * is what the decoder actually found, whereas a queue item's `duration` is
 * the chapter row's tag-derived estimate. Every other item can only be the
 * estimate, which is fine — those are used to measure a jump, not to land it.
 */
async function readSeekInputs(): Promise<SeekInputs | null> {
  const [queue, activeIndex, progress] = await Promise.all([
    getQueue(),
    getActiveTrackIndex(),
    getProgress(),
  ]);

  if (queue.length === 0) return null;

  const index = activeIndex ?? 0;
  const durations = queue.map((track) => track.duration);
  const liveDuration = usableDuration(progress.duration);
  if (liveDuration !== null && index >= 0 && index < durations.length) {
    durations[index] = liveDuration;
  }

  return { durations, index, position: progress.position };
}

/** Moves to the landing spot, skipping queue items only when needed. */
async function applyTarget(
  target: Extract<RelativeSeekTarget, { kind: 'seek' }>,
  currentIndex: number,
): Promise<void> {
  if (target.index !== currentIndex) {
    // skip(index) rather than repeated skipToNext/skipToPrevious: one native
    // call lands any number of chapters away, and no intermediate item is
    // ever prepared just to be abandoned.
    await skip(target.index);
  }
  await seekTo(target.position);
}

export async function seekBack(seconds: number): Promise<void> {
  const wasPlaying = await isPlayingNow();

  const inputs = await readSeekInputs();
  if (!inputs) return;

  const target = resolveRelativeSeek({ ...inputs, delta: -seconds });
  // A backward seek can never finish a book; the walker clamps at index 0.
  if (target.kind === 'seek') {
    await applyTarget(target, inputs.index);
  }

  await restorePlayStateIfNeeded(wasPlaying);
}

export async function seekForward(seconds: number): Promise<void> {
  const wasPlaying = await isPlayingNow();

  const inputs = await readSeekInputs();
  if (!inputs) return;

  const target = resolveRelativeSeek({ ...inputs, delta: seconds });

  if (target.kind === 'finished') {
    const activeBookId = await getActiveBookId();
    if (activeBookId) {
      // No `withoutBlockingThePress` around this one: the verb owns the
      // swallow, so a database failure cannot escape before the skip, the
      // seek and the stop below. The store read stays HERE because this
      // helper only knows the Active Book's id.
      await markBookFinishedOnce(
        activeBookId,
        useLibraryStore.getState().books[activeBookId],
      );
    }
    if (inputs.index !== 0) {
      await skip(0);
    }
    await seekTo(0);
    // Intentional stop — skip the play-state guard. `stop()`, not `pause()`,
    // for the reason the other two finish paths use it: it is what
    // `Event.PlaybackQueueEnded` does, and it routes to the sleep timer's
    // STOPPED handler, which clears an armed timer instead of freezing one
    // that would later resume against whatever Book is played next.
    await stop();

    // The same rewind `Event.PlaybackQueueEnded` and `RemoteNext`'s finish
    // branch perform. All three FINISH a Book and must leave it in the same
    // state; this one used to do the player half and none of the persisted
    // half, which left the stored chapter index — and the chapter-change
    // detector — pointing at the final chapter of a Book sitting at 0.
    //
    // ⚠ Correct for BOTH queue shapes, and idempotent with the multi-item
    // path rather than a second, conflicting write. On a multi-item Queue
    // the `skip(0)` above fires `Event.PlaybackActiveTrackChanged`,
    // whose multi-item branch already writes `setChapterIndex(bookId, 0)` —
    // this writes the same zero. That accidental correctness is precisely why
    // the defect only ever showed on Books that load as ONE queue item, and
    // why the rewind cannot be conditioned on the shape: a one-item Queue has
    // no track change to ride on.
    //
    // Last, and deliberately so, for the two reasons `nextPress` states: the
    // press has already been served, so a failure inside the rewind must not
    // cost the seek or the stop; and a 1 Hz progress tick can land on any
    // await above, where after the seek the worst it can write is the same
    // zeroes. Rewinding FIRST would leave the tracker at chapter 0 while the
    // position is still in the last chapter, and that tick would write the
    // stale index straight back.
    if (activeBookId) {
      await withoutBlockingThePress(() => rewindChapterTracking(activeBookId));
    }
    return;
  }

  await applyTarget(target, inputs.index);

  await restorePlayStateIfNeeded(wasPlaying);
}
