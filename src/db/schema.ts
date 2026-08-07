import { appSchema, tableSchema } from '@nozbe/watermelondb';

// PROVENANCE NAMING, so the pattern does not have to be reverse-engineered:
//
//   `<x>_source` names the provenance of the column `<x>` beside it.
//   A bare noun names a column whose value IS its own provenance.
//
// So `name_source` sits beside the series name and `canonical_source` beside
// the canonical number, while `origin` and `membership` have no neighbour — a
// series exists because someone created it, a join row exists because someone
// put that book there. The row's existence is the value.
//
// All four are nullable and every pre-existing row reads null, because a
// migration cannot backfill a value (see the v33 block in migrations.ts).
// src/db/seriesProvenance.ts is the single place that null is resolved.
export default appSchema({
  version: 33,
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
        {
          name: 'selected_accent_color_type',
          type: 'string',
          isOptional: true,
        },
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
        // Tags read from the file. Populated by the scan; null on every book
        // imported before v33, and deliberately not backfilled.
        {
          name: 'series',
          type: 'string',
          isOptional: true,
        }, // extra.SERIES — the raw tag, NOT series membership (that is series_books)
        {
          name: 'part',
          type: 'number',
          isOptional: true,
        }, // extra.PART
        {
          name: 'grouping',
          type: 'string',
          isOptional: true,
        }, // top-level Grouping (iTunes ©grp)
        {
          name: 'file_format',
          type: 'string',
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
        {
          name: 'auto_accent_enabled',
          type: 'boolean',
          isOptional: true,
        },
        {
          name: 'shake_to_reset_enabled',
          type: 'boolean',
          isOptional: true,
        },
        {
          name: 'last_scan_at',
          type: 'number',
          isOptional: true,
        },
        {
          name: 'playback_rate',
          type: 'number',
          isOptional: true,
        },
        {
          name: 'last_non_default_rate',
          type: 'number',
          isOptional: true,
        },
        // Series preferences. Nullable like every optional setting — including
        // on a fresh install, since the seeder only seeds three fields — so the
        // DEFAULT LIVES IN THE GETTER. The first two are default-ON and must
        // read `!== false` with a `true` fallback; the house `=== true` idiom
        // would ship every existing tester the opposite of the chosen default,
        // silently.
        {
          name: 'series_backgrounds_enabled',
          type: 'boolean',
          isOptional: true,
        }, // default ON
        {
          name: 'series_detection_enabled',
          type: 'boolean',
          isOptional: true,
        }, // default ON
        {
          name: 'series_folder_grouping_enabled',
          type: 'boolean',
          isOptional: true,
        }, // default OFF
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
    // User-created series (also usable as personal playlists). Membership lives
    // in series_books, keyed by a book's STRUCTURAL KEY (first file path), never
    // book.id — see docs/superpowers/specs/2026-07-24-series-feature-design.md.
    tableSchema({
      name: 'series',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'sort_name', type: 'string', isIndexed: true },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
        // 'detected' | 'user' — null reads as 'user'.
        { name: 'origin', type: 'string', isOptional: true },
        // 'detected' | 'user' — null reads as 'user'. Provenance of `name`.
        { name: 'name_source', type: 'string', isOptional: true },
        // A pinned cover. No *_source companion: null already means "derived
        // from the member books".
        { name: 'artwork', type: 'string', isOptional: true },
      ],
    }),
    tableSchema({
      name: 'series_books',
      columns: [
        { name: 'series_id', type: 'string', isIndexed: true },
        // Structural key = book.chapters[0].url (first file path). Survives tag
        // edits + rescans that churn book.id. Resolved to a live Book in JS.
        { name: 'book_key', type: 'string', isIndexed: true },
        { name: 'position', type: 'number' },
        { name: 'created_at', type: 'number' },
        // Displayed as the badge; `position` keeps sole sort authority.
        { name: 'canonical_number', type: 'number', isOptional: true },
        // 'user' | 'detected'. The one provenance column that does NOT
        // coalesce: null means "no number is set".
        { name: 'canonical_source', type: 'string', isOptional: true },
        // 'detected' | 'user' | 'excluded' — null reads as 'user'.
        { name: 'membership', type: 'string', isOptional: true },
      ],
    }),
    // Series names the user deleted, so a detection run cannot resurrect them.
    // No unique constraint is available anywhere in this DB library, so the
    // name must be de-duplicated in JS on write.
    tableSchema({
      name: 'suppressed_series',
      columns: [
        { name: 'name', type: 'string' },
        { name: 'created_at', type: 'number' },
      ],
    }),
    // The whole General track (including its `extra` bag) as JSON, one row per
    // book. A SIDE TABLE on purpose: a model's full raw record is loaded into
    // memory, and the library store observes seventeen `books` columns across
    // the entire library, so a ~2 KB blob on `books` would ride every library
    // query.
    tableSchema({
      name: 'book_tags',
      columns: [
        { name: 'book_id', type: 'string', isIndexed: true },
        { name: 'raw_json', type: 'string' },
        { name: 'captured_at', type: 'number' },
      ],
    }),
  ],
});
