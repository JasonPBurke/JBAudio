import {
  artworkFilename,
  coverExtractionKey,
  sanitizeForFilename,
  shortHash,
} from '../artworkIdentity';

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

describe('shortHash', () => {
  test('returns 8-char lowercase hex', () => {
    expect(shortHash('/some/path/file.m4b')).toMatch(/^[0-9a-f]{8}$/);
  });

  test('differs for different inputs', () => {
    expect(shortHash('/path/a')).not.toBe(shortHash('/path/b'));
  });
});
