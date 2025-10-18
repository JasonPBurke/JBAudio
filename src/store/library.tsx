import { Author, Book, Chapter } from '@/types/Book';
import { create } from 'zustand';
import database from '@/db';
import { Subscription } from 'rxjs';
import AuthorModel from '@/db/models/Author';
import BookModel from '@/db/models/Book';
import ChapterModel from '@/db/models/Chapter';

interface LibraryState {
  authors: Author[];
  setAuthors: (authors: Author[]) => void;
  getAuthors: () => Author[];
  playbackProgress: Record<string, number>; // New: Stores real-time playback progress
  // New: Action to update playback progress
  setPlaybackProgress: (bookId: string, progress: number) => void;
  getPlaybackProgress: (bookId: string) => number;
  init: () => () => void; // Function to initialize and return cleanup
  updateBookChapterIndex: (
    bookId: string,
    chapterIndex: number
  ) => Promise<void>;
}

export const useLibraryStore = create<LibraryState>()((set, get) => ({
  authors: [],
  playbackProgress: {}, // Initialize new state
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
  //! temp till I know and can confirm the progress is passed to the DB so that when two books are started, I can switch between them with both of their chapter and progress are working.  I want the DB updated with progress when the book is changed, or the chapter is changed. whenever a chapter is played, it now owns the currentProgress and currentChapterIndex
  getPlaybackProgress: (bookId: string) => get().playbackProgress[bookId],
  //! temp till I know and can confirm the progress is passed to the DB so that when two books are started, I can switch between them with both of their chapter and progress are working

  init: () => {
    const authorsCollection =
      database.collections.get<AuthorModel>('authors');

    const subscriptions: Subscription[] = [];

    // Observe authors and their related books and chapters
    const authorsSubscription = authorsCollection
      .query()
      .observe()
      .subscribe(async (authorModels) => {
        let authorsData: Author[] = [];
        try {
          authorsData = await Promise.all(
            authorModels.map(async (authorModel: AuthorModel) => {
              const bookModels = await (authorModel.books as any).fetch();

              const booksData: Book[] = await Promise.all(
                bookModels.map(async (bookModel: BookModel) => {
                  const chapterModels = await (
                    bookModel.chapters as any
                  ).fetch();

                  const chaptersData: Chapter[] = chapterModels.map(
                    (chapterModel: ChapterModel) => ({
                      author: authorModel.name,
                      bookTitle: bookModel.title,
                      chapterTitle: chapterModel.title,
                      chapterNumber: chapterModel.chapterNumber,
                      url: chapterModel.url,
                    })
                  );

                  return {
                    bookId: bookModel.id,
                    author: authorModel.name,
                    bookTitle: bookModel.title,
                    chapters: chaptersData,
                    artwork: bookModel.artwork,
                    bookProgress: {
                      currentChapterIndex: bookModel.currentChapterIndex,
                      currentChapterProgress:
                        bookModel.currentChapterProgress,
                    },
                    metadata: {
                      year: bookModel.year,
                      description: bookModel.description,
                      narrator: bookModel.narrator,
                      genre: bookModel.genre,
                      sampleRate: bookModel.sampleRate,
                      totalTrackCount: bookModel.totalTrackCount,
                      ctime: bookModel.createdAt,
                      mtime: bookModel.updatedAt,
                    },
                  };
                })
              );
              return {
                name: authorModel.name, // Use 'name' to match the Author type
                books: booksData,
              };
            })
          );
        } catch (error) {
          console.error('Error during authorsData mapping:', error);
        }
        set({ authors: authorsData });
      });

    subscriptions.push(authorsSubscription);

    return () => {
      subscriptions.forEach((sub) => sub.unsubscribe());
    };
  },
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
}));

export const useAuthors = () => useLibraryStore((state) => state.authors);

export const useBook = (author: string, bookTitle: string) =>
  useLibraryStore((state) => {
    const authorFound = state.authors.find((a) => a.name === author);
    return authorFound?.books.find((b) => b.bookTitle === bookTitle);
  });

export const useBookById = (bookId: string) =>
  useLibraryStore((state) => {
    for (const author of state.authors) {
      for (const book of author.books) {
        if (book.bookId === bookId) {
          return book;
        }
      }
    }
    console.log('book not found');
  });

export const useBookArtwork = (author: string, bookTitle: string) =>
  useLibraryStore((state) => {
    const authorFound = state.authors.find((a) => a.name === author);
    return authorFound?.books.find((b) => b.bookTitle === bookTitle)
      ?.artwork;
  });
