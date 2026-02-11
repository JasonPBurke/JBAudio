import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

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

  // Getter to automatically parse the libraryPaths JSON string
  get parsedLibraryPaths(): string[] {
    if (!this.libraryPaths) {
      return [];
    }
    try {
      return JSON.parse(this.libraryPaths);
    } catch (e) {
      console.error('Failed to parse library paths:', e);
      return [];
    }
  }
}
