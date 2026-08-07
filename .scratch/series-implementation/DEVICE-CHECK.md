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
