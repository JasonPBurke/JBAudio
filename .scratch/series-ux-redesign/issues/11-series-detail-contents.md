# 11 — Series detail screen: what does it hold?

Type: prototype
Status: resolved
Blocked by: 08
Parent: [map.md](../map.md)

## Question

[08](08-browse-presentation.md) settled that a series detail screen **exists**
and what its **job** is. It deliberately did not decide its **contents**.
What goes on it?

## Why its job got bigger than expected

08 chose a browse row that does not expand. That makes this screen the **only**
route to:

- a series' books at all (browse shows a static peek plus `+N`);
- a series' **full name** (browse caps at 2 lines and truncates);
- a series' **provenance** (the origin chip was removed from browse entirely);
- **editing** a series — 08 dropped the `Pencil` that
  `SeriesHome.tsx:279` puts on every browse row, and did not replace it.

So this is not a "nice to have" screen. Every affordance the browse redesign
shed has to land here or be lost.

## Already decided — do not re-open

08 built and device-verified a first pass
(`src/prototypes/ProtoSeriesDetail.tsx`). These carry over:

- **Hero**: fanned cover cluster + name + meta line + origin chip + completion
  bar + a `Start`/`Continue`/`Restart` button.
- **Name capped at 4 lines**, tappable to expand when it overflows, with **no
  `Show full name` label** — the ellipsis is the affordance. The title is a
  control *only* when it overflows (not `disabled`: TalkBack reads that as
  dimmed). Overflow is **measured** with an off-screen uncapped copy, because a
  capped `<Text>` cannot distinguish "exactly 4 lines" from "clipped at 4".
  4 lines ≈ 104dp ≈ the cover cluster's height.
- **Book list**: one row per book, `#canonical` or `–` when unknown (07: blank
  when unknown, never invented), cover, title, author, finished check.
- **Row covers sit in a fixed-width box** so a wide cover can never shove that
  row's title right and ragged the column. Covers still take their true shape.
- The `Fix this series` row in the prototype was a **placeholder with no defined
  behaviour**. It is not part of the answer — see *Editing*, below.

## The decisions

1. **Series artwork.** Driver-confirmed (2026-08-03): art derives from the
   **first book** and **follows** a reorder rather than pinning. It can also be
   **overridden**, two ways, both wanted: an online lookup (parallel to
   `/coverArtSearch`, which `editTitleDetails.tsx:78` already routes to) **and**
   picking one of the member books' covers. Open: whether an override needs its
   own column or rides 09's per-aspect ownership pattern, and whether the
   online path inherits the known **orphaned-artwork leak** for a new object
   type — nothing in `src/` cleans up cover files today, so adding a second
   producer of them needs care. Picking a member book's cover is free by
   comparison: no new file, nothing to orphan.

2. **Series description.** Driver-confirmed: it exists, and it is **protected
   from rescan the way `name` is** — so it needs a `*_source` companion under
   09's per-aspect model. Open: where it renders, how long, whether it collapses.

3. **The three-dot menu.** Driver's proposal, mirroring `titleDetails.tsx:296`
   (`EllipsisVertical` → `Modal` menu). Confirmed to hold **Edit series**,
   **Change artwork**, **Delete**. Open: what else. Note **Delete carries extra
   weight now** — with split/merge ruled out of scope, delete-and-rebuild is the
   sanctioned repair of last resort, so this menu is on that path.

4. **Editing is detail-only.** Driver-confirmed: the `Pencil` does **not** come
   back to browse — it would re-clutter the space the redesign cleared. Accepted
   cost: editing goes from 1 tap to 2. This screen owns the entry point.

5. **Transition.** The prototype used a `Modal`, so push-vs-sheet is **untested
   by construction**. 05 chose push for the wizard on a "you have left the
   library" argument that may not transfer — a detail screen is not a modal task
   flow. Decide deliberately; do not inherit.

6. **07's deferred "Sort by number" action** — re-seeds `position` from
   canonical on demand. 07 declined it purely for having nowhere to live. This
   screen or 10's, whichever fits.

