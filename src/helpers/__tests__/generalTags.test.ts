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
    const raw = JSON.parse(captureBookTags(audibleGeneral).rawJson!);

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
    const raw = JSON.parse(tags.rawJson!);

    expect(raw.Cover_Data).toBeUndefined();
    expect(raw.Cover).toBe('Yes');
    expect(raw.Cover_Mime).toBe('image/jpeg');
    expect(tags.rawJson!.length).toBeLessThan(2000);
  });

  test('an empty General track produces no blob to store', () => {
    expect(captureBookTags({}).rawJson).toBeUndefined();
    expect(captureBookTags(undefined).rawJson).toBeUndefined();
  });

  test('a track carrying only Cover_Data produces no blob to store', () => {
    expect(captureBookTags({ Cover_Data: 'abc' }).rawJson).toBeUndefined();
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
