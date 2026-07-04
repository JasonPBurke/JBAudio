/**
 * SPIKE (Bug B): load single-file books as N queue items that each play a
 * clipped time-window of the same file (MediaItem.ClippingConfiguration in
 * the patched track player). Gives Android Auto a real chapter queue and
 * chapter-relative progress everywhere (DHU, notification), reusing the
 * multi-file code paths.
 *
 * Flip to false to restore the classic single-track behavior. While true,
 * the `isSingleFile` branches in src/setup/service.js are bypassed for
 * playback (books still carry isSingleFile in the DB).
 */
export const CLIPPED_CHAPTERS_SPIKE = true;
