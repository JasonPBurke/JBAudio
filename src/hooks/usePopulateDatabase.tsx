import database from '@/db';
import { Q } from '@nozbe/watermelondb';
import { Author as AuthorType, Book as BookType } from '@/types/Book';
import Author from '@/db/models/Author';
import Book from '@/db/models/Book';
import Chapter from '@/db/models/Chapter';
import Settings from '@/db/models/Settings'; // Import Settings model
import { unknownBookImageUri } from '@/constants/images';

/**
 * Populates a single book into the database.
 * Creates the author if it doesn't exist.
 * Used for progressive/incremental book loading during scans.
 */
export const populateSingleBook = async (
  authorName: string,
  bookData: BookType
) => {
  await database.write(async () => {
    const batchOperations = [];

    // Check if author already exists
    const existingAuthors = await database
      .get<Author>('authors')
      .query(Q.where('name', authorName))
      .fetch();

    let authorRecord = existingAuthors[0];

    // Create author if doesn't exist
    if (!authorRecord) {
      authorRecord = await database
        .get<Author>('authors')
        .prepareCreate((author) => {
          author.name = authorName;
        });
      batchOperations.push(authorRecord);
    }

    // Find books with the same title for this author
    const booksWithSameTitle = await database
      .get<Book>('books')
      .query(
        Q.where('author_id', authorRecord.id),
        Q.where('title', bookData.bookTitle)
      )
      .fetch();

    let bookRecord: Book | undefined;
    for (const book of booksWithSameTitle) {
      const chapters = await (book.chapters as any).fetch();
      if (
        chapters.some((chapter: Chapter) => chapter.url === bookData.bookId)
      ) {
        bookRecord = book;
        break;
      }
    }

    // Create or update book
    if (!bookRecord) {
      bookRecord = await database.get<Book>('books').prepareCreate((book) => {
        book.title = bookData.bookTitle;
        book.artwork = bookData.artwork || unknownBookImageUri;
        book.artworkHeight = bookData.artworkHeight || null;
        book.artworkWidth = bookData.artworkWidth || null;
        book.coverColorAverage = bookData.artworkColors.average || null;
        book.coverColorDominant = bookData.artworkColors.dominant || null;
        book.coverColorVibrant = bookData.artworkColors.vibrant || null;
        book.coverColorDarkVibrant = bookData.artworkColors.darkVibrant || null;
        book.coverColorLightVibrant =
          bookData.artworkColors.lightVibrant || null;
        book.coverColorMuted = bookData.artworkColors.muted || null;
        book.coverColorDarkMuted = bookData.artworkColors.darkMuted || null;
        book.coverColorLightMuted = bookData.artworkColors.lightMuted || null;
        book.bookDuration = bookData.bookDuration || 0;
        book.currentChapterIndex =
          bookData.bookProgress.currentChapterIndex || 0;
        book.currentChapterProgress =
          bookData.bookProgress.currentChapterProgress || 0;
        book.year = bookData.metadata.year || 0;
        book.description = bookData.metadata.description || '';
        book.copyright = bookData.metadata.copyright || '';
        book.narrator = bookData.metadata.narrator || '';
        book.genre = bookData.metadata.genre || '';
        book.sampleRate = bookData.metadata.sampleRate || 0;
        book.bitrate = bookData.metadata.bitrate || 0;
        book.codec = bookData.metadata.codec || '';
        book.totalTrackCount =
          bookData.metadata.totalTrackCount || bookData.chapters.length || 0;
        book.createdAt = bookData.metadata.ctime || new Date();
        book.updatedAt = new Date();
        book.bookProgressValue = 0;
        // Set the foreign key relationship
        (book._raw as any).author_id = authorRecord.id;
      });
      batchOperations.push(bookRecord);
    } else {
      // Update existing book
      batchOperations.push(
        bookRecord.prepareUpdate((book: Book) => {
          book.artwork = bookData.artwork || unknownBookImageUri;
          book.artworkHeight = bookData.artworkHeight || null;
          book.artworkWidth = bookData.artworkWidth || null;
          book.coverColorAverage = bookData.artworkColors.average || null;
          book.coverColorDominant = bookData.artworkColors.dominant || null;
          book.coverColorVibrant = bookData.artworkColors.vibrant || null;
          book.coverColorDarkVibrant =
            bookData.artworkColors.darkVibrant || null;
          book.coverColorLightVibrant =
            bookData.artworkColors.lightVibrant || null;
          book.coverColorMuted = bookData.artworkColors.muted || null;
          book.coverColorDarkMuted = bookData.artworkColors.darkMuted || null;
          book.coverColorLightMuted = bookData.artworkColors.lightMuted || null;
          book.bookDuration = bookData.bookDuration || 0;
          book.currentChapterIndex =
            bookData.bookProgress.currentChapterIndex || 0;
          book.currentChapterProgress =
            bookData.bookProgress.currentChapterProgress || 0;
          book.year = bookData.metadata.year || 0;
          book.description = bookData.metadata.description || '';
          book.narrator = bookData.metadata.narrator || '';
          book.copyright = bookData.metadata.copyright || '';
          book.genre = bookData.metadata.genre || '';
          book.sampleRate = bookData.metadata.sampleRate || 0;
          book.bitrate = bookData.metadata.bitrate || 0;
          book.codec = bookData.metadata.codec || '';
          book.totalTrackCount =
            bookData.metadata.totalTrackCount || bookData.chapters.length || 0;
          book.updatedAt = new Date();
        })
      );
    }

    // Clear existing chapters for this book (in case of re-scan)
    // Use destroyPermanently instead of markAsDeleted to avoid soft-deleted
    // chapters appearing in relation fetches
    const existingChapters = await database
      .get<Chapter>('chapters')
      .query(Q.where('book_id', bookRecord.id))
      .fetch();

    for (const chapter of existingChapters) {
      batchOperations.push(chapter.prepareDestroyPermanently());
    }

    // Create chapters for this book
    for (const chapterData of bookData.chapters) {
      const newChapter = database
        .get<Chapter>('chapters')
        .prepareCreate((chapter: Chapter) => {
          chapter.title = chapterData.chapterTitle;
          chapter.chapterNumber = chapterData.chapterNumber;
          chapter.chapterDuration = chapterData.chapterDuration;
          chapter.url = chapterData.url;
          chapter.startMs = chapterData.startMs;
          // Set the foreign key relationship
          (chapter._raw as any).book_id = bookRecord.id;
        });
      batchOperations.push(newChapter);
    }

    await database.batch(batchOperations);
  });
};

