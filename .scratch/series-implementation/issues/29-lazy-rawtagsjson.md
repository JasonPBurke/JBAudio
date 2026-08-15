# 29 — `rawTagsJson` is stringified once per FILE and kept once per BOOK

**Status:** ready-for-agent · **perf, not correctness** — nothing is wrong on screen or on disk

**Source:** **Finding 18** of the [code review vs d2195ed](../CODE-REVIEW-d2195ed.md). Efficiency
half hand-traced and confirmed 2026-08-14; the finding's second half was **rejected**, see below.
Deferred out of the frontier pass by the driver as the lowest-value item on it.

## The waste

Full path, traced:

1. `mediainfo.ts:108` calls `captureBookTags(general)` **once per file**, and
   `generalTags.ts:75` eagerly evaluates `rawJson: serializeTrack(track)` — a whole
   `JSON.stringify` of the General track.
2. It rides through `buildBookMetadata` (`scanLibrary.ts:594`) into every `ScannedChapter`.
3. `groupChaptersIntoBooks` (`scanLibrary.ts:163`) copies it **only** inside the
   `if (!bookMap.has(bookKey))` branch. The comment says it plainly: *"Tags off the file. First
   file wins, same as bitrate/codec above."*

On the recorded corpus (**~3,880 files, ~350 books**) that is roughly **3,530 stringify results
computed, retained for the whole directory pass, and discarded**. At the ~2 KB the blob was costed
at, ~7.6 MB of transient string allocation to keep ~700 KB.

⚠ **The defect is a gap between two files**: the "first file wins" rule is stated at the CONSUMER,
while the cost is paid at the PRODUCER, which has no way to know it is about to be discarded.

## ⚠ THE OBVIOUS IMPLEMENTATION IS FAR WORSE THAN THE BUG

A thunk closing over `track` **pins the entire General track, `Cover_Data` base64 included**, for
the whole directory pass — hundreds of KB per file across ~3,880 files, in an app that already
runs `largeHeap` and carries a clipped-chapters OOM fix. That turns a ~7 MB saving into a
nine-figure-byte leak while looking like an optimisation in review.

**Prune eagerly, defer only the stringify.** The shallow copy that drops the cover key is the cheap
half; `JSON.stringify` is the expensive half. The closure must capture the PRE-PRUNED object.

## What to build

`CapturedTags.rawJson` becomes a thunk over a pre-pruned shallow copy, threaded through six
mechanical touch points:

- `generalTags.ts` — `rawJson` type + `serializeTrack` split into prune (eager) and stringify (lazy)
- `mediainfo.ts:18`, `:191`
- `scanLibrary.ts:96`, `:163` (call it — this is the only site that should), `:594`
- `generalTags.test.ts` — existing assertions become calls

## ⚠ Do NOT also prune `extra` — that half of the finding was REJECTED

Finding 18 claimed `serializeTrack` filters only top-level `Cover_Data`, so cover bytes under
`extra` would ride into the blob. The filter IS top-level only — but **no producer puts cover bytes
under `extra`**: this codebase's own extractor reads `general.Cover_Data` at the top level
(`mediainfo.ts:129`, and `mediainfoAdapter.ts:107` agrees), and no fixture shows otherwise.

Adding speculative pruning would be guessing at a shape we have not seen, which this very file
refuses to do elsewhere — see `partNumber`'s comment: *"anything else … is a shape we have not seen
and must not guess at."* Hardening against an unobserved shape adds an untestable branch and a
comment implying the shape exists.

## Acceptance criteria

- [ ] `JSON.stringify` runs once per BOOK, not once per FILE. Assert it — a spy/counter over a
      multi-file-book fixture is the honest test, since the saving is invisible in output.
- [ ] **The closure captures no cover bytes.** This is the criterion that matters most; a test that
      the retained value is independent of `Cover_Data` size.
- [ ] `book_tags.raw_json` is byte-identical to today for the same input, first-file-wins intact.
- [ ] jest green · `tsc` 0 errors · eslint 0 errors.

## ⚠ Notes

- **Expect no visible speedup.** `RNFS.readDir` is the dominant scan phase (see the perf record);
  this is a memory-retention fix, not a latency one. Do not sell it as the latter.
- Never run a formatter over this repo — there is no config file.
