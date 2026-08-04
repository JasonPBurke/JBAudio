# 13 — Build the detail sheet: does a push over a live sheet survive?

Type: prototype
Status: resolved
Blocked by: 11
Parent: [map.md](../map.md)

## Question

[11](11-series-detail-contents.md) decided the series detail screen's contents
in full, but resolved **without building anything** — and one of its decisions
is explicitly conditional:

> Driver, 2026-08-04: **"(A) with a prototype check"**, and **"(C) as a backup."**

**Does an opaque `slide_from_right` push over a live `formSheet` behave on
Android — or does the editor have to move out of the `series` group?**

Secondary, and only answerable by thumb: **do 41 tappable rows need a visible
play glyph?**

## Why the existing harness cannot answer this

[04](04-prototype-harness.md)'s harness renders `ProtoSeriesDetail` inside a
`Modal`, which 08 and 10 both flagged as a fidelity caveat. A `Modal` is not the
navigator, so it says nothing about presentation. This is **the first question on
this map that needs real routes** — and per the map's own note, navigator
`screenOptions` changes do not apply via fast refresh, so every tweak costs a
full JS reload.

## What to build

1. **A real route** `src/app/seriesDetail.tsx` plus a `Stack.Screen` in
   `src/app/_layout.tsx` with `presentation: 'formSheet'`,
   `sheetShouldOverflowTopInset: true`, `sheetCornerRadius: 15` — matching
   `titleDetails` (`_layout.tsx:242-249`). Comment it as throwaway; this is the
   only real-code footprint, and 04's precedent is three commented lines.
2. **Port `ProtoSeriesDetail`** onto it: grab handle only (no nav row, no ⋮),
   scrimmed backdrop behind the hero, front card driven by a **synthetic**
   pinned override — `series.artwork` does not exist yet and the harness writes
   nothing to the DB.
3. **A harness toggle standing in for `Series Backgrounds`**, so the hero's
   ON/OFF states can be compared side by side.
4. **Wire the wrench row to the REAL editor** (`series/edit/[id]`), not
   `ProtoSeriesEdit`. This is the whole point — it exercises the sheet→push
   transition *and* proves `Save`'s `exitGroup()` lands back on the sheet.
5. **Rows play for real** via `handleBookPlay`, with restart-from-zero on
   finished rows and `LoaderKitView` bars on the active one.
6. **The pin caption** on `ProtoSeriesEdit` — both states, revert nulls the
   override.

## What resolves this ticket

- **(A) confirmed or (C) adopted.** If the push flickers, drops the sheet, or
  reads wrong, move `series/edit/[id]` out of the group to a root
  `transparentModal` matching `editTitleDetails` — and re-check
  `seriesDraftStore`'s reset-on-group-entry lifetime, which the group boundary
  currently owns.
- **A ruling on the row play glyph.**

## Constraints

- **`Delete`'s exit is broken by 11 and this prototype will show it**:
  `handleDelete` → `exitGroup()` (`edit/[id].tsx:182`) pops the group and reveals
  the detail sheet of a deleted series. `ProtoSeriesDetail` returns `null` on a
  missing series, so it is a blank sheet. Fixing it is the build effort's; seeing
  it is this ticket's.
- **08's theme-coupling trap**: the hero's scrim is painted by the component, so
  anything on it must be coloured against that surface, not the palette.
- The emulator's series set is volatile — screenshot first, then script taps.
  `adb shell dumpsys window | grep mCurrentFocus` before driving the UI; `pidof`
  does not prove foreground.

## Answer

Resolved 2026-08-04. Built on a real route and measured on `Pixel_7_Pro`.
Evidence (screenshots, 30fps frame strips, screen recordings) in
[`assets/13-detail-sheet/`](../assets/13-detail-sheet/).

### Headline: (C) ADOPTED — the opaque push is the ONLY thing that misbehaves

The push is not broken, it is **ugly on the way back**. It presents fine, the
editor renders over the live sheet, and `Save` / `Cancel` / hardware back all
land on the sheet with its **scroll offset preserved pixel-exact** — so the
sheet is never remounted. But popping the group does **not reveal** the sheet:
it reveals the **library** for ~5 frames (~165 ms at 30 fps) and the sheet then
**re-presents** with a full `slide_from_bottom`. A double transition, showing a
screen the user did not ask for.

Three presentations were measured launched from a live `formSheet`:

