import {
  assembleDerivedSeries,
  countSeriesByState,
  filterSeriesBySearch,
} from '@/helpers/seriesAssembly';

const mkBook = (id: string, url: string, title: string, prog = 0) =>
  ({
    bookId: id,
    bookTitle: title,
    bookProgressValue: prog,
    chapters: [{ url } as any],
  }) as any;

test('assemble resolves by structural key, drops missing, orders by position, A-Z series', () => {
  const bookMap = {
    b1: mkBook('b1', '/x/1.mp3', 'Zeta'),
    b2: mkBook('b2', '/y/1.mp3', 'Alpha', 2),
  };
  const series = [
    { id: 's2', name: 'Bravo', identityKey: 'bravo', createdAt: 0 },
    { id: 's1', name: 'Alpha', identityKey: 'alpha', createdAt: 0 },
  ];
  const memberships = [
    { seriesId: 's1', bookKey: '/y/1.mp3', position: 1, canonicalNumber: 2 },
    { seriesId: 's1', bookKey: '/x/1.mp3', position: 0, canonicalNumber: 1 },
    // unresolved → skipped
    { seriesId: 's1', bookKey: '/gone.mp3', position: 2, canonicalNumber: 3 },
    { seriesId: 's2', bookKey: '/x/1.mp3', position: 0, canonicalNumber: null },
  ];
  const out = assembleDerivedSeries(series, memberships, bookMap);
  expect(out.map((s) => s.id)).toEqual(['s1', 's2']); // A-Z by identityKey
  expect(out[0].books.map((b) => b.bookId)).toEqual(['b1', 'b2']); // by position, missing dropped
  expect(out[0].progressState).toBe('playing'); // [Zeta=0, Alpha=2]
});

test('canonical numbers stay index-aligned with the books that resolved', () => {
  const bookMap = {
    b1: mkBook('b1', '/x/1.mp3', 'Zeta'),
    b2: mkBook('b2', '/y/1.mp3', 'Alpha'),
  };
  const series = [{ id: 's1', name: 'Alpha', identityKey: 'alpha', createdAt: 0 }];
  const memberships = [
    { seriesId: 's1', bookKey: '/x/1.mp3', position: 0, canonicalNumber: 1 },
    // A dropped membership must drop its number too, or every number after it
    // is attributed to the wrong book.
    { seriesId: 's1', bookKey: '/gone.mp3', position: 1, canonicalNumber: 2 },
    { seriesId: 's1', bookKey: '/y/1.mp3', position: 2, canonicalNumber: null },
  ];
  const [out] = assembleDerivedSeries(series, memberships, bookMap);
  expect(out.books.map((b) => b.bookId)).toEqual(['b1', 'b2']);
  expect(out.canonicalNumbers).toEqual([1, null]);
});

/*
 * The detail sheet's hero reads pinned artwork (C8) and nothing else does, so
 * this is the whole read path for that column. A row that predates the column
 * carries `null`/undefined, and null means "derive it from the first book" —
 * a real answer, never a missing one, so it must not be coalesced away.
 */
test('pinned series artwork survives assembly, and absent means derived', () => {
  const bookMap = { b1: mkBook('b1', '/x/1.mp3', 'Mort') };
  const memberships = [
    { seriesId: 's1', bookKey: '/x/1.mp3', position: 0, canonicalNumber: 1 },
    { seriesId: 's2', bookKey: '/x/1.mp3', position: 0, canonicalNumber: 1 },
    { seriesId: 's3', bookKey: '/x/1.mp3', position: 0, canonicalNumber: 1 },
  ];
  const out = assembleDerivedSeries(
    [
      {
        id: 's1',
        name: 'Alpha',
        identityKey: 'alpha',
        artwork: '/art/s1.jpg',
        createdAt: 0,
      },
      { id: 's2', name: 'Bravo', identityKey: 'bravo', artwork: null, createdAt: 0 },
      // A pre-column row hands over no field at all.
      { id: 's3', name: 'Charlie', identityKey: 'charlie', createdAt: 0 },
    ],
    memberships,
    bookMap,
  );
  expect(out.map((s) => s.artwork)).toEqual(['/art/s1.jpg', null, null]);
});

test('countSeriesByState', () => {
  const list = [
    { progressState: 'unplayed' },
    { progressState: 'playing' },
    { progressState: 'finished' },
    { progressState: 'playing' },
  ] as any;
  expect(countSeriesByState(list)).toEqual({
    all: 4,
    unplayed: 1,
    playing: 2,
    finished: 1,
  });
});

test('filterSeriesBySearch matches name or member title', () => {
  const list = [
    { id: 's1', name: 'Discworld', books: [{ bookTitle: 'Guards! Guards!' }] },
    { id: 's2', name: 'Stormlight', books: [{ bookTitle: 'The Way of Kings' }] },
  ] as any;
  expect(filterSeriesBySearch(list, 'disc').map((s: any) => s.id)).toEqual([
    's1',
  ]);
  expect(filterSeriesBySearch(list, 'kings').map((s: any) => s.id)).toEqual([
    's2',
  ]);
  expect(filterSeriesBySearch(list, '  ').map((s: any) => s.id)).toEqual([
    's1',
    's2',
  ]); // blank → all
});

/*
 * A11 — an `'excluded'` row is a TOMBSTONE: it exists to block re-derivation,
 * and no surface may draw it. Filtered here rather than in the query layer so
 * every surface inherits it — they all read the store, and the store reads
 * this.
 */
