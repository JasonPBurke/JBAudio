import { planSeriesJoin } from '@/db/seriesJoin';
import { planEditorSave } from '@/db/seriesEditorSave';

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
