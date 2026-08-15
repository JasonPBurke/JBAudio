import { captureBookTags, readReleaseDate } from '@/helpers/generalTags';

/**
 * Shapes taken from the real 304-record device pull
 * (`.scratch/series-ux-redesign/research/01-signal-inventory/device_general.jsonl`):
 * iTunes' `©grp` arrives as a TOP-LEVEL `Grouping`, while Audible's freeform
 * atoms arrive under `extra`.
 */
const audibleGeneral = {
  '@type': 'General',
  Format: 'MPEG-4',
  FileExtension: 'm4b',
  Album: "The Daughters' War",
  Performer: 'Christopher Buehlman',
  extra: {
    prID: 'BK_AREN_006685',
    nrt: 'Nikki Garcia',
    rldt: '25-Jun-2024',
    SERIES: 'Blacktongue',
    PART: '2',
    SUBTITLE: 'Blacktongue, Book 2',
  },
};

describe('captureBookTags · the four columns', () => {
  test('series comes from extra.SERIES', () => {
    expect(captureBookTags(audibleGeneral).series).toBe('Blacktongue');
  });

  test('part comes from extra.PART, parsed to a number', () => {
    expect(captureBookTags(audibleGeneral).part).toBe(2);
  });

  test('fileFormat comes from Format', () => {
    expect(captureBookTags(audibleGeneral).fileFormat).toBe('MPEG-4');
  });

  test('grouping comes from the TOP-LEVEL Grouping, not from extra', () => {
    const tags = captureBookTags({
      Grouping: 'The Dresden Files',
      extra: { GROUPING: 'wrong bag' },
    });

    expect(tags.grouping).toBe('The Dresden Files');
  });

  test('a series that lives only in extra is not read from the top level', () => {
    expect(captureBookTags({ SERIES: 'Not where Audible puts it' }).series)
      .toBeUndefined();
  });

  test('absent tags are undefined, never empty strings or zero', () => {
    const tags = captureBookTags({ Format: 'MPEG Audio' });

    expect(tags.series).toBeUndefined();
    expect(tags.part).toBeUndefined();
    expect(tags.grouping).toBeUndefined();
  });

  test('blank and whitespace-only tags read as absent', () => {
    const tags = captureBookTags({
      Format: '   ',
      Grouping: '',
      extra: { SERIES: '  ', PART: '' },
    });

    expect(tags.fileFormat).toBeUndefined();
    expect(tags.grouping).toBeUndefined();
    expect(tags.series).toBeUndefined();
    expect(tags.part).toBeUndefined();
  });

  test('surrounding whitespace is trimmed off the values that survive', () => {
    const tags = captureBookTags({
      Grouping: ' Warbreaker 1 ',
      extra: { SERIES: ' Blacktongue ', PART: ' 2 ' },
    });

    expect(tags.grouping).toBe('Warbreaker 1');
    expect(tags.series).toBe('Blacktongue');
    expect(tags.part).toBe(2);
  });

  test('a non-numeric PART is dropped rather than stored as NaN', () => {
    expect(captureBookTags({ extra: { PART: '3 / 3' } }).part).toBeUndefined();
    expect(captureBookTags({ extra: { PART: 'Book Two' } }).part)
      .toBeUndefined();
  });
});

describe('captureBookTags · the raw blob', () => {
  test('keeps the whole General track, extra bag included', () => {
    const raw = JSON.parse(captureBookTags(audibleGeneral).rawJson!());

    expect(raw.Album).toBe("The Daughters' War");
    expect(raw.extra.SUBTITLE).toBe('Blacktongue, Book 2');
    expect(raw.extra.prID).toBe('BK_AREN_006685');
  });

  test('drops Cover_Data — it is base64 artwork, not a tag', () => {
    const tags = captureBookTags({
      ...audibleGeneral,
      Cover: 'Yes',
      Cover_Mime: 'image/jpeg',
      Cover_Data: 'iVBORw0KGgoAAAANSUhEUg'.repeat(5000),
    });
    const raw = JSON.parse(tags.rawJson!());

    expect(raw.Cover_Data).toBeUndefined();
    expect(raw.Cover).toBe('Yes');
    expect(raw.Cover_Mime).toBe('image/jpeg');
    expect(tags.rawJson!().length).toBeLessThan(2000);
  });

  test('an empty General track produces no blob to store', () => {
    expect(captureBookTags({}).rawJson).toBeUndefined();
    expect(captureBookTags(undefined).rawJson).toBeUndefined();
  });

  test('a track carrying only Cover_Data produces no blob to store', () => {
    expect(captureBookTags({ Cover_Data: 'abc' }).rawJson).toBeUndefined();
  });
});

