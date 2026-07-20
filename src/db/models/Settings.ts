import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export type LibraryFolderEntry = {
  /** Filesystem path relative to ExternalStorageDirectoryPath (used by RNFS.readDir + path-based MediaInfo). */
  path: string;
  /** SAF tree URI persisted via takePersistableUriPermission (used by SafCueReader for .cue reads). */
  treeUri: string;
};

export default class Settings extends Model {
  static table = 'settings';

  @text('book_folder') bookFolder!: string;
  @field('num_columns') numColumns!: number;
  @field('timer_duration') timerDuration!: number | null;
  @field('sleep_time') sleepTime!: number | null;
  @field('timer_fadeout_duration') timerFadeoutDuration!: number | null;
  @field('custom_timer') customTimer!: number | null;
  @field('timer_chapters') timerChapters!: number | null;
  @text('last_active_book') lastActiveBook!: string | null;
  @text('current_book_artwork_uri') currentBookArtworkUri!: string | null;
  @field('timer_active') timerActive!: boolean;
  @text('library_paths') libraryPaths!: string | null;
  @field('skip_back_duration') skipBackDuration!: number | null;
  @field('skip_forward_duration') skipForwardDuration!: number | null;
  @text('theme_mode') themeMode!: string | null;
  @text('custom_primary_color') customPrimaryColor!: string | null;
  @text('bedtime') bedtime!: number | null; // DEPRECATED
  @field('bedtime_start') bedtimeStart!: number | null;
  @field('bedtime_end') bedtimeEnd!: number | null;
  @field('bedtime_mode_enabled') bedtimeModeEnabled!: boolean | null;
  @field('auto_chapter_interval') autoChapterInterval!: number | null;
  @field('mesh_gradient_enabled') meshGradientEnabled!: boolean | null;
  @field('auto_accent_enabled') autoAccentEnabled!: boolean | null;
  @field('shake_to_reset_enabled') shakeToResetEnabled!: boolean | null;
  @field('last_scan_at') lastScanAt!: number | null;
  @field('playback_rate') playbackRate!: number | null;
  @field('last_non_default_rate') lastNonDefaultRate!: number | null;

  // Canonical accessor: returns the full library folder entries (path + SAF tree URI).
  // Performs a one-shot migration from the legacy `string[]` shape — if detected, the
  // entries are treated as empty and the user must re-add folders to grant SAF access.
  get parsedLibraryFolderEntries(): LibraryFolderEntry[] {
    if (!this.libraryPaths) return [];
    try {
      const parsed = JSON.parse(this.libraryPaths);
      if (!Array.isArray(parsed) || parsed.length === 0) return [];
      if (typeof parsed[0] === 'string') return [];
      return parsed.filter(
        (e: unknown): e is LibraryFolderEntry =>
          !!e &&
          typeof e === 'object' &&
          typeof (e as LibraryFolderEntry).path === 'string' &&
          typeof (e as LibraryFolderEntry).treeUri === 'string',
      );
    } catch (e) {
      console.error('Failed to parse library folder entries:', e);
      return [];
    }
  }

  // Backward-compat: returns just the relative paths (used by UI display).
  get parsedLibraryPaths(): string[] {
    return this.parsedLibraryFolderEntries.map((e) => e.path);
  }
}
