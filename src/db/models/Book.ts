import { Model } from '@nozbe/watermelondb';
import {
  field,
  text,
  date,
  relation,
  children,
  writer,
} from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';
import Author from './Author';
import Chapter from './Chapter';

export default class Book extends Model {
  static table = 'books';
  static associations: Associations = {
    authors: { type: 'belongs_to', key: 'author_id' },
    chapters: { type: 'has_many', foreignKey: 'book_id' },
  };

  @text('title') title!: string;
  @text('artwork') artwork!: string | null;
  @field('book_duration') bookDuration!: number;
  @field('current_chapter_index') currentChapterIndex!: number;
  @field('current_chapter_progress') currentChapterProgress!: number | null;
  @field('year') year!: number | null;
  @text('description') description!: string | null;
  @text('narrator') narrator!: string | null;
  @text('genre') genre!: string | null;
  @field('sample_rate') sampleRate!: number | null;
  @field('bitrate') bitrate!: number | null;
  @text('codec') codec!: string | null;
  @field('total_track_count') totalTrackCount!: number;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date | null;
  @field('artwork_height') artworkHeight!: number | null;
  @field('artwork_width') artworkWidth!: number | null;
  @field('book_progress_value') bookProgressValue!: number;
  @field('cover_color_average') coverColorAverage!: string | null;
  @field('cover_color_dominant') coverColorDominant!: string | null;
  @field('cover_color_vibrant') coverColorVibrant!: string | null;
  @field('cover_color_dark_vibrant') coverColorDarkVibrant!: string | null;
  @field('cover_color_light_vibrant') coverColorLightVibrant!:
    | string
    | null;
  @field('cover_color_muted') coverColorMuted!: string | null;
  @field('cover_color_dark_muted') coverColorDarkMuted!: string | null;
  @field('cover_color_light_muted') coverColorLightMuted!: string | null;

  @relation('authors', 'author_id') author!: Author;
  @children('chapters') chapters!: Chapter[];

  @writer async updateCurrentChapterProgress(progress: number) {
    await this.update((book) => {
      book.currentChapterProgress = progress;
    });
  }

  @writer async updateCurrentChapterIndex(index: number) {
    await this.update((book) => {
      book.currentChapterIndex = index;
    });
  }
}
