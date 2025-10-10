import { appSchema, tableSchema } from '@nozbe/watermelondb';

export default appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'books',
      columns: [
        { name: 'book_id', type: 'string' },
        { name: 'author', type: 'string' },
        { name: 'book_title', type: 'string' },
        { name: 'artwork', type: 'string', isOptional: true },
        { name: 'book_duration', type: 'number' },
        { name: 'book_progress', type: 'number' },
        { name: 'current_chapter_index', type: 'number' },
        { name: 'current_chapter_progress', type: 'number' },
        { name: 'year', type: 'number' },
        { name: 'description', type: 'string' },
        { name: 'narrator', type: 'string' },
        { name: 'genre', type: 'string', isOptional: true },
        { name: 'sample_rate', type: 'number', isOptional: true },
        { name: 'total_track_count', type: 'number' },
        { name: 'ctime', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'chapters',
      columns: [
        { name: 'book_id', type: 'string' },
        { name: 'author', type: 'string' },
        { name: 'book_title', type: 'string' },
        { name: 'chapter_duration', type: 'number' },
        { name: 'chapter_title', type: 'string' },
        { name: 'chapter_number', type: 'number' },
        { name: 'url', type: 'string' },
      ],
    }),
  ],
});
