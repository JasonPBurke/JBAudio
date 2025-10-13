import database from '@/db';
import Author from '@/db/models/Author';
// import Book from '@/db/models/Book';
import { Author as AuthorType } from '@/types/Book';
import { create } from 'zustand';

interface LibraryState {
  authors: AuthorType[];
  setAuthors: (authors: AuthorType[]) => void;
  getAuthors: () => AuthorType[];
  init: () => () => void;
}

const authorsCollection = database.get<Author>('authors');

export const useLibraryStore = create<LibraryState>()((set, get) => ({
  authors: [],
  // This initializes the observer to listen for changes
  // and unsubscribes when the store is no longer active.
  init: () => {
    // WatermelonDB's query().observe() returns an RxJS Observable
    const observable = authorsCollection.query().observe();

    const subscription = observable.subscribe((watermelonAuthors) => {
      // Map the WatermelonDB models to plain JavaScript objects.
      // The `observe()` method returns the full models, not just the raw data.
      const dbAuthors = watermelonAuthors.map((author) => ({
        name: author.name,
        books: author.books.map((book) => ({
          bookId: book.chapters[0].url,
          author: book.author.name,
          bookTitle: book.title,
          chapters: book.chapters.map((chapter) => ({
            author: book.author.name,
            bookTitle: book.title,
            chapterTitle: chapter.title,
            chapterNumber: chapter.chapterNumber,
            url: chapter.url,
          })),
          artwork: book.artwork,
          bookProgress: {
            currentChapterIndex: book.currentChapterIndex,
            currentChapterProgress: book.currentChapterProgress,
          },
          metadata: {
            year: book.year,
            description: book.description,
            narrator: book.narrator,
            genre: book.genre,
            sampleRate: book.sampleRate,
            totalTrackCount: book.totalTrackCount,
            ctime: book.createdAt,
            mtime: book.updatedAt,
          },
        })),
      }));
      console.log('dbAuthors', JSON.stringify(dbAuthors, null, 2));
      set({ authors: dbAuthors });
    });

    // Return the unsubscribe function to clean up the observer
    return subscription.unsubscribe;
  },
  setAuthors: (authors) => set({ authors }),
  getAuthors: () => get().authors,
}));

export const useAuthors = () => useLibraryStore((state) => state.authors);

// export const useBooks = () =>
//   useLibraryStore((state) =>
//     state.authors.flatMap((author) => author.books)
//   );

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
          console.log('found book', JSON.stringify(book, null, 2));
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
