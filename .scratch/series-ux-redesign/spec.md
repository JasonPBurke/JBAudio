# Series — Design Spec

Status: `ready-for-agent`
Effort: `series-ux-redesign`
Branch: `feature/series-styling`
Written: 2026-08-06 · resolves [19](issues/19-write-the-spec.md)
**Approved: 2026-08-06 by Jason Burke (driver)** — [19](issues/19-write-the-spec.md)'s
definition of done is met and the map is closed. Amendments are edits to this file, in
place; it is never reissued.
Map (the argument, ticket by ticket): [map.md](map.md)
Implementation tickets: **[`../series-implementation/`](../series-implementation/spec.md)**
— a separate effort with its own `issues/`, numbered from `01`. This file stays the single
source of truth for both; it is edited in place, never copied there.

---

## How to read this

This is the **final state** of twenty tickets, organised by **surface**, not by ticket
number. Where a decision reversed an earlier one, only the surviving decision is stated —
the reversal, the losing option and the reasoning are in the linked ticket. Every heading
carries its ticket links; follow them when you want the *why*, not the *what*.

Three things this document is not:

- **Not a plan.** It states what gets built, not in what order. Sequencing is the
  implementation effort's.
- **Not a record of how the thinking went.** That is the map.
- **Not implementation.** The map ends here.

Deviations from the standard spec template, both deliberate: **route names appear**
(a route name *is* the presentation contract), and **§Further Notes names files and
screenshots** (ticket 19 requires the evidence trail and the harness cleanup recipe to
survive into the spec). Elsewhere, decisions are stated behaviourally. Line numbers are
excluded everywhere — they rot.

---

## Problem Statement

A user with a large audiobook library owns series, and the app barely knows it.

Today a series exists only if the user builds it by hand, through a three-step wizard that
is the app's only opaque full-screen push. In a 350-title library that is not a feature,
it is a chore nobody will finish — so the Series view sits mostly empty and the shelf
that should answer *"what do I listen to next?"* answers nothing.

The information to do better is already on disk and already reachable: **≈60% of
genuinely-in-series books carry portable, machine-usable series identity** in their tags,
and ~96% are reachable if this library's folder names are trusted
([01](issues/01-signal-inventory.md)). The app reads none of it — its `author` fallback
currently records *"The Wheel of Time"* as an author.

Four concrete failures follow:

1. **Nothing is grouped unless you group it.** Every series in the library is manual
   labour, and the labour scales with the library.
2. **The browse screen cannot answer the next-book question.** There is no completion
   state, no next-up, no canonical numbering — a series you are 7 books into looks
   identical to one you have never started.
3. **There is nowhere to fix a mistake cheaply.** Renaming, reordering and correcting a
   number all cost a trip through a wizard built for creation.
4. **A book does not know what it is part of.** `titleDetails` shows no series information
   at all, so the relationship only exists in one direction.

And one fear that governs the whole design: **a user who hand-builds a playlist must never
have it overwritten by a scanner.** Any automatic grouping that can clobber manual work is
worse than no automatic grouping at all.

---

## Solution

**Series are detected automatically from the files the user already owns, presented as a
scannable shelf that always says what to play next, and corrected in one editor that also
doubles as the playlist builder.**

Four parts:

- **Detection is the primary path.** A precedence waterfall over tags, album patterns and
  self-validated folder names groups the library on scan, measured at **98.3% grouping
  purity with 0 standalone books swept into a series**
  ([02](issues/02-detection-cascade.md)). It abstains rather than guesses. A settings card
  governs it, and its promise is one sentence: **nothing you do by hand is ever
  overwritten** ([09](issues/09-auto-generate-series-setting.md)).
- **Browse is a full-bleed row** — a fanned cover cluster with a play glyph, the series
  name, a meta line, a completion bar and a three-state next-up line. One tap plays; the
  rest of the row opens the series ([08](issues/08-browse-presentation.md)). A user
  preference picks whether the row carries a cover backdrop
  ([12](issues/12-series-display-setting.md)).
- **The series screen is a bottom sheet** whose rows split: the cover plays that book, the
  text opens the book's details ([11](issues/11-series-detail-contents.md), as verified
  and amended by [13](issues/13-detail-sheet-prototype.md)).
- **Correction and creation are the same surface** — one editor with an on-demand book
  picker, on one route ([10](issues/10-correction-surface.md),
  [15](issues/15-wizard-flow-shape.md)). Detection is the primary path; this surface exists
  to hand-build playlists, and to rescue the ~4% of books that no signal reaches.

The user-visible promise, in the app's own words
([09](issues/09-auto-generate-series-setting.md)):

> Your changes are never overwritten. Renamed series, books you've added or removed,
> custom ordering and hand-made series are all left alone when your library is scanned
> again.

That promise is structural, not aspirational: ownership is recorded **per aspect**
(name, membership, number, existence), so disagreeing with one part of a detected series
never disowns the rest.

---

## User Stories

### Detection

1. As a listener with a tagged library, I want my books grouped into series automatically
   when they are scanned, so that my Series shelf is populated without me building
   anything by hand.
2. As a listener, I want the app to leave a book alone when it cannot tell what series it
   belongs to, so that a wrong grouping never costs me trust in the ones that are right.
3. As a listener who owns two recordings of the same series, I want each recording kept as
   its own series, so that a 41-book series does not appear as an 80-book series with
   every number doubled.
4. As a listener, I want a series to need at least two books, so that standalone titles are
   never promoted into series of one.
5. As a listener whose folders are named after series but whose tags say nothing, I want an
   opt-in setting that also groups by folder name, so that I can recover those series
   without re-tagging my files.
6. As a listener who leaves that setting off, I want folder names to be trusted only when
   the library's own tags corroborate them, so that an author folder or a franchise folder
   is never mistaken for a series.
7. As a listener, I want series names taken from my files even when they read oddly, so
   that grouping is correct first and naming is a one-tap fix afterwards.
8. As a listener, I want to turn detection off entirely, so that the app stops examining
   new books as they scan in.
9. As a listener who turns detection off, I want my existing series left exactly as they
   are, so that a preference change never destroys data.
10. As a listener whose first scan ran with detection off, I want a button that detects
    series in the books I already have, so that I am not forced to re-import my library.
11. As a listener, I want a plain-language explanation of what detection can and cannot do
    behind an info icon, so that odd names and ungrouped books read as expected behaviour
    rather than as bugs.

### Living with detection — edits, rescans and deletion

12. As a listener who renames a detected series, I want the name kept forever, so that the
    next scan does not put the machine's name back.
13. As a listener who renames a series, I want new books to keep being added to it, so
    that the commonest repair does not silently cost me automatic membership.
14. As a listener who removes a book that does not belong, I want it to stay removed
    across rescans, so that correcting a wrong merge is not undone by the next scan.
15. As a listener who has dragged a series into my preferred order, I want that order
    preserved on every rescan, so that hand-ordering survives detection.
16. As a listener who hand-built a series, I want detection never to touch it at all, so
    that my playlists are structurally safe.
17. As a listener who deletes a detected series, I want it to stay deleted, so that the
    next scan does not recreate the grouping I just rejected.
18. As a listener who deleted a series by mistake, I want to find it in a `Removed Series`
    list and restore it, so that a misclick is recoverable without foresight at the moment
    of the click.
19. As a listener, I want deleting a series never to touch my books, so that removing a
    grouping is never a destructive act.
20. As an existing tester upgrading the app, I want detection to organise my library
    additively on first run, so that the upgrade adds structure without changing anything
    I already had.

### Browse

21. As a listener, I want each series on one full-width row, so that I can scan the shelf
    quickly rather than reading cards.
22. As a listener, I want to see several covers from a series fanned together, so that I
    recognise the series by its art before I read its name.
23. As a listener, I want one tap on the cover cluster to start or continue the series, so
    that resuming costs one press from the shelf.
24. As a listener, I want to see how many books a series has, how many I have finished and
    which published numbers I own, so that I can tell a complete series from a partial one
    at a glance.
25. As a listener, I want a completion bar with a count, so that progress through a series
    is legible without arithmetic.
26. As a listener, I want a next-up line that distinguishes *starting the next book* from
    *continuing the one I am in* from *the series is finished*, so that I know what a tap
    will do before I make it.
27. As a listener, I want tapping anywhere else on the row to open the series, so that the
    row has exactly two meanings and neither is ambiguous.
28. As a listener with a very long series name, I want it to truncate rather than push the
    row's other information off screen, with the full name available on the series screen.
29. As a listener who finds cover backdrops busy, I want a setting that turns them off, so
    that I can choose a quieter shelf.
30. As a listener who has never seen the richer version, I want backdrops on by default, so
    that I am not left unaware that the option exists.

### Series screen

31. As a listener, I want the series to open as a bottom sheet, so that it reads as a
    detail view of the row I tapped rather than as leaving the library.
32. As a listener, I want the series screen to show every book in order, so that I can see
    the whole series at once.
33. As a listener, I want tapping a book's cover to play it, so that the sheet is a
    playable list.
34. As a listener, I want tapping a book's title to open that book's details, so that I can
    reach its chapters and metadata from here.
35. As a listener, I want a finished book to restart from the beginning when I tap it, so
    that re-listening does not drop me thirty seconds from the end.
36. As a listener, I want the book that is currently playing to be marked as playing, so
    that I can see where I am in the list.
37. As a listener, I want the series' full name available here even when the shelf
    truncated it, so that truncation is never a dead end.
38. As a listener, I want the series hero to honour the same backdrop preference as the
    shelf, so that one setting means one thing everywhere.
39. As a listener, I want one clearly-labelled route from the series screen into editing,
    so that correcting a series is discoverable without hunting through a menu.

### Correcting a series

40. As a listener, I want one editor that handles renaming, reordering, adding, removing,
    numbering and artwork, so that there is one place to fix anything about a series.
41. As a listener, I want to rename a series and have the name validated against my other
    series, so that I cannot create two series with the same name by accident.
42. As a listener, I want to set a book's published number, so that the badge shows the
    real series number rather than its position in my shelf.
43. As a listener, I want editing a number not to move the row I am editing, so that the
    list does not shuffle out from under my cursor.
44. As a listener, I want a `Sort by number` action that re-orders the series on demand,
    so that ordering by number is something I ask for rather than something that happens
    to me.
45. As a listener, I want books with no number to sort last rather than first, so that a
    partly-numbered series does not scatter.
46. As a listener with an entirely unnumbered series, I want to number it in bulk from the
    order I arranged, so that numbering a new playlist is not a per-row chore.
47. As a listener with a partly-numbered series, I want bulk numbering unavailable, so that
    the app never invents numbers over the ones I set.
48. As a listener, I want to replace a series' artwork by searching the web, so that a
    series can carry its own cover rather than always borrowing its first book's.
49. As a listener, I want to be told before my old artwork is replaced, so that an
    irreversible file deletion is never a surprise.
50. As a listener, I want to see whether the current artwork is pinned or derived, and to
    revert to derived in one press, so that pinning is not a one-way door.
51. As a listener, I want to delete a series from the editor, so that removing a grouping
    lives beside the rest of the operations on it.

### Creating a series / hand-building a playlist

52. As a listener, I want to build a series by hand from any books in my library, so that a
    personal playlist is a first-class thing this app can hold.
