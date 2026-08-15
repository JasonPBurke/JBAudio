import { captureBookTags } from '@/helpers/generalTags';
import {
  groupChaptersIntoBooks,
  type ScannedChapter,
} from '@/helpers/scannedBookGrouping';

/**
 * These tests deliberately span TWO modules — `captureBookTags` produces the
 * tag blob per FILE, `groupChaptersIntoBooks` keeps one per BOOK — because
 * that gap is the whole subject. The cost is paid at the producer, which
 * cannot know it is about to be discarded, and the first-file-wins rule is
 * stated at the consumer. Neither half is meaningful alone: capture on its own
 * looks free, and grouping on its own has nothing to count.
 */

const generalFor = (title: string) => ({
  '@type': 'General',
  Format: 'MPEG-4',
  Album: title,
  Performer: 'Christopher Buehlman',
  extra: { SERIES: 'Blacktongue', PART: '2' },
});

/**
 * One file's worth of scan output. `rawTagsJson` comes from the real
 * `captureBookTags` rather than a hand-written stand-in: a fixture that
 * fabricates the blob would count nothing and pass either way.
 */
function scannedChapter(
  bookTitle: string,
  chapterNumber: number,
  general: object = generalFor(bookTitle),
): ScannedChapter {
  const tags = captureBookTags(general);

  return {
    author: 'Christopher Buehlman',
    narrator: 'Nikki Garcia',
    bookTitle,
    chapterTitle: `Chapter ${chapterNumber}`,
    chapterNumber,
    year: 2024,
    series: tags.series,
    part: tags.part,
    grouping: tags.grouping,
    fileFormat: tags.fileFormat,
    rawTagsJson: tags.rawJson,
    artworkUri: null,
    totalTrackCount: 5,
    coverBase64: null,
    coverWidth: null,
    coverHeight: null,
    ctime: new Date('2024-06-25T00:00:00Z'),
    chapterDuration: 600,
    startMs: 0,
    url: `/library/${bookTitle}/${chapterNumber}.m4b`,
  };
}

describe('groupChaptersIntoBooks · the tag blob is stringified once per BOOK', () => {
  let stringify: jest.SpyInstance;

  beforeEach(() => {
    stringify = jest.spyOn(JSON, 'stringify');
  });

  afterEach(() => {
    stringify.mockRestore();
  });

  test('a five-file book pays for one JSON.stringify, not five', () => {
    const chapters = [1, 2, 3, 4, 5].map((n) =>
      scannedChapter("The Daughters' War", n),
    );

    const books = groupChaptersIntoBooks(chapters);

    expect(books).toHaveLength(1);
    expect(stringify).toHaveBeenCalledTimes(1);
  });

  test('two books in one directory pay for one each', () => {
    const chapters = [
      scannedChapter("The Daughters' War", 1),
      scannedChapter("The Daughters' War", 2),
      scannedChapter('The Blacktongue Thief', 1),
      scannedChapter('The Blacktongue Thief', 2),
    ];

    const books = groupChaptersIntoBooks(chapters);

    expect(books).toHaveLength(2);
    expect(stringify).toHaveBeenCalledTimes(2);
  });

  /**
   * `Book.metadata` is `{ [key: string]: any }`, so a forgotten `()` at the
   * call site type-checks. WatermelonDB's `@text` setter then coerces the
   * function to null and `book_tags.raw_json` silently empties — a defect no
   * type and no screen would show. This is the test that stands in for both.
   */
  test('what lands on the book is the string itself, never the thunk', () => {
    const [{ book }] = groupChaptersIntoBooks([
      scannedChapter("The Daughters' War", 1),
    ]);

    expect(typeof book.metadata.rawTagsJson).toBe('string');
    expect(JSON.parse(book.metadata.rawTagsJson).Album).toBe(
      "The Daughters' War",
    );
  });
});

describe('groupChaptersIntoBooks · first file wins, unchanged', () => {
  test('the blob is the FIRST file’s, not the last one seen', () => {
    const first = scannedChapter("The Daughters' War", 1, {
      Album: "The Daughters' War",
      extra: { SUBTITLE: 'read off file 1' },
    });
    const second = scannedChapter("The Daughters' War", 2, {
      Album: "The Daughters' War",
      extra: { SUBTITLE: 'read off file 2' },
    });

    const [{ book }] = groupChaptersIntoBooks([first, second]);

    expect(JSON.parse(book.metadata.rawTagsJson).extra.SUBTITLE).toBe(
      'read off file 1',
    );
  });

  test('a book whose first file carried no tags stores no blob', () => {
    const chapter = scannedChapter("The Daughters' War", 1, {});

    const [{ book }] = groupChaptersIntoBooks([chapter]);

    expect(book.metadata.rawTagsJson).toBeUndefined();
  });
});
