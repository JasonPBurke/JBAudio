import database from '@/db'; // Your WatermelonDB database instance

export const updateChapterProgressInDB = async (
  bookId: string,
  progress: number
) => {
  await database.write(async () => {
    const bookCollection = database.collections.get('books'); // Your track collection
    const book = await bookCollection.find(bookId);
    console.log('book in chapterQueries', book);
    if (book) {
      await book.update((b) => {
        // b.currentChapterProgress = progress;
      });
    }
  });
};
