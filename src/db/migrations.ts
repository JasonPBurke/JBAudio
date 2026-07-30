import {
  createTable,
  schemaMigrations,
  addColumns,
  unsafeExecuteSql,
} from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
  migrations: [
    {
      // Series feature: two new tables. Membership (series_books) is keyed by a
      // book's structural key (first file path), not book.id.
      //
      // RENUMBERED 31 -> 32 when main merged in: main claimed v31 for the
      // artwork cleanup below, and two different migrations cannot share a
      // version. Any device that applied the OLD series v31 must be wiped —
      // it sits at user_version 31, which now means the artwork migration, so
      // it would run only step 32 and hit "table series already exists".
      toVersion: 32,
      steps: [
        createTable({
          name: 'series',
          columns: [
            { name: 'name', type: 'string' },
            { name: 'sort_name', type: 'string', isIndexed: true },
            { name: 'created_at', type: 'number' },
            { name: 'updated_at', type: 'number' },
          ],
        }),
        createTable({
          name: 'series_books',
          columns: [
            { name: 'series_id', type: 'string', isIndexed: true },
            { name: 'book_key', type: 'string', isIndexed: true },
            { name: 'position', type: 'number' },
            { name: 'created_at', type: 'number' },
          ],
        }),
      ],
    },
    {
      // Data-only. usePopulateDatabase used to default a coverless book's
      // artwork to the bundled placeholder's URI, so the nullable column was
      // never null and "which books have no cover?" was unanswerable. A
      // rescan cannot heal these rows — scanLibrary skips files already in
      // the DB — so they have to be cleaned here.
      //
      // Allowlist, not denylist: every real cover is written as a file:// URI
      // (scanLibrary saveArtworkToFile, replaceBookArtwork). Anything else is
      // a placeholder — a schemeless resource id in a release build, a
      // http://10.0.2.2:8081/... Metro URL in a debug build.
      toVersion: 31,
      steps: [
        unsafeExecuteSql(
          "UPDATE books SET artwork = NULL WHERE artwork IS NOT NULL AND artwork NOT LIKE 'file://%';",
        ),
      ],
    },
    {
      // Separate from v29: test devices already migrated to 29, and
      // WatermelonDB never re-runs an applied step.
      toVersion: 30,
      steps: [
        addColumns({
          table: 'settings',
          columns: [
            {
              name: 'last_non_default_rate',
              type: 'number',
              isOptional: true,
            },
          ],
        }),
      ],
    },
    {
      toVersion: 29,
      steps: [
        addColumns({
          table: 'settings',
          columns: [
            {
              name: 'playback_rate',
              type: 'number',
              isOptional: true,
            },
          ],
        }),
      ],
    },
    {
      toVersion: 28,
      steps: [
        addColumns({
          table: 'books',
          columns: [
            {
              name: 'last_played_at',
              type: 'number',
              isOptional: true,
            },
            {
              name: 'finished_at',
              type: 'number',
              isOptional: true,
            },
          ],
        }),
      ],
    },
    {
      toVersion: 27,
      steps: [
        addColumns({
          table: 'settings',
          columns: [
            {
              name: 'last_scan_at',
              type: 'number',
              isOptional: true,
            },
          ],
        }),
      ],
    },
    {
      toVersion: 26,
      steps: [
        addColumns({
          table: 'settings',
          columns: [
            {
              name: 'shake_to_reset_enabled',
              type: 'boolean',
              isOptional: true,
            },
          ],
        }),
      ],
    },
    {
      toVersion: 25,
      steps: [
        addColumns({
          table: 'books',
          columns: [
            {
              name: 'selected_accent_color_type',
              type: 'string',
              isOptional: true,
            },
          ],
        }),
        addColumns({
          table: 'settings',
          columns: [
            {
              name: 'auto_accent_enabled',
              type: 'boolean',
              isOptional: true,
            },
          ],
        }),
      ],
    },
    {
      toVersion: 24,
      steps: [
        addColumns({
          table: 'settings',
          columns: [
            {
              name: 'mesh_gradient_enabled',
              type: 'boolean',
              isOptional: true,
            },
          ],
        }),
      ],
    },
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
