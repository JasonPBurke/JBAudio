import {
  reconcileSeries,
  suppressionsClearedByCreating,
} from '@/db/seriesReconcile';
import type { ProposedSeries } from '@/helpers/seriesDetection';
import type { ExistingSeries, ReconcilePlan } from '@/db/seriesReconcile';

type Keyed = { rel: string; bookKey: string };

/**
 * Build a proposal the way `detectSeries` emits one. `books` is a list of
 * `[bookKey, number]` pairs, where `number` is the RAW normalised string the
 * detector produces (`'2'`, `'14b'`, `null`) — not a parsed number.
 */
function proposal(
  name: string,
  books: [string, string | null][],
): ProposedSeries<Keyed> {
  return {
    name,
    key: name.toLowerCase(),
    books: books.map(([bookKey, number]) => ({
      unit: { rel: `d/${bookKey}`, bookKey },
      number,
      why: ['test'],
      confidence: 'certain' as const,
    })),
  };
}

/**
 * The order the series will DISPLAY in once the plan is applied — `position`
 * keeps sole sort authority. Asserting this rather than a raw position value
 * pins the behaviour and leaves the arithmetic free to change.
 */
function orderAfter(
  before: ExistingSeries,
  inserts: { seriesId: string; bookKey: string; position: number }[],
  removed: { seriesId: string; bookKey: string }[] = [],
): string[] {
  const gone = new Set(removed.map((r) => r.bookKey));
  return [
    ...before.books.filter((b) => !gone.has(b.bookKey)),
    ...inserts.filter((i) => i.seriesId === before.id),
  ]
    .sort((a, b) => a.position - b.position)
    .map((b) => b.bookKey);
}

/**
 * What `seriesQueries.applyPlan` must do, in memory. It writes the plan
 * verbatim and decides nothing — which is the contract 06 has to hold to, and
 * the reason idempotence can be tested here at all.
 */
function applyPlan(before: ExistingSeries[], plan: ReconcilePlan): ExistingSeries[] {
  const after = before.map((s) => ({ ...s, books: [...s.books] }));
  const byId = new Map(after.map((s) => [s.id, s]));

  plan.createSeries.forEach((created, i) => {
    const row: ExistingSeries = {
      id: `new${i}`,
      name: created.name,
      origin: created.origin,
      nameSource: created.nameSource,
      books: created.books.map((b) => ({ ...b })),
    };
    after.push(row);
    byId.set(row.id, row);
  });

  for (const row of plan.insertRows) {
    const { seriesId, ...member } = row;
    byId.get(seriesId)?.books.push({ ...member });
  }

  for (const row of plan.removeRows) {
    const series = byId.get(row.seriesId);
    if (series) {
      series.books = series.books.filter((b) => b.bookKey !== row.bookKey);
    }
  }

  return after;
}

/** Build an existing series row + its membership rows. */
function existing(
  over: Partial<ExistingSeries> & Pick<ExistingSeries, 'id' | 'name'>,
): ExistingSeries {
  return { origin: 'detected', nameSource: 'detected', books: [], ...over };
}

test('a proposal with no existing series is created, ordered by canonical number', () => {
  const plan = reconcileSeries([proposal('Discworld', [['b2', '2'], ['b1', '1']])], [], []);

  expect(plan.createSeries).toEqual([
    {
      name: 'Discworld',
      origin: 'detected',
      nameSource: 'detected',
      books: [
        { bookKey: 'b1', position: 0, canonicalNumber: 1, canonicalSource: 'detected', membership: 'detected' },
        { bookKey: 'b2', position: 1, canonicalNumber: 2, canonicalSource: 'detected', membership: 'detected' },
      ],
    },
  ]);
  expect(plan.insertRows).toEqual([]);
  expect(plan.removeRows).toEqual([]);
  expect(plan.skipped).toEqual([]);
});

