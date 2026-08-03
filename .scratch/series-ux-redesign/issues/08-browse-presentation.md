# 08 — Browse presentation: what is the repeating unit?

Type: prototype
Status: resolved
Blocked by: 04, 06, 07
Parent: [map.md](../map.md)

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

## Answer

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

**Resolved with a hairline border** (driver, 2026-08-03):
`borderWidth: StyleSheet.hairlineWidth` on both, `borderColor` tied to the glyph
(`withOpacity(themeColors.icon, 0.4)`) so it tracks the theme rather than
hard-coding a grey. The button is now legibly bounded over bright backdrops and
dark ones alike, with no amber anywhere. **This is a deliberate divergence from
`BookGridItem`, which has no border** — it earns its place because the grid
button always sits on cover art, while these sit on a scrim that can match their
own ground.
