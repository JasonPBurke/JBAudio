# The Books shelf gets a grid/list layout toggle

Status: ready-for-agent

Scoped by grilling on 2026-09-03, driver-approved decision by decision. Eleven decisions,
all answered. Where this file disagrees with anything said during the grilling, **this
file wins**.

⚠ **The obvious implementation is the rejected one.** `LadderView` is already a
four-member union ending in `booksList`, and both `ladderViewFor` and its test carry
comments anticipating a **fourth ordinal** on the header's view cycle. That is model (A),
and it was considered and rejected. See `## Implementation decisions`, D1, and
`docs/adr/0006`.

## Problem statement

The library header carries a single cycling control. It has three stops: the sectioned
home, the Series shelf, and a flat shelf of every Book drawn as a masonry grid of cover
cards. The grid is cover-forward — a large cover with title and author beneath — and it is
the **only** way that third shelf can be drawn.

A second presentation already exists, is complete, and is mounted by nothing: a compact row
per Book with a small cover on the left, title, Author, a duration bar, and a play control
on the right. It satisfies the whole back-to-top ladder list contract and orders itself by
title or by recency exactly as the grid does. It has simply never had an entry point.

The only related control a user has today is **Number of Columns** (one, two or three) in
Settings → General. That changes how *big* the cover cards are; it cannot change what a
Book row *is*. A reader with several hundred Books who wants to scan titles rather than
covers has no way to ask for that, and a reader who wants covers has no way to say so
either — they get whichever one the app picked.

The two presentations genuinely differ in what they are good at:

- The grid is good for recognising a Book you own by its cover.
- The list is good for finding a Book by its title, and shows Author and progress on
  every row without a tap.

Which one is better is a property of the reader, not of the library.

## Solution

On the Books shelf — and only there — a control appears at the right-hand end of the search
bar. It switches that shelf between the cover grid and the compact list. Nothing else on the
screen changes: the same search, the same progress tabs, the same ordering, the same Books.

The choice is remembered. A reader who prefers the list gets the list the next time they
open the app, and every time after, until they change it back.

The control lives with the search bar rather than in the header, so it travels with the
search bar: scrolling down takes both away, scrolling back up brings both back. The Series
shelf already does exactly this with its create-series button, so a shelf-exclusive control
that hides with the search bar is the established behaviour of this screen, not a new one.

The other two shelves are untouched. The sectioned home keeps its sections and its
horizontal rows; the Series shelf keeps its own layout and its own button.

## User stories

1. As a reader with a large library, I want to switch the Books shelf to a compact list,
   so that I can see more titles per screen than the cover grid shows me.
2. As a reader who recognises Books by their covers, I want the shelf to stay a cover grid,
   so that nothing I already rely on changes.
3. As a reader who prefers the list, I want my choice remembered across app launches, so
   that I do not have to set it again every time I open the app.
4. As a reader who prefers the grid, I want to have made no choice at all, so that the app
   behaves exactly as it did before this feature existed.
5. As a reader, I want the layout control to sit next to the search bar on the Books shelf,
   so that I find it where I am already looking when I am hunting for a Book.
6. As a reader, I want the layout control to appear only on the Books shelf, so that I am
   not offered a choice that does nothing on the sectioned home or the Series shelf.
7. As a reader scrolling down a long shelf, I want the layout control to get out of the way
   with the search bar, so that the maximum amount of the screen shows Books.
8. As a reader who has scrolled down, I want scrolling back up to bring the layout control
   back with the search bar, so that I can reach it without jumping to the top.
9. As a reader, I want the control to tell me which layout I am currently in, so that its
   meaning matches the header's view control rather than contradicting it.
10. As a reader using TalkBack, I want the control announced with its role, its current
    value, and what pressing it will do, so that the icon's meaning is not the only way to
    understand it.
11. As a reader, I want a tap target larger than the icon itself, so that the control is
    comfortable to hit at the edge of the screen.
12. As a reader who has typed a search, I want the results filtered identically in both
    layouts, so that switching layout never changes which Books I can see.
13. As a reader on the Started tab, I want most-recently-played ordering in both layouts,
    so that switching layout never reorders my shelf.
14. As a reader on the Finished tab, I want most-recently-finished ordering in both
    layouts, for the same reason.
15. As a reader on the All or Unplayed tabs, I want title ordering in both layouts, for the
    same reason.
