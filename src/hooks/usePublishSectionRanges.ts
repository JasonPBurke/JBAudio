import { useLayoutEffect, useMemo } from 'react';

import type { SectionRange } from '@/helpers/ladderDecisions';
import {
  computeSectionRanges,
  type SectionedItem,
} from '@/helpers/sectionRanges';

/**
 * Compute a sectioned list's index ranges and hand them UP to the screen that
 * owns the ladder (spec §H4/§H5).
 *
 * A callback rather than a prop ref written in place: the React Compiler
 * freezes props, so `propRef.current = x` is rejected even inside an effect.
 * The direction of travel is still list -> screen.
 */
export function usePublishSectionRanges(
  items: readonly SectionedItem[],
  onSectionRangesChange?: (ranges: SectionRange[]) => void,
): void {
  const ranges = useMemo(() => computeSectionRanges(items), [items]);

  /*
   * ⚠ A LAYOUT effect, and §H5 makes that a CONTRACT REQUIREMENT rather than a
   * preference. The ladder reads index information from two independent clocks:
   * FlashList's own, updated inside its commit, and these ranges. A passive
   * effect publishes AFTER PAINT, leaving a window in which the new rows are on
   * screen while the ranges still describe the previous array -- and the
   * trigger is not a section tap, it is the library store emitting mid-scan, so
   * the window is widest exactly when the JS thread is busy.
   *
   * The failure reads as a jump bug rather than as a staleness bug: a stale
   * range resolves to the CORRECT section id with a STALE `start`, so
   * `expanded.has(id)` passes, `getLayout(start).y` returns a real and
   * plausible `y`, the sub-pixel guard passes, and the rung lands on a section
   * the user was never in.
   *
   * It costs nothing -- the ranges are already computed during render.
   */
  useLayoutEffect(() => {
    onSectionRangesChange?.(ranges);
  }, [ranges, onSectionRangesChange]);
}
