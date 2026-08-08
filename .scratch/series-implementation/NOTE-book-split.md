# Note — one book scanned into two book rows

**Found:** 2026-08-07, during the [device check](DEVICE-CHECK.md) Stage 2 run (352 books).
**Status:** not-planned — recorded, deliberately not investigated. Out of scope for the
series-implementation effort; the driver's call was to note it and continue.
**Updated:** 2026-08-08 — a specific, testable **lead** was added below, found while triaging
[19](issues/19-membership-survives-a-file-move.md). Status is unchanged: still not-planned,
still not investigated, and the lead is inferred from reading rather than observed. It comes
with two ways to settle it that cost minutes and touch no code.

## What was observed

`The Dark Tower VI: Song Of Susannah` is one physical book in one directory, but the scan
produced **two `books` rows**:

| row id | chapters | `chapter_number` range | files |
| --- | --- | --- | --- |
| `qRVWegpG2XdxNfuB` | 2 | 1–2 | `… disk 01.mp3`, `… disk 02.mp3` |
| `95UZet84vN4Z4Gk6` | 10 | **3–12** | `… disk 03.mp3` … `… disk 12.mp3` |

Both under
`/storage/emulated/0/Audiobooks/Steven King/The Dark Tower/The Dark Tower VI - Song of Susannah/`,
both titled identically, both authored `Stephen King`.

Alongside it, the `authors` table holds **two rows named `Stephen King`** — ids
`EiO6AJTGNnIvUr0b` and `oynpGpQOwhNTJmqd`, one per book row.

## What is NOT established

**Why the split happens.** The obvious theory — that the duplicate author rows caused it —
does **not** survive checking: `groupChaptersIntoBooks` keys on
`` `${chapter.author}::${chapter.bookTitle}` ``, i.e. on the author **name string**, and both
names are byte-identical (`len=12`, identical char codes). That key would have merged the two
groups, not split them. So the duplicate `authors` rows are a **co-symptom**, not a
demonstrated cause, and the real trigger is somewhere else — the per-directory batching in
`processDirectoryFiles`, or a title/author value that differed at scan time and was later
normalised, are both unexamined guesses.

Anyone picking this up should start by establishing the cause, not by adopting the author
theory above — it was raised and refuted here.

## A lead — added 2026-08-08, INFERRED BY READING, NEVER OBSERVED

Found while triaging [19](issues/19-membership-survives-a-file-move.md), which needed to know
what happens when a file appears in a directory the app has already scanned. It sharpens one of
the two "unexamined guesses" above — *the per-directory batching in `processDirectoryFiles`* —
into something specific and cheap to test. **It is a lead, not a finding. Nobody has run it.**

**The claim: two files of one book that arrive in two DIFFERENT scans can never end up in the
same `books` row, by construction.** The chain, in `scanLibrary.ts` and `usePopulateDatabase.tsx`:

1. `processDirectoryFiles` filters the directory's files against `existingUrls` — a set built
   from every chapter row whose url matches an enumerated file — and MediaInfo's **only the
   remainder**. Files already in the DB never reach grouping.
2. So `groupChaptersIntoBooks` only ever sees files that are **new in this scan**, and the group
   it builds carries `bookId = chapter.url` of its first chapter — a brand-new path by
   construction.
3. `populateSingleBook` adopts an existing book only when that book already owns a chapter whose
   url equals the incoming `bookData.bookId`. That path is new, so no existing book can hold it.

**The consequence, if the chain holds:** on an incremental scan `bookRecord` is *always*
undefined, every processed book is **created fresh**, and its `else` branch — "update existing
book", together with the `bookAlreadyExisted` tag-blob refresh — is **unreachable on that path**.
Files arriving later in a directory the app already knows therefore become a **second book row**
with the same author and title in the same directory. Which is what the Dark Tower row looks like.

**Two details that fit rather than contradict:**

- **The `chapter_number` ranges.** `1–2` and `3–12` are not two independent runs starting at 1,
  which is what a per-group `index + 1` would produce. Chapter numbers come off the **track tag**
  (`chapterInfo.number`), so a second batch keeps its real disc numbers. Consistent with two
  batches of one book, and hard to explain as a single batch that split.
- **This does not need anything to have been renamed or moved.** Adding disks 03–12 to a folder
  the app had already scanned with disks 01–02 in it is enough.

**What this lead does NOT explain — do not let it grow.** The **duplicate `authors` rows**. The
author is looked up by name and reused inside the same `database.write` that creates the book,
and WatermelonDB serialises writers, so a read-then-create race between two concurrent
`populateSingleBook` calls is **not** available as an explanation — that was considered here and
refuted. A second scan should have found `Stephen King` and reused it. **The duplicate authors
remain unexplained, exactly as this note already says**, and a theory that covers the split is
not thereby a theory that covers them. Over-claiming is what sank the previous theory.

**Two cheap ways to settle it, before touching any code:**

1. **Read the two rows' `updated_at`.** On create, `books.updated_at` is set to *scan time*
   (`created_at` is the file's ctime, so it is not the field to read). If the update branch is
   genuinely unreachable, nothing ever rewrites it — so **materially different `updated_at`
   values on the two fragments means they were created by two different scans**, which is the
   lead confirmed. Near-identical values kill it. The DB-pull recipe is in
   [`DEVICE-CHECK.md`](DEVICE-CHECK.md) — pull `-wal` and `-shm` too, per its traps section.
2. **Reproduce it directly.** On an emulator: scan a folder holding part of a book, then add the
   remaining files to that same folder and scan again. A second `books` row is the lead
   confirmed; one row with all the chapters kills it.

## Scope of the duplication

Three titles have more than one `books` row on this library. **Only this one is a defect:**

| title | verdict |
| --- | --- |
| `The Dark Tower VI: Song Of Susannah` | **defect** — one directory, split |
| `Ender08 - Short Stories` | legitimate — two different directories (`Ender short stories`, `IGMS Anthology`) |
| `The Carpet People` | legitimate — two editions in different directories (`…/The Carpet People`, `…/The Carpet People (2021)/…`) |

## Why it surfaced in the device check, and why nothing was changed for it

`loadLibraryDetectionUnits` narrows the ~40k-row chapters table with `chapter_number = 1` to
avoid a per-book query. The 10-chapter row starts at 3, so it matches nothing and is dropped —
which is why the probe reported **351 units from 352 books · 1 with no chapters**.

That is the whole effect, and it is **bounded, counted and not silent**: the row lands in
`keyless`, which the probe prints. Detection's output was unaffected — the *other* fragment
carries `chapter_number = 1`, so `The Dark Tower` still detected at 8 books, matching the
research listing exactly.

Widening the query to a per-book `min(chapter_number)` was considered and **rejected**: it is a
large change to the detection read made to accommodate a scan bug rather than fix it, and it
would mask the symptom that makes this visible at all. Two comments were corrected instead —
`firstFilePathByBookId`'s claim that "a book without [`chapter_number = 1`] has no chapters at
all" was measured **false**, and `keyless`' one-line description said "no chapters at all".

## If it is picked up later

The user-visible symptom is a duplicate book in the library, not a detection problem. A fix
belongs in `scanLibrary.ts` / `usePopulateDatabase.tsx`, and would want the duplicate
`authors` rows explained at the same time — see
[[orphaned-artwork-files-never-cleaned]]-style cleanup for the leftover row, and note that
this DB has **no unique constraints** (WatermelonDB emits a plain index for `isIndexed`), so
de-duplication has to happen in JS on write.
