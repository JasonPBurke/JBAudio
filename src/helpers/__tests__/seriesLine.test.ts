import {
  bookSeriesLine,
  bookSeriesMemberships,
  formatSeriesLine,
  pickPrimarySeries,
  SeriesLineSource,
} from '@/helpers/seriesLine';

/**
 * §F2's pick is the one thing on this ticket a unit test can hold. Everything
 * else about the line — where it sits, what colour it is — is device-verified.
 */
const mk = (
  id: string,
  origin: 'detected' | 'user',
  bookIds: string[],
  opts: {
    createdAt?: number;
    numbers?: (number | null)[];
    name?: string;
  } = {},
): SeriesLineSource => ({
  id,
  name: opts.name ?? id,
  origin,
  createdAt: opts.createdAt ?? 0,
  books: bookIds.map((bookId) => ({ bookId })),
  canonicalNumbers: opts.numbers ?? bookIds.map(() => null),
});

test('a book in no series has no line at all', () => {
  const series = [mk('Discworld', 'detected', ['b2', 'b3'])];
  expect(bookSeriesLine(series, 'b1')).toBeNull();
  expect(pickPrimarySeries([])).toBeNull();
});

test('the LARGEST detected series wins — not the first, not the smallest', () => {
  // Guards! Guards! is Discworld #8 and Night Watch #1 at the same time, and
  // both are detected. Size is the only signal detected series have.
  const series = [
    mk('Night Watch', 'detected', ['b1', 'b2'], { numbers: [1, 2] }),
    mk('Discworld', 'detected', ['x', 'y', 'b1'], { numbers: [6, 7, 8] }),
  ];
  expect(bookSeriesLine(series, 'b1')).toBe('Book 8 of Discworld');
});

test('a detected series beats a user-created one even when the user one is bigger', () => {
  const series = [
    mk('Favourites', 'user', ['a', 'b', 'c', 'b1'], { createdAt: 1 }),
    mk('Discworld', 'detected', ['b1'], { numbers: [8] }),
  ];
  expect(bookSeriesLine(series, 'b1')).toBe('Book 8 of Discworld');
});

test('with no detected series, the FIRST user-created one wins — creation order, not list order', () => {
  // The list arrives A-Z by sort name, so "first in the array" and "first
  // created" disagree here on purpose.
  const series = [
    mk('Airport reading', 'user', ['b1'], { createdAt: 900 }),
    mk('Zeta pile', 'user', ['b1'], { createdAt: 100 }),
  ];
  expect(bookSeriesLine(series, 'b1')).toBe('Part of Zeta pile');
});

test('the largest-detected tie keeps list order, so the pick is stable', () => {
  const series = [
    mk('Alpha', 'detected', ['b1', 'x']),
    mk('Bravo', 'detected', ['b1', 'y']),
  ];
  const picked = pickPrimarySeries(bookSeriesMemberships(series, 'b1'));
  expect(picked?.seriesId).toBe('Alpha');
});

test('the first-created tie keeps list order too', () => {
  const series = [
    mk('Alpha', 'user', ['b1'], { createdAt: 5 }),
    mk('Bravo', 'user', ['b1'], { createdAt: 5 }),
  ];
  const picked = pickPrimarySeries(bookSeriesMemberships(series, 'b1'));
  expect(picked?.seriesId).toBe('Alpha');
});

test('§F4 — no canonical number renders `Part of`, never a substituted position', () => {
  // b1 sits at position 1, so a position fallback would read "Book 2 of".
  const series = [
    mk('Discworld', 'detected', ['x', 'b1'], { numbers: [7, null] }),
  ];
  expect(bookSeriesLine(series, 'b1')).toBe('Part of Discworld');
});

test('a decimal canonical number survives into the line', () => {
  const series = [mk('Discworld', 'detected', ['b1'], { numbers: [39.5] })];
  expect(formatSeriesLine(bookSeriesMemberships(series, 'b1')[0])).toBe(
    'Book 39.5 of Discworld',
  );
});

test('the number read is the one on THIS book, index-aligned with the series books', () => {
  const series = [
    mk('Discworld', 'detected', ['x', 'y', 'b1'], { numbers: [1, 2, 3] }),
  ];
  expect(bookSeriesLine(series, 'b1')).toBe('Book 3 of Discworld');
});

test('memberships carry every series a book is in, however many', () => {
  const series = Array.from({ length: 12 }, (_, i) =>
    mk(`s${i}`, 'user', ['b1'], { createdAt: i }),
  );
  expect(bookSeriesMemberships(series, 'b1')).toHaveLength(12);
  expect(bookSeriesLine(series, 'b1')).toBe('Part of s0');
});
