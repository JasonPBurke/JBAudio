import {
  createTable,
  schemaMigrations,
  addColumns,
} from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
  migrations: [
    {
      toVersion: 23,
      steps: [
        addColumns({
          table: 'books',
          columns: [
            {
              name: 'is_single_file',
              type: 'boolean',
              isOptional: true,
            },
          ],
        }),
      ],
    },
    {
      toVersion: 22,
      steps: [
        createTable({
          name: 'footprints',
          columns: [
            { name: 'book_id', type: 'string', isIndexed: true },
            { name: 'chapter_index', type: 'number' },
            { name: 'position_ms', type: 'number' },
            { name: 'trigger_type', type: 'string' },
            { name: 'created_at', type: 'number' },
          ],
        }),
      ],
    },
    {
      toVersion: 21,
      steps: [
        addColumns({
          table: 'books',
          columns: [
            {
              name: 'has_auto_generated_chapters',
              type: 'boolean',
              isOptional: true,
            },
          ],
        }),
        addColumns({
          table: 'chapters',
          columns: [
            {
              name: 'is_auto_generated',
              type: 'boolean',
              isOptional: true,
            },
          ],
        }),
        addColumns({
          table: 'settings',
          columns: [
            {
              name: 'auto_chapter_interval',
              type: 'number',
              isOptional: true,
            },
          ],
        }),
      ],
    },
    {
      toVersion: 20,
      steps: [
        addColumns({
          table: 'settings',
          columns: [
            {
              name: 'bedtime_mode_enabled',
              type: 'boolean',
              isOptional: true,
            },
          ],
        }),
      ],
    },
    {
      toVersion: 19,
      steps: [
        addColumns({
          table: 'settings',
          columns: [
            {
              name: 'bedtime_start',
              type: 'number',
              isOptional: true,
            },
            {
              name: 'bedtime_end',
              type: 'number',
              isOptional: true,
            },
          ],
        }),
      ],
    },
    {
      toVersion: 18,
      steps: [
        addColumns({
          table: 'settings',
          columns: [
            {
              name: 'bedtime',
              type: 'number',
              isOptional: true,
            },
          ],
        }),
      ],
    },
    {
      toVersion: 17,
      steps: [
        addColumns({
          table: 'settings',
          columns: [
            {
              name: 'custom_primary_color',
              type: 'string',
              isOptional: true,
            },
          ],
        }),
      ],
    },
    {
      toVersion: 16,
      steps: [
        addColumns({
          table: 'settings',
          columns: [
            {
              name: 'theme_mode',
              type: 'string',
              isOptional: true,
            },
          ],
        }),
      ],
    },
    {
      toVersion: 15,
      steps: [
        addColumns({
          table: 'books',
          columns: [
            {
              name: 'copyright',
              type: 'string',
              isOptional: true,
            },
          ],
        }),
      ],
    },
    {
      toVersion: 14,
      steps: [
        addColumns({
          table: 'books',
          columns: [
            {
              name: 'bitrate',
              type: 'number',
              isOptional: true,
            },
            {
              name: 'codec',
              type: 'string',
              isOptional: true,
            },
          ],
        }),
      ],
    },
    {
      toVersion: 13,
      steps: [
        addColumns({
          table: 'books',
          columns: [
            {
              name: 'cover_color_average',
              type: 'string',
              isOptional: true,
            },
            {
              name: 'cover_color_dominant',
              type: 'string',
              isOptional: true,
            },
            {
              name: 'cover_color_vibrant',
              type: 'string',
              isOptional: true,
            },
            {
              name: 'cover_color_dark_vibrant',
              type: 'string',
              isOptional: true,
            },
            {
              name: 'cover_color_light_vibrant',
              type: 'string',
              isOptional: true,
            },
            {
              name: 'cover_color_muted',
              type: 'string',
              isOptional: true,
            },
            {
              name: 'cover_color_dark_muted',
              type: 'string',
              isOptional: true,
            },
            {
              name: 'cover_color_light_muted',
              type: 'string',
              isOptional: true,
            },
          ],
        }),
      ],
    },
    {
      toVersion: 12,
      steps: [
        addColumns({
          table: 'books',
          columns: [
            {
              name: 'book_progress_value',
              type: 'number',
            },
          ],
        }),
        addColumns({
          table: 'settings',
          columns: [
            {
              name: 'skip_back_duration',
              type: 'number',
              isOptional: true,
            },
            {
              name: 'skip_forward_duration',
              type: 'number',
              isOptional: true,
            },
          ],
        }),
      ],
    },
    {
      toVersion: 11,
      steps: [
        addColumns({
          table: 'chapters',
          columns: [
            {
              name: 'start_ms',
              type: 'number',
              isOptional: true,
            },
          ],
        }),
      ],
    },
    {
      toVersion: 10,
      steps: [
        addColumns({
          table: 'settings',
          columns: [
            {
              name: 'library_paths',
              type: 'string',
              isOptional: true,
            },
          ],
        }),
      ],
    },
    {
      toVersion: 9,
      steps: [
        addColumns({
          table: 'settings',
          columns: [
            {
              name: 'current_book_artwork_uri',
              type: 'string',
              isOptional: true,
            },
          ],
        }),
      ],
    },
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
