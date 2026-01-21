import database from '@/db';
import Book from '@/db/models/Book';
import Author from '@/db/models/Author';
import { BookEditableFields } from '@/types/Book';
import { Q, Query, Relation } from '@nozbe/watermelondb';
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
      const authorRelation = book.author as unknown as Relation<Author>;
      const currentAuthor = await authorRelation.fetch();
      const currentAuthorName = currentAuthor?.name ?? '';

      // Handle author change
      const trimmedAuthorName = details.author?.trim();
      if (
        trimmedAuthorName &&
        trimmedAuthorName.toLowerCase() !== currentAuthorName.toLowerCase()
      ) {
        // Find existing author by name (case-insensitive)
        const existingAuthors = await database
          .get<Author>('authors')
          .query()
          .fetch();

        let newAuthor = existingAuthors.find(
          (a) => a.name.toLowerCase() === trimmedAuthorName.toLowerCase()
        );

        // Create author if doesn't exist
        if (!newAuthor) {
          newAuthor = await database
            .get<Author>('authors')
            .create((author) => {
              author.name = trimmedAuthorName;
            });
        }

        // Update book's author relation
        await book.update((b) => {
          (b.author as unknown as Relation<Author>).set(newAuthor!);
        });

        // Clean up orphaned old author
        if (currentAuthor) {
          const booksQuery = currentAuthor.books as unknown as Query<Book>;
          const remainingBooks = await booksQuery
            .extend(Q.where('id', Q.notEq(bookId)))
            .fetchCount();
          if (remainingBooks === 0) {
            await currentAuthor.markAsDeleted();
          }
        }
      }

      // Update other book fields
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
