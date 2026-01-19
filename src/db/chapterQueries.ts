import database from '@/db'; // Your WatermelonDB database instance
import Book from './models/Book';

export const updateChapterProgressInDB = async (
  bookId: string,
  progress: number
) => {
  const book = (await database.collections
    .get('books')
    .find(bookId)) as Book;

  if (book) {
    await book.updateCurrentChapterProgress(progress);
  }
};

export const updateChapterIndexInDB = async (
  bookId: string,
  index: number
) => {
  // Guard against invalid indices (defense in depth)
  if (typeof index !== 'number' || index < 0) {
    console.warn(
      `Attempted to write invalid chapterIndex ${index} for book ${bookId}`
    );
    return;
  }

  const book = (await database.collections
    .get('books')
    .find(bookId)) as Book;

  if (book) {
    await book.updateCurrentChapterIndex(index);
  }
};

export const getChapterProgressInDB = async (bookId: string) => {
  const book = (await database.collections
    .get('books')
    .find(bookId)) as Book;

  if (book) {
    // return book.currentChapterProgress;
    return {
      progress: book.currentChapterProgress,
      chapterIndex: book.currentChapterIndex,
    };
  }
};
