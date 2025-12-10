import { Author, Book, Chapter } from '@/types/Book';
import { create, StoreApi, UseBoundStore } from 'zustand';
import { combine } from 'zustand/middleware';
import { useCallback } from 'react';
import database from '@/db';
import { shallow, useShallow } from 'zustand/shallow';
import { Subscription } from 'rxjs';
import AuthorModel from '@/db/models/Author';
import BookModel from '@/db/models/Book';
import ChapterModel from '@/db/models/Chapter';
import { Q } from '@nozbe/watermelondb';

/**
 * Using a mapped type for books allows for O(1) lookup time, which is much more
 * performant than iterating through a large array to find a book by its ID.
 */
type BookMap = Record<string, Book>;

interface LibraryState {
  authors: Author[];
  books: BookMap; // New: Normalized book data for efficient lookups.
  setAuthors: (authors: Author[]) => void;
  // getAuthors is removed as direct access is less safe. Selectors are preferred.
  playbackProgress: Record<string, number>; // New: Stores real-time playback progress
  playbackIndex: Record<string, number>; // New: Stores real-time playback progress

  setPlaybackProgress: (bookId: string, progress: number) => void;
  setPlaybackIndex: (bookId: string, index: number) => void;
  getPlaybackProgress: (bookId: string) => number;
  getPlaybackIndex: (bookId: string) => number;
  init: () => () => void; // Function to initialize and return cleanup
  updateBookChapterIndex: (
    bookId: string,
    chapterIndex: number
  ) => Promise<void>;
}

// Let TypeScript infer the store type from the create call.
export const useLibraryStore: UseBoundStore<StoreApi<LibraryState>> =
  create<LibraryState>()((set, get) => ({
    authors: [],
    books: {},
    playbackProgress: {},
    playbackIndex: {},
    setAuthors: (authors: Author[]) => set({ authors }),
    setPlaybackProgress: (bookId: string, progress: number) =>
      set((state) => ({
        playbackProgress: {
          ...state.playbackProgress,
          [bookId]: progress,
        },
      })),
    setPlaybackIndex: (bookId: string, index: number) =>
      set((state) => ({
        playbackIndex: {
          ...state.playbackIndex,
          [bookId]: index,
        },
      })),
    updateBookChapterIndex: async (
      bookId: string,
      chapterIndex: number
    ) => {
      await database.write(async () => {
        const book = await database.collections
          .get<BookModel>('books')
          .find(bookId);
        await book.update((record) => {
          record.currentChapterIndex = chapterIndex;
        });
      });
    },
    getPlaybackProgress: (bookId: string) => get().playbackProgress[bookId],
    getPlaybackIndex: (bookId: string) => get().playbackIndex[bookId],
    init: () => {
      const booksCollection = database.collections.get<BookModel>('books');

      const subscriptions: Subscription[] = [];

      const booksSubscription = booksCollection
        .query()
        .observeWithColumns([
          'book_progress_value',
          'title',
          'narrator',
          'genre',
          'year',
          'description',
          'copyright',
        ])
        .subscribe(async (changedRecords) => {
          console.log(
            `Zustand observer fired with ${changedRecords.length} changed records.`
          );
          const { books: currentBooks } = get();

          // Create a mutable copy of the current books map
          const newBookMap = { ...currentBooks };
          let authorsNeedRebuild = false;

          // Helper function to convert a BookModel to a Book object
          const convertBookModelToBook = async (
            bookModel: BookModel
          ): Promise<Book> => {
            // Use .fetch() which is the correct WatermelonDB API
            const authorModel = await (bookModel.author as any).fetch();
            const chapterModels = await (bookModel.chapters as any).fetch();

            const chaptersData: Chapter[] = chapterModels.map(
              (chapter: ChapterModel) => ({
                author: authorModel?.name ?? 'Unknown Author',
                bookTitle: bookModel.title,
                chapterTitle: chapter.title,
                chapterNumber: chapter.chapterNumber,
                chapterDuration: chapter.chapterDuration,
                startMs: chapter.startMs,
                url: chapter.url,
              })
            );

            const bookData: Book = {
              bookId: bookModel.id,
              author: authorModel?.name ?? 'Unknown Author',
              bookTitle: bookModel.title,
              chapters: chaptersData,
              artwork: bookModel.artwork,
              artworkHeight: bookModel.artworkHeight,
              artworkWidth: bookModel.artworkWidth,
              artworkColors: {
                average: bookModel.coverColorAverage,
                dominant: bookModel.coverColorDominant,
                vibrant: bookModel.coverColorVibrant,
                darkVibrant: bookModel.coverColorDarkVibrant,
                lightVibrant: bookModel.coverColorLightVibrant,
                muted: bookModel.coverColorMuted,
                darkMuted: bookModel.coverColorDarkMuted,
                lightMuted: bookModel.coverColorLightMuted,
              },
              bookDuration: bookModel.bookDuration,
              bookProgress: {
                currentChapterIndex: bookModel.currentChapterIndex,
                currentChapterProgress: bookModel.currentChapterProgress,
              },
              bookProgressValue: bookModel.bookProgressValue,
              metadata: {
                year: bookModel.year?.toString(),
                description: bookModel.description,
                narrator: bookModel.narrator,
                genre: bookModel.genre,
                sampleRate: bookModel.sampleRate,
                bitrate: bookModel.bitrate,
                codec: bookModel.codec,
                copyright: bookModel.copyright,
                totalTrackCount: bookModel.totalTrackCount,
                ctime: bookModel.createdAt,
                mtime: bookModel.updatedAt,
              },
            };
            return bookData;
          };

          // Process each changed record
          for (const bookModel of changedRecords) {
            const existingBook = newBookMap[bookModel.id];

            // If the book was deleted, remove it from our map
            if (bookModel._raw._status === 'deleted') {
              delete newBookMap[bookModel.id];
              authorsNeedRebuild = true;
              continue;
            }

            // If the book is new or its author changed, we need to rebuild the authors list
            if (
              !existingBook ||
              existingBook.author !== bookModel.author.id
            ) {
              authorsNeedRebuild = true;
            }

            // Convert the updated WatermelonDB model to our Zustand state shape
            const newBookData = await convertBookModelToBook(bookModel);
            newBookMap[bookModel.id] = newBookData;
          }

          // Re-group books by author and create the final authors array.
          // This is more efficient than the previous full rebuild.
          const authorsMap = new Map<string, Book[]>();
          for (const book of Object.values(newBookMap)) {
            if (!authorsMap.has(book.author)) {
              authorsMap.set(book.author, []);
            }
            authorsMap.get(book.author)!.push(book);
          }

          const finalAuthorsData: Author[] = Array.from(
            authorsMap.entries()
          )
            .map(([name, books]) => ({
              name,
              books,
            }))
            .sort((a, b) => a.name.localeCompare(b.name));

          set({
            authors: finalAuthorsData,
            books: newBookMap,
          });
        });

      subscriptions.push(booksSubscription);

      return () => {
        subscriptions.forEach((sub) => sub.unsubscribe());
      };
    },
    // The rest of your store logic is now inside the combine middleware
  }));

