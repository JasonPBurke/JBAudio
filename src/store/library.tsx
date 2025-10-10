import { Author, Book } from '@/types/Book';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface LibraryState {
  authors: Author[];
  setAuthors: (authors: Author[]) => void;
  getAuthors: () => Author[];
}

export const useLibraryStore = create<LibraryState>()((set, get) => ({
  authors: [],
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
    const authorFound = state.authors.find((a) => a.authorName === author);
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
    const authorFound = state.authors.find((a) => a.authorName === author);
    return authorFound?.books.find((b) => b.bookTitle === bookTitle)
      ?.artwork;
  });
