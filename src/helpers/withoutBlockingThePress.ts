/**
 * Bookkeeping around a press — footprints going in, the Book rewind coming
 * out — must never block the press itself.
 *
 * Shared rather than re-spelled at each site: a press site that swallows and
 * one that does not are indistinguishable at a glance, and the one that does
 * not is how a database hiccup costs the user the seek they asked for. The
 * footprint recorders in `activeBookFootprints` own the same swallow
 * internally, for the same reason; this is the wrapper for the work that has
 * no recorder to hide inside.
 */
export async function withoutBlockingThePress(
  work: () => Promise<void> | void,
): Promise<void> {
  try {
    await work();
  } catch {
    // Non-fatal — playback must proceed even if the bookkeeping fails.
  }
}
