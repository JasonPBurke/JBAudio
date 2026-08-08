# Series membership is keyed by file path, so a file move ends it

**Status:** accepted (driver, 2026-08-08)

A book's membership of a series is stored in `series_books.book_key`, which holds the book's
**first audio file's absolute path** (`bookStructuralKey`) — deliberately not `book_id`, because
`book.id` churns on tag-edit-and-rescan while the path does not. The consequence is that moving or
renaming a book's files changes its identity: the old membership row is destroyed permanently, and
a series left with no members is deleted outright. **We accept that loss for every kind of
membership — detected, hand-made, and excluded alike** — rather than keep dead rows alive or re-key
books on move. Detected series self-heal on the next scan; a hand-made series is rebuilt by hand.

This is the ruling raised and recorded by ticket
[19](../../.scratch/series-implementation/issues/19-membership-survives-a-file-move.md). It changed
no behaviour: it exists so the next reader does not have to re-derive that provenance was
considered and rejected, and does not "fix" a prune that is working as intended.

## What `book_key` is

`series_books.book_key` = `book.chapters[0].url`, an absolute path, resolved back to a live `Book`
in JS at read time (`src/helpers/seriesAssembly.ts`). There is no foreign key and no database
constraint tying it to `books`. A key that resolves to nothing is skipped gracefully at render
time, so a dangling row is invisible rather than broken.

Three things follow, and all three are intended:

1. **A file move ends a book's series membership.** The scan deletes the book at the old path and
   creates a new one at the new path; the membership row keyed to the old path no longer resolves
   and is destroyed.
2. **A hand-made series does not outlive its last member.** The empty-series reaper runs
   immediately after the prune, so a series whose books all moved ceases to exist — name, ordering
   and membership together.
3. **A detected series the user edited regenerates fresh.** Rename it, remove a book that does not
   belong, pin a couple of numbers, then move the folder: it comes back with the auto name, no
   pinned numbers, and the removed book back in. The `membership = 'excluded'` tombstone that kept
   that book out is destroyed with everything else.

Point 3 is reachable **only via a file move**, never via a scan of an unchanged library — which is
the case spec item A11 (`.scratch/series-ux-redesign/spec.md`) was written for. A11 is not
weakened; this is its boundary.

## What actually happens, case by case

Checkable against `removeMissingFiles` (`src/helpers/scanLibrary.ts`),
`pruneOrphanedSeriesBooks` / `deleteEmptySeries` (`src/db/seriesQueries.ts`) and
`removeLibraryFolder` (`src/db/settingsQueries.ts`).

| the user does | what happens | verdict |
| --- | --- | --- |
| reorders books inside the app | **safe** — that is `position` / `canonical_number`; no files involved | unchanged |
| moves or renames **one book's folder** | the book is destroyed and re-created under a new key; its membership row goes; if it was the last member the series goes too | expected |
| renames a **single-file** book (`.m4b`) | identical — the only chapter's path changed, so the book orphans | expected |
| **reorganises inside** a live library root | every book touched is destroyed and re-created; membership rows go with them; series left with no members cease to exist | expected |
| moves the library's **contents** elsewhere, leaving the configured root folder in place | the root still exists, so every chapter under it is probed, found gone, and removed. **Every book, every membership row and every series is destroyed** — a hand-made series is not emptied, it stops existing | expected |
| renames or deletes the **configured root folder itself** | **nothing is destroyed** — guard 1 below. Books linger pointing at dead paths and cannot play, but every series survives intact | not a loss; a different defect if it bothers anyone |
| renames **only the first file** of a multi-file book | the book survives, so nothing orphans and **the prune never runs**. The row is not destroyed — it dangles, and the book quietly stops appearing in the series via `assembleDerivedSeries`' graceful skip. It is destroyed later, by the first unrelated scan that orphans any book | **not coded around** — odd user behaviour, judged not worth a code path |
| **adds** a file that sorts earlier (an intro or prologue) | **does not change the key.** `processDirectoryFiles` skips files already known and `populateSingleBook` only adopts a book when one of its chapters already holds the incoming first-file path, so a brand-new path never adopts. It creates a **second book row**; the original keeps its key and its membership | **not this decision's** → [`NOTE-book-split.md`](../../.scratch/series-implementation/NOTE-book-split.md), which this is also a candidate mechanism for |

