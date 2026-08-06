# 16 — Geometry stress: tablet width and font scale

Type: prototype
Status: resolved — 2026-08-05. **Content caps at `min(width, 600)dp`, cluster 24.5% of the cap, type never scales.** See `## Answer`.
Blocked by: 14, 15 (both resolved)
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

## Answer

**Resolved 2026-08-05. The BROWSE ROW's content caps at `min(width, 600)dp`,
left-aligned, with the cover cluster held at a constant 24.5% of that cap. Type
never scales with width. Built and verified on the phone and BOTH tablets.**

*(The cap was initially applied to the series info page too and reverted on
sight — see the correction at the end. Cluster SIZING still scales on both.)*

### The rule, in one sentence

`CONTENT_CAP = 600` (`seriesCardParts.tsx`) — Android's **sw600dp breakpoint**:
Series content never grows past the width at which the platform stops calling
the device a phone. The cover size is `CLUSTER_SIZE / 411` of the cap, which
**reproduces today's 84dp cover and 100.8dp cluster EXACTLY at 411dp**, so the
rule is a *no-op on a phone* — verified bit-for-bit against a pre-change capture.
At the cap it yields a 122.6dp cover / **147dp cluster**.

### What was measured, on three real widths

The app is **portrait-locked** (`app.json:6`, `AndroidManifest.xml:26`), so the
only reachable widths are **411 / 635 / 800dp**. `Pixel_Tablet` runs 800×1280dp;
`7_Tablet` runs **sw635dp at 272dpi** — *not* the 540dp its `config.ini` density
implies, so **both tablets are ≥ sw600dp** and `normalizeSize` is an identity
function on each. It does not matter anyway: **no Series surface calls
`normalizeSize`** (only `player.tsx`, `PlayerArtwork`, `DismissIndicator`,
`artworkSizing` do), so the 100.8dp cluster was a bare literal on every device.

| width | text column | longest fixed line | cluster share |
| --- | --- | --- | --- |
| 411dp | 272dp | 247dp | 24.5% |
| 635dp | 488dp | 247dp | 15.9% |
| 800dp | 618dp | 247dp | **7.9%** |

**Font scale 2.0**: the phone's row goes 141dp → **265dp (+88%)**, density
4.5 → 2.8 rows, and the meta line truncates. The tablet's row goes 141 → 212dp
(+50%) and **nothing truncates at all** — the extra width absorbs it. So the two
stresses do *not* break the row the same way, which is what this ticket assumed:
**width is a proportion problem, font scale is an overflow problem, and they
have different fixes.**

### MULTI-COLUMN IS CLOSED BY ARITHMETIC, not by taste

Each column needs `127 + 247 ≈ 411dp` for phone parity, so two need **~822dp**
and the portrait lock caps the device at 800dp. Two columns at 800dp would give
305dp each — **narrower than a phone**, truncating more than the phone does. The
ticket's "does the list go multi-column, or does the row get wider? these are
different products" question therefore has no live branch: **single column is a
consequence.** It reopens only if the portrait lock is lifted.

### THE BACKDROP IS NOT A DEFECT — claim withdrawn

This session first reported the hero backdrop as "the only thing that actively
breaks". **That was wrong and the driver refuted it.** The backdrop is
`cover`-fitted from a 500×500 source into a `width × rowHeight` box, so a wider
row shows a *narrower, more magnified* band (0.82× at 411dp → 1.6× at 800dp) and
cover lettering can become legible. But:

- **Legibility of the row's own text IMPROVES with width.** The gradient is a
  fraction of width (`1 → 0.92 → 0.55` at `0 / 0.45 / 1`) while the text ends at
  a fixed ~364dp, so the text's right end sits on **0.59** opacity at 411dp,
  **0.86** at 635dp, **0.92** at 800dp. The bright region is the part with
  nothing on it.
- Whether the visible band is busy is **a property of the cover**, and the user
  already has two shipped correction paths — `Series Backgrounds` OFF ([12]) and
  the series artwork override with cover-art search ([11]/[12]).

**No tablet-specific backdrop adaptation. Do not re-raise this.**