export const populateDatabase = async (authors: AuthorType[]) => {
  await database.write(async () => {
    const batchOperations = [];

    // Clear existing data (optional - remove if you want to preserve existing data)
    // await database.unsafeResetDatabase();

    // Ensure a Settings record exists
    const settingsCollection =
      database.collections.get<Settings>('settings');
    const existingSettings = await settingsCollection.query().fetch();

    if (existingSettings.length === 0) {
      const newSettings = settingsCollection.prepareCreate((settings) => {
        // Default values
        settings.bookFolder = '';
        settings.numColumns = 2;
        settings.timerActive = false;
        settings.timerDuration = null;
        settings.sleepTime = null;
        settings.timerFadeoutDuration = null;
        settings.customTimer = null;
        settings.timerChapters = null;
        settings.lastActiveBook = null;
      });
      batchOperations.push(newSettings);
    }

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
        // Find books with the same title for this author
        const booksWithSameTitle = await database
          .get<Book>('books')
          .query(
            Q.where('author_id', authorRecord.id),
            Q.where('title', bookData.bookTitle)
          )
          .fetch();

        let bookRecord: Book | undefined;
        for (const book of booksWithSameTitle) {
          const chapters = await (book.chapters as any).fetch();
          if (
            chapters.some(
              (chapter: Chapter) => chapter.url === bookData.bookId
            )
          ) {
            bookRecord = book;
            break;
          }
        }

        // Create or update book
        if (!bookRecord) {
          bookRecord = await database
            .get<Book>('books')
            .prepareCreate((book) => {
              book.title = bookData.bookTitle;
              book.artwork = bookData.artwork || unknownBookImageUri;
              book.artworkHeight = bookData.artworkHeight || null;
              book.artworkWidth = bookData.artworkWidth || null;
              book.coverColorAverage =
                bookData.artworkColors.average || null;
              book.coverColorDominant =
                bookData.artworkColors.dominant || null;
              book.coverColorVibrant =
                bookData.artworkColors.vibrant || null;
              book.coverColorDarkVibrant =
                bookData.artworkColors.darkVibrant || null;
              book.coverColorLightVibrant =
                bookData.artworkColors.lightVibrant || null;
              book.coverColorMuted = bookData.artworkColors.muted || null;
              book.coverColorDarkMuted =
                bookData.artworkColors.darkMuted || null;
              book.coverColorLightMuted =
                bookData.artworkColors.lightMuted || null;
              book.bookDuration = bookData.bookDuration || 0; // Add bookDuration
              book.currentChapterIndex =
                bookData.bookProgress.currentChapterIndex || 0;
              book.currentChapterProgress =
                bookData.bookProgress.currentChapterProgress || 0;
              book.year = bookData.metadata.year || 0;
              book.description = bookData.metadata.description || '';
              book.copyright = bookData.metadata.copyright || '';
              book.narrator = bookData.metadata.narrator || '';
              book.genre = bookData.metadata.genre || '';
              book.sampleRate = bookData.metadata.sampleRate || 0;
              book.bitrate = bookData.metadata.bitrate || 0;
              book.codec = bookData.metadata.codec || '';
              book.totalTrackCount =
                bookData.metadata.totalTrackCount ||
                bookData.chapters.length ||
                0;
              book.createdAt = bookData.metadata.ctime || new Date();
              book.updatedAt = new Date();
              book.bookProgressValue = 0;
              // Set the foreign key relationship
              (book._raw as any).author_id = authorRecord.id;
            });
          batchOperations.push(bookRecord);
        } else {
          // Update existing book //! DO I WANT TO UPDATE AN EXISTING BOOK???
          batchOperations.push(
            bookRecord.prepareUpdate((book: Book) => {
              book.artwork = bookData.artwork || unknownBookImageUri;
              book.artworkHeight = bookData.artworkHeight || null;
              book.artworkWidth = bookData.artworkWidth || null;
              book.coverColorAverage =
                bookData.artworkColors.average || null;
              book.coverColorDominant =
                bookData.artworkColors.dominant || null;
              book.coverColorVibrant =
                bookData.artworkColors.vibrant || null;
              book.coverColorDarkVibrant =
                bookData.artworkColors.darkVibrant || null;
              book.coverColorLightVibrant =
                bookData.artworkColors.lightVibrant || null;
              book.coverColorMuted = bookData.artworkColors.muted || null;
              book.coverColorDarkMuted =
                bookData.artworkColors.darkMuted || null;
              book.coverColorLightMuted =
                bookData.artworkColors.lightMuted || null;
              book.bookDuration = bookData.bookDuration || 0; // Update bookDuration
              book.currentChapterIndex =
                bookData.bookProgress.currentChapterIndex || 0;
              book.currentChapterProgress =
                bookData.bookProgress.currentChapterProgress || 0;
              book.year = bookData.metadata.year || 0;
              book.description = bookData.metadata.description || '';
              book.narrator = bookData.metadata.narrator || '';
              book.copyright = bookData.metadata.copyright || '';
              book.genre = bookData.metadata.genre || '';
              book.sampleRate = bookData.metadata.sampleRate || 0;
              book.bitrate = bookData.metadata.bitrate || 0;
              book.codec = bookData.metadata.codec || '';
              book.totalTrackCount =
                bookData.metadata.totalTrackCount ||
                bookData.chapters.length ||
                0;
              book.updatedAt = new Date();
            })
          );
        }

        // Clear existing chapters for this book (in case of re-scan)
        // Use destroyPermanently instead of markAsDeleted to avoid soft-deleted
        // chapters appearing in relation fetches
        const existingChapters = await database
          .get<Chapter>('chapters')
          .query(Q.where('book_id', bookRecord.id))
          .fetch();

        for (const chapter of existingChapters) {
          batchOperations.push(chapter.prepareDestroyPermanently());
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
              chapter.startMs = chapterData.startMs;
              // Set the foreign key relationship
              (chapter._raw as any).book_id = bookRecord.id;
            });
          batchOperations.push(newChapter);
        }
      }
    }
    await database.batch(batchOperations);
  });

  // console.log('Database populated successfully');
};
