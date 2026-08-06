# 04 — Detection units from the real library

**Blocked by:** [02](02-capture-tags-at-scan.md) (the tag columns must be populated),
[03](03-detect-series-seam.md) (defines the unit shape).

**Status:** ready-for-agent

**Spec:** [§A1](../../series-ux-redesign/spec.md), §G1b.

## What to build

The bridge between the library the user actually has and the detector that was measured on
a JSON file. Assemble a `DetectionUnit` for **every book in the database** and run
[03](03-detect-series-seam.md) over the result, so that for the first time the real library
produces real proposals.

Nothing user-facing ships here. The deliverable is a dev-triggerable path whose output can
be **read and compared against the research listing** — which is what makes the next ticket
safe to wire into a scan.

## Why this is its own ticket

**The scan is incremental.** `scanLibrary` builds an `existingUrls` set from the chapters
table and runs MediaInfo only on files not already present, so a rescan of an unchanged
library produces **zero** metadata results. Detection therefore cannot be "a pass over this
scan's output" — it needs units covering the **whole library**, assembled from the
database. Anyone who assumes otherwise builds a detector that works on first import and
silently does nothing forever after.

## Where each field comes from

| Unit field | Source |
| --- | --- |
| `series`, `part`, `grouping` | the columns [02](02-capture-tags-at-scan.md) populates |
| `album` | the book's title — the scan already stores the album tag there |
| `artist`, `album_artist` | the book's author |
| `composer` | the book's narrator |
| `dir`, `rel`, `file`, `flat` | the book's first file path, relative to its library root |

Two things to get right rather than assume:

- **`rel` is relative to the library root**, not absolute. The folder self-validation rule
  walks ancestor directories, so an absolute path silently changes what clusters.
- **`flat` means "this directory holds more than one book"**, which is a property of the
  directory, not of the book. Derive it from the assembled set, not from a single row.

## Acceptance criteria

- [ ] A pure function builds `DetectionUnit[]` from book records — same shape the
      [03](03-detect-series-seam.md) fixture uses, so the two cannot drift.
- [ ] It covers **every** book in the library, not only recently-scanned ones.
- [ ] Books whose title fell back to a filename rather than a real album tag are handled
      deliberately — decide and **write down** whether they enter the album channel, since
      feeding a folder-derived string into the album rule is a contamination the corpus
      cannot measure.
- [ ] A dev entry point logs the unit count and the resulting proposals with their `why`
      trails, for the real library.
- [ ] Output on the driver's own library is compared against the research listing
      (`SERIES_LISTING.txt`) and the differences are **explained, not hand-waved** — a
      difference here is either a porting bug or a real library change since the probe.
- [ ] Assembly is measured on the real library and does not add a visible pause. It is a
      DB read plus string work over ~350 books, so a slow result means something is
      querying per-book.
- [ ] `tsc` 0 errors · eslint 0 errors · jest green.

## Note

Expect proposals for **~19 series at conservative fidelity, ~28 at full**, on a 350-title
library. If the number is wildly different, the unit assembly is wrong — not the cascade.
