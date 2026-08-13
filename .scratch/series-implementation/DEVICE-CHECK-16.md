# Device check — ticket 16, detection-aware save + the delete exit

**COMPLETE — every criterion closed, on 2026-08-13. Two driver rulings and three
defects came out of it.** Criterion 7 was closed last, by the driver, in a follow-up pass
with a real file arrival.

**Rig:** physical Pixel 7 Pro (`29131FDH3009SZ`), real library, **24 series** after the
scan. ⚠ The app was **not installed** when the ticket was built, so the run began with
`npx expo run:android` and a fresh database; the driver re-granted the library folder and
rescanned. Ticket 16 is all JS, so every iteration after that was a Metro reload — including
both fixes made mid-run.

**Driver drove the UI; agent captured, probed and measured over adb.**
**Screenshots/video frames:** `device-check/tk16-*` (8 files) · **logcat:**
`tk16-device-2026-08-13.log` — **1120 lines, zero errors, exceptions or invariant
violations** across every save, both deletes and the emptying save. Notably no
`prepareUpdate` *"record with pending changes"*, which is the throw this save path can
produce.

---

## The probe, because this ticket's subject is a row you cannot see

A tombstone is invisible by design, so the screen only ever proves half of it. Every
"still removed" below is backed by the row itself, read out of the live database:

```bash
# ⚠ ALL THREE FILES, from the app-data ROOT — not databases/. WatermelonDB runs in WAL
# mode, so the .db alone can be days old and reads exactly like a failed migration.
for f in watermelon.db watermelon.db-wal watermelon.db-shm; do
  adb exec-out run-as com.fuzzylogic42.JBAudio cat "$f" > "$D/$f"
done
node --experimental-sqlite  # node:sqlite; there is no sqlite3 on host or device
```

The script is worth keeping: it prints every series with `origin`/`name_source`, every row
with `position`/`canonical_number`/`membership`, marks tombstones, and counts
`suppressed_series`. Baseline was **24 series · 0 tombstones · 0 suppressions**.

---

## Closed

