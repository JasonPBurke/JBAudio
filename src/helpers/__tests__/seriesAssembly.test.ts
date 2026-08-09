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
    { id: 's2', name: 'Bravo', sortName: 'bravo' },
    { id: 's1', name: 'Alpha', sortName: 'alpha' },
  ];
  const memberships = [
    { seriesId: 's1', bookKey: '/y/1.mp3', position: 1, canonicalNumber: 2 },
    { seriesId: 's1', bookKey: '/x/1.mp3', position: 0, canonicalNumber: 1 },
    // unresolved → skipped
    { seriesId: 's1', bookKey: '/gone.mp3', position: 2, canonicalNumber: 3 },
    { seriesId: 's2', bookKey: '/x/1.mp3', position: 0, canonicalNumber: null },
  ];
  const out = assembleDerivedSeries(series, memberships, bookMap);
  expect(out.map((s) => s.id)).toEqual(['s1', 's2']); // A-Z by sortName
  expect(out[0].books.map((b) => b.bookId)).toEqual(['b1', 'b2']); // by position, missing dropped
  expect(out[0].progressState).toBe('playing'); // [Zeta=0, Alpha=2]
});

test('canonical numbers stay index-aligned with the books that resolved', () => {
  const bookMap = {
    b1: mkBook('b1', '/x/1.mp3', 'Zeta'),
    b2: mkBook('b2', '/y/1.mp3', 'Alpha'),
  };
  const series = [{ id: 's1', name: 'Alpha', sortName: 'alpha' }];
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