// This part of the file remains unchanged, but I'm including it for context.
/*
  getPlaybackProgress: (bookId: string) => get().playbackProgress[bookId],
  //! temp till I know and can confirm the progress is passed to the DB so that when two books are started, I can switch between them with both of their chapter and progress are working

  getPlaybackIndex: (bookId: string) => get().playbackIndex[bookId],

  init: () => {
    const booksCollection = database.collections.get<BookModel>('books');

    const subscriptions: Subscription[] = [];

    // Observe the books collection directly. This observer will now fire
    // whenever any field on any book changes, including `book_progress_value`.
    const booksSubscription = booksCollection
      .query()
      .observeWithColumns(['book_progress_value'])
      .subscribe(async (bookModels) => {
        console.log(
          `Zustand observer fired with ${bookModels.length} books.`
        );
        const newBookMap: BookMap = {};
        // We have all the books. Now, we need to group them by author.
        const authorsMap = new Map<
          string,
          { authorModel: AuthorModel; books: BookModel[] }
        >();
        try {
          // Step 1: Group all book models by their author efficiently.
          for (const bookModel of bookModels) {
            const authorModel = await (bookModel.author as any).fetch();
            if (!authorModel) continue; // Skip books without an author

            if (!authorsMap.has(authorModel.id)) {
              authorsMap.set(authorModel.id, { authorModel, books: [] });
            }
            authorsMap.get(authorModel.id)!.books.push(bookModel);
          }

          // Convert the map to the final array structure
          const finalAuthorsData: Author[] = await Promise.all(
            Array.from(authorsMap.values()).map(
              async ({ authorModel, books: groupedBooks }) => {
                // The `books` from the map are the fresh models from the observer.
                // We use these directly instead of re-fetching.
                const booksData: Book[] = await Promise.all(
                  groupedBooks.map(async (bookModel) => {
                    const chapterModels = await (
                      bookModel.chapters as any
                    ).fetch();
                    const chaptersData: Chapter[] = chapterModels.map(
                      (chapterModel: ChapterModel) => ({
                        author: authorModel.name,
                        bookTitle: bookModel.title,
                        chapterTitle: chapterModel.title,
                        chapterNumber: chapterModel.chapterNumber,
                        chapterDuration: chapterModel.chapterDuration,
                        startMs: chapterModel.startMs,
                        url: chapterModel.url,
                      })
                    );

                    const bookData: Book = {
                      bookId: bookModel.id,
                      author: authorModel.name,
                      bookTitle: bookModel.title,
                      chapters: chaptersData,
                      artwork: bookModel.artwork,
                      artworkHeight: bookModel.artworkHeight,
                      artworkWidth: bookModel.artworkWidth,
                      artworkColors: {
                        average: bookModel.coverColorAverage,
                        dominant: bookModel.coverColorDominant,
                        vibrant: bookModel.coverColorVibrant,
                        darkVibrant: bookModel.coverColorDarkVibrant,
                        lightVibrant: bookModel.coverColorLightVibrant,
                        muted: bookModel.coverColorMuted,
                        darkMuted: bookModel.coverColorDarkMuted,
                        lightMuted: bookModel.coverColorLightMuted,
                      },
                      bookDuration: bookModel.bookDuration,
                      bookProgress: {
                        currentChapterIndex: bookModel.currentChapterIndex,
                        currentChapterProgress:
                          bookModel.currentChapterProgress,
                      },
                      bookProgressValue: bookModel.bookProgressValue,
                      metadata: {
                        year: bookModel.year,
                        description: bookModel.description,
                        narrator: bookModel.narrator,
                        genre: bookModel.genre,
                        sampleRate: bookModel.sampleRate,
                        bitrate: bookModel.bitrate,
                        codec: bookModel.codec,
                        copyright: bookModel.copyright,
                        totalTrackCount: bookModel.totalTrackCount,
                        ctime: bookModel.createdAt,
                        mtime: bookModel.updatedAt,
                      },
                    };
                    // Add the complete book object to our normalized map.
                    newBookMap[bookModel.id] = bookData;
                    return bookData;
                  })
                );

                return {
                  name: authorModel.name,
                  books: booksData,
                };
              }
            )
          );

          // Sort authors alphabetically before setting the state
          finalAuthorsData.sort((a, b) => a.name.localeCompare(b.name));

          set({ authors: finalAuthorsData, books: newBookMap });
        } catch (error) {
          console.error('Error during authorsData mapping:', error);
        }
      });
*/

