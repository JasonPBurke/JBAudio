import { Author, Book, Chapter } from '@/types/Book';
import { create } from 'zustand';
import { useCallback } from 'react';
import database from '@/db';
import { shallow } from 'zustand/shallow';
import { Subscription } from 'rxjs';
import AuthorModel from '@/db/models/Author';
import BookModel from '@/db/models/Book';
import ChapterModel from '@/db/models/Chapter';

interface LibraryState {
  authors: Author[];
  setAuthors: (authors: Author[]) => void;
  getAuthors: () => Author[];
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

export const useLibraryStore = create<LibraryState>()((set, get) => ({
  authors: [],
  playbackProgress: {}, // Initialize new state
  playbackIndex: {}, // Initialize new state
  setAuthors: (authors) => set({ authors }),
  getAuthors: () => get().authors,

  setPlaybackProgress: (bookId: string, progress: number) =>
    // console.log('setPlaybackProgress', bookId, progress);
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

  //! better to save to store state then update the DB???
  updateBookChapterIndex: async (bookId: string, chapterIndex: number) => {
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

                    return {
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

          set({ authors: finalAuthorsData });
        } catch (error) {
          console.error('Error during authorsData mapping:', error);
        }
      });

    subscriptions.push(booksSubscription);

    return () => {
      subscriptions.forEach((sub) => sub.unsubscribe());
    };
  },
}));

export const useAuthors = () => useLibraryStore((state) => state.authors);

export const useBook = (author: string, bookTitle: string) =>
  useLibraryStore((state) => {
    const authorFound = state.authors.find((a) => a.name === author);
    return authorFound?.books.find((b) => b.bookTitle === bookTitle);
  });

export const useBookById = (bookId: string) => {
  const selector = useCallback(
    (state: LibraryState) => {
      for (const author of state.authors) {
        for (const book of author.books) {
          if (book.bookId === bookId) {
            console.log('found book');
            return book;
          }
        }
      }
      return undefined;
    },
    [bookId]
  );
  // @ts-expect-error
  return useLibraryStore(selector, shallow);
};

export const useBookArtwork = (author: string, bookTitle: string) =>
  useLibraryStore((state) => {
    const authorFound = state.authors.find((a) => a.name === author);
    return authorFound?.books.find((b) => b.bookTitle === bookTitle)
      ?.artwork;
  });
