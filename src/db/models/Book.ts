import { Model } from '@nozbe/watermelondb';
import {
  field,
  text,
  date,
  relation,
  children,
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
  @field('current_chapter_index') currentChapterIndex!: number;
  @field('current_chapter_progress') currentChapterProgress!: number;
  @field('year') year!: number;
  @text('description') description!: string;
  @text('narrator') narrator!: string;
  @text('genre') genre!: string | null;
  @field('sample_rate') sampleRate!: number | null;
  @field('total_track_count') totalTrackCount!: number;
  @date('created_at') createdAt!: Date;
  @date('updated_at') updatedAt!: Date;

  @relation('authors', 'author_id') author!: Author;
  @children('chapters') chapters!: Chapter[];
}
