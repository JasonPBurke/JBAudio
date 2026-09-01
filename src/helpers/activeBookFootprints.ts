import { getActiveBookId, getProgress } from '@/player/trackPlayer';
import {
  recordFootprint,
  recordSeekFootprint,
} from '@/db/footprintQueries';
import { stampLastPlayed } from '@/db/bookQueries';
import { FootprintTrigger } from '@/db/models/Footprint';
import type { PreviousPressKind } from '@/helpers/chapterSkip';

/**
 * Footprint recording for presses that only know the ACTIVE BOOK — the one
 * the Player currently has loaded — rather than a Book they already hold.
 *
 * That is the whole membership rule. A press site with a `bookId` in hand
 * (titleDetails, chapterList, playBookFromRow) calls `recordFootprint`
 * directly and does not belong here; a site that has to ask the Player which
 * Book is loaded does, whether the press arrived from a remote control
 * (notification player, Android Auto, Bluetooth — the `Remote*` events in the
 * playback service), from the in-app transport controls, or from the sleep
 * timer arming itself.
 *
 * Every function here READS the Active Book, GUARDS on it, records, and
 * SWALLOWS failure. The swallow is load-bearing at every call site: a
 * footprint is a breadcrumb back to where the user was, so failing to write
 * one must never block the playback command or the timer activation it was
 * recorded alongside — several callers have already written DB state by the
 * time they get here.
 *
 * The seek/chapter helpers must additionally be AWAITED BEFORE the
 * seek/skip is issued, so the breadcrumb captures the pre-press position
 * (`recordSeekFootprint` reads the current track index for chapter-queue
 * books, `recordFootprint` reads the current position).
 */

/**
 * The shape itself: resolve the Book, guard, run, never throw. The `try`
 * prefix is the point — the swallow is load-bearing, not incidental.
 *
 * `bookId` is threaded through rather than always read: re-reading the active
 * Book costs a bridge round-trip and, worse, a Book switch racing the handler
 * would attribute the breadcrumb to the wrong Book. Callers that know the
 * Book pass it.
 */
async function tryWithActiveBook(
  bookId: string | undefined,
  record: (bookId: string) => Promise<void>,
): Promise<void> {
  try {
    const id = bookId ?? (await getActiveBookId());
    if (id) {
      await record(id);
    }
  } catch {
    // Silently fail if footprint recording fails
  }
}

/** Record `trigger` against the Active Book (or `bookId`, when known). */
export async function recordActiveBookFootprint(
  trigger: FootprintTrigger,
  bookId?: string,
): Promise<void> {
  await tryWithActiveBook(bookId, (id) => recordFootprint(id, trigger));
}

/**
 * The play press: a `'play'` footprint AND a last-played stamp, in that
 * order. Kept as its own function rather than a flag on the one above — only
 * this pair of callers stamps, and the stamp needs the same Book the
 * footprint is written against, which is exactly what the caller lacks.
 */
export async function recordActiveBookPlayFootprint(): Promise<void> {
  await tryWithActiveBook(undefined, async (id) => {
    await stampLastPlayed(id);
    await recordFootprint(id, 'play');
  });
}

/**
 * The seek press — the notification/Android Auto seek-bar drag, and the
 * breadcrumb a press that leaves the Book entirely writes. Not
 * `tryWithActiveBook`: the position read is issued in
 * parallel with the Book read so the breadcrumb is captured with one round
 * trip of latency in front of the seek, not two.
 */
export async function recordActiveBookSeekFootprint(
  bookId?: string,
): Promise<void> {
  try {
    const [activeBookId, { position }] = await Promise.all([
      bookId ?? getActiveBookId(),
      getProgress(),
    ]);
    if (activeBookId) {
      // Position is in seconds — same conversion as PlayerProgressBar
      await recordSeekFootprint(
        activeBookId,
        Math.round(position * 1000),
      );
    }
  } catch {
    // Silently fail if footprint recording fails
  }
}

/**
 * A deliberate one-line delegate. It survives the extraction because it
 * narrows the trigger to the two a chapter press can produce and defaults it,
 * which is the whole of what its callers want; inlining it would push that
 * narrowing out to every chapter-press call site.
 */
export async function recordActiveBookChapterChangeFootprint(
  bookId?: string,
  trigger: Extract<
    FootprintTrigger,
    'chapter_change' | 'chapter_restart'
  > = 'chapter_change',
): Promise<void> {
  await recordActiveBookFootprint(trigger, bookId);
}

/**
 * The footprint for a resolved skip-PREVIOUS press, labeled by which action
 * the press turned out to be.
 *
 * Shared by the two press sites — `Event.RemotePrevious` in the playback
 * service and the in-app `SkipToPreviousButton` — because the label is the
 * part that can drift: a restart and a chapter change are the same press
 * until `skipToPreviousChapter` resolves it, and a surface that guessed
 * would write a breadcrumb naming something that did not happen. Both
 * surfaces record, per the rule in this module's header: the PRESS TYPE
 * decides whether a footprint is written, not which surface it arrived from.
 *
 * `bookId` is nullable so both callers can hand over whatever their own
 * Active-Book read produced — `null` from the player, `undefined` from the
 * store hook — without each spelling out the same conversion. An absent id
 * records nothing, exactly like the guard in `tryWithActiveBook`.
 */
export async function recordPreviousPressFootprint(
  bookId: string | null | undefined,
  kind: PreviousPressKind,
): Promise<void> {
  if (!bookId) return;
  await recordActiveBookChapterChangeFootprint(
    bookId,
    kind === 'restart' ? 'chapter_restart' : 'chapter_change',
  );
}
