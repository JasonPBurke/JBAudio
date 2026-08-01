# 08 — Browse presentation: what is the repeating unit?

Type: prototype
Status: open
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

_(unresolved)_
