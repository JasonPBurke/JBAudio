# 08 — Browse presentation: what is the repeating unit?

Type: prototype
Status: resolved
Blocked by: 04, 06, 07
Parent: [map.md](../map.md)

> **REOPENED and RE-RESOLVED 2026-08-03.** The first pass chose `Rich + continue`;
> the driver reopened it (*"I am not sure I am happy with the variant we chose"*),
> eight further variants were built, and the winner is **`Blend sep ctr` +
> `Blend quiet ctr` behind a user setting**. The first-pass answer is retained
> below under *Prior answer* purely as the record of what was tried; **the
> binding decision is the `## Answer` section at the end of this file.**

## Question

**How should a list of series be presented?** Build variants on `Pixel_7_Pro` and
pick by reacting to them, not by arguing about them.

## Starting position

Today's screen is a clone of `BooksHome`: a masonry `FlashList` whose flat array
interleaves a section header with either one `horizontalRow` cell (collapsed) or
N `book` cells (expanded). That inheritance was never a design decision — it was
the shape that already existed for author grouping.

The driver's own framing, verbatim:

- Similarity to `BooksHome` **is not itself the problem** — *"It feels correct to
  not completely change the screens design when changing slots"* — but Audible
  switching layout per content type suggests divergence may be the more expected
  convention. **Prototype it; don't assume it.**
- *"With the series, we have much more vertical space to play with."*
- Intrigued by *"a more detailed header with image integration that still somehow
  allows for the list to be expanded and also gives access to the series detail
  screen."*
- And explicitly: *"perhaps a prototype that only lists out all the series as
  card-height and full width cards that can be interacted with to show the titles
  and/or the series detail screen."*

## Variants to build (at least)

1. **Current + sequence cue.** Keep sections and inline expansion; add the number
   badge from [07](07-sequence-numbering.md). The cheapest change; establishes
   whether the dissatisfaction was really just the missing order cue.
2. **Full-width series cards.** One card-height, full-width card per series —
   the driver's own idea. Room for series artwork, progress, next-up, and a book
   count. Tapping expands, or opens detail, or both.
3. **Rich header + inline expand + detail affordance.** The hybrid: a header that
   carries image integration and still expands in place, with a separate route
   into a detail screen.
4. **Picker → detail screen.** The browse screen becomes a thin list; everything
   substantial lives on a pushed series detail screen. Deliberately removes the
   nested-list construct entirely.

## What to judge them on

- Does the **order** read at a glance? (the original complaint)
- Does a series look like a **curated collection** rather than an author shelf?
- 15 series and a 20-book series — does it hold up? (stress data from
  [04](04-prototype-harness.md))
- Long series names, and the two Discworlds sitting adjacent.
- Where do **proposals** live? Detected-but-unconfirmed series need somewhere to
  surface; a layout with no room for them will have to be redone.
- Scroll feel with real `FastImage` covers.

## Structural note

Variants 2 and 4 eliminate the **horizontal `FlashList` nested inside a masonry
`FlashList` cell** — the single construct in this feature that never rendered
correctly, and the one the driver expects design variants may make irrelevant.
That is a legitimate tiebreaker, but it must not be the *only* reason a variant
wins: pick the design that is right, and treat the bug's disappearance as a
dividend.

Note also that `BooksHorizontal` and `BookGridItem` are **shared with
`BooksHome` and `BooksGrid`**. A variant that changes them changes all three
library views; a variant that forks them adds duplication. Say which, explicitly.

## Downstream

This ticket's answer graduates the **series detail screen** out of the fog — its
existence and job are decided here, its contents are not.

## Prior answer — first pass, REOPENED and under review

**The repeating unit is a rich section header with a static cover peek — and it
does not expand.** Chosen by the driver on device after reacting to six built
variants, not by argument. The winner is `Rich + continue`
(`src/prototypes/variants/RichPlaySeriesHome.tsx`).

### The unit

A full-bleed **96dp band** carrying, over a scrimmed backdrop of the series'
first cover:

- the **series name**, capped at **2 lines**, truncating;
- a meta line — `N books · N finished · #1-22` — the canonical range from
  [07](07-sequence-numbering.md) rendered in full;
- a **completion bar** with an `n/total` label;
- a **`Start` / `Continue` / `Restart` button**, always present.

Below the band, outside it, sits a **static peek row** of covers plus a `+N`
card. **Tapping anywhere on the header opens the series detail screen.**

### What that decides, and what it kills

- **Inline expansion is gone.** The Series view no longer expands in place at
  all. `activeGridSections` / `setActiveGridSections` become dead props for this
  screen.
- **The nested horizontal FlashList inside a masonry FlashList cell is gone**,
  and so is the masonry list itself — this is a plain vertical `FlashList` of
  headers rendering **no book cells**. Per this ticket's own instruction that
  was a **dividend, not the argument**: the driver chose the variant on its
  reading, and three of the four candidates removed the construct anyway.
- **`BooksHome` and `BooksGrid` are untouched.** Nothing is forked and nothing
  is modified: `BookGridItem` and `BooksHorizontal` are simply not used here.
  The Series view stops being a customer of the shared grid components. This was
  the explicit shared-component question and the answer is *no change to either*.
- **Design continuity with `BooksHome` is broken deliberately.** The map listed
  continuity as "a feature, not a bug — but testable, not sacred". It was
  tested: the section-shaped `Rich header` variant was built and lost to the
  same header *without* expansion. [03](03-prior-art-series-ux.md)'s finding that
  Audible diverges layout per content type is upheld on this screen.

### Density, measured on device at Stress ×15

Baseline ~2.5 series/screen · Rich header ~3.5 · Cards ~5 · Picker ~7. The
winner sits at ~3.5, so **it is not the densest option and was not chosen for
density** — it was chosen for how a series reads.

### Rules the spec must carry

1. **The button has three states and is never absent.** Untouched → `Start`;
   part-read → `Continue`; finished → `Restart`, targeting the first book.
   Hiding it on finished series was tried and rejected: correct, but it left the
   row's right side empty so a completed series read as an unfinished *layout*.
