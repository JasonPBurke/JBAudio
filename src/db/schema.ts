import { appSchema, tableSchema } from '@nozbe/watermelondb';

export default appSchema({
  version: 24,
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
        { name: 'bitrate', type: 'number', isOptional: true },
        { name: 'codec', type: 'string', isOptional: true },
        { name: 'copyright', type: 'string', isOptional: true },
        { name: 'total_track_count', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        { name: 'artwork_height', type: 'number', isOptional: true },
        { name: 'artwork_width', type: 'number', isOptional: true },
        { name: 'book_progress_value', type: 'number' },
        // DEPRECATED: cover_color_average is no longer used, will be removed in future version
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
        {
          name: 'has_auto_generated_chapters',
          type: 'boolean',
          isOptional: true,
        },
        {
          name: 'is_single_file',
          type: 'boolean',
          isOptional: true,
        },
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
        { name: 'start_ms', type: 'number', isOptional: true },
        { name: 'is_auto_generated', type: 'boolean', isOptional: true },
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
        {
          name: 'library_paths',
          type: 'string',
          isOptional: true,
        },
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
        {
          name: 'theme_mode',
          type: 'string',
          isOptional: true,
        },
        {
          name: 'custom_primary_color',
          type: 'string',
          isOptional: true,
        },
        {
          name: 'bedtime',
          type: 'number',
          isOptional: true,
        },
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
        {
          name: 'bedtime_mode_enabled',
          type: 'boolean',
          isOptional: true,
        },
        {
          name: 'auto_chapter_interval',
          type: 'number',
          isOptional: true,
        },
        {
          name: 'mesh_gradient_enabled',
          type: 'boolean',
          isOptional: true,
        },
      ],
    }),
    tableSchema({
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
});