16. As a reader whose search matches nothing, I want an empty message in the list layout
    just as I get one in the grid, so that an empty shelf never reads as a broken screen.
17. As a reader, I want the currently playing Book marked in the list layout as it is in the
    grid, so that I can find what I am listening to in either.
18. As a reader, I want to start a Book directly from a list row, so that the list is not a
    read-only version of the shelf.
19. As a reader, I want to open a Book's details from a list row, so that both layouts are
    equally complete entry points.
20. As a reader, I want the floating player never to cover the last row in either layout, so
    that the bottom of my library is always reachable.
21. As a reader who switches layout, I want the shelf to be usable immediately at the top,
    so that the switch never leaves me looking at a blank or half-drawn screen.
22. As a reader who switches layout, I want the search bar still on screen afterwards, so
    that the control I just pressed has not disappeared from under my finger.
23. As a reader who presses the system back button after switching layout, I want the
    two-step behaviour every non-sectioned shelf has — scroll to the top, then background
    the app — so that layout never changes what back does.
24. As a reader who has expanded sections on the sectioned home, I want switching the Books
    shelf's layout to leave those expansions alone, so that a change on one shelf never
    silently alters another.
25. As a reader who has set Number of Columns to three, I want that setting to keep applying
    to the grid, so that my column preference is not quietly discarded.
26. As a reader in the list layout, I want Number of Columns to have no visible effect
    there, so that the list is a consistent single-column presentation.
27. As a reader who changes the progress tab, I want the shelf to return to the top in both
    layouts, so that tab changes behave identically whichever layout I am in.
28. As a reader upgrading from an older version, I want my library to look exactly as it did
    before, so that an update never rearranges my shelf without my asking.
29. As a reader, I want the layout choice to survive the app being killed from recents, so
    that "remembered" means genuinely remembered and not just remembered for a session.

## Implementation decisions

### D1. Shelf and Layout are two axes, not four views

The library screen's toggle picks a **Shelf** — one of three: the sectioned home, Series,
Books. The Books shelf alone has a **Layout** — `grid` or `list`. Layout is a property of
that shelf, not of the screen; asking "what layout is the Series shelf in?" is not a
question.

The rejected alternative was a fourth stop on the header's cycle, which the existing
`LadderView` union and two existing code comments actively anticipate. It was rejected
because it makes the reader cycle through four stops to return to their shelf, and because
it models a presentation preference as if it were a different set of Books. **ADR 0006
records this**, because a future reader will otherwise read those two comments as an
unfinished intention rather than a rejected option.

### D2. The two axes meet in exactly one place

`ladderViewFor` becomes the sole point where the Shelf ordinal and the Layout are collapsed
into a single named `LadderView`. Its signature takes both. Its cascade names the sectioned
view explicitly and lets anything unrecognised degrade to a non-sectioned view — the
existing ⚠ on that helper is unchanged and still binding.

That single derived value feeds **both** consumers that need a view identity:

- the back-to-top ladder, which uses it to decide whether the section rung and the
  collapse sweep arm at all, and
- the scroll-direction hook's `surface`, which resets its scroll bookkeeping whenever the
  mounted list is replaced.

⚠ **The scroll-direction hook must receive the derived view, not the Shelf ordinal.** A
layout flip replaces the mounted list while the ordinal is unchanged, so an ordinal-keyed
`surface` performs no reset, and the hook's remembered scroll offset — belonging to the
outgoing list — makes the incoming list's first scroll event compute a delta against a
position it was never at.

The consequence is bounded here, and the bound is worth recording so nobody over-fixes it:
because the control lives inside the search bar, and the search bar is translated outside a
clipping parent when hidden, the control **cannot be pressed while the bar is hidden**. So
the bar can never be stranded off-screen by a layout flip. The observable defect without the
reset is one mis-read gesture frame, not unreachable UI.

### D3. Adding `booksList` as a live view is safe by construction

The ladder gates the section rung and the collapse sweep on set membership — "is this the
sectioned view?" — not on a change of view. `booksList` is not in that set, so both return
early and the section-ranges reference, which is deliberately never emptied, is never
consulted. No ladder logic changes.

### D4. The choice is persisted in the settings row, as a nullable string

A new settings column answering the question *which layout?* — values `grid` and `list`.
Schema goes to v36.

