import { Author, Book } from '@/types/Book';
import { create } from 'zustand';

interface LibraryState {
  authors: Author[];
  setAuthors: (authors: Author[]) => void;
}

export const useLibraryStore = create<LibraryState>()((set) => ({
  authors: [],
  setAuthors: (authors) => set({ authors }),
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

export const useBookArtwork = (author: string, bookTitle: string) =>
  useLibraryStore((state) => {
    const authorFound = state.authors.find((a) => a.authorName === author);
    return authorFound?.books.find((b) => b.bookTitle === bookTitle)
      ?.artwork;
  });
