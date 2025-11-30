import database from '@/db';
import Book from '@/db/models/Book';
import { Observable } from 'rxjs';

export function observeTotalBookCount(): Observable<number> {
  const booksCollection = database.collections.get<Book>('books');
  return booksCollection.query().observeCount(false);
}

export async function getTotalBookCount(): Promise<number> {
  const booksCollection = database.collections.get<Book>('books');
  const count = await booksCollection.query().fetchCount();
  return count;
}

export async function getBookProgressValue(
  bookId: string
): Promise<number> {
  const book = (await database.collections
    .get('books')
    .find(bookId)) as Book;

  return book.bookProgressValue;
}

export async function updateBookProgressValue(
  bookId: string,
  progress: number
): Promise<void> {
  const book = (await database.collections
    .get('books')
    .find(bookId)) as Book;

  if (book) {
    await book.update((book) => {
      book.bookProgressValue = progress;
    });
  }
}
