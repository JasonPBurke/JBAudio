import { Model } from '@nozbe/watermelondb';

import Series from '@/db/models/Series';
import SeriesBook from '@/db/models/SeriesBook';
import SuppressedSeries from '@/db/models/SuppressedSeries';
import BookTag from '@/db/models/BookTag';
import Book from '@/db/models/Book';

/**
 * Reads a model's decorated properties against a hand-built raw record.
 *
 * WatermelonDB's field decorators are plain prototype getters over
 * `this._raw`, so a record can be read without an adapter, a database or a
 * device. That is the only reason the upgrade path below is testable in jest
 * at all: what a pre-v33 row looks like is exactly a raw record with the new
 * keys missing.
 */
function rowOf<T extends Model>(
  ModelClass: { prototype: object },
  raw: Record<string, unknown>,
): T {
  const record = Object.create(ModelClass.prototype) as T;
  // `_raw` is a full RawRecord on a real model (id, _status, _changed and the
  // columns). Only the columns are read here, so the cast keeps the fixtures
  // to the part under test.
  (record as unknown as { _raw: Record<string, unknown> })._raw = raw;
  return record;
}

describe('Series — a row that predates v33', () => {
  it('reads as user-owned, so detection can never clobber it', () => {
    // Not "null": the keys are ABSENT, which is what the columns look like
    // before the migration adds them. Both must resolve the same way.
    const series = rowOf<Series>(Series, { name: 'Discworld' });
    expect(series.origin).toBe('user');
    expect(series.nameSource).toBe('user');
  });

  it('reads an explicit null as user-owned too', () => {
    // What every existing row actually holds after v33 runs: the migration
    // cannot backfill a value, so addColumns fills optional columns with null.
    const series = rowOf<Series>(Series, {
      name: 'Discworld',
      origin: null,
      name_source: null,
    });
    expect(series.origin).toBe('user');
    expect(series.nameSource).toBe('user');
  });

  it('reports a detected series as detected', () => {
    const series = rowOf<Series>(Series, {
      name: 'Discworld',
      origin: 'detected',
      name_source: 'detected',
    });
    expect(series.origin).toBe('detected');
    expect(series.nameSource).toBe('detected');
  });

  it('exposes the stored value unresolved, for writers and for debugging', () => {
    const series = rowOf<Series>(Series, { name: 'Discworld', origin: null });
    // The resolved getter is the ergonomic name on purpose; reaching past it
    // has to look deliberate, because "is this row really detected?" and "what
    // does this row say?" are different questions.
    expect(series.originRaw).toBeNull();
  });

  it('carries a pinned artwork path that stays null when nothing is pinned', () => {
    // Null is meaningful here — it means "derive the cover from the member
    // books" — so it is NOT coalesced to anything.
    expect(rowOf<Series>(Series, {}).artwork ?? null).toBeNull();
    expect(
      rowOf<Series>(Series, { artwork: 'file:///a/b.webp' }).artwork,
    ).toBe('file:///a/b.webp');
  });
});

describe('SeriesBook — membership and the canonical number', () => {
  it('reads a pre-v33 membership row as user-owned', () => {
    const row = rowOf<SeriesBook>(SeriesBook, { book_key: '/a/1.m4b' });
    expect(row.membership).toBe('user');
  });

  it('passes excluded through', () => {
    const row = rowOf<SeriesBook>(SeriesBook, { membership: 'excluded' });
    expect(row.membership).toBe('excluded');
  });

  it('leaves canonical_source null rather than claiming the user set it', () => {
    // The asymmetry that matters: null membership means "assume the user put
    // this book here", but null canonical_source means "there is no number".
    // Coalescing it would invent a number the user never entered.
    const row = rowOf<SeriesBook>(SeriesBook, { book_key: '/a/1.m4b' });
    expect(row.canonicalSource).toBeNull();
    expect(row.canonicalNumber ?? null).toBeNull();
  });

  it('reads a detected number and its source', () => {
    const row = rowOf<SeriesBook>(SeriesBook, {
      canonical_number: 3,
      canonical_source: 'detected',
    });
    expect(row.canonicalNumber).toBe(3);
    expect(row.canonicalSource).toBe('detected');
  });
});

describe('the two new tables have models', () => {
  it('SuppressedSeries maps to suppressed_series', () => {
    expect(SuppressedSeries.table).toBe('suppressed_series');
    const row = rowOf<SuppressedSeries>(SuppressedSeries, {
      name: 'Discworld',
      created_at: 1754400000000,
    });
    expect(row.name).toBe('Discworld');
    expect(row.createdAt).toEqual(new Date(1754400000000));
  });

  it('BookTag maps to book_tags and keeps the blob a string', () => {
    expect(BookTag.table).toBe('book_tags');
    const row = rowOf<BookTag>(BookTag, {
      book_id: 'abc',
      raw_json: '{"Format":"MPEG-4"}',
      captured_at: 1754400000000,
    });
    expect(row.bookId).toBe('abc');
    // Stored and returned as a string. Nothing parses it on read — the whole
    // point of the side table is that it costs nothing until asked for.
    expect(row.rawJson).toBe('{"Format":"MPEG-4"}');
    expect(row.capturedAt).toEqual(new Date(1754400000000));
  });
});

describe('Book — the captured tag columns', () => {
  it('reads null on every book imported before v33', () => {
    // No backfill ships: these fill when a file is scanned as new.
    const book = rowOf<Book>(Book, { title: 'Guards! Guards!' });
    expect(book.series ?? null).toBeNull();
    expect(book.part ?? null).toBeNull();
    expect(book.grouping ?? null).toBeNull();
    expect(book.fileFormat ?? null).toBeNull();
  });

  it('reads the tags a scan captured', () => {
    const book = rowOf<Book>(Book, {
      series: 'Discworld',
      part: 8,
      grouping: 'Discworld',
      file_format: 'MPEG-4',
    });
    // `book.series` is the RAW TAG off the file, not series membership —
    // membership lives in series_books and is keyed structurally.
    expect(book.series).toBe('Discworld');
    expect(book.part).toBe(8);
    expect(book.grouping).toBe('Discworld');
    expect(book.fileFormat).toBe('MPEG-4');
  });
});
