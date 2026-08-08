# Device check — closing 02's and 04's device debt in one run

**Created:** 2026-08-07 · **Branch:** `feature/series-styling` · **For:** the driver, at a device

Four acceptance criteria across two tickets are open, and all four are properties of a
**real, full-size library**. This is the procedure for closing them. Nothing here needs a
native rebuild.

---

## What one run closes

| Ticket | Open criterion | Where it is read |
| --- | --- | --- |
| [02](issues/02-capture-tags-at-scan.md) | Fresh scan populates the columns at the surveyed fill rates — `file_format` ~99.7%, `series` ~6.6%, `part` ~5.9%, `grouping` ~5.6% | needs a followup, see §5 |
| [02](issues/02-capture-tags-at-scan.md) | Scan time does not regress measurably | needs a followup, see §5 |
| [04](issues/04-detection-units.md) | Output compared against `SERIES_LISTING.txt`, differences **explained not hand-waved** | probe listing |
| [04](issues/04-detection-units.md) | Assembly measured, no visible pause | probe header |

02's two criteria are the reason the library must be **wiped and rescanned** rather than
just rescanned: the scan is incremental, so an unchanged library produces zero MediaInfo
results and the capture code never runs.

---

## 1 · Preconditions

- **No native rebuild.** Everything in 02/03/04 is JS/TS — `mediainfo.ts`, `scanLibrary.ts`,
  `usePopulateDatabase.tsx`, `src/helpers/*`, `src/db/*`. A Metro reload runs a real
  migration (schema/migrations are JS). `npx expo start` is enough; `npm run android` only
  if the installed APK predates some *other* native change.
- **Schema v33 must have run.** It logs to `ReactNativeJS`. Real devices go 31 → 32 → 33 and
  v33 hits **zero rows** (v32 creates the tables empty), so emulators need no wipe *for the
  migration* — the wipe below is for the tag capture, which is a different thing.
- Branch is `feature/series-styling` at `2e864b7` or later.

---

## 2 · Stage 1 — emulator smoke test (~5 min, do this first)

`Pixel_7_Pro`, ~8 books. **This cannot meet any criterion** — both are about scale — but it
verifies the half of ticket 04 that is untested by design (`src/db/detectionQueries.ts`
touches the adapter). Cheap insurance before touching the real library.

Metro dev build → **Library → Series view → the `proto ·` pill (bottom-left) →
`Detect series (log)`**.

Read **only the header lines**:

```
[detect] 8 units from 8 books in 41ms
[detect] roots: /storage/emulated/0/Audiobooks
[detect] structural keys: 8/8 agree with the library store
[detect] 0 units in multi-book directories (flat) · 0 carry a SERIES/Grouping tag · 0 have no album
```

| Line | A bad value means |
| --- | --- |
| `N units from N books` | must be **equal and non-zero** — the four-query read works |
| `· N OUTSIDE ROOTS` | should be **absent entirely**; present = stale library settings |
| `structural keys: n/n agree` | anything but `n/n` means the `chapter_number = 1` narrowing has drifted from `bookStructuralKey`, and **every membership row ticket 06 writes would be keyed wrong**. Stop and fix before Stage 2. |
| `roots: …` | non-empty |

> **`0 series` is the CORRECT output on eight unrelated books.** Do not read it as a
> failure. The listing is meaningless at this scale; only the header is.

`OUTSIDE ROOTS` is the line that looked riskiest and is not: `enumerateAudioViaMediaStore.ts:79-82`
already filters every scanned file with `fsPath === r.absPath || fsPath.startsWith(r.absPath + '/')`
against the same `libraryRootAbsPath(entry)` the assembly uses, so every chapter URL in the
database is under a configured root **by construction, through the same comparison**. A
`/sdcard` vs `/storage/emulated/0` mismatch cannot arise; only a folder removed from
settings after import can.

**Emulator gotchas** (from `emulator-testing-setup` memory): use
`$ANDROID_HOME/cmdline-tools/latest/bin/` — the apt `avdmanager`/`sdkmanager` on PATH are
broken. Snapshot-restored AVDs have frozen clocks and stale logcat. For a second emulator,
`adb -s <serial> reverse tcp:8081 tcp:8081` plus `localhost`; `10.0.2.2:8081` does **not**
work.

---

## 3 · Stage 2 — the real device, wiped and rescanned

### How to wipe — use the in-app path, not `pm clear`

**Settings → Manage Library → remove the library folder → re-add it → let the scan run.**

`removeLibraryFolder` (`src/db/settingsQueries.ts:241`) drops the folder from settings,
deletes every book whose first chapter path starts with it, deletes their chapters, prunes
the dangling `series_books` rows and auto-deletes any series left empty. Re-adding the
folder re-grants SAF as part of the picker flow.

