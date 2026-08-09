/**
 * Canonical-number range collapse for the Series browse row and detail screen.
 *
 * Spec §B1 (`22 books · 7 finished · #1-22`) and §H10. Zero imports, so it
 * stays testable and cheap to call from a recycled list cell.
 */

/**
 * Maximum comma-separated runs in a collapsed range (§H10).
 *
 * THREE is measured, not chosen: `#1-4, 4.5, 5-8` is three runs and is exactly
 * what fitted on device at 411dp / font scale 2.0 behind a `9 books · ` prefix
 * — which, with `M finished` dropping first (§H9), is the true worst case. The
 * cap's job is to cut at a RUN BOUNDARY, which is why a character budget lost.
 */
export const RANGE_RUN_CAP = 3;

/**
 * Collapse a canonical-number list to the range notation every app surveyed in
 * ticket 03 uses: `1, 3-4, 8`.
 *
 * Nulls are dropped and nothing is placeholdered for un-owned books — no app
 * anywhere does that. Only consecutive INTEGERS collapse: `4, 4.5, 5` stays
 * spelled out, because a range would claim the user owns a volume they may not.
 *
 * Unbounded output was a real defect — an alternating 41-book series emitted
 * ~70 characters — so the result is capped at {@link RANGE_RUN_CAP} runs and
 * ellipsised.
 */
export function collapseNumberRange(numbers: (number | null)[]): string {
  const owned = numbers.filter((n): n is number => n !== null);
  if (owned.length === 0) return '';
  const sorted = [...new Set(owned)].sort((a, b) => a - b);

  const parts: string[] = [];
  let runStart = sorted[0];
  let runEnd = sorted[0];

  const flush = () => {
    // Two-long runs collapse too: ticket 03 recorded the canonical rendering of
    // the Dresden gap case as `#1, 3-4, 8`, not `#1, 3, 4, 8`.
    parts.push(runStart === runEnd ? String(runStart) : `${runStart}-${runEnd}`);
  };

  for (let i = 1; i < sorted.length; i++) {
    const n = sorted[i];
    const continuesRun =
      Number.isInteger(n) && Number.isInteger(runEnd) && n === runEnd + 1;
    if (continuesRun) {
      runEnd = n;
    } else {
      flush();
      runStart = n;
      runEnd = n;
    }
  }
  flush();

  const shown = parts.slice(0, RANGE_RUN_CAP).join(', ');
  return parts.length > RANGE_RUN_CAP ? `${shown}…` : shown;
}
