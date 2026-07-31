# Stop Persisting the Placeholder Cover into `books.artwork`

**Date:** 2026-07-29
**Status:** Approved

## Problem

`src/hooks/usePopulateDatabase.tsx` writes the bundled placeholder image's
URI into `books.artwork` whenever a book has no cover of its own — four
sites, lines 66, 113, 264 and 311, all:

```ts
book.artwork = bookData.artwork || unknownBookImageUri;
```

This is wrong on five counts:

- **The schema already expresses "no cover."** `src/db/schema.ts:15` declares
  `artwork` as `isOptional: true`. The column was designed to hold `null`.
- **Every reader already handles `null`.** `BookListItem:101`,
  `titleDetails:489`, `PlayerArtwork:42`, `editTitleDetails:166`,
  `BookGridItem:281` and `FloatingPlayer:94` all do
  `artwork ?? unknownBookImageUri`; `androidAutoCache:26` does `?? ''`. The
  write-side default is therefore redundant as well as wrong, and the
  codebase carries two contradictory conventions for the same column.
- **The stored value is build-dependent.** `Image.resolveAssetSource()`
  yields a Metro `http://10.0.2.2:8081/...` URL in a debug build — dead the
  moment Metro stops, and specific to one machine and session — and a bare,
  schemeless Android resource identifier in a release build. A value whose
  meaning depends on how the app was compiled is not a fact about a book.
  The resource id is derived from the asset's path, so reorganizing
  `assets/images/` silently dangles every stored row.
- **It destroys the "which books have no cover?" query.** The column is
  always truthy, so `artwork ?? fallback` never fires on the data itself.
  This is what defeated the first fix attempt in the Android ≤12
  notification-player work and forced the forensic workaround
  `resolveTrackArtwork()`, which infers "no cover" from the *absence of a
  URI scheme*.
- **It freezes a presentation decision at write time.** Ship a new default
  cover, or a dark-mode variant, and every old row keeps answering with the
  old one.

The governing principle: **store facts, derive presentation.** `null` is a
fact. "Show `unknown_track.png`" is UI policy, and policy belongs where the
context to apply it exists — the notification, Android Auto and a grid cell
each need a different form of that fallback.

### Why a data migration is required

A rescan will not heal existing rows. `scanLibrary.ts:364` skips any file
already represented in the DB (via the pre-built `existingUrls` set), so
`usePopulateDatabase`'s update branches (lines 113 and 311) only ever fire
for *newly discovered* files. Fixing the four writes alone would leave every
already-scanned coverless book holding a placeholder string forever.

### Motivation, not scope

The concrete cost of the bug is that a bulk "fetch covers for the books that
are missing them" screen cannot be written correctly today: the query it
needs (`WHERE artwork IS NULL`) matches zero rows no matter how many
coverless books the library holds. Today's cover search
(`src/app/coverArtSearch.tsx`) is single-book only — route params `bookId`,
`author`, `bookTitle`, reachable solely from `editTitleDetails.tsx:78`.

No such bulk screen is designed, requested, or deferred by this work. It is
cited here only to make the cost of the broken column concrete.

## Design

### 1. Write-side

All four sites in `src/hooks/usePopulateDatabase.tsx` become:

```ts
book.artwork = bookData.artwork || null;
```

and the now-unused `unknownBookImageUri` import (line 8) is dropped.

`bookData.artwork` at these sites is already `string | null` —
`extractArtworkForBook` (`scanLibrary.ts:807`) returns either a `file://`
URI or an explicit `null` — so `|| null` is pure normalization, and it folds
`''`/`undefined` the same way the surrounding assignments do.

### 2. Migration to schema v31

`src/db/schema.ts`: `version: 30` → `31`.

`src/db/migrations.ts`, prepended (the file lists migrations newest-first):

```ts
{
  toVersion: 31,
  steps: [
    unsafeExecuteSql(
      "UPDATE books SET artwork = NULL WHERE artwork IS NOT NULL AND artwork NOT LIKE 'file://%';",
    ),
  ],
},
```

