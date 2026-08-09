# Ticket 10 — device check

**2026-08-09.** Branch `feature/series-styling`. Four devices, three widths, two densities,
plus the driver's real library. Screenshots `device-check/tk10-*.png`.

**All acceptance criteria are closed.** One finding is logged for the driver at the bottom:
**§H10's three-run cap was calibrated against a worst case that a real 17-book series
exceeds.** The implementation matches the spec; it is the spec's calibration that assumed
single digits. Nothing was re-tuned — that call is the driver's.

## The rigs

| Device | Serial | Window | Density | Data |
| --- | --- | --- | --- | --- |
| `Pixel_7_Pro` emulator | `emulator-5554` | 411dp | 560dpi (3.5×) | stress ×15 |
| `Pixel_Tablet` emulator | `emulator-5556` | 800dp | 320dpi (2.0×) | stress ×15 |
| `7_Tablet` emulator | `emulator-5558` | **635.3dp** | 272dpi (**1.7×**) | stress ×15 |
| **physical Pixel 7 Pro** | `29131FDH3009SZ` | 411.4dp | 560dpi (3.5×) | **real library, 23 series** |

`7_Tablet` reports `1080x1920` with an **override** density of 272 → `1080 / 1.7 = 635.3dp`,
confirming the ticket's warning that its emulator config implies 540dp and is wrong. It is
also the only rig at a non-integer density, which is what makes it worth booting: it is the
one that would expose geometry accidentally anchored to pixels rather than dp.

The shipping row is reached through the prototype harness's `Shipping` variant. That entry
renders `SeriesHome` itself with no prototype in the path — it exists only because the
15-series stress dataset lives in the harness and this ticket's criteria are written against
it. On the physical device the data preset is `Real DB`, so that pass is production code on
production data.

## The criteria

| Criterion | Result |
| --- | --- |
| row built as specified, replacing the Series view's presentation | Fanned cluster + centred glyph + name / meta / bar / next-up, on all four rigs ✅ |
| **inline expansion gone**; masonry, book cells, nested horizontal list gone; books home/grid untouched | `SeriesHome` is a plain vertical `FlashList<DerivedSeries>`. No expansion state, no book cells, no inner scroller. `BooksHome`/`BooksGrid` not opened ✅ |
| honours `Series Backgrounds` in both states | Verified ON and OFF on all three widths, both themes. **Geometry is byte-identical between the two states** — separator inset 173.0dp ON and OFF at 800dp — so the setting governs paint only ✅ |
| pure helpers unit-tested (range collapse **incl. three-run cap**, sacrifice order via an **overflow flag**, three next-up states, cluster size as f(width) **no-op at 411dp**) | 4 suites, 55 tests. The overflow test is built from a verbatim on-device `onTextLayout` payload ✅ |
| **K12 — completion is a COUNT** | `10/22`, `3/17`, `1/6`, `4/4`, `5/5` — never a percentage. A 22-book series with 10 finished renders `10/22`, not 45% ✅ |
| **K13 — offset outpaces shrink** | Three layers, each right edge a constant peek beyond the one in front, back layers shrunk and darkened. A 22-book *and* a 41-book series both draw three distinct layers, not one lone cover ✅ |
| **I7 — `Series complete` named fix** | `successText`: `#1B5E20` light / `#8BD649` dark. **6.83:1** on the flat light background against the shared token's **1.54:1** — the ticket's own figure, reproduced from device pixels ✅ |
| device-verified 411 / 800 / 635dp, fs 2.0, both themes, backgrounds ON+OFF, stress ×15 | 17 captures ✅ |
| `tsc` 0 errors · eslint 0 errors · jest green | 0 · 0 errors (38 warnings, **all pre-existing; none in a file this ticket added or touched**) · **46 suites / 542 tests** ✅ |

## Geometry, measured off the screenshots

The separator's left inset is `screenPadding.horizontal + coverClusterWidth + TEXT_GAP`,
so measuring it measures the cluster. Predicted vs measured:

