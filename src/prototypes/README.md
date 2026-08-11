# Series prototype harness — THROWAWAY

Built for `.scratch/series-ux-redesign/issues/04-prototype-harness.md`. It exists so
ticket 08 (browse presentation) can be judged against a library that is big, ugly and
varied, on `Pixel_7_Pro`, with no rebuild and no risk to the real database.

**Delete the whole thing when the effort ends** — see [Deleting it](#deleting-it).

## Using it

1. Metro dev build, Library screen, switch to the **Series** view (the Layers toggle).
2. Bottom-left there is a small `proto · Baseline` pill. Tap it.
3. **Variant** picks which browse implementation renders. **Data** picks the dataset.
4. `Log dataset` dumps a formatted block of what is currently rendered — series name,
   book count, forced progress state, canonical numbers, and what each row stresses.
   (Deliberately `console.log`, not `console.table`: the latter does not forward to
   the Metro log.)

Both knobs persist across full JS reloads (AsyncStorage), because navigator work forces
those and losing your place mid-A/B is exactly the friction this removes. When synthetic
data is live the pill carries a coloured dot and the open panel says so in the accent
colour, so a persisted "on" can never be mistaken for the real library.

## The two knobs are orthogonal

Variant and dataset are independent on purpose: a layout that only works on the calm
dataset is as wrong as one that only works under stress, and you cannot see that unless
you can hold one knob still while turning the other.

## Datasets

| Preset       | What it is                                                     |
| ------------ | -------------------------------------------------------------- |
| `Real DB`    | the actual `series` rows on the device — the harness is inert   |
| `Stress ×15` | 15 fabricated series covering every shape ticket 04 listed      |
| `Calm ×3`    | 3 ordinary series — the control                                 |

`Stress ×15` covers, in one list: a 22-book series, a 1-book series, a 95-character name,
~15 series at once, one series each of all-unplayed / mixed / all-finished, three series
sharing the same books, and gaps in canonical numbering (Dresden `1, 3, 4, 8`). It also
carries three shapes ticket 03's research turned up as real: a decimal number (`4.5`),
numbering that starts at 4, and a series with no numbering at all.

## Two constraints worth knowing before you edit it

**Synthetic series may reference only REAL book ids.** `SeriesHome` passes a bare
`bookId` to `BookGridItem`, which re-resolves it from `useLibraryStore`; an invented id
renders as a size-accurate *blank* cell (`BookGridItem.tsx:265`). So a 22-book series over
an 8-book emulator is built by **repeating** real books, never by cloning them with fake
ids. Every cover, title, duration and progress ring therefore stays real, and nothing is
written to the library store.

The repeats are why `variants/BaselineSeriesHome.tsx` is a *copy* of `SeriesHome` rather
than an import: the shipping `keyExtractor` is `${seriesId}-${bookId}`, which collides on
a repeat. The copy adds an index suffix and strips the `[rowprobe]` logging; nothing else
differs, and nothing else should. (The collapsed horizontal row needs no fix —
`BooksHorizontal` passes no `keyExtractor`, so FlashList falls back to the index.)

**Nothing is written to the database.** Schema v32 has no column for a canonical published
number and `DerivedSeries` has no field for one — the very thing ticket 07 still has to
decide. A DB-backed injector could not express the Dresden-gaps dataset this ticket asks
for. Building rows in memory sidesteps the schema *and* makes "clear synthetic series" a
true restore rather than a best-effort cleanup.

`ProtoSeries` is `DerivedSeries` widened with `canonicalNumbers` and `stresses`. Because
the library screen's filters pass objects through by reference, those fields survive the
search/tab pipeline even though its types erase them — variants re-widen with a cast.

## Variants

| Variant       | Ticket | What it is                                                      |
| ------------- | ------ | --------------------------------------------------------------- |
| `Baseline`    | 04     | the Series view exactly as it ships today                        |
| `Numbered`    | 04     | baseline + number badges + collapsed `#1, 3-4, 8` range          |
| `Cards`       | 08     | one full-width card per series; body expands, chevron → detail   |
| `Rich header` | 08     | sections kept; cover backdrop + **static** 4-cover peek          |
| `Picker`      | 08     | thin rows only, no inline expansion — everything on detail       |
| `Rich + play` | 08     | rich header, no chip, no expansion (tap → detail), play button   |
| `Rich + continue` | 08 | same, but a `Continue`/`Start` pill instead of the play icon      |

The last two are one component (`RichPlaySeriesHome.tsx`) behind two registry
rows, one boolean apart — the driver wanted to compare the icon against the
wording without a code edit between looks.

The three ticket-08 variants share `ProtoSeriesDetail.tsx` (the detail screen),
`seriesFacts.ts` (derived counts/next-up/range — data only, no layout) and
`seriesCardParts.tsx` (`CoverCluster` / `OriginChip` / `CompletionBar`). Sharing
the detail screen is deliberate: 08 asks what the **browse** unit is, and three
bespoke detail screens would have made the driver compare six things.

## The detail sheet (ticket 13) — SUPERSEDED, and the route is now REAL CODE

> ⚠ **`ProtoSeriesDetailSheet.tsx` IS DEAD CODE as of implementation ticket 11.**
> Nothing imports it. `src/app/seriesDetail.tsx` and its `Stack.Screen` in
> `src/app/_layout.tsx` are now the **shipping** Series detail sheet
> (`src/components/SeriesDetailSheet.tsx`, spec §C) and **must NOT be deleted
> with the harness** — see [Deleting it](#deleting-it). Everything below
> describes what 13 measured, and the rulings it produced all shipped; the file
> itself is kept only until the harness goes.
>
> The route still resolves through `useSeriesSource()`, so a **synthetic series
> opens the REAL sheet** — which is the fastest way to put the 95-character
> name, the 22-book list and the Dresden gaps in front of the shipping screen at
> font scale 2.0. Two knobs no longer do anything, because only the prototype
> sheet read them: **`Rows`** (the split is the ruling and is now the only
> arrangement) and **`Pinned`** (`series.artwork` is a real column now, and the
> knob lived in `protoStore`). `Backgrounds` is likewise superseded by the real
> `Series Backgrounds` setting.

`ProtoSeriesDetailSheet.tsx`, mounted by `src/app/seriesDetail.tsx` with a
`Stack.Screen` in `src/app/_layout.tsx`. Ticket 13's question was about
*presentation*, and only a real route has one — `ProtoSeriesDetail`'s `Modal`
was flagged as a fidelity caveat by 08 and 10 for exactly that reason.

Reached by tapping a row in the `Blend *` variants (the only ones repointed at
the route; the other five keep the `Modal`, since 08 is resolved).

Three knobs in the panel, all detail-sheet-only:

| Knob | What it stands in for |
| --- | --- |
| `Backgrounds` | ticket 12's `Series Backgrounds` column, which 11 widened to govern this hero. Default ON, per 12. |
| `Rows` | `split` (cover plays, text → `titleDetails`) vs `whole` (11's one-target row). **`split` is the ruling**; `whole` is kept so the A/B survives. |
| `Editor` | `real` opens the shipping editor at `/seriesEditor` (a root `transparentModal` since implementation ticket 12 — it was `series/edit/[id]`, an opaque push, when this knob was written); `proto` opens `ProtoSeriesEdit` and its pinned-artwork caption. |

**It writes to the database — a deliberate exception to the harness rule above.**
"Rows play for real" is inherently stateful: `handleBookPlay` stamps
`last_played_at`, promotes `NotStarted → Started`, and restart-from-zero adds a
chapter-index/progress reset. Synthetic *series* are still pure memory; only the
real books they point at move.

**Harness artifact worth knowing before you read anything into it:** playing a
real book from a *synthetic* series collapses that series' fabricated progress
to the real values, because `reconcileProgress`'s `hasMix` flips the moment any
member book is touched (`seriesFacts.ts:139-158`). Expect the meta line and the
completion bar to change under `Stress ×15` as soon as you play anything.

### Play-glyph house style (driver, 2026-08-04)

**The darkening is the glyph, never the artwork.** `fill` = 0.42 black, stroke =
fixed near-white, and *no* scrim, disc or badge outside the play shape. Used
both here and on the browse row's glyph over the fanned cluster, so
`CoverCluster`'s `frontScrim` is now `0` on the winning variants. Two rejected
predecessors, do not reintroduce: a full-cover 42% scrim (turned a 22-row list
into 22 identical buttons) and a 26dp disc (a smaller darkened patch is still a
darkened patch).

## The edit screen (ticket 10)

`ProtoSeriesEdit.tsx`, opened from the detail screen's `Edit series` row. Not a
variant — there is only one, because ticket 10 settled *that* correction is the
edit screen and asked only what the screen has to grow to hold:

- a pressable series cover + `ImagePlus` badge, parity with `editTitleDetails`
- a per-row canonical-number field (ticket 07's override, finally sited)
- `Sort by number`, which 07 declined purely for having nowhere to live

Two things it exists to have made visible, both now findings on ticket 10:
**sorting silently changes the series artwork** (08: art follows the first book),
and **the number field cannot use a numeric keyboard**, because 07's
`canonical_number` is a string holding `14b` and `1-3` and Android's numeric
input types exclude letters.

Rows draw a grip but do **not** drag: `react-native-sortables` is deliberately
not wired, since the shipping screen's drag is already device-verified and the
question was what fits in a row.

Two traps already paid for, do not re-introduce:

- **`bookProgressValue` is a tri-state enum (0/1/2), not a fraction.** Averaging
  it renders "1 of 7 finished" as 50%. Completion is a count — see `seriesFacts.ts`.
- **A fanned cover stack needs its offset to outpace its shrink.** Equal rates
  right-align every layer, the front one occludes the rest, and a 22-book series
  draws as one lone cover. See `CoverCluster`.

## The series line (ticket 14) — `ProtoSeriesLine.tsx`

Four placements of the series line on the REAL `titleDetails` route, cycled from
a pink pill bottom-left (`Off (control)` / `Subheading` / `Byline` / `Chips` /
`4th card`). Not a `ProtoPanel` knob — that panel is bound to the library
screen's rendered series list, and 14 has exactly one knob.

**`Subheading` is the ruling.** The other three are kept so the A/B survives.
Two things it does that the others do not, both driver rulings and both amending
ticket 10: it shows **ONE** series (largest DETECTED; user-created fallback keeps
"first created"), and it is **STATIC** — not tappable.

Two traps if you touch it:

- **`subheadingRow`'s `marginTop: -17` is load-bearing.** `bookInfoColumn` sets
  `gap: 20` between every child; the target gap is the one `Read by` has above
  the narrator's name, which is *no gap at all*. The 20dp below is deliberate.
- **The control is not cosmetic.** `Off` is how you see that `titleDetails` has
  no vertical slack — `Continue Listening` sits exactly at the fold.

## The create flow (ticket 15) — `wizard/`

Create-flow shapes on the throwaway route `src/app/seriesCreateProto.tsx`,
reached from a pink pill bottom-left on the Series view. A second `‹ ›` pill
inside the route cycles them.

| Variant | Shape | Screens |
| --- | --- | --- |
| **`E · Editor + author panel`** | editor surface; `Add books` runs `Authors → Books` in a panel; Order in the list | 2 taps of Next |
| **`F · Author accordion`** | same surface; tap an author and their books unfold in place — no Authors step | 1 tap of Next |
| `A · 3 steps (fixed)` | today's `Authors → Books → Order`, 05's defects fixed | 3 |
| `B · Pick → Arrange` | the Authors STEP becomes a search FIELD | 2 |
| `C · One screen` | name + search + an inline reorderable selection | 1 |
| `D · Create-then-edit` | a name prompt, then the editor | prompt + editor |

**Status: UNDECIDED.** The shape will be a version of E or F; which one, and what
exactly it looks like, is not yet known. **A–D were rejected on 2026-08-04** and
stay in the switcher unchanged as the comparison record — rewriting a rejected
variant destroys the evidence for why it was rejected. **E and F are the live
pair**, and they differ in exactly one place: the panel. Everything below the identity row is literally the same
code (`editorShell.tsx`), which is what makes them readable as an A/B rather than
as two designs — **so fixes belong in `editorShell.tsx`, never in one variant.**

Five things worth not re-deriving:

- **The "screen jumps on every selection" bug is structural.** The picker panel
  and the ordered list share one `ScrollView`, so anything committed above the
  panel *must* move it. E stages selections until `Next`: measured at **547,334
  changed pixels per tap in D vs 28,488 in E**, and 0 above the panel.
- **E's numbering rule is the driver's, and it is the schema's.** Boxes start
  empty; `Sort by number` puts blanks last (alphabetical among themselves); an
  untouched list is numbered `1..n` from its final drag order at save. Blank means
  `canonical_number = null`, matching ticket 07 — and `Sort by number` stays a
  MANUAL action, because 07 gave `position` sole sort authority.
- **Density is NOT what decides E vs F, and two mitigations are CLOSED.** A single
  flick reaches the bottom of the author list, so no A-Z rail. And a filter/search
  field is worse than scrolling: it re-scopes the surface, so building a list
  spanning 10 authors becomes 10 × filter → select → clear. **That argument also
  retroactively explains why B's search field lost** — search is a filter — and
  why E and F are immune: staging keeps your selections when you change author.
- **What actually separates E from F:** F saves exactly **one** press, always (a
  constant, not a growing saving). E is the only one that ever puts all candidate
  books on **one** surface. So E suits many-author picks, F suits single-author
  ones — which is the same axis as "what is the wizard for", still unanswered.
- **`fontSize.base` is 20 in this repo, not 16** (`sm` is 16, `xs` is 12), and
  E's 13px cells are a literal because nothing sits below 16. F using `base` looks
  like an oversight and isn't — it was "corrected" to 15 once and reverted as too
  small. **Do not shrink F's rows again.**

- **Step 1 of the shipping wizard is a filter, not a stage.**
  `selectedAuthorNames` reaches the validator and the `rows` builder and nothing
  else; `createSeries(name, orderedBookKeys)` never sees it.
- **05's "large dead vertical region" is NOT a layout bug.** This was claimed
  while building (missing `flex: 1` on the wizard's `FlatList`s) and **refuted
  on device** — the shipping footer is already pinned. The void is the wizard
  having too little on each screen.
- **Switching variants resets the draft**, on purpose. Two shapes compared in
  two different states is not an A/B.

Steps are component state, not routes — a deliberate fidelity limit, since 05
settled presentation and 15 forbids reopening it. Hardware back is wired to
"previous step" via `useHardwareBack`. Nothing writes to the database.

**`authorPad` is a harness knob, not a feature.** E's author grid exists to answer
"can two columns carry 50–100 authors?", and this device has eight. The pink chip
under the grid pads it to ~100 with **non-selectable, dimmed** synthetic names —
non-selectable because they carry no books, so a padded pick can never produce an
empty book step. Persisted, and ON by default.

## The detection probe (implementation ticket 04) — `detectionProbe.ts`

The `Detect series (log)` chip in the panel's bottom row. **It is the one control here
that ignores both knobs**: it reads the REAL database through
`src/db/detectionQueries.ts` and runs the REAL cascade
(`src/helpers/seriesDetection.ts`) at both fidelities, printing a listing formatted to
diff line-for-line against
`.scratch/series-ux-redesign/research/02-detection-cascade/SERIES_LISTING.txt`.

Writes nothing — the write is implementation ticket 06, which wires the same two modules
into the scan. **Only `detectionProbe.ts` and the chip are throwaway**;
`detectionQueries.ts` and `helpers/detectionUnits.ts` are production code 06 consumes, so
deleting the harness must not take them with it.

Two lines of its output are worth reading before the listing:

- **`OUTSIDE ROOTS`** — books under no configured library folder, dropped rather than
  given an absolute `rel` (folder-rule depth is load-bearing). Non-zero means stale
  library settings.
- **`structural keys: n/n agree with the library store`** — cross-checks the one-query
  first-chapter read against `bookStructuralKey`. Anything but `n/n` means every
  membership row 06 writes would be keyed wrong.

Counts run **higher** than `SERIES_LISTING.txt` by design: the research probe sampled at
most two files per directory. A higher number is the corpus being incomplete; only a
different *grouping* is a bug.

## Adding a variant

1. Copy `variants/BaselineSeriesHome.tsx`, change what you are testing.
2. Add one row to `VARIANTS` in `variants.ts`.
3. Fast-refresh. It is in the switcher.

Prototype code is throwaway: no jest, no tablet pass, no font-scale pass. It does hold the
repo's `tsc`/eslint-zero-errors line, because breaking that costs every other session time.

## Footprint in real code

Three edits in `src/app/(drawer)/(library)/index.tsx`, all marked `THROWAWAY`:

- `useDerivedSeries()` → `useSeriesSource()`
- `<SeriesHome …>` → `<SeriesProtoSlot …>`
- the two imports for those

Plus **four** throwaway mounts and one import in `src/app/titleDetails.tsx`
(ticket 14), all marked `THROWAWAY`: `<ProtoSeriesLine slot='title'>` under the
book title, `slot='text'` under Author/Narrator, `slot='cards'` inside the info
card row, `<ProtoAddToSeriesMenuItem>` in the overflow, and
`<ProtoSeriesLinePill>` at the screen root.

Plus **one line** in `src/app/seriesDetail.tsx` — that route is now SHIPPING code
(implementation ticket 11), and its only harness footprint is the same
`useDerivedSeries()` → `useSeriesSource()` substitution the library screen
carries, marked `THROWAWAY`. **The route and its `<Stack.Screen>` stay.**

Injecting the data *above* the screen's search/tab/count pipeline is what makes the
tab-filtering dataset meaningful: `countSeriesByState`, `filterSeriesBySearch` and the tab
filter all run over synthetic rows exactly as they run over real ones, with no branching in
real code.

In a production build `__DEV__` is false: `useSeriesSource` returns the real store output
and `SeriesProtoSlot` renders the real `SeriesHome`. No variant or panel module is reached.
The one production cost is a single Zustand selector over a store that never changes.

## Deleting it

```
rm -rf src/prototypes src/app/seriesCreateProto.tsx
```

⚠ **`src/app/seriesDetail.tsx` IS NOT ON THAT LIST ANY MORE, and neither is its
`<Stack.Screen>`.** Implementation ticket 11 made both shipping code — the
Series detail sheet is a real route now. What it needs instead is **one line
restored**: re-import `useDerivedSeries` from `@/store/seriesStore` and call it
where `useSeriesSource()` is called, exactly as in the library screen below.
`src/components/SeriesDetailSheet.tsx` never referenced the harness at all.

then remove the four `THROWAWAY` mounts and the `@/prototypes/ProtoSeriesLine`
import from `src/app/titleDetails.tsx`, remove the
`seriesCreateProto` `<Stack.Screen>` from `src/app/_layout.tsx`, remove the
`<ProtoWizardPill />` mount and its import from
`src/app/(drawer)/(library)/index.tsx` (ticket 15), and
in `src/app/(drawer)/(library)/index.tsx` restore the three `THROWAWAY` sites:
re-import `SeriesHome` from `@/components/SeriesHome` and `useDerivedSeries` from
`@/store/seriesStore`, and put both back at their use sites. `src/components/SeriesHome.tsx`
was never modified, so there is nothing to revert there.

**DO NOT revert the `TableOfContents` icon on `Remove Auto-Chapters`**
(`titleDetails.tsx`). It looks like harness fallout and is not: ticket 14 found
`Layers` doing double duty — the library's Series-view toggle AND that row's
glyph — and the driver ruled series keeps `Layers`. That change **ships**.

## Tablet width and font scale (ticket 16)

Resolved 2026-08-05 and **built into the harness**, so anything added from here
inherits it. `CONTENT_CAP = 600` lives in `seriesCardParts.tsx`.

**The rule.** The **browse row's** content caps at `min(width, 600)dp` and stays
**left**-anchored; the cover cluster is a constant `CLUSTER_SIZE / 411` of that
cap. `variants/BlendSeriesHome.tsx` derives both in `useRowGeometry()`.

**The cap is browse-row ONLY.** It was applied to the series info page too, built,
and reverted on sight — *"the entire page's content is now restricted"*. The two
surfaces absorb it differently: the browse row bleeds its backdrop and hairline
the full width so the cap sits inside paint and is nearly invisible, while the
info page has **no full-bleed paint** and the same rule reads as content shoved
into the left 600dp. Nothing was lost, because the cap was never what fixed the
info page's defect — see `rowText` below.

**Cluster SIZING still scales on both surfaces**, and that is a different rule
from the layout cap. `heroClusterSize()` — now shipping, in
`src/helpers/seriesRowGeometry.ts`, alongside the browse row's — uses the hero's
own anchor (`HERO_CLUSTER_PHONE_SIZE / 411`) against the same clamp, so the hero
fan keeps its 1.24× lead over the browse fan at every width. **Scaling one and not
the other inverts the hierarchy** — that shipped for about ten minutes and the
driver caught it: the browse fan hit 147dp while the hero stayed 124.8dp, making
the *overview's* artwork bigger than the *detail's*. Any new cluster takes its
phone size divided by 411 — never a literal.

Four things not to re-derive:

- **The cap is a no-op on a phone, by construction.** `84 / 411` reproduces
  today's cover size exactly at 411dp; it was verified against a pre-change
  capture. If a phone layout ever moves, the fraction is wrong, not the cap.
- **PAINT IS NOT CAPPED.** The backdrop and the hairline rule still bleed to
  both screen edges — capping them puts visible edges on the row and reads as
  the card 08 measured and rejected. Left-anchoring (not centring) is equally
  deliberate: it keeps the heaviest part of the scrim under the text.
- **Type is never scaled with width**, only padding and the leading visual.
  Material and HIG both hold the type scale constant across window size classes,
  and `normalizeSize.ts:49-62` records this repo paying for a width multiplier
  once. Note **no Series surface calls `normalizeSize`** at all.
- **The wizard is exempt.** The book picker's radio and the order screen's drag
  grabber are *targets* and keep the screen edge. The info page's finished ✓ is
  an *indicator*, so `rowText` is **`flexShrink: 1`** (not `flex: 1`) and the tick
  sits against the title — this alone closes the 416dp gulf the cap was aimed at,
  at any width, which is why reverting the cap cost nothing.

`TALLY_DROP_FONT_SCALE = 1.3` in `BlendSeriesHome.tsx` drops `M finished` from
the meta line so the canonical range survives. **The threshold is a prototype
proxy** — the shipping rule should drop the segment when the line actually
overflows. `RANGE_RUN_CAP = 3` in `syntheticSeries.ts` bounds the range itself;
before this it was unbounded and an alternating 41-book series emitted ~70 chars.

### Running the tablet AVDs

`Pixel_Tablet` (800×1280dp) and `7_Tablet` (**sw635dp at 272dpi** — not the
540dp its `config.ini` density implies). Both needed setting up:

```
adb -s <serial> install -r -d android/app/build/outputs/apk/debug/app-debug.apk
adb -s <serial> reverse tcp:8081 tcp:8081
adb -s <serial> shell am start -a android.intent.action.VIEW \
  -d "sonicbooks://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081"
```

**`10.0.2.2:8081` does NOT work on a second emulator** — Expo only wires
`adb reverse` for devices attached when it starts, so use the reverse plus
`localhost`. Each tablet carries its own small library (9 and 11 books), which is
enough: synthetic series reference real book ids, so any pool will do.
