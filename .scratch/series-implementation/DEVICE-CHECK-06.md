# Device check — ticket 06 (detection runs on scan)

**Run on 2026-08-08.** Physical **Pixel 7 Pro** (`29131FDH3009SZ`, Android 16, targetSdk 36),
dev build from `npx expo run:android` (installed 17:15, Metro serving the branch's JS).
**Fresh install, empty library, no configured folder** — verified before starting: schema v33,
all ten tables, `books` 0, `series` 0, `book_folder` `''`.

**Result: all six open criteria on [06](issues/06-detection-runs-on-scan.md) CLOSED, plus
[19](issues/19-membership-survives-a-file-move.md)'s mirrored device criterion.**

This is a **separate document on purpose**: [`DEVICE-CHECK.md`](DEVICE-CHECK.md) is the closed
record of 02/04's completed run and is not a live checklist.

Raw logs: [`device-check/tk06-device-2026-08-08.log`](device-check/tk06-device-2026-08-08.log)
(full) and `…series.log` (just the `[series]` / `[scan]` lines).

## The state that made this a real test

`series_detection_enabled` read **`NULL`** in the settings row for the whole run, and ticket 07
has not been built, so **there was no way to switch detection on**. Every series below was
created by the getter reading a null column as ON. Had the house `=== true` idiom shipped, the
outcome would have been zero series and no error — which is exactly the silent failure the
criterion was written to prevent.

## §1 — Cold scan

```
[series] 0 books sit under no configured root and 1 have no first chapter — all dropped
         before detection, out of 352
[series] detection (conservative): 351 units → 23 series, 200 books placed ·
         created 23 (200 rows) · inserted 0 · removed 0 · skipped 0 · 266ms
[scan]   184285ms total · 3461 files, 3461 new (52.6ms/new file)
         — enumerate 1506ms · existing-urls 28ms · process 182191ms · cleanup 200ms · detect 338ms
```

**23 series / 200 books placed is EXACTLY what ticket 04 measured on this device** on
2026-08-07 (`[detect] CONSERVATIVE — 23 series, 200 books placed`). The ticket's *"~19"* is the
**corpus** figure, not the device figure — 04 already recorded that the growth over the corpus's
19/179 is books the research probe never sampled. Detection and the write agree with the seam
measured a day earlier, to the row.

The 352 → 351 drop is the known scan-side book split
([`NOTE-book-split.md`](NOTE-book-split.md)), and it is **logged rather than silent**.

Spot-checks against the research listing, all correct: `Discworld` 41 · `Discworld (2022)` 39
(A4's edition split holding on real data) · `Dresden Files` 22 · `Demon Accords` 17 ·
`The Dark Tower` 8 · `The First Law` 7 · `Mistborn` 6. **`Lockwood and Co.` came in at 4, losing
#4 — the exact decrease 04 predicted, to the series and the count.** Its log block shows why:
`#1 #2 #3` are `certain alb.series-book-n`, `#5` is `possible folder:name-corroborated(3/5)`.

**In the database:** 23 series all `origin=detected name_source=detected`; 200 rows all
`membership=detected`; **zero nulls**. Four rows carry `canonical_source = NULL` — books with no
number, which is **G5 working as specified**: that one column deliberately does not coalesce.

## §2 — Rescan, unchanged library

```
[series] detection (conservative): 351 units → 23 series, 200 books placed ·
         created 0 (0 rows) · inserted 0 · removed 0 · skipped 0 · 159ms
[scan]   1697ms total · 3461 files, 0 new (nothing rescanned)
         — enumerate 1135ms · existing-urls 176ms · process 4ms · cleanup 84ms · detect 204ms
```

All **23 blocks logged `(existing)`**, not `(new)` — every proposal claimed its series by name.
The fingerprint (series ids + every member's key, position, number, provenance) is **identical**,
`sha=7577aec2` before and after: **same series ids**, so nothing was deleted and recreated.

## §3 — A hand-made series

`Bedtime Test`, built through the app's own create wizard from three books **already inside the
detected `Bobiverse` series**, deliberately ordered **05, 01, 03** — a wrong order, so that a scan
"helpfully" re-sorting it would be visible.

Its rows are written by `createSeries`, which sets no provenance, so it reads
**`origin=NULL name_source=NULL membership=NULL`** — byte-identical to a row predating v33. That
is what makes this the upgrade-path test as well.

After a rescan:

```
[series] detection (conservative): 351 units → 23 series, 200 books placed ·
         created 0 (0 rows) · inserted 0 · removed 0 · skipped 0 · 119ms
```

- `Bedtime Test` **appears nowhere in the log** — detection never proposes a hand-made name, so
  it is not a candidate for the plan at all. The strongest form of "untouched".
- Its three members are still at positions 0, 1, 2 in the **05 / 01 / 03** order entered.
- The detected `Bobiverse` still holds all five books in numeric order. Three books sit in a
  detected series and a hand-made one **simultaneously**, with no conflict.
- All 23 detected series **byte-for-byte unchanged** (`sha=e4c7524f` over the detected subset).
- **Additive:** 23 detected series gained, nothing lost — 24 series / 203 rows total.

⚠ **The first run of §3 happened while the USB cable was disconnected**, so its scan was not
captured. It was **re-run with logging** (the block above), and the disconnected run was
independently corroborated from the database: `Bedtime Test.created_at` 17:35:18 vs
`settings.last_scan_at` 17:35:25 — **a scan provably ran 7 s after the series was created**, and
the series survived it intact.

## §4 — A moved book folder (closes [19](issues/19-membership-survives-a-file-move.md))

`Lockwood and Co.` Book 2 — one file, its own folder, in a 4-member detected series. The folder
was renamed over adb (`… → Book 2 - The Whispering Skull (moved)`) and MediaStore forced to
re-index (`content call --uri content://media --method scan_volume/scan_file`), verified by
querying MediaStore before and after: it reported **only** the new path.

```
[series] "Lockwood and Co."  4 books  (existing)
[series] detection (conservative): … created 0 · inserted 1 · removed 0 · skipped 0 · 160ms
[scan]   2174ms total · 3461 files, 1 new — … cleanup 245ms · detect 195ms
```

Predicted in writing before the run and matched exactly: the prune destroyed the dead row
(4 → 3), detection re-proposed the book at its new key, reconcile matched the series **by name**
and planned **one insert**.

- **One** series named `Lockwood and Co.`, in the **same series row** (`3c2h3reXjye1lgL4`).
- 4 members; the moved book present at its new path, `membership=detected`.
- **Zero** rows left pointing at the old path.
- Across the whole library fingerprint, **exactly one line changed** — the Lockwood one.
- **The re-added row landed at position 1.0, back between books 1 and 3, not appended.** That is
  05's fractional interpolation — `(0+2)/2` — putting the book back in its correct place in the
  order. Stronger than the criterion asked for.

The folder was then moved back and a final scan run: `inserted 1 · removed 0` again, and the
library fingerprint returned **byte-identical to its pre-move state** (`sha=5e2a71cf`, 24 series /
203 rows). The library was left exactly as it was found.

## §5 — Scan time

| Scan | Total | detect | Note |
| --- | --- | --- | --- |
| Cold, 3,461 new files | **184,285 ms** | **338 ms** | pre-06 baseline was **186,525 ms** (2026-08-07) — 2.2 s *faster*, i.e. noise |
| Unchanged rescan | 1,697 ms | 204 ms | dominated by `enumerate` 1,135 ms (MediaStore) |
| Unchanged rescan | 1,679 ms | 163 ms | |
| One new file | 2,174 ms | 195 ms | |
| One new file | 2,067 ms | 257 ms | |

Detection costs **338 ms on a cold scan — 0.18% of it** — and **160–260 ms on a rescan**. Of the
cold figure, 266 ms is the work and ~72 ms is printing 23 proposal blocks to logcat.

⚠ **Do not compare the rescan total against 02's 243 ms figure.** That number was measured on a
**50-file** library, not this one; it is not a baseline for a 3,461-file rescan. No pre-06
unchanged-rescan of the full library was ever timed, so there is **no before/after for the
total** — what is measurable is that detection is ~12% of a 1.7 s operation, and that the
dominant cost is MediaStore enumeration, which this ticket does not touch.

## Method notes worth keeping

- **`run-as` works on the dev build**, and the WatermelonDB file is at the app data **root**
  (`watermelon.db`, JSI adapter) — **not** in `databases/`. Pull all three of `watermelon.db`,
  `-wal` and `-shm` or the WAL's contents are invisible: the main file was 4 KB with 181 KB
  sitting in the WAL.
- **Neither the device nor this host has `sqlite3`.** Python's stdlib `sqlite3` reads the pulled
  files fine, WAL and all.
- **Forcing a MediaStore re-index after an adb `mv`** is essential — without it the app's scan
  sees a stale index and the move test fails for the wrong reason. `cmd media` does not exist;
  `content call --uri content://media --method scan_volume --arg external_primary` followed by
  `--method scan_file --arg <dir>` worked, confirmed by querying
  `content://media/external/audio/media` before and after.
- **Keep a persistent `adb logcat > file` running.** The device's ring buffer rolled over during
  the ~4 minutes the cable was disconnected and those lines were unrecoverable. The database
  saved the criterion; the log did not.