| Presentation | Example | Return |
| --- | --- | --- |
| opaque push | `series/edit/[id]` today | library ~165 ms, then sheet **re-presents** ❌ |
| `transparentModal` | `editTitleDetails` (shipped) | clean cross-fade, sheet revealed underneath ✅ |
| `formSheet` | `titleDetails` (shipped) | clean slide-down, sheet revealed underneath ✅ |

The two shipped patterns are both clean, so this is not "Android is bad at
sheets" — it is specifically the opaque push detaching what is under it.
**Driver ruling: adopt (C)** — `series/edit/[id]` becomes a root-level
`transparentModal` matching `editTitleDetails`. The `formSheet` editor was
offered (sheet-over-sheet is now proven) and **rejected**: 05 chose a push
because the editor is a *task flow* with a Save/Cancel footer, not a container,
and that reasoning survives the presentation change.

### CORRECTION: (C)'s cost was overstated by both 11 and this ticket

Both said the group boundary owns `seriesDraftStore`'s reset-on-entry lifetime
and that (C) must "re-check" it. **It owns nothing.** `series/_layout.tsx` is a
bare `<Stack screenOptions={{ headerShown: false }} />`; its docstring claims
"reset on entry" but every reset actually lives on a **screen**:

- `edit/[id].tsx:66-74` seeds via `resetForEdit`, keyed on draft identity so it
  is a no-op once seeded;
- `edit/[id].tsx:82-87` `beforeRemove` → `resetForCreate()` (gesture/hardware back);
- `edit/[id].tsx:136 / :156 / :181` Cancel / Save / Delete reset explicitly;
- `create/authors.tsx:31` guards on `mode === 'create'`;
- `(library)/index.tsx:246` resets before entering the create flow.

So moving the editor out of the group **orphans no reset**. It also *simplifies*
`exitGroup()`: with the editor a root sibling, `navigation.getParent()` is
undefined, the existing `?? navigation` fallback takes over, and the call
collapses to a plain `goBack()` that pops exactly the editor — correct by
construction rather than by coincidence.

**The one thing the build effort must actually re-check** is the `Add books`
sub-flow (`edit/[id].tsx:238` → `/series/create/authors`), which would then
cross from a root modal *into* the `series` group. `beforeRemove` still will not
fire (the group pushes on top rather than removing the editor), and the
`mode === 'create'` guard still protects the draft — but the return leg is
untested.

### Rows: SPLIT — the cover plays, the words explain

The secondary question arrived as "do 41 rows need a play glyph?" and the driver
**rejected the framing**: a glyph is only worth its pixels if it
*discriminates*, and it can only discriminate if the row has two targets. So the
glyph and the targets are one decision.

**Ruling: split.** The cover (with the glyph) plays; the text opens
`titleDetails`. This restores the app-wide rule that a book card is tappable to
its details — **this screen was the only place in the app that broke it** — and
it is the arrangement `BookGridItem` already uses.

**11's "no route to `titleDetails` at all" is therefore REVERSED, and it was
never a technical finding.** It fell out of the driver's "the whole row plays"
choice; one target cannot have two destinations. The technical question it
implied — can `titleDetails`, a root `formSheet`, present over `seriesDetail`,
another root `formSheet`? — **was never asked**, and nothing in this app stacks
two sheets today. Measured: it presents fully (own handle, own ⋮, mesh gradient
intact) and the return is a proper sheet dismissal revealing the series sheet
already underneath. Two lines of code, the same call `BookGridItem` makes at
`:182-188` — and `setTitleDetailsNavIntent()` is **mandatory**, since
`TitleDetails` dismisses itself on mount without it.

**The scrim did not shrink to a badge — it shrank to the GLYPH.** Copying 08
verbatim was wrong and the first build showed it: a 42% rectangle over every
46dp cover turned a 22-row list into 22 identical buttons and no book was
identifiable. 08's licence — *"we can lose artwork detail here without a real
sacrifice as the art is just a series visual representation"* — applies to an
84dp cover **standing in for a series**, not to a 46dp cover that **is a book's
identity** in a list the user scans to find one.

A 26dp disc was built first and **rejected by the driver**: it is still a patch
of darkened cover, just a smaller one. The ruling is that the darkening belongs
**inside the play shape** — the same 0.42 black is the triangle's `fill`, the
near-white stroke is its border, and **every pixel outside the triangle is
untouched artwork**. Same opacity 08 measured and 12 froze, so contrast under
the glyph is unchanged from the treatment already signed off; the only thing
that changed is the *shape* of the region paying for it. Both colours stay
fixed rather than theme-derived, per 08's light-theme defect.

