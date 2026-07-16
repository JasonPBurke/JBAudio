import { compareBookTitles } from '@/helpers/miscellaneous';

export type RecencyKey = 'lastPlayedAt' | 'finishedAt';

/**
 * Library list ordering mode, derived from the selected tab:
 * Started -> 'played', Finished -> 'finished', all others -> null (title/ctime).
 */
export type LibraryRecencyMode = 'played' | 'finished' | null;

export const RECENCY_KEY_FOR_MODE: Record<
  Exclude<LibraryRecencyMode, null>,
  RecencyKey
> = {
  played: 'lastPlayedAt',
  finished: 'finishedAt',
};

type RecencySortable = {
  bookTitle: string;
  lastPlayedAt?: number | null;
  finishedAt?: number | null;
};

/**
 * Sort books most-recent-first by the given timestamp key (ms since epoch).
 * Books without a timestamp (e.g. started/finished before the column existed)
 * sort after all stamped books; ties and unstamped books order by title.
 */
export function sortBooksByRecency<T extends RecencySortable>(
  books: T[],
  key: RecencyKey,
): T[] {
  return [...books].sort((a, b) => {
    const timeA = a[key] ?? null;
    const timeB = b[key] ?? null;
    if (timeA !== null && timeB !== null && timeA !== timeB) {
      return timeB - timeA;
    }
    if (timeA !== null && timeB === null) return -1;
    if (timeA === null && timeB !== null) return 1;
    return compareBookTitles(a.bookTitle, b.bookTitle);
  });
}
