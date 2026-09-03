# The Books shelf has two layouts, not a fourth view

**Status:** accepted (driver, 2026-09-03), from the grilling on 2026-09-03 and scoped in
`.scratch/books-layout-toggle/spec.md`, which is driver-approved decision by decision. This
ADR rules on a design before the code exists; that is the point, because the code it rules
against is the one a reader of the current types would write.

The library screen's header control picks a **Shelf** — one of three. The Books shelf, and
only the Books shelf, additionally has a **Layout** — `grid` or `list`, chosen by its own
control and persisted. These are **two axes**, not four positions on one.

`src/helpers/ladderView.ts` is the single place they are collapsed back into one
`LadderView`, and the derived value feeds both the ladder and `useScrollDirection`'s
`surface`.

## The part that will look wrong later

`ladderDecisions.ts:29` already declares `LadderView` as a four-member union ending in
`'booksList'`. `helpers/ladderView.ts` carries a ⚠ reasoning about "the fourth ordinal",
and `helpers/__tests__/ladderView.test.ts` has a test written, in its own words, so it will
not "fail the day a fourth ordinal is mapped properly". `BooksList.tsx`'s §H7 comment
advertises reviving the list as "a zero-line diff".

Read together, those four artefacts describe **a fourth stop on the header's cycle**. That
is model (A). It was considered and rejected. Nothing in them is stale — they were written
by an author who correctly foresaw that `BooksList` would come back, and who could not know
in what shape. They are not an unfinished intention, and the next reader should not finish
them.

## Why not the fourth ordinal

`Header.tsx`'s control is a **cycle**, not a picker: `(prevState + 1) % 3`. Every stop added
to a cycle is paid for by every user on every other stop.

**The two choices are not the same kind of choice.** Stop 0 is sectioned — recency sections
and author sections, collapsible horizontal rows, published index ranges, the only member of
`SECTIONED_VIEWS`, the only view that arms the ladder's third rung and the collapse sweep.
Stop 1 is a different set of entities entirely. Stop 2 is a flat shelf of every Book. Moving
between those changes **what you are looking at**. Grid versus list changes **how the same
rows are drawn**, and changes nothing else: same Books, same search, same tabs, same
ordering. Folding a presentation preference into the same control as a change of subject
says the two are the same act, and they are not.

**Ergonomics follow from that.** A reader who wants covers and a reader who wants titles are
both on the Books shelf; under model (A) they are on different stops of a cycle, so
returning to your own shelf costs four presses instead of three for everyone, including
readers who never wanted a list. Under (B) the layout is set once, persisted, and never
cycled through again.

**Discoverability.** A dedicated icon beside the search bar announces the choice. A fourth
stop on an existing cycle hides it behind the habit of stopping at the third.

## What it costs, and the constraint that pays for it

The cost is real and is the reason this document exists: **"which view am I on?" stops being
answerable from one number.** Under (A) the ladder's view, the scroll hook's surface, and any
future reader all consult one ordinal. Under (B) there are two values, and the ⚠ in
`ladderView.ts` — that an unmapped view must never land on `booksHome`, because that is the
only view whose section ranges are never cleared — gains a second way to be got wrong.

The constraint that makes (B) safe is therefore not optional and is the operative ruling
here:

> **The two axes are collapsed into a single `LadderView` in exactly one place —
> `ladderViewFor` — and every consumer that needs a view identity takes that derived value,
> never the raw ordinal.**

Two consumers today. `useBackToTopLadder`'s `view` is the obvious one.
`useScrollDirection`'s `surface` is the one that will look like an over-reach and is not: a
layout flip replaces the mounted list while the ordinal is unchanged, which is precisely the
"a switch replaces the list" case that hook's own docblock describes, and an ordinal-keyed
`surface` performs no reset. Its three pieces of state — the remembered offset, the
remembered direction, the visibility value — are documented as having to move together.

Note the bound, so that nobody later over-corrects: because the layout control lives inside
the search bar overlay, and that overlay translates outside an `overflow: 'hidden'` parent
when hidden, **the control cannot be pressed while the bar is hidden**. The search bar can
therefore never be stranded off-screen by a layout flip. Without the reset the defect is one
mis-read gesture frame, not the unreachable-UI failure the shelf-switch case had. It is
still wired correctly, because correct is free here — not because the alternative was
catastrophic.

## What this does not change

Nothing in the ladder's decisions. `SECTIONED_VIEWS` gates on set membership — a
**capability** test, not a change-of-view test — so `booksList` becoming live means
`sectionRungTarget` and `decideSweep` return early, and the deliberately-never-emptied
section ranges (§R5) are never consulted. `ladderView.ts`'s cascade still names `booksHome`
explicitly and still degrades anything unrecognised to a non-sectioned view.

The Shelf still resets to the sectioned home on every launch. Persisting the Shelf is a
separate product question that this ADR does not answer and does not create an expectation
about — the asymmetry (Layout persisted, Shelf not) is deliberate, and rests on Layout being
a preference while Shelf is navigation.

## When this is wrong

- **If a second shelf gains a layout.** Layout is defined here as a property of *the Books
  shelf*, which is what keeps "what layout is the Series shelf in?" from being a question. A
  second shelf with its own layout makes Layout a property of *a shelf*, and the two-value
  state becomes a per-shelf map. That is a different model, not an extension of this one.
- **If a third layout appears.** The persisted column is a string precisely so this is
  possible, but a three-way choice is not a toggle: the control becomes a picker and D8's
  current-state iconography stops being expressible in one icon.
- **If two lists are ever mounted at once** — a tablet split, say. The library screen's
  single shared `listRef` docblock already warns that this invalidates its arrangement and
  raises a product question (which pane does back act on?) before a technical one. This ADR
  inherits that warning wholesale and adds nothing to it: it assumes exactly one list is
  mounted, which is what makes one derived `LadderView` a complete answer.
- **If `ladderViewFor` acquires a second caller that passes only the ordinal.** That would
  mean the single meeting point has quietly become two vocabularies again, and the ⚠ it
  exists to enforce would be back in play.
