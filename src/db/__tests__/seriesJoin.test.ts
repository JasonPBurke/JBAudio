import { planSeriesJoin } from '@/db/seriesJoin';
import { planEditorSave } from '@/db/seriesEditorSave';
import { resolveMembership } from '@/db/seriesProvenance';

/**
 * §F8's `Add to series…` is JOIN-ONLY, and a join is expressed as an editor
 * save — so what this pins is the translation, not a second write path.
 */
test('the book is appended after the last visible member', () => {
  const join = planSeriesJoin({
    existing: [
      { bookKey: 'a', position: 0, canonicalNumber: 1 },
      { bookKey: 'b', position: 1, canonicalNumber: 2 },
    ],
    bookKey: 'c',
  });
  expect(join?.desiredKeysInOrder).toEqual(['a', 'b', 'c']);
});

test('rows are ordered by position, not by the order the query returned them', () => {
  const join = planSeriesJoin({
    existing: [
      { bookKey: 'b', position: 1, canonicalNumber: null },
      { bookKey: 'a', position: 0, canonicalNumber: null },
    ],
    bookKey: 'c',
  });
  expect(join?.desiredKeysInOrder).toEqual(['a', 'b', 'c']);
});

/*
 * ⚠ THE NUMBERS ARE CARRIED, and this is the whole reason the join is a
 * translation rather than an append. `planEditorSave` writes the numbers it is
 * given over the ones on disk, so a join that handed over blanks would wipe
 * every canonical number in the series — the §E-series numbering work, undone
 * by a menu item that never mentions numbers.
 */
test('every existing canonical number survives the join untouched', () => {
  const existing = [
    { bookKey: 'a', position: 0, canonicalNumber: 8 },
    { bookKey: 'b', position: 1, canonicalNumber: 39.5 },
  ];
  const join = planSeriesJoin({ existing, bookKey: 'c' })!;
  expect(join.canonicalNumbers).toEqual([8, 39.5, null]);

  const plan = planEditorSave({
    existing,
    desiredKeysInOrder: join.desiredKeysInOrder,
    canonicalNumbers: join.canonicalNumbers,
    visibleKeys: ['a', 'b'],
    storedName: 'Discworld',
    desiredName: 'Discworld',
  });
  // Nothing about the two sitting members changed, so nothing is written for
  // them — not their position, and above all not their number.
  expect(plan.updateRows).toEqual([]);
  expect(plan.insertRows).toEqual([
    {
      bookKey: 'c',
      position: 2,
      canonicalNumber: null,
      canonicalSource: null,
      membership: 'user',
    },
  ]);
});

test('a book that is already a visible member is a no-op', () => {
  const join = planSeriesJoin({
    existing: [{ bookKey: 'a', position: 0, canonicalNumber: 1 }],
    bookKey: 'a',
  });
  expect(join).toBeNull();
});

/*
 * A11 — a removed book is a TOMBSTONE, not a deletion, and the tombstone
 * remembers its number. Re-joining from the book side must restore it, for the
 * reason `loadRememberedNumbers` exists: the same silent number-wipe was found
 * on the editor's own re-add path on device (2026-08-13).
 */
test('re-joining a removed book restores it AND the number its tombstone kept', () => {
  const existing = [
    { bookKey: 'a', position: 0, canonicalNumber: 1 },
    {
      bookKey: 'gone',
      position: 1,
      canonicalNumber: 2,
      membership: 'excluded',
    },
  ];
  const join = planSeriesJoin({ existing, bookKey: 'gone' })!;
  expect(join.desiredKeysInOrder).toEqual(['a', 'gone']);
  expect(join.canonicalNumbers).toEqual([1, 2]);

  const plan = planEditorSave({
    existing,
    desiredKeysInOrder: join.desiredKeysInOrder,
    canonicalNumbers: join.canonicalNumbers,
    // `gone` is a tombstone, so the screen never drew it — the join is what
    // puts it back in the desired list.
    visibleKeys: ['a'],
    storedName: 'Discworld',
    desiredName: 'Discworld',
  });
  // The tombstone comes back as the user's row, and its number is left alone.
  expect(plan.updateRows).toEqual([{ bookKey: 'gone', membership: 'user' }]);
  expect(plan.insertRows).toEqual([]);
});

