import { Book } from '@/types/Book';

/**
 * Stable structural identity for a book = its first file's path (chapter url).
 *
 * Survives in-app tag edits and rescans (which can mint a new book.id for the
 * same file). Mirrors the "structural key = first file path" convention in
 * artworkIdentity.ts. Series membership is anchored on this, never book.id.
 */
export function bookStructuralKey(
  book: Pick<Book, 'chapters'>,
): string | null {
  return book.chapters?.[0]?.url ?? null;
}
