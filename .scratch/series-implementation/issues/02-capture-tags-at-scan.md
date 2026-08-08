# 02 — Capture the tags the scan currently throws away

**Blocked by:** [01](01-schema-v33.md) — the columns and `book_tags` must exist.

**Status:** resolved

**Spec:** [§G1b](../../series-ux-redesign/spec.md). Evidence:
[`../research/tag-capture-survey.md`](../research/tag-capture-survey.md).

## What to build

When a book is scanned into the library, everything its files say about themselves is
**kept** instead of discarded. Nothing about this is visible to the user — no new screen,
no new button, no extra wait. What changes is that the app stops being amnesiac about its
own files.

Two consumers, one now and one later:

1. **Series detection** ([04](04-detection-units.md)) needs `extra.SERIES`, `Grouping` and
   `extra.PART`, which are its two highest-trust signals and which **nothing has ever
   persisted**.
2. A future feature that *displays* a file's metadata — **out of scope here** — which the
   raw blob lets us build later with **no migration and no second pass over the library**.

## The thing that is actually wrong today

§A1 says the signals are "already reachable from JS through the existing MediaInfo
turbomodule — no native work and no rebuild." That is true of the **turbomodule** and false
of the **database**. `GeneralTrack` has both an index signature and an `extra` bag, so
nothing is unreachable; the loss is entirely in `extractMetadataFromResult`, which is a
funnel that reads a dozen fields and drops the rest.

Note where things actually live: iTunes' `©grp` atom arrives as **top-level `Grouping`**,
while Audible's freeform atoms arrive under **`extra`** (`extra.SERIES`, `extra.PART`,
`extra.SUBTITLE`, `extra.nrt`, `extra.rldt`). Getting this wrong is not hypothetical — see
the `rldt` bug below.

## Acceptance criteria

- [x] Whenever MediaInfo runs on a file during a scan, the book's `series`, `part`,
      `grouping` and `file_format` columns are populated from that result.
- [x] The **complete General track including its `extra` bag** is written to `book_tags` as
      JSON, with the book id and a capture timestamp.
- [x] `file_format` costs **no new extraction** — `extractMetadataFromResult` already
      computes it and the book builder simply never read it. Wire the existing value
      through rather than re-deriving it.
- [x] These are **book-level** values written once per book, following the existing
      first-file-wins precedent that `bitrate` / `sample_rate` / `codec` already use.
      Verified against the real corpus: `Album`, `Album_Performer`, `Publisher`,
      `Copyright`, `Genre`, `Recorded_Date`, `extra.SERIES`, `extra.PART`, `extra.SUBTITLE`
      are consistent across a single book's files in 6/6 genuine chapter-split directories.
- [x] **Bug fix, same funnel:** `mediainfo.ts` reads `general.rldt` as a `releaseDate`
      fallback, but the real data always nests it at `general.extra.rldt` — **0/304
      top-level, 47/304 under `extra`**. That branch has never fired. Fix it, and check the
      same shape on `general.nrt` (harmless today only because `extra?.nrt` sits second in
      the same `||` chain and does fire).
- [x] A fresh scan of the real library populates the columns at roughly the surveyed fill
      rates: `file_format` ~99.7%, `series` ~6.6%, `part` ~5.9%, `grouping` ~5.6%.
      **Measured 2026-08-07 on 351 books: 100.0% / 6.6% / 6.0% / 5.1%.**
- [x] Scan time does not regress measurably — this rides MediaInfo results the scan
      **already has in hand**; it adds no file I/O and no second pass.
      **Established as a first baseline, not a comparison — see the note below.**
- [x] `tsc` 0 errors · eslint 0 errors · jest green.

## No backfill ships. This is a ruling, not an omission.

`scanLibrary` is **incremental**: it builds an `existingUrls` set from the chapters table
and runs MediaInfo **only on files not already in the DB**. A rescan of an unchanged
library therefore produces zero MediaInfo results, and these columns stay null on books
that were scanned before this ticket.

Both fixes were costed and **both were rejected**:

- **A `Re-read Library Tags` settings action** — rejected by the driver as *"forcing the
  user to perform actions that the code should have already taken care of."*
