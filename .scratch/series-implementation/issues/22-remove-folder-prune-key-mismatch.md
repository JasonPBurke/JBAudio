# 22 — `removeLibraryFolder`'s prune must not destroy surviving books' membership

**Status:** resolved — jest 729/729, tsc 0, eslint 0. **DEVICE-VERIFIED 2026-08-14** on the
Pixel 7 Pro emulator (Android 15), as a real A/B against the pre-fix commit.

Corpus: two library roots that are a strict name-prefix pair — `Books` (Alpha One, 2 files;
Alpha Two, 1 file) and `Books Backup` (Beta One, 2 files) — plus a user-created `Alpha Series`
(both Alpha books, pinned cover `series_06866eaf.webp`) and `Beta Series` (Beta One alone).
Removing `Books` in Manage Library, twice, from the identical DB state (rolled back between
runs by dropping the WAL while the app was stopped):

| after removing `Books` | pre-fix (`45ae1eb`) | fixed (`d3f780e`) |
| --- | --- | --- |
| Alpha One + Alpha Two | deleted | deleted ✓ |
| `Alpha Series` (emptied) | destroyed | reaped ✓ |
| **Beta One** (untouched folder) | **deleted** ✗ | **intact** ✓ |
| **`Beta Series`** | **destroyed** ✗ | **intact, row + position kept** ✓ |
| pinned `.webp` | **leaked on disk** ✗ | **unlinked** ✓ |

Pre-fix left the DB completely empty — 0 books, 0 series, 0 membership rows — from removing
one of two folders.

⚠ **What this run does NOT prove.** It exercises the BOUNDARY defect and defect B. Defect A
(the key mismatch) is **not reachable through the UI**, and the device made the reason
concrete: **every chapter row in the corpus has `start_ms = 0.0`**, multi-file books included
(`scanLibrary.ts` gives each single-file chapter `startMs: 0`), so the library store's
"stable sort by `startMs`" is a NO-OP and the canonical key is simply the first row the fetch
returns — the same order the folder-removal site read. Add `scanLibrary.ts:192` sorting each
book's chapters by `chapterNumber` before insert, and the two readers agree in practice.
Defect A is a latent hole that needs SQLite to return a non-rowid order; staging it would mean
hand-editing rowids in the app's private DB. **The unit test is the only thing that pins it.**

Both defects fixed in one pass, root-cause first:

- **A.** `collectLiveKeys(survivingChapters)` in `seriesOrphanPrune.ts` is now the ONE
  definition of a live key — every url of every surviving chapter — and **both** prune sites
  read through it (`scanLibrary.ts` directly, `settingsQueries.ts` via the new
  `partitionBooksByRemovedFolder`). The folder-removal site no longer builds keys from an
  unsorted `chapters[0].url`, so it cannot omit a survivor's canonical key.
- The partition also classifies a book as removed only when **every** chapter is under the
  folder, which is order-independent and the conservative direction (a straddling book is
  kept, not destroyed on a coin flip). Gate is now `booksToDelete.length > 0`; `removedKeys`
  is gone.
- **B.** the reaper collects `s.artwork` for each emptied series and unlinks after the write
  commits, matching `deleteSeries` / `deleteEmptySeries`.
- Tests: `src/db/__tests__/seriesOrphanPrune.test.ts` +7 (8 → 15). The regression test was
  watched failing against a faithful extraction of the shipping rule before the fix landed.
  Defect B has no unit test — the release is IO inside an open `database.write`, and this
  repo's jest cannot import a module that pulls in RNFS or the SQLite adapter (no RN preset);
  `deleteEmptySeries`' identical release is untested for the same reason.

### ⚠ Third defect, found by the code review and fixed here — THE PREFIX HAD NO BOUNDARY

`absoluteFolderPath` was matched with a bare `startsWith`, so removing a root also matched any
SIBLING root whose name merely begins with it: removing `…/Books` **deleted every book under
`…/Books Backup`**, pruned their rows and reaped their series. Pre-existing, but it is this
ticket's headline failure by another road and worse (the books go too, not just the rows), and
the first pass had lifted that exact rule into the new shared helper while documenting it as
safe. `partitionBooksByRemovedFolder` now normalises the path to end at a separator. Watched
failing first; covered by two tests.

### Other review follow-ups

