import {
  canBulkNumber,
  orderByCanonicalNumber,
  parseCanonicalNumber,
  resolveNumbersForSave,
} from '@/helpers/seriesNumbering';

test('a comma decimal separator keeps its fractional part (K3)', () => {
  // `decimal-pad` renders the LOCALE's separator, so a comma-decimal user is
  // offered `,` and types `14,1`. `parseFloat('14,1')` returns 14 — silently,
  // with no error — so the fraction vanishes on exactly the users whose
  // keyboard produced it. This is the assertion the ticket asks for by name.
  expect(parseCanonicalNumber('14,1')).toBe(14.1);
});

test('blank means no canonical number, never zero', () => {
  // §E7 — boxes start empty and blank means null. `Number('')` is 0, which
  // would badge an untouched book `#0` and file it ahead of book 1.
  expect(parseCanonicalNumber('')).toBeNull();
  expect(parseCanonicalNumber('   ')).toBeNull();
  expect(parseCanonicalNumber(undefined)).toBeNull();
});

test('letter forms and ranges are rejected rather than coerced (D3)', () => {
  // The constraint is STRUCTURAL: `canonical_number` is a nullable NUMBER, so
  // a letter form cannot be stored even by accident. `parseFloat('14b')` is
  // 14, which would file an omnibus alongside book 14 as if it WERE book 14.
  // Ranges are the accepted casualty, not letters — `14b` renames to `14.1`.
  expect(parseCanonicalNumber('14b')).toBeNull();
  expect(parseCanonicalNumber('1-3')).toBeNull();
});

test('a separator with no digits on one side still parses', () => {
  // Both are states a `decimal-pad` genuinely produces. `5.` is what every
  // decimal LOOKS LIKE mid-typing, and dropping it to null there would flicker
  // the row out of the numbered set and blink `Sort by number` disabled under
  // the user's finger. `.5` is the shorthand for a 0.5 novella.
  expect(parseCanonicalNumber('.5')).toBe(0.5);
  expect(parseCanonicalNumber('5.')).toBe(5);
  expect(parseCanonicalNumber(',5')).toBe(0.5);
});

test('a lone separator is not a number', () => {
  // The one state `.5`'s leniency must not reach: `.` alone has no digits at
  // all, and `Number('.')` is NaN.
  expect(parseCanonicalNumber('.')).toBeNull();
  expect(parseCanonicalNumber(',')).toBeNull();
});

test('Sort by number puts blanks last and is stable within a group (D4)', () => {
  // The tail is the point: a partly-numbered series must not SHUFFLE the books
  // the user never numbered, so `c` stays ahead of `d` on the strength of
  // nothing but the order it arrived in. Duplicates hold their order for the
  // same reason — `a` before `e`, both numbered 1.
  const rows = [
    { key: 'b', n: 3 },
    { key: 'c', n: null },
    { key: 'a', n: 1 },
    { key: 'd', n: null },
    { key: 'e', n: 1 },
  ];
  expect(orderByCanonicalNumber(rows, (r) => r.n).map((r) => r.key)).toEqual([
    'a',
    'e',
    'b',
    'c',
    'd',
  ]);
});

test('numbers sort numerically, and decimals interleave', () => {
  // A default `.sort()` is lexicographic, which files `#10` between `#1` and
  // `#2` — a nine-book series looks fine and a ten-book one does not, so the
  // bug ships. 4.5 landing between 4 and 5 is the novella case §H10 collapses
  // to `4, 4.5, 5`.
  const rows = [{ n: 10 }, { n: 9 }, { n: 4.5 }, { n: 2 }, { n: 4 }];
  expect(orderByCanonicalNumber(rows, (r) => r.n).map((r) => r.n)).toEqual([
    2, 4, 4.5, 9, 10,
  ]);
});

test('bulk numbering is gated to fully-unnumbered series (D5)', () => {
  expect(canBulkNumber([null, null, null])).toBe(true);
});

test('bulk numbering is refused once ANY book carries a number (D5)', () => {
  // Renumbering over existing values IS a bulk destroy, and no bulk destroy
  // ships (A14). "Fill blanks only" was rejected by name: on `1, _, _, 8` it
  // manufactures false canonical data for the two middle books. Blank beats
  // misleading, so one number anywhere shuts the gate.
  expect(canBulkNumber([1, null, null])).toBe(false);
  expect(canBulkNumber([null, null, 8])).toBe(false);
  expect(canBulkNumber([1, 2, 3])).toBe(false);
});

test('an empty series has nothing to bulk number', () => {
  expect(canBulkNumber([])).toBe(false);
});

test('an untouched list is numbered 1..n from its drag order at save (E7)', () => {
  // The array IS the final drag order, so the number is the index plus one.
  // Numbering is playlist-shaped: you arranged them, that arrangement is the
  // series order, and nothing else was ever going to be a better guess.
  expect(resolveNumbersForSave([null, null, null])).toEqual([1, 2, 3]);
});

test('once anything is numbered, blanks stay blank at save (E7)', () => {
  // The same gate as `canBulkNumber`, and deliberately the same function — D5
  // and E7 are one rule, pressed manually or reached at save.
  expect(resolveNumbersForSave([1, null, 8])).toEqual([1, null, 8]);
});

test('a fully-numbered list saves exactly what was typed', () => {
  expect(resolveNumbersForSave([3, 1, 2])).toEqual([3, 1, 2]);
});

test('an empty list saves nothing', () => {
  expect(resolveNumbersForSave([])).toEqual([]);
});