2. **Play styling is `BookGridItem`'s, plus a border.** Outlined `Play` in
   `themeColors.icon` at `strokeWidth={1}` with `absoluteStrokeWidth`, over
   `backgroundAlpha59`, `borderRadius: 4`. No amber, no fill. It adds a
   `StyleSheet.hairlineWidth` border (`withOpacity(themeColors.icon, 0.4)`)
   that `BookGridItem` does not have — a deliberate divergence, because the grid
   button always sits on cover art whereas this one sits on a scrim that can
   match its own ground exactly and vanish.
3. **The scrim runs heaviest under the text.** Solid background at x=0 easing to
   0.55 at x=1. The reverse was built first and every title fought its own cover.
4. **No origin chip on browse.** Provenance is detail-only. This is what gives
   the meta line its full width back, and the canonical range is what wins that
   space — on the card variant the chip truncated it to `12 books · 4 finished · …`
   on 5 of 15 series. **A browse row cannot carry both at full width.**
5. **Covers take their artwork's true shape**, per `BookGridItem.tsx:246`;
   fallback 500×500. The peek row fits as many as the device allows, so the
   count varies by device *and* by series. The `+N` card is hidden when nothing
   is hidden.
6. **The band is fixed at 96dp**, names cap at 2 lines and do not expand here.

### Downstream, as this ticket predicted

The series detail screen is no longer optional — **it is the only route to a
series' contents, its full name, its provenance and its editing.** Its existence
and job are settled; its contents graduate to
[11](11-series-detail-contents.md).

### What this ticket does NOT decide

Tablet, light theme, font scale, animation, and **the detail screen's
transition** — the prototype used a `Modal`, not a route, so push-vs-sheet is
untested by construction. [05](05-wizard-presentation.md) settled that for the
wizard and the reasoning does not automatically transfer.

### Assets

All variants and the shared detail screen live in `src/prototypes/`
(throwaway — `rm -rf src/prototypes` plus three `THROWAWAY` sites in
`src/app/(drawer)/(library)/index.tsx`). Six variants are registered:
`Baseline · Numbered · Cards · Rich header · Picker · Rich + play ·
Rich + continue`. `tsc` and `eslint` clean, jest 484/484 untouched.

## Comments

### 2026-08-02 — All four variants built and device-verified on `Pixel_7_Pro`

Variant 1 of the list above ("current + sequence cue") already existed as
`Numbered` from ticket 04. Three new ones were added, so the switcher now
carries **five**: `Baseline · Numbered · Cards · Rich header · Picker`.

Reach them: Library → Series (Layers toggle) → `proto` pill → **Variant** row.
Judge each against **Data: Stress ×15** *and* **Calm ×3** — the two knobs are
orthogonal on purpose.

New files, all `src/prototypes/` and all throwaway:

- `variants/CardsSeriesHome.tsx` — variant 2, full-width cards
- `variants/RichHeaderSeriesHome.tsx` — variant 3, rich header + static peek
- `variants/PickerSeriesHome.tsx` — variant 4, thin rows only
- `ProtoSeriesDetail.tsx` — the detail screen, **shared by all three**
- `seriesFacts.ts` — derived facts (counts, next-up, range), data only
- `seriesCardParts.tsx` — `CoverCluster` / `OriginChip` / `CompletionBar` atoms

`syntheticSeries.ts` gained `origin: 'detected' | 'user'` (ticket 06's column),
because "where do detected series surface" is one of this ticket's criteria.
`City Watch`, `Death` and `Q` are marked `'user'`; the rest `'detected'`.

**Density at Stress ×15, measured on device:** Baseline ~2.5 series per screen ·
Rich header ~3.5 · Cards ~5 · Picker ~7.

#### Findings the build produced (before any driver reaction)

1. **The canonical range is the first casualty of density.** On the card, an
   origin chip sharing the meta row truncated it to `12 books · 4 finished · …`
   on 5 of 15 series. Since that range is ticket 07's entire answer to "does the
   order read at a glance", provenance was demoted to an icon on the card and
   keeps its word only where there is room (picker, detail). **A browse layout
   cannot carry both at full width on one line.**
2. **Two series that share books share a backdrop.** `City Watch` and `Death`
   draw the same cover art in the rich-header variant and adjacent identical
   clusters in Cards. This is the "two Discworlds sitting adjacent" criterion
   arriving early, via a different route — art alone does not disambiguate
   series that overlap.
3. **A fanned cover stack needs its offset to outpace its shrink**, or it draws
   as a single cover. Noted because the stack is the strongest "curated
   collection, not author shelf" signal available and it failed silently.
4. **The static peek is a real trade, not a free win.** The rich header shows 4
   covers + `+N` and cannot scroll to book 22; the baseline's nested row can.
   Whether that scroll was ever worth having is a genuine open question.

#### Shared-component impact (the ticket asked for this explicitly)

**None of the three forks anything.** `Cards` and `Rich header` reuse
`BookGridItem` unmodified for their expanded grids; `Picker` renders no book
cells at all. `BooksHorizontal` is unused by all three, so **`BooksHome` and
`BooksGrid` are untouched by every variant**. If `Picker` wins, the Series view
simply stops being a customer of the shared grid components; nothing is deleted
or duplicated.

#### Caveats to hold while judging

- The detail screen is a **`Modal`, not a route**. It says nothing about
  push-vs-sheet for a real detail screen — ticket 05 settled that for the wizard
  and the reasoning is not automatically transferable.
- Variants 2 and 4 do make the nested-FlashList clipped-row bug vanish. Per this
  ticket that is a **dividend, not an argument**.
- Prototype only: no jest, no tablet pass, no font-scale pass. `tsc` and
  `eslint` are clean (0 errors), which the harness README requires.
- **Uncommitted** on `feature/series-styling`.

### 2026-08-02 — Driver leaning `Rich header`; second pass built

Driver's reaction to the first five: **leaning rich header**, with three changes.
Built as `variants/RichPlaySeriesHome.tsx` and registered as **two** switcher
entries (one component, one boolean apart) so the icon-vs-wording question can
be A/B'd in the panel instead of costing a session:

- **`Rich + play`** — round play button
- **`Rich + continue`** — `Continue` pill echoing the detail screen

Changes from `Rich header`, all as asked:

1. **Origin chip dropped** from browse entirely. It survives only on the detail
   screen. Side effect worth having: the meta line got its full width back, so
   the canonical range renders complete (`#1-22`, `#1, 3-4, 8`) — the exact
   thing that was truncating on the card variant.
2. **Inline expansion dropped** — a tap anywhere on the header opens detail.
   Since nothing expands, this variant renders no book cells, so the masonry
   list, `overrideItemLayout` and `BookGridItem` are all gone too. It is a plain
   vertical FlashList of headers. The static peek row stays: it is now the only
   place covers appear while browsing.
3. **Play affordance** occupies the space the chevrons and chip vacated.

Verified on device at Stress ×15:

- The `#1, 3-4, 8` gap range and the no-numbering abstention case
  (`Rivers of London` → `3 books`, no range) both read correctly.
- The 95-char Amber name wraps to two lines without displacing the pill.
- The decimal case renders throughout: `The Murderbot Diaries` reads
  `#1-4, 4.5, 5-8` on the row and gives `#4.5` its own entry on detail.

**The button has three states, and is always present:**

| Series state         | Label      | Target        |
| -------------------- | ---------- | ------------- |
| never opened         | `Start`    | first book    |
| part-read            | `Continue` | next unfinished |
| finished             | `Restart`  | first book    |

Two findings drove that, one of them the driver's call:

- **`Continue` is wrong on an untouched series.** Bobiverse renders `0/1` and
  read `Continue` on the first build. **The detail screen has the same flaw**
  and inherits the fix if this variant wins.
- **An earlier build hid the button on finished series.** Literally correct —
  nothing to continue — but it left the right side of those rows visibly empty,
  so a completed series read as an unfinished *layout*. Driver's ruling
  (2026-08-02): *"finished series should read 'restart' with a play button"*.
  Verified on `Foundation` 5/5, `Hyperion Cantos` 2/2 and
  `Mistborn: Era Two` 4/4.

The play button is a **stub** — it logs and does not touch playback. The
question is whether the affordance belongs on a browse row and how big it wants
to be, not whether playback works.

### 2026-08-03 — Play button restyled to match `BookGridItem`

Driver: *"change the icon to the play icon used on the bookGridItems … the
border of the icon should be the whiteish color … make it larger on the icon
only … stop using the amber color as the background."*

Both buttons now wear the grid's treatment (`BookGridItem.tsx:142-156`,
`pausedIconBase`): an **outlined** `Play` in `themeColors.icon` at
`strokeWidth={1}` with `absoluteStrokeWidth`, over `themeColors.backgroundAlpha59`.
No fill, no amber.

