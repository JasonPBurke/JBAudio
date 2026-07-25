# Series Feature — Design Spec

**Date:** 2026-07-24
**Status:** Approved (design); implementation plan pending
**Author:** Jason Burke (with Claude)

## Summary

Books that belong to a reading series (e.g. *Memory, Sorrow, and Thorn*) are
currently scattered because the library sorts titles alphabetically. This
feature lets the user **manually create named, ordered "series"** — groupings of
books in a user-defined order — and browse them on a new **Series** screen
modeled after `BooksHome` (author sections), grouped by series name instead of
author and **without** the "Recently Added" row.

Because a series is just *an ordered, named, user-authored set of books*, the
same structure doubles as **personal playlists** (e.g. an official "Discworld"
series plus a personal "Discworld: Night Watch" subset). Nothing in the design
should foreclose that use.

Series metadata cannot be reliably derived from file tags, so **series are
created manually** by the user.

## Scope

**In scope:** create / browse / edit / delete series; a new Series toggle view
replacing `BooksList`; a create wizard; a consolidated edit screen; durable
membership across tag edits and rescans.

**Out of scope:** replacing `BooksGrid` with a Favorites view (future);
auto-generating series from metadata; any change to the scan reconciler's
identity model (we deliberately avoid touching it — see §7).

---

## 1. Toggle changes

The library header toggle (`Header.tsx` `handleToggleView`, `% 3`) keeps three
slots but slot `1` changes meaning:

| slot | view | icon |
|---|---|---|
| 0 | `BooksHome` (authors) | `Library` (unchanged) |
| 1 | **Series** (new) | **`Layers`** (lucide) |
| 2 | `BooksGrid` (future Favorites) | `Grip` (unchanged) |

`BooksList.tsx` is **unwired** from the toggle but **kept in the repo** for now
(may inform the future Favorites work).

`index.tsx` renders `<SeriesHome />` when `toggleView === 1`.

---

## 2. Data model (WatermelonDB migration → schema v31)

Two new tables.

### `series`
| column | type | notes |
|---|---|---|
| `name` | string | user-entered; **duplicates allowed** (identity = row id, not name) |
| `sort_name` | string | normalized (lowercased) name for A–Z ordering |
| `created_at` | number | |
| `updated_at` | number | bumped on any edit |

### `series_books` (join — keyed by **structural key**, not `book_id`)
| column | type | notes |
|---|---|---|
| `series_id` | string, indexed | belongs-to `series` |
| `book_key` | string, indexed | **structural key = the book's first file path** |
| `position` | number | 0-based order within the series |
| `created_at` | number | |

**Deliberate omission:** there is **no foreign key to `books`**. `book.id` churns
on edit+rescan; the file path does not. The join stores the path and we resolve
to the live book at read time. This is the decision that makes "edit a title
after adding a book to a series" safe (§7).

Models: `Series.ts` (`has_many series_books`), `SeriesBook.ts`
(`belongs_to series`). Migration adds both tables at version 31 (see
`migrations.ts` / `schema.ts` patterns; current version is 30).

**Structural key helper:** `bookStructuralKey(book) => book.chapters[0]?.url`.
This matches the "structural identity = first file path" convention already
established in `artworkIdentity.ts`. A file belongs to exactly one book, so the
key is unique per book.

---

## 3. Reactive state

### `seriesStore` (Zustand + WatermelonDB observation)
Mirrors `src/store/library.tsx`. Observes `series` + `series_books` and combines
with the live library `books` map to produce a render-ready shape:

```ts
type SeriesProgressState = 'unplayed' | 'playing' | 'finished';

type DerivedSeries = {
  id: string;
  name: string;
  books: Book[];                 // resolved from book_key via a
                                 //   Map<structuralKey, Book>, in `position`
                                 //   order; unresolvable keys skipped
  progressState: SeriesProgressState;
};
```

- Recomputes when **either** series data **or** the library store changes
  (resolution depends on both).
- `Map<structuralKey, Book>` is built from `useLibraryStore.getState().books`
  (each `Book` carries `chapters[].url`).
- Display order: series sorted A–Z by `sort_name`; books kept in `position`
  order.

### `seriesDraftStore` (Zustand) — wizard/edit working state
```ts
type SeriesDraft = {
  mode: 'create' | 'edit';
  editingSeriesId?: string;
  name: string;
  selectedAuthorNames: string[];   // step 1 (create only)
  selectedBookKeys: string[];      // step 2 / add-books (structural keys)
  orderedBookKeys: string[];       // step 3 / edit (structural keys, in order)
};
```
- **Reset on wizard entry** so an abandoned draft never leaks into the next run.

