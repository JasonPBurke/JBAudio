import { sortBooksByRecency } from '../bookRecency';

type TestBook = {
  bookTitle: string;
  lastPlayedAt: number | null;
  finishedAt: number | null;
};

const book = (
  bookTitle: string,
  lastPlayedAt: number | null = null,
  finishedAt: number | null = null,
): TestBook => ({ bookTitle, lastPlayedAt, finishedAt });

const titles = (books: TestBook[]) => books.map((b) => b.bookTitle);

describe('sortBooksByRecency', () => {
  it('orders by lastPlayedAt descending (most recent first)', () => {
    const books = [
      book('A', 1000),
      book('B', 3000),
      book('C', 2000),
    ];

    expect(titles(sortBooksByRecency(books, 'lastPlayedAt'))).toEqual([
      'B',
      'C',
      'A',
    ]);
  });

  it('orders by finishedAt descending when that key is requested', () => {
    const books = [
      book('A', 9000, 100),
      book('B', 1000, 300),
      book('C', 5000, 200),
    ];

    expect(titles(sortBooksByRecency(books, 'finishedAt'))).toEqual([
      'B',
      'C',
      'A',
    ]);
  });

  it('places books without a timestamp after stamped books, sorted by title', () => {
    const books = [
      book('Zebra'),
      book('Apple'),
      book('Played', 500),
    ];

    expect(titles(sortBooksByRecency(books, 'lastPlayedAt'))).toEqual([
      'Played',
      'Apple',
      'Zebra',
    ]);
  });

  it('breaks timestamp ties by title, ignoring leading articles', () => {
    const books = [
      book('The Banana', 500),
      book('Apricot', 500),
      book('A Zebra', 500),
    ];

    expect(titles(sortBooksByRecency(books, 'lastPlayedAt'))).toEqual([
      'Apricot',
      'The Banana',
      'A Zebra',
    ]);
  });

  it('does not mutate the input array', () => {
    const books = [book('A', 1000), book('B', 2000)];
    const snapshot = [...books];

    sortBooksByRecency(books, 'lastPlayedAt');

    expect(books).toEqual(snapshot);
  });
});
