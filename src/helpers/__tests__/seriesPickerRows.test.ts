import {
  PICKER_HEAD_INDEX,
  pickerRows,
  pickerSubtitle,
  type PickerRow,
} from '@/helpers/seriesPickerRows';
import { Author, Book } from '@/types/Book';

/** Only the fields the picker reads; the rest of `Book` is irrelevant here. */
function book(title: string, author: string, firstUrl: string | null): Book {
  return {
    bookId: `${author}:${title}`,
    author,
    bookTitle: title,
    chapters: firstUrl
      ? [
          {
            author,
            bookTitle: title,
            chapterTitle: 'one',
            chapterNumber: 1,
            chapterDuration: 1,
            startMs: 0,
            url: firstUrl,
          },
        ]
      : [],
  } as unknown as Book;
}

function authorOf(name: string, books: Book[]): Author {
  return { name, books };
}

const rowsOnly = (rows: PickerRow[]) => rows.slice(1);
const keysOf = (rows: PickerRow[]) => rows.map((r) => r.key);

describe('the head is always row 0', () => {
  test('on the authors step', () => {
    const rows = pickerRows({ step: 'authors', authors: [], selected: [] });
    expect(rows[PICKER_HEAD_INDEX].type).toBe('head');
  });

  test('on the books step', () => {
    const rows = pickerRows({ step: 'books', authors: [], selected: [] });
    expect(rows[PICKER_HEAD_INDEX].type).toBe('head');
  });

  /*
   * The head's index is what `stickyHeaderIndices` pins. If anything ever
   * renders above it in the DATA (as opposed to the list header component),
   * the `X` stops sticking and the panel becomes unclosable from the bottom
   * of a 350-book pool.
   */
  test('and nothing else claims index 0', () => {
    const rows = pickerRows({
      step: 'authors',
      authors: [authorOf('Ann', [book('A', 'Ann', '/a')])],
      selected: [],
    });
    expect(rows.filter((r) => r.type === 'head')).toHaveLength(1);
    expect(rows[0].type).toBe('head');
  });
});

/*
 * §E14 — the author step is a TWO-COLUMN GRID. The pairing happens here, in the
 * data, rather than through FlashList's `numColumns`: the picker is one list
 * serving both steps, so a column count set on the list would be a property of
 * the LIST when it needs to be a property of the STEP — and every book, heading
 * and empty row would then need a span override to opt back out. Ticket 13
 * measured this list's exact configuration (917→480 views, flat at 108 rows);
 * pairing in the data leaves that configuration untouched.
 */
describe('the authors step is a two-column grid (§E14)', () => {
  const named = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      authorOf(`A${i}`, [book(`B${i}`, `A${i}`, `/a${i}`)]),
    );

  test('pairs authors two to a row, reading left then right', () => {
    const rows = rowsOnly(
      pickerRows({ step: 'authors', authors: named(4), selected: [] }),
    );

    expect(rows.map((r) => r.type)).toEqual(['authorPair', 'authorPair']);
    expect(
      rows.map((r) => (r.type === 'authorPair' ? [r.left, r.right] : null)),
    ).toEqual([
      ['A0', 'A1'],
      ['A2', 'A3'],
    ]);
  });

  /*
   * The odd cell is `null` rather than absent, so the renderer lays out a real
   * left cell beside an empty slot. If it were absent the row would have one
   * child and a `space-between` row would stretch it across both columns.
   */
  test('an odd author count leaves the last row a half-empty pair', () => {
    const rows = rowsOnly(
      pickerRows({ step: 'authors', authors: named(3), selected: [] }),
    );

    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ type: 'authorPair', left: 'A2', right: null });
  });

  test('a single author is a pair with nothing on its right', () => {
    const rows = rowsOnly(
      pickerRows({ step: 'authors', authors: named(1), selected: [] }),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: 'authorPair', left: 'A0', right: null });
  });

  test('every pair row carries a unique key', () => {
    const rows = pickerRows({ step: 'authors', authors: named(9), selected: [] });
    expect(new Set(keysOf(rows)).size).toBe(rows.length);
  });

  /*
   * The grid halves the row count, and that is the whole point: §E14 measured
   * ~18–20 authors per screen against the single column's 7–8.
   */
  test('100 authors become 50 rows', () => {
    const rows = rowsOnly(
      pickerRows({ step: 'authors', authors: named(100), selected: [] }),
    );
    expect(rows).toHaveLength(50);
  });

  test('no author name is dropped or duplicated by the pairing', () => {
    const rows = rowsOnly(
      pickerRows({ step: 'authors', authors: named(7), selected: [] }),
    );
    const flattened = rows.flatMap((r) =>
      r.type === 'authorPair' ? [r.left, r.right] : [],
    );
    expect(flattened.filter((n): n is string => n !== null)).toEqual([
      'A0',
      'A1',
      'A2',
      'A3',
      'A4',
      'A5',
      'A6',
    ]);
  });
});

