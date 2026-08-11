# Device check — ticket 14, canonical numbers, `Sort by number`, bulk numbering

**2026-08-11 · physical device (Pixel 7 Pro, `29131FDH3009SZ`, 1440×3120, density 560, 411dp)**
Build: the working tree at the time of the check (uncommitted), Metro reload — this ticket is
JS-only, so no native rebuild was needed.

**Result: PASS, after FOUR defects were found on device, fixed, and re-verified in the same
session.** Every one was invisible to jest; two were invisible to the screenshot measuring rig
as well, and one was spotted by the driver's eye alone — see *What the tooling could not see*,
which is the part of this document worth reading twice.

Three of the four were found at font scale 2.0 or in the light theme, which is the whole
argument for this project's stress matrix: at 1.0 in dark, everything passed.

Driver drove the device; the agent collected and measured. Shots in `device-check/tk14/`.

## Evidence

| shot | what it shows |
| --- | --- |
| `tk14-01-dark-fs1-empty.png` | fresh create, boxes empty, `Number 1–6` + disabled sort |
| `tk14-02-dark-fs1-save-disabled.png` | **K15's originally-filed instance** — disabled `Save` |
| `tk14-03-dark-fs1-bulk-numbered.png` | after `Number 1–6` — boxes `1..n`, slot empty |
| `tk14-04-dark-fs1-partly-numbered.png` | note state, `Books left blank sort to the end.` |
| `tk14-05a-dark-fs1-after-drag.png` | **D3** — drag did not disturb the numbers |
| `tk14-05b-dark-fs1-after-sort.png` | **D4** — NULLS LAST, stable tail |
| `tk14-06-dark-fs1-decimal-sorted.png` | `4.5` and `10` sorted numerically |
| `tk14-07-dark-fs1-detail-sheet.png` | badges + `6 books · #1-4, 4.5, 10` (createSeries) |
| `tk14-07b-dark-fs1-after-update.png` | **updateSeries**, reposition + renumber in one save |
| `tk14-08-light-fs1-empty.png` | light, sort row |
| `tk14-09-light-fs1-save-disabled.png` | light disabled `Save` |
| `tk14-10-light-fs2-editor.png` | **defect 2** — `Number..` truncated at font scale 2.0 |
| `tk14-11-light-fs2-decimal.png` | **defect 1** — `4.5` clipped in the 46dp box |
| `tk14-R1-light-fs2-12dot5.png` | fix 1 — `12.5` fits the widened box |
| `tk14-R2-light-fs2-cleared.png` | fix 2 + 3 — full label, receded disabled label |
| `tk14-R3-dark-fs1-cleared.png` | fix 3 in dark, the theme where it was worst |
| `tk14-R4a/b-dark-fs1-*.png` | decision 1 re-verified after the style change |

Defect 4 (the caret) was confirmed fixed on device by the driver; no separate shot.

## What passed first time

- **D3** — `2012 - Railsea` dragged to row 1 kept its blank box while `Lessons in Chemistry`
  sat in row 2 still holding `1`. Numbers travel with their book, not their slot.
- **D4** — sorted to `1, 2, 3, 4, #, #` with **Railsea before Contact**. That is stability
  against the *arrival* order (Railsea was index 0 after the drag, Contact index 5), not the
  pre-drag order, which would have produced `Contact, Railsea`. Both look equally plausible on
  screen; only a device run distinguishes them.
- **Numeric, not lexicographic** — `4.5` files between `4` and `10`, not `1, 10, 2`.
- **D5 gate** — `Number 1–6` present only while nothing is numbered, gone the instant a number
  exists.
- **E7** — a create with untouched boxes saved `1..n` from final drag order.
- **§H10 range collapse on real user input** — `6 books · #1-4, 4.5, 10`, then
  `#0.5, 1-4, 4.5` after the edit. Run collapsed, decimals held out.
- **updateSeries' merged per-row update** — `Railsea` was repositioned 6→1 **and** renumbered
  10→0.5 in one save. No `Cannot update a record with pending changes`, logcat clean. That is
  the row a two-loop implementation crashes on.
- **D10** — the hero cover and backdrop followed the reorder to Railsea's placeholder.
  Specified behaviour, now witnessed.
- **Ticket 15 decision 1** — `Sort by number` bounding box `x 901–1397` **identical** across
  slot-full/slot-empty *and* across enablement; the like-for-like diff is **0 differing
  pixels**, reproducing 15's own measurement.
- **Ticket 15 decision 2** — trash badge at the card's top-left with its own scrim, in
  `textMuted`. Titles gained real width.

## Defect 1 — `4.5` clipped in the number box at font scale 2.0

The box was a fixed `width: 46` while its contents scale with the OS font scale. At 2× the
`4`'s upper-left diagonal terminated in a flat vertical edge instead of a point.

**Fix:** `numberFieldWidth(fontScale)` in `src/helpers/seriesEditorGeometry.ts` — the box grows
with the scale, capped at 2×. Scaling the BOX rather than capping the TEXT is deliberate: a
user who raised their font scale did so to read text, so the number is the last thing that
should stay small. The title absorbs it, and it is already truncating at 2×.

