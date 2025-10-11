import { Model } from '@nozbe/watermelondb';
import { field, text, relation } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';
import Book from './Book';

export default class Chapter extends Model {
  static table = 'chapters';
  static associations: Associations = {
    books: { type: 'belongs_to', key: 'book_id' },
  };

  @text('title') title!: string;
  @field('chapter_number') chapterNumber!: number;
  @text('url') url!: string;

  @relation('books', 'book_id') book!: Book;
}