## Constraints

- **06: identity is `name` alone.** Renaming changes identity; duplicate-name
  rules apply.
- **07: `position` is the sole sort authority**; canonical only seeds it, and
  the badge is blank when unknown.
- **05: the wizard is the app's only opaque full-screen push.** Whatever this
  is, think hard before making it a second.
- **A book cell can only render a book in the library store** — or render from
  the `Book` objects `DerivedSeries.books` already carries, which is what the
  prototype does.

- **12 made the artwork override binding, and gave it a ship-order.** Decision 1
  above was already driver-confirmed; what changed is that
  [12](12-series-display-setting.md)'s shipped `Series Backgrounds` info copy
  **promises it in the product** — *"you can search and replace the series art
  used as the background"*, and its **"by default"** only parses if the override
  exists. So this screen no longer decides *whether* the override exists, only
  how it works, and the build effort must ship it **before or with** that dialog
  or the copy describes something the user cannot do.

- **12's interaction worth knowing before siting the override's entry point:**
  with `Series Backgrounds` **OFF**, a series artwork override has **nowhere to
  appear on the browse screen** — 08's cluster renders *book* covers, not series
  art — so in that state the override is visible only on this screen. The
  override's value is therefore partly gated by a display preference the user set
  elsewhere.

- **12 also fixed the setting's reach at the browse row only**, deliberately so
  this ticket is not pre-committed: whatever header this screen lands does **not**
  have to work in two states. If a design here *wants* governing by that toggle,
  widening it is a fresh decision, not an inherited one.

## Notes

04's harness takes a new variant by copying a file and adding one row;
`ProtoSeriesDetail.tsx` is already shared by three variants.

## Answer

**A `formSheet` whose rows play, with no ⋮ and no back chevron.** Resolved by
grilling with the driver, 2026-08-04. **No prototype was built this session** —
the decisions are complete, the on-device verification is
[13](13-detail-sheet-prototype.md).

### 0 — This ticket was smaller than its body claimed

Written 2026-08-03; [10](10-correction-surface.md) resolved 2026-08-04 and took
four of its six decisions. Confirmed with the driver before starting:

| 11's decision | Status |
| --- | --- |
| 1. Series artwork | Mostly 10's — editor, web search only, member-pick dropped. Left here: **storage** and the **pinned indicator** |
| 3. Three-dot menu | 10 sited it; contents were still open — see §5 |
| 4. Editing detail-only | Settled by 10 |
| 6. `Sort by number` | Settled by 10, in the editor |

### 1 — Series description: DROPPED

Driver, 2026-08-04: *"drop the description all together."* Not deferred —
**out of scope**. It was the only item that added a feature rather than deciding
a presentation, and it dragged a column, a `*_source` companion and an editor
field behind it. The map's schema section had already promised it; that promise
is withdrawn.

### 2 — Tapping a book row plays it. There is no route to `titleDetails`.

The prototype's `BookRow` was a `Pressable` with no handler
(`ProtoSeriesDetail.tsx:335`), so this had never been decided.

The recommendation was to mirror `BookGridItem`'s **two** targets — play glyph
on the cover (`:145`), body → `titleDetails` (`:184`, `:308`) — with the caveat
that a 46dp `ROW_COVER_BOX` gives roughly a 40dp touch target, under the 48dp
Material minimum and adjacent to a target that does something else entirely.

**Driver collapsed it to one: the whole row — body and image — plays/continues
that book.** The sub-48dp worry dies with the sub-target.

**Accepted cost: this screen cannot reach a book's details at all.** No
metadata, no chapter list, no `titleDetails` ⋮. The asymmetry is deliberate —
10 put a series line *on* `titleDetails`, and the reverse direction is now
closed. It is also what forces §10.

### 3 — Presentation: `formSheet`, matching `titleDetails`

