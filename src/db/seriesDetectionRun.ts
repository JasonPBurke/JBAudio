/**
 * One detection run: read the library, propose series, reconcile against what
 * already exists, write the difference.
 *
 * This is the moment the feature becomes real — the user scans and their
 * Series shelf fills itself in — and it is deliberately the THIN part. Every
 * decision it appears to make was already made by a pure function:
 *
 *   loadLibraryDetectionUnits()   the whole library as units      (ticket 04)
 *     -> detectSeries()           units      -> proposals         (ticket 03)
 *     -> reconcileSeries()        proposals  -> a write plan      (ticket 05)
 *     -> applyPlan()              the plan   -> rows              (IO only)
 *
 * WHY IT CANNOT MASS-DELETE, which is the first thing to check when reading
 * this: reconcile only ever removes rows from a series that a proposal MATCHED.
 * A run that produces no proposals at all — no library roots configured, a
 * failed read, detection turned off — produces an empty plan, not an empty
 * library. There is no "everything not proposed is stale" step anywhere, and
 * there must never be one.
 *
 * Called at the END of a scan, and by ticket 07's
 * `Detect Series in Existing Books` button.
 */

import { loadLibraryDetectionUnits } from '@/db/detectionQueries';
import {
  applyPlan,
  loadExistingSeries,
  loadSuppressedSeriesNames,
} from '@/db/seriesQueries';
import { reconcileSeries } from '@/db/seriesReconcile';
import {
  getSeriesDetectionEnabled,
  getSeriesFolderGroupingEnabled,
} from '@/db/settingsQueries';
import { detectSeries } from '@/helpers/seriesDetection';
import type { LibraryDetectionUnit } from '@/helpers/detectionUnits';
import type { ProposedSeries } from '@/helpers/seriesDetection';

export type SeriesDetectionRunResult = {
  /**
   * False when the run did not complete, and `reason` says why. `'disabled'`
   * and `'no-units'` guarantee nothing was written; `'failed'` does not — the
   * throw may have come after the batch — which is why the counts on a failed
   * run are zeros meaning "unknown", not zeros meaning "no change".
   */
  ran: boolean;
  reason?: 'disabled' | 'no-units' | 'failed';
  units: number;
  proposals: number;
  /** Books placed into proposals — the coverage half of A3's two numbers. */
  placed: number;
  seriesCreated: number;
  rowsCreated: number;
  rowsInserted: number;
  rowsRemoved: number;
  skippedUserOwned: number;
  skippedSuppressed: number;
  elapsedMs: number;
};

const idle = (
  reason: SeriesDetectionRunResult['reason'],
  elapsedMs: number,
  units = 0,
): SeriesDetectionRunResult => ({
  ran: false,
  reason,
  units,
  proposals: 0,
  placed: 0,
  seriesCreated: 0,
  rowsCreated: 0,
  rowsInserted: 0,
  rowsRemoved: 0,
  skippedUserOwned: 0,
  skippedSuppressed: 0,
  elapsedMs,
});

/** Longest first, then A-Z — the research listing's order, so a log diffs. */
const listingOrder = (
  a: ProposedSeries<LibraryDetectionUnit>,
  b: ProposedSeries<LibraryDetectionUnit>,
) => b.books.length - a.books.length || a.name.localeCompare(b.name);

/**
 * A16 — the confidence tier and the `why` trail go to the log and NOWHERE
 * ELSE. They describe the algorithm, not the data: the tier's only consumer
 * was the review queue that A9 replaced with a settings toggle, and no surface
 * displays provenance. There is no column for either, and adding one is how
 * the review queue comes back by accident.
 *
 * One `console.log` per series rather than one per book, or one for the lot:
 * the Metro logger truncates a long string, and a truncated listing is worse
 * than a long one because it still looks complete.
 */
function logProposals(
  proposals: readonly ProposedSeries<LibraryDetectionUnit>[],
  outcomeOf: (name: string) => string,
): void {
  for (const series of [...proposals].sort(listingOrder)) {
    const rows = [...series.books]
      .sort(
        (a, b) =>
          (Number(a.number) || 1e9) - (Number(b.number) || 1e9) ||
          (a.unit.album ?? '').localeCompare(b.unit.album ?? ''),
      )
      .map((book) => {
        const num = book.number == null ? '—' : `#${book.number}`;
        const title = book.unit.album ?? book.unit.file ?? '(untitled)';
        return (
          `    ${num.padStart(6)}  ${title.slice(0, 54).padEnd(54)}` +
          `  ${book.confidence.padEnd(8)} ${book.why.join(' ')}`
        );
      });
    console.log(
      `[series] "${series.name}"  ${series.books.length} books  ` +
        `(${outcomeOf(series.name)})\n${rows.join('\n')}`,
    );
  }
}

