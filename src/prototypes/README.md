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

## The detail sheet (ticket 13) — the one part that is a REAL ROUTE

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
| `Editor` | `real` pushes the actual `series/edit/[id]`; `proto` opens `ProtoSeriesEdit` and its pinned-artwork caption. |

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

Plus two files ticket 13 needed, because a route cannot live in `src/prototypes/`:

- `src/app/seriesDetail.tsx` — the route (renders `null` outside `__DEV__`)
- one `<Stack.Screen name='seriesDetail'>` in `src/app/_layout.tsx`

Injecting the data *above* the screen's search/tab/count pipeline is what makes the
tab-filtering dataset meaningful: `countSeriesByState`, `filterSeriesBySearch` and the tab
filter all run over synthetic rows exactly as they run over real ones, with no branching in
real code.

In a production build `__DEV__` is false: `useSeriesSource` returns the real store output
and `SeriesProtoSlot` renders the real `SeriesHome`. No variant or panel module is reached.
The one production cost is a single Zustand selector over a store that never changes.

## Deleting it

```
rm -rf src/prototypes src/app/seriesDetail.tsx
```

then remove the four `THROWAWAY` mounts and the `@/prototypes/ProtoSeriesLine`
import from `src/app/titleDetails.tsx`, remove the `seriesDetail`
`<Stack.Screen>` from `src/app/_layout.tsx`, and
in `src/app/(drawer)/(library)/index.tsx` restore the three `THROWAWAY` sites:
re-import `SeriesHome` from `@/components/SeriesHome` and `useDerivedSeries` from
`@/store/seriesStore`, and put both back at their use sites. `src/components/SeriesHome.tsx`
was never modified, so there is nothing to revert there.

**DO NOT revert the `TableOfContents` icon on `Remove Auto-Chapters`**
(`titleDetails.tsx`). It looks like harness fallout and is not: ticket 14 found
`Layers` doing double duty — the library's Series-view toggle AND that row's
glyph — and the driver ruled series keeps `Layers`. That change **ships**.
