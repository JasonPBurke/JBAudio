import { Model } from '@nozbe/watermelondb';
import { field, json, text } from '@nozbe/watermelondb/decorators';

const sanitizeLibraryPaths = (rawPaths: any): string[] => {
  return Array.isArray(rawPaths) ? rawPaths.map(String) : [];
};

export default class Settings extends Model {
  static table = 'settings';

  @text('book_folder') bookFolder!: string;
  @field('num_columns') numColumns!: number;
  @field('skip_back_duration') skipBackDuration!: number | null;
  @field('skip_forward_duration') skipForwardDuration!: number | null;
  @field('timer_active') timerActive!: boolean;
  @field('timer_duration') timerDuration!: number | null;
  @field('sleep_time') sleepTime!: number | null;
  @field('custom_timer') customTimer!: number | null;
  @field('timer_fadeout_duration') timerFadeoutDuration!: number | null;
  @field('timer_chapters') timerChapters!: number | null;
  @field('last_active_book') lastActiveBook!: string | null;
  @field('current_book_artwork_uri') currentBookArtworkUri!: string | null;
  @json('library_paths', sanitizeLibraryPaths) libraryPaths!: string[];
}
