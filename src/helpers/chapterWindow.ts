import type { Chapter } from '@/types/Book';

/**
 * The slice of a one-item Queue that the remote surfaces should present as if
 * it were the whole thing: the notification's seek bar, Android Auto's, and
 * any other MediaSession controller's.
 *
 * ── Why this exists ────────────────────────────────────────────────────
 *
 * On every OTHER shape the remote seek bar is already chapter-scoped for
 * free, because the Chapter *is* the Player's current item: a multi-file Book
 * has one file per Chapter, and a clipped single-file Book has one
 * `ClippingMediaSource` per Chapter. ExoPlayer's own duration for the active
 * item is therefore the Chapter's, and the MediaSession publishes it without
 * anyone deciding anything.
 *
 * A one-item Queue has no such item. The Player holds ONE eight-hour source
 * spanning the whole Book, so the session advertises the Book's duration and
 * the Book's position — measured on a Pixel 7 Pro as `position=7203811` while
 * "Track 05" (which starts at 2h) was playing, where the honest chapter
 * reading is `3811`.
 *
 * ⚠ THE OBVIOUS FIX DOES NOT WORK, AND IT IS ALREADY IN THE TREE. Both
 * `handleBookPlay`'s one-item builder and `service.ts`'s chapter-change
 * update already send `duration: chapterDuration` for exactly this reason,
 * and it has never had any effect. media3 publishes the session's duration
 * from `Player.getDuration()`; `LegacyConversions.convertToMediaMetadataCompat`
 * consults the track metadata's own `durationMs` ONLY when the player's
 * duration is `C.TIME_UNSET`, which it never is here. The chapter TITLE lands
 * from the same bundle because nothing on the player competes with it — that
 * asymmetry is the fingerprint of the precedence rule, not a separate bug.
 *
 * So the window has to be applied where the session reads, which is the
 * patched `InnerForwardingPlayer`. This module decides WHAT the window is;
 * the native side only subtracts it. See
 * `docs/adr/0005-the-media-session-gets-its-own-coordinates.md`.
 *
 * ── Why the end is always explicit ─────────────────────────────────────
 *
 * ⚠ `windowEndMs` IS NEVER LEFT UNDEFINED, and that is not tidiness. The
 * native `Track` deliberately only updates a window key when the bundle
 * CARRIES it, so that a partial `updateMetadataForTrack` cannot wipe a window
 * that is already set. An undefined end on the last Chapter would therefore
 * not mean "to the end of the file" — it would silently INHERIT the previous
 * Chapter's end, leaving `end` behind `start`, and the native side would fall
 * back to Book scope for the whole final Chapter. This mirrors
 * `buildClippedChapterTracks`, which CAN leave `clipEndMs` undefined because
 * a clip is set once at queue-build time and never partially updated.
 */
export type ChapterWindow = {
  /** Milliseconds into the file where the Chapter starts. */
  windowStartMs: number;
  /** Milliseconds into the file where the Chapter ends. Always explicit. */
  windowEndMs: number;
};

/**
 * The presentation window for one Chapter of a one-item Queue, or `null` when
 * the rows cannot describe one.
 *
 * `null` is the fail-closed answer and means "publish the Book as before":
 * the native side treats an absent window as today's behaviour, so every
 * shape this module cannot speak for keeps working untouched.
 *
 * ⚠ THE END COMES FROM THE NEXT CHAPTER'S START WHERE THERE IS ONE, not from
 * this Chapter's `chapterDuration`. The two disagree in the corpus: a row
 * whose metadata extraction failed is stored with `chapterDuration: 0`
 * (`scanLibrary.ts`'s `makeErrorChapter`), which would collapse the window to
 * nothing, while the neighbouring `startMs` values still bracket the Chapter
 * correctly. `chapterDuration` is used ONLY for the last row, which has no
 * next start to borrow — and if that is unusable the answer is `null` rather
 * than a zero-length window.
 */
export function chapterPresentationWindow(
  chapters: readonly Pick<Chapter, 'startMs' | 'chapterDuration'>[] | undefined,
  chapterIndex: number,
): ChapterWindow | null {
  if (!chapters || chapterIndex < 0 || chapterIndex >= chapters.length) {
    return null;
  }

  const chapter = chapters[chapterIndex];
  const windowStartMs = chapter.startMs ?? 0;
  if (!Number.isFinite(windowStartMs) || windowStartMs < 0) return null;

  const nextStartMs = chapters[chapterIndex + 1]?.startMs;
  const windowEndMs =
    nextStartMs != null && Number.isFinite(nextStartMs)
      ? nextStartMs
      : windowStartMs + (chapter.chapterDuration ?? 0) * 1000;

  // A window that does not move forward describes no Chapter. Declining is
  // the honest answer: the remote surfaces keep the Book-scoped seek bar they
  // have today rather than being handed a zero-length or inverted one.
  if (!Number.isFinite(windowEndMs) || windowEndMs <= windowStartMs) {
    return null;
  }

  return { windowStartMs, windowEndMs };
}