| Width | Predicted inset | Measured | ⇒ implied cluster |
| --- | --- | --- | --- |
| 411.4dp (physical, 3.5×) | 126.8dp | 443–444px = **126.6–126.9dp** | **83.96dp** |
| 635.3dp (1.7×) | 173.12dp | 293–294px = **172.4–172.9dp** | ~122.4dp |
| 800dp (2.0×) | 173.12dp | 345–346px = **172.5–173.0dp** | ~122.5dp |

**§H4's "verified no-op at 411dp" is confirmed on real hardware**: the rule reproduces
83.96dp where the literal was 84. And the same rule yields the same ~122.5dp at 635dp and
800dp — both past the 600dp cap — landing on 293px and 345px respectively. Identical dp,
different pixel grids: the geometry is dp-anchored, not pixel-anchored.

### §H1 content cap vs §H3 uncapped paint

| Width | Content right edge | Paint right edge |
| --- | --- | --- |
| 800dp, fs 1.0 | **587.0dp** | 1599px = screen edge |
| 800dp, fs 2.0 | **586.5dp** | screen edge |
| 635dp, fs 2.0 | **586.5dp** | 1079px = 634.7dp = screen edge |
| 411dp | n/a (below the cap) | 1439px = 411.1dp = screen edge |

Predicted content edge is 588dp; the measured 586.5–587.0dp is the last *inked* pixel of the
`n/total` label, naturally ~1dp inside its box. **The cap does not move with font scale**
(587.0 → 586.5 from fs 1.0 to fs 2.0), which is §H5: type scales, the content box does not.

The cleanest proof that paint is uncapped is a differential at a pixel *past* the cap:

| Rig | Sample point | Backgrounds ON | Backgrounds OFF |
| --- | --- | --- | --- |
| 800dp | x = 750dp | `#9C9A9A` (cover art) | `#ECEFF4` (flat token) |
| 635dp | x = 617.6dp | `#B79493` (cover art) | `#ECEFF4` (flat token) |

## K14 / §H9 — the overflow flag is not a font-scale proxy

The load-bearing evidence is that **the same string at the same font scale behaves
differently by width**:

| Rig | fs | Meta line as rendered |
| --- | --- | --- |
| 411dp emulator | 2.0 | `3 books · 1 finished · #1, 3-4` → **`3 books · #1, 3-4`** (drop fires) |
| 411dp **real** | 1.0 | `17 books · 3 finished · #1-3, 3.5, 4-12` (fits, no drop) |
| 411dp **real** | 2.0 | **`17 books · #1-3, 3.5, 4-1…`** (drop fires) |
| 800dp | 2.0 | `22 books · 10 finished · #1-22` — **tally KEPT**, line measures 497.5dp in a 588dp column |
| 635dp | 2.0 | `22 books · 2 finished · #1-22` — **tally KEPT** |

A `fontScale >= 1.5` proxy would have dropped the tally on both tablets, discarding
information with 90dp of slack to spare. Only a real measurement produces this table.

The drop is safe precisely because of **K12**: the segment removed (`3 finished`) is
restated verbatim by the bar's label (`3/17`) directly beneath it. That is §H9's stated
justification, and on device the two are visible in the same row.

The detection of overflow is text **inequality** after stripping zero-width padding. The
three intuitive alternatives were all measured wrong on device (recorded in
`seriesRowGeometry.ts` and pinned as a regression test): Android pads the ellipsis with
U+FEFF so the reported string keeps the source's character count, the ellipsized line is
drawn *narrower* than its column, and `numberOfLines={1}` caps the reported line count at 1.

## I7 — `Series complete`, measured against composited pixels

`successText` was added per-scheme because `colorTokens.shared` is spread **over** the
per-scheme bag, making the shared `success` token unthemeable by construction.