/*
 * DEVICE FINDING (2026-08-13): the first build appended unconditionally, so
 * re-joining book 4 of a 1,2,3,5 series left it reading 1,2,3,5,4.
 *
 * A restored tombstone is the one case where the join HAS placement
 * information — the row remembers where it sat — and the editor's own re-add
 * already honours it (ticket 16 kept the position unchanged). The same user
 * action through two doors must land in the same place.
 */
test('a restored tombstone goes back where it was, not on the end', () => {
  const join = planSeriesJoin({
    existing: [
      { bookKey: 'a', position: 0, canonicalNumber: 1 },
      { bookKey: 'b', position: 1, canonicalNumber: 2 },
      {
        bookKey: 'gone',
        position: 2,
        canonicalNumber: 3,
        membership: 'excluded',
      },
      { bookKey: 'd', position: 3, canonicalNumber: 4 },
    ],
    bookKey: 'gone',
  });
  expect(join?.desiredKeysInOrder).toEqual(['a', 'b', 'gone', 'd']);
  expect(join?.canonicalNumbers).toEqual([1, 2, 3, 4]);
});

test('a tombstone whose neighbours have since moved lands after the rows that still precede it', () => {
  // Its stored position is stale — the visible rows were dragged while it was
  // away — so what places it is how many of them are still in front of it.
  const join = planSeriesJoin({
    existing: [
      { bookKey: 'a', position: 5, canonicalNumber: null },
      { bookKey: 'gone', position: 2, canonicalNumber: null, membership: 'excluded' },
      { bookKey: 'b', position: 0, canonicalNumber: null },
    ],
    bookKey: 'gone',
  });
  expect(join?.desiredKeysInOrder).toEqual(['b', 'gone', 'a']);
});

test('a book that never was a member still appends — there is nothing to place it by', () => {
  const join = planSeriesJoin({
    existing: [
      { bookKey: 'a', position: 0, canonicalNumber: 1 },
      { bookKey: 'b', position: 1, canonicalNumber: 2 },
    ],
    bookKey: 'new',
  });
  expect(join?.desiredKeysInOrder).toEqual(['a', 'b', 'new']);
});

test('a series whose members are all tombstoned accepts the first book back', () => {
  const join = planSeriesJoin({
    existing: [
      { bookKey: 'a', position: 0, canonicalNumber: 1, membership: 'excluded' },
    ],
    bookKey: 'b',
  });
  expect(join?.desiredKeysInOrder).toEqual(['b']);
  expect(join?.canonicalNumbers).toEqual([null]);
});

/* G5 — a pre-v33 row carries null and is a member. */
test('a membership row with no provenance is a visible member', () => {
  const join = planSeriesJoin({
    existing: [
      { bookKey: 'a', position: 0, canonicalNumber: 1, membership: null },
    ],
    bookKey: 'b',
  });
  expect(join?.desiredKeysInOrder).toEqual(['a', 'b']);
});

/* ------------------------------------------ the two doors, over real saves --- */

/*
 * ⚠ WHY THESE RUN THE SAVES INSTEAD OF HAND-WRITING THE ROWS.
 *
 * The tombstone slot defect could not be reached by a fixture, because it is
 * not a property of any one plan — it is what happens to a tombstone's
 * coordinate space across CONSECUTIVE saves. The visible rows compact to
 * `0..n-1` every time, so a tombstone that is not carried along drifts, and
 * only the second removal makes the drift visible. Hand-written rows would just
 * be the author asserting their own arithmetic.
 *
 * So the sequence below is driven the way a user drives it, through the same
 * two doors, with one applier standing in for `updateSeries` — which writes its
 * plan verbatim and decides nothing, the contract that makes this legal.
 */

