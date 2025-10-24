import { useDatabase } from '@nozbe/watermelondb/hooks';
import { Q } from '@nozbe/watermelondb';
import { Author as AuthorType } from '@/types/Book';
import Author from '@/db/models/Author';
import Book from '@/db/models/Book';
import Chapter from '@/db/models/Chapter';
import { unknownBookImageUri } from '@/constants/images';

import { useCallback } from 'react';

export const usePopulateDatabase = () => {
  const database = useDatabase();

  const populateDatabase = useCallback(
    async (authors: AuthorType[]) => {
      await database.write(async () => {
        const batchOperations = [];

        // Clear existing data (optional - remove if you want to preserve existing data)
        // await database.unsafeResetDatabase();

        for (const authorData of authors) {
          // Check if author already exists
          const existingAuthors = await database
            .get<Author>('authors')
            .query(Q.where('name', authorData.name))
            .fetch();

          let authorRecord = existingAuthors[0];

          // Create author if doesn't exist
          if (!authorRecord) {
            authorRecord = await database
              .get<Author>('authors')
              .prepareCreate((author) => {
                author.name = authorData.name;
              });
            batchOperations.push(authorRecord);
          }

          // Process books for this author
          for (const bookData of authorData.books) {
            // Check if book already exists for this author
            const existingBooks = await database
              .get<Book>('books')
              .query(
                Q.where('title', bookData.bookTitle),
                Q.where('author_id', authorRecord.id)
              )
              .fetch();

            let bookRecord = existingBooks[0];

            // Create or update book
            if (!bookRecord) {
              bookRecord = await database
                .get<Book>('books')
                .prepareCreate((book) => {
                  book.title = bookData.bookTitle;
                  book.artwork = bookData.artwork || unknownBookImageUri;
                  book.bookDuration = bookData.bookDuration || 0; // Add bookDuration
                  book.currentChapterIndex =
                    bookData.bookProgress.currentChapterIndex || 0;
                  book.currentChapterProgress =
                    bookData.bookProgress.currentChapterProgress || 0;
                  book.year = bookData.metadata.year || 0;
                  book.description = bookData.metadata.description || '';
                  book.narrator = bookData.metadata.narrator || '';
                  book.genre = bookData.metadata.genre || '';
                  book.sampleRate = bookData.metadata.sampleRate || 0;
                  book.totalTrackCount =
                    bookData.metadata.totalTrackCount ||
                    bookData.chapters.length ||
                    0;
                  book.createdAt = bookData.metadata.ctime || new Date();
                  book.updatedAt = new Date();
                  // Set the foreign key relationship
                  (book._raw as any).author_id = authorRecord.id;
                });
              batchOperations.push(bookRecord);
            } else {
              // Update existing book
              batchOperations.push(
                bookRecord.prepareUpdate((book: Book) => {
                  book.artwork = bookData.artwork || unknownBookImageUri;
                  book.bookDuration = bookData.bookDuration || 0; // Update bookDuration
                  book.currentChapterIndex =
                    bookData.bookProgress.currentChapterIndex || 0;
                  book.currentChapterProgress =
                    bookData.bookProgress.currentChapterProgress || 0;
                  book.year = bookData.metadata.year || 0;
                  book.description = bookData.metadata.description || '';
                  book.narrator = bookData.metadata.narrator || '';
                  book.genre = bookData.metadata.genre || '';
                  book.sampleRate = bookData.metadata.sampleRate || 0;
                  book.totalTrackCount =
                    bookData.metadata.totalTrackCount ||
                    bookData.chapters.length ||
                    0;
                  book.updatedAt = new Date();
                })
              );
            }

            // Clear existing chapters for this book (in case of re-scan)
            const existingChapters = await database
              .get<Chapter>('chapters')
              .query(Q.where('book_id', bookRecord.id))
              .fetch();

            for (const chapter of existingChapters) {
              batchOperations.push(chapter.prepareMarkAsDeleted());
            }

            // Create chapters for this book
            for (const chapterData of bookData.chapters) {
              const newChapter = database
                .get<Chapter>('chapters')
                .prepareCreate((chapter: Chapter) => {
                  chapter.title = chapterData.chapterTitle;
                  chapter.chapterNumber = chapterData.chapterNumber;
                  chapter.chapterDuration = chapterData.chapterDuration; // Add chapterDuration
                  chapter.url = chapterData.url;
                  // Set the foreign key relationship
                  (chapter._raw as any).book_id = bookRecord.id;
                });
              batchOperations.push(newChapter);
            }
          }
        }
        await database.batch(...batchOperations);
      });

      console.log('Database populated successfully');
    },
    [database]
  ); // Add database to useCallback dependency array

  return { populateDatabase };
};