- Icon-only: glyph 18 → **34**, button 40 → **52**.
- `Continue` pill: same outlined glyph at 20, label switched to
  `themeColors.text` (it was `background`, which was only legible on amber).

Shape matches too, on a follow-up: **`borderRadius: 4` on both** — the same
value `pausedIconBase` uses — so they read as softened squares rather than a
circle and a pill. The icon button's ripple went from `borderless` to bounded,
since a circular borderless ripple spills past square corners.

**Finding:** `backgroundAlpha59` is `background @ 0.59`, and it exists to lift
the glyph off *bright cover art* on a grid tile. The rich header deliberately
scrims its left side to near-solid background, so the ground is **visible over
bright backdrops** (`Bobiverse`) and **effectively invisible over dark ones**
(`City Watch`, `Death`, `Discworld`), leaving the outlined glyph to carry the
affordance alone. That is the same behaviour the button has on a grid tile, so
it is consistent with the app rather than a new inconsistency — but it did mean
the button had no reliable hit-target boundary.

### 2026-08-03 — `Rich + continue` CHOSEN; follow-up decisions

Driver picked the **text + icon** rich header. Decisions taken in the same pass,
several of which belong to *other* tickets and are routed on resolution:

**Shared backdrops — withdrawn as a finding.** My own harness caused it: three
stress specs all had `offset: 0`, so `Discworld`/`City Watch`/`Death` shared a
first book. Art derives from the first book, so two series collide only if they
share one — rare in a real library (the driver's two Discworlds have different
first covers). Offsets are now 2 and 4; overlapping *membership*, the stress
those rows exist for, is preserved.

