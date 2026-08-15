# 29 — `rawTagsJson` is stringified once per FILE and kept once per BOOK

**Status:** resolved — 2026-08-15, jest 778/778 (62 suites, +1 suite / +11 tests, none lost),
tsc 0, eslint 0 errors / 37 warnings (unchanged baseline). `JSON.stringify` now runs once per
book. **Not device-verified**: no visual surface, and the ticket's own note says to expect no
visible speedup. ⚠ **The ticket's cost model needed correcting — see the resolution at the
bottom.** Originally: **perf, not correctness** — nothing is wrong on screen or on disk

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

- [x] `JSON.stringify` runs once per BOOK, not once per FILE. Assert it — a spy/counter over a
      multi-file-book fixture is the honest test, since the saving is invisible in output.
- [x] **The closure captures no cover bytes.** This is the criterion that matters most; a test that
      the retained value is independent of `Cover_Data` size.
- [x] `book_tags.raw_json` is byte-identical to today for the same input, first-file-wins intact.
- [x] jest green · `tsc` 0 errors · eslint 0 errors.

## ⚠ Notes

- **Expect no visible speedup.** `RNFS.readDir` is the dominant scan phase (see the perf record);
  this is a memory-retention fix, not a latency one. Do not sell it as the latter.
- Never run a formatter over this repo — there is no config file.

## Resolution — 2026-08-15

`CapturedTags.rawJson` is a thunk over a pre-pruned shallow copy. `serializeTrack` split into
`pruneTrack` (eager, drops `Cover_Data`) and a closure that stringifies the copy. All six touch
points threaded; `extra` deliberately **not** pruned, per this ticket.

### ⚠ THE COST MODEL IN THIS TICKET IS WRONG AND THE CORRECTION MATTERS

*"~7.6 MB of transient string allocation to keep ~700 KB"* is right about the **transient** half
and wrong about the **retained** half, so **this is an allocation-churn fix, not a retention
fix** — the opposite of what `## Notes` says ("this is a memory-retention fix, not a latency
one").

Traced: before, a `ScannedChapter` held a freshly allocated ~2 KB string and the General track
was then collectable (`raw: res` is commented out at `mediainfo.ts:214`, so nothing else pins
it). After, it holds a shallow copy that pins the track's existing top-level strings **and the
`extra` bag by reference**. Comparable bytes either way. What actually goes away is ~3,530
`JSON.stringify` calls and ~6.9 MB of garbage per full scan; what survives grouping is the same
~700 KB of book blobs it always was. **Do not sell the retention half.** The win is real and
worth having — it is just GC pressure, not footprint.

The cover exclusion is where the footprint claim IS true, and that is the half worth guarding:
a thunk over the live track would have pinned `Cover_Data` per file.

### ⚠ IT EXTRACTED `groupChaptersIntoBooks`, WHICH THIS TICKET DID NOT ASK FOR

New zero-runtime-import module `src/helpers/scannedBookGrouping.ts` holds `ScannedChapter` +
`groupChaptersIntoBooks`, moved verbatim out of `scanLibrary.ts` apart from the one added `()`.

**Criterion 1 is unreachable without it.** `scanLibrary.ts` cannot be imported from jest (RNFS
throws `SyntaxError: Cannot use import statement outside a module` — the same wall that created
`generalTags.ts` in ticket 02), so "a spy/counter over a multi-file-book fixture" had no home.
The only alternative was a hand-built simulation of the grouping loop, which is the
vacuously-green fixture this effort has been bitten by twice. The review's spec axis reproduced
the import failure independently before agreeing.

`ScannedChapter` is **not** re-exported from `scanLibrary.ts`: nothing outside ever imported it
from there, even when it was declared there.

### ⚠ MOVING 152 LINES OUT OF `scanLibrary.ts` INVALIDATED EVERY LINE CITATION BELOW IT

This repo cites `scanLibrary.ts:<line>` as evidence in ~30 places and nothing checks them. Two
were **live source comments** and are corrected: `readsInsideTheWriter.test.ts` (`:1014` →
`:870`, the `orphanedBooks.length > 0` gate) and `schemaMigrationV31.behavior.test.ts` (`:752` →
`:649`, the scan-extracted cover write). ⚠ **Both were already stale before this change** — the
true lines were 1022 and 801 — so the drift predates the move and will recur.

The ~28 in `.scratch/` and `docs/` are frozen ticket history and were left alone. The one that
matters is **ticket 22's `scanLibrary.ts:192`, the chapter sort**: it is load-bearing for
`bookStructuralKey` → `series_books.book_key` under ADR 0001, and it now lives in
`scannedBookGrouping.ts`. Its new module header says so.

### The tests, and proof they bite

`generalTags.test.ts` (+7) and `scannedBookGrouping.test.ts` (new, 5). Retention is not directly
observable, so criterion 2 is proved in two halves: the closure holds a **copy** (mutating the
source afterwards changes nothing) and producing that copy **never reads the cover value** (an
`Object.defineProperty` getter counter stays at 0 through capture *and* stringify). A copy that
never touched the bytes cannot be holding them.

Three mutations were run to confirm the guards are not decorative:

| Mutation | Caught by |
|---|---|
| thunk closes over the live `track` | `the blob is taken from a copy, not from the live track` |
| `{...track}` then `delete` — reads the cover | `the cover bytes are never read` |
| consumer drops the `()` | 4 grouping tests |

⚠ **`tsc` is SILENT on the third.** `Book.metadata` is `{ [key: string]: any }`, so a forgotten
`()` type-checks, and WatermelonDB's `@text` setter then coerces the function to null — 
`book_tags.raw_json` would empty silently, with no type error and nothing on screen. **The test
pinning the stored value's TYPE is the only defence that exists.** Verified by running the
mutation and watching `tsc --noEmit` report nothing.

### Smaller

- The thunk is **deliberately not memoised** — caching would retain the string *and* the copy,
  both halves of the cost. Stated in `DeferredTagBlob`'s doc so nobody "optimises" it back.
- The contract is declared once as `DeferredTagBlob` in `generalTags.ts` and named (not
  restated) at the other two sites. Three prose copies is how ticket 27's arguments drifted
  before its commit even landed.
- Byte-identity is pinned by a test on key ORDER across the dropped cover key
  (`{"Format":"MPEG-4","Album":"Artemis"}`), since `raw_json` is stored bytes.
