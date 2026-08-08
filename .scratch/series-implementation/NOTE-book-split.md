# Note — one book scanned into two book rows

**Found:** 2026-08-07, during the [device check](DEVICE-CHECK.md) Stage 2 run (352 books).
**Status:** not-planned — recorded, deliberately not investigated. Out of scope for the
series-implementation effort; the driver's call was to note it and continue.

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
