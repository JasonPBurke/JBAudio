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
    return book.currentChapterProgress;
  }
};