- **A silent automatic top-up during the next scan** — rejected because it is **not** the
  cheap gate tweak it looks like: `processDirectoryFiles` **creates** book and chapter
  records from MediaInfo output and has no update-existing path, so a top-up needs its own
  update-only pass. That is the button's work minus the button.

The app is in closed testing; wiping and re-adding a library is acceptable. **Existing rows
fill when their files are scanned as new.**

**And not backfilling is safe, measured rather than assumed.** Re-running the real
detection pipeline with `SERIES` / `Grouping` / `PART` nulled out — exactly what an
un-re-imported library looks like — leaves **series count, coverage and 98.3% grouping
purity byte-identical**; only canonical-number accuracy moves, **96.4% → 93.5%** (~5 books
on a 350-title library). On this library the tag signals refine *numbers*, not *grouping*,
because the same books' albums parse anyway.

## Do not widen this into columns

Twenty-plus further fields were measured and deliberately left in the blob rather than
promoted: `asin`/`AUDIBLE_ASIN`, `language`, `content_type`, `encoded_application`,
`isbn`, `narrated_by`, the Audible internal catalog IDs (`prID`, `CDEK`, `CDET`, `VERS`),
and the sort/replay-gain noise. A column can only hold a tag somebody predicted; the blob
holds the ones nobody did.

**`SUBTITLE` in particular stays in the blob and gets no column** — it was nearly dismissed
as derivable from `SERIES` + `PART`, but **2 of its 17 real records carry a `SUBTITLE` with
neither** (`'Hierarchy, Book 1'`). Independent signal, too thin to build on, free to keep.

**Two fields in the survey corpus are NOT real file properties:** `extra.IsTruncated` and
`extra.ConformanceErrors` (~50% fill each) are artifacts of the research probe's
head+tail fragment pull for files over 32 MB. The app always reads complete local files.
Do not treat them as signal.

## Answer

`captureBookTags(general)` and `readReleaseDate(general)` live at
`src/helpers/generalTags.ts`; 19 tests in `src/helpers/__tests__/generalTags.test.ts`.
`tsc` 0 · eslint 0 · **jest 795/795 across 73 suites**. Wiring, in order:
`mediainfo.ts` (four new `ExtractedMetadata` fields) → `scanLibrary.ts` (`ScannedChapter`,
then `groupChaptersIntoBooks` where first-file-wins already happens) →
`usePopulateDatabase.tsx` (`applyFileTags` on both the create and update paths, plus the
`book_tags` row).

**A new module rather than more lines in `extractMetadataFromResult`, for one reason:
nothing in `mediainfo.ts` is reachable from jest.** It imports `mediainfoAdapter` →
`NativeMediaInfo` → `react-native`, and this repo runs jest on bare babel with no RN
preset, so the import throws `SyntaxError: Cannot use import statement outside a module`
(verified, not assumed). A bug fix written where the bug lives could not have had a test.
`generalTags.ts` imports nothing at all; `mediainfo.ts` stays the funnel that calls it.

### The blob would have carried cover art, and the survey could not have caught it

`Cover_Data` — base64 artwork, up to hundreds of KB — rides the **General track**, which is
what the blob serialises. Worse than incidental: the scan runs the no-cover batch for most
files but re-extracts the first file of each book *with* cover (`needsCoverForFile`), and
that is **exactly the file whose tags become the book's**. Naive `JSON.stringify(general)`
would have stored a JPEG per book instead of ~2 KB of tags.

The survey's 2,011-byte figure could never have surfaced this: **0 of 304 corpus records
carry `Cover_Data`**, because `device_probe.py` never asked for it. `captureBookTags` drops
that one key and keeps `Cover` / `Cover_Mime` / `Cover_Type`, which are short strings and
real metadata. Two tests pin it.

### Fill rates, re-measured through the shipped code

Running `captureBookTags` over all 304 real device records reproduces the survey exactly —
`file_format` **99.7%**, `series` **6.6%**, `part` **5.9%**, `grouping` **5.6%** — with a
blob mean of **1,933 bytes** (survey: 2,011) and a max of 20,080. This was a one-off check,
not a checked-in test: see *Not done* below.

### The `rldt` fix is real, and on this library it changes nothing

