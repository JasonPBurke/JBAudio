/**
 * Given the currently-expanded home sections and the set of section ids that
 * are on-screen, return the sections that should remain expanded after an
 * off-screen sweep: keep a section iff it is the protected `primary` section
 * or currently visible; drop the rest.
 *
 * ⚠ Returns the SAME `open` REFERENCE when nothing collapses, and that identity
 * is load-bearing in two places -- neither of them the "React bails out of a
 * re-render" it was originally written for, which is only the cheaper half.
 *
 * 1. The MVCP anchor fix. `useBackToTopLadder`'s sweep arms
 *    `prepareForLayoutAnimationRender()` ONLY when `decision.open !== expanded`
 *    -- so this return is what makes "did anything actually drop?" answerable
 *    by identity, and arming that flag when nothing did is a real bug. Why it
 *    is a bug is argued in full at that call site; it is not repeated here.
 * 2. The re-render. A no-op sweep hands React the same set and it skips
 *    re-rendering a 355-book list. Every accepted bounce-sweep (§F5) is free
 *    for this reason.
 *
 * A copy anywhere on the path from here to `setExpanded` silently costs both.
 * `collapseOffscreenSections.test.ts`'s two same-reference cases are what pin
 * it; they are NOT obsolete tautologies about `Set` construction.
 *
 * `primary` is `null` for the self-tidying variation, and that is the ONLY mode
 * this feature uses: §F7 rules that Recents is not exempt and survives by
 * POSITION instead, because it is the first item of every non-empty BooksHome
 * and is therefore on screen whenever the sweep is allowed to run. The
 * parameter stays for the parked lazy-single-open variation, which would pass a
 * section id. It is a frozen contract, not an open design question -- and there
 * is no sibling document to read on it, whatever the previous version of this
 * sentence claimed.
 */
export function computeRemainingOpen(
  open: Set<string>,
  visible: Set<string>,
  primary: string | null = null,
): Set<string> {
  let toRemove: string[] | null = null;
  for (const id of open) {
    if (id === primary) continue;
    if (visible.has(id)) continue;
    (toRemove ??= []).push(id);
  }
  if (toRemove === null) return open; // no change -> preserve reference
  const next = new Set(open);
  for (const id of toRemove) next.delete(id);
  return next;
}
