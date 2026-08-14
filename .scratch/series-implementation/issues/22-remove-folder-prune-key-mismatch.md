# 22 — `removeLibraryFolder`'s prune must not destroy surviving books' membership

**Status:** ready-for-agent

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

- [ ] **Test first.** A failing test showing a surviving book's membership row is **not**
      pruned when its chapter fetch order differs from startMs order. Watch it fail.
      `src/db/__tests__/seriesOrphanPrune.test.ts` is the existing home for the pure
      decision; the key-construction seam is what needs covering, so extract it far enough to
      be testable without the native SQLite adapter — `seriesMembershipDiff` is the
      precedent named in `seriesOrphanPrune.ts`'s own header.
- [ ] A genuinely removed book's membership row **is** still pruned, and a series left with
      zero members is still reaped. Do not regress the feature the inversion was for.
- [ ] The empty-series reaper releases pinned artwork via `deleteArtworkFile`, matching
      `deleteSeries` / `deleteEmptySeries`.
- [ ] Both prune sites derive `liveKeys` through **one** shared definition, or the divergence
      is documented as deliberate with a reason.
- [ ] jest green (**711/711** at review time — adds tests, loses none).
- [ ] `tsc` 0 errors · eslint 0 errors.

## ⚠ Notes

- `seriesOrphanPrune.ts`'s header forbids branching on provenance in the prune decision —
  `'user'` rows and `'excluded'` tombstones are destroyed like `'detected'` ones. That ruling
  stands (ADR 0001); this ticket changes **which keys count as live**, not the decision.
- The two guards *above* the scan-side prune site (missing root skipped wholesale, empty
  enumeration skips cleanup) are load-bearing and must not be tidied — they are why renaming
  your library folder destroys nothing.
- Never run a formatter over this repo — there is no config file.
