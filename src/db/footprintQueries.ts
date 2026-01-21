import database from '@/db';
import Footprint, { FootprintTrigger } from '@/db/models/Footprint';
import Book from '@/db/models/Book';
import Chapter from '@/db/models/Chapter';
import { Q } from '@nozbe/watermelondb';
import TrackPlayer from 'react-native-track-player';

const MAX_FOOTPRINTS_PER_BOOK = 10;

type ChapterData = {
  startMs: number;
  url: string;
};

/**
 * Calculate the current chapter index for a book based on playback position.
 * For single-file books, this calculates the chapter from position.
 * For multi-file books, this returns the track index.
 */
export async function getCurrentChapterInfo(
  bookId: string,
): Promise<{ chapterIndex: number; positionInChapterMs: number } | null> {
  try {
    const [trackIndex, { position }] = await Promise.all([
      TrackPlayer.getActiveTrackIndex(),
      TrackPlayer.getProgress(),
    ]);

    if (trackIndex == null) return null;

    // Get book and chapters from database
    const bookRecord = await database.get<Book>('books').find(bookId);
    const chapters = await (bookRecord.chapters as any).fetch();

    if (chapters.length === 0) return null;

    // Sort chapters by their order (using startMs or track number)
    const sortedChapters: ChapterData[] = chapters
      .map((c: Chapter) => ({
        startMs: (c as any).startMs ?? 0,
        url: c.url,
      }))
      .sort((a: ChapterData, b: ChapterData) => a.startMs - b.startMs);

    // Check if it's a single-file book
    const isSingleFileBook =
      sortedChapters.length > 1 &&
      sortedChapters.every(
        (c: ChapterData) => c.url === sortedChapters[0].url,
      );

    if (isSingleFileBook) {
      // Calculate chapter index from position
      const positionMs = position * 1000;
      let currentChapterIndex = 0;

      for (let i = sortedChapters.length - 1; i >= 0; i--) {
        if (positionMs >= sortedChapters[i].startMs) {
          currentChapterIndex = i;
          break;
        }
      }

      const chapterStartMs = sortedChapters[currentChapterIndex].startMs;
      const positionInChapterMs = Math.max(0, positionMs - chapterStartMs);

      return {
        chapterIndex: currentChapterIndex,
        positionInChapterMs: Math.round(positionInChapterMs),
      };
    } else {
      // Multi-file book - use track index directly
      // Position is already relative to the current track/chapter
      return {
        chapterIndex: trackIndex,
        positionInChapterMs: Math.round(position * 1000),
      };
    }
  } catch {
    return null;
  }
}

/**
 * Record a footprint with automatic chapter detection.
 * Handles both single-file and multi-file books correctly.
 */
export async function recordFootprint(
  bookId: string,
  triggerType: FootprintTrigger,
): Promise<void> {
  const chapterInfo = await getCurrentChapterInfo(bookId);
  if (!chapterInfo) return;

  await addFootprint(
    bookId,
    chapterInfo.chapterIndex,
    chapterInfo.positionInChapterMs,
    triggerType,
  );
}

/**
 * Record a seek footprint with the position BEFORE the seek.
 * For single-file books, calculates chapter from the given position.
 * @param bookId - The book ID
 * @param positionBeforeSeekMs - The playback position (in ms) BEFORE the seek started
 */
export async function recordSeekFootprint(
  bookId: string,
  positionBeforeSeekMs: number,
): Promise<void> {
  try {
    // Get book and chapters from database
    const bookRecord = await database.get<Book>('books').find(bookId);
    const chapters = await (bookRecord.chapters as any).fetch();

    if (chapters.length === 0) return;

    // Sort chapters by their order
    const sortedChapters: ChapterData[] = chapters
      .map((c: Chapter) => ({
        startMs: (c as any).startMs ?? 0,
        url: c.url,
      }))
      .sort((a: ChapterData, b: ChapterData) => a.startMs - b.startMs);

    // Check if it's a single-file book
    const isSingleFileBook =
      sortedChapters.length > 1 &&
      sortedChapters.every(
        (c: ChapterData) => c.url === sortedChapters[0].url,
      );

    let chapterIndex: number;
    let positionInChapterMs: number;

    if (isSingleFileBook) {
      // Calculate chapter index from the position before seek
      chapterIndex = 0;
      for (let i = sortedChapters.length - 1; i >= 0; i--) {
        if (positionBeforeSeekMs >= sortedChapters[i].startMs) {
          chapterIndex = i;
          break;
        }
      }
      const chapterStartMs = sortedChapters[chapterIndex].startMs;
      positionInChapterMs = Math.max(
        0,
        positionBeforeSeekMs - chapterStartMs,
      );
    } else {
      // Multi-file book - get current track index
      const trackIndex = await TrackPlayer.getActiveTrackIndex();
      chapterIndex = trackIndex ?? 0;
      positionInChapterMs = positionBeforeSeekMs;
    }

    await addFootprint(
      bookId,
      chapterIndex,
      Math.round(positionInChapterMs),
      'seek',
    );
  } catch {
    // Silently fail
  }
}

export const TRIGGER_LABELS: Record<FootprintTrigger, string> = {
  play: 'Play pressed',
  seek: 'Seeked from',
  chapter_change: 'Chapter changed',
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

export async function addFootprint(
  bookId: string,
  chapterIndex: number,
  positionMs: number,
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
      fp.chapterIndex = chapterIndex;
      fp.positionMs = positionMs;
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
