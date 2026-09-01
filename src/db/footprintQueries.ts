import database from '@/db';
import Footprint, { FootprintTrigger } from '@/db/models/Footprint';
import { Q } from '@nozbe/watermelondb';
import type { ChapterPosition } from '@/helpers/bookLocation';

const MAX_FOOTPRINTS_PER_BOOK = 10;

/**
 * Write a breadcrumb at a Chapter Position the caller has already resolved,
 * keeping at most `MAX_FOOTPRINTS_PER_BOOK` per Book.
 *
 * ⚠ It is TOLD where the breadcrumb goes and works nothing out. Resolving
 * that belongs to `helpers/activeBookFootprints`, the module that owns the
 * Active Book on behalf of every surface that records one.
 *
 * Seconds in, milliseconds stored. `ChapterPosition` is the currency every
 * caller already holds and `position_ms` is the column, so the rounding
 * conversion happens once, here, rather than at each call site.
 */
export async function addFootprint(
  bookId: string,
  chapter: ChapterPosition,
  triggerType: FootprintTrigger,
): Promise<void> {
  await database.write(async () => {
    const footprintsCollection =
      database.collections.get<Footprint>('footprints');

    // Get existing footprints for this book, ordered by created_at DESC
    const existingFootprints = await footprintsCollection
      .query(Q.where('book_id', bookId), Q.sortBy('created_at', Q.desc))
      .fetch();

    // If we have MAX_FOOTPRINTS_PER_BOOK or more, delete the oldest ones
    if (existingFootprints.length >= MAX_FOOTPRINTS_PER_BOOK) {
      const footprintsToDelete = existingFootprints.slice(
        MAX_FOOTPRINTS_PER_BOOK - 1,
      );
      for (const fp of footprintsToDelete) {
        await fp.destroyPermanently();
      }
    }

    // Create new footprint
    await footprintsCollection.create((fp) => {
      fp.bookId = bookId;
      fp.chapterIndex = chapter.index;
      fp.positionMs = Math.round(chapter.positionSeconds * 1000);
      fp.triggerType = triggerType;
      fp.createdAt = Date.now();
    });
  });
}

export async function getFootprints(bookId: string): Promise<Footprint[]> {
  const footprintsCollection =
    database.collections.get<Footprint>('footprints');

  return footprintsCollection
    .query(Q.where('book_id', bookId), Q.sortBy('created_at', Q.asc))
    .fetch();
}

export async function deleteFootprintsForBook(
  bookId: string,
): Promise<void> {
  await database.write(async () => {
    const footprintsCollection =
      database.collections.get<Footprint>('footprints');

    const footprints = await footprintsCollection
      .query(Q.where('book_id', bookId))
      .fetch();

    for (const fp of footprints) {
      await fp.destroyPermanently();
    }
  });
}

export const TRIGGER_LABELS: Record<FootprintTrigger, string> = {
  play: 'Play pressed',
  seek: 'Seeked from',
  chapter_change: 'Chapter changed',
  chapter_restart: 'Chapter restart',
  timer_activation: 'Timer started at',
};

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}
