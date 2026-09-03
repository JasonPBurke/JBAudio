import type { BooksLayout } from '@/types/booksLayout';

/**
 * D4 -- reads `settings.books_layout` and decides what it means. The ONE place
 * that column becomes a `BooksLayout`; nothing reads it raw, exactly as nothing
 * reads `timer_mode` raw (see `resolveTimerMode` in `sleepTimerSelection.ts`).
 *
 * ⚠ THE DEFAULT LIVES HERE, and it is the grid, because `addColumns` cannot
 * backfill: every row written before schema v36 reads null, which is every
 * reader already using the app. It is also the column's state on a FRESH
 * install, since `ensureSettingsRecord` seeds three fields and this is not one
 * of them. So null does not mean "no value yet" in some narrow migration sense
 * -- it is the normal state of a reader who has never touched the control, and
 * they must see the shelf they have always seen (user story 28).
 *
 * Anything unrecognised degrades the same way. The column is a string so that a
 * third layout is possible later without a migration; until one exists, a value
 * from a future build or a corrupted row resolves to the layout the reader had
 * before this feature rather than to a shelf that draws as nothing.
 *
 * Pure, and in `helpers/` rather than beside the query, so the fast lane can
 * pin all five cases with no database and no React.
 */
export function resolveBooksLayout(
  storedLayout: string | null | undefined,
): BooksLayout {
  return storedLayout === 'list' ? 'list' : 'grid';
}
