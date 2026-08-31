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
 *
 * This file stays PURE. The ceiling itself is a runtime fact about the Book and
 * the playhead, and it is computed in `remainingChapterCount.ts` — the other
 * half of the pair, and the one that reads the Player. Both surfaces call it;
 * neither re-derives it.
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

/**
 * Everything the chapter stepper draws and acts on, derived from the two facts
 * it holds: the stored count, and the ceiling.
 */
export type ChapterStepperView = {
  /**
   * The count to display and to step FROM — the stored count bounded by the
   * ceiling. Not written back: the stored count is corrected by a press, never
   * by a render.
   */
  count: number;
  /** The row's text. Empty while the stored count has not been read yet. */
  label: string;
  canStepUp: boolean;
  canStepDown: boolean;
};

/**
 * Derive the stepper's whole visible state from the stored count and the
 * ceiling, so the label, the button dimming and the press all read the same
 * number. They used to read the two raw values independently, in four places
 * across two components, and drifted apart in two ways:
 *
 * - **A count the book can no longer reach rendered verbatim.** `maxChapters`
 *   shrinks as the book plays but the stored count only decrements while the
 *   timer is ARMED (`onChapterChanged` returns early on `!timerActive`), so a
 *   configured-but-unarmed count outlives the chapters it named — and the row
 *   said "End of 6 Chapters" with two chapters left, confidently, until the
 *   user pressed something. Bounding it here is what makes the first `−` press
 *   an ordinary step rather than the correction issue `02` mistook for a bug.
 * - **An unresolved ceiling was indistinguishable from a ceiling of zero.**
 *   Both surfaces seeded `maxChapters` with a placeholder and filled it from
 *   async Player reads, so they rendered, dimmed and resolved presses against a
 *   number that was not yet a fact about any book.
 *
 * `null` means NOT KNOWN, and the two nulls are different questions:
 *
 * - `maxChapters === null` — the ceiling has not arrived, or cannot be known
 *   (`remainingChapterCount` returns `null` for no Book and for a Player read
 *   that threw). The stored count is shown UNCLAMPED: clamping against a guess
 *   is what would flatten a legitimate count to "End of Chapter" and then
 *   recover, which is the failure `normalizeChapterCount`'s docblock warns
 *   about. Both presses are dead, so nothing can be persisted against a
 *   ceiling that is not a fact.
 * - `storedCount === null` — the row has nothing truthful to say yet. Only the
 *   player modal passes this, and it passes it until BOTH its reads have come
 *   back: the settings read that supplies the count, and the ceiling read that
 *   bounds it. The label is empty rather than "End of Chapter", because
 *   asserting a value and correcting it a beat later is the flicker, not the
 *   fix. Note the asymmetry with the case above — a ceiling that resolved to
 *   "not known" still shows the count; a ceiling that has not resolved does
 *   not, because it is about to.
 *
 * Pure, and paired with `stepChapterCount` on purpose: this decides what the
 * press steps from, that one decides where it lands.
 */
export function chapterStepperView(
  storedCount: number | null,
  maxChapters: number | null,
): ChapterStepperView {
  if (storedCount === null) {
    return { count: 0, label: '', canStepUp: false, canStepDown: false };
  }

  if (maxChapters === null) {
    const count = Math.max(storedCount, 0);
    return {
      count,
      label: chapterCountLabel(count),
      canStepUp: false,
      canStepDown: false,
    };
  }

  const ceiling = Math.max(maxChapters, 0);
  const count = Math.min(Math.max(storedCount, 0), ceiling);
  return {
    // "End of Book" needs a ceiling above zero: on the last chapter the
    // ceiling IS zero, and "End of Chapter" is already the end of the book.
    label: count === ceiling && ceiling > 0 ? 'End of Book' : chapterCountLabel(count),
    count,
    canStepUp: count < ceiling,
    canStepDown: count > 0,
  };
}

/**
 * The count as the row says it. 0 is "the chapter being played", so the row
 * names one more chapter than the count.
 */
function chapterCountLabel(count: number): string {
  return count > 0 ? `End of ${count + 1} Chapters` : 'End of Chapter';
}
