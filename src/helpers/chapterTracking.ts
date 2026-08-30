import {
  resetBookToStart,
  type SingleFileChapterTracking,
} from '@/helpers/resetBookToStart';

/**
 * The single-file chapter-change detector: the last chapter index the
 * playback service saw, and the Book it saw it in.
 *
 * ── Why it is a module singleton, and why that is not a smell ──
 *
 * It has to be ONE object. The progress handler derives "did the chapter
 * change?" from the previous value each tick, and every path that finishes a
 * Book has to rewind that same instance — a fresh object leaves
 * `lastChapterIndex` at the final chapter, and the first tick after the user
 * presses play again reads that as a chapter change and records a footprint
 * for a press nobody made.
 *
 * It used to be a module-scope `let` inside `setup/service.ts`, which made it
 * unreachable from anywhere else: that file is a LEAF — nothing in `src/`
 * imports it, its only importer is `index.js` via `registerPlaybackService` —
 * so a UI press site could not have rewound it without inverting that edge.
 *
 * ⚠ This assumes the playback service runs in the SAME JS context as the UI,
 * which it does today (`index.js` registers it). If that ever changes, a
 * shared module singleton silently becomes TWO instances and this must be
 * revisited — message passing would then be the only correct shape.
 */
export const singleFileChapterTracking: SingleFileChapterTracking = {
  lastChapterIndex: -1,
  bookId: null,
};

/**
 * Rewind a Book to its first chapter, tracker included.
 *
 * The named verb every rewinding caller uses, so that "reset this Book"
 * cannot be spelled as a field poke at the singleton above. The playback
 * service still reads and writes the fields directly, because its per-tick
 * read-modify-write is the one caller that genuinely needs the cursor rather
 * than the rewind.
 */
export async function rewindChapterTracking(bookId: string): Promise<void> {
  await resetBookToStart(bookId, singleFileChapterTracking);
}