### The four rulings

1. **Cap + grow the cluster together**, not one or the other. Measured: capping
   alone leaves the artwork at 17% of the content; growing the cluster alone
   leaves 57% of the text column unreached. Only the pair restores the phone's
   proportions.
2. **PAINT STAYS FULL-BLEED.** The backdrop and the hairline rule still span the
   device; only the content inside them stops growing, and it stays **LEFT**-
   anchored rather than centred. Both halves matter: full-bleed keeps 08's
   no-card ruling literally true (a capped painted band has visible edges and
   reads as the card 08 measured and rejected), and left-anchoring keeps the
   heaviest scrim under the text, where `BlendSeriesHome.tsx` records it was
   deliberately put after `Rich header` had every title fighting its own cover.
3. **TYPE IS NEVER SCALED WITH WIDTH.** Material 3 and Apple HIG both hold the
   type scale constant across window size classes; scaling it also collides with
   a lever the user has already set globally. And this repo has paid for it once:
   `normalizeSize.ts:49-62` documents a width-derived multiplier pushing the
   player's controls under the navigation bar. **Padding and the leading visual
   may scale; type may not.** (Driver raised this directly — it is the one
   convention question this ticket had to answer from outside the codebase.)
4. **Scope: the browse row. The wizard is exempt, and the info page's cap was
   later reverted — see the correction below.** Driver ruling:
   the book picker's radio and the order screen's drag grabber are **targets**
   that want a predictable screen edge — *"the grabber needs to [be] all the way
   right so the user can comfortably grab it"*. The info page's finished ✓ is an
   **indicator**, so it may travel, and the driver asked for it pushed to the
   title: `rowText` went `flex: 1` → **`flexShrink: 1`**, parking the tick
   immediately after the title instead of 416dp away at the screen edge.

### Font scale: the meta line's sacrifice order

`N books · M finished · #range` is one single-line `Text`, so the range — being
last — was always the casualty: `6 books · 2 finished · #1…`. **`M finished`
now goes first**, because it is the only redundant segment (`CompletionBar`
renders `2/6` directly beneath it) while the range has no other home on browse.
08 had already designated the lever, recording `seriesCountLine` as *"the lever
if that reverses"* when the tally was restored on 2026-08-03 — this is that
reversal, and the helper needed no new code.

Verified on device: `City Watch` at 411dp / fs 2.0 now reads **`6 books · #1-6`**
where it read `6 books · 2 finished · #1…`.

**The prototype's trigger is `fontScale >= 1.3`, and that is a PROXY.** The
shipping rule must drop the segment when the line actually overflows — the map's
own *measure, don't infer overflow* gotcha.

### The canonical-range cap: THREE RUNS

`collapseNumberRange` (`syntheticSeries.ts:292`) had **no cap of any kind** — a
user owning alternating volumes of a 41-book series emitted ~70 characters.
`RANGE_RUN_CAP = 3`, then `…`.

**Three is measured, not chosen**: `#1-4, 4.5, 5-8` is three runs and is exactly
what fitted on device at 411dp / font scale 2.0 behind a `9 books · ` prefix —
which, with `M finished` now dropping first, is the true worst case. Every wider
or smaller-font configuration has room to spare.

**07's stated reason for the cap is DEAD.** 07 said the range *"needs a width cap
or it eats the series name"*; 08 then moved it off the title line onto the meta
line, where it can only ever eat itself. What the cap actually has to do is
**cut at a run boundary rather than mid-number** — which is also why a character
budget was rejected.

### Surfaces that passed with no change

- **[14]'s `titleDetails` subheading.** Clean at font scale 2.0. The
  `marginTop: -17` that 14 flagged as load-bearing is **scale-invariant**,
  because the `gap: 20` it cancels is a fixed dp that does not scale either.
  Do not re-check this.
