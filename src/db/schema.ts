import { appSchema, tableSchema } from '@nozbe/watermelondb';

export default appSchema({
  version: 9,
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
        { name: 'book_duration', type: 'number' },
        {
          name: 'current_chapter_index',
          type: 'number',
          isOptional: true,
        },
        {
          name: 'current_chapter_progress',
          type: 'number',
          isOptional: true,
        },
        { name: 'year', type: 'number', isOptional: true },
        { name: 'description', type: 'string', isOptional: true },
        { name: 'narrator', type: 'string', isOptional: true },
        { name: 'genre', type: 'string', isOptional: true },
        { name: 'sample_rate', type: 'number', isOptional: true },
        { name: 'total_track_count', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'artwork_height', type: 'number', isOptional: true },
        { name: 'artwork_width', type: 'number', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'chapters',
      columns: [
        { name: 'book_id', type: 'string', isIndexed: true },
        { name: 'title', type: 'string' },
        { name: 'chapter_number', type: 'number' },
        { name: 'chapter_duration', type: 'number' },
        { name: 'url', type: 'string' },
      ],
    }),
    tableSchema({
      name: 'settings',
      columns: [
        { name: 'book_folder', type: 'string' },
        { name: 'num_columns', type: 'number' },
        { name: 'timer_duration', type: 'number', isOptional: true },
        {
          name: 'sleep_time',
          type: 'number',
          isOptional: true,
        },
        {
          name: 'timer_fadeout_duration',
          type: 'number',
          isOptional: true,
        },
        {
          name: 'custom_timer',
          type: 'number',
          isOptional: true,
        },
        {
          name: 'timer_chapters',
          type: 'number',
          isOptional: true,
        },
        {
          name: 'last_active_book',
          type: 'string',
        },
        {
          name: 'current_book_artwork_uri',
          type: 'string',
          isOptional: true,
        },
        {
          name: 'timer_active',
          type: 'boolean',
        },
      ],
    }),
  ],
});