describe('A13 — suppression is consulted before creating', () => {
  test('a suppressed name is never created', () => {
    const plan = reconcileSeries(
      [proposal('Discworld', [['b1', '1'], ['b2', '2']])],
      [],
      ['Discworld'],
    );

    expect(plan.createSeries).toEqual([]);
    expect(plan.skipped).toEqual([{ name: 'Discworld', reason: 'suppressed' }]);
  });

  test('suppression matches on the same key the duplicate-name check uses', () => {
    // A15 — identity is `name` alone, and the app's one comparison key is
    // trimmed + case-folded. A suppression that only blocked an exact-case
    // match would be silently bypassed by a rescan that re-cased the name.
    const plan = reconcileSeries(
      [proposal('Discworld', [['b1', '1'], ['b2', '2']])],
      [],
      ['  discworld  '],
    );

    expect(plan.createSeries).toEqual([]);
    expect(plan.skipped).toEqual([{ name: 'Discworld', reason: 'suppressed' }]);
  });
});

test("origin = 'user' skips the series entirely, even when detection proposes its name", () => {
  const plan = reconcileSeries(
    // Detection would add b2 and b3, and would drop b9 as no longer detected.
    [proposal('My Playlist', [['b1', '1'], ['b2', '2'], ['b3', '3']])],
    [
      existing({
        id: 's1',
        name: 'My Playlist',
        origin: 'user',
        nameSource: 'user',
        books: [
          { bookKey: 'b1', position: 0, membership: 'user' },
          { bookKey: 'b9', position: 1, membership: 'user' },
        ],
      }),
    ],
    [],
  );

  // No insert, no remove, no rename, and NOT re-created under a second row.
  expect(plan.createSeries).toEqual([]);
  expect(plan.insertRows).toEqual([]);
  expect(plan.removeRows).toEqual([]);
  expect(plan.skipped).toEqual([{ name: 'My Playlist', reason: 'user-owned' }]);
});

