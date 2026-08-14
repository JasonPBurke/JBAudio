import {
  selectOrphanedMemberships,
  selectEmptySeriesIds,
  partitionBooksByRemovedFolder,
  collectLiveKeys,
} from '@/db/seriesOrphanPrune';

describe('selectOrphanedMemberships', () => {
  test('destroys rows whose structural key no longer backs a live book', () => {
    const rows = [
      { bookKey: '/Audiobooks/A/01.mp3' },
      { bookKey: '/Audiobooks/B/01.mp3' },
    ];
    const liveKeys = new Set(['/Audiobooks/A/01.mp3']);

    expect(selectOrphanedMemberships(rows, liveKeys)).toEqual([
      { bookKey: '/Audiobooks/B/01.mp3' },
    ]);
  });

  test('a moved book orphans: the old path is dead even though the new one is live', () => {
    const rows = [{ bookKey: '/Audiobooks/Old Name/01.mp3' }];
    const liveKeys = new Set(['/Audiobooks/New Name/01.mp3']);

    expect(selectOrphanedMemberships(rows, liveKeys)).toEqual(rows);
  });

  // ADR 0001, ruling 3: option A (a provenance-aware prune that spares 'user'
  // and 'excluded' rows) was considered and REJECTED. If this fails, someone
  // has quietly implemented A.
  test('provenance is deliberately ignored — user and excluded dead rows are destroyed too', () => {
    const rows = [
      { bookKey: '/dead/user.mp3', membership: 'user' },
      { bookKey: '/dead/excluded.mp3', membership: 'excluded' },
      { bookKey: '/dead/detected.mp3', membership: 'detected' },
      { bookKey: '/dead/unwritten.mp3', membership: null },
      { bookKey: '/live/keep.mp3', membership: 'user' },
    ];
    const liveKeys = new Set(['/live/keep.mp3']);

    expect(
      selectOrphanedMemberships(rows, liveKeys).map((r) => r.bookKey),
    ).toEqual([
      '/dead/user.mp3',
      '/dead/excluded.mp3',
      '/dead/detected.mp3',
      '/dead/unwritten.mp3',
    ]);
  });

  test('no live keys at all orphans every row', () => {
    const rows = [{ bookKey: '/a.mp3' }, { bookKey: '/b.mp3' }];
    expect(selectOrphanedMemberships(rows, new Set())).toEqual(rows);
  });

  test('nothing to destroy when every key is live', () => {
    const rows = [{ bookKey: '/a.mp3' }, { bookKey: '/b.mp3' }];
    const liveKeys = new Set(['/a.mp3', '/b.mp3', '/unrelated.mp3']);
    expect(selectOrphanedMemberships(rows, liveKeys)).toEqual([]);
  });
});

describe('selectEmptySeriesIds', () => {
  // ADR 0001, ruling 1: a hand-made series does not outlive its last member.
  test('a series whose every member was destroyed is empty', () => {
    const surviving = [{ seriesId: 's1' }];
    expect(selectEmptySeriesIds(['s1', 's2'], surviving)).toEqual(['s2']);
  });

  test('one surviving member keeps a series alive', () => {
    const surviving = [{ seriesId: 's1' }, { seriesId: 's1' }];
    expect(selectEmptySeriesIds(['s1'], surviving)).toEqual([]);
  });

  test('a series that never had a member is empty', () => {
    expect(selectEmptySeriesIds(['s1'], [])).toEqual(['s1']);
  });
});