describe('the authors step', () => {
  test('preserves the order the library store gave', () => {
    const authors = [
      authorOf('Ann Leckie', [book('Ancillary Justice', 'Ann Leckie', '/a')]),
      authorOf('Becky Chambers', [book('A Closed Common', 'Becky Chambers', '/b')]),
    ];
    const rows = rowsOnly(pickerRows({ step: 'authors', authors, selected: [] }));

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: 'authorPair',
      left: 'Ann Leckie',
      right: 'Becky Chambers',
    });
  });

  test('does not depend on which authors are selected', () => {
    const authors = [
      authorOf('Ann', [book('A', 'Ann', '/a')]),
      authorOf('Bob', [book('B', 'Bob', '/b')]),
    ];
    const none = pickerRows({ step: 'authors', authors, selected: [] });
    const some = pickerRows({ step: 'authors', authors, selected: ['Bob'] });
    expect(keysOf(some)).toEqual(keysOf(none));
  });

  test('an empty library says so rather than rendering a blank panel', () => {
    const rows = rowsOnly(pickerRows({ step: 'authors', authors: [], selected: [] }));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: 'empty' });
  });
});

describe('the books step', () => {
  const ann = authorOf('Ann', [
    book('The Apple', 'Ann', '/ann/apple'),
    book('Bananas', 'Ann', '/ann/bananas'),
  ]);
  const bob = authorOf('Bob', [book('Zebra', 'Bob', '/bob/zebra')]);
  const cass = authorOf('Cass', [book('Cabin', 'Cass', '/cass/cabin')]);

  test('groups the selected authors only, each behind its own heading', () => {
    const rows = rowsOnly(
      pickerRows({
        step: 'books',
        authors: [ann, bob, cass],
        selected: ['Ann', 'Cass'],
      }),
    );

    expect(rows.map((r) => r.type)).toEqual([
      'heading',
      'book',
      'book',
      'heading',
      'book',
    ]);
    expect(rows.filter((r) => r.type === 'heading').map((r) => r.key)).toEqual([
      'heading-Ann',
      'heading-Cass',
    ]);
  });

  /*
   * Titles sort the way the rest of the app sorts them, which is NOT
   * `localeCompare`: the leading article is stripped, so `The Apple` files
   * under A and lands before `Bananas` rather than after it.
   */
  test('sorts each group by title the way the app sorts titles', () => {
    const rows = rowsOnly(
      pickerRows({ step: 'books', authors: [ann], selected: ['Ann'] }),
    );
    expect(rows.filter((r) => r.type === 'book').map((r) => r.bookKey)).toEqual([
      '/ann/apple',
      '/ann/bananas',
    ]);
  });

  /** The other half of the app's title order: 2 before 10, not after it. */
  test('numbers in titles sort naturally', () => {
    const numbered = authorOf('Nat', [
      book('Book 10', 'Nat', '/nat/10'),
      book('Book 2', 'Nat', '/nat/2'),
    ]);
    const rows = pickerRows({
      step: 'books',
      authors: [numbered],
      selected: ['Nat'],
    });
    expect(rows.filter((r) => r.type === 'book').map((r) => r.bookKey)).toEqual([
      '/nat/2',
      '/nat/10',
    ]);
  });

  test('sorts the groups by author name regardless of the selection order', () => {
    const rows = pickerRows({
      step: 'books',
      authors: [ann, bob, cass],
      selected: ['Cass', 'Ann'],
    });
    expect(rows.filter((r) => r.type === 'heading').map((r) => r.name)).toEqual([
      'Ann',
      'Cass',
    ]);
  });

  /*
   * Membership is keyed by the first file's path (ADR 0001), so a book with no
   * path cannot become a member — offering it would be offering a row that
   * saves nothing.
   */
  test('drops books that have no structural key', () => {
    const ghost = authorOf('Ghost', [
      book('Real', 'Ghost', '/ghost/real'),
      book('Keyless', 'Ghost', null),
    ]);
    const rows = rowsOnly(
      pickerRows({ step: 'books', authors: [ghost], selected: ['Ghost'] }),
    );
    expect(rows.filter((r) => r.type === 'book')).toHaveLength(1);
  });

  test('a heading is not emitted for a group that contributes no rows', () => {
    const keyless = authorOf('Keyless', [book('X', 'Keyless', null)]);
    const rows = rowsOnly(
      pickerRows({
        step: 'books',
        authors: [keyless, bob],
        selected: ['Keyless', 'Bob'],
      }),
    );
    expect(rows.map((r) => r.type)).toEqual(['heading', 'book']);
  });

  /*
   * FlashList keys rows by `key`. Two rows sharing one would recycle into each
   * other AND toggle as one book, because the structural key IS the identity
   * the draft stages.
   */
  test('never emits the same book key twice', () => {
    const twin = authorOf('Twin', [
      book('One', 'Twin', '/twin/same'),
      book('Two', 'Twin', '/twin/same'),
    ]);
    const rows = pickerRows({
      step: 'books',
      authors: [twin],
      selected: ['Twin'],
    });
    expect(new Set(keysOf(rows)).size).toBe(rows.length);
  });

  test('selecting no authors leaves an explanation, not a blank panel', () => {
    const rows = rowsOnly(
      pickerRows({ step: 'books', authors: [ann], selected: [] }),
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ type: 'empty' });
  });

  /*
   * §E3's acceptance criterion — "selections are kept when the author filter
   * changes". The pool is a pure function of the FILTER; the staged selection
   * lives in the draft store and is not passed in here at all. That separation
   * is the criterion: this function cannot drop a staged book, because it has
   * never been told about one.
   */
  test('is derived from the filter alone — it takes no staged selection', () => {
    const wide = pickerRows({
      step: 'books',
      authors: [ann, bob],
      selected: ['Ann', 'Bob'],
    });
    const narrowed = pickerRows({
      step: 'books',
      authors: [ann, bob],
      selected: ['Ann'],
    });

    // Bob's book leaves the POOL when Bob leaves the filter...
    expect(keysOf(wide)).toContain('book-/bob/zebra');
    expect(keysOf(narrowed)).not.toContain('book-/bob/zebra');
    // ...and nothing in the signature could have carried a staged key with it.
    expect(Object.keys(pickerRows({ step: 'books', authors: [], selected: [] })[0]))
      .not.toContain('selectedBookKeys');
  });

  test('does not mutate the store’s book arrays while sorting', () => {
    const original = [...ann.books];
    pickerRows({ step: 'books', authors: [ann], selected: ['Ann'] });
    expect(ann.books).toEqual(original);
  });

  /*
   * §E14's grid is the AUTHORS step only. This pins the books step's exact row
   * sequence so the pairing cannot leak into it — the pool is what ticket 13
   * virtualized and measured, and it is the half of the panel that runs to
   * hundreds of rows.
   */
  test('is untouched by the author grid — no pair rows, same sequence', () => {
    const rows = pickerRows({
      step: 'books',
      authors: [ann, bob, cass],
      selected: ['Ann', 'Cass'],
    });

    expect(rows.some((r) => r.type === 'authorPair')).toBe(false);
    expect(keysOf(rows)).toEqual([
      'picker-head',
      'heading-Ann',
      'book-/ann/apple',
      'book-/ann/bananas',
      'heading-Cass',
      'book-/cass/cabin',
    ]);
  });
});

describe('pickerSubtitle', () => {
  test('names the question each step is asking', () => {
    expect(pickerSubtitle('authors')).toBe('Whose books are in this series?');
    expect(pickerSubtitle('books')).toBe('Tap the books that belong in it.');
  });
});