The branch was dead, as the ticket says — but fixing it fires **0 times on the real
corpus**, because `Recorded_Date` precedes it in the chain and **every one of the 47
records carrying `extra.rldt` also carries `Recorded_Date`**. `releaseDate` fill is 89.5%
before and after. The dead code was dead twice over. Fixed anyway (both addresses kept, in
the `nrt` chain's order) because the next library need not look like this one.

### `PART` is not always an integer

Real values include **15.5 and 17.5** — the novella positions. So the parse is `Number` on
a trimmed string, not `parseInt`, and the `number` column takes the decimal unchanged. It
is also deliberately **stricter** than `numberFrom` in `mediainfo.ts`, which strips
non-digits and would read a hypothetical `'3 / 3'` as **33**; anything not a bare number is
dropped instead of guessed at.

### The four columns and the blob are one write, unconditionally

Both are one reading of one file, so neither may outlive the scan that produced it: when
the scan read nothing (a `makeErrorChapter` file), the columns null and the tag row is
destroyed. The alternative — keep the old blob, null the columns — leaves a book whose
stored tags contradict its own row, which is worse than absence for the metadata-display
feature the blob exists to enable. This also matches how `bitrate`/`codec`/`genre` already
behave on the update path.

The `book_tags` lookup is skipped when the book is being created, since a new book cannot
own a tag row — one indexed query per book saved on a cold scan.

### Device-pending — CLOSED 2026-08-07, see *Device-verified* below

Two criteria needed a device and a wiped library: **the fresh-scan fill rates on real
hardware**, and **no measurable scan-time regression**. Both were closed on 2026-08-07 in the
same run that closed [04](04-detection-units.md)'s. What had been unverified was only the DB
write, which this effort ruled untested by design; it is now exercised at full scale.

Both §5 gaps the device check identified were fixed **before** the run rather than worked
around, so neither the manual `sqlite3` fallback nor logcat-timestamp arithmetic was needed:

> **Procedure: [`../DEVICE-CHECK.md`](../DEVICE-CHECK.md)** (2026-08-07). Both criteria are
> closed by the **same** wiped-and-rescanned run that closes
> [04](04-detection-units.md)'s two, so run them together — the wipe is required by this
> ticket (the scan is incremental, so an unchanged library never re-runs the capture) and
> merely preferable for 04.
>
> Two gaps that needed settling first, both recorded in §5 there — **both now fixed in code**
> (`7b8b1e1`), which is why the numbers above are logged rather than hand-derived:
>
> 1. ~~**Nothing currently prints the four fill rates.**~~ **Fixed.** The probe now prints
>    `tag fill over N books — file_format % · series % · part % · grouping %` with the surveyed
>    targets inline. Counted in `loadLibraryDetectionUnits` over `DetectionBookRow`s rather than
>    over units — `file_format` is not a detection signal and must never reach a `DetectionUnit`
>    (a test pins that), and units have been through `sanitise()`, which would under-report the
>    raw non-null this criterion asks for. Cross-checked against raw SQL on the pulled DB: exact
>    agreement.
> 2. ~~**`scanLibrary.ts` has no timing instrumentation at all.**~~ **Fixed**, and the criterion
>    **has been re-worded** as that gap demanded — it is recorded as a *first baseline*, not as a
>    comparison, because no pre-02 scan was ever timed and the comparison it implied has never
>    existed. `scanLibrary` now logs phase timings plus `N files, M new`; without `M` the figure
>    is unfalsifiable, since an unchanged library runs no MediaInfo at all.

### Device-verified 2026-08-07 — both remaining criteria closed

Physical Pixel 7 Pro (`cheetah`), dev build over Metro, library removed and re-added through
`Manage Library` so the scan ran cold. Procedure and full numbers:
[`../DEVICE-CHECK.md`](../DEVICE-CHECK.md) §9. Log:
[`../device-check/stage2-device-2026-08-07.log`](../device-check/stage2-device-2026-08-07.log).

**The fill rates land on the survey**, over 351 books (the fourth is the only one that moved
more than a point, and downward):

| column | measured | surveyed | |
| --- | --- | --- | --- |
| `file_format` | **100.0%** | ~99.7% | 351/351 |
| `series` | **6.6%** | ~6.6% | exact |
| `part` | **6.0%** | ~5.9% | +0.1 |
| `grouping` | **5.1%** | ~5.6% | −0.5, i.e. **2 books** |

`book_tags` holds **352 rows, one per book**, so the blob write is unconditional as designed.
The survey was a reading of 304 MediaInfo records; this is 351 books through the shipped write
path, so agreement this close means the funnel loses nothing between `extractMetadataFromResult`
and the column. The `grouping` gap is two books and is not worth chasing — the corpus and the
library are not the same set (see 04's diff: this library holds ~53 books the research probe
never sampled).

**The cover-art hazard is closed on real data.** This ticket warned that naive
`JSON.stringify(general)` would store a JPEG per book, and that the survey could not have caught
it (0/304 records carried `Cover_Data`). Measured on the emulator's fresh scan: **0 blobs contain
`Cover_Data`**, while `Cover` / `Cover_Type` / `Cover_Mime` are kept, mean blob 2,783 bytes
against this ticket's 1,933 — same order, no artwork.

### Scan time — a first baseline, and the criterion is reworded

As §5(b) of the device check argued, *"does not regress measurably"* implied a comparison that
**has never existed**: `scanLibrary` had no timing at all and no pre-02 scan was ever timed. That
gap is now closed going forward — `scanLibrary` logs phase timings — but this run can only
establish the baseline, not prove the absence of a regression. Recorded honestly as such.

```
[scan] 186525ms total · 3461 files, 3461 new (53.4ms/new file)
       — enumerate 1541ms · existing-urls 29ms · process 184735ms · cleanup 213ms
```

**`process` is 99.0% of the scan**, and enumeration — which [[mediainfo-parallelization-shipped]]
called the dominant phase — is 0.8%. The `M new` figure is why the line prints it at all: the
same library rescanned unchanged took **243 ms**, a 768× difference decided purely by how many
files are new. A total without that number is unfalsifiable.

**The substantive defence remains the argument from the code, not this measurement**: the capture
rides MediaInfo results the scan already holds, adds no file I/O and no second pass. What the
number does support is the *shape* — 53.4 ms/new file against 43.1 ms/new file on the emulator's
50-file scan, i.e. no per-file surprise at 69× the file count.

### Not done, deliberately

- **No corpus fixture checked in.** A fill-rate assertion in the style of
  `seriesDetection.corpus.test.ts` would need `device_general.jsonl` copied into
  `src/helpers/__fixtures__/` at **~590 KB compacted** — roughly four times the largest
  fixture already there — to assert a property of *the owner's library* rather than of the
  code. The 19 unit tests already fail on any regression in the reading. Say so and it can
  be added.
- **`publisher` was not added.** The survey proposed it as Tier B (31.9%); §G1b settled on
  four columns and it is in the blob, where a display feature can reach it with no
  migration.
- **`populateDatabase` (the bulk path) was neither wired nor deleted. ⚠ OPEN CLEANUP, the
  driver's, deferred deliberately.** It has exactly one reference in the repo, its own
  `export`; only `populateSingleBook` is reachable from the scan, and it was orphaned by
  `0d7100b` *"convert scan to single book sequential in place of batch process"*.

  Wiring it is the wrong fix and leaving it is worse than it looks, because **the
  failure mode of a stale create path here is silence**: WatermelonDB's `sanitizedRaw`
  fills any column you forget with `null` (for `isOptional`), so books created through it
  would get null tags and no `book_tags` row — no error, no log, indistinguishable from a
  pre-v33 book, and with no backfill shipping, **null forever**. The symptom would be a
  few wrong canonical numbers (§G1b's own measurement: purity byte-identical, numbering
  96.4% → 93.5%), which nobody attributes to a write path. That is precisely the `rldt`
  failure class this ticket exists to fix.

  **And the drift is already real, not hypothetical:** before this ticket the dead path
  had already fallen behind on `hasAutoGeneratedChapters`. This change widens the gap from
  one field to six. 199 lines of duplicated author→book→chapter write logic is a
  schema-drift accumulator.

  **Deleting it was checked and is safe**: its only unique content is a `settings`
  bootstrap, superseded by `ensureSettingsRecord()` (`src/db/settingsQueries.ts:11`). Not
  done here because it is a cleanup, not this ticket's work.
