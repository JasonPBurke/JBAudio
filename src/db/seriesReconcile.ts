/**
 * A10 — the reconcile decision, as a pure function. Extracted from the query
 * layer for the same reason `seriesMembershipDiff` was: so it can be unit
 * tested without importing the native SQLite adapter. Imports nothing from
 * `@/db` and nothing from React Native.
 *
 * `seriesQueries.applyPlan(plan)` is the IO half and MUST NOT make decisions —
 * if a conditional appears there, it belongs here.
 */

import { isSameSeriesName, normalizeSortName } from '@/helpers/seriesName';
import type { DetectionUnit, ProposedSeries } from '@/helpers/seriesDetection';

/** The unit shape reconcile needs: a detection unit that knows its book key. */
export type KeyedUnit = DetectionUnit & { bookKey: string };

/**
 * A `series_books` row as read from the DB. Every provenance column is
 * nullable (G5) — that is not a migration nicety, it is the state real rows
 * are in the moment v33 lands, because append-only means nothing is wiped.
 */
export type ExistingMember = {
  bookKey: string;
  position: number;
  canonicalNumber?: number | null;
  /** G5 — the ONE column that does not coalesce; null means "no number set". */
  canonicalSource?: string | null;
  /** 'detected' | 'user' | 'excluded'; null reads as 'user'. */
  membership?: string | null;
};

/** A `series` row plus its membership rows. */
export type ExistingSeries = {
  id: string;
  name: string;
  /** 'detected' | 'user'; null reads as 'user'. */
  origin?: string | null;
  /** 'detected' | 'user'; null reads as 'user'. Provenance of `name`. */
  nameSource?: string | null;
  books: ExistingMember[];
};

/** A membership row to write. `applyPlan` copies these fields verbatim. */
export type PlannedMember = {
  bookKey: string;
  position: number;
  canonicalNumber: number | null;
  canonicalSource: 'detected' | null;
  membership: 'detected';
};

export type PlannedSeries = {
  name: string;
  origin: 'detected';
  nameSource: 'detected';
  books: PlannedMember[];
};

export type ReconcilePlan = {
  createSeries: PlannedSeries[];
  insertRows: (PlannedMember & { seriesId: string })[];
  removeRows: { seriesId: string; bookKey: string }[];
  skipped: { name: string; reason: 'user-owned' | 'suppressed' }[];
};

/**
 * D3 — `canonical_number` is a nullable NUMBER, so the detector's normalised
 * string only becomes one when it is fully numeric. `14b` and `1-3` are
 * dropped rather than coerced: `parseFloat('14b')` is 14, which would file an
 * omnibus alongside book 14 as if it were book 14. D5 settled that trade
 * already — blank beats misleading.
 */
function toCanonicalNumber(raw: string | null): number | null {
  if (raw == null) return null;
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return null;
  return Number(raw);
}

/**
 * G5 — `origin`, `name_source` and `membership` all coalesce null -> 'user'.
 * The direction is abstention bias applied to the schema: a row wrongly read
 * as 'user' is merely never auto-updated, while a row wrongly read as
 * 'detected' is eligible for regeneration to clobber. This is live code from
 * day one — append-only means emulators are never wiped, so rows carrying
 * null in every new column exist the moment v33 lands.
 *
 * `canonical_source` is deliberately NOT passed through here: null there means
 * "no number is set", not "the user set it".
 */
function coalesceToUser(value: string | null | undefined): string {
  return value ?? 'user';
}

type Candidate = { bookKey: string; canonicalNumber: number | null };

/**
 * Seed order, using D4's rule so a seeded series and a `Sort by number` press
 * agree: numerically ascending, NULLS LAST, stable within each group.
 */
function seedOrder(candidates: Candidate[]): Candidate[] {
  return candidates
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      const an = a.c.canonicalNumber;
      const bn = b.c.canonicalNumber;
      if (an == null && bn == null) return a.i - b.i;
      if (an == null) return 1;
      if (bn == null) return -1;
      return an === bn ? a.i - b.i : an - bn;
    })
    .map(({ c }) => c);
}

function toMember(c: Candidate, position: number): PlannedMember {
  return {
    bookKey: c.bookKey,
    position,
    canonicalNumber: c.canonicalNumber,
    canonicalSource: c.canonicalNumber == null ? null : ('detected' as const),
    membership: 'detected' as const,
  };
}

type Anchor = { position: number; canonicalNumber: number };

/**
 * A10 — "insert, seed position from canonical", under the hard constraint that
 * NO EXISTING ROW MAY MOVE. That rules out renumbering to open a slot, so a
 * new row takes a position BETWEEN its neighbours: fractional if need be.
 *
 * Anchors are held in POSITION order, not number order, so a series the user
 * has hand-ordered is read as the sequence they see rather than the sequence
 * the numbers imply. The result there is arbitrary but harmless — a new row
 * lands somewhere and nothing else shifts. In the common case, an untouched
 * detected series still in number order, it is simply correct: book 3 arrives
 * between 2 and 4 instead of at the end.
 *
 * The fractions are not load-bearing. The editor's save path renumbers every
 * row to its index, so they normalise away on first edit — preserving the
 * order they produced.
 */