The recommendation was an opaque push, on the grounds that Q2's original answer
guaranteed a sheet-over-sheet transition and that a container you scroll is a
place, not a modal errand. **Driver chose the sheet and dissolved the conflict
from the other end** — by removing the second sheet (§2) rather than the first.

Precedent table that framed it:

| Surface | Presentation |
| --- | --- |
| `player`, `titleDetails` | `formSheet`, slide from bottom |
| `coverArtSearch`, `editTitleDetails`, `chapterList`, `footprintList` | `transparentModal`, fade |
| `series` group (wizard + editor) | opaque push, `slide_from_right` |

`titleDetails` — the app's existing *detail screen for an object* — is a
`formSheet` with `sheetShouldOverflowTopInset: true` (`_layout.tsx:242-249`).
This screen is its series-shaped sibling.

**05's push ruling does not transfer, and this ticket says so explicitly.** The
wizard is a task flow; this is a container.

### 4 — Routing: a root-sibling route. 10's `Save` handover resolves itself.

**The sheet forces the placement.** A screen inside `series/` cannot be a
root-level `formSheet` — the group is one root entry carrying its own animation.
So the detail route is a **root sibling**, not a group member. Not a choice.

That resolves 10's handover for free:

```
(drawer) → seriesDetail (formSheet) → series group (editor, opaque push)
```

`exitGroup()` — `(navigation.getParent() ?? navigation).goBack()`,
`edit/[id].tsx:132` — pops the `series` group and lands on **the detail sheet**.
10 predicted `Save` would break; siting detail outside the group means it never
activates. **No code change.**

**The editor stays in the `series` group (option A)**, so `Edit series` is the
app's first opaque `slide_from_right` push launched *from* a live `formSheet` —
`titleDetails` only ever pushes `transparentModal`s (`:171`, `:176`). On Android
that is a known rough edge in `react-native-screens`.

- Driver: **"(A) with a prototype check", and "(C) as a backup."**
- **Fallback (C), documented and not chosen:** move `series/edit/[id]` out of the
  group to a root `transparentModal`, matching `editTitleDetails` (`#2c2c2cdc`,
  86% opaque — room enough for the drag list). The chain then becomes exactly
  `titleDetails` → `editTitleDetails`. Costs a route move plus a recheck of
  `seriesDraftStore`'s reset-on-group-entry lifetime.

**Dead call site:** `handleEditSeries` at `(library)/index.tsx:251` is the browse
`Pencil`'s route, which 08 deleted. Once this screen lands the editor is
reachable only from here.

### 5 — No ⋮ on this screen

11 proposed `Edit series` / `Change artwork` / `Delete`.

- **`Change artwork` — no.** 10 put artwork in the editor behind a
  confirm-before-apply, because `RNFS.unlink` runs before the DB write
  (`replaceBookArtwork.ts:51`). A ⋮ shortcut would jump into `/coverArtSearch`
  and bypass it.
- **`Delete` — the live one.** It already lives in the editor
  (`edit/[id].tsx:168-189`), which 11's body did not know.

Three options were put: ⋮ = Edit + Delete with delete leaving the editor
(recommended, because it makes the routing correct with one pop instead of a
two-pop special case); editor-only; both.

**Driver, 2026-08-04: none of them —
*"lets remove the three dots from this screen. we can revisit them when we have
something else of substance to add to the dropdown."***

**This AMENDS 10.** 10's "two visible routes, one word" collapses to **one**: the
wrench row is the sole route to the editor. 10's own reasoning survives intact —
it kept the ⋮ "deliberately thin… for parity and as the home for split/merge
**if** that out-of-scope ruling is ever revisited" — and a menu holding a single
item that duplicates a visible row two inches below it was not worth its pixels.
The ⋮ returns when split/merge does, or when anything else earns a slot.

