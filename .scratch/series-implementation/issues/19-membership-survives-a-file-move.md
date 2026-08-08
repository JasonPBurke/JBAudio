# 19 — Series membership does not survive a file move

**Blocked by:** [01](01-schema-v33.md) — the provenance columns must exist to reason about.
Nothing else. It can run now.

**Should land before:** [12](12-editor-one-root-route.md)–[16](16-editor-detection-aware-save-and-delete.md),
the editor tickets. The editor's purpose is **hand-building playlists**, and hand-built rows are
exactly the ones nothing regenerates. See *Why the sequencing matters*.

**Status:** needs-triage

**Spec:** none — this is **not** a spec gap. Found on 2026-08-07 while closing
[02](02-capture-tags-at-scan.md)'s and [04](04-detection-units.md)'s device criteria
([`../DEVICE-CHECK.md`](../DEVICE-CHECK.md)), by reading the code rather than by observing a
failure. **No user has reported it and no test covers it.**

## What is wrong

`series_books` identifies a member by **`book_key`** — the absolute path of the book's **first
audio file** (`bookStructuralKey`), not by `book_id` (`src/db/schema.ts`, `series_books`).

At the end of every scan, inside `removeMissingFiles`
(`src/helpers/scanLibrary.ts:994-999`):

```ts
const liveKeys = new Set<string>();
for (const chapter of allChapters) {
  if (!removedChapterIds.has(chapter.id)) liveKeys.add(chapter.url);
}
await pruneOrphanedSeriesBooks(liveKeys);
await deleteEmptySeries();
```

and `pruneOrphanedSeriesBooks` (`src/db/seriesQueries.ts:187`) is:

```ts
const orphans = all.filter((m) => !liveKeys.has(m.bookKey));
… prepareDestroyPermanently()
```

**A membership row whose path no longer exists is destroyed permanently** — not soft-deleted,
no tombstone, no undo — and `deleteEmptySeries` then removes any series left with zero members.

**The prune does not consult provenance.** It treats `membership: 'user'`, `'excluded'` and
`'detected'` identically, and ignores `origin` / `name_source` entirely.

## What actually breaks

| the user does | result |
| --- | --- |
| reorders books **inside the app** | **safe** — that is `position` / `canonical_number`, no files involved |
| moves or renames a folder | old books deleted, files return as *new* books with new keys → **every membership row destroyed**; if the whole series moved, the series row is auto-deleted too |
| renames **only the first file** of a book | the book survives and plays fine, but its `book_key` changed → **silently drops out of its series** |
| **adds** a file that sorts earlier (intro/prologue) | same as above, and worse: nothing was moved or deleted. The key is `chapters[0].url` sorted by `startMs`, so a new first file changes the book's identity |

**The asymmetry is the point.** Detected series *self-heal* — once [06](06-detection-runs-on-scan.md)
ships, the moved books are re-detected and re-grouped on the same scan. **Authored data does
not**: hand-built playlists, user-renamed series names, user-set canonical numbers, and manual
include/exclude overrides are gone with nothing to rebuild them.

One deliberate exception already works the right way round: `suppressed_series` is keyed by
**name**, not path, so *"I deleted this series, don't bring it back"* survives a reorganisation.

## Why this is not [06](06-detection-runs-on-scan.md)'s, and what 06 still needs

The destruction happens in `removeMissingFiles`, which runs **before** detection — 06's own
first criterion places detection *"after the existing orphan prune and empty-series reaper"*.
So by the time any 06 code runs the rows are already gone, and
[05](05-reconcile-series-seam.md)'s `reconcileSeries` cannot help either: it is pure and only
ever sees survivors.

`pruneOrphanedSeriesBooks` / `deleteEmptySeries` also **predate this effort** — they are v32-era
series code already wired into the scan. Nothing in 01–08 caused this.

06 has been amended to stop its *"a hand-made series is untouched by a scan"* criterion from
reading as though it covers this. It does not: test it with files that did not move and it
passes honestly, while the failure sits one step upstream.

## Why the sequencing matters

Detected rows are cheap to lose. **Authored rows are not**, and 12–16 build the surface whose
entire purpose ([15](15-editor-series-artwork.md)'s ruling) is hand-building playlists. Shipping
the editor first means shipping a feature whose output silently evaporates when a tester tidies
their folders — the class of thing that is cheap to decide now and expensive to learn from a
tester in closed testing.

## The decision to make

**One question: does the prune respect provenance, and/or should `book_key` be re-keyed rather
than orphaned?** This ticket deliberately does **not** pre-decide. Options, with what each costs:

**A · Provenance-aware prune.** Prune only `membership: 'detected'` rows; keep user-owned ones.
- *Cheapest by far* — the helper already exists: `membershipOf` (`src/db/seriesProvenance.ts:46`)
  reads `series_books.membership` and **null already coalesces to user-owned**, which is the
  ruling that makes this safe for pre-v33 rows.
- Does **not** fix the rename/added-intro cases: the row survives but still points at a dead
  path, so it is a member of nothing until something re-keys it.
- Needs an answer for how a kept-but-dangling row renders in the UI.

**B · Re-key on move.** When a book survives but its first file changes, update `book_key`
instead of orphaning the row.
- The only option that fixes **all four** rows of the table above, including the added-intro
  case that no prune policy alone can catch.
- Requires identifying "the same book" across a path change — which is the hard part, and is
  entangled with the scan's delete-and-recreate behaviour. Note `book_id` is **not** stable
  across a move today; the book is deleted and re-created.
- Largest change, and touches the scan.

**C · Accept the loss, explicitly.** Keep today's behaviour and write it down as intended.
- Free, and defensible *if* the editor is positioned as convenience over detected data rather
  than as durable authoring.
- Must be a stated decision in the ticket and a comment at `pruneOrphanedSeriesBooks`, not an
  omission. The current state is C-by-accident, which is the one outcome to avoid.

A and B are not exclusive — A alone stops the bleeding, B completes it.

**This is ADR-shaped as much as ticket-shaped**: it changes what `book_key` *means* as an
identity. Per `CLAUDE.md`, that belongs in `docs/adr/`.

## Acceptance criteria

Written so they hold under **any** of A/B/C — they pin that the decision is made and recorded,
not which decision it is.

- [ ] The chosen option is **recorded as an ADR** in `docs/adr/`, naming what `book_key`
      identifies and what is guaranteed to survive a file reorganisation.
- [ ] `pruneOrphanedSeriesBooks` carries a comment stating the ruling and why — including if the
      ruling is C. A reader must not have to re-derive that provenance was considered.
- [ ] The four scenarios in *What actually breaks* each have a **stated, tested expected
      outcome**, including the ones the chosen option does not fix. Losing data may be
      acceptable; losing it undocumented is not.
- [ ] A pure unit test covers the prune's decision. `seriesMembershipDiff.ts` is the precedent —
      the IO stays untested by this effort's testing decisions, so any *conditional* must live
      somewhere pure and testable, not inside the query.
- [ ] If A or B is taken: an existing tester who moves a folder and rescans **does not silently
      lose a hand-made series**, verified on device.
- [ ] `tsc` 0 errors · eslint 0 errors · jest green.

## Not in scope

- **The scan's delete-and-recreate behaviour itself.** That a moved file becomes a new book is
  upstream of this and is not this ticket's to change.
- **The unrelated book-split defect** in [`../NOTE-book-split.md`](../NOTE-book-split.md) —
  different mechanism (a book whose chapters do not start at `chapter_number = 1`), already
  ruled out of scope.
- **Any change to detection.** 03/04/05 are resolved and correct; this is about what happens to
  rows *after* they are written.