describe('A10 — the five-line contract, per row', () => {
  test('a still-detected, still-valid row is LEFT ALONE, position intact', () => {
    // Positions 5 and 9, out of number order: this is what hand-ordering looks
    // like once the user has dragged rows about. Canonical seeds `position`
    // only at create and at insert — it must NEVER re-seed an existing row, or
    // hand-ordering silently reverts on the next scan.
    const plan = reconcileSeries(
      [proposal('Discworld', [['b1', '1'], ['b2', '2']])],
      [
        existing({
          id: 's1',
          name: 'Discworld',
          books: [
            { bookKey: 'b2', position: 5, canonicalNumber: 2, canonicalSource: 'detected', membership: 'detected' },
            { bookKey: 'b1', position: 9, canonicalNumber: 1, canonicalSource: 'detected', membership: 'detected' },
          ],
        }),
      ],
      [],
    );

    expect(plan).toEqual({
      createSeries: [],
      insertRows: [],
      removeRows: [],
      skipped: [],
    });
  });

  test('a detected row that is no longer detected is removed', () => {
    const plan = reconcileSeries(
      [proposal('Discworld', [['b1', '1'], ['b2', '2']])],
      [
        existing({
          id: 's1',
          name: 'Discworld',
          books: [
            { bookKey: 'b1', position: 0, membership: 'detected' },
            { bookKey: 'b2', position: 1, membership: 'detected' },
            { bookKey: 'gone', position: 2, membership: 'detected' },
          ],
        }),
      ],
      [],
    );

    expect(plan.removeRows).toEqual([{ seriesId: 's1', bookKey: 'gone' }]);
    expect(plan.insertRows).toEqual([]);
  });

  test('a row the USER added is never removed, however loudly detection disagrees', () => {
    // Per-aspect ownership: the user owning one membership row does not hand
    // regeneration a claim on it just because the series as a whole is
    // detected. This is the commonest repair there is — adding the one book
    // detection missed — and a rescan must not undo it.
    const plan = reconcileSeries(
      [proposal('Discworld', [['b1', '1'], ['b2', '2']])],
      [
        existing({
          id: 's1',
          name: 'Discworld',
          books: [
            { bookKey: 'b1', position: 0, membership: 'detected' },
            { bookKey: 'b2', position: 1, membership: 'detected' },
            { bookKey: 'handAdded', position: 2, membership: 'user' },
          ],
        }),
      ],
      [],
    );

    expect(plan.removeRows).toEqual([]);
  });

  test('a newly detected book is inserted, seeded into canonical order', () => {
    const before = existing({
      id: 's1',
      name: 'Discworld',
      books: [
        { bookKey: 'b1', position: 0, canonicalNumber: 1, canonicalSource: 'detected', membership: 'detected' },
        { bookKey: 'b4', position: 1, canonicalNumber: 4, canonicalSource: 'detected', membership: 'detected' },
      ],
    });

    const plan = reconcileSeries(
      [proposal('Discworld', [['b1', '1'], ['b2', '2'], ['b4', '4']])],
      [before],
      [],
    );

    expect(plan.insertRows).toEqual([
      {
        seriesId: 's1',
        bookKey: 'b2',
        position: expect.any(Number),
        canonicalNumber: 2,
        canonicalSource: 'detected',
        membership: 'detected',
      },
    ]);
    // Book 2 lands between 1 and 4, and no existing row had to move to allow it.
    expect(orderAfter(before, plan.insertRows)).toEqual(['b1', 'b2', 'b4']);
    expect(plan.removeRows).toEqual([]);
  });

  test('several new books interleave with each other and with what is there', () => {
    const before = existing({
      id: 's1',
      name: 'Discworld',
      books: [
        { bookKey: 'b1', position: 0, canonicalNumber: 1, canonicalSource: 'detected', membership: 'detected' },
        { bookKey: 'b5', position: 1, canonicalNumber: 5, canonicalSource: 'detected', membership: 'detected' },
      ],
    });

    const plan = reconcileSeries(
      [
        proposal('Discworld', [
          ['b1', '1'],
          ['b3', '3'],
          ['b5', '5'],
          ['b2', '2'],
          ['b7', '7'],
        ]),
      ],
      [before],
      [],
    );

    expect(orderAfter(before, plan.insertRows)).toEqual([
      'b1',
      'b2',
      'b3',
      'b5',
      'b7',
    ]);
  });

  test('an unnumbered new book appends rather than guessing', () => {
    const before = existing({
      id: 's1',
      name: 'Discworld',
      books: [
        { bookKey: 'b1', position: 0, canonicalNumber: 1, canonicalSource: 'detected', membership: 'detected' },
        { bookKey: 'b4', position: 1, canonicalNumber: 4, canonicalSource: 'detected', membership: 'detected' },
      ],
    });

    const plan = reconcileSeries(
      [proposal('Discworld', [['b1', '1'], ['b4', '4'], ['bx', null]])],
      [before],
      [],
    );

    expect(plan.insertRows[0]).toMatchObject({
      bookKey: 'bx',
      canonicalNumber: null,
      // G5 — no number set, so no provenance to record for one.
      canonicalSource: null,
    });
    expect(orderAfter(before, plan.insertRows)).toEqual(['b1', 'b4', 'bx']);
  });

  test('hand-ordering is never disturbed to make room for an insert', () => {
    // The user dragged book 4 above book 1. A new book 2 must not be an excuse
    // to "correct" that — no existing row may be re-seeded, ever.
    const before = existing({
      id: 's1',
      name: 'Discworld',
      books: [
        { bookKey: 'b4', position: 0, canonicalNumber: 4, canonicalSource: 'detected', membership: 'detected' },
        { bookKey: 'b1', position: 1, canonicalNumber: 1, canonicalSource: 'detected', membership: 'detected' },
      ],
    });

    const plan = reconcileSeries(
      [proposal('Discworld', [['b1', '1'], ['b2', '2'], ['b4', '4']])],
      [before],
      [],
    );

    const order = orderAfter(before, plan.insertRows);
    expect(order).toHaveLength(3);
    // Whatever the new book's position, b4 still precedes b1.
    expect(order.indexOf('b4')).toBeLessThan(order.indexOf('b1'));
  });
});