function seedInsertPositions(
  newRows: Candidate[],
  existingRows: readonly ExistingMember[],
): PlannedMember[] {
  // Excluded rows are invisible, so they must not act as anchors — but their
  // positions still count towards the append point, so an insert cannot land
  // on top of one.
  const anchors: Anchor[] = existingRows
    .filter(
      (r) =>
        coalesceToUser(r.membership) !== 'excluded' && r.canonicalNumber != null,
    )
    .map((r) => ({ position: r.position, canonicalNumber: r.canonicalNumber! }))
    .sort((a, b) => a.position - b.position);

  const positions = existingRows.map((r) => r.position);
  let maxPosition = positions.length ? Math.max(...positions) : -1;
  const minPosition = positions.length ? Math.min(...positions) : 0;

  const planned: PlannedMember[] = [];

  for (const candidate of seedOrder(newRows)) {
    const n = candidate.canonicalNumber;
    let position: number;

    if (n == null) {
      position = ++maxPosition;
    } else {
      const at = anchors.findIndex((a) => a.canonicalNumber > n);
      if (at === -1) {
        position = ++maxPosition;
      } else if (at === 0) {
        position = Math.min(minPosition, anchors[0].position) - 1;
      } else {
        position = (anchors[at - 1].position + anchors[at].position) / 2;
      }
      // Later new rows interleave against this one too, so a run of arrivals
      // lands in canonical order rather than all sharing one gap.
      anchors.splice(at === -1 ? anchors.length : at, 0, {
        position,
        canonicalNumber: n,
      });
    }

    maxPosition = Math.max(maxPosition, position);
    planned.push(toMember(candidate, position));
  }

  return planned;
}

function plannedMembers(candidates: Candidate[]): PlannedMember[] {
  return seedOrder(candidates).map((c, position) => ({
    bookKey: c.bookKey,
    position,
    canonicalNumber: c.canonicalNumber,
    canonicalSource: c.canonicalNumber == null ? null : ('detected' as const),
    membership: 'detected' as const,
  }));
}

/**
 * A13 — the suppression rows that hand-creating `name` must delete. Detection
 * consults `suppressed_series` before creating anything, so a name left in
 * there after the user has deliberately re-made that series would shadow their
 * own work with an invisible veto.
 *
 * Returns EVERY match, not the first: G7 records that this DB library has no
 * unique-constraint support anywhere, so a double-delete can genuinely leave
 * two rows, and clearing one would leave the veto standing.
 *
 * The row-shaped twin of this — the one the query layer actually writes
 * through — is `suppressionsMatching` in `seriesSuppression`. Both ask
 * `isSameSeriesName`, so they cannot disagree about what counts as a match.
 */
export function suppressionsClearedByCreating(
  name: string,
  suppressedNames: readonly string[],
): string[] {
  return suppressedNames.filter((n) => isSameSeriesName(n, name));
}

/**
 * The existing series a proposal is a continuation OF, when it no longer
 * answers to its detected name — which is what a user rename looks like from
 * in here. Matched on shared book keys, and only ever against a series that
 * detection itself created.
 *
 * This is NOT a second identity, and A15 still stands: nothing here is shown
 * to the user, nothing merges, and two series never become one. It answers one
 * internal question — "is this proposal the series I already made?" — so that
 * renaming a series does not cost the user automatic membership.
 *
 * Two conditions, and both earn their keep:
 *   - at least TWO books in common, so a single shared book cannot glue an
 *     unrelated proposal onto a small series;
 *   - more than half the series' rows, so the claim is "this proposal IS that
 *     series now", not "it overlaps it". When A4's edition check splits an
 *     80-book series into 41 and 39, the 41 continues it and the 39 becomes
 *     its own — the right shape for a split.
 *
 * Overlap counts EVERY row, tombstones included. An 'excluded' row is the
 * series' memory of a book, and detection keeps proposing excluded books
 * because exclusions never reach the detector — so the tombstones are exactly
 * the evidence that this proposal is that series. Counting only visible rows
 * loses a renamed series that carries a few, and the consequence is not a
 * cosmetic duplicate: the re-created series carries the excluded books back
 * in, walking straight through A11.
 *
 * The threshold is deliberately strict rather than generous, because the two
 * failures are not symmetrical. Matching too eagerly hands a proposal a series
 * it is not, and every detected row that proposal lacks is then removed.
 * Matching too reluctantly leaves a duplicate series, which is annoying and
 * entirely recoverable.
 */
