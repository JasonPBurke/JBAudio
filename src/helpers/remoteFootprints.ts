import { getActiveBookId, getProgress } from '@/player/trackPlayer';
import {
  recordFootprint,
  recordSeekFootprint,
} from '@/db/footprintQueries';
import { FootprintTrigger } from '@/db/models/Footprint';

/**
 * Footprint recording for remote controls (notification player, Android
 * Auto, Bluetooth). The in-app UI records footprints at each press site
 * (PlayerProgressBar, chapterList, PlayerControls); remote presses arrive
 * as Remote* events in the playback service instead, so these helpers give
 * those handlers the same behavior.
 *
 * Both must be AWAITED BEFORE the seek/skip is issued: a footprint is a
 * breadcrumb back to where the user was, so it has to capture the pre-press
 * position (recordSeekFootprint reads the current track index for
 * chapter-queue books, recordFootprint reads the current position).
 * Failures never block the playback action itself.
 */

export async function recordRemoteSeekFootprint(): Promise<void> {
  try {
    const [activeBookId, { position }] = await Promise.all([
      getActiveBookId(),
      getProgress(),
    ]);
    if (activeBookId) {
      // Position is in seconds — same conversion as PlayerProgressBar
      await recordSeekFootprint(
        activeBookId,
        Math.round(position * 1000),
      );
    }
  } catch {
    // Silently fail if footprint recording fails
  }
}

export async function recordRemoteChapterChangeFootprint(
  bookId?: string,
  trigger: Extract<
    FootprintTrigger,
    'chapter_change' | 'chapter_restart'
  > = 'chapter_change',
): Promise<void> {
  try {
    const id = bookId ?? (await getActiveBookId());
    if (id) {
      await recordFootprint(id, trigger);
    }
  } catch {
    // Silently fail if footprint recording fails
  }
}