describe('partitionBooksByRemovedFolder', () => {
  /**
   * The regression this whole seam exists for (ticket 22).
   *
   * `removeLibraryFolder` used to build its live set from `chapters[0].url` of
   * a raw relation fetch, whose order WatermelonDB does not guarantee. The
   * canonical structural key is the startMs-FIRST chapter (the library store
   * sorts before `bookStructuralKey` reads it), so any book whose rowid order
   * differs from its startMs order contributed the WRONG key — and since the
   * prune is a blocklist, a missing key is an order to destroy, not a no-op.
   */
  test('a surviving book keeps its row when its chapters arrive out of startMs order', () => {
    const keep = {
      book: 'keep',
      // Fetched in rowid order: the canonical key ('.../01.mp3', startMs 0) is
      // NOT the first element.
      chapters: [
        { url: '/Audiobooks/Keep/02.mp3', startMs: 1000 },
        { url: '/Audiobooks/Keep/01.mp3', startMs: 0 },
      ],
    };
    const gone = {
      book: 'gone',
      chapters: [{ url: '/Audiobooks/Gone/01.mp3', startMs: 0 }],
    };

    const { removedBooks, liveKeys } = partitionBooksByRemovedFolder(
      [keep, gone],
      '/Audiobooks/Gone',
    );

    expect(removedBooks).toEqual([gone]);
    const rows = [
      { bookKey: '/Audiobooks/Keep/01.mp3' },
      { bookKey: '/Audiobooks/Gone/01.mp3' },
    ];
    expect(selectOrphanedMemberships(rows, liveKeys).map((r) => r.bookKey)).toEqual(
      ['/Audiobooks/Gone/01.mp3'],
    );
  });

  // The feature the blocklist inversion was FOR. Fixing the key mismatch must
  // not quietly turn the prune back into a no-op.
  test('a removed folder still prunes its books and reaps the series left empty', () => {
    const { removedBooks, liveKeys } = partitionBooksByRemovedFolder(
      [
        {
          book: 'gone-1',
          chapters: [{ url: '/Audiobooks/Gone/Book 1/01.mp3' }],
        },
        {
          book: 'gone-2',
          chapters: [
            { url: '/Audiobooks/Gone/Book 2/01.mp3' },
            { url: '/Audiobooks/Gone/Book 2/02.mp3' },
          ],
        },
        { book: 'keep', chapters: [{ url: '/Audiobooks/Keep/01.mp3' }] },
      ],
      '/Audiobooks/Gone',
    );

    expect(removedBooks.map((e) => e.book)).toEqual(['gone-1', 'gone-2']);

    const rows = [
      { id: 'r1', seriesId: 's1', bookKey: '/Audiobooks/Gone/Book 1/01.mp3' },
      { id: 'r2', seriesId: 's1', bookKey: '/Audiobooks/Gone/Book 2/01.mp3' },
      { id: 'r3', seriesId: 's2', bookKey: '/Audiobooks/Keep/01.mp3' },
    ];
    const orphans = selectOrphanedMemberships(rows, liveKeys);
    expect(orphans.map((r) => r.id)).toEqual(['r1', 'r2']);

    const destroyed = new Set(orphans.map((r) => r.id));
    expect(
      selectEmptySeriesIds(
        ['s1', 's2'],
        rows.filter((r) => !destroyed.has(r.id)),
      ),
    ).toEqual(['s1']);
  });

  // A bare `startsWith` on the folder path matches a SIBLING root whose name
  // merely starts with it. That is the ticket's own headline failure reached by
  // a different road — and worse, since the sibling's books are deleted too,
  // not just their rows. The prefix has to end at a directory boundary.
  test('a sibling folder whose name starts with the removed one is untouched', () => {
    const sibling = {
      book: 'backup',
      chapters: [{ url: '/Audiobooks/Books Backup/01.mp3' }],
    };
    const { removedBooks, liveKeys } = partitionBooksByRemovedFolder(
      [sibling, { book: 'gone', chapters: [{ url: '/Audiobooks/Books/01.mp3' }] }],
      '/Audiobooks/Books',
    );

    expect(removedBooks.map((e) => e.book)).toEqual(['gone']);
    expect(
      selectOrphanedMemberships(
        [{ bookKey: '/Audiobooks/Books Backup/01.mp3' }],
        liveKeys,
      ),
    ).toEqual([]);
  });

  test('a folder path given with a trailing slash behaves identically', () => {
    const { removedBooks } = partitionBooksByRemovedFolder(
      [
        { book: 'gone', chapters: [{ url: '/Audiobooks/Books/01.mp3' }] },
        { book: 'backup', chapters: [{ url: '/Audiobooks/Books Backup/01.mp3' }] },
      ],
      '/Audiobooks/Books/',
    );
    expect(removedBooks.map((e) => e.book)).toEqual(['gone']);
  });

  test('a book with no chapters is neither removed nor a live-key contributor', () => {
    const { removedBooks, liveKeys } = partitionBooksByRemovedFolder(
      [{ book: 'empty', chapters: [] }],
      '/Audiobooks/Gone',
    );
    expect(removedBooks).toEqual([]);
    expect([...liveKeys]).toEqual([]);
  });
});

describe('collectLiveKeys', () => {
  // The shared definition both prune sites read through. The scan site feeds
  // surviving chapters directly; folder-removal feeds the survivors' chapters
  // via `partitionBooksByRemovedFolder`. Same rule, one place.
  test('every surviving chapter url counts, not just a first file', () => {
    expect([
      ...collectLiveKeys([
        { url: '/A/01.mp3' },
        { url: '/A/02.mp3' },
        { url: '/B/01.mp3' },
      ]),
    ]).toEqual(['/A/01.mp3', '/A/02.mp3', '/B/01.mp3']);
  });

  test('nothing surviving means nothing live', () => {
    expect(collectLiveKeys([]).size).toBe(0);
  });
});