An **allowlist, not a denylist.** Every real cover this app writes is a
`file://` URI — scan-extracted at `scanLibrary.ts:752`
(`file://${finalImagePath}`) and manually replaced at
`replaceBookArtwork.ts:54` (`file://${finalPath}?t=${Date.now()}`). So
`NOT LIKE 'file://%'` catches both the release-build resource identifier and
the debug-build `http://10.0.2.2:8081/...` Metro URL. A denylist phrased as
"not `file://` and not `http(s)://`" would let the Metro rows through.

Two mechanical constraints, both verified against
`@nozbe/watermelondb@0.28.0`:

- `unsafeExecuteSql` requires a **trailing semicolon** — the adapter
  concatenates every step's SQL into a single string
  (`adapters/sqlite/encodeSchema/index.js:88`), so an unterminated statement
  corrupts the batch. The library asserts on this.
- `'sql'` steps are supported by the SQLite adapter's migration encoder
  (same file, line 94).

No `_status`/`_changed` bookkeeping is needed: this database is local-only,
with no sync adapter. The migration runs at adapter setup, before any record
is loaded, so there is no stale in-memory cache to invalidate.

### 3. `resolveTrackArtwork` — keep the logic, correct the comment

`src/helpers/defaultArtwork.ts:28` keeps its any-scheme test. It remains
load-bearing as defence in depth, both for the playback path and against any
future write site that reintroduces a schemeless value.

Its comment, however, currently asserts that "usePopulateDatabase persists
that value for coverless books" — which this change makes false. Rewrite it
to state the new invariant (stored artwork is a `file://` URI or `null`) and
to explain why the guard is retained anyway.

### Downstream `null` handling is already correct

Verified, not assumed:

- **Playback / notification.** The RNTP patch's `applyDefaultArtwork`
  substitutes the bundled cover natively when `track.artwork == null`
  (`patches/react-native-track-player+…patch:644-647`). The fallback lives
  in native code precisely because every JS route to the bundled image is
  unusable in a release build.
- **Android Auto browse tree.** `androidAutoCache.ts:26` maps `null` to
  `''`, and the native reader skips `setArtworkUri` when the string is empty
  (patch line 861-865). Behaviour is unchanged from today, where the
  schemeless resource id fails `artworkToContentUri` and returns `null`.
- **In-app UI.** All six screen-level readers already apply
  `?? unknownBookImageUri`.

## Testing

New `src/db/__tests__/schemaMigrations.test.ts` — both modules import
cleanly under this repo's jest config (verified; no RN preset needed):

- **`migrations.maxVersion === schema.version`.** This is the substantive
  guard. WatermelonDB validates that migrations have no gaps or duplicates,
  but it does *not* check them against the schema version — and this repo
  has already been bitten there, as the v30 entry's comment about devices
  stranded on 29 records.
- The v31 entry exists, is a single `sql` step, ends in `;`, and targets
  `books.artwork` with the `file://` allowlist.

New `src/helpers/__tests__/defaultArtwork.test.ts` — there is none today.
Covers `null`/`undefined`/`''` → `undefined`, a schemeless resource id →
`undefined`, and a `file://…?t=…` URI → passthrough.

Full gate: `tsc`, `eslint`, `jest` all green before device work.

Device verification: install over an existing v30 database and confirm that
coverless books still render the placeholder in the list, the grid, the
player, the notification and Android Auto — and that the column is actually
`NULL` afterwards.

## Rollout

Branch `fix/artwork-placeholder-null`, off `main`.

**Downgrade trap:** once a device reaches v31, installing any v30-based
build resets its database and forces a full rescan — WatermelonDB cannot
migrate downwards. This is the same hazard already documented for the
`feature/series` branch. Uninstall before sideloading an older build.

**Schema collision:** `feature/series` (unmerged) also claims v31. Once this
lands on `main`, that branch must move its schema and migration entry to
v32. Flagged here; not done as part of this work.

## Out of scope

- **`PLACEHOLDER_ARTWORK_SIZE = 500`** (`scanLibrary.ts:774`) still writes
  500×500 dimensions for coverless books. It is the same
  presentation-baked-into-data smell, but benign: it yields the 1:1 aspect
  ratio the placeholder image wants, and every reader already guards on
  null before using the dimensions. Left alone deliberately.
- **Tightening `resolveTrackArtwork` to a `file://`-only test.** The new
  invariant would permit it, but the looser check costs nothing and fails
  safe.
