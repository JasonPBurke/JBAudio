import {
  createTable,
  schemaMigrations,
  addColumns,
} from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
  migrations: [
    {
      toVersion: 8,
      steps: [
        addColumns({
          table: 'settings',
          columns: [
            {
              name: 'sleep_time',
              type: 'number',
              isOptional: true,
            },
          ],
        }),
      ],
    },
    {
      toVersion: 7,
      steps: [
        addColumns({
          table: 'settings',
          columns: [
            {
              name: 'timer_active',
              type: 'boolean',
            },
          ],
        }),
      ],
    },
    {
      toVersion: 6,
      steps: [
        addColumns({
          table: 'settings',
          columns: [
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
          ],
        }),
      ],
    },
    {
      toVersion: 5,
      steps: [
        createTable({
          name: 'settings',
          columns: [
            { name: 'book_folder', type: 'string' },
            { name: 'num_columns', type: 'number' },
            { name: 'timer_duration', type: 'number', isOptional: true },
            {
              name: 'timer_fadeout_duration',
              type: 'number',
              isOptional: true,
            },
          ],
        }),
      ],
    },
    {
      toVersion: 4,
      steps: [
        addColumns({
          table: 'books',
          columns: [
            {
              name: 'artwork_height',
              type: 'number',
              isOptional: true,
            },
            {
              name: 'artwork_width',
              type: 'number',
              isOptional: true,
            },
          ],
        }),
      ],
    },
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'books',
          columns: [
            {
              name: 'book_duration',
              type: 'number',
              isOptional: false,
            },
          ],
          // @ts-ignore: WatermelonDB expects defaultValue here for non-optional columns
          defaultValue: 0,
        }),
        addColumns({
          table: 'chapters',
          columns: [
            {
              name: 'chapter_duration',
              type: 'number',
              isOptional: false,
            },
          ],
          // @ts-ignore: WatermelonDB expects defaultValue here for non-optional columns
          defaultValue: 0,
        }),
      ],
    },
    {
      toVersion: 2,
      steps: [
        createTable({
          name: 'authors',
          columns: [{ name: 'name', type: 'string' }],
        }),
        createTable({
          name: 'books',
          columns: [
            { name: 'author_id', type: 'string', isIndexed: true },
            { name: 'title', type: 'string' },
            { name: 'artwork', type: 'string', isOptional: true },
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
          ],
        }),
        createTable({
          name: 'chapters',
          columns: [
            { name: 'book_id', type: 'string', isIndexed: true },
            { name: 'title', type: 'string' },
            { name: 'chapter_number', type: 'number' },
            { name: 'url', type: 'string' },
          ],
        }),
      ],
    },
  ],
});