describe('A11 — the membership tombstone', () => {
  test('an excluded row survives reconcile and blocks re-derivation', () => {
    // The scenario the tombstone exists for: a wrong merge, four books removed
    // by hand, then a rescan. Detection still proposes all six.
    const plan = reconcileSeries(
      [
        proposal('Wrong Merge', [
          ['keep1', '1'],
          ['keep2', '2'],
          ['out1', '3'],
          ['out2', '4'],
          ['out3', '5'],
          ['out4', '6'],
        ]),
      ],
      [
        existing({
          id: 's1',
          name: 'Wrong Merge',
          books: [
            { bookKey: 'keep1', position: 0, membership: 'detected' },
            { bookKey: 'keep2', position: 1, membership: 'detected' },
            { bookKey: 'out1', position: 2, membership: 'excluded' },
            { bookKey: 'out2', position: 3, membership: 'excluded' },
            { bookKey: 'out3', position: 4, membership: 'excluded' },
            { bookKey: 'out4', position: 5, membership: 'excluded' },
          ],
        }),
      ],
      [],
    );

    // Not one of them comes back.
    expect(plan.insertRows).toEqual([]);
    // And the tombstones themselves are never cleaned up as "not detected".
    expect(plan.removeRows).toEqual([]);
  });

  test('an excluded row does not anchor the ordering of a later insert', () => {
    // The user sees books 1 and 3, with a removed book 8 hidden between them.
    // Book 5 arrives. If the invisible row is allowed to anchor, book 5 lands
    // just before it — reading on screen as 1, 5, 3. A hidden row must never
    // steer a visible decision.
    const before = existing({
      id: 's1',
      name: 'Discworld',
      books: [
        { bookKey: 'b1', position: 0, canonicalNumber: 1, canonicalSource: 'detected', membership: 'detected' },
        { bookKey: 'ghost', position: 1, canonicalNumber: 8, canonicalSource: 'detected', membership: 'excluded' },
        { bookKey: 'b3', position: 2, canonicalNumber: 3, canonicalSource: 'detected', membership: 'detected' },
      ],
    });

    const plan = reconcileSeries(
      [proposal('Discworld', [['b1', '1'], ['b3', '3'], ['b5', '5'], ['ghost', '8']])],
      [before],
      [],
    );

    expect(plan.insertRows.map((r) => r.bookKey)).toEqual(['b5']);
    const visible = orderAfter(before, plan.insertRows).filter(
      (k) => k !== 'ghost',
    );
    expect(visible).toEqual(['b1', 'b3', 'b5']);
  });
});

