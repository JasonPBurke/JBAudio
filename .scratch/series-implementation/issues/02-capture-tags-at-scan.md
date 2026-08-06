# 02 — Capture the tags the scan currently throws away

**Blocked by:** [01](01-schema-v33.md) — the columns and `book_tags` must exist.

**Status:** ready-for-agent

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

- [ ] Whenever MediaInfo runs on a file during a scan, the book's `series`, `part`,
      `grouping` and `file_format` columns are populated from that result.
- [ ] The **complete General track including its `extra` bag** is written to `book_tags` as
      JSON, with the book id and a capture timestamp.
- [ ] `file_format` costs **no new extraction** — `extractMetadataFromResult` already
      computes it and the book builder simply never read it. Wire the existing value
      through rather than re-deriving it.
- [ ] These are **book-level** values written once per book, following the existing
      first-file-wins precedent that `bitrate` / `sample_rate` / `codec` already use.
      Verified against the real corpus: `Album`, `Album_Performer`, `Publisher`,
      `Copyright`, `Genre`, `Recorded_Date`, `extra.SERIES`, `extra.PART`, `extra.SUBTITLE`
      are consistent across a single book's files in 6/6 genuine chapter-split directories.
- [ ] **Bug fix, same funnel:** `mediainfo.ts` reads `general.rldt` as a `releaseDate`
      fallback, but the real data always nests it at `general.extra.rldt` — **0/304
      top-level, 47/304 under `extra`**. That branch has never fired. Fix it, and check the
      same shape on `general.nrt` (harmless today only because `extra?.nrt` sits second in
      the same `||` chain and does fire).
- [ ] A fresh scan of the real library populates the columns at roughly the surveyed fill
      rates: `file_format` ~99.7%, `series` ~6.6%, `part` ~5.9%, `grouping` ~5.6%.
- [ ] Scan time does not regress measurably — this rides MediaInfo results the scan
      **already has in hand**; it adds no file I/O and no second pass.
- [ ] `tsc` 0 errors · eslint 0 errors · jest green.

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
