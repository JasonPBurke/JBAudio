import {
  getActiveBookId,
  getActiveTrackIndex,
  getProgress,
} from '@/player/trackPlayer';
import { addFootprint } from '@/db/footprintQueries';
import { stampLastPlayed } from '@/db/bookQueries';
import { FootprintTrigger } from '@/db/models/Footprint';
import { locateInBook, type PositionReading } from '@/helpers/bookLocation';
import { useLibraryStore } from '@/store/library';
import type { PreviousPressKind } from '@/helpers/chapterSkip';

/**
 * Footprint recording for presses that only know the ACTIVE BOOK — the one
 * the Player currently has loaded — rather than a Book they already hold.
 *
 * That is the membership rule for the `recordActiveBook*` family: a site that
 * has to ask the Player which Book is loaded belongs there, whether the press
 * arrived from a remote control (notification player, Android Auto, Bluetooth
 * — the `Remote*` events in the playback service), from the in-app transport
 * controls, from the progress bar's scrub, or from the sleep timer arming
 * itself. A press site with a
 * `bookId` in hand (titleDetails, chapterList, playBookFromRow) calls
 * `recordFootprint` below and skips the Book read only.
 *
 * ⚠ Every one of them, both kinds, goes through the same DERIVATION, which is
 * why it lives here and not at any of them: a footprint is written at a
 * CHAPTER POSITION, and turning the Player's raw Position into one is
 * `locateInBook`'s job. That derivation used to sit under `db/`, where it
 * asked the Player where it was and decided for itself what Position was
 * measured against.
 *
 * Every `recordActiveBook*` function here READS the Active Book, GUARDS on
 * it, records, and SWALLOWS failure — `recordFootprint` alone does none of
 * those, because its callers have already done all three.
 * The swallow is load-bearing at every call site: a
 * footprint is a breadcrumb back to where the user was, so failing to write
 * one must never block the playback command or the timer activation it was
 * recorded alongside — several callers have already written DB state by the
 * time they get here.
 *
 * The seek/chapter helpers must additionally be AWAITED BEFORE the
 * seek/skip is issued, so the breadcrumb captures the pre-press position:
 * every recorder here reads the live Position and Queue index, and after the
 * transport call those describe where the press LANDED.
 */

/**
 * What the Player just said, tagged as `locateInBook` wants it. Narrowed to
 * the `'queue'` arm because that is the only reading this module can ever
 * hold — every recorder here reads a live Player, never stored progress.
 */
type PlayerReading = Extract<PositionReading, { from: 'queue' }>;

/**
 * The one derivation, shared by every recorder in this module.
 *
 * ⚠ It asks `locateInBook` and branches on nothing. Two opposite bugs lived
 * in the hand-written version this replaces, each of them the guard its
 * sibling needed: one refused to record when the Queue index was unreadable
 * even on a ONE-ITEM Queue, where the index can only ever be `0` and is not
 * read at all; the other fabricated index `0` on a MULTI-ITEM Queue, where
 * the index is the only thing that says which Chapter is playing — silently
 * filing the breadcrumb under chapter one. `locateInBook` refuses exactly
 * when there is nothing to say, on either shape, and a refusal here means no
 * footprint rather than a wrong one.
 *
 * The chapters come from the library store rather than a fresh fetch, so
 * this lands on the same array the queue builders mapped — already ordered
 * by ARRAY POSITION, which is the ordering, and already the reference
 * `queueShapeOf` memoises its verdict against.
 */
async function recordFootprintAt(
  bookId: string,
  trigger: FootprintTrigger,
  reading: PlayerReading,
): Promise<void> {
  // ⚠ The `?.` is load-bearing and `tsc` cannot see it: `books` is a
  // `Record<string, Book>` and `noUncheckedIndexedAccess` is off, so a direct
  // index types a genuine runtime miss out of existence. ADR 0003 records the
  // same hazard at `service.ts`'s `getBookFromStore`.
  const location = locateInBook(
    useLibraryStore.getState().books[bookId]?.chapters,
    reading,
  );
  if (!location?.chapter) return;
  await addFootprint(bookId, location.chapter, trigger);
}

/**
 * Record `trigger` against `bookId` at wherever the Player is right now.
 *
 * The entry point for the three surfaces that already hold the Book —
 * titleDetails, chapterList and playBookFromRow — each of which has proven
 * it is the loaded one before calling. It does not swallow: all three wrap
 * the call, and the `recordActiveBook*` family below swallows for the rest.
 */
export async function recordFootprint(
  bookId: string,
  trigger: FootprintTrigger,
): Promise<void> {
  const [queueIndex, { position }] = await Promise.all([
    getActiveTrackIndex(),
    getProgress(),
  ]);
  await recordFootprintAt(bookId, trigger, {
    from: 'queue',
    queueIndex,
    positionSeconds: position,
  });
}

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
 * The seek press — the in-app scrub, the notification/Android Auto seek-bar
 * drag, and the breadcrumb a press that leaves the Book entirely writes. Not
 * `tryWithActiveBook`: all three reads are issued in parallel so the
 * breadcrumb is captured with one round trip of latency in front of the
 * seek, not three.
 */
export async function recordActiveBookSeekFootprint(
  bookId?: string,
): Promise<void> {
  try {
    const [activeBookId, { position }, queueIndex] = await Promise.all([
      bookId ?? getActiveBookId(),
      getProgress(),
      getActiveTrackIndex(),
    ]);
    if (activeBookId) {
      await recordFootprintAt(activeBookId, 'seek', {
        from: 'queue',
        queueIndex,
        positionSeconds: position,
      });
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
