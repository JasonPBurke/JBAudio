import database from '@/db';
import Book from '@/db/models/Book';
import { BookEditableFields } from '@/types/Book';
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

export const getBookById = async (bookId: string): Promise<Book | null> => {
  try {
    const book = await database.get<Book>('books').find(bookId);
    return book;
  } catch (error) {
    // This will catch if the book is not found
    console.error(`Book with id ${bookId} not found.`, error);
    return null;
  }
};

export const updateBookDetails = async (
  bookId: string,
  details: Partial<BookEditableFields>
) => {
  await database.write(async () => {
    try {
      const book = await database.get<Book>('books').find(bookId);
      await book.update((b) => {
        b.title = details.bookTitle ?? b.title;
        b.narrator = details.narrator ?? b.narrator;
        b.genre = details.genre ?? b.genre;
        b.year = details.year ? parseInt(details.year, 10) : b.year;
        b.description = details.description ?? b.description;
        b.copyright = details.copyright ?? b.copyright;
      });
    } catch (error) {
      console.error('Error updating book details:', error);
    }
  });
};
