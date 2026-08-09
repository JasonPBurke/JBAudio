# 10 — The browse row

**Blocked by:** [01](01-schema-v33.md), [08](08-series-backgrounds-setting.md).

**Status:** resolved — **all eight acceptance criteria met, 2026-08-09.** Device-verified on
four rigs across three widths and two densities, plus the driver's real 23-series library:
[`DEVICE-CHECK-10.md`](../DEVICE-CHECK-10.md). One finding logged for the driver: **§H10's
three-run cap is calibrated against a worst case real data exceeds** — see `## Answer`.

**Spec:** [§B](../../series-ux-redesign/spec.md) (all of it), §H, §I, §K12–K14.
This is the most-designed artifact in the effort — **fourteen variants across two passes**.
Build the winner; do not re-explore.

## What to build

The shelf that answers *"what do I listen to next?"* at a glance. One full-width row per
series: a fanned cover cluster you tap to play, and everything else you tap to open the
series.

Closes user stories 21–28 and 68–72.

## The row

Separated by an inset hairline rule matching the books list's separator, with a footer copy
so the list terminates on a line. ~140dp, ~4.5 series per screen. **It does not expand.**

1. **A fanned cover cluster**, max 3 layers, each layer's right edge a constant peek beyond
   the one in front, back layers shrunk and darkened per layer.
2. **A centred play glyph on the front cover.** One tap plays.
3. **A text column**: series name (2 lines, truncating) · meta line
   (`22 books · 7 finished · #1-22`) · completion bar with an `n/total` label · a next-up
   line with **three** states — `Next · #9 Eric` / `Continue · #9 Eric` / `Series complete`.

**Tapping anywhere else opens the series screen.** Two targets, two meanings.

## Rules that are load-bearing, not stylistic

- **B2 — cover geometry is square.** Tall art is pillarboxed over a fixed near-black, wide
  art is cropped evenly, and the cluster's width is **constant regardless of cover count or
  shape**. Both rules exist so the glyph aligns down the list and **every row's text column
  starts at the same x**.
- **B3 — the play affordance is never absent and never carries a word.** Its target is the
  next unfinished book, or the first book when the series is finished. The
  `Start`/`Continue`/`Restart` label cost ~27% of the row's width and caused four faults;
  the state is already carried twice (progress bar + next-up line), so the word is
  **redundant, not sacrificed**. The third next-up state is what makes that true.
- **B4 — the darkening is the GLYPH, never the artwork.** The glyph's own `fill` is the
  0.42 black; its stroke is a **fixed near-white**; there is **no scrim, disc or badge
  outside the play shape**. Every pixel of artwork outside the glyph is untouched. Both
  colours are **fixed, never theme-derived** — a palette-coloured glyph was this effort's
  first light-theme defect.
  *Two rejected predecessors, do not reintroduce:* a full-cover 42% scrim (turned a 22-row
  list into 22 identical buttons) and a 26dp disc (a smaller darkened patch is still a
  darkened patch).
- **B6 — row height is variable.** A 2-line title grows the row. The earlier
  "predictability over elasticity" ruling is **deliberately reversed**.
- **B8 — no provenance on browse.** An origin chip truncated the canonical range on 5 of 15
  series; a row cannot carry both at full width.

## Geometry — the cap and the scaling are different rules

- **H1/H2 — the row's *content* caps at `min(width, 600)dp`, left-anchored, and the cap is
  BROWSE-ROW ONLY.** It was applied to the series info page, built, looked at, and
  **reverted on sight**: the browse row bleeds paint the full width so a capped content
  block sits inside paint, while the info page has no full-bleed paint to absorb it and
  reads as content shoved into the left 600dp.
- **H3 — paint is never capped.** The backdrop and hairline still span the device. Capping
  them puts visible edges on the row and reads as the card that was measured and rejected.
  **Left-anchoring, not centring**, keeps the heaviest part of the scrim under the text.
- **H4 — cluster sizing scales, and it binds anything added later:**
  > **Every Series cover cluster is a fixed fraction of `min(width, 600)`, anchored on its
  > own 411dp value — never a literal.**
  This is a **verified no-op at 411dp**. Scaling one cluster and not the other **inverts the
  artwork hierarchy** — that happened, and the overview's fan ended up bigger than the
  detail's.
- **H5 — type is NEVER scaled with width.** Padding and the leading visual may scale; type
  may not.
- **H8 — multi-column is closed by arithmetic.** Portrait-locked → 800dp ceiling; two
  columns need ~822dp for phone parity. Do not reopen it.

## Font scale

- **H9 — the meta line drops `M finished` first.** It is the only redundant segment — the
  completion bar renders the same count directly beneath it — while the canonical range has
  no other home on browse. `6 books · 2 finished · #1…` becomes `6 books · #1-6`.
  **⚠ The prototype's font-scale threshold is a PROXY. Drop the segment when the line
  actually overflows — measure, do not infer (K14).**
- **H10 — the canonical range caps at THREE runs**, then an ellipsis. Three is **measured,
  not chosen**: `#1-4, 4.5, 5-8` is exactly what fitted at 411dp / font scale 2.0 behind a
  `9 books · ` prefix, which — with `M finished` dropping first — is the true worst case.
  The cap's job is to **cut at a run boundary**, which is why a character budget lost.
  Previously unbounded: an alternating 41-book series emitted ~70 characters.

## Acceptance criteria