type Row = {
  bookKey: string;
  position: number;
  canonicalNumber?: number | null;
  membership?: string | null;
};

/** The list a surface actually draws: tombstones are invisible, position sorts. */
function visibleOrder(rows: Row[]): string[] {
  return rows
    .filter((r) => resolveMembership(r.membership) !== 'excluded')
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((r) => r.bookKey);
}

function numbersOf(rows: Row[], keys: string[]): (number | null)[] {
  return keys.map(
    (key) => rows.find((r) => r.bookKey === key)?.canonicalNumber ?? null,
  );
}

/** What `updateSeries` must do, in memory: apply the plan and decide nothing. */
function applySave(
  rows: Row[],
  desiredKeysInOrder: string[],
  canonicalNumbers: (number | null)[],
  visibleKeys: string[],
): Row[] {
  const plan = planEditorSave({
    existing: rows,
    desiredKeysInOrder,
    canonicalNumbers,
    visibleKeys,
    storedName: 'Discworld',
    desiredName: 'Discworld',
  });
  const next: Row[] = rows.map((row) => {
    const update = plan.updateRows.find((u) => u.bookKey === row.bookKey);
    return update ? { ...row, ...update } : row;
  });
  for (const insert of plan.insertRows) next.push({ ...insert });
  return next;
}

/** The editor's Remove button, then Save: the drawn list, minus one key. */
function removeInEditor(rows: Row[], bookKey: string): Row[] {
  const visible = visibleOrder(rows);
  const desired = visible.filter((k) => k !== bookKey);
  return applySave(rows, desired, numbersOf(rows, desired), visible);
}

/** `Add to series…` from the book screen: plan the join, write it as a save. */
function joinFromBookScreen(rows: Row[], bookKey: string): Row[] {
  const join = planSeriesJoin({ existing: rows, bookKey })!;
  return applySave(
    rows,
    join.desiredKeysInOrder,
    join.canonicalNumbers,
    visibleOrder(rows),
  );
}

const discworld = (): Row[] => [
  { bookKey: 'a', position: 0, canonicalNumber: 1, membership: 'detected' },
  { bookKey: 'b', position: 1, canonicalNumber: 2, membership: 'detected' },
  { bookKey: 'c', position: 2, canonicalNumber: 3, membership: 'detected' },
  { bookKey: 'd', position: 3, canonicalNumber: 4, membership: 'detected' },
  { bookKey: 'e', position: 4, canonicalNumber: 5, membership: 'detected' },
];

/* One removal already worked. It is here so the two-removal case has something
 * to be a regression OF. */
test('a single removed book goes back where it was', () => {
  let rows = discworld();
  rows = removeInEditor(rows, 'd');
  expect(visibleOrder(rows)).toEqual(['a', 'b', 'c', 'e']);

  rows = joinFromBookScreen(rows, 'd');
  expect(visibleOrder(rows)).toEqual(['a', 'b', 'c', 'd', 'e']);
});

/*
 * ⚠ THE DEFECT. `d`'s tombstone sat at 3 and stayed at 3 while `b` left and the
 * visible rows compacted underneath it, so the count of rows "in front of it"
 * came out one too high and `d` was APPENDED — the 1,2,3,5,4 finding that the
 * ticket-17 device fix was written to kill, reopened by a second tombstone.
 *
 * ⚠ AND WHY DEVICE TESTING MISSED IT: repeating remove→re-join cannot surface
 * this. It needs two removals, of books that were not adjacent at the end.
 */
test('a book removed AFTER another one still goes back where it was', () => {
  let rows = discworld();
  rows = removeInEditor(rows, 'd');
  rows = removeInEditor(rows, 'b');
  expect(visibleOrder(rows)).toEqual(['a', 'c', 'e']);

  rows = joinFromBookScreen(rows, 'd');
  expect(visibleOrder(rows)).toEqual(['a', 'c', 'd', 'e']);
});