/**
 * Detect series across the whole library and write the result.
 *
 * NEVER THROWS. It runs at the very end of a scan, after every book has been
 * imported and every dead row cleaned up, so a failure here must not take the
 * scan down with it — the caller would skip `endScan()` and leave the progress
 * spinner up forever over a library that is, in fact, fine. The error is
 * logged loudly and the run reports `ran: false, reason: 'failed'`.
 */
export async function runSeriesDetection(): Promise<SeriesDetectionRunResult> {
  const startedAt = Date.now();

  try {
    // A9 — OFF stops future detection and leaves existing series exactly as
    // they are. Returning before the first read is what makes that literal: a
    // preference change cannot destroy data it never looked at.
    if (!(await getSeriesDetectionEnabled())) {
      console.log('[series] detection is off — no series were read or written');
      return idle('disabled', Date.now() - startedAt);
    }

    const alsoGroupByFolder = await getSeriesFolderGroupingEnabled();
    const loaded = await loadLibraryDetectionUnits();

    if (loaded.units.length === 0) {
      // Zero units means zero proposals means an empty plan, so this early
      // return is a saved read rather than a guard — but it is worth saying
      // out loud, because a library that suddenly has no units usually means
      // the configured roots have moved.
      console.warn(
        `[series] no detection units from ${loaded.bookCount} books ` +
          `(roots: ${loaded.roots.join(', ') || 'none configured'}) — ` +
          `nothing detected, nothing changed`,
      );
      return idle('no-units', Date.now() - startedAt);
    }

    // Both counts are books that ABSTAINED rather than books that failed, and
    // both explain a series the user expected and did not get — a stale
    // library root, or the known scan-side book split. Silence here would make
    // that look like a detection fault.
    if (loaded.outsideRoots > 0 || loaded.keyless > 0) {
      console.warn(
        `[series] ${loaded.outsideRoots} books sit under no configured root ` +
          `and ${loaded.keyless} have no first chapter — all dropped before ` +
          `detection, out of ${loaded.bookCount}`,
      );
    }

    const proposals = detectSeries(loaded.units, { alsoGroupByFolder });

    const [existing, suppressed] = await Promise.all([
      loadExistingSeries(),
      loadSuppressedSeriesNames(),
    ]);

    const plan = reconcileSeries(proposals, existing, suppressed);
    const written = await applyPlan(plan);

    const createdNames = new Set(plan.createSeries.map((s) => s.name));
    const skippedReasons = new Map(plan.skipped.map((s) => [s.name, s.reason]));
    const outcomeOf = (name: string) =>
      skippedReasons.get(name) ?? (createdNames.has(name) ? 'new' : 'existing');

    const placed = proposals.reduce((n, s) => n + s.books.length, 0);
    const elapsedMs = Date.now() - startedAt;
    const fidelity = alsoGroupByFolder ? 'full' : 'conservative';

    logProposals(proposals, outcomeOf);
    console.log(
      `[series] detection (${fidelity}): ${loaded.units.length} units → ` +
        `${proposals.length} series, ${placed} books placed · ` +
        `created ${written.seriesCreated} (${written.rowsCreated} rows) · ` +
        `inserted ${written.rowsInserted} · removed ${written.rowsRemoved} · ` +
        `skipped ${plan.skipped.length} · ${elapsedMs}ms`,
    );

    return {
      ran: true,
      units: loaded.units.length,
      proposals: proposals.length,
      placed,
      seriesCreated: written.seriesCreated,
      rowsCreated: written.rowsCreated,
      rowsInserted: written.rowsInserted,
      rowsRemoved: written.rowsRemoved,
      skippedUserOwned: plan.skipped.filter((s) => s.reason === 'user-owned')
        .length,
      skippedSuppressed: plan.skipped.filter((s) => s.reason === 'suppressed')
        .length,
      elapsedMs,
    };
  } catch (error) {
    // Not "the library is unchanged": the write is one atomic batch, so it
    // either happened or it did not, and a throw after it would still land
    // here. What IS guaranteed is that the scan finishes normally.
    console.error('[series] detection failed — the scan is unaffected', error);
    return idle('failed', Date.now() - startedAt);
  }
}