## The two guards — and the asymmetry they create

Both already exist in `removeMissingFiles`. Both are load-bearing and neither may be tidied up:
they are the reason this decision is narrower than *"a scan can delete your series"*.

1. **A configured root that is not on disk is skipped wholesale.** Each configured root is probed
   first; any chapter under a *missing* root is `continue`d past without removal.
2. **An empty enumeration skips cleanup entirely.** If MediaStore returns zero files while
   libraries are configured, cleanup is skipped with a warning rather than wiping the chapters
   table.

A third, narrower one: for a chapter under an *available* root, removal still needs a direct
`RNFS.exists` probe confirming the file is genuinely gone, so MediaStore under-reporting destroys
nothing either. Together: **only a genuinely-absent file under a genuinely-present root** reaches
the prune.

**The least guessable consequence, stated plainly: renaming the library folder and moving its
contents out of it have opposite outcomes.** Rename `/Audiobooks` → `/Audiobooks-old` and guard 1
fires, so every series survives untouched. Leave `/Audiobooks` in place and move the books out of
it and nothing is guarded, so every series is destroyed. The first looks more destructive to a user
and is not.

## Considered and rejected — do not re-raise

**A — a provenance-aware prune** (keep `'user'` and `'excluded'` rows, prune only `'detected'`).
Rejected. It does not deliver what it appears to: the moved book still does not display, because
`assembleDerivedSeries` skips unresolved keys either way, so for a single moved book A and the
current behaviour are **identical to the user**. What A actually changes is that the *series row*
outlives its books — and its costs are real: empty series rendered in the browse list (nothing
filters `books.length === 0`), and `assertSeriesNameAvailable` querying the database directly, so a
ghost series blocks its own name and re-creating it by hand fails with *"name already used"*
against something that displays nothing.

A also has a trap worth recording on its own: **nothing writes `membership` today.** `createSeries`
and `updateSeries` never set it and there is no other production writer, so every row resolves to
`'user'` via `resolveMembership(null)`. A, implemented now, would prune **zero rows** — silently
disabling the orphan prune entirely. The abstention bias in `seriesProvenance.ts` that makes A
*safe* is the same property that makes it *inert*.

**B — re-key membership rows when a book moves.** Rejected by the ruling above: re-keying exists to
make a moved book keep its series, and a moved book is not supposed to keep its series.

**An in-app warning before a scan empties a hand-made series.** Declined — the loss is expected, and
warning about it would contradict that.

## Where the rule lives

One pure function, `selectOrphanedMemberships` in `src/db/seriesOrphanPrune.ts`, with
`selectEmptySeriesIds` beside it. It takes membership rows plus the set of live structural keys and
returns the rows to destroy. It must not import the database and **must not branch on provenance** —
if it ever calls `resolveMembership` to decide what to destroy, someone has implemented rejected
option A. `src/db/__tests__/seriesOrphanPrune.test.ts` pins that, asserting that a `'user'` row and
an `'excluded'` row with dead keys are both destroyed.

**There are two call sites, and neither owns the rule:**

- `pruneOrphanedSeriesBooks` (`src/db/seriesQueries.ts`), called at the end of a scan. Gated on at
  least one book having been orphaned — which is why the dangling-row case in the table above can
  persist across scans.
- the inlined prune inside `removeLibraryFolder` (`src/db/settingsQueries.ts`), the **Remove**
  button on each folder in `Manage Library`. It inlines the batching, not the decision, because it
  runs inside an open `database.write` and calling the seriesQueries helpers would nest a writer.

Two copies of this rule is how the two sites drifted apart in the first place — a grep for
`pruneOrphanedSeriesBooks` used to find only one of them.

**One behavioural detail changed when the sites were unified**, and it is the only one: the folder
Remove path now also destroys membership rows that were *already* dangling for unrelated reasons,
where before it destroyed only rows belonging to books in the removed folder. That is the same
outcome the next scan would have reached anyway, and it follows the rule above rather than
contradicting it.
