# 17 — Light theme pass over the Series surfaces

Type: prototype
Status: resolved — 2026-08-05. **Series line FIXED (1.20:1 → ~4.8:1); `PILLAR`
acceptance REPORTED BROKEN (1.15:1 dark vs 17.08:1 light); glyph, hero, editor
and wizard PASS.** See `## Answer`.
Blocked by: 14, 15 (both resolved)
Parent: [map.md](../map.md)

## Question

This effort has found **two** light/dark defects, both by accident, and has never
done a systematic pass. Both are the same family — *a component paints a surface,
then draws on it with a colour the theme chose* — and the map already carries the
rule that came out of them. What it does not carry is evidence that the rule was
applied everywhere.

The two on record:

- [08](08-browse-presentation.md): the play glyph was coloured from the theme
  while sitting on a scrim the component itself paints — **invisible in light
  mode**. Fixed by making it a fixed near-white; then
  [13](13-detail-sheet-prototype.md) went further and moved the darkening
  **into the glyph's own `fill`**, which is now house style.
- [13](13-detail-sheet-prototype.md): a `formSheet` whose route renders `null`
  shows the platform's **white** container, because `titleDetails`-style options
  set **no `contentStyle` background** (`player` does — `_layout.tsx:239`).
  Any screen copying those options inherits it. This is why `Delete` produced a
  full-screen white sheet.

What to check:

