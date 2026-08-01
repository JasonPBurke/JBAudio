/**
 * THROWAWAY — Series UX redesign prototype harness (ticket 04). See ./README.md.
 *
 * Fabricates pathologically-shaped series OVER THE REAL BOOKS on the device, so
 * covers, titles, durations and progress rings all stay real while the *shape*
 * of the list gets hostile.
 *
 * Two constraints drove the design, both worth knowing before editing:
 *
 * 1. SYNTHETIC SERIES MAY ONLY REFERENCE REAL BOOK IDS. `SeriesHome` passes a
 *    bare `bookId` to `BookGridItem`, which re-resolves it out of the library
 *    store; an invented id renders as a size-accurate BLANK cell. So a 22-book
 *    series over an 8-book emulator is built by REPEATING real books, never by
 *    cloning them with fake ids. Nothing is written to the library store.
 *
 * 2. NOTHING IS WRITTEN TO THE DATABASE. Schema v32 has no column for a
 *    canonical published number, and `DerivedSeries` has no field for one — the
 *    very thing ticket 07 still has to decide. A DB-backed injector could not
 *    express the "Dresden 1, 3, 4, 8" dataset this ticket asks for. Building the
 *    rows in memory sidesteps the schema entirely AND makes "clear synthetic
 *    series" a true restore rather than a cleanup.
 */
import { Book } from '@/types/Book';
import { DerivedSeries } from '@/helpers/seriesAssembly';
import { SeriesProgressState } from '@/helpers/seriesProgress';
import { normalizeSortName } from '@/helpers/seriesName';
import type { DataPreset } from './protoStore';

/**
 * `DerivedSeries` widened with the fields the redesign is likely to need but
 * the schema cannot yet store. Variants read these; the baseline ignores them.
 */
export type ProtoSeries = DerivedSeries & {
  /** Published number per book, index-aligned with `books`. null = unknown.
   *  Decimals are real — ticket 03 found `Book 39.5` in the wild. */
  canonicalNumbers: (number | null)[];
  /** What this row exists to stress. Shown in the dev panel, never in the UI. */
  stresses: string;
};

type Spec = {
  name: string;
  /** How many book slots. Real books are cycled to fill it. */
  count: number;
  /** Offset into the book pool — series with overlapping offsets share books. */
  offset: number;
  /** Forced, not derived: the pool's real progress can't cover all three. */
  progressState: SeriesProgressState;
  /** null = "no numbering known"; otherwise index-aligned with the books. */
  numbers: (number | null)[] | null;
  stresses: string;
};

/**
 * 15 series covering every shape ticket 04 lists, plus three the prior-art
 * research (ticket 03) flagged as real: decimal numbers, numbering that does not
 * start at 1, and series with no numbering at all.
 */
const STRESS_SPECS: Spec[] = [
  {
    name: 'Discworld',
    count: 22,
    offset: 0,
    progressState: 'playing',
    numbers: range(1, 22),
    stresses: '22 books — scroll length + density; overlaps City Watch & Death',
  },
  {
    name: 'The Dresden Files',
    count: 4,
    offset: 2,
    progressState: 'playing',
    numbers: [1, 3, 4, 8],
    stresses: 'GAPS in canonical numbering — the #1, 3-4, 8 range case',
  },
  {
    name: 'Bobiverse',
    count: 1,
    offset: 5,
    progressState: 'unplayed',
    numbers: [1],
    stresses: 'degenerate single-book series',
  },
  {
    name: 'The Chronicles of Amber: The Complete Corwin and Merlin Cycles, 40th Anniversary Reading Order',
    count: 5,
    offset: 1,
    progressState: 'playing',
    numbers: range(1, 5),
    stresses: '95-char name — title truncation in header and any card',
  },
  {
    name: 'The Wheel of Time',
    count: 6,
    offset: 3,
    progressState: 'unplayed',
    numbers: range(1, 6),
    stresses: 'ALL UNPLAYED — Unplayed tab filter + count',
  },
  {
    name: 'The Expanse',
    count: 7,
    offset: 4,
    progressState: 'playing',
    numbers: range(1, 7),
    stresses: 'MIXED progress — Started tab filter + count',
  },
  {
    name: 'Foundation',
    count: 5,
    offset: 6,
    progressState: 'finished',
    numbers: range(1, 5),
    stresses: 'ALL FINISHED — Finished tab filter + count',
  },
  {
    name: 'City Watch',
    count: 6,
    offset: 0,
    progressState: 'playing',
    numbers: range(1, 6),
    stresses: 'SHARED MEMBERSHIP — same books as Discworld, different numbers',
  },
  {
    name: 'Death',
    count: 5,
    offset: 0,
    progressState: 'playing',
    numbers: range(1, 5),
    stresses: 'SHARED MEMBERSHIP — third series over the same books',
  },
  {
    name: 'Q',
    count: 2,
    offset: 7,
    progressState: 'unplayed',
    numbers: [1, 2],
    stresses: 'one-character name — minimum header width',
  },
  {
    name: 'Mistborn: Era Two',
    count: 4,
    offset: 2,
    progressState: 'finished',
    numbers: [4, 5, 6, 7],
    stresses: 'numbering does not start at 1 (era split)',
  },
  {
    name: 'The Murderbot Diaries',
    count: 9,
    offset: 1,
    progressState: 'playing',
    numbers: [1, 2, 3, 4, 4.5, 5, 6, 7, 8],
    stresses: 'DECIMAL canonical number (4.5) — ticket 03 confirmed these exist',
  },
  {
    name: 'Rivers of London',
    count: 3,
    offset: 5,
    progressState: 'unplayed',
    numbers: null,
    stresses: 'NO numbering available — the abstention case',
  },
  {
    name: 'The Laundry Files',
    count: 12,
    offset: 3,
    progressState: 'playing',
    numbers: range(1, 12),
    stresses: 'mid-size series — the common case between 1 and 22',
  },
  {
    name: 'Hyperion Cantos',
    count: 2,
    offset: 6,
    progressState: 'finished',
    numbers: [1, 2],
    stresses: 'short finished series',
  },
];