- **A book is "in the removed folder" when EVERY chapter is**, not when the first fetched one
  is. Order-independent, and conservative about the DB state that cannot be recovered: a
  straddling book keeps its rows and progress. It is correspondingly permissive about
  deletion, which the helper's doc now says out loud rather than just calling itself
  "conservative". (`some()` would preserve deletion semantics exactly but destroys a
  straddling book's rows, including chapters in a folder the user kept.)
- **The artwork release is shared, not copied.** The review's sharpest point: defect B was
  fixed by copying `deleteEmptySeries`, which is this ticket's own root cause one layer up —
  and the "cannot nest a writer" exemption does not reach it, because the unlink runs after
  the commit. Both bulk reapers now call `deleteArtworkFiles` in `artworkFiles.ts`, which
  carries the ordering rule. A helper cannot force a third path to call it; it can stop the
  rule being written twice.
- **ADR 0001 amended.** "Where the rule lives" still said the folder-removal site "inlines the
  batching, not the decision" and blamed the drift on two copies of the decision. It now
  records that the sites share the INPUT too, which is what this ticket was actually about.
- Dropped an unused default type parameter; `removed` → `removedBooks` so the asymmetric
  return names both halves.

**Source:** [Code review `d2195ed..HEAD`](../CODE-REVIEW-d2195ed.md), Findings 2 and 5 —
both CONFIRMED, both in the same function. **Fix both in one pass.**

## Defect A — the prune inversion is destructive on a key mismatch

`src/db/settingsQueries.ts:286`

Removing an unrelated library folder can destroy a **surviving** book's membership row, and
cascade into deleting the entire series — name, ordering and pinned-artwork column.

**What changed in this branch.** The diff flipped an allowlist into a blocklist:

```ts
// before — allowlist. Only keys collected from deleted books were destroyed.
if (removedKeys.has(sb.bookKey)) { ... }

// after — blocklist. Anything not in liveKeys is destroyed.
selectOrphanedMemberships(allSeriesBooks, liveKeys)  // rows.filter(r => !liveKeys.has(r.bookKey))
```

Under the allowlist an unmatched key was **harmless** — the row simply survived. Under the
blocklist every gap in `liveKeys` is destructive.

**Why there are gaps.** `liveKeys` is built from `chapters[0].url` of a raw
`await book.chapters.fetch()`, whose order WatermelonDB does not guarantee. The canonical key
is the **startMs-sorted** first chapter:

- `src/store/library.tsx:61` — `.sort((a, b) => (a.startMs ?? 0) - (b.startMs ?? 0))`
- `src/db/detectionQueries.ts:70` — *"`bookStructuralKey` takes `chapters[0].url` **after
  the library store sorts** chapters by `startMs ?? 0` with a STABLE sort."*

Any surviving book whose rowid order differs from startMs order contributes the wrong key,
`selectOrphanedMemberships` classes its row as an orphan, and `selectEmptySeriesIds` then
reaps the whole series.

**The two prune sites flatly disagree** — despite the new comment asserting both *"delegate
to `seriesOrphanPrune`, which is authoritative"*:

| Site | `liveKeys` contains | Character |
| --- | --- | --- |
| `src/helpers/scanLibrary.ts:1013` | **every** surviving chapter url | forgiving superset |
| `src/db/settingsQueries.ts:286` | one `chapters[0].url` per book | destructive subset |

Extracting the *decision* into `seriesOrphanPrune` did not stop the *inputs* from drifting.
That is the root cause.

## Defect B — the empty-series reaper leaks pinned artwork

`src/db/settingsQueries.ts:346`

The inlined reaper pushes `s.prepareDestroyPermanently()` and **nothing else**.
`seriesQueries.deleteSeries` and `deleteEmptySeries` both call `deleteArtworkFile(...)` for
exactly this case (§K8).

A series with a pinned cover (`series.artwork = file://…/artwork/series_<hash>.webp`) that
loses its last member to a folder removal orphans the `.webp` on disk, with no row
referencing it and no cleanup path in the app.

## What to build

**Defect A:** make `liveKeys` a superset that cannot omit a surviving book's canonical key.
Feeding **every** surviving chapter url matches the sibling site and is safe — a removed
book's chapters are all deleted, so its urls never enter the set — while still pruning rows
for genuinely removed books.

Prefer a **shared helper both prune sites call**, so they cannot drift again. That addresses
the root cause rather than the symptom. Note the two sites start from different inputs
(`allBooks` with a chapters relation here; `allChapters` + `removedChapterIds` there), so the
shared seam probably takes surviving chapter urls rather than books.

**Defect B:** release the artwork file alongside the row, as the other two delete paths do.

## Acceptance criteria

- [x] **Test first.** A failing test showing a surviving book's membership row is **not**
      pruned when its chapter fetch order differs from startMs order. Watch it fail.
      `src/db/__tests__/seriesOrphanPrune.test.ts` is the existing home for the pure
      decision; the key-construction seam is what needs covering, so extract it far enough to
      be testable without the native SQLite adapter — `seriesMembershipDiff` is the
      precedent named in `seriesOrphanPrune.ts`'s own header.
- [x] A genuinely removed book's membership row **is** still pruned, and a series left with
      zero members is still reaped. Do not regress the feature the inversion was for.
- [x] The empty-series reaper releases pinned artwork via `deleteArtworkFile`, matching
      `deleteSeries` / `deleteEmptySeries`.
- [x] Both prune sites derive `liveKeys` through **one** shared definition, or the divergence
      is documented as deliberate with a reason.
- [x] jest green (**729/729** — 722 before this ticket, +7; the 711 in the review predates tickets 21+23).
- [x] `tsc` 0 errors · eslint 0 errors.

## ⚠ Notes

- `seriesOrphanPrune.ts`'s header forbids branching on provenance in the prune decision —
  `'user'` rows and `'excluded'` tombstones are destroyed like `'detected'` ones. That ruling
  stands (ADR 0001); this ticket changes **which keys count as live**, not the decision.
- The two guards *above* the scan-side prune site (missing root skipped wholesale, empty
  enumeration skips cleanup) are load-bearing and must not be tidied — they are why renaming
  your library folder destroys nothing.
- Never run a formatter over this repo — there is no config file.
