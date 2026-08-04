# 16 — Geometry stress: tablet width and font scale

Type: prototype
Status: open
Blocked by: 14, 15
Parent: [map.md](../map.md)

## Question

Every Series surface this map designed was chosen on a `Pixel_7_Pro` at default
font scale. Two stresses break them **the same way** — the text column grows and
the artwork does not — which is why they are one ticket rather than two:

- **Tablet width.** [08](08-browse-presentation.md)'s row is a **fixed 100.8dp
  cover cluster beside a `flex: 1` text column**, so a tablet spends *all* its
  extra width on text and none on covers: a very long line beside a very small
  picture. The 8.4dp peek, the 2-line name cap and the single-column list are all
  phone-shaped decisions.
- **Font scale.** The same `flex: 1` column absorbs it, but
  [08](08-browse-presentation.md) also made **row height variable on purpose**
  (reversing its own first-pass "predictability over elasticity" ruling), so
  large text has nothing structural stopping it. The name caps at 2 lines; the
  meta line, the completion bar and the three-state next-up line do not.

Surfaces in scope — all of them, because all were tuned at one size:

1. **The browse row** in **both** `Series Backgrounds` states
   ([12](12-series-display-setting.md)).
2. **The detail sheet** ([11](11-series-detail-contents.md),
   [13](13-detail-sheet-prototype.md)) — its hero, its 46dp row covers, and the
   grab-handle-only header. A `formSheet` on a tablet is a different animal.
3. **The editor** ([10](10-correction-surface.md)) — the 88dp cover, the
   per-row canonical-number field, `Sort by number`.
4. **Whatever 14 and 15 land**, which is why this is blocked on them.

## Specific things to check, not to re-derive

- **The square cover box is not negotiable.** 08 squared it so the glyph aligns
  and every row's text column starts at the same x; letting the front layer track
  the artwork's aspect is what misaligned it in the first place. A tablet answer
  that abandons the square box is answering a different question.
- **`normalizeSize` has form here.** It once treated an 800dp tablet as a huge
  Display Size and scaled everything 1.95×. Check what it does to the 100.8dp
  cluster before concluding the layout is wrong.
- **Does the list go multi-column on a tablet, or does the row get wider?**
  These are different products. `BooksGrid` has a `Number of Columns` setting;
  the Series list has none, and 12 recorded that `numColumns` has **no on-screen
  control anywhere in `src/`**.
- The three-state next-up line (`Next` / `Continue` / `Series complete`) and
  07's canonical range (`#1, 3-4, 8`) are the two strings most likely to
  overflow. 07 already flagged the range **needs a width cap or it eats the
  series name** — that cap has never been specified.

## Why prototype

Same argument as 08: overflow is measured, not inferred. The map's own gotcha
list says **measure, don't infer overflow**.

## Constraints

- **Two real tablet AVDs exist** (driver, 2026-08-04) — use them, not the
  `wm size` / `wm density` phone-simulation trick, which is on record but is now
  only a quick first look:
  - `Pixel_Tablet` — 10.95", Android 15, the large case.
  - `7_Tablet` — the small case, and the more interesting one: 7" is where a row
    is wide enough to look wrong but not wide enough to justify two columns.
  Both must pass; they are likely to want **different** answers to the
  multi-column question below, which is the point of testing both.
- `avdmanager` / `sdkmanager` on `PATH` are broken — use
  `$ANDROID_HOME/cmdline-tools/latest/bin/`.
- Prototypes are disposable; no jest/tsc/eslint bar.

## Definition of done

Each surface either passes at tablet width and at the largest supported font
scale, or has a named, specified adaptation. The canonical-range width cap gets
an actual number.