/** An ordinary library — the control. A layout that only works under stress is
 *  as wrong as one that only works when calm. */
const MINIMAL_SPECS: Spec[] = [
  {
    name: 'The Expanse',
    count: 5,
    offset: 0,
    progressState: 'playing',
    numbers: range(1, 5),
    stresses: 'ordinary in-progress series',
  },
  {
    name: 'Foundation',
    count: 3,
    offset: 2,
    progressState: 'finished',
    numbers: range(1, 3),
    stresses: 'ordinary finished series',
  },
  {
    name: 'The Wheel of Time',
    count: 6,
    offset: 4,
    progressState: 'unplayed',
    numbers: range(1, 6),
    stresses: 'ordinary untouched series',
  },
];

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}

/** Cycle the pool so a 22-slot series works over an 8-book emulator. */
function fill(pool: Book[], count: number, offset: number): Book[] {
  if (pool.length === 0) return [];
  return Array.from(
    { length: count },
    (_, i) => pool[(offset + i) % pool.length],
  );
}

function toProtoSeries(spec: Spec, pool: Book[]): ProtoSeries {
  const books = fill(pool, spec.count, spec.offset);
  return {
    // `proto:` prefix keeps synthetic ids from ever colliding with real series
    // ids in the expanded-sections Set the library screen holds.
    id: `proto:${normalizeSortName(spec.name)}`,
    name: spec.name,
    books,
    progressState: spec.progressState,
    canonicalNumbers: books.map((_, i) => spec.numbers?.[i] ?? null),
    stresses: spec.stresses,
  };
}

/**
 * Build the synthetic series list for a preset. Returns A-Z by sort name, which
 * is the order `assembleDerivedSeries` produces for real data — so a variant
 * cannot accidentally depend on synthetic ordering.
 */
export function buildSyntheticSeries(
  pool: Book[],
  preset: DataPreset,
): ProtoSeries[] {
  if (preset === 'off' || pool.length === 0) return [];
  const specs = preset === 'stress' ? STRESS_SPECS : MINIMAL_SPECS;
  return specs
    .map((spec) => toProtoSeries(spec, pool))
    .sort((a, b) =>
      normalizeSortName(a.name).localeCompare(normalizeSortName(b.name)),
    );
}

/**
 * Collapse a canonical-number list to the range notation every app surveyed in
 * ticket 03 uses: `1, 3-4, 8`. Nulls are dropped; nothing is placeholdered for
 * un-owned books (ticket 03: no app anywhere does that). Only consecutive
 * INTEGERS collapse — 4, 4.5, 5 stays spelled out, because a range would claim
 * the user owns something they may not.
 */
export function collapseNumberRange(
  numbers: (number | null)[],
): string {
  const owned = numbers.filter((n): n is number => n !== null);
  if (owned.length === 0) return '';
  const sorted = [...new Set(owned)].sort((a, b) => a - b);

  const parts: string[] = [];
  let runStart = sorted[0];
  let runEnd = sorted[0];

  const flush = () => {
    if (runStart === runEnd) parts.push(String(runStart));
    // Two-long runs collapse too: ticket 03 recorded the canonical rendering of
    // the Dresden gap case as `#1, 3-4, 8`, not `#1, 3, 4, 8`.
    else parts.push(`${runStart}-${runEnd}`);
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
  return parts.join(', ');
}