- **Browse-row name truncation.** Driver ruled it intended (*"the 'chronicles
  of..' title was intentionally created as a long string"*), with the info page's
  **tap-to-expand** as the escape hatch — real and built,
  `ProtoSeriesDetailSheet.tsx:144-152`, `numberOfLines` dropped entirely at :340.
  A consequence worth keeping anyway: at the 600dp cap the Amber title now fits
  fully on two lines where the phone truncates it.

### Observed, OUT OF SCOPE — two follow-ups for the book screens

Two **shipping** defects at font scale 2.0, neither a Series surface, both
**driver-confirmed as real** and carried as follow-up notes:

1. **The library search field clips its placeholder vertically.** Fixed-height
   field, scaled text; the top of `Search books, authors…` is cut by the tab
   strip above it.
2. **`titleDetails`' info card clips its labels** — `Releas`, `Chapte`. Same
   cause: a fixed-height card holding text that scales.

Both are visible without any of this map's work. Recorded on the map's
*Out of scope* section and in project memory, since `.scratch/` lives only on
`feature/series-styling`.

### Addendum — the hero cluster scales too (driver, same day)

**Caught by the driver immediately after the above was written, and fixed here
rather than deferred to build, because this ticket caused it.** Scaling the
browse row's cluster while leaving `HERO_CLUSTER` a literal `104` **inverted a
hierarchy that had been correct**: on a phone the hero fan (124.8dp) is
deliberately larger than the browse fan (100.8dp), but at the 600dp cap the
browse fan reached 147dp and the hero stayed at 124.8dp — the *overview's*
artwork ended up bigger than the *detail's*.

`heroClusterSize()` applies the same rule with the hero's own anchor,
`HERO_CLUSTER / 411`, giving 151.9dp at the cap for a **182dp cluster**. The
1.24× lead is therefore preserved at every width and the phone is again
untouched. Verified on the Pixel Tablet.

**The general form of the rule, for the spec:** every Series cluster is a fixed
fraction of `min(width, CONTENT_CAP)`, anchored on its own 411dp value. Adding a
fourth cluster anywhere means picking its phone size and dividing by 411 — never
a literal.

### CORRECTION — the info page is NOT capped after all

The cap was applied to the info page as ruled above, **built, looked at, and
reverted on sight** (driver, 2026-08-05): *"the entire page's content is now
restricted. before this change, all the content filled the width."*

**The cap lands differently on the two surfaces, and that is the finding.** The
browse row bleeds its backdrop and hairline the full width, so a capped content
block sits inside paint and the cap is nearly invisible. The info page has **no
full-bleed paint to absorb it**, so the same rule reads as content shoved into
the left 600dp with a bare band beside it. A rule that is invisible on one
surface is conspicuous on the other.

Nothing was lost by reverting, because **the cap was never what fixed the
defect**: the 416dp gulf between a title and its ✓ is closed by
`rowText: flexShrink` alone, at any width. The cap was an addition on top of it.

**So the scope narrows to: `CONTENT_CAP` applies to the BROWSE ROW ONLY.** The
info page keeps two of this ticket's changes — the `flexShrink` tick and the
scaled hero cluster — and otherwise fills the width exactly as it did.
`heroClusterSize()` still clamps at `CONTENT_CAP` so the hero and browse fans
stay in proportion; that is a size rule, not a layout cap.

### Cost

**Zero schema.** Prototype changes only: `seriesCardParts.tsx` (the shared
`CONTENT_CAP`), `variants/BlendSeriesHome.tsx` (`useRowGeometry`, the meta-line
lever), `ProtoSeriesDetailSheet.tsx` (row cap + `flexShrink`),
`syntheticSeries.ts` (`RANGE_RUN_CAP`). tsc 0 / eslint 0.

### Harness note for later sessions

Neither tablet had a usable build. Both needed the current
`android/app/build/outputs/apk/debug/app-debug.apk` installed with `-r -d`
(`Pixel_Tablet` was on a 2026-05-15 APK, `7_Tablet` on 2026-04-02), and **both
needed `adb reverse tcp:8081 tcp:8081` plus a `localhost:8081` dev-client deep
link** — `10.0.2.2:8081` fails on a second emulator because Expo only wires
`adb reverse` for devices attached when it starts. Each tablet carries its own
small library (9 and 11 books), which is enough for the harness since synthetic
series reference real book ids.
