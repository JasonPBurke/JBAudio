import { appSchema, tableSchema } from '@nozbe/watermelondb';

export default appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'authors',
      columns: [{ name: 'name', type: 'string' }],
    }),
    tableSchema({
      name: 'books',
      columns: [
        { name: 'author_id', type: 'string', isIndexed: true },
        { name: 'title', type: 'string' },
        { name: 'artwork', type: 'string', isOptional: true },
        { name: 'current_chapter_index', type: 'number' },
        { name: 'current_chapter_progress', type: 'number' },
        { name: 'year', type: 'number' },
        { name: 'description', type: 'string' },
        { name: 'narrator', type: 'string' },
        { name: 'genre', type: 'string', isOptional: true },
        { name: 'sample_rate', type: 'number', isOptional: true },
        { name: 'total_track_count', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'chapters',
      columns: [
        { name: 'book_id', type: 'string', isIndexed: true },
        { name: 'title', type: 'string' },
        { name: 'chapter_number', type: 'number' },
        { name: 'url', type: 'string' },
      ],
    }),
  ],
});