**The play target is the whole leading half** — number plus the full height of
the artwork, not the glyph — so the glyph advertises the target without being
it. Both halves carry the row's vertical padding so `split` and `whole` render
at identical row heights and the A/B stays honest.

### Restart-from-zero KEPT — and `BookGridItem` is now marked for correction

The split hands back the escape hatch whose absence 11 used to justify
restart-from-zero, so the ruling was re-opened. **Driver kept it**, on the
grounds that landing 30 seconds from the end of a finished book is a poor
outcome whether or not you can seek out of it.

**This flips the map's out-of-scope entry.** It read *"a known, accepted
inconsistency — same book, two surfaces, two behaviours — not an oversight."*
The driver's instruction is the opposite: **`BookGridItem` should be corrected
to match this better behaviour.** Still out of scope *here* (it is a
book-screen change, not a series one), but it is now a **carried commitment,
not an accepted divergence**. Recorded on the map and in memory.

### `Delete` is broken, and worse than 11 predicted: a WHITE sheet

11 predicted `handleDelete` → `exitGroup()` would land on "the detail sheet of a
deleted series… a blank sheet". Verified on a throwaway series — and it is not
blank, it is **full-screen white**. The route resolves nothing and renders
`null`, and `titleDetails`-style options set **no `contentStyle` background**;
`player` does (`_layout.tsx:239`), `titleDetails` does not and gets away with it
because it always has content. There is no grab handle either — that lives in
the route body — so the only escape is system back.

Two fixes the build effort owes, not one:

1. `handleDelete` must pop **past** the sheet, not onto it.
2. The `seriesDetail` screen needs `contentStyle: { backgroundColor: … }`, or any
   empty state on it is a white flash on a dark-theme app.

### Everything else 11 specified, verified working

- **Presentation.** `formSheet` + `sheetShouldOverflowTopInset` + corner radius
  15, matching `titleDetails`. Grab handle only; no nav row, no chevron, no ⋮.
- **Hero honours `Series Backgrounds`.** Both states built. OFF is markedly more
  legible; ON is richer — the same trade 08/12 made on browse, which is what
  makes one toggle governing both coherent. Scrim is constant across states, per
  12. A vertical fade at the foot was needed that nobody had specified: without
  it the backdrop's bottom edge is a hard seam across the middle of the sheet.
- **Pinned art rides the fan's front card**, replacing card 0, cluster width
  unchanged — and the **hero backdrop follows it too**, since the backdrop reads
  `cluster[0]`. Both caption states work (muted *Using first book's cover* /
  pressable *Use first book's cover instead*), and revert restores the derived art.
- **Rows play for real**, `LoaderKitView` bars on the active row, and
  restart-from-zero verified by the floating player showing **full duration**
  after tapping a finished row.

### New findings worth carrying

- **A non-square pinned cover pillarboxes** inside `CoverCluster`'s square box —
  visible black bands either side of the front card. Book covers are mostly
  square so this rarely bit; **searched-for *series* art often will not be**, and
  the artwork override is exactly where non-square art enters.
- **`bookProgressValue` stays `Finished` after a restart**, so the row keeps its
  ✓. Reads as defensible (you *have* finished it; you are re-listening) but it is
  a judgement, not a given.
- **Harness artifact, not a design finding:** playing a real book from a
  *synthetic* series collapses that series' fabricated progress to the real
  values — `reconcileProgress`'s `hasMix` flips once any real book is touched
  (`seriesFacts.ts:139-158`). Expect the meta line and completion bar to change
  the moment you play anything under `Stress ×15`.
- **05's invisible-label defect is still live**, and it is specifically the
  **disabled** state — it hits the editor's `Save` as well as the wizard's
  `Next`. Already logged in 05's fog item; now confirmed on two screens.

### Real-code footprint

Two files, both marked `THROWAWAY`: `src/app/seriesDetail.tsx` (the route) and
one `<Stack.Screen>` in `src/app/_layout.tsx`. Everything else lives in
`src/prototypes/`. `ProtoSeriesDetail.tsx` (08's `Modal`) is left untouched and
still serves the five older variants; only `BlendSeriesHome` was repointed at the
route. tsc 0 / eslint 0 errors / jest 484.

**Note the harness now writes to the DB** — a deliberate exception to ticket
04's rule, because "rows play for real" is inherently stateful (`last_played_at`,
`NotStarted → Started`, and the chapter-index/progress reset). Synthetic
*series* remain pure memory; only the real books they point at move.