| Background | `successText` | shared `success` |
| --- | --- | --- |
| flat light `#ECEFF4` | **6.83:1** | **1.54:1** ← the ticket's figure |
| 800dp, backdrop showing through | 5.19:1 | 1.17:1 |
| 635dp, photographic backdrop | 6.32:1 | 1.43:1 |
| **411dp real, vivid "We Are Legion" cover** — 5th pct / median | **4.71:1** / 6.43:1 | 1.06:1 / 1.45:1 |

The last row is the hardest real case in the driver's library and still clears AA at the
5th percentile of the background behind the string. On dark the bar and text measure
`#8BD649` — deliberately identical to shared `success`, since dark was never the defect.

## Everything else that was checked on screen

- **§B2** — a tall cover is pillarboxed inside a square box over the fixed near-black
  (`tk10-635dp-06`), and every row's text column starts at the same x regardless of how many
  covers the series has: the separator inset is constant row to row.
- **§B3/§B4** — the glyph is present on every row, carries no word, and is a white stroke
  **plus** a 42% black fill with no scrim, disc or badge. The zoom shows why both are needed:
  on the Sherlock cover the stroke carries it over the dark half and the fill carries it over
  the white half.
- **§B6** — a 2-line name grows the row: the 95-character `The Chronicles of Amber…` at 800dp,
  and `Cerulean Chronicles` at 411dp / fs 2.0.
- **three next-up states** — `Next · #1 …` and `Series complete` in this session;
  `Continue · #9 …` was verified at 411dp in the prior session by watching a row flip live
  from `Next ·` to `Continue ·` when its book became Started.
- **the range collapse on real data** — `#1-3, 3.5, 4-12` from the driver's library exercises
  all three rules at once: integers collapse, a decimal refuses to join an integer run, and
  it sits at exactly `RANGE_RUN_CAP` so nothing is elided.
- **the completion bar's two colours** — `primary` while partial, `successText` when
  complete. Confirmed on the amber-accent rig, where partial bars are amber and the complete
  one is green.

## Findings

### 1. §H10's three-run cap is calibrated against a worst case real data exceeds

§H10 states the cap's job is to **cut at a run boundary**, "which is why a character budget
lost", and fixes three runs by measuring `9 books · #1-4, 4.5, 5-8` at 411dp / fs 2.0 —
"which, with `M finished` dropping first, is the true worst case".

The driver's library produces `17 books · #1-3, 3.5, 4-12`: **26 characters against that
string's 24**, because both the book count and the range's final number are two-digit. At
fs 1.0 it renders complete with no trailing `…`, proving the run cap never fired (it is
exactly three runs). At fs 2.0, after `3 finished` is correctly dropped, it still overflows
and Android cuts it **mid-token** at `4-1…`.

So the failure mode §H10 exists to prevent does occur on real data — triggered not by too
many runs but by a longer **prefix** than was measured. The implementation does exactly what
§H9 and §H10 specify; the calibration assumed single digits.

Not fixed here. §H10 is an explicitly measured, closed ruling and the remedies (a smaller
cap, a width-aware cap, or accepting the mid-token cut) are design choices, not
implementation details. Logged for the driver.

### 2. Harness artifact — `progressState` can contradict the shipping row

The synthetic specs carry a **forced** `progressState` label ("the pool's real progress can't
cover all three"), while the shipping row derives completion from each book's real
`bookProgressValue`. On synthetic data the two can disagree — `Foundation` is labelled
`finished` yet renders `0/5` when the pooled books are unplayed. For real series the label is
derived from the books, so they agree. **This is the harness's inconsistency, not a
regression in the row**, and it is recorded here so a later session does not read it as one.

## Device state after the check

Font scale restored to `1.0` on all four devices. Left for the driver to restore in-app:
`Series Backgrounds` back **ON** on `emulator-5554`, `emulator-5556`, `emulator-5558` and the
physical device, and the physical device back to **dark** theme. On the physical device the
driver marked `Bobiverse` finished and three books of `Demon Accords` finished in order to
produce the completion states — real listening progress, reverse if unwanted.