describe('per-aspect ownership — renaming costs the user nothing else', () => {
  test("name_source = 'user' keeps the name and STILL reconciles membership", () => {
    // The user renamed this series, so no proposal will ever match it by name
    // again. If that ended the relationship, the next scan would re-create the
    // old name from the same books and every book would sit in two series —
    // and the commonest repair there is would be the one that breaks the app.
    const plan = reconcileSeries(
      [proposal('Discworld', [['b1', '1'], ['b2', '2'], ['b3', '3']])],
      [
        existing({
          id: 's1',
          name: 'The Disc Books',
          origin: 'detected',
          nameSource: 'user',
          books: [
            { bookKey: 'b1', position: 0, membership: 'detected' },
            { bookKey: 'b2', position: 1, membership: 'detected' },
            { bookKey: 'stale', position: 2, membership: 'detected' },
          ],
        }),
      ],
      [],
    );

    // No second series under the detected name.
    expect(plan.createSeries).toEqual([]);
    // Membership still reconciles, in both directions.
    expect(plan.insertRows.map((r) => r.bookKey)).toEqual(['b3']);
    expect(plan.removeRows).toEqual([{ seriesId: 's1', bookKey: 'stale' }]);
  });

  test('a proposal overlapping a USER-ORIGIN playlist still gets its own series', () => {
    // A playlist that happens to hold three Discworld books is not Discworld.
    // Overlap is continuity for detected series only; it never reaches into
    // something the user made.
    const plan = reconcileSeries(
      [proposal('Discworld', [['b1', '1'], ['b2', '2'], ['b3', '3']])],
      [
        existing({
          id: 's1',
          name: 'Bedtime Favourites',
          origin: 'user',
          nameSource: 'user',
          books: [
            { bookKey: 'b1', position: 0, membership: 'user' },
            { bookKey: 'b2', position: 1, membership: 'user' },
            { bookKey: 'b3', position: 2, membership: 'user' },
          ],
        }),
      ],
      [],
    );

    expect(plan.createSeries.map((s) => s.name)).toEqual(['Discworld']);
    expect(plan.insertRows).toEqual([]);
    expect(plan.removeRows).toEqual([]);
    expect(plan.skipped).toEqual([]);
  });

  test('a detected series no proposal matches is left completely alone', () => {
    // Turning `Also group by folder name` off drops proposals. A preference
    // change must never destroy data (06), so an unmatched series keeps every
    // row it has — reconcile only ever acts on a series it can still see.
    const plan = reconcileSeries(
      [],
      [
        existing({
          id: 's1',
          name: 'Formerly Detected',
          books: [
            { bookKey: 'b1', position: 0, membership: 'detected' },
            { bookKey: 'b2', position: 1, membership: 'detected' },
          ],
        }),
      ],
      [],
    );

    expect(plan).toEqual({
      createSeries: [],
      insertRows: [],
      removeRows: [],
      skipped: [],
    });
  });

  test('one book in common is not continuity', () => {
    // A single shared book between a 2-book series and an unrelated proposal
    // must not glue them together.
    const plan = reconcileSeries(
      [proposal('Discworld', [['b1', '1'], ['x2', '2'], ['x3', '3']])],
      [
        existing({
          id: 's1',
          name: 'Something Else',
          books: [
            { bookKey: 'b1', position: 0, membership: 'detected' },
            { bookKey: 'other', position: 1, membership: 'detected' },
          ],
        }),
      ],
      [],
    );

    expect(plan.createSeries.map((s) => s.name)).toEqual(['Discworld']);
    expect(plan.insertRows).toEqual([]);
    expect(plan.removeRows).toEqual([]);
  });
});

