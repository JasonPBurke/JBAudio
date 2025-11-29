import { useMemo } from 'react';
import { Author, Book } from '@/types/Book';

export const useProcessedBooks = (authors: Author[]): Book[] => {
  const allBooks = useMemo(() => {
    if (!authors || authors.length === 0) {
      return [];
    }

    // First, sort authors alphabetically
    const sortedAuthors = [...authors].sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    // Then, flatten and sort the books by creation time
    return sortedAuthors
      .flatMap((author) => author.books || []) // Safely handle cases where author.books might be undefined
      .sort((a, b) => {
        // Sort by creationDate (descending)
        const ctimeA = a.metadata?.ctime ?? 0;
        const ctimeB = b.metadata?.ctime ?? 0;

        return Number(ctimeB) - Number(ctimeA);
      });
  }, [authors]);

  return allBooks;
};
