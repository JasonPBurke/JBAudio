/**
 * The sleep timer's chapter-count stepper, as a decision unit.
 *
 * The stepper is drawn on two surfaces — the player's SleepTimerOptions modal
 * and Settings' SleepTimerDurationCard — and they used to disagree. The card
 * guarded at the press; the modal wrote the DB unclamped and clamped only its
 * local state, so a press at a bound persisted a count the modal refused to
 * display: a `−` at zero left `timerChapters === -1`, which reads back as an
 * armed chapter timer holding a negative count. Both press sites now resolve
 * the press here, so a press at a bound cannot mean two different things.
 *
 * The range is [0, maxChapters]. 0 means "end of the current chapter";
 * maxChapters is the number of chapter boundaries left in the book, so it is
 * "end of the book" and it shrinks as the book plays.
 */

/**
 * Resolve one stepper press. Returns the count the press lands on — equal to
 * `current` when the press is a no-op, which is what a call site checks before
 * writing anything. An out-of-range `current` (a value persisted by the old
 * unclamped modal) is stepped back into range rather than compounded.
 */
export function stepChapterCount(
  current: number,
  delta: number,
  maxChapters: number,
): number {
  const ceiling = Math.max(maxChapters, 0);
  const next = current + delta;
  if (next < 0) return 0;
  if (next > ceiling) return ceiling;
  return next;
}

/**
 * Heal a persisted chapter count on the way out of the database.
 *
 * `null` is a real value here — the chapter timer is off — and is preserved.
 * Only the lower bound is enforced: `maxChapters` is a runtime fact about the
 * book and the playhead, unknown to any read site, and it resolves
 * asynchronously in the UI (it starts at 0), so clamping to it on read would
 * flatten a legitimate count to zero on the first frame.
 *
 * The high side needs no healing: an over-count simply never fires, whereas a
 * negative count reads as "fire at the next chapter boundary" to
 * setup/sleepTimer.ts (`onChapterChanged` fires whenever the count is not
 * `> 0`) — see the ticket's `## Answer` section.
 */
export function normalizeChapterCount(
  timerChapters: number | null,
): number | null {
  if (timerChapters === null) return null;
  return Math.max(timerChapters, 0);
}
