import { Model } from '@nozbe/watermelondb';
import { text, writer, children } from '@nozbe/watermelondb/decorators';
import { Associations } from '@nozbe/watermelondb/Model';
import Book from '@/db/models/Book';

export default class Author extends Model {
  static table = 'authors';
  static associations: Associations = {
    books: { type: 'has_many', foreignKey: 'author_id' },
  };

  @text('name') name!: string;
  @children('books') books!: Book[];
}

// @writer async createBook(
//   title: string,
//   artwork: string | null,
//   year: number,
//   description: string,
//   narrator: string,
//   genre: string | null,
//   sampleRate: number | null,
//   totalTrackCount: number,
//   currentChapterIndex: number,
//   currentChapterProgress: number
// ) {
//   return await this.collections.get('books').create((book) => {
//     book.author.set(this);
//     book.title = title;
//     book.artwork = artwork;
//     book.year = year;
//     book.description = description;
//     book.narrator = narrator;
//     book.genre = genre;
//     book.sampleRate = sampleRate;
//     book.totalTrackCount = totalTrackCount;
//     book.currentChapterIndex = currentChapterIndex;
//     book.currentChapterProgress = currentChapterProgress;
//   });
// }