1. **Every surface in light theme**: browse row in both `Series Backgrounds`
   states, the detail sheet and its hero, the editor, the wizard (15's shape),
   14's series line on `titleDetails`, the `Series Detection` settings card, the
   `Removed Series` list, and every dialog.
2. **`PILLAR` (`#0B0B0B`, `seriesCardParts.tsx:79`)** — chosen deliberately *not*
   to be `themeColors.background` so a letterbox does not become a white hole in
   light theme. The map ruled the pillarboxing itself **out of scope** and
   accepted it, but that ruling was made from **dark-theme screenshots**. A
   near-black band on a light row is a different picture. Confirm the acceptance
   still holds in light theme, or report that it does not — do **not** redesign
   the geometry, which stays out of scope.
3. **The detail hero.** [13](13-detail-sheet-prototype.md) defused the trap
   rather than tripping it — the gradient derives from `themeColors.background`,
   so text on it is legitimately a theme colour. Verify that survives light
   theme, including the **bottom fade** 13 added so the backdrop's edge is not a
   seam.
4. **Every `contentStyle`-less route this effort adds.** 13's white-sheet bug is
   a copy-paste hazard, so it is a checklist item, not a one-off fix.

## Explicitly not in this ticket

**Animation.** The map groups it with light theme and font scale, but nobody has
yet stated what the animation question *is* — 13 measured the sheet transitions
and they were clean. It stays fog until someone can phrase it.

## Constraints

- The rule to apply: **anything drawn on a surface the component darkens must be
  coloured against that surface, not the palette.**
- The play-glyph house style is settled and must not be re-derived: `fill` = 0.42
  black, stroke = fixed near-white, no scrim/disc/badge outside the glyph, fixed
  colours never theme-derived. A 26dp disc was built and rejected.
- Prototypes are disposable.

## Definition of done

Each surface either passes in light theme or has a named fix. The `PILLAR`
acceptance is re-confirmed or reported broken. The `contentStyle` hazard is a
written checklist item for the implementation effort.

## Answer

**Resolved 2026-08-05. Two defects found, one FIXED in place; the `PILLAR`
acceptance is REPORTED BROKEN; everything else passes. The effort's rule holds
wherever it was applied — what this pass found is the places it was never
applied, plus one thing the rule does not cover at all.**

Measured on `Pixel_7_Pro`, light theme, `Blend sep ctr` / `Blend quiet ctr`,
`Stress ×15`. Contrast figures are WCAG ratios sampled from device screenshots
with `assets/17-light-theme/measure.py` (ground read as the local luminance
extreme away from the ink, bounded to the glyphs' real x-extent). Assets in
`assets/17-light-theme/`.

### 1. The series line on `titleDetails` — DEFECT, FIXED

**08's bug for the THIRD time, on ticket 14's own surface.** `titleDetails`
paints an **artwork-derived mesh gradient that is dark in BOTH themes**, and
14's subheading drew on it with `themeColors.textMuted` + `themeColors.text`.
In dark theme those are near-white and it looked right. In light theme they flip
to dark grey on a still-dark ground: **`Book 8 of Discworld` measured 1.20:1**
against 9.10:1 for the `Read by` value beside it. Effectively invisible
(`07-DEFECT-series-line-invisible-light.png`).

**Fixed** in `ProtoSeriesLine.tsx` to **`themeColors.lightTextMuted` for the
WHOLE string** — driver's ruling, "that text should be the same as the title's
text color… the entire string", then softened from `lightText` to
`lightTextMuted` on sight so the subheading still sits below the title in the
hierarchy. **1.20:1 → ~4.8:1**, verified on device
(`08-FIXED-series-line-lightTextMuted.png`). tsc 0 / eslint 0.

**AMENDS 14**: the separately-coloured `Book N of ` prefix is gone. 14 built the
line two-tone (muted prefix, full-strength name); it is now **one colour, one
string**. The hierarchy that the two-tone was buying is now bought by the token
choice instead.

**NAMING TRAP for [19](19-write-the-spec.md), worth more than the fix.** The
`light*` family (`lightText`, `lightTextMuted`, `lightIcon`) means
**"light-COLOURED text", NOT "text for the light theme"**. They live in
`colorTokens.shared`, which `useTheme` spreads **over** the per-scheme tokens
(`useTheme.ts:35-36`), so they are **identical in both themes by construction** —
exactly the property a component-painted surface needs.
`titleDetails.tsx:535` already uses `lightText` for the book title for this
reason. A build engineer reaching for "the light theme token" will pick these and
be right by accident, or avoid them and be wrong.

### 2. `PILLAR` — ACCEPTANCE DOES NOT HOLD IN LIGHT THEME

Reported broken, as the ticket permits. Geometry untouched.

| | `PILLAR` `#0B0B0B` vs the row it sits on |
| --- | --- |
| **dark row** (`#1C1C1C`) | **1.15:1** — invisible, reads as the cover's own letterbox |
| **light row** (`#eceff4`) | **17.08:1** — the darkest object on the screen |

That single pair explains the whole history: it is *why* it "was present through
all fourteen of 08's browse variants and never remarked on", and why it is
unmissable now. On a light row the Mort paperback draws as **two hard black slabs
flanking the artwork** (`03-PILLAR-black-slabs-light.png`), and it is **worst on
the detail hero**, where the cluster is 1.24× larger
(`04-detail-hero-PASSES-but-pillar-at-hero-size.png`).

**The irony is the finding.** `PILLAR` was chosen as a fixed near-black
*specifically* so a letterbox "does not become a white hole in light theme"
(`seriesCardParts.tsx`). It succeeded at that and produced a **black hole**
instead — the reasoning considered one of the two failure modes and fixed a
constant against it. The map's two previously-declined fixes are unchanged in
cost (crop-to-fill loses the edges of tall art; theme-background reintroduces the
white hole).

#### DRIVER'S RULING (2026-08-05): the pillar STAYS STATIC

*"I want the Pillars to be static despite light/dark mode, but if we need to
tweak that constant we will."* **This overrules this session's recommendation**,
which was that the pillar be theme-relative (near its own ground in each theme).
Recorded as the ruling; the recommendation is kept above only so the reasoning
behind the trade is not lost.

**What static costs, measured, so the tweak is informed.** One constant has to
serve two grounds at opposite ends of the range, so it cannot be near both — the
number that matters is the **worst** of the two:

| value | vs dark row | vs light row | worst | reads as |
| --- | --- | --- | --- | --- |
| `#0B0B0B` (today) | 1.15:1 | 17.08:1 | 17.1 | invisible in dark, **black slab in light** |
| `#131313` (the noted candidate) | 1.09:1 | 16.12:1 | 16.1 | **no material change** — do not expect one |
| `#3A3A3A` | 1.50:1 | 9.87:1 | 9.9 | still a strong band in light |
| `#757575` | 3.70:1 | 4.00:1 | **4.0** | a visible grey matte in **both** themes |

**`#757575` is the balance point** (luminance 0.179 — the value that equalises
both ratios) and is the best any single constant can do. **The trade it makes is
real and should be made knowingly**: it never produces a hole or a slab, but it
also gives up the property that made the pillar unremarkable for fourteen
variants — in dark theme it stops being *invisible* and becomes a permanently
visible matte. That is a legitimate house style (photo viewers use exactly it),
just not a free improvement.

**Value NOT yet chosen.** `PILLAR` remains `#0B0B0B`, with `//#131313` noted in
`seriesCardParts.tsx` as a candidate. Picking it is the implementation effort's;
geometry stays out of scope either way.

### 3. The backdrop's cost is UNCONDITIONAL in light theme

**This is NOT the claim [16](16-geometry-stress-tablet-fontscale.md) refuted and
withdrew.** 16's refuted claim was that the backdrop *degrades with width*; it
does not, and that stays closed. This is a different axis, and 16 could not have
seen it because it worked from dark-theme screenshots.

The two themes are **not symmetric**, because `textMuted` is not:

| | flat-background contrast, before anything is painted |
| --- | --- |
| dark `#d8dee9` on `#1C1C1C` | **12.62:1** — 2.8× AA headroom |
| light `#6B7280` on `#eceff4` | **4.19:1** — **already below AA 4.5** |

Measured with the backdrop ON, same variant, same rows:

- **dark** — 8.58, 8.58, 11.86:1 on the three dark covers, and **1.77:1 on the
  one bright cover** (Bobiverse). A *cover-dependent* fault.
- **light** — **2.03, 2.01, 2.26, 2.09:1. All four rows, bright covers and dark
  ones alike.** A *constant* fault.
- **light, backdrop OFF** (`Blend quiet ctr`) — back to the palette's own
  **4.19:1** ceiling (`02-browse-backgrounds-OFF-light.png`).

So the driver's accepted reasoning — "a busy band is a property of the cover with
two shipped correction paths" — is **true in dark theme and half-true in light**.
[12](12-series-display-setting.md)'s toggle works (it restores 4.19:1). **The
artwork override does not**, because no choice of image restores contrast the
palette never had. Not re-raised as a defect; recorded as the measured asymmetry,
for the driver to rule on.

### 4. Every `shared` accent token fails on the light background

Root cause is structural and one line: `useTheme` spreads `colorTokens.shared`
**over** `colorTokens[scheme]`, so these four are **unthemeable by construction**
and were all picked against `#1C1C1C`.

| token | on light bg | on dark bg | where it lands in Series |
| --- | --- | --- | --- |
| `success` `#8BD649` | **1.54:1** | 9.59:1 | **`Series complete`** (08's third next-up state) |
| `danger` `#FF5F56` | **2.59:1** | 5.70:1 | **`Delete Series`** in the editor |
| `primary` `#FFB606` | **1.53:1** | 9.69:1 | `Next`, `+ Add books`, tab pill |
| `warning` `#FFCA8A` | **1.30:1** | 11.42:1 | not currently used by Series |

`primary` is **masked on this device** — `Auto Accent from Cover` resolved it to
a dark blue. At the shipping default gold it is 1.53:1
(`06-editor-danger-token-weak-light.png`). Largely a **shipping-palette**
property rather than something this effort introduced, but `Series complete` is
08's own element, so it is in scope and needs a named fix.

### 5. Passes — recorded so they are not re-checked

- **The play glyph.** The 08/13 house style is **correct and verified in light
  theme**: fixed near-white stroke, 0.42 black `fill`, nothing outside the glyph.
  Legible on bright covers (*Bands of Mourning*, *For We Are Many*) and dark ones
  alike (`01-browse-backgrounds-ON-light.png`). **This is the rule working** —
  the one place it was consciously applied is the one place nothing broke.
- **The detail hero.** Passes, exactly as 13 designed: the gradient is built
  **from `themeColors.background`**, so it lightens with the theme and text on it
  is legitimately a theme colour. **The bottom fade works** — no seam at the
  backdrop's edge in light theme.
- **The editor and the wizard (15's variant E).** Pass. Neither **paints a
  surface**, so this ticket's defect family cannot arise there at all — the same
  structural reason 16 found the wizard exempt from the content cap. Their only
  light-theme exposure is §4's tokens.
- **Back/return behaviour.** 13's clean returns hold in light theme (editor back
  → sheet, sheet back → library).

### 6. Two named surfaces DO NOT EXIST

**`Series Detection` (09) and `Removed Series` (09) were never built** — 09 was
decided by grilling and nothing was prototyped. They could not be tested. They
inherit correctness *structurally* (a settings screen paints no surface of its
own, and `CompactSettingsRow` is shipping code used in both themes), but that is
an **argument, not a test**, and is flagged as such for
[19](19-write-the-spec.md).

### 7. The `contentStyle` hazard — CONFIRMED, and worse than the ticket predicted

`_layout.tsx` currently gives **three different answers** to the same question:

| route | `contentStyle` |
| --- | --- |
| `player` (`:239`) | `themeColors.background` — themed, correct |
| `editTitleDetails` (`:265`) | **`'#2c2c2cdc'` — a HARDCODED DARK LITERAL** |
| `titleDetails`, `chapterList`, `seriesDetail` | **none** — 13's white sheet |

**[15](15-wizard-flow-shape.md) ruled the series editor becomes a root
`transparentModal` "matching `editTitleDetails`" — which would import the
hardcoded literal.** It does not bite today only because the editor is still the
shipping opaque push, so 15's decision is a **live trap**, not a past one.

**Checklist item for the implementation effort — every route this effort adds or
moves:**

1. `series/edit/[id]` → root `transparentModal` (15). **Do NOT copy
   `editTitleDetails`' `contentStyle` literal.** Use a themed value.
2. `seriesDetail` → `formSheet` (11/13). Needs a **themed `contentStyle`
   background**, or a `null`-rendering route shows platform white — 13's
   `Delete` bug, which needs BOTH the routing fix and the background.
3. Any new route copying `titleDetails`-style options inherits **no background**.
   Set one.
4. `#2c2c2cdc` on `editTitleDetails` is itself a **light-theme bug on a shipping
   screen** — out of scope here (not a Series surface), recorded in §8.

### 8. Out of scope, found on the way

- **`editTitleDetails`' hardcoded `#2c2c2cdc`** — a dark scrim in light theme on
  a shipping book screen. Same family as 16's two font-scale defects: real,
  driver-visible without any of this map's work, not a Series surface.

### Not in this ticket

**Animation** stays fog, per the brief — nobody has phrased the question.

### Cost

**One line of real decision** (§1's token), **zero schema**, zero new surface.
tsc 0 / eslint 0.