/* Tombstones remember numbers; a join that blanks them is its own device-found
 * defect, and the numbers of every OTHER book are carried, not wiped. */
test('the restored book brings its number back and wipes nobody else`s', () => {
  let rows = discworld();
  rows = removeInEditor(rows, 'd');
  rows = removeInEditor(rows, 'b');
  rows = joinFromBookScreen(rows, 'd');

  expect(numbersOf(rows, visibleOrder(rows))).toEqual([1, 3, 4, 5]);
});

/* §D3 — a join carries no opinion about reading order, so a book with no
 * tombstone to place it by still goes on the end. */
test('a book that never was a member still lands on the end', () => {
  let rows = discworld();
  rows = removeInEditor(rows, 'd');
  rows = removeInEditor(rows, 'b');
  rows = joinFromBookScreen(rows, 'newcomer');

  expect(visibleOrder(rows)).toEqual(['a', 'c', 'e', 'newcomer']);
});

/*
 * BOTH DOORS AGREE. `Add to series…` is expressed as an editor `Save`, so the
 * rows it leaves behind must be indistinguishable from the ones the editor
 * writes for the same resulting list — same order, same numbers, same
 * tombstones. If the two ever diverge it is because a decision leaked out of
 * `planEditorSave` and into one of the callers.
 */
test('a join leaves the same rows an editor save of the same list would', () => {
  let removed = discworld();
  removed = removeInEditor(removed, 'd');
  removed = removeInEditor(removed, 'b');

  const joined = joinFromBookScreen(removed, 'd');
  const edited = applySave(
    removed,
    ['a', 'c', 'd', 'e'],
    [1, 3, 4, 5],
    visibleOrder(removed),
  );

  expect(joined).toEqual(edited);
});

/*
 * ⚠ ADJACENT REMOVALS IN ONE SAVE, BOTH RESTORE ORDERS.
 *
 * `a,b,c,d` losing `b` and `c` in a single `Save` leaves the visible list `a,d`,
 * and BOTH tombstones belong between them — one integer index cannot hold two
 * books, so the slot alone cannot say which comes first. Leaving them where they
 * were does not fix it either: it just chooses the other half of the same coin,
 * and a restore of `c` alone still appends past `d`.
 *
 * So the two are spread across the gap BELOW their shared slot. Every value in
 * `(slot - 1, slot]` counts the same visible predecessors, so the slot survives
 * intact while the order between them does too. Both orders must work, because
 * the user picks one and neither is rarer than the other.
 */
test('two books removed at once both come back in place, whichever goes first', () => {
  const start = (): Row[] => [
    { bookKey: 'a', position: 0, canonicalNumber: 1, membership: 'detected' },
    { bookKey: 'b', position: 1, canonicalNumber: 2, membership: 'detected' },
    { bookKey: 'c', position: 2, canonicalNumber: 3, membership: 'detected' },
    { bookKey: 'd', position: 3, canonicalNumber: 4, membership: 'detected' },
  ];
  const bothRemoved = (): Row[] => {
    const visible = visibleOrder(start());
    return applySave(start(), ['a', 'd'], [1, 4], visible);
  };
  expect(visibleOrder(bothRemoved())).toEqual(['a', 'd']);

  // The later book back first — the case a stale index appends.
  let cFirst = joinFromBookScreen(bothRemoved(), 'c');
  expect(visibleOrder(cFirst)).toEqual(['a', 'c', 'd']);
  cFirst = joinFromBookScreen(cFirst, 'b');
  expect(visibleOrder(cFirst)).toEqual(['a', 'b', 'c', 'd']);

  // And the earlier one first.
  let bFirst = joinFromBookScreen(bothRemoved(), 'b');
  expect(visibleOrder(bFirst)).toEqual(['a', 'b', 'd']);
  bFirst = joinFromBookScreen(bFirst, 'c');
  expect(visibleOrder(bFirst)).toEqual(['a', 'b', 'c', 'd']);
});