- The column is **optional**. Column additions cannot backfill, so every existing row lands
  the null value regardless of any default declared on the migration step. That step's
  default is therefore **inert and must be annotated as such**, matching the corrections
  already written against two earlier steps in that file rather than leaving a fourth
  misleading comment.
- A **resolver owns the default**. It returns `list` only on an exact `list` match and
  `grid` for null, empty string, and anything unrecognised. Nothing reads the column raw.
  This follows the existing sleep-timer mode column, which is documented as read through
  its resolver and never raw.
- A boolean column was rejected. The question is *which layout*, not *is it the list one* —
  and this repo's glossary opens its key cluster with the rule that a key is named after the
  question it answers, a rule it records having learned the hard way three times. A boolean
  also cannot grow a third layout without a further migration.

The settings store gains the field and its setter, seeded `grid`, following the store's
existing optimistic-set-then-persist shape.

⚠ The hydration flash that the series-backgrounds seed comment warns about **cannot occur
here**, and the reason should not be re-derived later: settings hydrate during launch and
the Shelf always starts at the sectioned home, so the Books shelf cannot be on screen before
hydration resolves. Whatever the store seeds is never rendered. Do not add a gate for it.

### D5. Number of Columns stays uncoupled

Number of Columns continues to drive the grid layout and the sectioned home's rows. It has
no effect in the list layout, which is inherently one column. The Settings control is
**not** changed, hidden, disabled, or cross-wired to the layout — coupling a Settings screen
control to a per-shelf state would be a worse tangle than a mildly over-broad description.

There is **no second entry point** for the layout choice. It is not added to Settings. Two
controls for one preference means a synchronisation surface and a discoverability lie.

### D6. The control rides inside the search bar overlay

The overlay becomes a row: the search field taking the remaining width, then the control at
the trailing edge. It is rendered only on the Books shelf.

The decisive property is that **the overlay's height does not change**. That height is a
published constant which every list re-reserves as a spacer and which the ladder resolves
offsets against; a control that changes it would touch the screen's load-bearing geometry.
Placing the control inside the existing row does not.

Because it rides the overlay's existing transform, it hides and returns with the search bar
and needs no visibility handling of its own. In particular it needs **none** of the
pointer-events guarding the Series create button requires — that button fades and so still
occupies and hit-tests its box when invisible, whereas the overlay translates genuinely out
of a clipping parent.

The control's tap target is enlarged with hit-slop rather than padding, matching the header's
controls, so that it does not push the search field inward.

Rejected: inside the search field next to the clear button (two unrelated actions competing
for one corner); in the header beside the view control (two adjacent icon controls with
different meanings, one of which appears and vanishes as the Shelf cycles); floating over
the list (inherits the create button's fade-and-hit-test problem for a far rarer action).

### D7. The search bar takes a generic slot, not the layout

The search bar component gains **one optional prop: a trailing node**. It renders it after
the field when present and learns nothing about layouts, shelves, or the library. The
control, its state and its handler are owned by the library screen, where the shelf
conditionals already live.

Rejected: passing the layout and its handler into the search bar (drags library vocabulary
into a component that has none, and into its one truly reusable seam); hoisting the
overlay's positioning and animation up into the screen (cleaner on paper, but relocates the
height constant that the whole screen's geometry is pinned to, for a feature that does not
require it).

### D8. One icon, showing the current layout

A single control whose icon names the layout you are **in**, not the one a press would give
you. This matches the header's view control, which shows the shelf you are on; the
alternative would put two icon controls a hundred points apart obeying opposite rules.

Styled to match the header's controls. The ambiguity a single-icon control inevitably
carries is paid off in accessibility rather than pixels: a button role, a label naming the
control, a value naming the current layout, and a hint naming what a press does.

A two-icon segmented control was considered and rejected on width and visual weight, not on
correctness — it is the clearest option for a sighted user, and remains the fallback if the
single icon tests badly on device.

### D9. The icon pair is chosen on device, behind a swappable constant

Two candidate pairs, held in a single constant so that swapping them is a one-line edit:

- a grid glyph and a list glyph — two unrelated shapes, each naming its layout directly;
- a pair of list-with-chevrons glyphs, chevrons pointing apart on the grid and together on
  the list, encoding the grid as the expanded state and the list as the condensed one.

Three findings were recorded against the chevron pair during scoping and must be re-checked
on device rather than forgotten:

