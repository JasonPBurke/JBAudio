import {
  createTable,
  schemaMigrations,
  addColumns,
  unsafeExecuteSql,
} from '@nozbe/watermelondb/Schema/migrations';

export default schemaMigrations({
  migrations: [
    {
      // Series redesign: the WHOLE data model, in one version number.
      //
      // APPENDED, never a rewrite of v32. Rewriting v32 was live — no real
      // device has ever run it — and was rejected anyway: append-only is the
      // discipline that survives being WRONG about who has what. Consequences,
      // all checked: real devices go 31 -> 32 -> 33, and v33's addColumns on
      // series / series_books therefore run against ZERO rows, because v32
      // creates those tables empty. Emulators need no wipe.
      //
      // ONE version number, not five, because this branch shares a version
      // namespace with main (main is at 31, this branch at 32, 33 uncontested).
      // Every extra version is another silent-failure surface: a failed
      // migration has NO runtime signal at all, and unsafeExecuteSql's
      // assertion is dev-only. A migration lands optional COLUMNS, not
      // behaviour, so features still ship one at a time on top of this block —
      // nothing reads any of these columns yet, and that is correct.
      //
      // EVERY ADDED COLUMN IS isOptional, and that is not a style choice. See
      // the v3 entry at the bottom of this file for what happens otherwise:
      // addColumns cannot backfill a value, so a non-optional column is filled
      // by the library's null-value function ('' / 0 / false) instead. A
      // non-optional enum column would hold '', a value its TypeScript union
      // says cannot exist.
      //
      // No SQL backfill step accompanies this. It would be a no-op on every
      // real device (zero rows, as above) and buys only tidier emulator data,
      // at the price of raw SQL on a surface that fails silently. Existing
      // rows read null and resolve to 'user' — see src/db/seriesProvenance.ts,
      // which is the ONE place that decision is made.
      toVersion: 33,
      steps: [
        addColumns({
          table: 'series_books',
          columns: [
            // Displayed as the badge. `position` keeps sole sort authority.
            { name: 'canonical_number', type: 'number', isOptional: true },
            // 'user' | 'detected'. NOT coalesced on read: null means "no
            // number is set", since canonical_number is itself nullable.
            { name: 'canonical_source', type: 'string', isOptional: true },
            // 'detected' | 'user' | 'excluded'.
            { name: 'membership', type: 'string', isOptional: true },
          ],
        }),
        addColumns({
          table: 'series',
          columns: [
            // 'detected' | 'user'
            { name: 'origin', type: 'string', isOptional: true },
            // 'detected' | 'user'
            { name: 'name_source', type: 'string', isOptional: true },
            // A pinned cover. No *_source companion: null already means
            // "derived from the member books".
            { name: 'artwork', type: 'string', isOptional: true },
          ],
        }),
        // Names the user deleted. A detection run must not resurrect them.
        // Read once into a Set per run, so no index — and an index would not
        // buy uniqueness anyway: this DB library has no unique-constraint
        // support, isIndexed emits a plain index. The name has to be
        // de-duplicated in JS on write or a double-delete writes two rows and
        // the "Removed Series (N)" count is wrong.
        createTable({
          name: 'suppressed_series',
          columns: [
            { name: 'name', type: 'string' },
            { name: 'created_at', type: 'number' },
          ],
        }),
        addColumns({
          table: 'settings',
          columns: [
            // Settings in this app ARE schema: one column per preference on a
            // single-row table. Null is the universal state of an optional
            // setting — the settings seeder only seeds three fields, so these
            // are null on a FRESH install too, not just after this migration.
            // The default therefore lives in the getter, and the two
            // default-ON ones need `!== false` with a `true` fallback, NOT the
            // house `=== true` idiom, or every existing tester silently gets
            // the opposite of the chosen default.
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
        addColumns({
          table: 'books',
          columns: [
            // Tags the scan currently reads and throws away. Detection's two
            // highest-trust signals (extra.SERIES, Grouping) have never been
            // persisted by anything — "already reachable from JS" was true of
            // the turbomodule and false of the database.
            //
            // NOT backfilled, by ruling: existing rows fill when their files
            // are scanned as new. Measured as safe, not assumed — re-running
            // detection with these nulled leaves series count, coverage and
            // grouping purity byte-identical; only canonical-number accuracy
            // moves (96.4% -> 93.5%).
            { name: 'series', type: 'string', isOptional: true }, // extra.SERIES
            { name: 'part', type: 'number', isOptional: true }, // extra.PART
            { name: 'grouping', type: 'string', isOptional: true }, // Grouping
            { name: 'file_format', type: 'string', isOptional: true },
          ],
        }),
        // The whole General track including its `extra` bag, as JSON.
        //
        // A SIDE TABLE, not a books column, and that is load-bearing:
        // WatermelonDB loads a model's full raw record into memory, and the
        // library store observes seventeen books columns across the entire
        // library, so a ~2 KB blob per book would ride every library query.
        // Here it is read only when something asks for it (~0.70 MB / 350
        // books). Capture is deliberately wider than detection needs — a later
        // feature that displays a file's metadata then costs no migration and
        // no second pass, which a column list can never offer, because a
        // column only holds a tag somebody predicted.
        //
        // book_id is indexed and is the ONE index this model adds: a foreign
        // key on a table that grows with the library, the same shape as every
        // existing indexed column.
        createTable({
          name: 'book_tags',
          columns: [
            { name: 'book_id', type: 'string', isIndexed: true },
            { name: 'raw_json', type: 'string' },
            { name: 'captured_at', type: 'number' },
          ],
        }),
      ],
    },
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
          // CORRECTION: it does not. addColumns destructures only
          // { table, columns, unsafeSql } — a defaultValue passed here is
          // SILENTLY DROPPED and there is no way to make a migration backfill
          // a chosen value. What actually filled these rows is the library's
          // null-value function: 0 for a non-optional number. It happened to
          // agree with the 0 written below, which is exactly why the mistaken
          // comment survived from v3 to v33 unnoticed. Left in place as a
          // record; trust nothing to it. For a string that value would have
          // been '', which is how a non-optional enum column ends up holding a
          // value its own type says cannot exist. Hence: v33 adds only
          // optional columns.
          // @ts-ignore: inert — see above.
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
          // CORRECTION: inert, exactly as above — the 0 that filled these rows
          // came from the null-value function, not from this line.
          // @ts-ignore: inert — see above.
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
