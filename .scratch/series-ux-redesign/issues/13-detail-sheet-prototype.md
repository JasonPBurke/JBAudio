# 13 — Build the detail sheet: does a push over a live sheet survive?

Type: prototype
Status: open
Blocked by: 11
Parent: [map.md](../map.md)

## Question

[11](11-series-detail-contents.md) decided the series detail screen's contents
in full, but resolved **without building anything** — and one of its decisions
is explicitly conditional:

> Driver, 2026-08-04: **"(A) with a prototype check"**, and **"(C) as a backup."**

**Does an opaque `slide_from_right` push over a live `formSheet` behave on
Android — or does the editor have to move out of the `series` group?**

Secondary, and only answerable by thumb: **do 41 tappable rows need a visible
play glyph?**

## Why the existing harness cannot answer this

[04](04-prototype-harness.md)'s harness renders `ProtoSeriesDetail` inside a
`Modal`, which 08 and 10 both flagged as a fidelity caveat. A `Modal` is not the
navigator, so it says nothing about presentation. This is **the first question on
this map that needs real routes** — and per the map's own note, navigator
`screenOptions` changes do not apply via fast refresh, so every tweak costs a
full JS reload.

## What to build

1. **A real route** `src/app/seriesDetail.tsx` plus a `Stack.Screen` in
   `src/app/_layout.tsx` with `presentation: 'formSheet'`,
   `sheetShouldOverflowTopInset: true`, `sheetCornerRadius: 15` — matching
   `titleDetails` (`_layout.tsx:242-249`). Comment it as throwaway; this is the
   only real-code footprint, and 04's precedent is three commented lines.
2. **Port `ProtoSeriesDetail`** onto it: grab handle only (no nav row, no ⋮),
   scrimmed backdrop behind the hero, front card driven by a **synthetic**
   pinned override — `series.artwork` does not exist yet and the harness writes
   nothing to the DB.
3. **A harness toggle standing in for `Series Backgrounds`**, so the hero's
   ON/OFF states can be compared side by side.
4. **Wire the wrench row to the REAL editor** (`series/edit/[id]`), not
   `ProtoSeriesEdit`. This is the whole point — it exercises the sheet→push
   transition *and* proves `Save`'s `exitGroup()` lands back on the sheet.
5. **Rows play for real** via `handleBookPlay`, with restart-from-zero on
   finished rows and `LoaderKitView` bars on the active one.
6. **The pin caption** on `ProtoSeriesEdit` — both states, revert nulls the
   override.

## What resolves this ticket

- **(A) confirmed or (C) adopted.** If the push flickers, drops the sheet, or
  reads wrong, move `series/edit/[id]` out of the group to a root
  `transparentModal` matching `editTitleDetails` — and re-check
  `seriesDraftStore`'s reset-on-group-entry lifetime, which the group boundary
  currently owns.
- **A ruling on the row play glyph.**

## Constraints

- **`Delete`'s exit is broken by 11 and this prototype will show it**:
  `handleDelete` → `exitGroup()` (`edit/[id].tsx:182`) pops the group and reveals
  the detail sheet of a deleted series. `ProtoSeriesDetail` returns `null` on a
  missing series, so it is a blank sheet. Fixing it is the build effort's; seeing
  it is this ticket's.
- **08's theme-coupling trap**: the hero's scrim is painted by the component, so
  anything on it must be coloured against that surface, not the palette.
- The emulator's series set is volatile — screenshot first, then script taps.
  `adb shell dumpsys window | grep mCurrentFocus` before driving the UI; `pidof`
  does not prove foreground.

## Answer

_(unresolved)_