test('an excluded membership row is invisible, and takes its number with it', () => {
  const bookMap = {
    b1: mkBook('b1', '/x/1.mp3', 'One'),
    b2: mkBook('b2', '/y/1.mp3', 'Two'),
    b3: mkBook('b3', '/z/1.mp3', 'Three'),
  };
  const series = [{ id: 's1', name: 'Alpha', identityKey: 'alpha', createdAt: 0 }];
  const memberships = [
    { seriesId: 's1', bookKey: '/x/1.mp3', position: 0, canonicalNumber: 1 },
    {
      seriesId: 's1',
      bookKey: '/y/1.mp3',
      position: 1,
      canonicalNumber: 2,
      membership: 'excluded',
    },
    {
      seriesId: 's1',
      bookKey: '/z/1.mp3',
      position: 2,
      canonicalNumber: 3,
      membership: 'detected',
    },
  ];
  const [out] = assembleDerivedSeries(series, memberships, bookMap);
  expect(out.books.map((b) => b.bookId)).toEqual(['b1', 'b3']);
  expect(out.canonicalNumbers).toEqual([1, 3]);
});

/*
 * §F2 needs BOTH of these and can get neither anywhere else: the pick reads
 * `origin` to decide which arm of the rule applies, and `createdAt` to break
 * the user-created tie. The list itself arrives A–Z, so creation order is
 * unrecoverable from it.
 *
 * G5 — `origin` is handed over RAW and coalesced here, exactly like
 * `membership`: every row that predates v33 carries null, and null is the
 * user's (abstention bias — a row read as 'detected' can be clobbered by
 * regeneration).
 */
test('origin and creation time survive assembly, and a pre-v33 null is the user', () => {
  const bookMap = { b1: mkBook('b1', '/x/1.mp3', 'Mort') };
  const memberships = [
    { seriesId: 's1', bookKey: '/x/1.mp3', position: 0, canonicalNumber: 1 },
    { seriesId: 's2', bookKey: '/x/1.mp3', position: 0, canonicalNumber: 1 },
    { seriesId: 's3', bookKey: '/x/1.mp3', position: 0, canonicalNumber: 1 },
  ];
  const out = assembleDerivedSeries(
    [
      {
        id: 's1',
        name: 'Alpha',
        identityKey: 'alpha',
        origin: 'detected',
        createdAt: 111,
      },
      { id: 's2', name: 'Bravo', identityKey: 'bravo', origin: 'user', createdAt: 222 },
      // A pre-v33 row hands over no origin at all.
      { id: 's3', name: 'Charlie', identityKey: 'charlie', createdAt: 333 },
    ],
    memberships,
    bookMap,
  );
  expect(out.map((s) => s.origin)).toEqual(['detected', 'user', 'user']);
  expect(out.map((s) => s.createdAt)).toEqual([111, 222, 333]);
});

/* G5 — every row that predates v33 carries null here, and null is a member. */
test('a membership row with no provenance is drawn', () => {
  const bookMap = { b1: mkBook('b1', '/x/1.mp3', 'One') };
  const series = [{ id: 's1', name: 'Alpha', identityKey: 'alpha', createdAt: 0 }];
  const [out] = assembleDerivedSeries(
    series,
    [
      {
        seriesId: 's1',
        bookKey: '/x/1.mp3',
        position: 0,
        canonicalNumber: null,
        membership: null,
      },
    ],
    bookMap,
  );
  expect(out.books.map((b) => b.bookId)).toEqual(['b1']);
});

/*
 * ⚠ ORDERING MOVED OFF THE IDENTITY KEY — ticket 32, ADR 0002.
 *
 * These series used to file under T, because the sort borrowed
 * `seriesIdentityKey`, which keeps the article. The fix is HERE, in what the
 * comparator reads; it is never a change to what the identity key returns,
 * which would merge `The Dresden Files` into `Dresden Files`.
 */
test('series file under their first significant word, not their article', () => {
  const series = [
    { id: 't', name: 'Threshold', identityKey: 'threshold', createdAt: 0 },
    {
      id: 'd',
      name: 'The Dresden Files',
      identityKey: 'the dresden files',
      createdAt: 0,
    },
    { id: 's', name: 'Silo', identityKey: 'silo', createdAt: 0 },
  ];
  const out = assembleDerivedSeries(series, [], {});
  expect(out.map((s) => s.name)).toEqual([
    'The Dresden Files',
    'Silo',
    'Threshold',
  ]);
});

/*
 * The ordering reads `name`, NOT the persisted identity key. A series whose
 * stored key is stale or absent must still file by the name on screen — and
 * this is what stops the sort quietly depending on a DB column again.
 */
test('ordering follows the displayed name, not the persisted identity key', () => {
  const series = [
    { id: 'b', name: 'Bravo', identityKey: 'zzz-stale', createdAt: 0 },
    { id: 'a', name: 'Alpha', identityKey: 'zzz-stale', createdAt: 0 },
  ];
  const out = assembleDerivedSeries(series, [], {});
  expect(out.map((s) => s.name)).toEqual(['Alpha', 'Bravo']);
});

/* Two different series that tie under the comparator keep a stable order. */
test('a series and its article-prefixed twin sit adjacent, input order kept', () => {
  const series = [
    {
      id: 'plain',
      name: 'Dresden Files',
      identityKey: 'dresden files',
      createdAt: 0,
    },
    {
      id: 'the',
      name: 'The Dresden Files',
      identityKey: 'the dresden files',
      createdAt: 0,
    },
  ];
  const out = assembleDerivedSeries(series, [], {});
  expect(out.map((s) => s.id)).toEqual(['plain', 'the']);
});