53. As a listener, I want to filter the book list down by author before picking, so that
    choosing from 350 books is manageable.
54. As a listener building a cross-author playlist, I want my selections kept when I change
    author, so that building across ten authors does not mean starting over ten times.
55. As a listener, I want the books I have chosen visible while I choose more, so that I
    can see the list I am building.
56. As a listener, I want to drag the list into the order I want, so that a playlist's
    order is mine.
57. As a listener, I want number boxes to start empty and to be filled from my drag order
    when I save, so that I never have to number a playlist that has no published numbers.
58. As a listener, I want the picker's close button to return me to my list rather than
    abandoning the whole series, so that dismissing a panel is never destructive.
59. As a listener, I want the back gesture to mean *leave this editor*, exactly as
    `Cancel` does, so that every route out of the screen means one thing.
60. As a listener creating and editing, I want the same surface for both, so that there is
    one thing to learn.
61. As a listener with an empty list, I want the screen to tell me to add books, so that
    the empty state is an instruction rather than a mistake.

### Book-first

62. As a listener looking at a book, I want a line under the title telling me which series
    it belongs to and its number, so that a book knows what it is part of.
63. As a listener looking at a book in several series, I want the line to name one — the
    largest detected one — so that the title block stays a title block rather than
    becoming a list.
64. As a listener looking at a book in no series, I want no line at all, so that absence is
    silent rather than a dimmed placeholder.
65. As a listener whose book has no published number, I want the line to name the series
    without a number, so that a blank is never filled with a misleading one.
66. As a listener, I want an `Add to series…` action on a book, so that joining a series is
    reachable from the book I am looking at.

### Settings, theme and geometry

67. As a listener, I want detection settings in `Manage Library` and presentation settings
    in `Appearance`, so that each setting sits with its own kind.
68. As a listener on a tablet, I want the series row to stay readable rather than stretching
    its text across 800dp, so that a wider screen improves the layout instead of diluting
    it.
69. As a listener on a tablet, I want the cover art to grow with the screen, so that a
    larger device does not shrink the artwork to a fraction of the row.
70. As a listener who has set a large font scale, I want the series row to drop its most
    redundant information rather than truncate its canonical range, so that the scarce
    information survives the plentiful.
71. As a listener using the light theme, I want every Series surface legible, so that the
    theme is a real choice rather than a degraded one.
72. As a listener, I want the play glyph legible over any cover, bright or dark, so that
    the primary action never disappears into the artwork.
73. As a listener, I want no Series screen to flash white while it loads or closes, so that
    a dark-theme app stays a dark-theme app.

### Data and upgrade

74. As an existing tester, I want the schema upgrade to run silently and additively, so
    that installing the new version never costs me data.
75. As an existing tester, I want rows that predate the new columns treated as
    *user-owned*, so that the ambiguous case fails in the direction that protects my work.
76. As a maintainer, I want one migration for the whole model, so that this branch claims
    one version number from a namespace it shares with `main`.

---

## Implementation Decisions

### A · Detection

*Sources: [02](issues/02-detection-cascade.md) ·
[06](issues/06-series-identity-edition.md) · [07](issues/07-sequence-numbering.md) ·
[09](issues/09-auto-generate-series-setting.md) ·
[20](issues/20-recommended-library-structure.md) · [01](issues/01-signal-inventory.md)*

**A1 — Precedence, not weighted scoring.** A strict waterfall, first match wins:

```
extra.SERIES  →  Grouping  →  album patterns  →  folder
```

Every proposal carries a `why` trail (`alb.name-num-dash`,
`folder:name-corroborated(25/39)`). A weighted score buys nothing measurable and cannot be
shown to a user. All four signals are already reachable from JS through the existing
MediaInfo turbomodule — **no native work and no rebuild**.

**A2 — Folder evidence self-validates, always.** A folder cluster is trusted only when its
own members' tags corroborate it. Same code, opposite verdicts on the same library: an
author folder is refused because its members' albums name a different series; a genuine
series folder is trusted because 25 of its 39 albums agree with it.

> **The standing rule, carried verbatim from
> [20](issues/20-recommended-library-structure.md) because a build engineer reads the spec
> and not the map:**
>
> **Self-validation is never relaxed on the assumption that users have been told how to
> name folders.** Folder evidence must corroborate against the library's own tags on its
> own merits, always. The app ships **no** folder-structure recommendation. If folder
> advice is ever added in future, **it does not license the detector to trust folders
> more.**

**A3 — Two fidelity levels, exposed in plain language, never as "Conservative"/"Full".**

| | Conservative (default) | Full |
| --- | --- | --- |
| evidence | tags + self-validated folders | + uncorroborated folders |
| series created | **19** | 28 |
| books placed | 179 | 213 |
| grouping purity (edition-aware) | **98.3%** | 97.2% |
| canonical number correct | 96.4% | 95.2% |
| standalones swept in | **0** | 2 |
| coverage of in-series units | 75.8% | 89.0% |

Full is a checkbox, `Also group by folder name`, default **off**, rendering only when
detection is on.

**A4 — The number-collision check keeps editions apart.** This is the edition fix, and it
is a *grouping* rule, not an identity concept:

> If a proposed series has ≥4 numbered books, and ≥25% of its numbers are duplicates, and
> its members partition by folder into ≥2 parts that each hold ≥2 books and are each
> internally near-unique — **take the folder split**, and name each part by its raw folder
> name.

On the real corpus it fires exactly once and correctly: an 80-book merge with 49% duplicate
numbers splits into 41 + 39. Edition-aware purity **77.9% → 98.3%**. It correctly declines
where duplication is just under threshold and the partition would be degenerate.

**A5 — No one-book series.** A series needs two books; a second book arriving later
creates it. This also removes three fragment/parent collisions for free.

**A6 — Sidecars do not enter the cascade.** `.nfo`/`.opf` were measured and dropped:
expected yield ≈0–1 units against ~28.6s added to every scan. (Unrelated to the deferred
general-metadata effort, where `.nfo` narrator data is still the best in the corpus.)

**A7 — Abstention bias governs the cascade.** Never create a series without confidence it
is correct: an unmade group costs one trip to the editor, a wrong group costs trust. It
governs the *cascade*; it does not govern the *default* (see A9).

**A8 — Grouping and naming are different problems, and only grouping is expensive.**
Purity 98.3%, display names 94.2%; *every* surviving name error has correct grouping.
Optimise for grouping purity and treat the name as an **editable default**.

**A9 — The `Series Detection` card**, in `Manage Library`. **ON by default, not
Pro-gated** — gating detection would invert the redesign for free users, and an empty
Series tab reads as a broken feature rather than an upsell.

```
+- Series Detection ------------------ (i) -+
| Automatically group books into series     |
| using their tags and folder names         |
|                                           |
| Enable Series Detection          [ ON ]   |
|                                           |
| [ ] Also group by folder name             |
|     Finds series that have no series      |
|     tags, using folder names. May         |
|     occasionally group a folder that      |
|     isn't a series.                       |
|                                           |
| [ Detect Series in Existing Books ]       |
|                                           |
| Removed Series (3)                     >  |
+-------------------------------------------+
```

Copy ships exactly as written in [09](issues/09-auto-generate-series-setting.md) §9 —
card description (no trailing period), the `Info` dialog's three paragraphs, and the
sub-option caption above. The caption stays **generic on purpose**: the real rule turns on
*contradiction versus absence*, which is not sayable in a caption, and every short
approximation misdescribes at least one real case.

- **The retroactive button carries no count.** The naive figure ("books not in a series")
  is not a promise the way the auto-chapters count is — most books in a typical library
  are standalones that will never group.
- **OFF stops future detection and leaves existing series untouched**, matching the
  `autoChapterInterval = null` precedent exactly.
- **Deliberately unmentioned in the copy:** that two recordings of one series stay
  separate. It is internal machinery the user cannot act on, and naming it invites doubt
  about a case that is already handled.

**A10 — Regeneration reconciles; it never rebuilds.** "Wipe-and-regenerate" does not ship.
The contract, per row:

```
row still detected + still valid  ->  LEAVE IT (position intact)
row detected but no longer valid  ->  remove
newly detected book               ->  insert, seed position from canonical
origin = 'user'                   ->  skip the series entirely
name_source = 'user'              ->  keep the name, reconcile membership
```

Hand-ordering survives **for free**, with no ordering flag: canonical seeds `position`
only at create and at insert, never re-seeding an existing row.

**A10a — matching a proposal to an existing series takes TWO passes, and the second is not
optional (added by 05).** By name first, on `normalizeSortName` — the same key
`isDuplicateSeriesName` and the `sort_name` column already use. Then, for proposals that
matched nothing, by **book overlap** against `origin = 'detected'` series only.

The second pass is what makes the contract's own last line true. Once a user renames a
detected series, no proposal will ever match it by name again; without continuity the
relationship ends there, the next scan re-creates the old name from the same books, and
every one of them sits in **two series at once**. Renaming is the commonest repair there
is, so the failure is not exotic.

- **This is not a second identity and A15 still stands.** Nothing here is shown to the
  user, nothing merges, and two series never become one. It answers one internal question:
  *is this proposal the series I already made?*
- **Overlap counts every row, tombstones included** — exclusions never reach the detector,
  so it keeps proposing excluded books, which makes the tombstones the strongest evidence
  of continuity there is. Counting only visible rows loses a renamed series that carries a
  few, and the re-created duplicate then carries the excluded books **back in**, walking
  straight through A11. This was a live defect during the build, not a hypothetical.
- **Thresholds: ≥ 2 books in common, and more than half the series' rows.** Strict rather
  than generous, because the two failures are not symmetrical — matching too eagerly
  removes every detected row the proposal lacks, matching too reluctantly leaves a
  duplicate series that the user can delete.
- **A user-origin series is reachable by NAME only.** A playlist that happens to hold three
  Discworld books is not Discworld.

**A10b — reconcile has no rename verb, and no number-update verb (decided by 05).** The
plan's only verbs are create, insert and remove-a-detected-row. A detected series keeps the
name it was created with even when detection would now elect a different one: a series that
quietly renames itself between scans is alarming in a way a slightly stale name is not, and
`name_source = 'user'` is then honoured *a fortiori*. Likewise a blank `canonical_number`
on an existing row is never filled by a later scan — A10's first line says LEAVE IT, and D5
already settled that blank beats misleading. Both are reversible if a real library shows
they bite.

**A11 — Removals need a tombstone.** `membership = 'excluded'` keeps the join row as a
hidden marker that blocks re-derivation; display filters exclude it. Without it, a user
removes four books from a wrong merge, rescans, and gets all four back — the most
trust-destroying outcome available.

**A12 — Delete always suppresses.** Deleting a **detected** series writes its name to
`suppressed_series` so detection will not recreate it; deleting a **hand-made** one writes
nothing, because nothing would recreate it. Recovery is a browsable `Removed Series` list
with `Restore` and `Restore All`; restore deletes the row and the next scan recreates the
series. A checkbox on the delete dialog was rejected — **a modifier asking for foresight
fails exactly when foresight is absent.**

**A13 — Detection must consult both tombstones before creating**, and hand-creating a
series whose name sits in `suppressed_series` must clear that row, or the user's own new
series is shadowed by an invisible veto.

