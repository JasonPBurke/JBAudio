import { Author, Book } from '@/types/Book';
import { create } from 'zustand';

//! need to import from the db here to retrieve library
// const library = ScanExternalFileSystem();

// console.log('library', library);

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
