import database from '@/db'; // Your WatermelonDB database instance
import Book from './models/Book';

export const updateChapterProgressInDB = async (
  bookId: string,
  progress: number
) => {
  const book = (await database.collections
    .get('books')
    .find(bookId)) as Book;
  console.log('progress in chapterQueries', progress);

  if (book) {
    await book.updateCurrentChapterProgress(progress);
  }
};

export const getChapterProgressInDB = async (bookId: string) => {
  const book = (await database.collections
    .get('books')
    .find(bookId)) as Book;

  if (book) {
    console.log(
      'book.currentChapterProgress from DB',
      book.currentChapterProgress
    );
    return book.currentChapterProgress;
  }
};
