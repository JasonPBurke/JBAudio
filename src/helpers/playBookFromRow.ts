import TrackPlayer, { State } from 'react-native-track-player';
import { Book } from '@/types/Book';
import { handleBookPlay } from '@/helpers/handleBookPlay';
import { awaitPlayerReady } from '@/helpers/awaitPlayerReady';
import { recordFootprint } from '@/db/footprintQueries';

/**
 * What happens when the user presses play on a Book in the library.
 *
 * Four surfaces do this — a grid card, a list row, a series browse row and a
 * series detail sheet — and until this module existed they did it with four
 * hand-copied handlers. The grid's and the list's were character-for-character
 * identical; the two series sites were the same shape minus the footprint. The
 * point of gathering them is that the NEXT change to "what happens when you
 * press play on a row" happens once.
 *
 * The operation decides nothing about the Book itself: it waits for the Player,
 * reads whether the Player is currently playing, optionally records a play
 * footprint, and hands off to `handleBookPlay`, which owns every rule about
 * where that Book starts (spec §C5's restart-from-zero among them).
 *
 * ⚠ THE BOOK DETAILS SCREEN IS NOT A FIFTH CALLER, and it is not an oversight.
 * `src/app/titleDetails.tsx` holds a block that looks like the same copy and is
 * not the same operation: it is a play/PAUSE toggle, it stamps `stampLastPlayed`
 * beside the footprint, it drives a loading spinner around the play, and it
 * reads a THIRD active-Book source — `activeTrack?.bookId`, straight off RNTP's
 * hook rather than either store. Folding it in here would be a behaviour
 * change, not a de-duplication.
 *
 * ⚠ THE FOUR CALLERS DISAGREE ABOUT WHAT "ALREADY IN PLAY" MEANS, AND THE
 * DISAGREEMENT IS DELIBERATELY PRESERVED HERE.
 *
 *   - The grid card and the list row pass the **Active Book** —
 *     `useIsBookActive`, read from the player-state store. That is an
 *     OBSERVATION of what the Player has loaded, and it LAGS a Book switch.
 *   - The series browse row and the series detail sheet pass the **Requested
 *     Book** — `book.bookId === activeBookId`, compared inline against the queue
 *     store. That is an INTENT, set the moment the user asks, so it LEADS a
 *     switch.
 *
 * Same argument, same helper below it, two different questions. They agree
 * during steady playback and disagree for exactly the length of a Book switch,
 * which is why lining the four handlers up side by side was the only way to see
 * it. CONTEXT.md defines both terms.
 *
 * So it is a PARAMETER and each caller keeps passing what it passed before.
 * Picking one source for all four is a behaviour change, it is not this
 * module's call to make, and it would be invisible to every test that does not
 * switch Books mid-playback. Reconciling them is ticket 11's territory
 * (`.scratch/player-seam/issues/11-rename-active-vs-requested-book.md`).
 */
export type PlayBookFromRowArgs = {
  /** The Book to play. Absent (or id-less) means the row has nothing to play. */
  book: Book | undefined;
  /**
   * Whether this press should be treated as "the Book is already the one in
   * play". Becomes `handleBookPlay`'s `isActiveBook`, whose only job is to make
   * a press on the Book already playing a no-op.
   *
   * ⚠ Deliberately NOT named `isActiveBook`: two of the four callers do not
   * pass the Active Book, and CONTEXT.md lists "active book" under _Avoid_ for
   * the Requested one. The caller owns the question; see the header.
   */
  alreadyInPlay: boolean;
  /** The Requested Book, from the queue store. `handleBookPlay` compares against it. */
  activeBookId: string | null;
  setActiveBookId: (bookId: string) => void;
  /**
   * Record a `play` footprint before handing off. The grid and list rows do;
   * the two series surfaces never have, and this is not the place to change
   * that.
   */
  recordPlayFootprint?: boolean;
};

/**
 * A footprint is a breadcrumb back to where the listener WAS, so it is written
 * before the play is issued and only when the Player is paused on this very
 * Book — resuming the Book you are already in is the case worth a breadcrumb;
 * starting a different Book is not. Never blocks the play: a footprint is a
 * convenience and the press is not.
 */
const recordResumeFootprint = async (bookId: string): Promise<void> => {
  try {
    const activeTrack = await TrackPlayer.getActiveTrack();
    if (activeTrack?.bookId === bookId) {
      await recordFootprint(bookId, 'play');
    }
  } catch {
    // Silently fail if footprint recording fails
  }
};

export const playBookFromRow = async ({
  book,
  alreadyInPlay,
  activeBookId,
  setActiveBookId,
  recordPlayFootprint = false,
}: PlayBookFromRowArgs): Promise<void> => {
  if (!book?.bookId) return;

  await awaitPlayerReady();
  const playbackState = await TrackPlayer.getPlaybackState();
  const isCurrentlyPlaying = playbackState.state === State.Playing;

  if (recordPlayFootprint && !isCurrentlyPlaying) {
    await recordResumeFootprint(book.bookId);
  }

  await handleBookPlay(
    book,
    isCurrentlyPlaying,
    alreadyInPlay,
    activeBookId,
    setActiveBookId,
  );
};