/**
 * The blob is deferred because grouping keeps one per BOOK and throws the rest
 * away (see `scannedBookGrouping.test.ts` for the count). Deferral is only
 * worth having if what it retains is small — a thunk closing over the live
 * General track would pin `Cover_Data`, hundreds of KB per file across ~3,880
 * files, and read as an optimisation while being far worse than the waste it
 * replaced.
 *
 * Retention is not directly observable, so it is proved in two halves: the
 * closure holds a COPY (mutating the source afterwards changes nothing), and
 * producing that copy never so much as READS the cover value. A copy that
 * never touched the bytes cannot be holding them.
 */
describe('captureBookTags · what the deferred blob retains', () => {
  test('capturing does no stringify work at all — that is the point', () => {
    const stringify = jest.spyOn(JSON, 'stringify');

    try {
      captureBookTags(audibleGeneral);
      expect(stringify).not.toHaveBeenCalled();
    } finally {
      stringify.mockRestore();
    }
  });

  test('the cover bytes are never read, at capture or at stringify', () => {
    let coverReads = 0;
    const track: Record<string, unknown> = {
      Format: 'MPEG-4',
      Album: 'Artemis',
    };
    Object.defineProperty(track, 'Cover_Data', {
      enumerable: true,
      configurable: true,
      get() {
        coverReads += 1;
        return 'iVBORw0KGgoAAAANSUhEUg'.repeat(20000);
      },
    });

    const tags = captureBookTags(track);
    expect(coverReads).toBe(0);

    // Still 0 once the blob is actually produced: a spread-then-delete prune
    // would have read it here, and a thunk over the live track would read it
    // on every call.
    expect(JSON.parse(tags.rawJson!()).Cover_Data).toBeUndefined();
    expect(coverReads).toBe(0);
  });

  test('the blob is taken from a copy, not from the live track', () => {
    const track: Record<string, unknown> = {
      Album: 'Artemis',
      Format: 'MPEG-4',
    };

    const tags = captureBookTags(track);
    track.Album = 'rewritten long after the file was read';
    track.Cover_Data = 'iVBORw0KGgoAAAANSUhEUg'.repeat(20000);

    const raw = JSON.parse(tags.rawJson!());
    expect(raw.Album).toBe('Artemis');
    expect(raw.Cover_Data).toBeUndefined();
  });

  test('the blob is byte-identical with and without cover bytes', () => {
    const bare = {
      ...audibleGeneral,
      Cover: 'Yes',
      Cover_Mime: 'image/jpeg',
    };
    const withCover = {
      ...bare,
      Cover_Data: 'iVBORw0KGgoAAAANSUhEUg'.repeat(20000),
    };

    expect(captureBookTags(withCover).rawJson!()).toBe(
      captureBookTags(bare).rawJson!(),
    );
  });

  test('called twice it returns the same JSON both times', () => {
    const rawJson = captureBookTags(audibleGeneral).rawJson!;

    expect(rawJson()).toBe(rawJson());
  });

  /**
   * `book_tags.raw_json` is stored bytes, so key ORDER is part of the output,
   * not an implementation detail. Pruning copies the surviving keys across in
   * their original order and closes the gap the cover leaves behind — the
   * exact bytes the eager version wrote.
   */
  test('surviving keys keep their original order across the dropped cover', () => {
    const tags = captureBookTags({
      Format: 'MPEG-4',
      Cover_Data: 'iVBORw0KGgo',
      Album: 'Artemis',
    });

    expect(tags.rawJson!()).toBe('{"Format":"MPEG-4","Album":"Artemis"}');
  });
});

describe('readReleaseDate', () => {
  test('prefers Recorded_Date', () => {
    expect(
      readReleaseDate({ Recorded_Date: '2022', extra: { rldt: '14-Nov-2017' } }),
    ).toBe('2022');
  });

  test('falls back to extra.rldt — 47/304 real files, 0 at the top level', () => {
    expect(readReleaseDate({ extra: { rldt: '14-Nov-2017' } })).toBe(
      '14-Nov-2017',
    );
  });

  test('a top-level rldt still wins over the later fallbacks', () => {
    expect(readReleaseDate({ rldt: '2019', Tagged_Date: '2001' })).toBe('2019');
  });

  test('extra.rldt beats Original_Date and Tagged_Date', () => {
    expect(
      readReleaseDate({
        Original_Date: '1999',
        Tagged_Date: '2001',
        extra: { rldt: '14-Nov-2017' },
      }),
    ).toBe('14-Nov-2017');
  });

  test('falls through to Tagged_Date and Original_Year', () => {
    expect(readReleaseDate({ Tagged_Date: '2001' })).toBe('2001');
    expect(readReleaseDate({ Original_Year: '1998' })).toBe('1998');
  });

  test('undefined when the track says nothing about a date', () => {
    expect(readReleaseDate({ Album: 'Artemis' })).toBeUndefined();
    expect(readReleaseDate(undefined)).toBeUndefined();
  });
});
