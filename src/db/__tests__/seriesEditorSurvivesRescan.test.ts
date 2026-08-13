/**
 * §D9.1 — the editor's writes agree with the reconcile contract.
 *
 * Both halves are pure, so the promise this ticket exists to keep — *a user's
 * edit survives the next scan* — is expressible as one composition:
 *
 *     editor plan -> apply -> reconcile plan -> apply -> assert
 *
 * The two in-memory appliers below are the point of the exercise. They are the
 * contract `seriesQueries.updateSeries` and `seriesQueries.applyPlan` hold to:
 * both write their plan VERBATIM and decide nothing, which is what lets a
 * rescan be tested at all without an SQLite adapter.
 */

import { planEditorSave } from '@/db/seriesEditorSave';
import { reconcileSeries } from '@/db/seriesReconcile';
import type {
  ExistingMember,
  ExistingSeries,
  KeyedUnit,
  ReconcilePlan,
} from '@/db/seriesReconcile';
import { resolveMembership } from '@/db/seriesProvenance';
import type { ProposedSeries } from '@/helpers/seriesDetection';

/* ------------------------------------------------------------- fixtures --- */

function detectedSeries(
  name: string,
  bookKeys: string[],
  overrides: Partial<ExistingSeries> = {},
): ExistingSeries {
  return {
    id: 's1',
    name,
    origin: 'detected',
    nameSource: 'detected',
    books: bookKeys.map((bookKey, position) => ({
      bookKey,
      position,
      canonicalNumber: position + 1,
      canonicalSource: 'detected',
      membership: 'detected',
    })),
    ...overrides,
  };
}

/** A proposal in the shape `detectSeries` emits one. */
function proposal(name: string, bookKeys: string[]): ProposedSeries<KeyedUnit> {
  return {
    name,
    key: name.toLowerCase(),
    books: bookKeys.map((bookKey, i) => ({
      unit: { rel: `d/${bookKey}`, bookKey } as KeyedUnit,
      number: String(i + 1),
      why: ['test'],
      confidence: 'certain' as const,
    })),
  };
}

/** The books a surface would draw: A11's tombstones are invisible. */
function visible(series: ExistingSeries): string[] {
  return series.books
    .filter((r) => resolveMembership(r.membership) !== 'excluded')
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((r) => r.bookKey);
}

/* ------------------------------------------------------------- appliers --- */

/**
 * What `updateSeries` must do, in memory: apply the plan and decide nothing.
 * Note there is no branch here that removes a row — because the plan has no
 * verb for one.
 */
function applyEditorSave(
  before: ExistingSeries,
  desiredKeysInOrder: string[],
  desiredName: string,
  canonicalNumbers?: (number | null)[],
): ExistingSeries {
  const plan = planEditorSave({
    existing: before.books,
    desiredKeysInOrder,
    canonicalNumbers:
      canonicalNumbers ??
      desiredKeysInOrder.map(
        (key) => before.books.find((r) => r.bookKey === key)?.canonicalNumber ?? null,
      ),
    storedName: before.name,
    desiredName,
  });
  const books: ExistingMember[] = before.books.map((row) => {
    const update = plan.updateRows.find((u) => u.bookKey === row.bookKey);
    return update ? { ...row, ...update } : row;
  });
  for (const insert of plan.insertRows) books.push({ ...insert });

  return {
    ...before,
    name: desiredName,
    nameSource: plan.nameSource ?? before.nameSource,
    books,
  };
}

/** What `applyPlan` must do, in memory. Same contract, same reason. */
function applyReconcile(
  before: ExistingSeries[],
  plan: ReconcilePlan,
): ExistingSeries[] {
  const after = before.map((s) => ({ ...s, books: [...s.books] }));
  const byId = new Map(after.map((s) => [s.id, s]));

  plan.createSeries.forEach((created, i) =>
    after.push({
      id: `new-${i}`,
      name: created.name,
      origin: created.origin,
      nameSource: created.nameSource,
      books: created.books.map((b) => ({ ...b })),
    }),
  );
  for (const row of plan.insertRows) {
    const { seriesId, ...member } = row;
    byId.get(seriesId)?.books.push({ ...member });
  }
  for (const row of plan.removeRows) {
    const series = byId.get(row.seriesId);
    if (!series) continue;
    series.books = series.books.filter((b) => b.bookKey !== row.bookKey);
  }
  return after;
}

/** One scan of a library that still holds every book the series ever had. */
function rescan(
  library: ExistingSeries[],
  proposals: ProposedSeries<KeyedUnit>[],
  suppressed: string[] = [],
): ExistingSeries[] {
  return applyReconcile(
    library,
    reconcileSeries(proposals, library, suppressed),
  );
}

/* ---------------------------------------------------------------- tests --- */

