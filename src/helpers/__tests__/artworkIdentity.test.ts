import {
  artworkFilePath,
  artworkFilename,
  coverExtractionKey,
  sanitizeForFilename,
  seriesArtworkFilename,
  shortHash,
} from '../artworkIdentity';

const ARTWORK_DIR = '/data/user/0/com.jbaudio/files/artwork';

describe('artworkFilename', () => {
  // Regression: two copies of the same title (different narrators, different
  // folders) previously collided on `${author}_${title}.webp` and clobbered
  // each other's cover art.
  test('two copies of the same title get different filenames', () => {
    const copyA = artworkFilename(
      'Terry Pratchett',
      'The Carpet People',
      '/audiobooks/The Carpet People (Tony Robinson)/book.m4b',
    );
    const copyB = artworkFilename(
      'Terry Pratchett',
      'The Carpet People',
      '/audiobooks/The Carpet People (Nigel Planer)/book.mp3',
    );
    expect(copyA).not.toBe(copyB);
  });

  test('is deterministic for the same book', () => {
    const first = artworkFilename('Terry Pratchett', 'Mort', '/books/Mort/01.mp3');
    const second = artworkFilename('Terry Pratchett', 'Mort', '/books/Mort/01.mp3');
    expect(first).toBe(second);
  });

  test('produces a filename-safe webp name', () => {
    const filename = artworkFilename(
      "Terry O'Pratchett",
      'Mort: The Reaper?',
      '/books/Mort/01.mp3',
    );
    expect(filename).toMatch(/^[A-Za-z0-9_]+\.webp$/);
  });

  test('keeps author and title readable in the filename', () => {
    const filename = artworkFilename('Terry Pratchett', 'Mort', 'db-record-id');
    expect(filename).toContain('Terry_Pratchett');
    expect(filename).toContain('Mort');
  });
});

describe('coverExtractionKey', () => {
  test('distinguishes same title in different directories', () => {
    const keyA = coverExtractionKey(
      '/audiobooks/The Carpet People (Tony Robinson)',
      'Terry Pratchett',
      'The Carpet People',
    );
    const keyB = coverExtractionKey(
      '/audiobooks/The Carpet People (Nigel Planer)',
      'Terry Pratchett',
      'The Carpet People',
    );
    expect(keyA).not.toBe(keyB);
  });

  test('matches for files of the same book in one directory', () => {
    const keyA = coverExtractionKey('/books/Mort', 'Terry Pratchett', 'Mort');
    const keyB = coverExtractionKey('/books/Mort', 'Terry Pratchett', 'Mort');
    expect(keyA).toBe(keyB);
  });
});

describe('sanitizeForFilename', () => {
  test('replaces non-alphanumeric characters with underscores', () => {
    expect(sanitizeForFilename("Terry O'Pratchett & Co.")).toBe(
      'Terry_O_Pratchett___Co_',
    );
  });
});

describe('seriesArtworkFilename', () => {
  /*
   * ⚠ THE LOAD-BEARING PROPERTY IS THE ARITY (§K8).
   *
   * The filename must be a function of the series ID and NOTHING ELSE. Add a
   * name component "for readability" and a rename redirects the destination
   * path, so the `unlink` that a replacement performs before its `moveFile`
   * no longer lands on the file it is replacing — and every pin after a rename
   * leaks its predecessor, which is exactly the orphan K8 exists to stop.
   */
  test('is keyed on the series id alone', () => {
    expect(seriesArtworkFilename.length).toBe(1);
  });

  test('is deterministic, so a replacement overwrites in place', () => {
    expect(seriesArtworkFilename('abc123')).toBe(seriesArtworkFilename('abc123'));
  });

  test('two series get different files', () => {
    expect(seriesArtworkFilename('abc123')).not.toBe(
      seriesArtworkFilename('def456'),
    );
  });

  test('is recognisable as a series file in the artwork directory', () => {
    // Not correctness — legibility. The ref-counted sweep sketched in the
    // orphaned-artwork note has to know that series own files too, and a
    // prefix is how someone reading the directory finds that out.
    expect(seriesArtworkFilename('abc123')).toMatch(/^series_[0-9a-f]{8}\.webp$/);
  });
});

describe('artworkFilePath', () => {
  test('strips the scheme and the ?t= cache-buster', () => {
    // Every artwork write appends `?t=Date.now()` so FastImage reloads a
    // replaced cover instead of serving the old bytes from its immutable
    // cache. RNFS needs neither that nor the scheme.
    expect(
      artworkFilePath(
        `file://${ARTWORK_DIR}/series_1a2b3c4d.webp?t=1754870400000`,
        ARTWORK_DIR,
      ),
    ).toBe(`${ARTWORK_DIR}/series_1a2b3c4d.webp`);
  });

  test('works without a cache-buster', () => {
    expect(artworkFilePath(`file://${ARTWORK_DIR}/a.webp`, ARTWORK_DIR)).toBe(
      `${ARTWORK_DIR}/a.webp`,
    );
  });

  /*
   * ⚠ THE REFUSALS ARE THE POINT. This feeds `RNFS.unlink`, so anything it
   * returns gets DELETED. A URI that is not one of ours is not ours to remove.
   */
  test('refuses a path outside the artwork directory', () => {
    // The design that would have produced one of these — "pin a member book's
    // cover" — is dropped rather than impossible, and following it would have
    // deleted a cover the BOOK still references.
    expect(
      artworkFilePath('file:///data/user/0/com.jbaudio/files/db.sqlite', ARTWORK_DIR),
    ).toBeNull();
    expect(artworkFilePath(`file://${ARTWORK_DIR}-other/a.webp`, ARTWORK_DIR)).toBeNull();
  });

  test('refuses anything that is not a local file', () => {
    // Both real shapes a placeholder took before the v31 migration: a Metro
    // URL in debug, a schemeless resource id in release.
    expect(artworkFilePath('http://10.0.2.2:8081/assets/cover.png', ARTWORK_DIR)).toBeNull();
    expect(artworkFilePath('12345', ARTWORK_DIR)).toBeNull();
  });

  test('refuses nothing at all', () => {
    expect(artworkFilePath(null, ARTWORK_DIR)).toBeNull();
    expect(artworkFilePath(undefined, ARTWORK_DIR)).toBeNull();
    expect(artworkFilePath('', ARTWORK_DIR)).toBeNull();
  });

  test('tolerates a trailing slash on the directory', () => {
    expect(artworkFilePath(`file://${ARTWORK_DIR}/a.webp`, `${ARTWORK_DIR}/`)).toBe(
      `${ARTWORK_DIR}/a.webp`,
    );
  });
});

describe('shortHash', () => {
  test('returns 8-char lowercase hex', () => {
    expect(shortHash('/some/path/file.m4b')).toMatch(/^[0-9a-f]{8}$/);
  });

  test('differs for different inputs', () => {
    expect(shortHash('/path/a')).not.toBe(shortHash('/path/b'));
  });
});