describe('G5 — the null coalesce, live from the day v33 lands', () => {
  // Append-only means no emulator and no device is ever wiped, so rows
  // carrying null in every new column exist immediately. The direction is
  // abstention bias: read as 'user' a row is merely never auto-updated; read
  // as 'detected' it is eligible for regeneration to CLOBBER.

  test("null origin is read as 'user', so the series is skipped entirely", () => {
    const plan = reconcileSeries(
      [proposal('Discworld', [['b1', '1'], ['b2', '2'], ['b3', '3']])],
      [
        existing({
          id: 's1',
          name: 'Discworld',
          origin: null,
          nameSource: null,
          books: [
            { bookKey: 'b1', position: 0, membership: null },
            { bookKey: 'legacy', position: 1, membership: null },
          ],
        }),
      ],
      [],
    );

    expect(plan.createSeries).toEqual([]);
    expect(plan.insertRows).toEqual([]);
    expect(plan.removeRows).toEqual([]);
    expect(plan.skipped).toEqual([{ name: 'Discworld', reason: 'user-owned' }]);
  });

  test('a null-origin series is never claimed by continuity either', () => {
    // The protective direction has to hold on BOTH matching paths, or a
    // pre-v33 series is reachable by overlap even though it is read as the
    // user's.
    const plan = reconcileSeries(
      [proposal('Discworld', [['b1', '1'], ['b2', '2'], ['b3', '3']])],
      [
        existing({
          id: 's1',
          name: 'Some Older Name',
          origin: null,
          books: [
            { bookKey: 'b1', position: 0, membership: null },
            { bookKey: 'b2', position: 1, membership: null },
          ],
        }),
      ],
      [],
    );

    expect(plan.createSeries.map((s) => s.name)).toEqual(['Discworld']);
    expect(plan.insertRows).toEqual([]);
    expect(plan.removeRows).toEqual([]);
  });

  test("null membership is read as 'user', so the row is never removed", () => {
    const plan = reconcileSeries(
      [proposal('Discworld', [['b1', '1'], ['b2', '2']])],
      [
        existing({
          id: 's1',
          name: 'Discworld',
          origin: 'detected',
          books: [
            { bookKey: 'b1', position: 0, membership: 'detected' },
            { bookKey: 'b2', position: 1, membership: 'detected' },
            // A pre-v33 row. Detection has no claim on it.
            { bookKey: 'legacy', position: 2, membership: null },
          ],
        }),
      ],
      [],
    );

    expect(plan.removeRows).toEqual([]);
  });

  test('canonical_source is NOT coerced — no number means no provenance', () => {
    // The one column that must stay out of the coalesce. Null here means "no
    // number is set", not "the user set it"; writing 'user' into it would be a
    // claim nobody made.
    const plan = reconcileSeries(
      [proposal('Discworld', [['b1', null], ['b2', null]])],
      [],
      [],
    );

    for (const book of plan.createSeries[0].books) {
      expect(book.canonicalNumber).toBeNull();
      expect(book.canonicalSource).toBeNull();
    }
  });

  test('a number the detector cannot express as a number is dropped, not mangled', () => {
    // D3 — `canonical_number` is a NUMBER column. `parseFloat('14b')` is 14,
    // which would file an omnibus as if it were book 14. Blank beats
    // misleading (D5).
    const plan = reconcileSeries(
      [proposal('Discworld', [['b14', '14'], ['omnibus', '14b'], ['range', '1-3']])],
      [],
      [],
    );

    const byKey = Object.fromEntries(
      plan.createSeries[0].books.map((b) => [b.bookKey, b]),
    );
    expect(byKey.b14).toMatchObject({ canonicalNumber: 14, canonicalSource: 'detected' });
    expect(byKey.omnibus).toMatchObject({ canonicalNumber: null, canonicalSource: null });
    expect(byKey.range).toMatchObject({ canonicalNumber: null, canonicalSource: null });
  });
});

test('reconcile has no rename verb at all — a scan never changes a name', () => {
  // Whatever `name_source` says. The user renamed nothing here; the series is
  // matched by continuity under a name detection would now elect differently,
  // and the plan still carries create / insert / remove and nothing else. A
  // series that quietly renames itself between scans is alarming in a way a
  // slightly stale name is not.
  const plan = reconcileSeries(
    [proposal('Discworld (2022)', [['b1', '1'], ['b2', '2'], ['b3', '3']])],
    [
      existing({
        id: 's1',
        name: 'Discworld',
        origin: 'detected',
        nameSource: 'detected',
        books: [
          { bookKey: 'b1', position: 0, membership: 'detected' },
          { bookKey: 'b2', position: 1, membership: 'detected' },
        ],
      }),
    ],
    [],
  );

  expect(plan).toEqual({
    createSeries: [],
    insertRows: [
      {
        seriesId: 's1',
        bookKey: 'b3',
        position: expect.any(Number),
        canonicalNumber: 3,
        canonicalSource: 'detected',
        membership: 'detected',
      },
    ],
    removeRows: [],
    skipped: [],
  });
});

