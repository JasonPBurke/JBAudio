# Ticket 09 — device check, 2026-08-08/09

Physical **Pixel 7 Pro** (`29131FDH3009SZ`), dev build `versionCode=1`, driver's real library
(**3,461 files / 352 books / 351 detection units**). Library wiped and rescanned cold at the
start. Raw log: `device-check/tk09-device-2026-08-09.log` (app JS output) and `…series.log`. Screenshots: `device-check/tk09-*.png`.

**BOTH DEVICE CRITERIA CLOSED.** The run also produced three design changes, all driver-called —
see `## What the run changed`, because the surface that shipped is not the surface that was
tested first.

`DEVICE-CHECK.md` (02/04) and `DEVICE-CHECK-06.md` / `DEVICE-CHECK-07.md` are closed records of
their own runs. This is a new file for the same reason.

## Method notes worth reusing

- **`adb logcat -v time > file` was started BEFORE the driver touched anything**, per 07's
  finding that the 256 KiB ring buffer overruns in ~2 minutes of scanning. It held for the whole
  ~70-minute session.
- **The DB was pulled and read after every single step**, not just at the end. `run-as` +
  `watermelon.db` **plus `-wal` and `-shm`** (the JSI adapter keeps the app data ROOT, not
  `databases/`), read with Python's stdlib `sqlite3` — neither host nor device has the binary.
  A one-line `pull.sh` + a query script made this ~3 seconds per checkpoint, and it is what
  turned "the UI says 1" into "the table holds exactly one row".
- **Screenshots were measured, not eyeballed.** PIL + a WCAG contrast function for colour, and a
  single-column scan for geometry. Two findings below exist only because of that.
