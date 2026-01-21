import { Model } from '@nozbe/watermelondb';
import { field, text, relation } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';
import Book from './Book';

export type FootprintTrigger =
  | 'play'
  | 'seek'
  | 'chapter_change'
  | 'timer_activation';

export default class Footprint extends Model {
  static table = 'footprints';
  static associations: Associations = {
    books: { type: 'belongs_to', key: 'book_id' },
  };

  @text('book_id') bookId!: string;
  @field('chapter_index') chapterIndex!: number;
  @field('position_ms') positionMs!: number;
  @text('trigger_type') triggerType!: FootprintTrigger;
  @field('created_at') createdAt!: number;

  @relation('books', 'book_id') book!: Book;
}
