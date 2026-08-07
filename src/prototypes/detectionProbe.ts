/**
 * THROWAWAY — ticket 04's dev entry point. See ./README.md.
 *
 * Runs the real assembly (`loadLibraryDetectionUnits`) and the real cascade
 * (`detectSeries`) over the DEVICE'S OWN LIBRARY and prints the result in a
 * shape that can be diffed line-for-line against the research listing at
 * `.scratch/series-ux-redesign/research/02-detection-cascade/SERIES_LISTING.txt`.
 *
 * It lives in the harness — which ticket 18 deletes wholesale — rather than in
 * `Manage Library`, because ticket 07 builds the real
 * `Detect Series in Existing Books` button there and a temporary settings row
 * would have to be un-built. Nothing here writes to the database; the write is
 * ticket 06's.
 */

import { useLibraryStore } from '@/store/library';
import { bookStructuralKey } from '@/helpers/bookStructuralKey';
import { loadLibraryDetectionUnits } from '@/db/detectionQueries';
import { detectSeries } from '@/helpers/seriesDetection';
import type { LibraryDetectionUnit } from '@/helpers/detectionUnits';
import type { ProposedSeries } from '@/helpers/seriesDetection';

/** Longest first, then A-Z — the research listing's order, so a diff lines up. */
const listingOrder = (
  a: ProposedSeries<LibraryDetectionUnit>,
  b: ProposedSeries<LibraryDetectionUnit>,
) => b.books.length - a.books.length || a.name.localeCompare(b.name);

function logListing(
  label: string,
  proposals: ProposedSeries<LibraryDetectionUnit>[],
) {
  const placed = proposals.reduce((n, s) => n + s.books.length, 0);
  console.log(
    `\n${'='.repeat(74)}\n[detect] ${label} — ` +
      `${proposals.length} series, ${placed} books placed\n${'='.repeat(74)}`,
  );

  // One log call per series, not one giant string: the Metro logger truncates,
  // and a truncated listing is worse than a long one because it looks complete.
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
          `  ${num.padStart(6)}  ${title.slice(0, 54).padEnd(54)}` +
          `  ${book.confidence.padEnd(8)} ${book.why.join(' ')}`
        );
      });
    console.log(
      `\n"${series.name}"  ${series.books.length} books\n${rows.join('\n')}`,
    );
  }
}

/**
 * Assemble, detect, and report. Both fidelities in one press, because §A3's
 * two numbers are only meaningful next to each other.
 */
export async function runDetectionProbe(): Promise<void> {
  try {
    const loaded = await loadLibraryDetectionUnits();

    console.log(
      `\n[detect] ${loaded.units.length} units from ${loaded.bookCount} books ` +
        `in ${loaded.elapsedMs}ms` +
        (loaded.outsideRoots ? ` · ${loaded.outsideRoots} OUTSIDE ROOTS` : '') +
        (loaded.keyless ? ` · ${loaded.keyless} with no chapters` : '') +
        `\n[detect] roots: ${loaded.roots.join(', ') || '(none configured)'}`,
    );

    if (loaded.outsideRoots) {
      console.warn(
        `[detect] ${loaded.outsideRoots} books sit under no configured library ` +
          `root and were dropped. An absolute rel would break the folder rules ` +
          `(depth is load-bearing), so they abstain instead.`,
      );
    }

    // Cross-check the structural keys against the library store, which derives
    // them the other way (chapters[0].url after a stable sort). A mismatch
    // means the one-query first-chapter read has drifted from
    // `bookStructuralKey`, and every membership row would be keyed wrong.
    const storeKeys = new Set(
      Object.values(useLibraryStore.getState().books)
        .map(bookStructuralKey)
        .filter((k): k is string => !!k),
    );
    const unmatched = loaded.units.filter((u) => !storeKeys.has(u.bookKey));
    console.log(
      `[detect] structural keys: ${loaded.units.length - unmatched.length}/` +
        `${loaded.units.length} agree with the library store` +
        (unmatched.length
          ? ` — MISMATCHED: ${unmatched
              .slice(0, 5)
              .map((u) => u.bookKey)
              .join(', ')}`
          : ''),
    );

    // Ticket 02's acceptance criterion: a fresh scan populates the four columns
    // at roughly the surveyed fill rates. Printed with the survey's own figures
    // beside them so the log can be read without opening the ticket. The
    // denominator is books that had a first chapter, which is what was read —
    // it equals `bookCount` unless the header reports `with no chapters`.
    const { tagFill } = loaded;
    const pct = (n: number) =>
      `${tagFill.rows ? ((n / tagFill.rows) * 100).toFixed(1) : '0.0'}%`;
    console.log(
      `[detect] tag fill over ${tagFill.rows} books — ` +
        `file_format ${pct(tagFill.fileFormat)} (~99.7) · ` +
        `series ${pct(tagFill.series)} (~6.6) · ` +
        `part ${pct(tagFill.part)} (~5.9) · ` +
        `grouping ${pct(tagFill.grouping)} (~5.6)`,
    );

    const flat = loaded.units.filter((u) => u.flat).length;
    const tagged = loaded.units.filter((u) => u.series || u.grouping).length;
    const albumless = loaded.units.filter((u) => !u.album).length;
    console.log(
      `[detect] ${flat} units in multi-book directories (flat) · ` +
        `${tagged} carry a SERIES/Grouping tag · ${albumless} have no album`,
    );

    logListing('CONSERVATIVE (tags + self-validated folders)', detectSeries(loaded.units, {}));
    logListing(
      'FULL (+ uncorroborated folders)',
      detectSeries(loaded.units, { alsoGroupByFolder: true }),
    );
  } catch (error) {
    console.error('[detect] probe failed', error);
  }
}
