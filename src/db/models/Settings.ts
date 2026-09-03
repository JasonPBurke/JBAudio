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
  @field('timer_frozen_remaining') timerFrozenRemaining!: number | null;
  /** Which option is highlighted. Read through `resolveTimerMode`, never raw. */
  @field('timer_mode') timerMode!: string | null;
  /** Chapters left before a running chapter timer fires. Not the dialed count. */
  @field('timer_chapters_remaining') timerChaptersRemaining!: number | null;
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

  // Series preferences. Null is their normal state — not just after the v33
  // migration, but on a FRESH install too, since the settings seeder only
  // seeds three fields — so the default belongs in the getter that reads them.
  //
  // TRAP: the first two are default-ON, and the house getter idiom
  // (`x === true`, falling back to false) hard-codes default-OFF into both the
  // null case and the no-record case. They need `x !== false` with a `true`
  // fallback. Getting it wrong is silent: the user sees a switch rendered OFF
  // that they never turned off, and for detection, an empty Series tab that
  // reads as a broken feature.
  @field('series_backgrounds_enabled') seriesBackgroundsEnabled!:
    | boolean
    | null; // default ON
  @field('series_detection_enabled') seriesDetectionEnabled!: boolean | null; // default ON
  @field('series_folder_grouping_enabled') seriesFolderGroupingEnabled!:
    | boolean
    | null; // default OFF

  /**
   * Which layout the Books shelf is drawn in. Read through
   * `resolveBooksLayout`, never raw -- null is the normal state of a reader who
   * has never touched the control, not a broken row.
   */
  @text('books_layout') booksLayout!: string | null;

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