---

## 4. Series progress state (Completion model)

Derived per series from its resolved books' `bookProgressValue`
(0 NotStarted / 1 Started / 2 Finished):

| books | series state |
|---|---|
| every book NotStarted | **Unplayed** |
| every book Finished | **Finished** |
| anything in between (≥1 with progress, not all finished) | **Playing** |

An empty (zero resolvable books) series is handled by auto-delete (§7), so it
never needs a state.

Because membership is many-to-many, one started book can push several series
into **Playing** at once — this is correct and falls out of per-series
derivation.

---

## 5. Series listing screen (`SeriesHome`, toggle view 1)

Modeled on `BooksHome`: a single `FlashList` over a flat data array, **without**
the "Recently Added" row.

- **Header:** shared `Header` stays (settings / title / toggle icon + progress
  tab bar).
- **Tabs:** counts are **series counts** by the Completion model; selecting a
  tab filters to matching series and shows **all** their books in series order.
- **Sticky list header:** full-width **"+ Create Series"** button; also the
  anchor for the empty state — *"No series have been set up. Tap 'Create
  Series' to build a new one."*
- **Flat-array item types** (`FlatListItem` union, mirroring `BooksHome`):
  - `sectionHeader` — series name + expand chevron (tap toggles expand).
  - `seriesEditBar` — **expand-only**, full-width **"✎ Edit series"** button
    row inserted right after the header when the section is expanded. Full-width
    (`span = maxColumns`), stateless/recycling-safe, no nested-tap risk.
  - `horizontalRow` — collapsed state; covers via `BooksHorizontal` with
    **`preserveOrder`** so series order is honored (not alphabetical).
  - `book` — expanded grid via `BookGridItem`.
- **Expansion:** reuse the unlimited-open `activeGridSections: Set<string>`
  pattern (session-only; expanding never collapses another — sidesteps the
  FlashList v2 "case 3" flash, per memory `flashlist-2.3.2-mvcp-header-anchor`).
- **Search:** the shared `SearchBar` overlay, in Series view, matches series
  whose **name** matches **or** that **contain a book whose title** matches;
  matched series show all their books.

---

## 6. Create wizard (pushed stack routes)

Routes: `series/create/authors` → `series/create/books` → `series/create/order`.
Working state in `seriesDraftStore` (reset on entry). Native back = previous
step.

### Step 1 — `authors` (multi-select filter)
- List of all authors with selection bubbles.
- Instructional text at top.
- **Next** disabled until ≥1 author selected. **Exit** cancels (clears draft).
- Author is a **filter only** — never stored on the series; a series' authors are
  derived from its books.

### Step 2 — `books` (select + name)
- Required series-name `TextInput` pinned at top.
- Union of the selected authors' books, **grouped by author** with a light
  author subheading; each row (`SeriesBookRow`, selection context) has a
  selection bubble/outline; tap toggles selection.
- Instructional text guiding selection.
- **Next** disabled until name is non-empty (trimmed) **and** ≥1 book selected.

### Step 3 — `order` (drag-sort)
- Selected books as a vertical drag-sortable list:
  **`Sortable.Grid` (`columns={1}`)** from `react-native-sortables`, with a
  **`CustomHandle`** grip so a row tap doesn't initiate a drag. `onDragEnd`
  writes the new order into `orderedBookKeys`.
- Rows use `SeriesBookRow` (sortable context: drag handle; no remove in create).
- Bottom button **"Create Series"** commits: writes the `series` row +
  `series_books` rows (`book_key` = structural key, `position` = index), then
  pops to the listing.

---

## 7. Edit screen (`series/edit/[id]`, single consolidated)

Reached via the expand-only **"✎ Edit series"** button on the listing. Loads the
series into `seriesDraftStore` (mode `edit`).

- Editable **name** field (pre-filled).
- Current books as the **same drag-sortable list** (`Sortable.Grid columns={1}` +
  `CustomHandle`), each `SeriesBookRow` with a **remove (–)** control.
- **"+ Add books"** → opens the author→book picker (reuses Step 1 → Step 2 in
  **append** mode); books already in the series are shown as already-selected so
  they can't double-add. Returns to the edit screen with additions appended.