1. Both chevron glyphs contain the **same list motif**, so while in the grid layout the
   control shows a list — which reads as "switch to list" and works against D8's
   current-state rule.
2. The density claim **reverses at three columns**. Measured from the real item geometry on
   a 411-point-wide screen with square covers, vertical cost per Book is roughly 493 points
   (grid, one column), 146 (grid, two), 75 (grid, three) against roughly 99 for a list row.
   At three columns the grid is *denser* than the list, so the "expand" glyph sits on the
   more compact layout — and Number of Columns is a setting the reader owns (D5).
3. The chevrons are a small modifier on a busy glyph and may need a larger size than the
   header's icons to read at all, which would make the control visually heavier than its
   neighbour.

**RESOLVED on device, 2026-09-03 (ticket 04): the chevron pair wins.** The `shapes` pair is
deleted — imports and all — and `ICON_PAIRS` has collapsed to a single `ICONS` constant, so
the swappable-constant scaffolding described above is history rather than shipped code. What
survives of the three findings:

- Findings 1 and 2 are **accepted, not answered**. The chevrons carry the current state and
  D8's announcement carries the same meaning in words, but a reader who reads the list motif
  before the chevrons can still take the grid's icon for "switch to list", and at three
  columns the "expanded" glyph does sit on the denser layout. Both are recorded in
  `BooksLayoutToggle`'s D9 docblock so a later reader does not take the file for a defect and
  "fix" it.
- Finding 3 **did not land**: the chevrons read at the header's 24 points, so `size={24}`
  stands and the control is no heavier than its neighbour.

D8's fallback — a two-icon segmented control, held in reserve if the single icon tested
badly — was not needed, and stays a fallback.

### D10. The icon shim must be regenerated, and the order matters

Icons are not imported from the icon package at runtime. The bundler aliases that package to
a generated shim re-exporting only the icons the app actually imports — currently 67 —
because the package's barrel would otherwise bundle roughly 1,600 icons, measured at 18.6%
of the production JS bundle. A committed test fails when the shim is stale, **in both
directions**: after adding an import and after removing one.

⚠ **That test does not protect the device loop**, because it runs when it is run. In a live
Metro session an icon absent from the shim is an undefined component and a render error
before any test executes. Regeneration is a prerequisite of Fast Refresh working, not a
cleanup afterwards.

Therefore D9's comparison follows a specific order:

1. Import **all four** candidate icons, define both pairs, regenerate the shim **once**.
2. Compare on device — flipping the constant is then a pure edit under Fast Refresh.
3. Delete the losing pair's imports and regenerate **again** before committing.

The transient four-icon shim never reaches a commit. Net production cost: two icons.

⚠ In practice step 1's four-icon shim **did** land in a commit (ticket 02's), because the
device comparison needed a build and the branch is where builds come from. The rule's real
teeth are that it must never reach `main`, and it does not: ticket 04's second regeneration
took the shim from 67 icons to 69 against `main`, which is the two-icon budget above.

All four candidates were verified to be plain value exports with literal module paths — none
is one of the renamed aliases whose filename does not follow from its exported name, which
the generator's own docblock warns about.

### D11. A layout flip is a view switch: the shelf mounts at the top

Flipping the layout unmounts one list and mounts the other at the top; the outgoing scroll
position is discarded and the scroll bookkeeping is reset. This falls out of D2 at no
additional cost and reuses a reset that is already device-proven for shelf switches.

Preserving the reading position across a flip — mapping the topmost visible Book into the
incoming layout and scrolling to it — is a **deliberate follow-up**, not part of this work.
It is real work against a list library where this repo has already been bitten by
index-versus-offset differences, and masonry-to-linear has no clean offset correspondence,
only an item one. It should be judged after the flip has been felt on device.

### D12. Consequences carried by this work

- The Shelf ordinal is **renamed** from its current toggle-flavoured name to `shelf`, in a
  **separate commit landed before the feature**, so that an ordinal named after a toggle is
  not sitting beside a new value named after a layout.
- The screen's single shared list reference is documented as being safe because exactly one
  list is mounted at a time. That docblock says *three* views; it must say four. Its warning
  that a layout mounting two lists at once invalidates the whole arrangement is unchanged
  and still binding.
- The list layout receives the same header spacer, search-filtered and tab-filtered Books,
  and recency mode the grid receives. It already reserves the same floating-player
  clearance.
