import { Model } from '@nozbe/watermelondb';
import { field, text } from '@nozbe/watermelondb/decorators';

export default class Settings extends Model {
  static table = 'settings';

  @text('book_folder') bookFolder: string = '';
  @field('num_columns') numColumns: number = 2;
  @field('timer_duration') timerDuration!: number;
  @field('timer_fadeout_duration') timerFadeoutDuration!: number;
}