- **"Delete Series"** at the bottom, with a confirm dialog. Deletes the `series`
  row + its `series_books` rows (books untouched).
- **Save** persists name + membership + reordered `position`s (diffing against
  existing rows). Removing the last book on Save triggers the guarded
  auto-delete (§8).

---

## 8. Resilience & edge cases

Membership is anchored on the **structural key (first file path)**, not
`book.id`. Consequences:

- **Edit title/author in-app:** safe. In-app edits write to the DB, not the file,
  so the path is unchanged and membership resolves unchanged. (`book.id` is also
  preserved by `updateBookDetails`, but we don't rely on it.)
- **Rescan after an edit:** the scan reconciler may mint a *new* `book.id` for the
  same file (it re-identifies by file-tag author+title), but the new row still has
  the same first-file path, so membership re-resolves to it automatically.
- **Render-time skip:** `book_key`s that don't resolve against the live library
  are omitted. `BookListItem`/`BookGridItem` already no-op on unknown ids as a
  second net.
- **Write-time prune:** hook the existing scan-cleanup (`scanLibrary.ts` orphan
  step, ~L916–942) and the settings path-removal flow
  (`settingsQueries.ts` book deletion) to delete `series_books` rows whose
  `book_key` no longer exists in the library.
- **Auto-delete-when-empty, guarded:** a series with zero *resolvable* books is
  deleted only on a **stable** empty state (post-scan settle, or explicit
  last-book removal on Edit Save) — never on a transient mid-scan flicker.

**Residual limitation:** physically moving/renaming the underlying files (not
their tags) changes the path and breaks membership — but this already breaks the
app's identity everywhere (artwork, progress), so series are exactly as robust as
the rest of the app, no worse.

---

## 9. Shared component: `SeriesBookRow`

A lightweight presentational row styled after `BookListItem` (cover + title +
author) with **no playback logic**, and a context-swappable right slot:

- **selection** context → selection bubble/outline (Step 2 & Add-books).
- **sortable** context → `CustomHandle` drag grip + optional remove (–)
  (Step 3 & Edit).

Rationale: `BookListItem` owns real playback state (`handleBookPlay`,
active-track hooks, footprints); bending it into a reorder row would run those
React-Compiler-sensitive hooks inside sortable cells and risk drag/tap gesture
collisions. A purpose-built presentational row keeps "the library row plays, the
series row arranges" cleanly separated.

---

## 10. Library / gesture wiring

- `react-native-sortables` requires a `GestureHandlerRootView` ancestor (verify
  the app root wraps one) and, for drag-across-scroll, wrapping the sortable in
  `Sortable.Layer` / `PortalProvider` per the library's guidance. Compatible with
  Reanimated 4.x + New Architecture (already in use).

---

## 11. File inventory (anticipated)

**New**
- `src/db/models/Series.ts`, `src/db/models/SeriesBook.ts`
- `src/db/seriesQueries.ts` (create/update/delete/observe; prune helper)
- `src/store/seriesStore.ts`
- `src/store/seriesDraftStore.ts`
- `src/components/SeriesHome.tsx`
- `src/components/SeriesBookRow.tsx`
- `src/app/(drawer)/(library)/series/create/authors.tsx`
- `src/app/(drawer)/(library)/series/create/books.tsx`
- `src/app/(drawer)/(library)/series/create/order.tsx`
- `src/app/(drawer)/(library)/series/edit/[id].tsx`
- `src/helpers/bookStructuralKey.ts` (or extend `artworkIdentity.ts`)

**Modified**
- `src/db/schema.ts` (v31), `src/db/migrations.ts`
- `src/db/index.ts` (register models)
- `src/components/Header.tsx` (Series icon)
- `src/app/(drawer)/(library)/index.tsx` (render `SeriesHome` at toggle 1)
- `src/helpers/scanLibrary.ts` (prune orphaned `series_books`)
- `src/db/settingsQueries.ts` (prune on path removal)

**Unwired (kept):** `src/components/BooksList.tsx`

---

## 12. Testing focus

- Series progress-state derivation (Completion model) across mixed book states.
- Structural-key resolution + graceful-skip for unresolvable keys.
- Orphan pruning on scan-cleanup and path removal.
- Guarded auto-delete (does not fire mid-scan; does fire on stable empty).
- Draft-store reset on wizard entry.
- Position persistence round-trips through create → edit reorder.
- Membership survives a simulated title edit (same key resolves to a new id).