**A14 — Bulk creates, per-item destroys.** The app already ruled this once
(`Auto-Generate Chapters` is a two-surfaced precedent) and there is no bulk destroy
anywhere in the codebase. Every bulk action on the detection card is creative. **No bulk
destroy ships.**

**A15 — Series identity is `name` alone.** Edition is a naming convention carried in the
name and filled from the folder (`Discworld` / `Discworld (2022)`) — there is no `edition`
column and no grouping level above series. Detector-generated name collisions
**disambiguate** (parent folder, then ` (2)`); they never merge and never abstain. The
existing duplicate-name validation needs no change.

**A16 — The confidence tier does not persist.** The tier (`certain`/`likely`/`possible`/
`guess`) plus its reason string stay a description of the **algorithm**, emitted to the
scan log. Nothing is stored. Its only consumer was the review queue, which A9 replaced;
no surface displays provenance (no chip on browse, none on the sheet, none in the editor,
a static line on `titleDetails`).

---

### B · Browse

*Sources: [08](issues/08-browse-presentation.md) ·
[12](issues/12-series-display-setting.md) · [07](issues/07-sequence-numbering.md)*

**B1 — The repeating unit is a full-bleed row.** No card. Separated by an inset hairline
rule matching the books list's separator, with a footer copy so the list terminates on a
line. ~140dp, ~4.5 series per screen. **It does not expand.**

Left to right:

1. **A fanned cover cluster**, max 3 layers, each layer's right edge a constant peek beyond
   the one in front, back layers shrunk and darkened per layer.
2. **A centred play glyph on the front cover.** One tap plays.
3. **A text column**: series name (2 lines, truncating) · meta line
   (`22 books · 7 finished · #1-22`) · completion bar with an `n/total` label · a next-up
   line with **three** states — `Next · #9 Eric` / `Continue · #9 Eric` /
   `Series complete`.

**B2 — Cover geometry is square, and that is load-bearing.** Every layer box is square:
tall art is pillarboxed over a fixed near-black, wide art is cropped evenly. The cluster's
width is constant regardless of cover count or shape. Both rules exist so the glyph aligns
down the list and **every row's text column starts at the same x**.

**B3 — The play affordance is never absent and never carries a word.** Its target is the
next unfinished book, or the first book when the series is finished. The
`Start`/`Continue`/`Restart` label cost ~27% of the row's width and caused four faults; the
state is already carried twice (progress bar + next-up line), so the word is **redundant,
not sacrificed**. Adding the third next-up state is what makes that true.

**B4 — Play-glyph house style: the darkening is the GLYPH, never the artwork.** The
glyph's own `fill` is the 0.42 black; its stroke is a **fixed near-white**; there is **no
scrim, disc or badge outside the play shape**. Every pixel of artwork outside the glyph is
untouched. Both colours are **fixed, never theme-derived** — a palette-coloured glyph was
this effort's first light-theme defect. Applies to **both** places a glyph is drawn: the
browse cluster and the detail sheet's book rows.

*Two rejected predecessors, do not reintroduce:* a full-cover 42% scrim (turned a 22-row
list into 22 identical buttons) and a 26dp disc (a smaller darkened patch is still a
darkened patch).

**B5 — Tapping anywhere else on the row opens the series screen.** Two targets, two
meanings.

**B6 — Row height is variable.** A 2-line title grows the row. The earlier
"predictability over elasticity" ruling is **deliberately reversed**.

**B7 — Inline expansion is gone**, and with it the masonry list, every book cell and the
nested-horizontal-list construct. The Series view simply stops being a customer of the
book-grid components; **the books home and books grid are untouched — nothing forked,
nothing modified.**

**B8 — No provenance on browse.** An origin chip truncated the canonical range on 5 of 15
series; a row cannot carry both at full width.

**B9 — `Series Backgrounds`** — the backdrop toggle. `Appearance → Display Settings`,
beside `Number of Columns`. **Default ON, global, not Pro-gated.** Label, description and
info copy ship exactly as written in [12](issues/12-series-display-setting.md).

- **Default-ON is decided on which dissatisfied user can rescue themselves.** A user
  irritated by the backdrop goes hunting in settings; a user seeing the quiet row never
  learns the richer one exists.
- **Global and not-gated are entailments, not choices.** `settings` is a single-row table,
  so per-library is inexpressible; and gating a default-ON setting charges users to turn
  something *off*.
- **Naming constraint worth keeping:** the cover cluster shows in **both** states, so any
  label reading "show cover art" names something the toggle does not control.
- **The scrim value does not vary with the toggle.** Since B4 moved the darkening into the
  glyph's own fill, the glyph's legibility is independent of the backdrop entirely — which
  serves this ruling more completely than the original scrim did.
- **The product commitment this creates:** *every future change to the Series row must
  work in both states*, and any later variant that only reads well over a backdrop is
  ruled out by this decision.

**B10 — Presentation settings live in `Appearance`; detection settings live in
`Manage Library`.** The split brain is accepted knowingly: *"how does it look"* → Appearance
is a stronger mental model than *"everything with the word Series in it lives together"*,
and it costs no new card. **A control on the browse screen itself was rejected as
unprecedented** — `Number of Columns` has no on-screen control anywhere in the app.

---

### C · Series detail

*Sources: [11](issues/11-series-detail-contents.md) ·
[13](issues/13-detail-sheet-prototype.md) · [08](issues/08-browse-presentation.md)*

**C1 — Presentation is a `formSheet`**, matching the book details screen — the app's
existing detail-screen-for-an-object — with the same overflow-top-inset and corner radius.
The wizard's opaque-push ruling explicitly does **not** transfer: the wizard is a task
flow, this is a container.

**C2 — It is a root-sibling route, not a member of the series group.** This is forced, not
chosen: a screen inside the group cannot be a root-level sheet. It also makes the editor's
`Save`/`Cancel` exits correct by construction.

**C3 — Header is a grab handle only.** No nav row, no back chevron, no ⋮. A back chevron
on a bottom sheet is a mixed metaphor — the sheet dismisses downward, the arrow points
left. The handle is itself pressable and dismisses.

**C4 — Rows are SPLIT: the cover plays, the text opens the book's details.** The play
target is the whole leading half (number plus the full height of the artwork), so the
glyph advertises the target without being it. This restores the app-wide rule that a book
card is tappable to its details — this screen was the only place that broke it — and it is
the arrangement the library grid already uses. Sheet-over-sheet is **measured clean** in
both directions.

**C5 — A finished row restarts from zero, and the book becomes one you are listening to
again.** Landing thirty seconds from the end of a
finished book is a poor outcome whether or not there is an escape hatch. The finished check
mark is already the "you've read this" signal, so the tap has nothing to disambiguate.
*(See Out of Scope: the same fix is wanted in the library grid and is a carried commitment,
not an accepted divergence.)*

**⚠ AMENDED 2026-08-10, driver ruling, after the build and the device run. The restart also
flips `bookProgressValue` from `Finished` back to `Started`, and that half is not optional.**

**Nothing else in the app ever moves a book off `Finished`** — the playback service,
`relativeSeek` and the player only ever set it, and the one path back is the manual progress
control on the book details screen. So a restart rule that reads the flag without consuming
it **fires again on every later press**: restart a finished book, listen ten minutes, pause,
press play from any card, and the ten minutes are gone. Because C5 puts the rule in the
**shared** play helper, that would hit the library grid, list rows, book details and Android
Auto, not just this sheet.

Three consequences, all accepted knowingly:

1. **The ✓ clears the moment you press play**, along with the series' completion count, its
   `Series complete` line and its `finished` tab state. C5's reasoning above survives — the
   tick is the signal *at the moment of the tap*, which is all it was ever asked to be — but
   it is no longer permanent. A tick that survives a re-listen would need a different signal
   ("has ever been finished") and is **not** this spec's.
2. **`finished_at` is nulled**, because the model's single writer sets it for `Finished` and
   clears it otherwise. The date you finished a book does not survive re-listening to it.
3. **It fixes a lie that predates this effort.** The book-progress helper short-circuits
   `Finished` to 100% / `0m`, so a re-listen used to render a full progress capsule and the
   total duration for its entire length.

**A positional variant was built first and withdrawn** — restart only when resuming would
land in the last thirty seconds, leaving the flag alone. It passed on device. It was
withdrawn because once the flag is consumed the positional test has exactly one job left,
stopping a **hand-marked** book from restarting, and that is the wrong answer: if you marked
a book finished and then pressed play, *start it again* is the reasonable reading. The rule
is now one line with no carve-outs.

**C6 — The active book reuses the grid's treatment** — animated bars while playing, the
same title colour. Reused, not reinvented.

**C7 — The hero is 08's scrimmed cover backdrop and honours `Series Backgrounds`.** Both
states were already designed (ON = the browse treatment, OFF = a flat hero), so the
widening is a conditional, not a design. It needs a **bottom fade**: without one, the
backdrop's lower edge is a hard seam across the middle of the sheet.

**C8 — ⚠ AMENDED 2026-08-11, driver ruling, taken on device during ticket 15's run.
SERIES ART IS BACKGROUND-ONLY.** It paints the detail sheet's header backdrop and the
browse row's card backdrop, and **it never enters the cover fan**. The fan is the books;
its front card is **book 1, always**. A pinned cover that matches book 1's is happenstance,
not coupling.

> *"The series art is only used for the header background and the series list cards
> background, so cover 1's cover should always show at the top of the book stack, not the
> series cover — they should only be in lockstep if the user is using the first cover as
> the series cover, and that is just by happenstance."*

**What this overturns**, kept because the reasoning is the instructive part: the original
clause had pinned art **ride the fan's front card**, replacing card 0 rather than
prepending, so the cluster's width and peek stayed constant — and it was *one line*,
because card 0 already WAS the first book's cover. That economy is exactly what was wrong
with it. The fan and the backdrop shared a single expression, so pinning a cover changed
the fan **as a side effect**, and two decisions were welded into one.

Three consequences:

- **`heroClusterCovers` is DELETED, not amended.** Stripped of its pinned branch it
  computed `getSeriesRowFacts().cluster` character for character, so the hero reads that
  directly and **one** mutation guard now protects both fans.
- **The backdrop gets its own expression** — `seriesBackdropUri`: pinned artwork, else book
  1's cover. Two decisions, two expressions.
- **The browse row gains a read it never had.** It ignored `series.artwork` entirely; under
  this ruling its card backdrop is one of series art's two homes.

**It also dissolves a finding raised in the same session.** Pinned art carries no
dimensions — §G is closed at 13 columns and `series.artwork` has no `artwork_width`/
`_height` companions — so it is assumed square and a tall source is centre-cropped. As an
88dp **card** that was visible and ugly: it sliced the author's name off the top of a real
cover and the series title off the bottom. As a **backdrop**, which is scrimmed, faded and
cropped by design, nobody reads text off it, so the missing columns stop mattering and no
v34 migration is implied.

**C9 — Carried from 08 unchanged:** the fanned cluster · the name, capped with
tap-to-expand and no label, with overflow **measured** rather than inferred · the meta line
with the canonical range · the completion bar · a `Start`/`Continue`/`Restart` button that
**keeps its word here**, because a full-width hero button does not have the browse row's
width constraint · one row per book showing `#canonical` or a blank.

**C10 — One route to the editor: a wrench row reading `Edit series`**, under the play
button. No ⋮ on this screen — a menu holding a single item that duplicates a visible row
two inches below it is not worth its pixels. It returns when split/merge does, or when
anything else earns a slot.

