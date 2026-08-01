# 07 — Sequence numbering: position, canonical number, or both?

Type: grilling
Status: open
Blocked by: 01
Parent: [map.md](../map.md)

## Question

The driver's diagnosis of the current UI: *"the series IS ordered once created,
but the books do not have a visual cue showing this fact"* — with a proposed fix
of **a number overlaid on the cover, like the play/pause button treatment.**

Before that can be designed, the number has to mean something. **Which number?**

## The ambiguity

The library holds Dresden Files **1, 3, 4, 8** — non-contiguous. So the badge on
*Summer Knight* reads either:

- **3** — its **position** in the user's set (what exists today:
  `series_books.position`, 0-based), or
- **4** — its **canonical number** in the published series (what the tags say:
  `album` = `The Dresden Files #4: Summer Knight`).

These answer different questions. Position answers *"what do I play next?"*.
Canonical number answers *"what am I missing?"*. Both are legitimate; they are not
interchangeable; and the divergence is not an edge case — it is the driver's
normal state, since the curated set is deliberately full of gaps.

## The decision

- Show one, or both? If one, which — and does the other need to exist anyway for
  sorting?
- **Canonical number does not exist in the schema.** Adding it means a column, a
  detection source, a manual entry point in the wizard, and an override path when
  detection is wrong. That is a real cost; is it earned?
- Where does the canonical number come from when tags lack it? Mort 2022's `album`
  is `Mort (#4)` — number present, series name absent. Bobiverse's is embedded in
  a title string. Some books will have none.
- **Sort order vs display.** If canonical numbers exist, should the series sort by
  them automatically instead of by drag-ordered position? That would make the
  drag-sort wizard step redundant for detected series — a meaningful simplification
  of the wizard, or a loss of control.
- Half-numbers: novellas are routinely 2.5 or 0.5. Integer column or float?
- Do gaps get **rendered**? A greyed placeholder for the missing Dresden 2 tells
  the user what to buy next; it also clutters a shelf with things they do not own.
  This is a display decision that depends on the number's meaning.

## Design constraint carried in

Whatever this resolves, the browse prototype (ticket 08) needs a concrete rule for
what the badge shows — the badge treatment cannot be prototyped against an
undecided number.

## Answer

_(unresolved)_