- [x] The row is built as specified above, replacing the Series view's current presentation.
- [x] **Inline expansion is gone**, and with it the masonry list, every book cell and the
      nested-horizontal-list construct. **The books home and books grid are untouched —
      nothing forked, nothing modified.**
- [x] The row honours `Series Backgrounds` in both states.
- [x] Pure helpers are unit-tested: the canonical-range collapse **including the three-run
      cap**, the meta-line sacrifice order driven by an **overflow flag** not a font-scale
      proxy, the three next-up states, and the cluster-size rule as a function of width
      (**whose whole claim is that it is a no-op at 411dp**).
- [x] **K12 — completion is a COUNT.** The book progress value is a tri-state enum (0/1/2),
      not a fraction; averaging it renders "1 of 7 finished" as 50%.
- [x] **K13 — the fan's offset must outpace its shrink.** Equal rates right-align every
      layer, the front one occludes the rest, and a 22-book series draws as one lone cover.
- [x] **I7 — `Series complete` needs a named fix.** The shared `success` token measures
      **1.54:1** on the light background. It is a shipping-palette property, but this string
      is 08's own element, so it is in scope here.
- [x] Device-verified on `Pixel_7_Pro` (411dp), `Pixel_Tablet` (800dp) and `7_Tablet`
      (sw635dp @ 272dpi — **not** the 540dp its emulator config implies), at font scale 2.0,
      in **both themes**, with backgrounds ON and OFF, against the 15-series stress dataset.
- [x] `tsc` 0 errors · eslint 0 errors · jest green.

## Two claims that were made, refuted, and must not be re-raised

- **H12 — the backdrop is NOT a width defect.** The row's text legibility *improves* with
  width: the gradient is a fraction of width while the text ends at a fixed position, so
  the text's right end sits on rising opacity as the screen widens (0.59 → 0.86 → 0.92).
  **No tablet-specific backdrop adaptation.**
- **I4 — `PILLAR` (the fixed near-black behind pillarboxed art) stays as it is.** It
  measures 17.08:1 on a light row and a later session *will* re-measure that and report it
  as a defect. It is not one: **some covers ship their letterbox inside the JPEG** (one real
  cover is 1.20:1 from the app's own pillar — visually the same object) and others in
  different colours again, so **the value is not derivable**. Any constant is as defensible
  as any other. Pick on taste, not analysis — and it has been picked.

## Answer

Built. `SeriesHome` is now a plain vertical `FlashList<DerivedSeries>` of `SeriesBrowseRow`s
separated by an inset hairline that is also the footer, and the masonry list, the book cells,
the nested horizontal scroller and the inline-expansion state are all gone with it. Nothing
in the books home or books grid was opened.

**New files**

| File | What it owns |
| --- | --- |
| `src/helpers/seriesRange.ts` | the canonical-range collapse and `RANGE_RUN_CAP` (§H10) |
| `src/helpers/seriesRowGeometry.ts` | §H geometry, §B2's square constant-width box, K13's fan, and the K14 overflow predicate |
| `src/helpers/seriesRowFacts.ts` | the derived facts, the meta line's sacrifice, the three next-up states |
| `src/components/SeriesCoverCluster.tsx` | the fan and the centred glyph (§B3/§B4) |
| `src/components/SeriesBrowseRow.tsx` | the row |

**Changed:** `SeriesHome.tsx` (rewritten), `seriesAssembly.ts` and `seriesQueries.ts` (carry
`canonicalNumber` through so the range is index-aligned with the books), `tokens.ts`
(`successText`), and the prototype harness's registry to add the `Shipping` entry.

### Three things worth knowing before touching this again

**1. K14's overflow test is text INEQUALITY, and the two obvious alternatives are both
wrong.** Measured on device: Android reported a truncated line as
`"3 books · 1 finished · #…﻿﻿﻿﻿﻿"` at width 262.33 in a 272.51dp
column. It pads the ellipsis with U+FEFF so the string keeps the **same character count**
(a length test is blind), it draws the ellipsized line **narrower** than the column (a width
test is blind), and `numberOfLines={1}` caps the reported line count at 1 (a line-count test
is blind). The device payload is pinned as a regression test in
`seriesRowGeometry.test.ts`. Inequality also survives §H10's cap putting a real `…` inside
the string, which "contains an ellipsis" would not.

**2. The cluster is deliberately NOT deduped.** Feeding the fan a de-duplicated cover list
recreates K13's "one lone cover" for any series whose first three books share artwork.

**3. `successText` is a new token, not a re-point of `success`.** `colorTokens.shared` is
spread **over** `colorTokens[scheme]`, so anything in `shared` is unthemeable by
construction; I7 could not be fixed by editing `success`.

### Finding for the driver — §H10's cap is calibrated one size too small

§H10 fixes the cap at three runs by measuring `9 books · #1-4, 4.5, 5-8` at 411dp / fs 2.0
and calling it "the true worst case" once `M finished` drops first. The driver's real library
produces **`17 books · #1-3, 3.5, 4-12` — 26 characters against that string's 24**, because
the book count and the range's last number are both two-digit.

On device at fs 1.0 it renders complete with no trailing `…`, so the run cap never fires (it
is exactly three runs). At fs 2.0, after `3 finished` correctly drops, it still overflows and
Android cuts it **mid-token** at `4-1…` — which is precisely the failure §H10's run-boundary
cut exists to prevent, reached through a longer prefix rather than more runs.

**Not changed.** §H10 is an explicitly measured ruling and every remedy — a two-run cap, a
width-aware cap, or accepting the mid-token cut — is a design decision. Left for the driver.