**C11 — The series description does not ship.** Dropped entirely, not deferred.

---

### D · Correction / the editor

*Sources: [10](issues/10-correction-surface.md) · [11](issues/11-series-detail-contents.md)
· [13](issues/13-detail-sheet-prototype.md) · [07](issues/07-sequence-numbering.md) ·
[09](issues/09-auto-generate-series-setting.md)*

**D1 — Correction IS the existing edit screen**, grown by three things: **series
artwork**, a **per-row canonical number**, and **`Sort by number`**. A dedicated rename
dialog was offered and rejected: one surface, one validation, one call site. The five-tap
journey to a rename is accepted.

**D2 — One word for the destination, and a wrench for the act.** `Edit series` with a
wrench glyph: the glyph signals *correction*, the word signals *destination*.
**`Fix this series` is retired** — it presumes breakage on the 98.3% of detected series
that are correct, and on every hand-made playlist.

**D3 — The canonical number is a per-row `decimal-pad` field.** Editing a number
**does not resort** — position keeps sole sort authority, so a row must not move out from
under the cursor.

- **`canonical_number` is a nullable NUMBER.** The letter forms (`14b`, `1-3`) are dropped
  rather than paying an alphabetic keyboard on every number edit; `14b` renames to `14.1`.
  The constraint becomes *structural* — a letter form cannot be stored even by accident —
  and most normalisation collapses into a parse.
- **Ranges are the casualty, not letters.** An omnibus of books 1–3 carries a single
  number. Accepted.
- **⚠ Locale trap — see K3.**

**D4 — `Sort by number` re-seeds `position` on demand**, numerically, **NULLS LAST**, and
stable, so a partly-numbered series does not shuffle its unnumbered tail. Disabled when
nothing is numbered. It sits beside the name field.

**D5 — Bulk numbering ships, gated to fully-unnumbered series only.** Renumbering over
existing values *is* a bulk destroy and is out on precedent (A14). **"Fill blanks only"
was rejected**: on `1, _, _, 8` it manufactures false canonical data — *blank beats
misleading*. Gated to zero-numbered series it is a pure create whose only input is the
order the user arranged. It and `Sort by number` are exact opposites: one seeds order from
numbers, the other numbers from order.

**D6 — Series artwork lives in the editor**: a pressable cover with an add-image badge
beside the name field, mirroring the book editor — the app's only entry point to cover-art
search.

- **The book artwork replacement helper generalises to serve books and series.**
- **Immediate-write is kept, plus a confirmation *before* applying.** Deferring is
  incoherent (see K6).
- **"Pick a member's cover" is dropped.** Web search subsumes it; series art has exactly
  **one** override mechanism.

**D7 — A caption under the cover control does indicator, explanation and escape hatch in
one element:**

| State | Caption |
| --- | --- |
| artwork is null | muted, non-interactive — *Using first book's cover* |
| artwork is set | pressable — *Use first book's cover instead* → nulls the column |

Words rather than a pin badge, on D2's own division: a badge tells you the state and gives
you nothing to press, so reverting would need a second, undiscoverable affordance.
**Reverting should delete the pinned file** (see K8).

**D8 — `Delete Series` lives here**, reusing the existing origin-blind dialog, whose copy
is already correct: *"Delete series? This removes the series. Your books are not
affected."* Deletion also writes the suppression row per A12. **Its exit must pop past the
detail sheet — see K7.**

**D9 — Two correctness defects the editor carries today and must fix:**
1. **It is not detection-aware.** Its save path rewrites join rows, so a rescan re-adds a
   removed book; and it *deletes* the series when its last book goes, where A12 requires
   suppression.
2. Save and Cancel exits are correct by construction once C2's routing lands; **Delete's
   is not.**

**D10 — A known finding, kept because it reads like a bug and is not:** `Sort by number`
silently changes the series cover, because artwork derives from the first book and follows
a reorder. That is the specified behaviour. It is also the argument for siting the artwork
override right there — you watch it move, you pin it immediately — and D7 is what makes the
pinning legible.

---

### E · The create/edit surface (formerly the wizard)

*Sources: [15](issues/15-wizard-flow-shape.md) · [05](issues/05-wizard-presentation.md) ·
[13](issues/13-detail-sheet-prototype.md)*

**E1 — The wizard stops being a wizard.** It is **the editor with an on-demand picker
panel**, on **one route**, presented as a **root `transparentModal`** from every launch
context. Create and edit are one surface.

**E2 — What it is FOR: hand-building playlists.** Rescue and delete-and-rebuild still work;
they are simply not what the shape is optimised for. Decided on the **asymmetry of being
wrong** — choosing this shape when the real case is rescue costs +1 press, constant,
forever; choosing the alternative when the real case is a playlist costs ten
expand/collapse cycles *and* no surface that ever shows all candidates at once. Corroborated
by volume: the whole rescue path is ≈7 books in a 350-title library, once. Playlists are
unbounded.

**E3 — The flow.** `+ Add books` opens a panel that runs `Authors → Books`; the ordered
list stays on the editor surface beneath it. The author multi-select is a **non-modal
volume reducer** (ten authors turns ~350 books into ~50 rows) — which is why it survives
the ruling that closed filter/search. Selections are **staged** until the step is
committed, so nothing above the panel moves while you pick.

**E4 — `X` and `+ Add books` are inverses.** `X` closes the panel onto the editor and
never exits the flow. The editor keeps its own `Cancel`, `Save` and `+ Add books`.

**E5 — Back is Cancel.** The header chevron and the hardware/gesture back both leave the
editor, exactly as the footer's `Cancel` does. Neither steps back through the panel.

| | |
| --- | --- |
| `X` | closes the panel, **keeps** the editor |
| back / chevron / `Cancel` | **leaves** the editor |

A stage-walking version was built and **rejected**: it made one gesture mean "undo one
step" three times and then "abandon everything" on the fourth, with nothing on screen
marking which press you were on. Every route out of the screen now means one thing.

**E6 — Empty state copy: `Add books to get started.`** (The panel-closed-with-no-books
state became reachable for the first time under E4.)

**E7 — Numbering is playlist-shaped.** Boxes start empty; blank means no canonical number;
an untouched list is numbered `1..n` from its **final drag order at save**; `Sort by
number` puts blanks last and stays a **manual** action.

**E8 — Consequences that follow necessarily.** The three separate create screens are
**deleted**; their draft resets move onto the editor. Both existing entry points (the
library's create action and the editor's `Add books`) retarget to the single route. The
"book picker shared between create and edit" problem **dissolves** rather than being
solved.

**E9 — Carried unchanged, do not reopen:** staged selection · the blank-box numbering rule
· `Sort by number` pinned right and manual · the delete badge at the card's top-left
carrying its own scrim · no book totals · no name prompt · Order in the main list ·
`Delete Series` absent from the create pass · **the author cell grid (§E14)**.

**E10 — Closed, do not re-offer:** the A–Z rail · filter/search over authors · the
bottom-sheet picker · variants A–D, F and G.

**E11 — This does not reopen the wizard-presentation ruling.** What that ruling bought was
*full-screen opaque content with a Save/Cancel footer*, not a slide; the book editor is
already a `transparentModal` reading as a full takeover. Only the transition and the
route's parent change.

**E12 — Known consequence, flagged and not fixed:** `Books → Authors` has no direct
affordance — getting back is `X` then `+ Add books`, which loses the author selection.
A chevron in the panel's own header restores it (~5 lines) **if it reads wrong in use**.

**E13 — Shipping requirement the prototype does not meet:** the candidate pool must be the
list's own virtualized list with everything above it as a header component. The prototype
renders it unvirtualized inside the sortable's scroll view — fine at eight books, not fine
to ship.