| # | Criterion | Evidence |
| --- | --- | --- |
| 1 | Removal writes the `'excluded'` tombstone | Removed `Bobiverse 05` (the **last** row deliberately — removing the tail moves no other row, so the UI can only update if the new `membership` column observation works). Row survived: `pos 4 · #5 · membership=excluded`, **4 visible / 5 rows**, and the other four rows byte-identical. A destroyed row would have been the defect. |
| 2 | The tombstone is invisible everywhere | Detail sheet redrew as `4 books · #1–4` (was #1–5), list #1–#4, hero next-up #1, completion `0/4`. The collapsed range re-derived correctly. |
| 3 | **It stays removed across a rescan** | Full `Detect Series in Existing Books` over the real library: tombstone intact, book 05 did **not** return, **no duplicate series** (still 24), every other position and number unchanged. This is the ticket's headline. |
| 4 | Re-adding clears the tombstone | `membership=user`, **position 4 — unchanged**, so the membership diff proposed nothing for that row and the planner's independent pass is what restored it. 0 tombstones left. ⚠ First attempt exposed **defect A** (below). |
| 5 | ~~Removing the last book suppresses~~ | **Superseded by driver ruling B.** Verified working first — emptying Bobiverse deleted it and wrote `suppressed_series: ['Bobiverse']` — and then ruled out of existence: an emptying save is now refused. |
| 6 | A rename persists across a rescan | Renamed to `Bob`, rescanned: `[origin=detected name_source=user]`, name kept, **no duplicate under the machine name**. Ownership per aspect held on device — the rename claimed the name and left `origin` alone. |
| 7 | New books still join a renamed series | **Closed on device by the driver, after the main run.** Library pointed at a reduced path holding `Bobiverse 01–04`; series renamed to `Bob`; **book 05 copied into the path**; rescan. It joined at `pos 4 · #5`, correct placement and numbering, in a series reading `[origin=detected name_source=user]`. ⚠ **The row's own provenance is the proof, not the screen: `membership=detected` and `canonical_source=detected` are values only `applyPlan` writes** — the editor's save path writes `'user'` for anything hand-added, by type. So reconcile inserted it, into a series it can no longer find by name. A10a's second pass and A10's `seedInsertPositions` both firing on a real file arrival. |
| 8 | Hand ordering survives a rescan | Dragged book 01 to the bottom; after the scan the rows read `#2, #3, #4, #1` in position order. Reconcile has no reposition verb, confirmed. |
| 8b | **The composite case** | Renamed **and** edited in one save, then rescanned: name kept, tombstone kept, no duplicate. This is A10a's live-defect case — continuity is matched by book overlap **counting tombstones**, and without it the re-created series carries the removed book back in. |
| 9 | A hand-made series is never touched | `ZZ Hand Test [origin=user name_source=user]`, rows `membership=user`, numbers `1,2 (user)` from E7. Rescan left it untouched, and its two books stayed in Bobiverse too. Those provenance columns are **written** now — before this ticket `createSeries` wrote nothing and the protection came from null coalescing. |
| 10 | The existing origin-blind dialog | *"Delete series? / This removes the series. Your books are not affected."* · `CANCEL` `DELETE`, unchanged, same on both origins. |
| 11 | Deletion writes the suppression row | Detected (`The Silo Saga`) → row written. Hand-made (`ZZ Hand Test`) → **nothing written**, which is A12's other half. |
| 12 | **K7 — the exit pops PAST the sheet** | Frame-by-frame at 10 fps, both themes. Dark: dialog → editor → **sheet sliding downward for ~200 ms** → library. Light: identical. One `pop(2)` animating both screens out, never settling on the sheet. |
| 13 | **K5 — no white screen, either theme** | Dark: **max luminance 0.192 across all 655 frames** (the library's own value); the old defect was a full-screen white sheet at ~0.95. Light: **zero frames above 0.90 mean**. ⚠ See the note on the luminance detector below. |
| 14 | I7 — `Delete Series` past AA on light | Sampled from real pixels: light `#ECEFF4` ground, glyph **`#B3261E`, 5.67:1** (8,485 px). Dark `#1C1C1C` ground, glyph **`#FF5F56`, 5.70:1** (26,294 px) — **provably unchanged**. The old shared `danger` measures **2.59:1** on that same light ground, confirming I7's reading against pixels rather than inference. |
| 15 | Font scale 2.0 | `settings put system font_scale 2.0`, density unchanged at 560 (⚠ Display Size ≠ font scale). `Save` shows K15's disabled fill with a legible label, `Delete Series` unclipped, identity row stacked to its cover-beside-caption variant, and the refusal alert wraps to three clean lines. |
| 16 | Restore → rescan → back | `Restore All` + rescan: **24 series, 0 suppressions, 0 tombstones**, and Bobiverse rebuilt with a **new id**, `origin=detected name_source=detected`, numbers 1–5 in detected order. A suppression is a veto, not a copy — the series came back from the library, not from a shadow. |
| 17 | No regression in the editor | `Sort by number`, the number boxes, the drag handles, `+ Add books`, the picker's two steps and the cover control with its caption all behaved through ~15 saves. The save path underneath them was rewritten. |

---

## Three defects found, all fixed and re-verified in-run

### A — re-adding a removed book silently cleared its canonical number

Removing `Bobiverse 05` and putting it back returned it with a **blank number box**, and
`Save` wrote that blank over the stored `#5`.

The row had held the number the whole time — a tombstone keeps `canonical_number` — but the
editor seeds its boxes from the **visible** rows and never looked at it. Not a regression
(before this ticket the row was destroyed, so the number went with it) but **newly fixable**,
because the tombstone is now the series' memory of the book.

Fixed **in the box, not in the DB**: `loadRememberedNumbers` + `restoreRememberedNumbers`
put the remembered `5` back into the visible field, so `Save` still writes exactly what the
user can see. The rejected alternative — keeping the number on the row while showing a blank
box — would have had the sheet badge `#5` over an editor showing nothing.

Re-verified: box filled with `5`, saved as `#5 (user) membership=user`.

### B — an emptying `Save` was a delete, and it landed on the dead sheet

DEVICE-FOUND, and it is **K7 through the other door**: `Save` on an emptied list deleted the
series and then `back()`ed onto the sheet of the thing it had just removed. D9's "Save's
exit is correct by construction" holds only while Save cannot delete.

First fix wired the same pop-past exit into `handleSave` (verified working). Then the driver
asked the better question — *should Save be able to delete at all?* — and **ruled it out**;
see below.

### C — nothing, but a measurement trap worth recording

The white-screen detector flags **17 "bright, uniform" frames** in the light-theme
emptying-save recording. They are the **empty editor** — flat `#ECEFF4` with two buttons —
not a blank sheet. In light theme, luminance alone cannot separate "correct empty state"
from "the defect"; the frames have to be looked at.

---

## Driver rulings

### Ruling A — the tombstone remembers the number (see defect A)

### Ruling B — `Save` may never delete a series. The book requirement is unconditional.

Raised by the driver after defect B: *"would it be a better flow to just not let the user
save a series that has no books in it?"*

**It is, and it is also less code.** An emptying save was an **unconfirmed destroy with a
lasting side effect** — the series went *and* its name was written to `suppressed_series`,
so detection would not recreate it until the user found it in `Removed Series` — performed
by a button labelled `Save`. Every other destroy in this app confirms first, and the one
that does, `Delete Series`, sits one tap below `+ Add books` on the very same screen. A14's
standing rule is *bulk creates, per-item destroys*; a run of per-item removals quietly
becoming a whole-series destroy at save time was the one place the app inverted it.

The change is a **net deletion**:

| | before | after |
| --- | --- | --- |
| `seriesEditorIssues` | `if (!editingSeriesId && bookCount === 0)` | `if (bookCount === 0)` — a condition removed |
| `planEditorSave` | returned a `'delete' \| 'save'` union | one shape, **no destructive verb at all** |
| `updateSeries` | delegated to `deleteSeries`, returned an outcome | no branch, no return value, reads back inside the writer |
| `handleSave` | second exit for the delete case | one exit |
| paths into the K7 exit | **two** | one |

The copy points at the escape hatch instead of dead-ending on it —
*"Add at least one book, or use Delete Series to remove it."* — but only in edit mode,
because the create pass has no `Delete Series` to name. Emptying-as-rebuild (K16) is
untouched: the replacements go in before the save.

Device-verified after the ruling: `Save` greys out with K15's disabled treatment while
staying pressable, pressing it names the problem, `Cancel` leaves the series untouched, and
`Delete Series` still lands on the library.

### Correction owed to the spec

**K7's "with no grab handle, so the only escape is system back" is overstated.** The driver
reports the blank sheet always had its handle. Ticket 12 added the themed background and
kept a handle; the "no handle" half of the original report was never accurate. The rest of
K7 stands and was reproduced.

---

## Two things worth not re-discovering

- **`deleteEmptySeries()` counts every `series_books` row, tombstones included** (K16), and
  that is deliberate. If a series with only excluded rows ever vanishes after a scan, the
  reaper has been "fixed" — and the next detection run brings every removed book back
  inside.
- **A book that reappears one scan later, not immediately**, means continuity stopped
  counting tombstones. Criterion 8b is the case that catches it.
