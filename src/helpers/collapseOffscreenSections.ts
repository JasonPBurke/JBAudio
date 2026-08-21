/**
 * Given the currently-expanded home sections and the set of section ids that
 * are on-screen, return the sections that should remain expanded after an
 * off-screen sweep: keep a section iff it is the protected `primary` section
 * or currently visible; drop the rest.
 *
 * Returns the SAME `open` reference when nothing collapses, so callers using
 * `setActiveGridSections(prev => computeRemainingOpen(prev, ...))` get React's
 * bail-out and skip a needless re-render.
 *
 * `primary` is `null` for the self-tidying variation (nothing protected) and a
 * section id for the lazy-single-open variation (see the sibling spec).
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