**Re-verified:** box 328px ≈ 93dp, `12.5` (the four-character realistic worst case — a 41-book
Discworld with a 12.5 novella) sits with **19dp clearance left, 11dp right**.

## Defect 2 — `Number 1–6` truncated to `Number..` at font scale 2.0

The count *is* the label's content — it is what tells you what pressing the button will do — so
the truncation left a control that explains nothing, on the surface a user meets before they
understand the feature.

**Fix:** `sortRowIsStacked(fontScale)` — at ≥1.5 each control takes its own line, the sort
button staying right-aligned on its line. This does **not** weaken decision 1, which forbids
the button moving when the *note's content* changes; the `flex: 1` slot still guarantees that
at every scale, and re-verified at 0 differing pixels after the change.

## Defect 3 — the disabled label out-shouted the enabled one, in BOTH themes

⚠ **K15 was filed as dark-theme-only. It is not, and the second half is the opposite defect
from the first.**

| | dark | light |
| --- | --- | --- |
| disabled `Sort by number`, **before** | **12.57:1** | **6.14:1** |
| body text on the same surface | 12.62:1 | 6.56:1 |
| disabled `Sort by number`, **after** | **4.72:1** (`#83878d`) | **4.61:1** (`#636c79`) |

The original K15 was *invisible* (label drawn in its own background). My first fix cured that
and overshot: `textMuted` is `#d8dee9` in the dark palette — essentially white — so the
disabled control became the **brightest thing in the row**, brighter than body text, and read
as active. The filled `Save` escaped this because its grey fill signals "off" independently;
a bare text control has only its label.

**⚠ THE INVARIANT IS DELIBERATELY NOT "recedes relative to the ENABLED colour."** The driver
ruled on 2026-08-11 that **the accent is user-settable and can also be derived from cover
art**, so it is a free variable. A test or an implementation aimed at `primary` would pin a
relationship to a value the user controls and would fail on somebody's cover-derived palette
rather than on a real regression. Both bounds are stated against **fixed tokens**:

- **floor** — clears AA against its own surface, so K15 cannot return;
- **ceiling** — sits below **body text** on that surface, so it reads as off whatever the
  accent is doing.

`disabledTextColor()` walks the blend toward the surface and stops at the last step clearing
the floor: the most recessive colour the floor allows.

**The filled-button half of K15 is fixed and needed no revision:** `Save` measures **6.47:1
dark / 5.43:1 light** against a computed 6.49 / 5.54.

## What the tooling could not see

Worth recording, because it changes what a screenshot rig can be trusted for.

1. **The clipped `4` was found by the driver's eye, not by measurement.** The rig measures
   colour clusters and bounding boxes; a clipped glyph has the same colours and nearly the
   same extent as an intact one. **Only the shape differs, and shape was exactly what the rig
   did not encode.** Do not use cluster/extent measurement to answer a clipping question.
2. **Quantisation under-reported a contrast ratio.** The 12-step colour bucketing pulled the
   antialiased glyph sample toward the background and reported the light disabled label at
   **4.26:1** when the true glyph core is `#636c79` at **4.61:1**. Sample the modal non-background
   colour at full precision before reporting a number near a threshold.
3. **jest asserted a floor with no ceiling.** `readability(label, fill) >= 4.5` passed at
   12.57:1 — the defect *was* excess legibility. A one-sided assertion cannot see the far side.
   The test now pins both bounds.

## Defect 4 — text fields had a default-blue caret

**Driver-spotted.** Every other editable field in the app tints its caret and selection with
the accent — `editTitleDetails`' seven fields and, in the `withOpacity(primary, 0.56)`
variant, `SearchBar` and `coverArtSearch`. The series editor had it on **neither** field.

**Fix:** `cursorColor` + `selectionColor` on both, using the plain-`primary` form-field
variant rather than the search variant. The **series name field predates this ticket**
(ticket 12 built it) and was fixed here too, rather than leaving one field on the screen with
a default-blue caret beside an accent-coloured one.

## Found, not fixed, and not this ticket's

**§I7 gains one new instance.** `Number 1–6` uses `primary` as text, measured **1.43:1** on the
light background — the same failure §I7 already tabulates for `Next`, `+ Add books` and the tab
pill (it records 1.53:1; the gap is quantisation). §I7 ruled this a shipping-palette property,
and the driver confirmed on 2026-08-11 that a **whole-app colour pass is coming on its own
branch**, because a user-settable / cover-derived accent cannot be corrected per-surface.
**No per-surface workaround was applied.** Hand this to that branch alongside the existing
three.

Also worth noting: §I7 predicted `primary` would be *masked* on the test device by auto-accent
resolving to a dark blue. **It was not masked here** — the raw shipping amber was measured, so
this device sees the real default.

## Bars

`tsc` 0 errors · eslint 0 errors (35 pre-existing warnings, none in a changed file) ·
jest **620 passed** (594 before this ticket; +26).
