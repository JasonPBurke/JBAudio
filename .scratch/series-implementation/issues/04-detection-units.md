# 04 — Detection units from the real library

**Blocked by:** [02](02-capture-tags-at-scan.md) (the tag columns must be populated),
[03](03-detect-series-seam.md) (defines the unit shape).

**Status:** ready-for-human — code complete and committed, `tsc`/eslint/jest green. The two
remaining criteria both need **one run on the driver's device, wiped and rescanned**; an
emulator pass is a useful smoke test first but cannot meet either. Procedure:
*Device-pending — the two-stage check*. See [## Answer](#answer).

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

- [x] A pure function builds `DetectionUnit[]` from book records — same shape the
      [03](03-detect-series-seam.md) fixture uses, so the two cannot drift.
- [x] It covers **every** book in the library, not only recently-scanned ones.
- [x] Books whose title fell back to a filename rather than a real album tag are handled
      deliberately — decide and **write down** whether they enter the album channel, since
      feeding a folder-derived string into the album rule is a contamination the corpus
      cannot measure.
- [x] A dev entry point logs the unit count and the resulting proposals with their `why`
      trails, for the real library.
- [ ] Output on the driver's own library is compared against the research listing
      (`SERIES_LISTING.txt`) and the differences are **explained, not hand-waved** — a
      difference here is either a porting bug or a real library change since the probe.
      **OPEN — needs the driver's device, wiped and rescanned.** The offline half is done
      and is stronger than a re-run would have been: see *The round trip*. Procedure and
      how to read the diff: *Device-pending — the two-stage check*, stage 2.
- [ ] Assembly is measured on the real library and does not add a visible pause. It is a
      DB read plus string work over ~350 books, so a slow result means something is
      querying per-book. **OPEN on the same run**; measured off-device (*Cost*), and the
      probe prints the device figure in its header.
- [x] `tsc` 0 errors · eslint 0 errors · jest green.

## Note

Expect proposals for **~19 series at conservative fidelity, ~28 at full**, on a 350-title
library. If the number is wildly different, the unit assembly is wrong — not the cascade.

---

## Answer

`buildDetectionUnits(rows, libraryRoots)` lives at `src/helpers/detectionUnits.ts` — pure,
one **type-only** import, so like `seriesDetection.ts` it cannot reach the DB or a screen.
The database side is `src/db/detectionQueries.ts` (`loadLibraryDetectionUnits`), and the dev
entry point is a `Detect series (log)` chip on the prototype panel
(`src/prototypes/detectionProbe.ts`). 25 tests in
`src/helpers/__tests__/detectionUnits.test.ts`. `tsc` 0 · eslint 0 · jest green
(39 suites / 438 tests in this tree).

### The round trip is the deliverable, not the unit tests

The ticket asks that assembly and the 03 fixture "cannot drift". A shared type does not
buy that — it pins field *names*, and every failure here is a field with the right name and
the wrong *meaning*. So the corpus test runs in the app's own direction: it rebuilds
**database rows** from the 298 checked-in research units (`title` ← `album`, one `author`
column, `firstFilePath` ← `<root>/<rel>/<file>`), feeds them back through
`buildDetectionUnits`, and asserts `detectSeries` still reproduces §A3 **exactly**:

| | conservative | full |
| --- | --- | --- |
| series | **19** | **28** |
| books placed | **179** | **213** |

plus the A4 edition split still landing as **41 + 39**, `rel` and `flat` matching the probe
unit-for-unit, and a `bookKey` surviving the cascade for all 179 placed books. Passed on
the first run, before anything was tuned.

**What this does and does not stand in for.** It exercises the assembly on the driver's
real library data, so a `rel`, `flat`, `album` or `part` regression fails a test rather
than shipping. It cannot cover the DB read that produces those rows — the three-query join
and the first-chapter rule — which is the untested half by this effort's own testing
decisions, and which the probe's structural-key cross-check is there to catch on device.

### The album channel takes folder-derived titles. Measured, not judged.

The scan writes `bookTitle: metadata.album || <parent folder name> || 'Unknown Book'`
(`scanLibrary.ts`), so `books.title` is *sometimes* a folder name and the row does not
record which. The ticket is right that this is a contamination the corpus cannot measure —
but the **cure** can be, and it is an order of magnitude worse than the disease. Nulling
every album equal to its own folder name, on the 298-unit corpus:

| | conservative | full |
| --- | --- | --- |
| shipped (fallback allowed through) | 19 series / 179 placed | 28 / 213 |
| suppress album == folder | **14 / 123** | 28 / 213 |

It takes out the Discworld edition split — A4's one real firing — plus `The First Law`,
`Long Earth`, `Memory, Sorrow & Thorn` and `The Age of Madness`. The reason is that **67 of
298 units carry a genuine album tag that simply equals its folder name**, which is what
tidy libraries look like; only **10** have no album at all. Letting the fallback through
costs exactly **one book** (`Lockwood and Co.` 5 → 4) at either fidelity.

And the leak is bounded by the waterfall: a folder-derived string that misses the album
patterns reaches the folder rule one step later anyway, where it is self-validated (A2).

**What is dropped instead is the scan's three placeholder strings** — `Unknown Book`,
`Unknown Author`, `Unknown Voice Artist`. Those are absence written down, not evidence, and
left in they give every untagged book in the library a shared "author". `scanLibrary.ts`
now imports the constants from `detectionUnits.ts` rather than repeating the literals, so
the writer and the reader cannot drift apart in silence.

### `rel` is the directory, and its DEPTH is load-bearing

03's answer paid a round trip for `rel` being the directory. There is a second half:
`folderClusters` skips depth-1 directories, so an absolute `rel` moves every author folder
to depth 3+ and that guard stops firing. A book under **no configured library root** is
therefore **dropped and counted**, never included with an absolute path — abstention (A7)
over a silently different clustering. The probe warns when the count is non-zero, which
only stale library settings can cause.

Three smaller rulings, each a test:

- **Roots match longest-first**, so a library folder nested inside another wins.
- **`flat` is counted over the assembled set**, after drops — a book whose directory-mate
  was dropped is correctly *not* flat.
- **`part` stringifies rather than parses.** `15.5` is a real novella position (02's
  finding); `String(15.5)` keeps it and the cascade parses strings anyway.

### The DB shape is narrower than the corpus, and it costs nothing

`books` has **one** author column, where the corpus carries `artist` and `album_artist`
separately — and they differ on **132 of 298 units**. Collapsing both onto the single
column is **byte-identical** at both fidelities: same series, same counts, same names.
Worth knowing before someone "fixes" it by adding a column.

### Cost

`loadLibraryDetectionUnits` is **four queries, never per-book**: all books, all authors,
all first-chapters, settings — joined in memory. The first-chapters query is the one that
needed care: auto-chapters make the table ~40k rows on a real library, so it filters
`chapter_number = 1` (every writer in the repo numbers from 1 — the scan's `index + 1`,
`generateAutoChapters`, and both single-chapter rebuilds) and instantiates ~350 models
instead of 40,000. Where a book has several, lowest `startMs` wins and fetch order breaks
the tie, reproducing `bookStructuralKey`'s stable sort.

Pure assembly at 350 books, desktop Node, median of 25 runs: **0.70 ms** (max 4.05 ms);
`detectSeries` over the same set, **7.2 ms**. The probe prints the device figure for the
read plus the assembly, which is the number the criterion actually wants.

### Found on the way — the depth-1 guard is unratified, and it is NOT inert

`seriesDetection.ts:327` skips depth-1 directories with the comment *"depth 1 is the author
level; it never names a series."* That line is
`.scratch/series-ux-redesign/research/02-detection-cascade/cascade.js:169`, ported verbatim.
It appears in **no spec section, no ticket and no ADR** — and the research code carried an
`allowTopLevel` escape hatch, hardcoded `false` at `cascade.js:199`, never once flipped.

**On the library as configured today it changes nothing** — 19/179 and 28/213 with the
guard removed, zero series added or removed, despite 34 top-level directories holding ≥2
books. `isAuthorish` and name-corroboration already reject those on their own merits.

**But "depth 1" is a fact about the ROOT, not about the library**, so the guard's effect
moves the moment a user adds a folder further down. Re-rooting each top-level folder in the
corpus in turn — i.e. simulating a user who adds `/Audiobooks/Terry Pratchett` as their
library folder — **12 of the 19 candidates detect differently**, always *worse*:

| re-rooted library | guard ON (shipped) | guard OFF |
| --- | --- | --- |
| Terry Pratchett, 98 books, conservative | 3 series / **55** placed — one merged `Discworld[47]` | 4 series / **88** — `Discworld[41]` + `Discworld (2022)[39]` |
| Terry Pratchett, full | 3 / 55 | 5 / 92 (adds `The Science of Discworld`) |
| Orson Scott Card, 21, full | 3 / 13 | 4 / 20 (adds `Enders Game[7]`) |
| Tad Williams, 4 | 0 / 0 | 1 / 4 (`Memory, Sorrow & Thorn`) |
| Dan Simmons · Scott Lynch · Ben Aronovitch · R. J. Bennett · D. Gemmell | 0 / 0 each | one correct series each |
| Jim Butcher · John Conroe · Steven King · Jonathan Stroud | short by 1–3 books | complete |

The headline case is that **A4's edition split stops working**: both Discworld recordings
collapse into one 47-book series, which is the exact defect the collision check exists to
prevent.

**The guard is not a real defence either.** It does prevent one false positive — a genre
folder at depth 1 holding numbered books with no usable album name becomes a bogus series
via `folder:number-corroborated(8/8)`, and that fires at **conservative** fidelity. But
**the identical folder one level deeper already produces the identical bogus series today,
shipped.** So the guard does not stop the false positive; it relocates it by one directory
level, at the cost of the table above. If that false positive is worth stopping, the thing
to change is `number-corroborated`, at every depth — not this line.

**Not changed here.** `seriesDetection.ts` is 03's resolved, 64-test module. **Driver's
call**; if it is taken, see *Does 04 have to move?* below.

> **Taken, 2026-08-07.** The guard is removed in [03](03-detect-series-seam.md#answer),
> which reproduced both halves of the finding and replaced it with a stronger property:
> grouping is now **invariant under re-rooting** for all 24 top-level corpus folders at both
> fidelities, pinned by tests that a re-added guard fails. 04 needed no edit, as predicted
> below — its round trip still passes untouched.

### Does 04 have to move if 03 changes? No.

Checked rather than assumed, because 04 is blocked by 03:

- **04's output is unchanged.** The guard is read *inside* `detectSeries`; `rel` means the
  same thing either way, and `buildDetectionUnits` never consults depth.
- **04's round-trip assertions still hold.** They pin 19/179 and 28/213, and guard removal
  leaves both byte-identical on the corpus. Nothing in `detectionUnits.test.ts` needs
  editing.
- **The drop-books-outside-the-root rule survives, on better evidence.** Its first
  justification *was* the depth guard, which would have been undercut. Re-measuring found a
  stronger and guard-independent one: leaving the root on the front of `rel` makes the root
  itself a depth-2 cluster, and the corpus grows a **71-book series called "Audiobooks"** at
  full fidelity (28/213 → 29/284), with or without the guard. Conservative fidelity is
  untouched, so it fails in exactly one of the two modes. The code comment and the test now
  cite that measurement instead.

The one thing that *would* have reached back here is tightening `number-corroborated`,
which can move the corpus totals. It was reassessed and **closed with no change** — see
below — so that coupling never fired.

### `number-corroborated`: reassessed 2026-08-07, changed nothing

Raised here as the rule actually worth looking at once the depth guard went. The answer is
to leave it at `NUMBER_CORROBORATION_FRAC = 0.6` / `size >= 3`.

**It fires seven times on the corpus, not three.** 03 measured the three that surface as
proposals; `folderClusters` assigns the mode to four more that `assign` then discards,
because a member's own name signal outranks a folder cluster and because the **deepest**
accepted cluster wins. Masked firings still matter — masking is contingent on another rule
winning. Checked against ground truth, surfaced or not:

| cluster | size | numOk | truth | purity | |
| --- | --- | --- | --- | --- | --- |
| `First Law World` | 10 | 10/10 | The First Law ×7 + The Age of Madness ×3 | **70%** | masked |
| `Steven King` | 9 | **6/9** | The Dark Tower ×8 + 1 standalone | 89% | masked |
| `The First Law` | 7 | 7/7 | all correct | 100% | **surfaced** |
| `Memory, Sorrow & Thorn series by Tad Williams` | 4 | 4/4 | all correct | 100% | masked |
| `Blake Crouch` · `Crouch, Blake - Wayward Pines 1-3` | 3 · 3 | 3/3 | all Wayward Pines | 100% | masked |
| `The Age of Madness` | 3 | 3/3 | all correct | 100% | **surfaced** |

**Every discriminator considered fails on `First Law World`.** Numbers `1–7`, 100% density,
starts at 1, one author, `0/10` members carrying any name signal — it is indistinguishable
from `The First Law` on all four axes and it is 70% pure. `Steven King` at 6/9 = 67% is the
only cluster where the `0.6` fraction is load-bearing at all, and it is masked, so 03's
"the constant is unexercised" holds at the level that matters.

**What supplies the precision is not this rule.** `First Law World` loses because `assign`
prefers the deepest accepted cluster, and the real layout is
`Joe Abercrombie/First Law World/{01 - The First Law, 02 - The Age of Madness}/…`. The
threshold contributes nothing to that outcome.

**All three candidate tightenings were built and run end to end:**

| variant | conservative | full |
| --- | --- | --- |
| shipped | 19 / 179, purity 98.3%, swept 0 | 28 / 213, 97.2%, 2 |
| require one author per cluster | identical grouping | identical |
| fraction `0.6 → 1.0` | identical grouping | identical |
| `size >= 3` → `>= 4` | **regresses** | identical |

The size gate is the instructive failure: dropping the 3-book `The Age of Madness` cluster
lets its shallower parent win, and those books return as `"First Law World"[3]` — still
correctly grouped, but named after a folder. Per A8 the name is an editable default, so the
cost is a worse default for no gain.

**A regression pin was proposed and then withdrawn as redundant.** Patching the size gate
into `seriesDetection.ts` and running the suite fails **6 existing tests**, so the tripwire
is already there. It fires through the canonical-number assertions (a renamed series drops
its books out of the number-scoring denominator), which points a future reader at
*numbering* rather than at folder precedence — a misleading message, not missing coverage.
Not worth a new test.

**Correction to this ticket's earlier framing:** `First Law World` was described here as a
70-percent-pure ten-book merge waiting to surface. That is what the *cluster* holds, but no
change was found that surfaces it intact — the size-gate variant produced it with **three**
books. The demonstrated failure is a wrong **name** on a correct group, which is milder.

### Device-pending — the two-stage check, and why it is two

> **Runnable procedure: [`../DEVICE-CHECK.md`](../DEVICE-CHECK.md)** (2026-08-07) — the wipe
> path, the logcat capture, how to read the diff, and the two followups that block
> [02](02-capture-tags-at-scan.md)'s half. This section is the reasoning; that file is the
> checklist. **Run both tickets' criteria in one pass** — the wipe 02 requires gives 04
> full-fidelity input for free.

Both open criteria are about **scale**, so neither can be met on the small emulator
libraries. But everything in `detectionQueries.ts` is untested by design (it touches the
adapter), and *that* half is pure pass/fail and needs no scale at all. So the emulator
is a cheap smoke test that de-risks the real run, not a substitute for it.

Either way the entry point is the same: Metro dev build → Library → Series view → the
`proto ·` pill → **`Detect series (log)`**. It reads the real database, runs the real
cascade at both fidelities, and prints a listing ordered and formatted to diff against
`.scratch/series-ux-redesign/research/02-detection-cascade/SERIES_LISTING.txt`, with the
`why` trail and confidence on every line. Nothing is written; the write is
[06](06-detection-runs-on-scan.md).

#### Stage 1 — `Pixel_7_Pro` emulator (~8 books). Verifies the DB read, not the result.

Read the header lines only. **`0 series` is the CORRECT output on eight unrelated books**
and must not be read as a failure.

| Log line | What a bad value means |
| --- | --- |
| `N units from N books` | equal and non-zero — the four-query read works |
| `OUTSIDE ROOTS` | should be **absent** entirely; present means stale library settings |
| `structural keys: n/n agree with the library store` | anything but `n/n` means the `chapter_number = 1` narrowing has drifted from `bookStructuralKey`, and **every membership row 06 writes would be keyed wrong** |
| `roots: …` | non-empty |

The `OUTSIDE ROOTS` line is the one that looked riskiest and is not: `enumerateAudioViaMediaStore.ts:79-82`
already filters every scanned file with `fsPath === r.absPath || fsPath.startsWith(r.absPath + '/')`
against the same `libraryRootAbsPath(entry)` this assembly uses, so every chapter URL in the
database is under a configured root **by construction, through the same comparison**. A
`/sdcard` vs `/storage/emulated/0` mismatch cannot arise; only a folder removed from
settings after import can.

#### Stage 2 — the driver's device, **wiped and rescanned**. This is the acceptance.

The wipe is not incidental. It closes two tickets' device debt in one scan:

- **04** gets full-fidelity input, so the listing diff is apples-to-apples with the probe.
- **02** still owes *fresh-scan fill rates on real hardware* and *no measurable scan-time
  regression*, both of which need exactly a wiped library and a full rescan.

Skipping the wipe still gives a valid **grouping** comparison — 03 pinned that tag-stripped
grouping is byte-identical — but canonical numbers would differ on ~5 books
(96.4% → 93.5%) for a reason already known, which is noise in the diff that has to be
explained away every time it is read.

**Reading the diff.** Expect **more** books than `SERIES_LISTING.txt`, not the same: the
research probe sampled at most two files per directory and missed ~35 single-file books in
flat multi-book folders, and those books now exist as real rows. That is the coverage lower
bound the fixture's own caveat 2 describes. **A higher count is the corpus being
incomplete; only a different GROUPING is a bug** — a series that splits, merges, or
vanishes. Ballpark: ~19 series conservative, ~28 full.

The second criterion reads off the same header: `N units from N books in Xms` covers the
read plus the assembly. Pure assembly at 350 books is 0.70 ms on desktop Node (see *Cost*),
so the DB read dominates; a figure in the tens of ms is expected and a figure in the
hundreds means something is querying per-book.

### Not done, deliberately

- **No timing assertion in jest.** A wall-clock threshold in a suite that runs on whatever
  machine is free is a flake generator; the number belongs in the device log, where the
  probe puts it.
- **`loadLibraryDetectionUnits` has no test.** It touches the adapter, which this effort
  ruled untested; its two non-obvious decisions (the `chapter_number = 1` narrowing and the
  tie-break) are covered on device by the structural-key cross-check instead.
- **The dev entry point rides the throwaway harness**, so `rm -rf src/prototypes`
  ([18](18-delete-the-prototype-harness.md)) removes it with no residue. `Manage Library`
  was the alternative and was rejected: [07](07-series-detection-card.md) builds the real
  `Detect Series in Existing Books` button there, and a temporary row would have to be
  un-built.