- The list's first row sits a few points lower than the grid's, because the two components
  reserve their top padding differently. This is **not** to be fixed blind; it is a device
  observation to make and then decide about.

## Testing decisions

A good test here asserts what a reader can observe — which list is mounted, what the search
bar's state is, what a pure decision returns for a given input — and never how the screen
stores or threads that internally. Four seams, three of them already existing; the highest
one carries the behaviour.

### The library screen — existing, highest seam

The existing suite covering search and the search bar across a view switch is the right home
for this feature's behaviour. It renders the real screen with each list replaced by a stub
that records the props it received, and with the search bar replaced by a stub that records
its props — the suite's own comment explains that the search bar's props are the honest seam
because the real overlay's position is only readable on the UI thread.

Two changes are required to that suite before anything can be asserted:

- the search bar stub must **render its trailing node**, or the control is passed as a prop
  and never mounted, and nothing can press it;
- a stub is needed for the list layout alongside the grid one.

What to assert: that the control is absent on the sectioned home and the Series shelf and
present on the Books shelf; that pressing it swaps which list is mounted; that both lists
receive the same filtered Books, recency mode and header spacer; and that the search bar is
still visible after a flip.

⚠ **Write the reachable sequence, not the tempting one.** The obvious test — scroll down so
the bar hides, then flip the layout, then assert the bar returns — describes a sequence a
reader **cannot perform**, because the control is inside the hidden bar. The stub renders
regardless of visibility, so that test would pass while guarding a state that does not
exist. Assert the reachable path instead: scroll down, scroll back up, flip, and check the
bar is still visible and the other list is mounted. Say in the test why the tempting version
is fiction.

### The view mapping — existing seam, extended

The existing helper-lane test gains the second argument. Its second case must survive
unchanged in spirit: an unrecognised shelf ordinal never resolves to the sectioned view.
That test is deliberately written as a capability assertion rather than naming a specific
safe result, precisely so that it keeps working once a fourth view is mapped properly — do
not narrow it while extending it.

### The layout resolver — new seam, pure, fast lane

The only new seam, and the cheapest kind: a pure function tested in the fast lane with no
database and no React. Cases: null, empty string, an unrecognised string, exact `list`,
exact `grid`. The default belongs here, so this is where the default is pinned.

### The settings store — existing seam, mandatory update

That suite mocks the settings queries module with an **explicit object and no automatic
fallback**, and initialisation calls every getter inside a single combined promise. Adding a
getter without adding it to that mock calls an undefined value and takes every test in the
file down at once. This is part of the change, not optional tidying.

Worth one assertion in its own right, following the precedent already set for the
series-backgrounds default: the store reads `grid` before initialisation has resolved.

### Device pass

The final acceptance step, on the dev build. It settles D9's icon pair, checks D12's few
points of top-padding difference, confirms the control hides and returns with the search
bar, and confirms the choice survives the app being killed from recents.

## Out of scope

- **Preserving scroll position across a layout flip.** D11; a deliberate follow-up.
- **A layout choice for the other two shelves.** The sectioned home and the Series shelf are
  untouched, and Layout is defined as a property of the Books shelf only.
- **Any change to Number of Columns**, its Settings control, or its description.
- **A Settings entry point for the layout.** D5.
- **Persisting which Shelf the reader was last on.** The Shelf still resets to the sectioned
  home on every launch. That is a separate product question; this work does not answer it or
  create an expectation about it.
- **Any change to the list layout's own presentation** — its row, its divider, its play
  control, its ordering. It is revived as it stands.
- **A third layout.** The column is a string so that one is possible later, not because one
  is planned.
- **Any change to the ladder's decisions.** D3.

## Further notes

- This repo's issue and spec surface is local markdown under `.scratch/`. There is no remote
  tracker and the hosted-tracker CLIs are not available on this machine.
- Work order: this spec, then ADR 0006, then the rename commit, then the migration, store and
  resolver, then the search bar slot and the control, then the screen wiring, then the first
  shim regeneration, then tests, then the device pass, then the second shim regeneration.
- No parallel agent sessions are to run during this work, which is what makes schema v36
  safe to claim. This working directory is shared between sessions when they do run, and an
  amend has previously swallowed another session's commit — so no `git commit --amend` here
  under any circumstances.
- Both `main` and the working branch sat at schema v35 and at the same commit when this was
  scoped, so the rename commit lands cleanly.