describe('K16 — a series whose every row is excluded', () => {
  // DECIDED HERE: all-excluded is a STABLE STATE. Reconcile does not delete it
  // and does not suppress it — it emits an empty plan and moves on.
  //
  // Emptying a series one book at a time is not a delete the user made. A14's
  // standing rule is "bulk creates, per-item destroys", and inferring a
  // whole-series destroy from a run of per-item ones would be the single place
  // the app inverts it. The escape hatch already exists and is one tap away:
  // `Delete Series` in the editor (D8), which suppresses correctly per A12 and
  // says so in a dialog first. An empty series is visible and self-correcting;
  // a series that vanished on its own is neither.
  //
  // It also matters that emptying a series is a legitimate step in REBUILDING
  // one by hand — the only expressible repair for a wrong merge, since split
  // and merge do not ship (09).

  test('an all-excluded series produces an empty plan, and is not resurrected', () => {
    const plan = reconcileSeries(
      [proposal('Wrong Merge', [['a', '1'], ['b', '2'], ['c', '3']])],
      [
        existing({
          id: 's1',
          name: 'Wrong Merge',
          books: [
            { bookKey: 'a', position: 0, membership: 'excluded' },
            { bookKey: 'b', position: 1, membership: 'excluded' },
            { bookKey: 'c', position: 2, membership: 'excluded' },
          ],
        }),
      ],
      [],
    );

    expect(plan).toEqual({
      createSeries: [],
      insertRows: [],
      removeRows: [],
      skipped: [],
    });
  });

  test('a RENAMED all-excluded series is not duplicated either', () => {
    // Nothing matches by name any more, and there is not one visible row left
    // to match on. The tombstones are the only continuity there is — and if
    // they did not count, detection would create a fresh series holding every
    // book the user had just removed.
    const plan = reconcileSeries(
      [proposal('Wrong Merge', [['a', '1'], ['b', '2'], ['c', '3']])],
      [
        existing({
          id: 's1',
          name: 'My Own Name For It',
          origin: 'detected',
          nameSource: 'user',
          books: [
            { bookKey: 'a', position: 0, membership: 'excluded' },
            { bookKey: 'b', position: 1, membership: 'excluded' },
            { bookKey: 'c', position: 2, membership: 'excluded' },
          ],
        }),
      ],
      [],
    );

    expect(plan.createSeries).toEqual([]);
    expect(plan.insertRows).toEqual([]);
    expect(plan.removeRows).toEqual([]);
  });

  test('re-adding one book by hand brings the series back to life', () => {
    // The state is stable, not terminal. A 'user' row makes it a normal series
    // again, and detection still has no claim on the tombstones.
    const plan = reconcileSeries(
      [proposal('Wrong Merge', [['a', '1'], ['b', '2'], ['c', '3']])],
      [
        existing({
          id: 's1',
          name: 'Wrong Merge',
          books: [
            { bookKey: 'a', position: 0, membership: 'user' },
            { bookKey: 'b', position: 1, membership: 'excluded' },
            { bookKey: 'c', position: 2, membership: 'excluded' },
          ],
        }),
      ],
      [],
    );

    expect(plan.insertRows).toEqual([]);
    expect(plan.removeRows).toEqual([]);
  });
});

describe('A13 — hand-creating a suppressed name clears the veto', () => {
  test('the suppression row for that name is cleared', () => {
    // Otherwise the user's own new series is shadowed by an invisible veto:
    // they make it, the next scan sees the name suppressed, and they can never
    // work out why it will not stay.
    expect(
      suppressionsClearedByCreating('Discworld', ['Discworld', 'Other']),
    ).toEqual(['Discworld']);
  });

  test('matched on the same key as everything else', () => {
    expect(suppressionsClearedByCreating('discworld ', ['Discworld'])).toEqual([
      'Discworld',
    ]);
  });

  test('EVERY duplicate row is cleared, because duplicates can exist', () => {
    // G7 — there is no unique-constraint support anywhere in this DB library,
    // so a double-delete really can leave two rows. Clearing one would leave
    // the veto standing.
    expect(
      suppressionsClearedByCreating('Discworld', ['Discworld', 'discworld']),
    ).toEqual(['Discworld', 'discworld']);
  });

  test('an unrelated name clears nothing', () => {
    expect(suppressionsClearedByCreating('Discworld', ['Wheel of Time'])).toEqual(
      [],
    );
  });
});

