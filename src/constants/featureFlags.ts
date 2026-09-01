/**
 * SPIKE (Bug B): hand a Book stored as one file to the Player as N queue
 * items that each play a clipped time-window of that file
 * (MediaItem.ClippingConfiguration in the patched track player). Gives
 * Android Auto a real chapter queue and chapter-relative progress everywhere
 * (DHU, notification), reusing the paths a Book with one file per Chapter
 * already takes.
 *
 * Flip to false to restore the classic single-track behavior.
 *
 * `shouldUseClippedChapters` (`helpers/clippedChapters.ts`) is this flag's
 * only reader, and `queueShapeOf` (`helpers/queueShape.ts`) folds that gate
 * into the app's single answer to Queue shape — so no playback branch tests
 * this flag itself. ⚠ It must stay COMPILE-TIME constant: `queueShapeOf`
 * memoises on the chapters array reference, and a runtime-variable flag would
 * make it silently serve stale verdicts with no symptom.
 *
 * No playback code reads the persisted `isSingleFile` flag any more, on
 * either setting; Books still carry the column in the DB.
 */
export const CLIPPED_CHAPTERS_SPIKE = true;