function continuationOf(
  proposal: ProposedSeries<KeyedUnit>,
  existingSeries: readonly ExistingSeries[],
  claimed: ReadonlySet<string>,
): ExistingSeries | undefined {
  const proposed = new Set(proposal.books.map((b) => b.unit.bookKey));

  let best: ExistingSeries | undefined;
  let bestOverlap = 0;

  for (const series of existingSeries) {
    if (claimed.has(series.id)) continue;
    // Only detection's own work is regeneration's to continue.
    if (coalesceToUser(series.origin) !== 'detected') continue;

    const overlap = series.books.filter((r) => proposed.has(r.bookKey)).length;

    if (overlap < 2 || overlap * 2 <= series.books.length) continue;
    if (overlap > bestOverlap) {
      best = series;
      bestOverlap = overlap;
    }
  }

  return best;
}

/**
 * Decide exactly what to write, given fresh proposals, the rows that already
 * exist, and the names the user has deliberately deleted.
 */
export function reconcileSeries(
  proposals: readonly ProposedSeries<KeyedUnit>[],
  existingSeries: readonly ExistingSeries[],
  suppressedNames: readonly string[],
): ReconcilePlan {
  const plan: ReconcilePlan = {
    createSeries: [],
    insertRows: [],
    removeRows: [],
    skipped: [],
  };

  // A15 — identity is `name` alone, compared on the app's one key, the same
  // one `isDuplicateSeriesName` and the `sort_name` column use.
  const suppressed = new Set(suppressedNames.map(normalizeSortName));

  // First match wins. A second row under one key cannot arise through the app
  // — the duplicate-name check blocks hand-creates and A15 disambiguates
  // detected names — but picking deterministically beats picking arbitrarily.
  const byName = new Map<string, ExistingSeries>();
  for (const s of existingSeries) {
    const key = normalizeSortName(s.name);
    if (!byName.has(key)) byName.set(key, s);
  }

  // Pass 1 — claim by name, and drop anything suppressed.
  const live: { proposal: ProposedSeries<KeyedUnit>; match?: ExistingSeries }[] =
    [];
  const claimed = new Set<string>();

  for (const proposal of proposals) {
    const key = normalizeSortName(proposal.name);
    if (suppressed.has(key)) {
      plan.skipped.push({ name: proposal.name, reason: 'suppressed' });
      continue;
    }

    const named = byName.get(key);
    if (named) {
      if (coalesceToUser(named.origin) === 'user') {
        // A10 — `origin = 'user'` skips the series ENTIRELY. Not the name, not
        // membership, not a number: the row's existence is the user's, and
        // regeneration has no claim on anything inside it.
        plan.skipped.push({ name: proposal.name, reason: 'user-owned' });
        continue;
      }
      claimed.add(named.id);
      live.push({ proposal, match: named });
    } else {
      live.push({ proposal });
    }
  }

  // Pass 2 — continuity for the series that no longer answer to their detected
  // name, which is every series the user has renamed. Without this, a rename
  // ends the relationship: the next scan re-creates the old name from the same
  // books and every one of them sits in two series at once.
  for (const entry of live) {
    if (entry.match) continue;
    entry.match = continuationOf(entry.proposal, existingSeries, claimed);
    if (entry.match) claimed.add(entry.match.id);
  }

  for (const { proposal, match } of live) {
    if (match) {
      const detectedKeys = new Set(proposal.books.map((b) => b.unit.bookKey));
      // A11 — ANY existing row means the book is not new, and that includes an
      // 'excluded' tombstone. The tombstone is the whole mechanism: without it
      // a user removes four books from a wrong merge, rescans, and gets all
      // four back.
      const settledKeys = new Set(match.books.map((r) => r.bookKey));

      const arrivals = proposal.books
        .filter((b) => !settledKeys.has(b.unit.bookKey))
        .map((b) => ({
          bookKey: b.unit.bookKey,
          canonicalNumber: toCanonicalNumber(b.number),
        }));

      for (const row of seedInsertPositions(arrivals, match.books)) {
        plan.insertRows.push({ seriesId: match.id, ...row });
      }

      for (const row of match.books) {
        // Only a DETECTED row is regeneration's to take back. A 'user' row —
        // including one read as 'user' because its column is null — is the
        // user's own membership decision, and an 'excluded' row is A11's
        // tombstone, which must outlive every rescan.
        if (coalesceToUser(row.membership) !== 'detected') continue;
        if (!detectedKeys.has(row.bookKey)) {
          plan.removeRows.push({ seriesId: match.id, bookKey: row.bookKey });
        }
      }

      continue;
    }

    plan.createSeries.push({
      name: proposal.name,
      origin: 'detected',
      nameSource: 'detected',
      books: plannedMembers(
        proposal.books.map((b) => ({
          bookKey: b.unit.bookKey,
          canonicalNumber: toCanonicalNumber(b.number),
        })),
      ),
    });
  }

  return plan;
}