> **⚠ HANDOVER — `Delete`'s exit is now wrong, and it is the mirror image of what
> 10 predicted.** With delete staying in the editor, `handleDelete` →
> `deleteSeries` → `exitGroup()` (`edit/[id].tsx:182`) pops the `series` group and
> reveals **the detail sheet of a series that no longer exists**;
> `ProtoSeriesDetail` returns `null` on a missing series, so that is a blank
> sheet. It must pop past the sheet to the library. **`Save` and `Cancel` are
> correct as-is** — 10 flagged `Save` as the latent defect; this ticket fixes
> `Save` by construction and breaks `Delete`.

### 6 — Artwork override: ONE nullable column, `series.artwork`

`null` = derive from the first book, following reorders as 08 specified.
Non-null = pinned. **The presence of the path is the marker.**

**No `artwork_source` companion.** 09's `name_source` / `canonical_source` /
`membership` exist because a **rescan writes** those aspects — the detector
proposes a name, a number, a grouping, so ownership must be recorded or the next
scan clobbers the repair. **Nothing ever detects series artwork**: 02's cascade
produces names, groupings and numbers, online lookup for series *identity* is out
of scope, and art is derived at render time. A source column would be a pure
function of the nullity of the column beside it.

Running total → **six columns across two tables + `suppressed_series`**, plus
12's `settings` boolean counted separately. One more than the map recorded, not
two — and the description drop (§1) removes the other two it was expecting.

> **⚠ Inherits the orphaned-artwork leak, as a second producer.** A pinned cover
> is a new file only the series references, so deleting the series leaks it
> forever. Derived art is free by comparison — it points at a file the book
> already owns. The ref-counted sweep sketched in
> `orphaned-artwork-files-never-cleaned.md` needs to know series exist.

### 7 — Hero ground: a scrimmed cover backdrop, 08's browse-row treatment

Three were put: a `MeshGradientBackground` from the series art's colours
(recommended — `titleDetails.tsx:280` and `player.tsx` both do exactly that, and
neither is gated; `autoAccentEnabled` at `settingsQueries.ts:505` governs the
*accent colour*, not the gradient); the scrimmed backdrop; or a flat background.

**Driver chose the scrimmed backdrop** — visual continuity with the row you
arrived from, and a pinned cover is unmissable.

Colour extraction is free either way: `replaceBookArtwork.ts:55` already runs
`extractImageColors` and stores the palette, and 10 generalises that helper to
`replaceArtwork`.

**08's theme-coupling trap applies at full force here** — anything drawn on a
surface the component itself darkens must be coloured against that surface, not
the palette. That bug (a glyph invisible in light mode) is the only light-theme
defect this effort has found, and this screen repeats the exact construct.

### 8 — The hero honours `Series Backgrounds`. This AMENDS 12.

12 fixed the toggle's reach at the browse row "deliberately so this ticket is not
pre-committed", and said widening it would mean the hero must work in two states.

**With §7 chosen, both states were already designed** — ON is 08's
device-verified browse treatment, OFF is the flat hero `ProtoSeriesDetail`
renders today. The widening is a conditional, not a design.

Driver: **yes.** Reasoning:

- The treatment is now *identical* to the browse row, so same-treatment-same-rule
  carries real weight. Turning it off, watching rows go quiet, then tapping in and
  getting the loud version back reads as the setting being broken.
- It is called **`Series Backgrounds`**, not "Series list backgrounds".
- 12 chose default-ON on the argument that an irritated user can rescue
  themselves — which only holds if turning it off actually rescues them.

**Cost, and it is real:** 11's body assumed this screen would be where a pinned
cover shows when the toggle is OFF. §9 is what keeps that true.

### 9 — Pinned art shows on the fan's front card; the editor caption indicates and reverts

**The front card is not a new rule.** `getSeriesFacts` builds `cluster` by
walking `books` in `position` order, deduped by artwork uri
(`seriesFacts.ts:176-184`), so `cluster[0]` **is already** the first book's
cover — which is already the derived series art. Plumbing the override through
is one expression, browse and detail alike:

```
front card = series.artwork ?? books[0].artwork
```

08 is not amended; it simply could not plumb an override that did not exist.
Pinned art **replaces** card 0 rather than prepending, so 08's fixed 100.8dp
cluster width and 8.4dp peek stay constant. Pinned art therefore has a home on
this screen in **both** toggle states.