**E14 — AMENDMENT (2026-08-10, driver-approved): the author step is a two-column grid.**
This clause carries a decision this spec omitted. It was taken on device on 2026-08-04
([15](issues/15-wizard-flow-shape.md), Variant E, driver's decision 5 of 5) and it survived
the 2026-08-05 ruling that chose E — which confirmed, on inspection rather than assumption,
that *"E needs no change under the playlist reading."* The original spec pass carried E's
flow decisions and dropped its cell geometry; nothing overturned it.

| | |
| --- | --- |
| Columns | **2** |
| Name type | **13px** |
| Pitch | **~50dp** |
| Selected state | primary border + 12% tint + a **14px corner check** |

**No big check bubble.** The tiny corner check was built rather than dropping the check
entirely, because border-colour-alone is a **colour-only state**. All three signals — row
border, tint, glyph — read at a glance; that was verified, not assumed.

**Why the grid and not a list.** The author step is the **non-modal volume reducer** of
§E3, and its job is scanning 50–100 names. Measured on a 100-author corpus: **~18–20
authors per screen**, so 100 authors is ~5 screens. The single-column alternative at
`fontSize.base` is **variant F's** row metric — 7 authors per screen — and F is closed by
§E10.

**§H8 does not reach this surface, and must not be cited against it.** H8 closes
multi-column for the **browse row**, whose columns each need phone-parity width for a cover
plus a text column. These are 13px name cells. More decisively, **§H7 exempts the
create/edit surface from all of §H**, H8 included — which is the scope
[16](issues/16-geometry-stress-tablet-fontscale.md) set for itself when it ruled.

**13 is a deliberate literal.** The scale is `xs: 12 · sm: 16 · base: 20 · lg: 24`
(`src/constants/tokens.ts`), so no token sits below 16 and the grid cannot use one. A
similar literal was once "corrected" upward by an agent reading it as an oversight and the
driver reverted it. **Do not token-ise this value.**

**Untested axis, carried as a known risk:** the grid was verified at ~100 authors but never
at **font scale 2.0** — 16's geometry pass scoped the wizard out. 13px inside a ~48.5%-wide
cell at 2× is the shape that clips.

---

### F · `titleDetails` integration

*Sources: [14](issues/14-titledetails-integration.md) ·
[10](issues/10-correction-surface.md) · [17](issues/17-light-theme-pass.md)*

**F1 — A static subheading directly under the book title** — `Book 8 of Discworld`. It is
part of the **title block**, the way a printed cover does it. It beat three structurally
different rivals, each asserting a different answer to *what kind of thing is a series*
(identity/byline · tag/chip · metadata/card).

**F2 — Exactly ONE series is shown.** The largest **detected** series wins; if the book is
in no detected series, the **first user-created** one wins.

> **The asymmetry is the ruling, not an oversight.** Detected series have no meaningful
> creation order — it is scan order — so size is the only available signal, and the bigger
> series is almost always the canonical one with the sub-series as the specialist grouping.
> User-created series *do* have meaningful order, so "first created" stands for them.

Verified against a book in 12 series. **This amends 10's "renders a LIST":** a book in two
series names one here; the other membership is reachable only by opening the series sheet.

**F3 — Static, not tappable.** A subheading that reads as prose has nowhere to put an
affordance cue without becoming a field again — which is the thing that made it win. The
route is not lost, only un-duplicated. **This amends 10's "taps through to series
detail".**

**F4 — No number, no problem.** A book with no canonical number renders `Part of <series>`,
never a substituted position. **Blank beats misleading.**

**F5 — Zero series renders nothing at all**, per the app-wide convention that an
inapplicable item is **absent, not disabled at reduced opacity**.

**F6 — One colour, one string, and it is a fixed light-coloured token — not a theme
token.** This screen paints an artwork-derived mesh gradient that is **dark in both
themes**; theme text tokens measured **1.20:1** on it in light theme. The whole string uses
the shared light-coloured muted token (**1.20 → ~4.8:1**). **This amends 14's two-tone
`Book N of ` prefix** — the hierarchy the two-tone bought is now bought by the token
choice. See K9 for the naming trap that makes this counter-intuitive.

**F7 — The negative top margin is load-bearing.** The info column sets a fixed gap between
every child, which made the line read as its own block; the target was the gap that
`Read by` has above the narrator's name, which is *no gap at all*. The gap **below** is
deliberately kept — that is what keeps the line part of the title block rather than the
author block. **Do not "clean it up".** It is also scale-invariant (the gap it cancels is
fixed dp too), so it needs no font-scale re-check.

**F8 — `Add to series…` sits under `Edit Book Details`**, grouping the two items that act
on what the book *is* above the two that act on how it *plays*. It is **always present** —
any book can join another series, so it has no inapplicable state. It is **join-only**:
no `New series…` row. Book-first stays austere.

**F9 — No book-first remove.** Removal changes a *series'* membership, and the tombstone
is series-scoped.

**F10 — The `Layers` glyph collision is resolved: series keeps `Layers`, auto-chapters
moves to `TableOfContents`.** `Layers` was doing double duty as the library's Series-view
toggle *and* the `Remove Auto-Chapters` glyph, which would have put identical icons on
adjacent rows. **This is the only real-code change 14 made, and it SHIPS — it must survive
the harness cleanup.**

---

### G · Schema and migration

*Source: [18](issues/18-schema-consolidation.md) — its `## Answer` is the canonical column
list; this section copies it and **amends it once**, see G1a.*

**G1 — One migration, appended as `toVersion: 33`.** Thirteen columns across four tables
plus two new tables, and **one index** (see G1b). The schema definition bumps 32 → 33 and
carries the identical shape.

```
addColumns  series_books
  canonical_number            number   isOptional   -- 07, type changed by 10
  canonical_source            string   isOptional   -- 07  'user' | 'detected'
  membership                  string   isOptional   -- 09  'detected' | 'user' | 'excluded'

addColumns  series
  origin                      string   isOptional   -- 06  'detected' | 'user'
  name_source                 string   isOptional   -- 09  'detected' | 'user'
  artwork                     string   isOptional   -- 11, NO *_source companion

createTable suppressed_series                       -- 09
  name                        string
  created_at                  number

addColumns  settings
  series_backgrounds_enabled      boolean  isOptional  -- 12, default ON
  series_detection_enabled        boolean  isOptional  -- 09/A9, default ON
  series_folder_grouping_enabled  boolean  isOptional  -- A3, default OFF

addColumns  books                                       -- G1b, tag capture
  series                          string   isOptional   -- extra.SERIES   6.6%
  part                            number   isOptional   -- extra.PART     5.9%
  grouping                        string   isOptional   -- Grouping       5.6%
  file_format                     string   isOptional   -- 99.7%, already
                                                        --   extracted, dropped

createTable book_tags                                   -- G1b
  book_id                         string   isIndexed
  raw_json                        string
  captured_at                     number
```

**G1a — AMENDMENT (2026-08-06, driver-approved): the settings columns are three, not
one.** 18's `## Answer` counted 12's display boolean and stopped there; **the
`Series Detection` card's own two toggles were never given columns by any ticket.** 09
decided the card's behaviour and 18 decided the column list, and the pair fell between
them — 09's "09's two" meant `name_source` and `membership`.

They are not optional to add. **K1 is the binding fact: settings in this app ARE schema**,
one column per preference on a single-row table, and A9 anchors OFF-behaviour on the
`autoChapterInterval = null` precedent, which is itself a column. There is no existing
column either toggle could ride.

It had to be settled *before* the migration was written rather than after, because **G3
lets this branch claim exactly one version number.** Discovering the gap at the settings
ticket would have forced a v34 — the outcome G3 exists to prevent.

**Consequence for K1:** `series_backgrounds_enabled` is no longer the table's only
default-ON boolean. **`series_detection_enabled` is the second, and needs the same
inverted getter (`!== false`, fallback `true`) at its own site.** Copy-pasting the
house `=== true` idiom now ships the wrong default in two places instead of one.
`series_folder_grouping_enabled` is default-OFF and takes the ordinary idiom.

**G1b — AMENDMENT (2026-08-06, driver-approved): the scan captures the tags it currently
discards.** The detector's two highest-trust signals — `extra.SERIES` and `Grouping` —
**were never persisted by anything**, and §A1's "already reachable from JS" is true of the
*turbomodule* but not of the *database*: `extractMetadataFromResult` is a funnel that drops
them. Without this the cascade would run on a strictly poorer input than the corpus it was
measured against.

Four queryable columns on `books`, plus a **side table holding the whole General track and
its `extra` bag as JSON**. Fill rates are measured against the 304-record device pull.

- **The blob is a side table, not a `books` column, and that is load-bearing.**
  WatermelonDB loads a model's **full raw record** into memory, and the library store
  observes seventeen `books` columns across the entire library. A ~2 KB JSON string per
  book on that table would ride every library query. On `book_tags` it is read only when
  something asks for it. Cost measured: mean **2,011 bytes** per record, ~**0.70 MB** for
  350 books.
- **Capture is wider than detection needs, deliberately.** A later feature that *displays*
  a file's metadata is out of scope here, but the blob means that feature costs **no
  migration and no second pass over the library** — it reads what is already stored. This
  is the whole reason the blob beats a wider column list: a column can only hold a tag
  somebody predicted.
- **`book_tags.book_id` is the one index, and G6's rule permits it** — it is a foreign key
  on a table that grows with the library, which is exactly the shape G6 says the existing
  six indexed columns have. **G6's "no new indexes" governs the Series columns and is
  otherwise unchanged.**
- **NO BACKFILL SHIPS. Driver ruling: the app is in closed testing, wiping and re-adding a
  library is acceptable, and a `Re-read Library Tags` settings action was rejected as
  "forcing the user to perform actions the code should have already taken care of."** The
  automatic alternative was costed and is *not* cheap: `processDirectoryFiles` **creates**
  book and chapter records from MediaInfo output and has no update-existing path, so a
  silent top-up needs its own update-only pass — the same work as the button, minus the
  button. Neither ships. Existing rows fill when their files are scanned as new.
- **Not backfilling is safe, and this is measured, not assumed.** Re-running the real
  pipeline with `SERIES`/`Grouping`/`PART` nulled out — i.e. exactly what an un-re-imported
  library looks like — leaves **series count, coverage and 98.3% grouping purity
  byte-identical**; only canonical-number accuracy moves, **96.4% → 93.5%** (~5 books).
  The tag signals are a *number* refinement on this library, not a *grouping* one, because
  the same books' albums parse anyway.
- **`SUBTITLE` is NOT captured as a column but IS in the blob.** It was nearly dismissed as
  derivable from `SERIES` + `PART`; **2 of its 17 real records carry a `SUBTITLE` with
  neither** (`'Hierarchy, Book 1'`). Independent signal, too thin to build on, free to keep.
- **Free correction owed to the repo, in the same funnel:** `mediainfo.ts` reads
  `general.rldt` as a `releaseDate` fallback. Real data always nests it at
  `general.extra.rldt` — **0/304 top-level, 47/304 under `extra`** — so that branch has
  never fired. The same shape on `general.nrt` is harmless only because `extra?.nrt` sits
  second in the same `||` chain. **Fix `rldt` when capture is written.**

**G2 — Appended, not a rewrite of v32.** Rewriting v32 was live (no real device has ever
run it) and was **offered and rejected** for append-only, which is the discipline that
survives being *wrong* about who has what. Consequences, all verified: real devices go
31 → 32 → 33 and v33 runs against **zero rows** (v32 creates the tables empty); **emulators
need no wipe**; v33 is uncontested across every local branch.

**G3 — Everything rides one block, including all three settings booleans.** Multi-table
migrations are already house style. The "whole model at once vs ship-per-feature" framing
is a false alternative: a migration lands **optional columns**, not UI, so features still
ship incrementally on top of one block. The real axis was how many version numbers this
branch claims from a namespace shared with `main`, and the answer is **one**.

**G4 — Nothing is renamed. There are FOUR provenance columns and the split is a rule:**

> **`<x>_source` names the provenance of the column `<x>` beside it. A bare noun names a
> column whose value IS its own provenance** — because the row's existence is the value.

`name_source` sits beside the series name; `canonical_source` beside the canonical number.
`origin` and `membership` have no neighbour: a series exists because someone created it, a
join row exists because someone put that book there. **This rule goes in the schema file as
a comment** — a reader who hits it infers the pattern instead of reverse-engineering it.

**Known wart, kept:** `membership = 'excluded'` reads as a contradiction at the call site.
All three alternatives are worse — a `_source` suffix would lie, `'removed'` collides with
the `Removed Series` list, and splitting it is the sixth column 09 rejected.

**G5 — Every enum column is nullable, and null coalesces toward `'user'`.**

```
origin           ?? 'user'
name_source      ?? 'user'
membership       ?? 'user'
canonical_source -- NO coalesce; null means "no number is set",
                 -- since canonical_number is itself nullable
```

**The direction is abstention bias applied to the schema.** A row wrongly read as `'user'`
is merely never auto-updated — harmless. A row wrongly read as `'detected'` is **eligible
for regeneration to clobber**, destroying a hand-made playlist and breaking the guarantee
that makes the whole promise structural. Nullable is also the only *honest* option — see
K10. An SQL backfill step was offered and rejected: it is a no-op on every real device and
buys only tidier emulator data, at the cost of SQL on a surface that fails silently.

**G6 — No new indexes on the Series columns.** (`book_tags.book_id` is indexed and is the
one exception — G1b explains why it satisfies this rule rather than breaking it.)
The six existing indexed columns are all foreign keys on tables
that grow with the library, plus one lookup key; none of the new columns is that shape.
The suppression table is read **once into a set per detection run** (a batch, ~28
candidates, realistically 0–20 suppressed rows); `membership` is always filtered inside one
series and so already narrowed by an indexed key; `origin` scans ~28 rows; the rest are
read but never filtered on.

**G7 — The suppression name must be de-duplicated in JS on write.** There is **no
unique-constraint support anywhere in the DB library** — `isIndexed` emits a plain index. A
double-delete otherwise writes two rows and the `Removed Series (N)` count is wrong.

**G8 — The settings getter inverts the house idiom.** See K1.

**G9 — Free, verified, and worth not re-deriving:** the canonical number costs **no
type-change migration** (its string form never existed in a shipped schema, so it lands as
a number on first appearance); the schema test suite is **already version-agnostic on
purpose**, so v33 costs no test churn, only additions; and **fresh installs never run
migrations at all** — every nullability decision above concerns upgrade paths only.

---

### H · Cross-cutting: geometry (tablet width, font scale)

*Source: [16](issues/16-geometry-stress-tablet-fontscale.md) — built and verified on the
phone and both tablets.*

**H1 — The browse row's content caps at `min(width, 600)dp`, left-anchored.** 600 is
Android's `sw600dp` breakpoint: Series content never grows past the width at which the
platform stops calling the device a phone.

**H2 — The cap is BROWSE-ROW ONLY.** It was applied to the series info page, built, looked
at, and **reverted on sight**. The finding is that the same rule lands differently on the
two surfaces: the browse row bleeds paint the full width, so a capped content block sits
inside paint and the cap is nearly invisible; the info page has **no full-bleed paint to
absorb it** and reads as content shoved into the left 600dp. Nothing was lost — the defect
the cap was aimed at is closed by H6 alone, at any width.

**H3 — Paint is never capped.** The backdrop and the hairline rule still span the device.
Capping them puts visible edges on the row and reads as the card 08 measured and rejected.
**Left-anchoring, not centring**, is equally deliberate: it keeps the heaviest part of the
scrim under the text.

**H4 — Cluster SIZING scales on both surfaces, and it is a different rule from the layout
cap.** The general form, and it binds anything added later:

> **Every Series cover cluster is a fixed fraction of `min(width, 600)`, anchored on its
> own 411dp value — never a literal.** A new cluster means picking its phone size and
> dividing by 411.

This reproduces today's phone sizes **exactly** (a verified no-op at 411dp) and preserves
the hero's deliberate 1.24× lead over the browse fan at every width. Scaling one and not
the other **inverts the artwork hierarchy** — that happened, and the overview's fan ended
up bigger than the detail's.

**H5 — Type is NEVER scaled with width.** Material 3 and Apple HIG both hold the type scale
constant across window size classes; scaling it also collides with a lever the user has
already set globally; and this repo has paid for a width-derived multiplier once already.
**Padding and the leading visual may scale; type may not.**

**H6 — On the series info page, the finished check mark travels with the title.** It is an
*indicator*, not a target, so the row's text shrinks rather than filling — closing a
measured 416dp gulf between a title and its tick.

**H7 — The create/edit surface is EXEMPT from all of this.** Its radio buttons and drag
grabbers are **targets** that want a predictable screen edge.

**H8 — Multi-column is closed by arithmetic, not taste.** The app is portrait-locked, so
the widest reachable window is 800dp, while two columns need ~822dp for phone parity. Two
columns at 800dp would be **narrower than a phone**. Single column is a *consequence*; it
reopens only if the portrait lock is lifted.

**H9 — Font scale: the meta line's sacrifice order is `M finished` first.** It is the only
redundant segment — the completion bar renders the same count directly beneath it — while
the canonical range has no other home on browse. `6 books · 2 finished · #1…` becomes
`6 books · #1-6`.

**⚠ The prototype's font-scale threshold is a PROXY.** The shipping rule must drop the
segment **when the line actually overflows** — measure, do not infer.

**H10 — The canonical range caps at THREE runs**, then an ellipsis. Three is **measured,
not chosen**: `#1-4, 4.5, 5-8` is exactly what fitted at 411dp / font scale 2.0 behind a
`9 books · ` prefix, which — with `M finished` now dropping first — is the true worst case.
The cap's job is to **cut at a run boundary**, which is why a character budget lost. The
range collapse was previously unbounded: an alternating 41-book series emitted ~70
characters.

**H11 — Browse-row name truncation is intended**, with the info page's tap-to-expand as
the escape hatch.

**H12 — The backdrop is NOT a width defect.** This was claimed and **refuted**: the row's
text legibility *improves* with width, because the gradient is a fraction of width while
the text ends at a fixed position, so the text's right end sits on rising opacity as the
screen widens (0.59 → 0.86 → 0.92). Whether the visible band is busy is a property of the
cover, with two shipped correction paths. **No tablet-specific backdrop adaptation. Do not
re-raise.**

**H13 — No Series surface calls the app's size-normalisation helper**, and both test
tablets are ≥ sw600dp (one of them at sw635dp/272dpi, *not* the 540dp its emulator config
implies).

---

### I · Cross-cutting: theme and colour

*Source: [17](issues/17-light-theme-pass.md)*

**I1 — The rule that governs this whole family:** *anything drawn on a surface the
component itself darkens must take its colour from that surface, not from the theme.*
The one place it was consciously applied — the play glyph — is the one place nothing broke.

**I2 — Every visual acceptance on this effort before 2026-08-05 was made from
DARK-THEME screenshots.** Treat any re-touched surface as needing a light-theme look, not
just a re-read of the ruling that accepted it.

**I3 — Passes, verified, do not re-check:** the play glyph (legible on bright and dark
covers alike) · the detail hero, whose gradient is built *from* the theme background so its
text is legitimately themed, **including the bottom fade** · the editor and the create
surface, which cannot exhibit this defect family at all because **they paint no surface** —
the same structural reason H7 exempts them from the geometry rules · the back/return
behaviour in both themes.

**I4 — `PILLAR` (the fixed near-black behind pillarboxed cover art) stays as it is. DO NOT
RE-RAISE.** It measures 1.15:1 on a dark row and **17.08:1 on a light one**, and a later
session *will* re-measure that and report it as a defect. It is not one:

- **Some covers ship their letterbox INSIDE the JPEG.** One real cover in the corpus is a
  square image matted onto its own dark navy, measuring 14.26:1 against the light row —
  **1.20:1 from the app's own pillar, i.e. visually the same object** — on a series where
  the app-drawn pillar never ran. And other covers carry baked-in mattes in different
  colours again.
- **So the value is not DERIVABLE.** "Match the row's ground" dies because cover edges are
  arbitrary. "Match the baked-in mattes, so keep near-black" also dies, because those
  mattes are not consistent: the balance point would have sat 3.57:1 from that cover's own
  matte, making app-drawn and publisher-drawn letterboxes visibly disagree on one screen.
- The original reasoning was never *wrong* so much as **inapplicable** — it derived a
  constant from a consistency that does not exist. Any constant is as defensible as any
  other; pick on taste, not analysis.
- **What the measurement is still good for:** it explains exactly why pillarboxing went
  unremarked through all fourteen browse variants — they were dark-theme variants, where
  the pillar is *invisible*, not merely tolerated. Which is I2.

**I5 — The backdrop's contrast cost is UNCONDITIONAL in light theme, and this is a
different axis from H12** (which stays closed). The themes are asymmetric because the muted
text token is:

| | flat-background contrast, before anything is painted |
| --- | --- |
| dark muted text on dark background | **12.62:1** — 2.8× AA headroom |
| light muted text on light background | **4.19:1** (was; see I6) |

Measured with the backdrop ON: dark theme fails only on a **bright cover** (1.77:1 on one,
8.6–11.9:1 on three) — a *cover-dependent* fault. Light theme measured 2.01–2.26:1 on
**all four rows**, bright covers and dark alike — a *constant* fault. **The backdrop
toggle rescues it** (back to the palette's own ceiling); **the artwork override does not**,
because no image restores contrast the palette never had.

**I6 — Already fixed and committed to `main`:** the light-theme muted text token was
darkened because it was **below WCAG AA before anything was painted**. It was a shipping
palette defect, not a Series one.

**I7 — All four shared accent tokens fail on the light background, structurally.** They
live in a shared token bag that is spread *over* the per-scheme tokens, so they are
**unthemeable by construction**, and all four were picked against the dark background.

| token | on light bg | on dark bg | where it lands in Series |
| --- | --- | --- | --- |
| success | **1.54:1** | 9.59:1 | **`Series complete`** — 08's third next-up state |
| danger | **2.59:1** | 5.70:1 | **`Delete Series`** in the editor |
| primary | **1.53:1** | 9.69:1 | `Next`, `+ Add books`, tab pill |
| warning | 1.30:1 | 11.42:1 | not currently used by Series |

Largely a **shipping-palette** property rather than something this effort introduced — but
`Series complete` is 08's own element, so **it is in scope and needs a named fix.**
(`primary` is currently *masked* on the test device by auto-accent resolving it to a dark
blue; at the shipping default it is 1.53:1.)

**I8 — Two named surfaces were never built and so were never tested:** the
`Series Detection` card and the `Removed Series` list. They inherit correctness
*structurally* — a settings screen paints no surface of its own and the shared row
component is used in both themes — but **that is an argument, not a test.** They need a
light-theme look when built.

**I9 — The route background hazard is live. See K5.**

---

### J · Routing and presentation, consolidated

| Surface | Presentation | Parent |
| --- | --- | --- |
| Series browse | the library screen's Series view | — |
| **Series detail** | **`formSheet`**, overflow-top-inset, grab handle only | **root sibling** |
| **Series create/edit** | **root `transparentModal`**, one route for both | **root sibling** |
| Book details (from a series row's text) | existing `formSheet`, presented over the series sheet | root |
| Cover-art search | existing `transparentModal` | root |

**J1 — Three route-level requirements, all measured:**
1. **The opaque push is the only presentation that misbehaves over a live sheet.** It
   presents fine and returns with scroll offset pixel-exact, but popping the group reveals
   the **library for ~165ms** and the sheet then **re-presents** with a full slide-up — a
   double transition showing a screen the user did not ask for. Both shipped alternatives
   are clean.
2. **Sheet-over-sheet is clean in both directions** — measured twice, from each end. That
   is what licenses C4's split rows.
3. Presenting the book details sheet from a series row **requires setting the app's
   existing navigation intent flag**, or that screen dismisses itself on mount.

**J2 — The series group owns no store lifetime.** Its layout is a bare stack and every
draft reset lives on a screen, so moving the editor to a root route **orphans nothing** and
simplifies the exit to a plain back-navigation — correct by construction rather than by
coincidence.

**J3 — Two dead call sites** disappear with these changes: the browse row's pencil route,
and the separate create-flow entry.

---

### K · Traps — the expensive rediscoveries

*Every one of these was paid for once. They are here so it is not paid for twice.*

**K1 — Settings in this app ARE schema, and every boolean getter hard-codes default-OFF.**
Each preference is a column on a **single-row** `settings` table; the Zustand store is only
a cache in front of the DB queries. Every existing boolean getter reads `=== true` with a
`false` fallback, which hard-codes default-OFF into **both** the null case and the
no-record case. `Series Backgrounds` is the table's **first default-ON boolean**, so
copy-pasting that idiom ships every existing tester the opposite of the chosen default,
silently. **It must read `!== false`, with `true` as the fallback.**

**Per G1a there are now TWO default-ON booleans** — `series_backgrounds_enabled` and
`series_detection_enabled` — so the inverted getter is needed at **two** sites. Getting
either wrong is silent: the user sees a switch rendered OFF that they never turned off,
and in detection's case an empty Series tab that reads as a broken feature.

A migration backfill was considered — with a migration now available to ride — and **dies
on a fact**: the settings-record seeder only seeds three fields, so **every optional
setting is `null` on a FRESH install too.** The null is not a migration artifact, it is the
app's universal state for optional settings. A backfill fixes only existing installs;
fixing fresh ones needs the default at two more creation sites, one of which guards a
"required non-nullable defaults" invariant an optional column would break. **The inverted
getter handles both paths in one expression at one site.**

**K2 — The compact settings row needs `description` AND `onInfoPress`** — its control slot
is taken by the switch. This is why the timer settings screen contains two different
info-icon shapes. **Both props are already built and shipped** (optional, so every existing
call site is untouched), and the timer screen's `How it works` row is already retired as
their first call site. Do not rebuild them.

**K3 — `decimal-pad` renders the LOCALE's decimal separator.** A comma-decimal user types
`14,1` and a naive float parse returns **`14`** — silently, no error. **Normalise the
separator before parsing**, or the fractional part vanishes on exactly the users whose
keyboard offered it.

**K4 — A failed migration is SILENT**, and the raw-SQL escape hatch's assertion is
dev-only. There is no runtime signal that an upgrade half-ran.

**K5 — Routes copying the book-details screen's options inherit NO background colour.** The
route layout currently holds **three different answers**: the player themes it correctly,
the book editor **hardcodes a dark literal**, and book details / chapter list / series
detail set none at all. Consequences:

1. **The series detail sheet needs a themed background**, or any state where the route
   renders nothing is a **full-screen white sheet** on a dark-theme app. This is not
   hypothetical — it was reproduced (see K7).
2. **The series editor becomes a `transparentModal` "matching the book editor" — do NOT
   copy its hardcoded literal.** Use a themed value. This is a **live trap**: it does not
   bite today only because the editor is still an opaque push.
3. Any new route copying those options inherits the same nothing. Set one.

**K6 — Artwork replacement unlinks the old file BEFORE the DB write.** So a deferred
transaction is incoherent — the old cover is already gone — and **the confirmation must
come BEFORE applying**, not as a notice afterwards.

**K7 — Deleting a series currently pops onto the sheet of the series it just deleted.**
Reproduced, and it is worse than predicted: the route resolves nothing, renders nothing,
and — per K5 — shows **full-screen white**, with no grab handle, so the only escape is
system back. **It needs BOTH fixes: pop *past* the sheet, and give the route a themed
background.**

**K8 — Series artwork is a second producer of orphaned artwork files.** A pinned cover is a
new file only the series references, so **deleting the series leaks it forever**, and so
does **reverting to derived art** unless the revert deletes the file. Derived art is free
by comparison — it points at a file the book already owns. The ref-counted sweep sketched
in the existing orphaned-artwork note needs to know series exist.

**K9 — NAMING TRAP: the `light*` colour tokens mean "light-COLOURED", NOT "for the light
theme".** They live in the **shared** token bag, which the theme hook spreads **over** the
per-scheme tokens, so they are **theme-invariant by construction** — which is exactly what
a component-painted surface needs (and why F6 is correct). The book title already uses one
for this reason. An engineer reaching for "the light theme token" will pick these and be
right by accident, or avoid them and be wrong.

**K10 — `addColumns` SILENTLY DROPS `defaultValue`.** Its signature destructures only
table/columns/raw-SQL. **There is no way to make it backfill a chosen value.** What actually
fills existing rows is the library's null-value function: optional → `null`; non-optional
string → `''`, number → `0`, boolean → `false`.

> **So a non-optional enum column backfills to `''` — a value the TypeScript union claims
> cannot exist. A non-optional enum is a lie the type system cannot see.** This is the
> finding that forced G5.

**Correction owed to the repo:** two v3 `addColumns` sites carry the comment
*"WatermelonDB expects defaultValue here for non-optional columns"*. **It does not.** Those
columns were filled by the null-value function, which *coincidentally* agreed with the
written default — which is why this has gone unnoticed since v3. **Correct the comment when
v33 is written**, so nobody trusts `defaultValue` to do anything.

**K11 — A book cell can only render a book that is in the library store.** An unresolvable
id renders a size-accurate **blank** cell. Anything that renders books must resolve them
from the store, or render from the book objects the assembled series already carries.

**K12 — The book progress value is a tri-state enum (0/1/2), not a fraction.** Averaging it
renders "1 of 7 finished" as 50%. **Completion is a count.**

**K13 — A fanned cover stack needs its offset to outpace its shrink.** Equal rates
right-align every layer, the front one occludes the rest, and a 22-book series draws as one
lone cover.

**K14 — Measure overflow; do not infer it.** Applies to the name's tap-to-expand *and* to
H9's meta-line drop.

**K15 — The disabled-button label is invisible**, on both the editor's `Save` and the
create surface's `Next`. Confirmed on two screens; still live.

**K16 — DECIDED (05, 2026-08-06): all-excluded is a stable state. Reconcile neither deletes
it nor suppresses it.** A series whose every membership row is `'excluded'` still has rows,
so the empty-series reaper keeps it, and it renders with no books. That was flagged as
"arguably a delete, should probably suppress"; the build ruled the other way, and
`reconcileSeries` emits an **empty plan** for such a series.

- **Emptying a series one book at a time is not a delete the user made.** A14's standing
  rule is *bulk creates, per-item destroys*; inferring a whole-series destroy from a run of
  per-item ones would be the one place the app inverts it. The escape hatch is already one
  tap away — `Delete Series` in the editor (D8) — and it confirms in a dialog first, then
  suppresses correctly per A12.
- **An empty series is visible and self-correcting. A series that vanished on its own is
  neither.** Abstention bias, applied to the one verb that cannot be undone.
- **Emptying is a legitimate step in REBUILDING a series by hand**, which is the only
  expressible repair for a wrong merge now that split/merge are out of scope (09).
- **The delete-on-empty decision stays where it already lives**: `updateSeries` deletes a
  series when its last book goes (`seriesQueries.ts:81`), and D9.1 already requires that
  path to suppress instead. That is an explicit user save. Reconcile must not duplicate it
  by inference.
- ⚠ **`deleteEmptySeries()` must keep counting excluded rows.** It counts every
  `series_books` row, so an all-excluded series survives — this is correct and must not be
  "fixed" to ignore tombstones. Doing so deletes the series, deletes its tombstones with
  it, and the very next detection run re-creates the series with every removed book back
  inside: the A11 failure, amplified.

---

## Testing Decisions

### What makes a good test here

**Test the decision, not the wiring.** Every rule in §A and §G is a *pure function of
inputs* — signals in, proposals out; proposals plus existing state in, a write plan out.
Assert the returned value. Do not assert that a particular query ran, that a helper was
called, or that an intermediate structure has a shape.

This is not a stylistic preference in this repo, it is a **hard constraint**: `jest.config.js`
has **no React Native preset**, and `@testing-library/react-native` is not installed.
Anything that imports React Native, the native SQLite adapter, or a screen **cannot be
tested at all** today. The existing membership-diff helper documents the idiom in its own
docstring — it was *extracted from the query module specifically so it could be unit-tested
without the native adapter*. **Every seam below follows that extraction pattern: the
decision is pure and tested; the write is IO and untested.**

### The seams (agreed with the driver, 2026-08-06)

**Two new pure seams, and no others.** The DB write stays behind them, untested.

```
detectSeries(units, { alsoGroupByFolder })
  -> ProposedSeries[]        // waterfall, self-validation,
                             // collision split, no-1-book

reconcileSeries(proposals, existingRows, suppressedNames)
  -> { createSeries, insertRows, removeRows, skipped }
                             // origin / name_source / membership honoured,
                             // null coalesced to 'user'

seriesQueries.applyPlan(plan)          // IO only, untested
```

Two rather than one, deliberately: a **grouping-purity** regression and a
**provenance-safety** regression are different failures with different owners, and folding
them into one assertion makes the second invisible behind the first.

**Seam 1 — `detectSeries` covers, in one place:** the precedence waterfall (A1), folder
self-validation (A2), the number-collision edition split (A4), the no-one-book rule (A5),
both fidelity levels (A3), name disambiguation (A15), and the fact that abstention is the
default outcome (A7).

**Seam 2 — `reconcileSeries` covers:** the five-line reconcile contract (A10), membership
tombstones (A11), suppression (A12, A13), per-aspect ownership (an edit does not promote
existence), and — critically — **the null coalesce (G5)**, which is live code from day one
because append-only means emulators are not wiped.

### The corpus becomes a checked-in fixture

**Both research files ship into the test tree** (~208KB): the 298-unit corpus and the
hand-authored ground truth labelling 236 books across 38 multi-book series. This turns 02's
measured numbers from a claim in a ticket into **assertions that fail when the cascade
regresses**:

```
expect(purity(result)).toBeGreaterThanOrEqual(0.983)
expect(standalonesSwept(result)).toBe(0)
expect(names(result)).toContain('Discworld (2022)')
```

Plus the named forcing cases, each as its own readable assertion: the 80-book split into
41 + 39 · the author folder **rejected** because its members' albums name a different
series · the near-threshold series where the collision check correctly **declines** · the
split-book guard suppressing a phantom two-book series · a science-of spin-off forming its
own group rather than being absorbed.

**Two caveats to encode in the fixture's own comments, so nobody misreads it later:**

1. **The ground truth is AUTHORED, not derived** — from human knowledge of these books plus
   every available signal. It is therefore **not** valid to cite folder-rule accuracy
   against it as proof that folders are trustworthy *in general*, only that they agree with
   truth *here*. Units where reasonable curators differ carry an `ambiguous` flag.
2. **Coverage figures are LOWER BOUNDS.** The device probe took at most two files per
   directory, so ~35 single-file books in flat multi-book folders are missing. **Accuracy
   figures (purity, naming, numbering) are unaffected** — they are measured on what was
   probed. Assert accuracy; do not assert coverage.

### Existing seams to extend, not replace

| Existing test | What this effort adds |
| --- | --- |
| series schema shape | the seven new columns and the new table; **keep it version-agnostic** — it was burned once by pinning a literal version |
| schema/migration coherence | v33's coherence with the schema version, generically |
| membership diff | unchanged — it serves the **editor's save path**, which this effort does not alter |
| series validation | duplicate-name validation is **untouched** by the edition ruling (A15); assert that it still holds |
| series assembly | assembly with `membership = 'excluded'` rows present, which must not render |
| series progress | unchanged; the completion count is already a count, not an average (K12) |
| settings store | the default-ON boolean reading `!== false` on both the null and no-record paths (K1) — **the highest-value single test in this list**, because getting it wrong is silent |

### Presentation helpers

**Pure string and geometry helpers get jest; everything visual is device-verified.** In
scope for jest:

- the canonical-range collapse **including the three-run cap** (H10) — it was previously
  unbounded;
- the meta-line sacrifice order, `M finished` before the range (H9), driven by an
  overflow flag rather than the prototype's font-scale proxy (K14);
- the three next-up states (B1);
- the one-series pick for the book subheading — largest detected, else first user-created
  (F2), which is exactly the asymmetry a test should pin;
- the cluster-size rule as a function of width (H4), whose *whole* claim is that it is a
  no-op at 411dp;
- canonical-number parsing including the **locale separator** (K3).

### On `@testing-library/react-native` — costed, deferred, with a trigger

**Recommendation: not for this effort.** It has no layout engine and no pixels, so it
cannot assert any of what this map actually decided visually — contrast ratios, dp
geometry, the glyph fill, sheet transitions. Installing it means adopting an RN jest preset
plus transform and mock configuration for the animation runtime, the list library, the
image library, the sortable library, the player and the native DB adapter — a
shared-infrastructure change that risks the currently-green suite, on a branch that is not
merged.

**What it WOULD genuinely buy, if the build effort wants it:** the three interaction
behaviours that are otherwise device-only and are exactly the kind that regress silently —
**C4's split row targets** (cover plays vs text opens), **E4/E5's `X`-vs-back split**, and
**K7's delete-exit routing**. If any of those regresses in practice, install it as its own
**up-front infrastructure ticket** for the implementation effort. Not mid-feature.

### What jest will never cover, and how it is accepted instead

Every visual and interaction ruling on this spec is **device-verified**, and that is the
acceptance mechanism, not a gap. The matrix that produced this spec, and that the build
should reproduce:

- **Devices:** `Pixel_7_Pro` (411dp) · `Pixel_Tablet` (800dp) · `7_Tablet` (sw635dp @
  272dpi — **not** the 540dp its emulator config implies).
- **Stresses:** font scale 2.0 · both themes · `Series Backgrounds` ON and OFF · the
  15-series stress dataset covering a 22-book series, a 95-character name, all-unplayed /
  mixed / all-finished, three series sharing books, gap numbering, a decimal number, and
  numbering that starts at 4.
- **Contrast** is measured from device screenshots, not eyeballed — the measuring script
  used for §I is in the assets folder.
- **⚠ Per I2, re-look at every surface in LIGHT theme.** Every visual acceptance on this
  effort before 2026-08-05 came from dark-theme screenshots.

### The bars this repo holds

`tsc` **0 errors** · eslint **0 errors** (~40 warnings are the pre-existing baseline) ·
jest **green** (484 at the time of writing). Prototype code holds the tsc/eslint line but
is exempt from jest, tablet and font-scale passes. **Never run a formatter over this repo —
there is no config file.**

---

## Out of Scope

### Ruled out, with the reasoning preserved

- **Cross-series split and merge.** *"Deleting and rebuilding is good enough for now, and
  if at a later date feedback leads me to needing to add this, we can revisit."* They are
  the only two corrections a single-series editor structurally cannot express. **See the
  live consequence below.**
- **Auto-generating series from an online database** (Audible/Goodreads lookup). Local
  signals only. *(The online **cover art** lookup for a series is artwork, not series
  identity, and does not reopen this.)*
- **A series description.** Dropped, not deferred. It was the only item that added a
  feature rather than deciding a presentation, and it dragged a column, a provenance
  companion and an editor field behind it.
- **Editions as a first-class concept.** No column, no grouping level. Two editions are two
  series with two names (A15).
- **A persisted confidence tier** and any UI that explains a grouping (A16).
- **A post-scan review/confirm queue.** Replaced by the settings toggle on the strength of
  98.3% purity.
- **Any bulk destroy**, including "delete all detected series" (A14).
- **Per-library settings.** Not expressible — the settings table is a single row and the
  app has one library made of several folders.
- **A folder-structure recommendation anywhere in the app** — and note **the app has no
  onboarding and has never opened an outbound link**, so two of the obvious sites are
  net-new features rather than sites. *(The help screen is live and populated and would
  have fit; it was offered and declined along with the recommendation. Do not re-derive
  that it exists.)*
- **Multi-column browse** — closed by arithmetic (H8).
- **Book-first remove** (F9). **A `New series…` row in `Add to series…`** (F8).
- **Sidecar-driven general book metadata** (`.nfo`/`.opf` → Author, Narrator, Title). That
  is library *scanning*, not series identity. *(Reading sidecars as **series** signals was
  in scope and was measured and dropped — A6.)*
- **Animation.** Deliberately still unphrased: the sheet transitions measured clean, the
  chosen row has no expansion to animate, and no ticket has asked for motion. It fails the
  graduation test because the question cannot be stated, not because it cannot be answered.
- **The clipped-row bug as a standalone hunt.** Six hypotheses refuted. 08 **dissolved it
  structurally** — the winning design has no inline expansion, no masonry list and no book
  cells, so the construct the bug lived in no longer exists on this screen. That was
  treated as a **dividend, not an argument**. ⚠ **It is not a root-cause fix**: if that
  construct is ever reintroduced anywhere, the bug is unexplained and comes back with it.
- **Merging to `main`**, and **the implementation itself**. This map ends at an approved
  spec.

### Two commitments that are NOT simple exclusions

**1 — Restart-from-zero in the library grid is a CARRIED FIX the driver wants.**
✅ **PAID 2026-08-10 by implementation ticket 11** — the play helper now has its `Finished`
case, exactly as the last paragraph of this entry asked, so the grid, the list row, book
details and Android Auto all inherit it. See C5's amendment for the flag-flip half. The rest
of this entry is kept as the reasoning that got it there.

The play helper has **no `Finished` case**, so a finished book resumes at its last few
seconds *everywhere else in the app*. C5 fixed it on the series sheet only.

This was previously recorded as *"a known, accepted inconsistency… not an oversight"* and
that is **reversed**. The history matters: the fix was first justified by that screen
having no escape hatch; 13 then restored the escape hatch and **the driver kept the fix
anyway**, because landing thirty seconds from the end of a finished book is a poor outcome
whether or not you can seek out of it. **So the argument is no longer "this screen is
special"; it is "this is the better behaviour", which applies everywhere.**

It is out of scope *here* on scope grounds only — the library grid is a book screen and
this map ends at a Series spec. **The follow-on effort should fix it, ideally by giving the
play helper the `Finished` case rather than duplicating the caller-side rewind the
prototype uses.** Until then the inconsistency is live and **known to be wrong**, not
sanctioned.

**2 — Delete-and-rebuild is the sanctioned repair of last resort.** Because split and merge
do not ship, deleting a series and rebuilding it by hand is the *only* expressible repair
for a wrong merge. **That puts three things on a load-bearing route:** deletion (D8),
the suppression/restore path (A12), and the create/edit surface (§E). None of them may be
treated as a nice-to-have, and **K7 — the broken delete exit — is therefore a blocker, not
a polish item.**

### Found on the way, real, and not this spec's

All driver-confirmed, all visible without any of this effort's work, all recorded so the
follow-on effort does not rediscover them:

- **The book editor route hardcodes a dark background literal**, so it keeps a dark scrim
  in light theme while the player themes the same property correctly. **Out of scope but
  NOT inert** — see K5.2, which is the live half.
- **At font scale 2.0 the library search field clips its placeholder** (the top of the
  string is cut by the tab strip above it), **and the book info card clips its labels**
  (`Releas`, `Chapte`). Same cause: a fixed-height container holding text that scales.
- **The FAQ settings screen is orphaned** — it renders a "coming soon" stub and has no
  route to it anywhere; the real help content lives elsewhere. Dead settings code.

---

## Further Notes

### The prototypes, and what each one bought

Everything in `src/prototypes/` is **throwaway**. It was built to be judged on a device and
deleted — it holds the repo's tsc/eslint line and nothing else (no jest, no tablet pass, no
font-scale pass). The evidence that justifies each decision above:

| Ticket | Prototype | Evidence |
| --- | --- | --- |
| 04 | the harness: two orthogonal knobs (Variant × Data), `Stress ×15` / `Calm ×3` / `Real DB` | — |
| 05 | wizard presentation, push vs 0.95-detent sheet | `assets/05-wizard-presentation/` (`compare-push-vs-sheet.png`, `anim_push.mp4`, `anim_bottom.mp4`) |
| 08 | **fourteen** browse variants across two passes; winner `Blend sep ctr` + `Blend quiet ctr` | judged live on device; the winning row survives in `assets/13-detail-sheet/17-FINAL-browse-glyph-no-front-scrim.png` and `assets/17-light-theme/01-…-ON-light.png` |
| 10 | the editor grown by artwork + number field + `Sort by number` | `assets/10-correction-surface/` — `02-number-edited-no-resort.png`, `03-after-sort-by-number.png` (the silent cover swap, D10) |
| 13 | the detail sheet **on a real route** | `assets/13-detail-sheet/` — `11-`/`12-` (the push's library flash), `13-`/`15-` (clean returns), `03-`/`04-` (the two rejected scrims), `10-delete-leaves-WHITE-sheet.png` (K7), `16-FINAL-rows-split-fill-in-glyph.png` |
| 14 | four placements of the series line on the **real** book-details route | `assets/14-titledetails/` — `01-control-off.png` (no vertical slack), `04-card-11series.png` (why the free option fails), `09-subheading-picks-discworld-of-11.png` (F2), `10-subheading-FINAL-tight-gap-static.png`, `11-overflow-icons-resolved.png` (F10) |
| 15 | seven create-flow shapes across three sessions | `assets/15-wizard-flow-shape/` + `hybrid-E/` + `hybrid-G/` — `compare-E-vs-F.png`, `compare-selection-jump.png`, `compare-E-vs-G-second-pass.png` |
| 16 | the geometry rules, built into the harness | measured on all three widths |
| 17 | the light-theme pass | `assets/17-light-theme/` — `03-PILLAR-black-slabs-light.png` and `09-baked-in-matte-vs-drawn-pillar.png` (I4), `07-DEFECT-`/`08-FIXED-` (F6), plus `measure.py` |

**One measurement worth carrying into the build:** the create surface's staged selection was
chosen partly on **547,334 changed pixels per tap** in the rejected shape versus **28,488**
in the chosen one, with **zero** above the panel. The "screen jumps on every selection"
problem is structural, not cosmetic — the picker and the ordered list share one scroll
container, so anything committed above the panel *must* move it.

### Deleting the harness

`src/prototypes/README.md` holds the authoritative recipe; it is longer than ticket 19's
"three commented lines", which was written before tickets 13, 14 and 15 added routes of
their own. In outline:

```
rm -rf src/prototypes src/app/seriesDetail.tsx src/app/seriesCreateProto.tsx
```

then remove the throwaway mounts and imports from the book-details screen, both throwaway
`<Stack.Screen>` entries from the root layout, and the harness pill from the library
screen — and restore the library screen's three `THROWAWAY` sites to the real series hook
and the real series home component. **The shipping series home component was never modified,
so there is nothing to revert there.**

> **⚠ DO NOT revert the `TableOfContents` icon on `Remove Auto-Chapters`.** It looks like
> harness fallout and is not — it is F10, a driver ruling, and it **ships**.

Note also that two pieces of **real** code were already built and shipped ahead of this
spec, deliberately, because neither is a Series change: the shared settings row's
`description` + `onInfoPress` props (K2), and the timer screen's retirement of its
`How it works` row as their first call site.

### Volumes, so nothing is over-built

- Real library: **350+ titles**, including one series at 41 books × 2 editions = 82.
- Detection emits **~28 candidate series** per run at Full, **19** at Conservative.
- The suppression table is bounded by *series the user deliberately deleted*: realistically
  **0–20 rows**.
- The whole rescue path — books no signal reaches — is **≈7 books in a 350-title library,
  once**. Playlists are unbounded. **That ratio is why §E is shaped the way it is.**

### Residue this spec does not close

Carried from the map's fog, deliberately not graduated:

- **Re-verifying the existing series logic** against the redesign's assumptions. Nobody can
  yet say *which* assumptions are load-bearing enough to be worth checking, and the honest
  reading is that it belongs to the **implementation** effort — it verifies code, not a
  decision.
- **A corpus re-pull without the per-directory cap**, which would firm up the coverage
  lower bounds and let the cascade be scored on ~35 currently-unprobed books (all
  single-file books whose probed siblings already detect confidently). **Not a blocker for
  any decision** — accuracy figures are unaffected.

### Where this lives

`.scratch/series-ux-redesign/` exists **only on `feature/series-styling`**, and nothing is
pushed — there is no `gh` CLI on this machine and no remote issue tracker. If this branch
is ever discarded, this spec and all twenty tickets go with it.
