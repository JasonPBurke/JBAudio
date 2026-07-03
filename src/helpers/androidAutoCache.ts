import { Platform } from 'react-native';
import * as RNFS from '@dr.pogodin/react-native-fs';
import type { Author, Book } from '@/types/Book';
import { compareBookTitles } from './miscellaneous';

type CacheBook = {
  bookId: string;
  title: string;
  author: string;
  artwork: string;
  // bookProgressValue: 0 = not started, 1 = started, 2 = finished — matches
  // Android Auto's DESCRIPTION_EXTRAS completion-status values exactly
  progress: number;
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
  progress: book.bookProgressValue ?? 0,
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

    // Write to a temp file, then rename over the final path. rename(2) is
    // atomic on Android, so the native reader (MusicService.readAutoCache)
    // never sees a truncated file mid-write. Unique temp names keep
    // overlapping writes from corrupting each other; last rename wins with
    // a complete file either way.
    const finalPath = `${RNFS.DocumentDirectoryPath}/android_auto_cache.json`;
    const tempPath = `${finalPath}.tmp${++tempFileSeq}`;
    await RNFS.writeFile(tempPath, JSON.stringify(cache), 'utf8');
    await RNFS.moveFile(tempPath, finalPath);
  } catch (_e) {
    // Non-fatal: Android Auto browse tree will be empty until next library update
  }
}

let tempFileSeq = 0;

const CACHE_WRITE_DEBOUNCE_MS = 1000;
let pendingAuthors: Author[] | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Debounced wrapper for library-store subscribers. Store emissions arrive in
 * bursts (especially during a scan); rewriting the cache on every emission
 * wastes I/O and widens the window where Android Auto could observe churn.
 * Only the latest snapshot within the window is written.
 */
export function scheduleAndroidAutoCacheWrite(authors: Author[]): void {
  pendingAuthors = authors;
  if (debounceTimer !== null) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    const toWrite = pendingAuthors;
    pendingAuthors = null;
    if (toWrite) void writeAndroidAutoCache(toWrite);
  }, CACHE_WRITE_DEBOUNCE_MS);
}