// This selector is still fine for author-level views.
export const useAuthors = () => useLibraryStore((state) => state.authors);

// This selector is inefficient and should be deprecated or updated to use the book map.
// For now, I'll leave it, but you should transition away from using it.
export const useBook = (author: string, bookTitle: string) =>
  useLibraryStore((state) => {
    const authorFound = state.authors.find((a) => a.name === author);
    return authorFound?.books.find((b) => b.bookTitle === bookTitle);
  });

/**
 * This is the new, highly performant way to get a book by its ID.
 * It directly accesses the book from the map in the store.
 */
export const useBookById = (bookId: string) => {
  return useLibraryStore((state) => state.books[bookId]);
};

/**
 * A new, more specific selector for getting just the data needed for a grid item.
 * This prevents re-renders if other book data (like chapter details) changes.
 * The `shallow` comparison is important for objects.
 */
export const useBookDisplayData = (bookId: string) =>
  useLibraryStore(
    useShallow((state) =>
      state.books[bookId]
        ? {
            bookId: state.books[bookId].bookId,
            author: state.books[bookId].author,
            bookTitle: state.books[bookId].bookTitle,
            artwork: state.books[bookId].artwork,
            artworkHeight: state.books[bookId].artworkHeight,
            artworkWidth: state.books[bookId].artworkWidth,
            currentChapterProgress:
              state.books[bookId].bookProgress.currentChapterProgress,
          }
        : undefined
    )
  );
