import { Model } from '@nozbe/watermelondb';
import { text, field, date, relation } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';
import Series from './Series';

export default class SeriesBook extends Model {
  static table = 'series_books';
  static associations: Associations = {
    series: { type: 'belongs_to', key: 'series_id' },
  };

  // Structural key = the book's first file path (book.chapters[0].url).
  // Deliberately NOT a foreign key to `books`: book.id churns on tag edit +
  // rescan, the file path does not. Resolved to a live Book in JS at read time.
  @text('book_key') bookKey!: string;
  @field('position') position!: number;
  @date('created_at') createdAt!: Date;
  @relation('series', 'series_id') series!: Series;
}
