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
 * writing anything.
 *
 * An out-of-range `current` is clamped to the ceiling rather than stepped from,
 * and in either direction. Two different things arrive here out of range, and
 * the same answer is right for both:
 *
 * - `-1`, persisted by the old unclamped modal. Corruption; snapping heals it.
 * - A count the user legitimately set that the playhead has since outgrown.
 *   `maxChapters` shrinks as the book plays, and the count only decrements
 *   alongside it while the timer is armed (`onChapterChanged` returns early on
 *   `!timerActive`), so a configured-but-unarmed count drifts out of range on
 *   its own.
 *
 * For the second case the clamp is the nearest reachable value, not a loss: the
 * user asked for an end the book can no longer offer, and the ceiling is "as
 * late as the book allows". Stepping down by one would answer with a second
 * value the book still cannot honour. Ruled in issue `02` of
 * `.scratch/sleep-timer-stepper/`, which also records why `−` must not get a
 * different rule from `+`.
 *
 * Clamping is safe here because the ceiling is fresh: both surfaces recompute
 * `maxChapters` on mount, and the modal's mount is its sheet-open. Contrast the
 * database boundary below, where the ceiling is unknown.
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
 * Heal a chapter count crossing the database boundary — on the way in at the
 * one write site, and on the way out at every read site.
 *
 * A negative count heals to `null`, the chapter timer's "off" value, NOT to 0.
 * `-1` is the fingerprint of a `−` press at zero, and before that press the row
 * held `null`; 0 is a different setting the user did not choose. The
 * distinction is the whole point of the heal: `setup/sleepTimer.ts` arms
 * bedtime mode on `timerChapters !== null` and then fires whenever the count is
 * not `> 0`, so healing to 0 leaves every affected device behaving exactly as
 * the corruption made it behave — bedtime still arms, and it still stops
 * playback at the end of the next chapter. Only `null` makes it stop.
 *
 * Erring toward "off" is the safe direction for a sleep timer: the cost of
 * being wrong is a timer the user can see is off and re-arm, against playback
 * silently stopping on a night they never set one.
 *
 * Only the lower bound is enforced *at this boundary*. `maxChapters` is a
 * runtime fact about the book and the playhead, unknown at the write boundary
 * and to every read site, and in the UI it resolves asynchronously from 0 —
 * clamping to it here would flatten a legitimate count to zero on the first
 * frame. That is a claim about this boundary alone: at the press site
 * `stepChapterCount` clamps to the ceiling deliberately, because there the
 * ceiling is known and fresh.
 *
 * The high side needs no healing anyway: an over-count never fires, because the
 * book ends first — and `onPlaybackStopped` then clears `timer_chapters`
 * outright, so the setting does not survive to the next book.
 */
export function normalizeChapterCount(
  timerChapters: number | null,
): number | null {
  if (timerChapters === null || timerChapters < 0) return null;
  return timerChapters;
}
