# 02 — Extract the shared "play this Book from a row" operation

**What to build:** Tapping play on a Book anywhere in the library — a grid card,
a list row, a series browse row, a series detail sheet — runs one shared
operation instead of four hand-copied ones. Behaviour is identical from the
user's side; the point is that the next change to "what happens when you press
play on a row" happens once.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

## Why this comes first

It is a prefactor. Four call sites become one, so the migration batches that
follow have four fewer places to touch — and the duplication is worth removing
on its own merits regardless of the seam work.

`BookGridItem` and `BookListItem` currently hold **character-for-character
identical** handlers, differing only in a null guard and a comment: wait for the
player, read playback state, conditionally record a play footprint, then hand
off to the book-play helper. `SeriesBrowseRow` and `SeriesDetailSheet` hold the
same shape without the footprint step.

## ⚠ The trap in this extraction

The four callers do **not** agree on what they pass as "is this the active
Book", and the disagreement is invisible until you line them up:

- The grid and list rows pass the **Active Book** — an observation, from the
  player-state store.
- The series row and sheet pass the **Requested Book** — an intent, from the
  queue store, compared inline.

Same argument position, same helper, two different questions. See `CONTEXT.md`
for both terms and why they diverge during a Book switch.

**The extracted operation must take that as a parameter and each caller must
keep passing what it passes today.** Picking one source for all four is a
behaviour change, it is not this ticket's job, and it would be invisible in
every test that does not switch Books mid-playback. Reconciling them is ticket
11's territory.

Record the inconsistency in the new function's header so it is not lost.

## Acceptance criteria

- [ ] One shared operation covers all four sites, with the footprint step as an
      option rather than a copy
- [ ] Each caller passes the same active-Book source it passes today —
      verified caller by caller, not assumed
- [ ] The Active/Requested inconsistency is named in the new function's header
- [ ] `tsc` 0, `eslint` 0, test count at or above ticket 01's baseline
- [ ] No behaviour change: pressing play on a grid card, a list row, a series
      browse row and a series detail sheet each do exactly what they did before
