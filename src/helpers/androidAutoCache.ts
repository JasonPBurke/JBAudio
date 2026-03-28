import { Platform } from 'react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';
import type { Author, Book } from '@/types/Book';
import { compareBookTitles } from './miscellaneous';

type CacheBook = {
  bookId: string;
  title: string;
  author: string;
  artwork: string;
};

type AndroidAutoCache = {
  recentlyAdded: CacheBook[];
  allBooks: CacheBook[];
  authors: { name: string; books: CacheBook[] }[];
};

const toItem = (book: Book): CacheBook => ({
  bookId: book.bookId ?? '',
  title: book.bookTitle,
  author: book.author,
  artwork: book.artwork ?? '',
});

export async function writeAndroidAutoCache(authors: Author[]): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const sorted = [...authors].sort((a, b) => a.name.localeCompare(b.name));

    const allBooks = sorted
      .flatMap(a => a.books)
      .sort((a, b) => compareBookTitles(a.bookTitle, b.bookTitle));

    const recentlyAdded = [...allBooks]
      .sort((a, b) => {
        const tA =
          typeof a.metadata.ctime === 'number'
            ? a.metadata.ctime
            : new Date(a.metadata.ctime).getTime();
        const tB =
          typeof b.metadata.ctime === 'number'
            ? b.metadata.ctime
            : new Date(b.metadata.ctime).getTime();
        return tB - tA;
      })
      .slice(0, 25);

    const cache: AndroidAutoCache = {
      recentlyAdded: recentlyAdded.map(toItem),
      allBooks: allBooks.map(toItem),
      authors: sorted.map(a => ({
        name: a.name,
        books: [...a.books]
          .sort((x, y) => compareBookTitles(x.bookTitle, y.bookTitle))
          .map(toItem),
      })),
    };

    await RNFS.writeFile(
      `${RNFS.DocumentDirectoryPath}/android_auto_cache.json`,
      JSON.stringify(cache),
      'utf8',
    );
  } catch (_e) {
    // Non-fatal: Android Auto browse tree will be empty until next library update
  }
}
