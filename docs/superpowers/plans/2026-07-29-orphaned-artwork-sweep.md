# Orphaned Artwork Sweep — Implementation Plan (deferred)

**Status:** NOT STARTED. Written 2026-07-29 while the context was fresh. Pick up on its own branch.

**Goal:** Reclaim cover-art files in `files/artwork/` that no book references any more, so removing
a book stops leaking its cover permanently.

**Why deferred:** it is a file-deletion path operating next to users' irreplaceable cover art, and
the leak is small per book (25–57 KB observed). It deserves its own branch, design attention and
review rather than being bolted onto unrelated work.

---

## The problem

`removeMissingFiles` (`src/helpers/scanLibrary.ts:869`, called at `:1020`) prunes chapters → books
→ authors from the database but **never touches the filesystem**. There are exactly three `unlink`
calls in all of `src/`, none of them a cleanup path:

| call | deletes |
|---|---|
| `replaceBookArtwork.ts:51` | destination path, immediately before moving the new cover in |
| `replaceBookArtwork.ts:65` | temp download file |
| `scanLibrary.ts:748` | temp file during extraction |

**Two orphan sources; only one was a deliberate trade-off:**

1. **Book removal** — undocumented gap. Every removed book leaks one cover, forever.
2. **Manual cover replace** — documented and accepted in the artwork-name-collision work.
   Scan-time filenames hash the first chapter path; manual ones hash the DB record id. Replacing a
   cover therefore orphans the scan-time file (~100 KB, "accepted").

Do **not** cite the collision-fix reasoning ("don't delete the old file, a sibling copy may still
reference it") as justification for (1). That reasoning is about *replace* in already-collided
libraries. Removal leaking files was never a considered decision.

---

## Design: reference-counted sweep, NOT delete-on-removal

Delete-on-removal would need a hook in every path that drops a book, and would still miss the
replace-orphans and any pre-existing leak. A sweep fixes all of it in one place and is idempotent.

**Algorithm**

1. List `${RNFS.DocumentDirectoryPath}/artwork`.
2. Build the referenced set: every non-null `books.artwork`, reduced to a bare filename —
   **strip the `?t=` query first**, then take the basename.
3. Delete files in the directory that are not in the referenced set, minus the exclusions below.

Naturally safe for the legacy shared-name files the collision note worried about: if any surviving
book still references one, it is in the referenced set, so it stays.

### Exclusions — get these wrong and you break things

- **`_default_cover.png` MUST be excluded.** It is materialised by native code
  (`ensureDefaultArtwork` in the RNTP patch, `File(filesDir, "artwork")`) into the **same directory**
  JS uses, and it is referenced by **no** database row. Deleting it silently breaks the notification
  placeholder for every coverless book. Verified on device: the directory holds book `.webp`s and
  `_default_cover.png` together.
- Prefer an **allowlist by extension** (`.webp` only, which is all `saveArtworkToFile` and
  `replaceBookArtwork` produce) over a denylist of known-special names. A future native file added
  to this directory should survive by default rather than need remembering.

### Where to run it

After `removeMissingFiles` in the scan, inside the **same `allFiles.length === 0` guard**
(`scanLibrary.ts:1013`). That guard exists so a failed MediaStore enumeration cannot wipe the DB;
a sweep run against a half-loaded DB is the same class of hazard.

Note the sweep is driven by DB rows, not disk contents, so an intact DB makes it correct
regardless — but respecting the existing guard costs nothing and removes a whole failure mode.

### Deliberately out of scope

- Reclaiming files for books the user *intends* to re-add later. A removed book is removed; if it
  comes back, the scan re-extracts its cover.
- Any UI, progress reporting, or user-facing "reclaim space" affordance.

---

## Tasks

### Task 1 — pure helper + unit tests
Extract the decision, not the IO, so it is testable without a filesystem.

`src/helpers/artworkSweep.ts`:
```ts
/** Filenames safe to delete: on disk, not referenced, not native-owned. */
export function findOrphanedArtwork(
  filesOnDisk: string[],
  referencedArtwork: (string | null)[],
): string[]
```
Tests must cover: a `?t=` cache-buster is stripped before comparison; `_default_cover.png` is never
returned even though nothing references it; non-`.webp` files are never returned; a file referenced
by *any* book is kept even if another book was removed; `null` artwork values are ignored; an empty
`referencedArtwork` returns no deletions **unless** that is genuinely correct (decide explicitly —
an empty library with files on disk is either a real orphan set or a sign the DB failed to load).

That last case is the one to think hardest about, and the reason the guard above matters.

### Task 2 — wire into the scan
Call it after `removeMissingFiles` inside the existing guard. Read `books.artwork` for all books,
`RNFS.readDir` the artwork directory, `RNFS.unlink` each orphan with a `.catch(() => {})` per file
so one failure cannot abort the rest. Log a single summary line (count + bytes reclaimed), not one
line per file.

### Task 3 — device verification
- Note the artwork directory contents and `books.artwork` values before.
- Remove a book from the library, rescan.
- Confirm its `.webp` is gone, every other cover survives, and **`_default_cover.png` is still
  there**.
- Play a coverless book and confirm the notification placeholder still renders — that is the direct
  check that the exclusion held.
- Confirm a book whose cover was replaced via cover search keeps its *current* cover.

Device-testing specifics (package name, DB location, no `sqlite3` on the emulator, WAL handling)
are in the `artwork-placeholder-persisted-in-db` memory note. Native changes are not involved here,
so a JS reload is sufficient — no rebuild needed.
