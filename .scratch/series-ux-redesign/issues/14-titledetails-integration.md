# 14 — `titleDetails` integration: where does the series line sit?

Type: prototype
Status: resolved
Blocked by: (none)
Parent: [map.md](../map.md)

## Question

[10](10-correction-surface.md) settled **what** book-first series integration
contains. What it did not settle is **where any of it goes on the screen**, and
`titleDetails` is a screen with no spare room.

Already decided by 10, do not relitigate:

- A **series line** — series name + [07](07-sequence-numbering.md)'s canonical
  number — which **taps through to the series detail sheet**.
- It renders a **list**, because multi-membership is real and shipping today
  (*Guards! Guards!* is Discworld 8 **and** Night Watch 1).
- **`Add to series…`** in the overflow menu, **always present** — it has no
  inapplicable state, since any book can always join another series.
- **No book-first remove.** Removal is series-scoped under
  [09](09-auto-generate-series-setting.md)'s `membership = 'excluded'`.
- The series line is **absent, not disabled**, when a book is in no series
  (the new convention — see the map's Out of scope).

So this ticket is layout, and only layout:

1. **Where in the scroll column does the series line land?** The column runs, in
   order (`src/app/titleDetails.tsx`): title → author/narrator → genre chips →
   `Duration` / `Released` / `Chapters` info cards → play button +
   `BookDurationRow` → description paragraph → hairline → copyright. Every one of
   those is an established species of row. Is the series line a fourth info card,
   a chip like a genre, a new row above the info cards, or something else?
2. **What does the multi-series case look like?** One line is easy; two is the
   real case and three is possible. Whatever form is chosen has to hold a
   variable-length list without pushing the play button below the fold.
3. **Where does `Add to series…` sit in the overflow?** The menu currently holds
   `Pencil` / `Layers` / `BookCheck` (+ the progress sub-menu). Order and icon.
4. **How does the number read when the book is in two series with different
   numbers?** `Discworld 8` and `Night Watch 1` are two different facts about one
   book, and the line has to make that legible rather than look like a conflict.

## Why this needs building, not grilling

The whole difficulty is **spatial**. This screen's hero is a mesh gradient plus a
large cover, the info cards are already a three-across row at a fixed height, and
the description is long. Whether a series line fits without displacing the play
button is a thing you look at, not a thing you reason about — the same argument
that made [08](08-browse-presentation.md) a prototype.

## Constraints

- **Costs no schema.** Everything read here already exists after
  [11](11-series-detail-contents.md)'s column.
- **It is a round trip, not a one-way exit.**
  [13](13-detail-sheet-prototype.md) proved `formSheet`-over-`formSheet`
  presents and returns cleanly on device, and the detail sheet's rows already
  route *into* `titleDetails` (the text half of a row). So this link closes a
  loop: `titleDetails` → series detail → `titleDetails`. Check the loop actually
  survives a couple of round trips on device — nothing in this app has stacked
  sheets that way before 13, and 13 only measured one level.
- `seriesDetail` is a **root-level** route (`src/app/seriesDetail.tsx`), a
  sibling of `titleDetails` — not inside the `series/` group. Routing from here
  is a plain root navigation.
- The prototype harness is `src/prototypes/` (JS-only, no rebuild); adding a
  variant is copy-a-file-plus-one-row per [04](04-prototype-harness.md).
  `titleDetails` itself is real-code, so keep the footprint to a commented slot
  the way the library screen does.
- **A book cell can only render a book in the library store**, and the same is
  true of a series line — resolve from `useSeriesStore` / the `Book` objects
  already carried, and decide what an unresolvable series renders as.

## Definition of done

A placement chosen on device, the multi-series case shown with a real two-series
book, the overflow position fixed, and a note on what happens at zero series.

## Answer (2026-08-04)

**A static subheading directly under the book title — `Book 8 of Discworld` —
showing exactly ONE series, chosen as the largest detected one.**
`Add to series…` sits under `Edit Book Details`; auto-chapters gives up the
`Layers` glyph. Four variants built on the REAL route; screenshots in
`../assets/14-titledetails/`, final state `10-` and `11-`.

**It amends ticket 10 in TWO places, both deliberate, neither a rendering
shortcut.** 10 specified a series line that "renders a LIST because
multi-membership is real" and "taps through to series detail". This does
neither:

- **ONE series, not a list.** Driver: *"constrain it to derived series, or the
  first series created by the user that contains that book."* So
  *Guards! Guards!* reads `Book 8 of Discworld` and does not mention Night Watch 1
  on this screen at all — that membership is reachable only by opening the series
  sheet. **The tiebreak 10 never needed and this ticket did**: among DETECTED
  series the **largest wins** (Discworld 41 beats Night Watch 6), because
  detected series have no meaningful creation order — it is scan order — so size
  is the only signal, and the bigger series is almost always canonical with the
  sub-series as the specialist grouping. The **user-created fallback keeps
  "first created"**, which does have meaningful order. The asymmetry is the
  ruling, not an oversight. Verified on device against a book in **12** series.
- **STATIC, not tappable.** Driver: *"we really might make it static and not
  tappable. this might be overkill."* The route is not lost, only un-duplicated —
  the series sheet is reachable from the browse row and from 13's rows. A
  subheading that reads as prose has nowhere to put an affordance cue without
  becoming a field again, which is the thing that made it win.

**Why it won over three structurally different rivals.** The screen has three
established species of row and a series is ambiguous between all of them, so
each rival asserted a different answer to *what kind of thing is a series*:
`Byline` (identity, like an author), `Chips` (a tag, like a genre), `4th card`
(metadata, like a duration). The subheading asserts a fourth — **part of the
title block, the way a printed cover does it** — and it is the only one that
reads as prose rather than as a field.

**The measurement that framed all four: there is no vertical slack.** In the
control, `Continue Listening` sits *exactly* at the fold
(`01-control-off.png`), so every variant spends space that does not exist. The
subheading spends the least because it sits highest.

**`4th card` is the only free option and it cannot be used** — zero vertical
cost, the play button never moves, but it **drops the series NAME entirely**
(`#6` — of what?), truncates to `Series +…` and squeezes the other three cards.
It fails 10's content ruling outright, so "costs nothing" bought nothing.

**Two build traps worth carrying to [19](19-write-the-spec.md):**

- **The negative margin is load-bearing, do not "clean it up".**
  `bookInfoColumn` sets `gap: 20` between every child, which made the line read
  as its own block. The driver asked for the gap `Read by` has above the
  narrator's name — and those two Texts sit in a bare `View` with **no gap at
  all**, so the target is pure line spacing. `marginTop: -17` nets ~3dp. The
  20dp gap **below** is deliberately untouched: that is what keeps the line part
  of the title block rather than the author block.
- **`Layers` was doing double duty and this ticket found it.** It is the
  library's Series-view toggle AND was `Remove Auto-Chapters`' glyph, so
  `Add to series…` would have sat directly above an identical icon meaning
  "chapters". **Driver's call: series keeps `Layers`, auto-chapters moves to
  `TableOfContents`** (`11-overflow-icons-resolved.png`). This is the ticket's
  **only real-code change** — one import and one element in `titleDetails.tsx`,
  everything else is throwaway harness.

**Also settled:** `Add to series…` sits **under `Edit Book Details`**, grouping
the two items that act on what the book IS above the two that act on how it
PLAYS. **07's "blank beats misleading" survives contact** — `Rivers of London`
has no canonical number and renders `Part of Rivers of London`, never a
substituted position. **Zero series renders nothing at all**, per 10 and the
map's absent-not-disabled convention. **Costs no schema.**

**The round trip is discharged.** 13 measured one lap of
`formSheet`-over-`formSheet`; this ticket did another from the opposite
direction — series sheet → row text → `titleDetails` presented over it, clean
(`11-overflow-icons-resolved.png` is that second sheet). Going static means this
screen no longer has a leg in that loop anyway.

## Findings during the build (kept for the trail)

Built on the real `titleDetails` route, `src/prototypes/ProtoSeriesLine.tsx`,
switchable from a pink pill bottom-left. **Four** variants, not three: the driver
added `Subheading` after seeing the first three. tsc 0 / eslint 0.
Screenshots: `../assets/14-titledetails/`.

**The control is the constraint.** With nothing added, `Continue Listening` sits
*exactly* at the fold (`01-control-off.png`). There is no vertical slack on this
screen; every variant is spending space that does not exist.

| Variant | Vertical cost | Multi-series | Number reads as |
| --- | --- | --- | --- |
| **Subheading** | 1 line, highest position | **shows ONE** (driver's rule) | `Book 4 of The Wheel of Time` — prose |
| Byline | 1 line (~48dp) | stacks; clean even at 11 | `Book 4` — unambiguous |
| Chips | 1 chip row, taller | wraps free; 7 rows at 11 | `• 4` — 4 books? book 4? |
| 4th card | **zero** | impossible | `#6` — of *what*? name is gone |

Three results worth keeping regardless of which variant wins:

1. **The 4th card is the only free option and it cannot be used.** It drops the
   series NAME entirely, truncates to `Series +…`, and squeezes the other three
   cards (`04-card-11series.png`). It fails 10's "renders a list" outright.
2. **`Add to series…` and `Remove Auto-Chapters` would share the `Layers`
   glyph**, on adjacent rows (`05-overflow-add-to-series.png`). `Layers` is
   already the library's *Series view* toggle, so the same icon means "series"
   in one place and "chapters" in another. Unrecorded anywhere on the map.
   The same screenshot also shows `Remove Auto-Chapters` disabled at reduced
   opacity — the convention the map's Out of scope section reversed.
3. **07's "blank beats misleading" survives contact.** `Rivers of London` has no
   canonical number and correctly renders name-only in every variant
   (`02-byline-11series.png`).

### The one-series constraint (driver, mid-ticket)

> "constrain it to derived series, or the first series created by the user that
> contains that book"

Implemented as `primaryMembership()`: first `origin !== 'user'`, else the first
of any. **This is a departure from 10's "renders a LIST because multi-membership
is real"** and needs recording as such — *Guards! Guards!* would show
`Book 8 of Discworld` and not mention Night Watch 1 at all on this screen.

**Verified on device and it works better than expected**: with Mort in **11**
synthetic series it selected `Book 8 of Discworld`
(`09-subheading-picks-discworld-of-11.png`) — the correct canonical one, because
the rule skipped the three `origin: 'user'` rows.

**But the tiebreak is unspecified when two DETECTED series contain the book**,
which is the real case (Discworld 8 + Night Watch 1 are both detected). Today it
takes whichever `useSeriesSource()` yields first, which is assembly order — not a
rule anyone chose. Needs either a stated tiebreak (largest? lowest canonical
number? first created?) or an accepted arbitrariness.

### Driver rulings, 2026-08-04 — all three built and on device

`10-subheading-FINAL-tight-gap-static.png`.

1. **Tiebreak: LARGEST detected series wins.** Discworld (41) beats Night Watch
   (6). Implemented as a `reduce` so a tie keeps the first and the pick is
   stable. The **asymmetry with the user-created fallback is deliberate** —
   detected series have no meaningful creation order (it is scan order), so size
   is the only signal; user-created series do, so the driver's original
   "first created" wording stands for them unchanged.
2. **STATIC — not tappable.** *"we really might make it static and not tappable.
   this might be overkill."* **This drops a SECOND piece of ticket 10**, which
   specified the line "taps through to series detail". The route is not lost,
   only un-duplicated: the series sheet is still reachable from the browse row
   and from 13's detail rows.
3. **Gap tightened to ~3dp.** *"about the same gap between the 'read by' and the
   actual narrators name."* Those two Texts sit in a bare `View` with **no gap
   at all**, so the target was pure line spacing. `bookInfoColumn` sets
   `gap: 20` between every child, so the fix is `marginTop: -17` on the
   subheading row — the 20dp gap BELOW is left alone, which is what keeps the
   line part of the title block rather than the author block. **That negative
   margin is load-bearing; do not "clean it up".**

### Still open

- Formal sign-off that `Subheading` is the winner (the other three stay in the
  throwaway harness as the evidence trail).
- The round trip (`titleDetails` → series detail → `titleDetails`) is **still
  untested** — though going static removes this screen's leg of it, so it now
  only matters for 13's row-text route, which 13 already measured once.
- Overflow order for `Add to series…` (built under `Edit Book Details`), and the
  `Layers` icon collision.
