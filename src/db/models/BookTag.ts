import { Model } from '@nozbe/watermelondb';
import { text, date, relation } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';
import Book from './Book';

/**
 * Everything the scan read off a file's General track, including its `extra`
 * bag, kept as JSON — one row per book.
 *
 * Why it is not four more columns on `books`: a model's FULL raw record is
 * loaded into memory, and the library store observes seventeen `books` columns
 * across the whole library, so a ~2 KB blob per book would ride every library
 * query. Here nothing pays for it until something asks (~0.70 MB / 350 books).
 *
 * Capture is deliberately wider than detection needs. A column can only hold a
 * tag somebody predicted; the blob means a later feature that displays a
 * file's metadata costs no migration and no second pass over the library.
 */
export default class BookTag extends Model {
  static table = 'book_tags';
  static associations: Associations = {
    books: { type: 'belongs_to', key: 'book_id' },
  };

  @text('book_id') bookId!: string;
  // A JSON string, stored and returned verbatim. Nothing parses it on read —
  // that is the point of the side table.
  @text('raw_json') rawJson!: string;
  @date('captured_at') capturedAt!: Date;

  @relation('books', 'book_id') book!: Book;
}