Prefer this over `adb shell pm clear com.fuzzylogic42.JBAudio`, which also destroys theme,
playback rate, skip durations, bedtime and last-active-book, and forces re-onboarding.

> **What you lose either way:** all listening progress — `last_played_at`, `finished_at`,
> `current_chapter_index`, `current_chapter_progress`, `book_progress_value`. The driver has
> accepted this. There is no export.

### Then run the probe

Same entry point: **Series view → `proto ·` pill → `Detect series (log)`**.

Capture the whole thing to a file — the listing is ~300 lines and the Metro pane will lose it:

```
adb logcat -c                       # before pressing the chip
adb logcat -s ReactNativeJS:* > ~/detect-$(date +%Y%m%d).log
```

---

## 4 · Reading the result

### 04 · the listing diff

Compare against
`.scratch/series-ux-redesign/research/02-detection-cascade/SERIES_LISTING.txt`. The probe
orders series longest-first then A–Z and prints `#number  title  confidence  why…` per book,
deliberately so this diff lines up.

**Expect MORE books than the listing, not the same.** The research probe sampled at most two
files per directory and missed ~35 single-file books in flat multi-book folders. That is the
fixture's own caveat 2 — coverage figures are lower bounds; **assert accuracy, never
coverage**.

- A **higher count** is the corpus being incomplete. Not a bug.
- **Only a different GROUPING is a bug** — a series that splits, merges, or vanishes.
- Ballpark: **~19 series conservative, ~28 full**. Wildly different means the unit assembly
  is wrong, not the cascade (ticket 04's own Note).
- Both Discworld editions must be present and separate — `Discworld` and `Discworld (2022)`,
  41 and 39 in the corpus. A merge here is §A4's collision check failing and is the single
  most informative thing to check first.

### 04 · the timing

Read `N units from N books in Xms` — that covers the DB read plus the assembly. Pure
assembly at 350 books is **0.70 ms** on desktop Node, so the four queries dominate.

- **Tens of ms:** expected, criterion met.
- **Hundreds of ms:** something is querying per-book. The suspect is
  `firstFilePathByBookId()` in `src/db/detectionQueries.ts` — it narrows an ~40k-row chapters
  table to ~350 with `Q.where('chapter_number', 1)` precisely to avoid that.

### 02 · the fill rates

**Not currently readable from the probe — see §5.** The probe prints
`N carry a SERIES/Grouping tag`, which conflates two of the four columns and omits
`file_format` and `part` entirely.

---

## 5 · Followups needed — two gaps found while writing this up

### (a) The probe cannot report 02's fill rates · RECOMMENDED BEFORE THE RUN · ~10 lines

`src/prototypes/detectionProbe.ts` prints `N carry a SERIES/Grouping tag` and
`N have no album`. Ticket 02 needs four separate percentages, and
`loadDetectionBookRows` does not read `file_format` at all.

The fix is small because the row read already exists:

1. Add `fileFormat: string | null` to `DetectionBookRow` (`src/helpers/detectionUnits.ts`)
   and read `book.fileFormat` in `loadDetectionBookRows` (`src/db/detectionQueries.ts`).
   It is not a detection signal — the assembly ignores it — so it rides along purely for
   this measurement. Say so in a comment, or the next reader will wire it into a unit.
2. Print one line: `file_format N% · series N% · part N% · grouping N%`, over `bookCount`.

Without this, 02's fill rates need a manual query instead:

```
adb shell run-as com.fuzzylogic42.JBAudio \
  sqlite3 databases/<db>.db \
  "select count(*), sum(file_format is not null), sum(series is not null),
          sum(part is not null), sum(grouping is not null) from books;"
```

…which works on a debug build but is fiddlier and leaves no record in the log.

### (b) No scan-time instrumentation exists at all

`scanLibrary.ts` has no timing logs — only `setLastScanAt(Date.now())` at line 1080. 02's
*"scan time does not regress measurably"* has nothing to read, and there is no stored
baseline to regress **against**, since the pre-02 scan was never timed either.

Two honest options:

- **Derive it from logcat timestamps** across this run (scan start → completion) and record
  the number as the *first* baseline rather than as a comparison. This is what the criterion
  can actually support today.
- **Add instrumentation** to `scanLibrary` and defer the criterion to the next scan.

Either way the criterion should be re-worded: as written it implies a baseline that does not
exist. 02's own reasoning is the substantive defence — the capture rides MediaInfo results
the scan **already holds in hand**, adds no file I/O and no second pass — and that is an
argument from the code, not a measurement.

---

## 6 · Recording the outcome

- **04:** tick the two boxes in `issues/04-detection-units.md` and append the observed
  numbers plus the explained diff under its `## Answer`. If the grouping differs, that is
  either a porting bug or a real library change since the probe — say which, with evidence.
- **02:** tick its two boxes in `issues/02-capture-tags-at-scan.md` with the measured fill
  rates, and note how scan time was established given (b).
- Set both `Status:` lines to `resolved` once the boxes are ticked.
- `git push origin feature/series-styling` — the branch is several commits ahead and the
  background session had no credentials.

---

## 8 · Run log — Stage 1, `Pixel_7_Pro`, 2026-08-07

**Both §5 followups shipped before the run** (`7b8b1e1`, `dd8f5b4`), so §5's manual-`sqlite3`
fallback is no longer needed and (b)'s "no instrumentation exists" is out of date. Full log:
[`device-check/stage1-emulator-2026-08-07.log`](device-check/stage1-emulator-2026-08-07.log).

**Stage 1 header — PASS, identical across 9 presses.** 7 books, not the 8 in §2: Dresden #8
was deleted for disk space.

```
[detect] 7 units from 7 books in 0-4ms
[detect] roots: /storage/emulated/0/Audiobooks
[detect] structural keys: 7/7 agree with the library store
```

No `OUTSIDE ROOTS`, no mismatches, no probe failures. The `7/7` is the criterion that
mattered — the `chapter_number = 1` narrowing has **not** drifted from `bookStructuralKey`,
so [06](issues/06-detection-runs-on-scan.md)'s membership rows will be keyed correctly. It
also detected `The Dresden Files` (3 books, `alb.hash-colon`) identically at both fidelities,
which §2 did not predict: the cascade runs end to end on device, not just the DB read.

### The emulator was then wiped and rescanned too, deliberately

Not in the original plan. The point was to exercise **02's DB write path — untested by
design — on 7 throwaway books before the real library's listening progress is destroyed**,
since a write bug would otherwise surface only *after* an irreversible wipe and force a
second one. It found no bug, and produced the first end-to-end evidence that 02 works:

| | before wipe | after wipe | target |
| --- | --- | --- | --- |
| `file_format` | 0.0% | **100.0%** (7/7) | ~99.7% |
| `grouping` | 0.0% | **42.9%** (3/7) | ~5.6% |
| `series` | 0.0% | 0.0% | ~6.6% |
| `part` | 0.0% | 0.0% | ~5.9% |
| `book_tags` rows | — | **7** (one per book) | one per book |

**The `0.0%` column on the left is the no-backfill ruling working**, not a defect: that
library was scanned pre-02. **`series`/`part` staying 0% is not a miss either** — at n=7 the
~6.6% target predicts **0.46 books**, so zero *is* the expected count; these seven files carry
no Audible freeform atoms. Assert accuracy, never coverage: nothing here is a rate, it is a
demonstration that all four columns are reachable and that two of them populate from real
MediaInfo output. **The percentages that matter are Stage 2's.**

The probe's own printed rates were cross-checked against raw SQL over the pulled DB and agree
exactly, so the new instrumentation is verified rather than merely running.

**02's cover-art hazard is closed on device.** Its answer warned that naive
`JSON.stringify(general)` would store a JPEG per book, and that the survey could never have
caught it (0/304 corpus records carried `Cover_Data`). Measured here: **0 of 7 blobs contain
`Cover_Data`**, while `Cover` / `Cover_Type` / `Cover_Mime` are kept. Blob mean 2,783 bytes
(02 measured 1,933 mean / 20,080 max) — same order of magnitude.

### Scan timing — first baseline

```
before wipe:  [scan]  243ms total ·  50 files,  0 new (nothing rescanned) — enumerate 97ms · existing-urls 2ms · process    1ms · cleanup 131ms
after wipe:   [scan] 2249ms total ·  50 files, 50 new (43.1ms/new file)   — enumerate 70ms · existing-urls 0ms · process 2155ms · cleanup   3ms
```

This is why §5(b)'s criterion needed the `M new` normaliser: the same 50-file library scans in
243 ms or 2,249 ms depending only on how many files are *new*, and the first figure is not a
scan-time baseline at all. `process` is 96% of a real scan. **These are 50-file numbers and are
not comparable to Stage 2's ~4,000** — the per-new-file figure (43.1 ms) is the one that
carries across.

### Still open

Nothing above closes any of the four criteria — all four are properties of **scale**, and this
is a 7-book library. Stage 2 on the real device remains exactly as specified in §3.

### Two corrections to §1's preconditions

- **A native rebuild was NOT needed, confirmed rather than assumed.** The installed APK
  predates three native-touching commits (the RNTP patch, `MainActivity.kt`, `build.gradle`),
  which looked like a violation of §1 — but gradle reports `assembleDebug UP-TO-DATE`, so the
  compiled inputs are unchanged. §1 is right. `npx patch-package` re-applied all 7 patches
  cleanly beforehand.
- **A SIGSEGV in `MountingCoordinator::pullTransaction` during first-surface mount is the
  emulator window being closed**, not an app fault. It reads as a hard native crash and cost
  a rebuild cycle to dismiss.

---

## 9 · Run log — Stage 2, physical Pixel 7 Pro, 2026-08-07 · ALL FOUR CRITERIA CLOSED

Dev build over Metro (**required, not merely faster** — the whole prototype harness is
`__DEV__`-gated at `SeriesProtoSlot.tsx:23`, so a preview build has no `Detect series (log)`
chip at all). Library removed and re-added through `Manage Library`; verified genuinely empty
first (0 books, 0 chapters, `user_version: 33`). Full log:
[`device-check/stage2-device-2026-08-07.log`](device-check/stage2-device-2026-08-07.log).

```
[scan]   186525ms total · 3461 files, 3461 new (53.4ms/new file)
         — enumerate 1541ms · existing-urls 29ms · process 184735ms · cleanup 213ms
[detect] 351 units from 352 books in 47ms · 1 with no chapters
[detect] structural keys: 351/351 agree with the library store
[detect] tag fill over 351 books — file_format 100.0% · series 6.6% · part 6.0% · grouping 5.1%
[detect] CONSERVATIVE — 23 series, 200 books placed
[detect] FULL         — 32 series, 247 books placed
```

| Ticket | Criterion | Result |
| --- | --- | --- |
| 02 | fill rates ~99.7 / ~6.6 / ~5.9 / ~5.6 | **100.0 / 6.6 / 6.0 / 5.1** ✅ |
| 02 | scan time no measurable regression | **first baseline**, 53.4 ms/new file ✅ (reworded — see 02) |
| 04 | listing diff explained | **nothing lost, split or merged** ✅ |
| 04 | assembly, no visible pause | **47 ms** ✅ |

**04's diff.** Set-compared both directions at both fidelities. Every research series survives;
`Discworld` **41** + `Discworld (2022)` **39** stay separate, so A4's collision check fires on the
real library. Growth (+4 series; `Bobiverse` 2→5, `Silo` 2→3, `TMC` 2→3, `Rivers of London` 3→16)
is books the research probe never sampled — its own caveat 2. The single decrease,
`Lockwood and Co.` 5→4 losing `#4 The Creeping Shadow`, was **predicted by 04's own corpus
measurement before the device was touched**, to the exact series and count.

**02's rates land on the survey** — `series` exact, `part` +0.1, `grouping` −0.5 (two books),
`file_format` 351/351 — and `book_tags` has one row per book. On the emulator's fresh scan, **0
blobs contained `Cover_Data`**, closing this ticket's cover-art hazard on real data.

**`352 books → 351 units` is explained and is not a detection fault**: `The Dark Tower VI: Song
Of Susannah` is one book scanned into two rows, the second numbered 3-12 so it matches no
`chapter_number = 1`. Scan-side defect, recorded in [`NOTE-book-split.md`](NOTE-book-split.md)
and deliberately not investigated (driver's call). `The Dark Tower` still detects at 8, matching
the research listing. Two now-false comments were corrected; **no behaviour changed**.

### §5's two gaps were fixed before the run, not worked around

Both shipped in `7b8b1e1`/`dd8f5b4`, so the manual `sqlite3` fallback in §5(a) and the
logcat-timestamp arithmetic in §5(b) were never needed. §5 is closed.

### Corrections to this document

- **§1 is right: no native rebuild was needed.** The APK predating three native-touching commits
  looked like a violation; gradle reported `assembleDebug UP-TO-DATE`, so the compiled inputs
  were unchanged.
- **§2's "0 series is correct" generalises**: the emulator produced **1** correct series, which is
  equally fine. Read the header, not the count.
- **If you pull the DB to verify anything, pull `-wal` and `-shm` too.** `watermelon.db` alone can
  be days stale and reads exactly like a failed migration — it showed `user_version: 32` with no
  `book_tags` while the live DB was correctly at 33.
- **A SIGSEGV in `MountingCoordinator::pullTransaction` at first-surface mount is the emulator
  window being closed**, not an app fault.

---

## 7 · Traps — do not re-derive these

- **`0 series` on a small library is correct output**, not a failure. (§2)
- **A higher book count than `SERIES_LISTING.txt` is expected**, not a regression. (§4)
- **Do not skip the wipe** hoping a rescan is enough. The scan builds `existingUrls` from the
  chapters table and runs MediaInfo only on files not already present — an unchanged library
  produces **zero** results and 02's capture code never executes.
- **Do not `expo prebuild --clean`.** `android/` is committed and holds a custom turbomodule.
- **A failed migration is silent.** If the probe reports zero units, check `ReactNativeJS` for
  v33 before suspecting the assembly.
- **The probe writes nothing to the database.** If a Series row appears after pressing it,
  that is a bug — the write is [06](issues/06-detection-runs-on-scan.md).