- **`adb shell screenrecord` captures VARIABLE-RATE — one frame per screen change**, so every
  extracted frame is a distinct state. That is what made the expansion animation measurable
  (`ffmpeg -vsync 0`, then measure the card's bottom edge per frame). ⚠ Detect the **page
  background colour** explicitly; "first non-white pixel" finds the tinted `Restore` pill and
  reports a card that never grows.

## The numbers

| | value |
| --- | --- |
| Cold scan | `172,710ms · 3,461 files, 3,461 new (49.3ms/new file) · detect 253ms` |
| Detection | **`351 units → 23 series, 200 books placed · created 23 (200 rows)`** |
| Baseline DB | **352 books · 23 series · 200 series_books · 0 suppressed** |
| Rescan (unchanged) | `1,690ms · 3,461 files, 0 new · detect 152ms` |
| Restore + rebuild | **143ms** for one series, 622ms for two |

**23 series / 200 books is byte-identical to tickets 04, 06 and 07** — a fourth independent
reproduction on the same library.

## The criterion, closed

```
[series] "Discworld"  41 books  (suppressed)
[series] detection: 351 units → 23 series, 200 books placed · created 0 · skipped 1 · 181ms
```

**Detection still proposes all 23 series and all 200 books on every single run.** `Discworld` is
re-proposed with its full 41 books each time and the suppression row is the only thing between
that proposal and a recreated series. That is the criterion proving itself rather than being
inferred from an absence.

Then, in **one run** after restoring only `Discworld`:

```
[series] "Discworld"      41 books  (new)
[series] "Dresden Files"  22 books  (suppressed)
[series] "Bobiverse"       5 books  (suppressed)
detection: created 1 (41 rows) · skipped 2 · 643ms
```

One run, three proposals, one created and two vetoed — restore is per-entry all the way down.

## Every criterion, at DB level

- **Detected delete suppresses.** 0 → 1 row, `name = 'Discworld'`.
- **Hand-made delete writes nothing.** A `createSeries` row reads `origin=NULL name_source=NULL`,
  so it is **byte-identical to a pre-v33 row** — this doubles as the upgrade-path test, and an
  upgraded tester's series cannot accidentally earn a suppression.
- **Books never touched.** **352 across every operation in the session**, without exception.
- **`Restore` / `Restore All`** both verified, counts recomputed from the table each time.
- **A13 clear-on-create.** Suppressed `Bobiverse` → hand-create `Bobiverse` → the table is
  **empty, not tombstoned**: the clear rides the same batch as the create.
- **G7.** Never more than one row per name; `destroyPermanently` leaves **zero tombstones**, so
  the count cannot drift.
- **Near-miss names are not vetoed.** Suppressing `Discworld` left **`Discworld (2022)` (39
  books) untouched** — the unit test's "does not match a name that merely starts the same way",
  on real data.
- **Two lossless round trips** back to the exact baseline (23 / 200 / 352 / 0).

## Light theme

Both themes rendered. Every theme token resolves — card `#FFFFFF`, body and label text `#4B5563`
at **7.56:1** — and **nothing renders dark-in-light** (the `InfoDialogPopup` failure 07 logged).

⚠ **A contrast reading was taken and then WITHDRAWN, deliberately.** The accent-tint buttons
measure `#FFB606` on `#FFF8E6` = **1.66:1**. That is not a finding: **the accent is user-settable
to any colour**, so the number describes the driver's current amber, not the design — the same
reasoning that made 07's checkbox use a tint rather than a knockout, and the same shape as 17's
PILLAR ruling. Recorded so it is not "discovered" again. The accent-independent claim is the one
above, and it passes. (Measured identically on 07's `Detect Series in Existing Books`, which
shipped and was device-verified, confirming the idiom is app-wide and not 09's.)

**Native `Alert.alert` dialogs paint DARK IN BOTH THEMES** — app-wide, pre-existing, same family
as 07's `InfoDialogPopup` note. Not 09's, logged not fixed.

## What the run changed

Three driver calls, made while the device was in hand. All are in the shipped build and were
re-verified on device afterwards.

1. **`Restore All` now confirms.** 09's original reasoning ("creates are unconfirmed") was too
   strong — `Apply Auto-Chapters` is itself a bulk create WITH a prompt. The better test is
   **reversibility**: restore-all is one tap to do and N confirmed deletes to undo.
2. **The dedicated screen became an inline expansion**, and the route was deleted. Driver
   expected a `Library Folders`-style dropdown. Decisive argument: restoring only lifts a veto,
   so the control that makes the series reappear belongs beside the one that asks for it.
   A `CollapsibleSettingsSection` (its own card) was rejected — it would contradict §A9's
   approved sketch, which puts this row **inside** the Series Detection card.
   ⚠ **This also dissolved a latent bug**: the settings Stack's `animation: 'slide_from_right'`
   contradicts the group's own `slide_from_left`, and **has been dead config until now** because
   every settings screen is the first screen of that stack. This route was the app's first push
   *within* it.
3. **Restore runs detection immediately** instead of waiting for a scan. The driver's argument —
   *"this seems the action the user is wanting"* — is right, and it is stronger than convenience:
   waiting **hides two silent failures**, detection being off and the books having moved. Both
   are now sentences the user reads. Verified live: with detection off, `Restored — Bromeliad is
   off the removed list. Series Detection is turned off, so it can't be rebuilt until you turn it
   back on.`, with `[series] detection is off — no series were read or written` in the log and
   the DB unchanged.

## Two layout defects the driver caught, both measured and fixed

- **The `Removed Series` row read as pushed up.** Measured: **74px above the label, 116px below**
  — a **12dp overshoot**, because `CompactSettingsRow`'s `paddingVertical: 12` and
  `SettingsCard.content`'s `paddingBottom: 16` stack under the card's last child. Fixed with
  `marginBottom: -16` on the block, giving **61px / 60px — a 1px centring error** and matching
  the geometry `Library Folders`' rows already have (CollapsibleSettingsSection's content has no
  bottom padding). **This is a general trap for any `CompactSettingsRow` that ends a
  `SettingsCard`.**
- **The new hairline sat directly under the Detect button.** Driver raised
  `seriesDetectionOptions.paddingBottom` 4 → 14 (measured at 50px ≈ 14.3dp). Does not disturb the
  12/12 above, which is between the divider and the card edge.
- **The expansion popped rather than rolled.** Rebuilt on CollapsibleSettingsSection's exact
  pattern (measured absolutely-positioned child in a clipping wrapper, `withTiming` 300ms).
  Verified by frame analysis: **390px of growth over ~283ms with a decelerating ease curve**
  (+20,+20,+18,+18,+15,+15,+13,+13,+10,+10,+8,+7,+7,+4,+3,+2). One addition over the original:
  `pointerEvents` is gated on the expanded state, because clipped-but-live `Restore` buttons
  write to the database.
