# 09 — Auto-generate series: the setting, and what happens to my edits

Type: grilling
Status: open
Blocked by: (none)
Parent: [map.md](../map.md)

## Question

Detection ships behind a **settings toggle modelled on `Auto-Generate
Chapters`** (driver, 2026-08-02) rather than behind a post-scan review queue.
That shape is settled. **What is undecided is what the toggle promises — and
what it does to work the user has already done.**

## Why this exists

[02](02-detection-cascade.md) measured detection and the driver chose the
delivery shape in the same session: no per-item confirm/reject gate, because a
**wipe-and-regenerate** button makes detection errors cheap without any
per-item UI. That is a good trade, but it moves the risk. The dangerous moment
is no longer "the scanner guessed wrong" — it is **"the scanner ran again and I
lost my work."**

## The decisions

1. **Default state.** On or off for a new install? On is the whole point of
   making detection primary; off is the conservative read of the abstention
   bias. And the default *fidelity* — 02 recommends Conservative (19 series,
   98.3% purity, 0 standalones swept) over Full (28 series, 97.2%, 2 swept,
   one visibly wrong `Enders Game` group).

2. **What does turning it OFF do to series that already exist?** Three
   candidates, and they are not close to equivalent: stop creating new ones and
   leave the existing alone; hide the detected ones but keep them; or delete
   the detected ones. Hand-made series must survive all three.

3. **What does REGENERATE destroy?** This is the sharp one. A regenerate must
   rebuild detected series, but the user may have renamed one, split one, moved
   a book, or set a canonical number. [07](07-sequence-numbering.md) already
   ruled that `series_books.canonical_source = 'user'` is never touched by a
   rescan — but regenerate is not a rescan, it is an explicit reset, and the
   two may want opposite answers.

4. **The override marker for membership and naming.** 07 gave the *number* one
   (`canonical_source`). Nothing yet marks "I renamed this series" or "I moved
   this book out". 02 deferred it here because the regenerate model is what
   makes it load-bearing. Is it one flag per series, per membership row, or a
   whole detected-vs-user provenance concept?

5. **What the explanatory copy says.** The toggle is the only place the app
   ever explains detection. It has to say what can go wrong and how to fix it
   without describing a cascade. 02's real failure modes, in the user's terms:
   two recordings of one series may merge (they don't, now — the number
   collision check splits them, but the user cannot know that); a series may
   get an ugly name (`TMC`, `Crouch, B`) and can be renamed; a few books may
   not be picked up at all and can be added by hand; at Full fidelity a folder
   that isn't really a series may become one.

6. **Does Full fidelity deserve to be user-visible at all**, or is the
   difference (+9 series, +34 books, one of them a visibly wrong 7-book group)
   too small a prize for a setting most users will not understand?

## Constraints already settled

- **No post-scan review/approval queue** (driver, 2026-08-02). Whatever is
  created, is created.
- **No one-book series** (driver, 2026-08-02). A second book arriving later
  creates the series — so *adding a book must be able to create a series*, and
  that path runs outside any scan the toggle controls.
- **No folder-consent switch** (driver, 2026-08-02). Folder evidence is always
  considered; self-validation is always underneath it.
- 07: `position` is the sole sort authority; `canonical_number` only seeds it.
- 02: detection at Conservative sweeps **zero** standalones into a series, so
  the toggle's promise can be honest about false positives being rare.

## Notes

- Model the UI on the existing `Auto-Generate Chapters` toggle — find it in
  `src/` and match its affordances and copy voice rather than inventing a new
  pattern.
- The measured numbers to quote in any copy or mock live in
  [`../research/02-detection-cascade/`](../research/02-detection-cascade/)
  (`RESULTS.txt`, `SERIES_LISTING.txt`).
- Schema impact folds into the map's consolidated-schema fog item, alongside
  06's edition decision.

## Answer

_(unresolved)_