**The gap nobody had named: there was no way back to derived.** Once
`series.artwork` is non-null it stays non-null forever, and the only "revert"
available would be searching the web for the cover you already had.

**Driver chose the caption** — one element under 10's pressable cover control
doing indicator, explanation and escape hatch:

| State | Caption |
| --- | --- |
| `artwork` is null | muted, non-interactive — *Using first book's cover* |
| `artwork` is set | pressable — *Use first book's cover instead* → nulls the column |

Words rather than a `Pin` badge, on 10's own division: *the glyph signals
correction, the word signals destination*. A badge tells you the state and gives
you nothing to press, so revert would need a second, undiscoverable affordance.

This answers 10's handover — *"pinned art probably needs to look pinned. The
indicator is 11's"* — which 10 raised after watching `Sort by number` silently
swap the header artwork. **It EXTENDS 10's editor** with an element 10 did not
specify.

> **⚠ Revert should delete the pinned file**, or every revert leaks a cover into
> the same orphan pile the pinned file already sits in (§6).

### 10 — A finished row restarts from zero

`handleBookPlay` has **no `Finished` case** (`handleBookPlay.ts:44-68`): it marks
`NotStarted` → `Started`, then seeks to the stored chapter index + progress. So
playing a finished book drops you at its final seconds.

Everywhere else that is harmless, because the tap that plays a book sits beside a
route into `titleDetails` and its progress options. **§2 removed that route from
this screen**, so a finished book here has no escape.

Driver: **restart from zero.** The `Check` (`ProtoSeriesDetail.tsx:388`) is
already the "you've read this" signal, so the tap has nothing to disambiguate,
and it agrees with 08's series-level `Restart`.

- **Divergence accepted:** the same book tapped in the library grid still resumes
  at the end.
- **Driver, same breath: `BookGridItem` should get this change later — OUT OF
  SCOPE for this effort.**

Two smaller things folded in without objection:

- **The active book reuses the grid's treatment** — `LoaderKitView`
  `LineScaleParty` bars while playing, `primaryAlpha75` title colour
  (`BookGridItem.tsx:128-140`). Reused, not reinvented.
- **Whether a row needs a visible play glyph is deferred to the prototype.** 08
  needed a 42% scrim *and* a hairline border to keep its glyph alive on cover
  art; at 46dp that is a lot of furniture repeated 41 times, and rows are
  tappable everywhere in this app without advertising it.

### 11 — Grab handle only. The nav row goes.

The prototype's 48dp `ChevronLeft` + muted "Series" row
(`ProtoSeriesDetail.tsx:155-175`) was built for a `Modal`. `titleDetails` has no
nav bar at all — a **55×7 rounded grab handle that is itself a `Pressable`
calling `router.back()`** (`:286-290`, styles `:918-925`), with the book's name
in the hero doing the identifying.

Driver: **handle only.** A back chevron on a bottom sheet is a mixed metaphor —
the sheet dismisses downward, the arrow points left — and with the ⋮ gone (§5)
the row held nothing but a redundant word. Deleting it buys ~48dp on a screen
whose job is a book list.

### Carried over from 08 unchanged

Fanned cover cluster · name capped at 4 lines with tap-to-expand and no
`Show full name` label, overflow **measured** off-screen · meta line with 07's
canonical range · origin chip (provenance is detail-only) · completion bar ·
`Start`/`Continue`/`Restart` button, which **keeps its word** here — 08 stripped
it on the browse row because the label cost ~27% of the row's width, a constraint
a full-width hero button does not have · one row per book with `#canonical` or a
blank · row covers in a fixed-width box so titles stay left-aligned.

### Schema cost: **one column** — `series.artwork`, nullable string

### Not decided here

Tablet, font scale, animation, and light theme remain open for this screen as
for every other. The 0-book series is defensive only: under 09, removing the last
book suppresses the series rather than leaving an empty one.