**Series artwork + description** (→ belongs to the series-detail ticket 08
graduates, since 08 owns the detail screen's job, not its contents):
- Art is derived from the first book and **follows** a reorder rather than
  pinning.
- Custom art supports **both** an online lookup (parallel to `coverArtSearch`,
  which `editTitleDetails.tsx:78` already routes to) **and** picking one of the
  member books' covers.
- A **series description** exists and is **protected from rescan**, like `name`
  — so it needs a `*_source` companion under 09's per-aspect ownership model.
- Both live behind a three-dot menu on detail, mirroring `titleDetails.tsx:296`.

**Editing is detail-only.** The origin chip was never a button; the route that
was lost is the **Pencil** in the shipping header (`SeriesHome.tsx:279` →
`onEditPress` → `/series/edit/[id]`), which this variant never calls. It does
**not** come back to browse — it re-clutters the space the redesign cleared.
Edit lives in the detail three-dot menu instead. Accepted cost: editing goes
from 1 tap to 2. `Fix this series` stops existing as a separate concept.

**Correction ≈ edit, but a strict superset** (→ ticket 10). The existing edit
screen already does rename / add / remove / reorder / delete, and 02 says the
commonest repair is a rename. Two gaps remain, so 10 does **not** collapse:
1. **Cross-series split and merge — ruled OUT OF SCOPE** (driver, 2026-08-03,
   reversing an earlier call in the same session): *"deleting and rebuilding is
   good enough for now."* Recorded on the map's Out-of-scope list. They remain
   the only two corrections a single-series editor structurally cannot express,
   so the note survives in [10](10-correction-surface.md) in case feedback
   brings them back.
2. **Edit predates 09 and will silently undo repairs on detected series.**
   `handleRemove` just rewrites join rows, so a rescan re-adds the removed book;
   and `updateSeries` *deletes* the series when the last book goes
   (`seriesQueries.ts:81-83`), which 09 says must suppress instead. Edit must be
   made 09-aware before it is safe on detected series.

**Header band stays FIXED at 96dp, titles capped at 2 lines on browse.**
Driver chose predictability over elasticity: *"the user is going to recognize
the series from 2 lines of text, and if not, they can go into the details screen
and view the whole series title there."* Verified with the 95-char Amber name —
it wraps to exactly 2 lines and truncates, and the meta line and progress bar
both stay fully visible inside the fixed band.

That makes the detail screen the **last place a long name can be read in full**,
so it gets a safety valve: the hero title caps at **4 lines** and, when the name
overflows, tapping it expands to the whole thing. Four because 4 × ~26dp ≈ 104dp
— exactly the cover cluster's height, so title and artwork stay balanced.
Verified: Amber truncates at 4 and expands to 5.

**No `Show full name` label** — the trailing ellipsis is the affordance
(driver, 2026-08-03).

**The title is a control only when it actually overflows**, and that costs a
measurement. Driver asked whether measuring beats just making every title
pressable; the deciding argument is **accessibility, not cost**. An
always-pressable title is announced to TalkBack as actionable on every series,
promising an action that mostly does nothing, and its ripple fires on a no-op.
`disabled` is not the fix either — TalkBack reads a disabled control as
*dimmed*, implying it could become enabled. So a name that fits renders as a
plain `<Text>`: absent from the accessibility tree entirely.

Two implementation notes worth carrying forward:

- **Overflow must be measured, not inferred.** A `<Text numberOfLines={4}>`
  reports only the lines it drew, so it cannot distinguish "exactly 4" from
  "clipped at 4". A zero-opacity uncapped copy at the same width reads the true
  count. **This is cheap only because it is one title mounted once per screen —
  do NOT copy it into a recycled list cell without re-checking**, since a
  duplicate `<Text>` doubles per-cell text layout, the expensive part of
  FlashList. The browse row caps at 2 lines and does not expand, so it never
  needs this.
- RN 0.83 deprecates the exported `TextLayoutEventData`; the event type is
  derived off `Text`'s own prop instead.

**Cover geometry — built and device-verified this session:**
- Covers take their artwork's true shape, as `BookGridItem` already does
  (`width: aspectRatio * height`, `BookGridItem.tsx:246`); fallback **500×500**.
- The peek row fits **as many covers as the device width allows**, so the count
  varies by device *and* by series (at fixed height a tall cover is narrower, so
  more fit). Verified: `City Watch` fits 6, `Death` fits 5 on the same screen.
- The `+N` card is **hidden when nothing is hidden** — a fully-shown series just
  stops.
- Detail rows put each cover in a **fixed-width box**, so a wide cover can never
  shove that row's title right. Verified with tall and square covers adjacent.

**Resolved with a hairline border** (driver, 2026-08-03, first pass):
`borderWidth: StyleSheet.hairlineWidth` on both, `borderColor` tied to the glyph
(`withOpacity(themeColors.icon, 0.4)`) so it tracks the theme rather than
hard-coding a grey. The button is now legibly bounded over bright backdrops and
dark ones alike, with no amber anywhere. **This is a deliberate divergence from
`BookGridItem`, which has no border** — it earns its place because the grid
button always sits on cover art, while these sit on a scrim that can match their
own ground.

---

## Second pass — REOPENED 2026-08-03

### Diagnosis (driver, before anything was built)

Asked what specifically failed in `Rich + continue`, the driver named **two**
faults and declined two others:

- ✅ **the row is too heavy / too few series per screen**
- ✅ **the static peek row does not earn its height**
- ❌ *not* the scrimmed backdrop (kept)
- ❌ *not* the loss of inline expansion (stays gone)

Plus: *"I want a variant of the cards and the Rich."*

**Both accepted faults have one fix.** The peek row's job was "show me the
collection" and it spent **66dp of vertical** doing it; `CoverCluster` does the
same job in ~101dp of **horizontal**, which is free because the text column
never needed full width. So the merge is: **peek row deleted, fanned cluster
takes over the cover job.**

### The merge list (driver, 2026-08-03)

| from `Cards` | from `Rich` | from neither |
| --- | --- | --- |
| horizontal skeleton | scrimmed first-cover backdrop | **`N finished` dropped from the meta line** |
| fanned `CoverCluster` (84dp) | 3-state `Start`/`Continue`/`Restart` pill | |
| `Next · #9 Eric` line | chip-free full-width meta line | |
| `fontSize.sm` title | | |

- **No origin chip on browse**; provenance stays on detail (unchanged from the
  first pass). The driver briefly said "drop it altogether", then corrected the
  same session: *"origin chip can stay on the details for now."* `series.origin`
  the column is untouched — it is load-bearing for 09.
- **No inline expansion.** Tap anywhere → detail. Plain vertical `FlashList`:
  no masonry, no `overrideItemLayout`, no `BookGridItem`. Ticket 11's premise
  survives intact.
- **`#1-22` is a lever held in reserve** — driver: *"if it still looks cluttered
  or we need more space, we will look at dropping the `#1-41` as well."*

### Three variants, one component, two booleans

Registered as `Blend card` · `Blend sep` · `Blend quiet`
(`variants/BlendSeriesHome.tsx`). `card` vs `sep` isolates the **container**
alone — same backdrop — so the comparison is clean; `quiet` is the separate
art-heavy-vs-quiet axis and was deliberately not collapsed into the first.

Two shared atoms changed, both additive:
- `seriesCountLine()` in `seriesFacts.ts` — count only. Kept as a **sibling** of
  `seriesMetaLine` rather than a flag on it, so the older variants' copy is
  provably unchanged and the A/B stays about structure.
- `coverClusterWidth()` + `CLUSTER_MAX_LAYERS` exported from
  `seriesCardParts.tsx`, because the separator insets to clear the covers
  (mirroring `BooksList.tsx:103`'s `marginLeft: 75`) and a hard-coded inset
  would drift silently the moment `STEP`/`SHRINK` changed.

### Measured on device, Stress ×15, `Pixel_7_Pro`

| variant | row pitch | series/screen |
| --- | --- | --- |
| `Rich + continue` (first pass) | ~172dp | ~3.5 |
| `Blend card` | **~132dp** | **~4.7** |
| `Blend sep` / `Blend quiet` | ~140dp | ~4.5 |

**~30% denser, not the ~50% estimated.** The reason matters: **the row is
text-driven, not cluster-driven** — the 84dp cluster sits inside a ~108dp text
stack (title + meta + bar + next-up), so the cluster is not what sets the
height and shrinking it would buy nothing.

### Findings

1. **Dropping `N finished` worked exactly as intended.** `22 books · #1-22`
   renders complete on every row including the 22-book stress case — against
   the first pass, where a chip truncated it to `12 books · 4 finished · …` on
   5 of 15 series. **07's canonical range is safe in this layout.**

2. **The `Next ·` line is the new truncation casualty.** The text column
   measures ~127dp as predicted, and `Next · #3 Mistborn 6 (Mich…` truncates on
   nearly every row. The `Continue` pill is what costs it — ~110dp against a
   chevron rail's 26dp in `Cards`.

3. **The card container costs ~4 characters of every line.** Directly
   observable in the A/B: `Blend card` renders `Next · #3 Mistborn 6 (…` where
   `Blend sep` gets `Next · #3 Mistborn 6 (Mich…`. That is the 24dp of card
   padding, and it is the clearest *measurable* trade between the two
   containers.

4. **Row height is now VARIABLE, where Rich's band was fixed at 96dp.** Every
   series visible in the stress set has a 1-line title; a 2-line title makes
   that row taller. The first pass explicitly chose *predictability over
   elasticity* for the band — **that decision has been quietly reversed by the
   skeleton change and needs re-taking, not inheriting.**

5. **The fanned cluster reads weakly — and it is a bug, not a design limit.**
   `CoverCluster` offsets each layer by `i * size * STEP` (18.5dp at size 84),
   but `fitInBox` draws a *tall* cover NARROWER than `size` (~56dp at aspect
   0.67). So the offset is computed off the **box** while the width comes from
   the **artwork**, and the back layers surface as thin darkened slivers that
   read as a drop shadow rather than a stack. This is the same *class* as the
   first pass's "offset must outpace shrink" finding but a **different
   instance** — and since the stack is the strongest "curated collection, not
   author shelf" signal available, it is worth fixing before judging the fan.

6. **`Blend sep`'s full-bleed backdrop makes rows bleed into one another.**
   Adjacent series' art abuts with only a hairline between, so the boundary is
   mushy. `Blend card`'s clipped backdrop reads considerably cleaner. This is
   the one thing that genuinely could not be held constant across containers.

7. **The predicted separator risk did NOT materialize.** A 0.3-opacity hairline
   stays legible over the backdrop, because the scrim holds the left 45% near
   solid background and the right side is dark enough.

8. **`Blend quiet` is the most legible of the three** by a clear margin — no art
   competing with text anywhere — at the cost of the series-identity signal the
   backdrop carries.

9. Three-state button re-verified in the new frame: `Foundation` 5/5 green bar +
   `Restart`, `Bobiverse` 0/1 + `Start`, the rest `Continue`.

**Status:** `tsc` 0 errors, `eslint` clean, jest **484/484** (unchanged —
prototypes are RN-dependent and outside the suite). Awaiting driver reaction on
device; **this ticket does not re-resolve until they pick.**

### 2026-08-03 — `CoverCluster` rewritten (finding 5 fixed, plus a second bug)

Driver asked for the fan to be fixed **before** judging it, since the stack is
the strongest "curated collection" signal available and it was rendering wrong.

**Bug 1 — the offset was computed off the box, the width off the artwork.**
`left = i * size * STEP` silently assumed every layer was `size` wide. `fitInBox`
draws a tall cover at `size * aspect` (~56dp at aspect 0.67), so the visible
sliver was whatever the width difference happened to leave and could collapse
toward zero — under a 36% black scrim the back layer read as a drop shadow.
**Fix:** each layer's RIGHT EDGE is placed a constant `PEEK` beyond the one in
front and its left follows from its own width, so the sliver is identical for
every layer whatever shape the artwork is. Clamped at 0, so a narrow front cover
over a wider second one just peeks *more* — never less, and never off-box.

**Bug 2 — the cluster's width varied per row, raggedding the text column.**
`coverClusterWidth` was derived from the cover COUNT, so a 1-book series
returned `size` and a 3-book series `size * 1.2`. Measured on device: Bobiverse's
title started at 274px, City Watch's at 313px. **Fix:** the box is now a
constant width for a given `size`, which is the same fixed-width-box rule the
detail screen's rows already follow. Verified: every title now starts at the
same x.

**Wide covers (driver's ask).** Every layer is now **full height**; a tall cover
is simply narrower, and a wide one is capped at `side` with the overflow
**cropped** by `resizeMode.cover` — *"hidden width can be cut"*. This replaces
`fitInBox`'s long-axis fit, which drew a wide cover SHORT; short layers were
half of why the fan read as a shadow. Note `min(side, side * aspect)` collapses
to `side` for any `aspect >= 1`, so **a wide cover produces the identical box to
a square one** and the only difference is which pixels are discarded.

**The device library cannot exercise this branch.** All 25 artwork files pulled
and measured: **22 square (500×500), 3 tall (0.588–0.677), ZERO wide.** A forced
`aspect: 1.8` probe rendered identically, as the collapse above predicts. Driver
is swapping in a real wide cover to confirm.

**Width regression, caught and reverted.** The first cut set `PEEK` to
`size * 0.22`, widening the cluster 100.8dp → 121dp and taking that 20dp out of
the text column — already the scarcest thing in this layout (driver: *"this
loses us too much text room"*). `PEEK_FRACTION` is now **0.10**, which
reproduces the old total width *exactly* (`size * 1.2`). **What changed is not
the size of the peek but its reliability.** Verified on device: text column
start moved 330px → 285px, and `Next · #1 Discworld 04 - Mort` now renders
complete where it was clipping.

`tsc` 0 errors, eslint clean. One lint catch worth keeping: React Compiler
rejected the running-accumulator `let` inside the layer map — the recurrence has
a closed form (`right_i = frontWidth + i * PEEK`) since `PEEK` is constant, so
it became pure rather than stateful.

### 2026-08-03 — The play affordance becomes its own axis (`Blend icon`, `Blend stack`)

Driver traced **four** separate faults to one cause — the `Continue` pill at
~111dp of a 412dp row (~27%): wrapped titles, variable row height, a truncated
`Next ·` line, and the loss of `N finished` from the meta.

**Hard requirement, driver's words:** *"I want the user to be able to continue
playback of the series with one click from this view."* Every option below
preserves that; it is not up for trade.

**The word was ~half the cost.** The pill breaks down as ~28 padding + 20 icon +
8 gap + **~55 for the label**. Driver ruled: **drop the word, icon only** — and
separately asked for a second variant keeping the pill but moving it under the
fan, accepting a taller card.

**Precedent that decided the icon's placement:** `BookGridItem` already overlays
its play button on the cover art (`pausedIconBase` — absolute, `padding: 6`,
`borderRadius: 4`, outlined `Play` over `backgroundAlpha59`) and already ships
**two tap targets in one browse cell**. So the glyph costs *zero* layout width
rather than 52dp, and it is the app's existing idiom rather than a new one.
`CoverCluster` gained an opt-in `overlay` slot to host it — the geometry lives
there because only that component knows the front layer's drawn width, which
varies with aspect (a caller positioning from the box's right edge would float
the button off a tall cover's art).

Both new variants hold `container: 'card'` + backdrop constant against
`Blend card`, so the **only** variable is the play affordance.

#### Measured on device, Stress ×15, `Pixel_7_Pro`

| variant | normal row | 2-line title (Amber, 95 chars) | series/screen | state word |
| --- | --- | --- | --- | --- |
| `Blend card` — pill in right rail | 132dp | grows | ~4.7 | yes |
| `Blend icon` — glyph on front cover | **118dp** | **138dp (grows)** | ~4.7 | **no** |
| `Blend stack` — pill under the fan | 147dp | **147dp (FIXED)** | ~4.0 | yes |

#### Findings

1. **Both new variants render every `Next ·` line complete.** `Next · #3
   Mistborn 6 (Michael Kramer)`, `Next · #8 Discworld 04 - Mort`, and even
   `Next · #2 The Dresden Files #4: Summer Knight` on the Amber row. The text
   column goes ~127dp → ~250dp. Finding 2 of the previous round is closed.

2. **`Blend stack` is the only variant with a genuinely FIXED row height** —
   and it fixes it *structurally*, not by hoping titles are short. The cover
   column (84 cluster + 8 + 32 pill = 124dp) always exceeds the text stack
   (83–107dp), so it is what sets the height and no title can change it.
   **Verified on the Amber row: 2 lines, still exactly 147dp.** This restores
   the predictability the first pass wanted from the fixed 96dp band, which the
   blend skeleton had silently traded away.

3. **`Blend icon` is denser but NOT uniform.** Amber measured 138dp against
   every other row's 118dp, because at ~250dp a title still wraps for roughly
   1 series in 15. Worth holding: its *worst* case (138dp) is still shorter
   than `Blend stack`'s *constant* (147dp), so "stack is taller" only holds
   against unwrapped rows.

4. **The icon loses the three states visually.** `Start` / `Continue` /
   `Restart` survive only in `accessibilityLabel`; a finished series and an
   untouched one are identical glyphs. Driver accepted this explicitly — but it
   is the same failure mode that got the hide-on-finished build rejected in the
   first pass, so it deserves a look on device before it is locked.

5. **The glyph is low-contrast over bright cover art** (Bobiverse, Rivers of
   London). `backgroundAlpha59` + an outlined glyph was tuned to sit on
   `BookGridItem`'s much larger cover; at 32dp on an 84dp cluster it competes
   with the artwork's own detail. The hairline border helps but does not
   fully solve it.

6. **`N finished` could now come back** — ~250dp of meta line has room. Left
   dropped in every blend variant so the A/B stays about structure.

`tsc` 0 errors, eslint clean.

### 2026-08-03 — `Blend center`, the third next-up state, and a constant fan gap

Driver **rebutted finding 4 of the previous round, correctly.** Dropping the
button's word does not lose the state, because the state is already stated twice
over: the **progress bar** carries completion, and the **next-up line** carries
what happens on tap. What was missing was a distinction that line did not yet
draw.

**The next-up line now has THREE states, not two** (driver's addition):

| condition | line reads |
| --- | --- |
| next book untouched — you are *between* titles | `Next · #9 Eric` |
| next book part-read — you are *mid-book* | `Continue · #9 Eric` |
| nothing left | `Series complete` (success colour) |

Backed by a new derived fact, `SeriesFacts.nextUpStarted` — the tri-state
`bookProgressValue === 1`. Device-verified: Bobiverse (0/1) reads `Next`, while
City Watch (2/6), Death (1/5) and Discworld (7/22) all read `Continue`.

**This closes the argument for the icon.** With the bar and this line, every
piece of information the `Start`/`Continue`/`Restart` label carried is still on
the row — so the label was genuinely redundant, not merely dropped. Finding 4 is
**withdrawn**.

#### `Blend center` — the contrast fix

Finding 5 said the corner glyph washes out over bright artwork. Driver's ruling
licenses the fix: *"we can lose artwork detail here without a real sacrifice as
the art is just a series visual representation."* That is the key difference
from `BookGridItem`, whose artwork **is** the book's identity — here the cover
is only standing in for the series, so darkening it costs nothing that matters.

- Glyph **centred** on the front cover, not a bottom-right badge.
- **Size 20 → 40**, and the ground/border dropped: on its own scrim the button
  needs neither, and a border would draw a box around nothing.
- **42% black scrim over the whole front cover** — the whole cover, not a disc
  behind the glyph, because a shadow disc under a play icon reads as a second
  button.
- `pointerEvents='none'` on the scrim: the cluster's overlay host is
  `box-none`, so a plain `View` there would swallow the row's taps.

Device-verified: the glyph now reads on every cover in the stress set including
the bright `Bobiverse` and `Rivers of London` artwork that defeated the corner
form. Density unchanged from `Blend icon` (~4.7 series/screen) — the overlay
still costs zero layout width.

#### The fan gap is now constant (driver-reported)

*"the 'Q' series has the tall mort cover first, so much more of the second cover
shows behind it. I would rather it be consistant regardless of any cover
differences."* Correct, and it was my clamp: `left = max(0, ...)` kept layers
inside the box but let a back layer **wider than its target** show more than
`PEEK`. `Q`'s front cover is the tall Mort artwork (~49dp), so the square cover
behind it showed a ~25dp sliver while every square-fronted series showed 8.4dp.

**Fix: cap the width, don't clamp the left.** Each layer's width is capped at
its target right edge, so the right edge is pinned and the sliver is exactly
`PEEK` for every layer in every series. The cropped-away width sits behind the
front layer, so nothing visible is lost — the same "hidden width can be cut"
rule already applied to wide covers. Device-verified: `Q` and `Rivers of London`
now show identical gaps.

**This is a `CoverCluster` fix, so it applies to every variant using it**,
`Cards` included — not just the blends.

`tsc` 0 errors, eslint clean, jest **484/484**.

### 2026-08-03 — Centred glyph carried to both separator containers

Driver: *"give this same treatment to blend quiet and blend seperator as
variants."* Added as **new** entries, originals kept, so the pill and centred-
glyph forms of each container stay comparable:

| variant | container | backdrop | play |
| --- | --- | --- | --- |
| `Blend sep ctr` | separator + hairline rule | full-bleed | centred glyph |
| `Blend quiet ctr` | separator + hairline rule | none | centred glyph |

The switcher now carries **14** variants. All five container × play-slot
combinations of the blend are reachable, so the two questions — *which
container* and *where the play affordance goes* — can be judged together
instead of one having to be settled first.

Device-verified at Stress ×15: both render the three next-up states correctly
(`Next` on Bobiverse, `Continue` on City Watch / Death / Discworld), both keep
full-width progress bars and untruncated `Next ·` lines, and `Blend sep ctr`
measures the same ~140dp pitch as `Blend sep`.

**One new observation, specific to `Blend quiet ctr`:** with no backdrop, the
cluster's front cover is the row's **only** artwork — and it is the one thing
carrying a 42% scrim. In `Blend center` that scrim was one darkening among
several; here it mutes the sole piece of art on the row. The row is by some
margin the most legible of the fourteen, but it is also the darkest reading of
the cover. If this container wins, the scrim is worth re-tuning **for this
variant only** — the contrast problem it solves is milder here, because no
backdrop is competing with the glyph in the first place.

`tsc` 0 errors, eslint clean, jest 484/484.

### 2026-08-03 — Square cluster boxes, and `N finished` restored

**Glyph misalignment (driver-reported).** *"when we have a tall book as the
top/first book, the Play icon is missaligned."* Cause: the overlay is positioned
on the front layer, and the front layer's width tracked the **artwork**. A tall
cover draws ~49dp against a square's 84dp, so `Q` centred its glyph at ~25dp
while every square-fronted series centred at ~42dp — the icons did not line up
down the list.

Driver offered two fixes and the second is the one taken: **every layer box is
now SQUARE**, with the artwork drawn full-height and centred over a near-black
pillar (`#0B0B0B`) that reads as a cover's own letterbox. Fixed rather than
patched at the overlay, because squaring the box also makes the cluster's total
width and the fan's geometry independent of which shapes a series owns:

- **Alignment.** Front layer is always `size` wide, so the glyph centres at
  `size / 2` on every row. Device-verified: `Q` (tall Mort, 470×800) now centres
  at the same x as `Rivers of London`, `Amber` and `The Dresden Files`.
- **The constant fan gap now falls out for free.** The previous round forced it
  by capping widths; with square boxes each layer's right edge is
  `size + i * PEEK` by construction. That width-capping logic is gone.
- **Wide covers are unaffected** — still centred and cropped, "hidden width can
  be cut".
- Pillar is a fixed near-black, **not** `themeColors.background`: on a light
  theme a white pillar would read as a hole rather than a letterbox.

Implementation note: the artwork is an explicitly-sized `FastImage` centred by
its parent, **not** `absoluteFill` — `absoluteFill` would stretch a tall cover
to the square box and distort it.

**`N finished` restored** (driver). Reverting `seriesCountLine` →
`seriesMetaLine` in every blend variant. Moving the play affordance off the text
row bought ~123dp back, so the tally and ticket 07's canonical range now
coexist. Device-verified on the hardest lines in the stress set:

- `The Murderbot Diaries` → `9 books · 3 finished · #1-4, 4.5, 5-8` (decimal
  **and** gap range, complete)
- `The Dresden Files` → `4 books · 1 finished · #1, 3-4, 8` (gap range, complete)
- `Discworld` → `22 books · 7 finished · #1-22`

`seriesCountLine` is kept as the lever if the meta line ever needs to shrink
again.

**Consequence worth knowing:** the three PILL variants (`Blend card`,
`Blend sep`, `Blend quiet`) have only ~127dp of meta line, so the restored tally
crowds the range there again. That is not a regression to fix — it is direct
evidence for why the pill had to move, visible by flipping between
`Blend card` and `Blend quiet ctr`.

**Minor, pre-existing:** a fully-read series reads `5 books · finished · #1-5`
rather than `5 books · 5 finished`. That is `seriesMetaLine`'s existing copy,
shared with the older variants, so it was left alone — flagging it in case the
spec wants it reworded.

`tsc` 0 errors, eslint clean, jest 484/484.

### 2026-08-03 — Scrim moved inside the cover layer; light-mode glyph fixed

**The box outline (driver-reported):** *"comparing blend icon to blend sep ctr
… we added an odd box outline to the first card of the fan."*

Cause: the scrim was rendered in the `overlay` node, which is a **sibling** of
the cover layers. So it painted a hard-edged rectangle over a cover carrying
`borderRadius: 5`, darkening ~5dp of row background at each rounded corner. On a
plain dark row that is invisible; over a backdrop those four darkened corners
outline the cover as a box. Only the centred variants showed it, because only
they have a scrim.

**Fix: the scrim is now `CoverCluster`'s `frontScrim`, painted INSIDE the front
layer**, where the layer's own `overflow: hidden` + `borderRadius` clip it to
exactly the cover's shape. The scrim belongs to the cover, not to the button —
rounding it to match would have been a coincidence maintained by hand.

**A second bug the driver's light-mode switch exposed.** The centred glyph was
`themeColors.icon`, which is dark in light mode — drawn on a 42% black scrim it
was **invisible**. The glyph's ground is a scrim *this component controls*, so
it is dark in both themes; taking its colour from the page palette was
referencing the wrong thing. It is now a fixed near-white (`SCRIM_GLYPH`). The
**corner** glyph keeps `themeColors.icon`, because it sits on unscrimmed art.

Device-verified in **light mode**, `Blend sep ctr` against `Blend icon`: cover
clusters now render identically apart from the scrim and glyph, with clean
rounded edges and no box halo in either. `Q`'s pillarboxed tall cover is
unaffected.

Worth noting for the spec: ticket 08's first pass explicitly deferred light
theme, and this is the first light-mode defect the effort has found. It is a
**theme-coupling** bug, not a layout one — anything drawn on a surface the
component itself darkens must not take its colour from the theme.

`tsc` 0 errors, eslint clean, jest 484/484.

---

## Answer

**The repeating unit is a full-bleed row — no card — separated by an inset
hairline rule, carrying a fanned square cover cluster with a centred play glyph,
beside a text column. It does not expand.** Chosen by the driver on device
(2026-08-03) after reacting to fourteen built variants across two passes.

**The winner is TWO variants and a setting.** `Blend sep ctr` and
`Blend quiet ctr` are identical except for the backdrop, and the driver's ruling
is that **the backdrop is a user preference, not a design decision** — a toggle
in settings picks which one renders. That is the single most consequential thing
this ticket decides, because it converts the whole art-heavy-vs-quiet axis from
a choice the spec makes into a choice the user makes.

Both are `src/prototypes/variants/BlendSeriesHome.tsx`
(`container: 'separator'`, `playSlot: 'overlay'`, `overlayStyle: 'center'`,
differing only in `backdrop`).

### The unit

A row of **~140dp**, giving **~4.5 series/screen** against the first pass's 3.5.
Left to right:

1. **A fanned cover cluster**, 84dp, max 3 layers.
   - Every layer box is **square**. Artwork is drawn full height and centred:
     a tall cover is pillarboxed over near-black `#0B0B0B`, a wide one is
     cropped evenly. Square boxes are what keep the play glyph aligned down the
     list and make the cluster's width independent of a series' cover shapes.
   - Each layer's right edge sits a constant `PEEK` (`0.10 × size` = 8.4dp)
     beyond the one in front, so the gap reads identically on every row. Back
     layers are shrunk 12% each and darkened 18% per layer.
   - The cluster box is a **constant 100.8dp wide** regardless of cover count
     or shape, so every row's text column starts at the same x.
2. **A centred play glyph on the front cover** — size 40, outlined, fixed
   near-white, no ground and no border, over a **42% black scrim** on that
   cover. One tap = play. This is the "continue in one click" requirement, and
   it costs **zero layout width**.
3. **A text column** carrying, in order:
   - the **series name**, capped at 2 lines, truncating;
   - a meta line — `22 books · 7 finished · #1-22`, with 07's canonical range;
   - a **completion bar** with an `n/total` label;
   - a **next-up line with three states** — `Next · #9 Eric` (between books),
     `Continue · #9 Eric` (mid-book), `Series complete` in success colour.

**Tapping anywhere else on the row opens the series detail screen.**

### Why the play button carries no word

The first pass's `Start`/`Continue`/`Restart` pill cost ~111dp of a 412dp row
(~27%) and caused four separate faults: wrapped titles, variable row height, a
truncated next-up line, and the loss of `N finished` from the meta.

The driver's argument for dropping the word — **and it is the right one** — is
that the state is already stated twice elsewhere: the **progress bar** carries
completion, and the **next-up line** carries what a tap will do, once it
distinguishes mid-book from between-books. So the label was **redundant, not
merely sacrificed**. Adding the third next-up state is what makes this true;
without it the word would still be carrying information.

### What this decides, and what it kills

- **Inline expansion is gone**, and with it the masonry list, `BookGridItem`,
  `overrideItemLayout` and all book cells. This is a plain vertical `FlashList`
  of rows. The nested-horizontal-`FlashList`-in-a-masonry-cell construct — the
  clipped-row bug's only habitat on this screen — no longer exists. Per this
  ticket's own instruction that was a **dividend, not the argument**.
- **`BooksHome` and `BooksGrid` are untouched.** Nothing forked, nothing
  modified; the Series view simply stops being a customer of `BookGridItem` and
  `BooksHorizontal`.
- **The card container lost.** Measured cost: 24dp of padding, worth ~4
  characters of every line. Design continuity with `BooksHome` was tested twice
  across two passes and lost both times, upholding 03's Audible finding.
- **No origin chip on browse.** Provenance is detail-only (unchanged).
- **`series.origin` is unaffected** — the display toggle is a client setting,
  **not** a schema change. The map's running total of 5 columns across 2 tables
  plus `suppressed_series` is unchanged by this ticket.

### Rules the spec must carry

1. **The play affordance is never absent**, and never carries a word. Its target
   is the next unfinished book, or the first book when the series is finished.
2. **Anything drawn on a surface this component darkens must not take its colour
   from the theme.** The glyph is fixed near-white because its ground is the
   42% scrim, not the page. Taking it from `themeColors.icon` made it invisible
   in light mode. The *corner*-style glyph is the exception and correctly keeps
   the theme colour, because it sits on unscrimmed art.
3. **The scrim belongs to the cover, not to the button** — painted inside the
   cover layer so its own `overflow: hidden` clips it. Painted as a sibling, its
   square corners outline the cover as a box over any backdrop.
4. **The separator is `BooksList`'s** — hairline at 0.3 opacity,
   `marginVertical: 9`, inset to clear the cluster so the rule starts under the
   text, plus a `ListFooterComponent` copy so the list terminates on a line.
5. **Row height is variable** — a 2-line title grows the row ~20dp. `Blend
   stack` was the only variant that fixed it structurally and it was not chosen,
   so **the first pass's "predictability over elasticity" ruling does not carry
   forward**. This is a conscious reversal, not an oversight.
6. **Cover geometry** as described above: square boxes, constant peek, constant
   cluster width, pillars for tall art, even cropping for wide art.

### Open, and deliberately not decided here

- **The setting itself** — where it lives, what it is called, what it defaults
  to. Graduated to [12](12-series-display-setting.md).
- **Tablet, font scale, animation, and the detail screen's transition** — all
  still open. The prototype's detail screen is a `Modal`, so push-vs-sheet
  remains untested by construction.
- **Light theme** is *not* fully decided either, but this pass found and fixed
  the first light-mode defect (rule 2 above), so the theme-coupling trap is on
  record.
- **Copy nit:** a fully-read series currently reads `5 books · finished · #1-5`
  rather than `5 books · 5 finished`. That is `seriesMetaLine`'s pre-existing
  shared wording; the spec should decide it deliberately.

### Assets

All fourteen variants live in `src/prototypes/` (throwaway — `rm -rf
src/prototypes` plus three `THROWAWAY` sites in
`src/app/(drawer)/(library)/index.tsx`). `tsc` 0 errors, eslint clean,
jest 484/484.