describe('idempotence — what makes "scan again" safe', () => {
  const EMPTY: ReconcilePlan = {
    createSeries: [],
    insertRows: [],
    removeRows: [],
    skipped: [],
  };

  test('reconcile, apply, reconcile again -> empty plan', () => {
    const proposals = [
      proposal('Discworld', [['d1', '1'], ['d2', '2'], ['d3', '3']]),
      proposal('Wheel of Time', [['w1', '1'], ['w2', null]]),
    ];

    const first = reconcileSeries(proposals, [], []);
    expect(first.createSeries).toHaveLength(2);

    const applied = applyPlan([], first);
    expect(reconcileSeries(proposals, applied, [])).toEqual(EMPTY);
  });

  test('idempotent over a messy library, not just a fresh one', () => {
    // Every branch at once: a hand-made playlist, a renamed detected series
    // carrying a tombstone and a hand-added book, a suppressed name, a pre-v33
    // series of nulls, and a brand new proposal.
    const proposals = [
      proposal('Discworld', [['d1', '1'], ['d2', '2'], ['d3', '3'], ['dropped', '9']]),
      proposal('Bedtime Favourites', [['x1', '1'], ['x2', '2']]),
      proposal('Deleted By Hand', [['k1', '1'], ['k2', '2']]),
      proposal('Brand New', [['n1', '1'], ['n2', '2']]),
    ];

    const before: ExistingSeries[] = [
      existing({
        id: 'renamed',
        name: 'The Disc Books',
        origin: 'detected',
        nameSource: 'user',
        books: [
          { bookKey: 'd1', position: 0, canonicalNumber: 1, canonicalSource: 'detected', membership: 'detected' },
          { bookKey: 'd2', position: 1, canonicalNumber: 2, canonicalSource: 'detected', membership: 'detected' },
          { bookKey: 'dropped', position: 2, membership: 'excluded' },
          { bookKey: 'mine', position: 3, membership: 'user' },
          { bookKey: 'stale', position: 4, membership: 'detected' },
        ],
      }),
      existing({
        id: 'playlist',
        name: 'Bedtime Favourites',
        origin: 'user',
        nameSource: 'user',
        books: [{ bookKey: 'x1', position: 0, membership: 'user' }],
      }),
      existing({
        id: 'legacy',
        name: 'Pre-v33 Series',
        origin: null,
        nameSource: null,
        books: [{ bookKey: 'p1', position: 0, membership: null }],
      }),
    ];

    const first = reconcileSeries(proposals, before, ['Deleted By Hand']);

    // The first pass must be right before its stability means anything. In
    // particular the renamed series is CONTINUED, not duplicated: re-creating
    // it under the detected name would carry `dropped` back in and walk
    // straight through the tombstone.
    expect(first.createSeries.map((s) => s.name)).toEqual(['Brand New']);
    expect(first.insertRows).toEqual([
      {
        seriesId: 'renamed',
        bookKey: 'd3',
        position: expect.any(Number),
        canonicalNumber: 3,
        canonicalSource: 'detected',
        membership: 'detected',
      },
    ]);
    expect(first.removeRows).toEqual([
      { seriesId: 'renamed', bookKey: 'stale' },
    ]);
    expect(first.skipped).toEqual([
      { name: 'Bedtime Favourites', reason: 'user-owned' },
      { name: 'Deleted By Hand', reason: 'suppressed' },
    ]);

    const applied = applyPlan(before, first);
    const second = reconcileSeries(proposals, applied, ['Deleted By Hand']);

    // `skipped` is a report, not a write, so it recurs. The WRITES must not.
    expect(second.createSeries).toEqual([]);
    expect(second.insertRows).toEqual([]);
    expect(second.removeRows).toEqual([]);
    expect(second.skipped).toEqual(first.skipped);
  });

  test('a third pass is empty too — no slow oscillation', () => {
    const proposals = [proposal('Discworld', [['d1', '1'], ['d3', '3'], ['d2', '2']])];
    const before: ExistingSeries[] = [
      existing({
        id: 's1',
        name: 'Discworld',
        books: [
          { bookKey: 'd1', position: 0, canonicalNumber: 1, canonicalSource: 'detected', membership: 'detected' },
          { bookKey: 'd3', position: 1, canonicalNumber: 3, canonicalSource: 'detected', membership: 'detected' },
        ],
      }),
    ];

    const a = applyPlan(before, reconcileSeries(proposals, before, []));
    const b = applyPlan(a, reconcileSeries(proposals, a, []));
    expect(reconcileSeries(proposals, b, [])).toEqual(EMPTY);
  });
});