describe('a removal survives the rescan', () => {
  test('a book the user removed does not come back', () => {
    const edited = applyEditorSave(
      detectedSeries('Discworld', ['a', 'b', 'c']),
      ['a', 'b'],
      'Discworld',
    );

    const [after] = rescan([edited], [proposal('Discworld', ['a', 'b', 'c'])]);

    expect(visible(after)).toEqual(['a', 'b']);
  });

  test('and it does not come back on the scan after that either', () => {
    let library = [
      applyEditorSave(
        detectedSeries('Discworld', ['a', 'b', 'c']),
        ['a', 'b'],
        'Discworld',
      ),
    ];
    const proposals = [proposal('Discworld', ['a', 'b', 'c'])];

    library = rescan(library, proposals);
    library = rescan(library, proposals);

    expect(library.length).toBe(1);
    expect(visible(library[0])).toEqual(['a', 'b']);
  });

  test('a book that arrives later still arrives', () => {
    const edited = applyEditorSave(
      detectedSeries('Discworld', ['a', 'b', 'c']),
      ['a', 'b'],
      'Discworld',
    );

    const [after] = rescan(
      [edited],
      [proposal('Discworld', ['a', 'b', 'c', 'd'])],
    );

    expect(visible(after)).toEqual(['a', 'b', 'd']);
  });
});

describe('a rename survives the rescan', () => {
  test('the machine name does not come back, and no duplicate is created', () => {
    const renamed = applyEditorSave(
      detectedSeries('Discworld', ['a', 'b', 'c']),
      ['a', 'b', 'c'],
      'Sam Vimes books',
    );

    const library = rescan([renamed], [proposal('Discworld', ['a', 'b', 'c'])]);

    expect(library.length).toBe(1);
    expect(library[0].name).toBe('Sam Vimes books');
  });

  test('new books keep being added to the renamed series', () => {
    const renamed = applyEditorSave(
      detectedSeries('Discworld', ['a', 'b', 'c']),
      ['a', 'b', 'c'],
      'Sam Vimes books',
    );

    const library = rescan(
      [renamed],
      [proposal('Discworld', ['a', 'b', 'c', 'd'])],
    );

    expect(library.length).toBe(1);
    expect(visible(library[0])).toEqual(['a', 'b', 'c', 'd']);
  });

  /*
   * A10a's live defect, from the other side: continuity counts EVERY row,
   * tombstones included. A series that was renamed AND had a book removed is
   * matched on the strength of the tombstone — and if it were not, the
   * re-created duplicate would carry the removed book straight back in.
   */
  test('a series that was renamed AND edited keeps both edits', () => {
    const edited = applyEditorSave(
      detectedSeries('Discworld', ['a', 'b', 'c']),
      ['a', 'b'],
      'Sam Vimes books',
    );

    const library = rescan([edited], [proposal('Discworld', ['a', 'b', 'c'])]);

    expect(library.length).toBe(1);
    expect(library[0].name).toBe('Sam Vimes books');
    expect(visible(library[0])).toEqual(['a', 'b']);
  });
});

describe('a hand-ordering survives the rescan', () => {
  test('the order the user dragged is the order after a rescan', () => {
    const reordered = applyEditorSave(
      detectedSeries('Discworld', ['a', 'b', 'c']),
      ['c', 'a', 'b'],
      'Discworld',
    );
    expect(visible(reordered)).toEqual(['c', 'a', 'b']);

    const [after] = rescan(
      [reordered],
      [proposal('Discworld', ['a', 'b', 'c'])],
    );

    expect(visible(after)).toEqual(['c', 'a', 'b']);
  });
});

describe('a hand-made series is never touched by detection', () => {
  const handMade: ExistingSeries = {
    id: 's1',
    name: 'Bedtime',
    origin: 'user',
    nameSource: 'user',
    books: [
      { bookKey: 'a', position: 0, membership: 'user' },
      { bookKey: 'b', position: 1, membership: 'user' },
    ],
  };

  test('a proposal that shares its name is skipped whole', () => {
    const plan = reconcileSeries([proposal('Bedtime', ['a', 'b', 'z'])], [handMade], []);

    expect(plan.skipped).toEqual([{ name: 'Bedtime', reason: 'user-owned' }]);
    expect(plan.insertRows).toEqual([]);
    expect(plan.removeRows).toEqual([]);
  });

  test('a proposal that shares its BOOKS builds its own series instead', () => {
    const library = rescan([handMade], [proposal('Discworld', ['a', 'b'])]);

    expect(library.length).toBe(2);
    expect(visible(library[0])).toEqual(['a', 'b']);
    expect(library[0].name).toBe('Bedtime');
    expect(library[1].name).toBe('Discworld');
  });

  test('an edit to a hand-made series leaves it hand-made', () => {
    const edited = applyEditorSave(handMade, ['a', 'b', 'c'], 'Bedtime stories');

    expect(edited.origin).toBe('user');
    const library = rescan([edited], [proposal('Bedtime stories', ['a', 'b'])]);
    expect(library[0].origin).toBe('user');
    expect(visible(library[0])).toEqual(['a', 'b', 'c']);
  });
});
