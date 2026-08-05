# 15 — Wizard flow shape: does the 3-step funnel survive as the fallback?

Type: prototype
Status: open — **UNDECIDED**, awaiting the driver's pick between variants E and F
Blocked by: (none)
Parent: [map.md](../map.md)

## Where this stands — 2026-08-04

**The shape will be a version of E or F. Which one, and what exactly it looks
like, is not yet known.** Nothing below is a decision; the claim is released so
this can be picked up cold.

- **A–D: rejected**, kept unchanged as the comparison record.
- **E and F: both live**, both device-driven, both holding tsc/eslint at zero.
  They share `editorShell.tsx` and differ **only** in the panel.
- **Settled inside both** (do not reopen when choosing): staged selection, the
  numbering rule, `Sort by number` pinned right, trash at the card's top-left,
  no book totals, no name prompt, Order in the list.
- **Ruled out as mitigations** by the driver, with reasons — see
  "Density is not the deciding factor".
- **Still unstated:** what the wizard is FOR. The driver's Favorites example is
  the first concrete evidence either way; it is recorded, not resolved.

## Question

The wizard was designed when manual creation was the **only** way to get a
series. The map's destination demotes it to a **fallback**, and three tickets
since have taken jobs away from it:

- [02](02-detection-cascade.md) put grouping at **98.3% purity**, so most series
  arrive without it.
- [09](09-auto-generate-series-setting.md) replaced the review queue with a
  settings toggle, so the wizard never became a confirmation surface.
- [10](10-correction-surface.md) made **the edit screen** the correction surface,
  so fixing a series does not route through the wizard either.

What is left for it is exactly two jobs, and it is worth asking whether
`Authors → Books → Order` is the right shape for **either**:

- **Hand-building a playlist.** The vocabulary entry says a series "doubles as a
  personal playlist"; a playlist is not author-scoped, and step 1 is
  *Authors*. Does an author filter help or obstruct here?
- **Rescuing the ~4% of books that are dark to every signal**, plus the
  delete-and-rebuild path that the map's Out of scope section made
  **the sanctioned repair of last resort** — which puts the wizard on a
  load-bearing route despite being a fallback.

Concretely:

1. **Do all three steps survive?** [07](07-sequence-numbering.md) already ruled
   the drag step survives "as pre-sorted rather than redundant" *when a canonical
   number seeded it* — but a hand-made playlist seeds **null** (07 verified this),
   so `Order` is doing full manual work in exactly the case this wizard now
   exists for. Meanwhile 10 put `Sort by number` in the editor. Is `Order` a
   step, or a thing you do afterwards in the editor?
2. **Is the funnel the right container at all** now that the editor
   (`series/edit/[id].tsx`) can do books + order + name + number in one screen?
   The honest alternative is *create-then-edit*: a name prompt, then land in the
   editor. That would delete three screens.
3. **Fix the three logged defects** from [05](05-wizard-presentation.md),
   whatever shape wins: the inactive `Next`/`Save` button renders with an
   **invisible label**, the wizard has **no app header**, and **every step has a
   large dead vertical region**.

## What is already settled and must not be reopened

- **Presentation is a full-screen opaque push.** 05 chose it deliberately — the
  driver wanted the "you have left the library" signal — and
  [13](13-detail-sheet-prototype.md) reaffirmed the reasoning while moving the
  *editor* to a `transparentModal` (a task flow with a Save/Cancel footer stays a
  push; only launching-over-a-live-sheet forced 13's change). The wizard is
  launched from the library, not from a sheet, so 13's finding does not touch it.
- **The clipped-row bug is out of scope**, including as an argument here.

## Constraints

- Files: `src/app/series/create/{authors,books,order}.tsx` (216 / 284 / 198
  lines), grouped under `src/app/series/_layout.tsx`, which
  [13](13-detail-sheet-prototype.md) established is a **bare `<Stack>`** — the
  group boundary owns no store lifetime, every `seriesDraftStore` reset lives on
  a screen. Deleting or merging steps therefore orphans nothing, but each screen's
  reset has to be accounted for.
- `books.tsx` is **shared with edit** (`isEdit` switches `Next`→`Done`), so a
  change to step 2 lands on the editor's `Add books` sub-flow too — the one leg
  13 left untested.
- Navigator `screenOptions` changes need a **full JS reload**, not fast refresh.
- Prototypes are disposable: no jest/tsc/eslint/tablet/font-scale bar.

## Definition of done

A flow shape chosen on device — three steps, fewer, or create-then-edit — with
the three 05 defects fixed in whatever survives, and an explicit statement of
what the wizard is *for* now that it is a fallback.

## Findings — 2026-08-04 device session (`emulator-5554`, Pixel_7_Pro)

Four variants built and driven end to end. Assets in
`assets/15-wizard-flow-shape/`. Code in `src/prototypes/wizard/`, mounted by the
throwaway route `src/app/seriesCreateProto.tsx`. Nothing writes to the database:
`createSeries` is never called, in any variant.

The driver chose the lineup (all four) and deferred *what the wizard is for* to
the device session, so every variant was built with **both readings held open** —
a search field for the playlist reading, author group headings for the rescue
reading.

### 1. Step 1 is a filter, not a stage — confirmed in the shipping source

`selectedAuthorNames` is read in exactly two places: its own validator
(`seriesValidation.ts:8`) and the `rows` builder (`books.tsx:50-71`).
`createSeries(name, orderedBookKeys)` (`seriesQueries.ts:43`) never receives it.
**Step 1 narrows a list and is then discarded.**

Variant B replaces it with a search field and the equivalence is visible on
device: typing `butcher` produces the same four books that selecting *Jim
Butcher* in step 1 produced (`07-B-search-reproduces-step1.png` vs
`03-A-step1-selected.png`) — on the same screen, with no step. The field also
does the thing the gate structurally cannot: match by **title**, and reach two
authors without declaring either (`08-B-crossauthor-no-gate.png`).

### 2. `Order` as a step is a whole screen for an already-correct list

07 ruled the drag step survives "as pre-sorted rather than redundant" *when a
canonical number seeded it* — but a hand-made playlist seeds **null**. On device
that means the Order step arrives in **selection order**, which is already the
order you wanted, because you picked them in order. `05-A-step3-order.png` is
three rows and 1,900px of nothing; `09-B-step2-arrange.png` is two rows and more
nothing.

**Prototype note:** these variants append on selection
(`wizardShared.ts` `toggleBook`), where the shipping wizard re-sorts into
author-grouped title order (`books.tsx:103`). For a playlist, appending is
strictly better — and it is what makes the Order step look empty-handed.

### 3. CORRECTION to 05: the "large dead vertical region" is not a layout bug

While building, this session claimed it was a one-word fix — `authors.tsx:108`
and `books.tsx:179` render a bare `<FlatList>` with no `flex: 1`, so the footer
was said to float wherever content ended. **Driven side by side on device, that
is wrong.** The shipping wizard's footer is pinned to the bottom exactly as the
fixed variant's is; adding `flex: 1` changed nothing visible
(`01-control-real-wizard-step1.png` vs `02-A-step1-authors.png`).

What the dead region actually is: **the wizard has too little on each screen.**
Step 1 is four author rows and the rest is void. That reframes 05's third defect
from a styling defect into **evidence for this ticket's question 2** — it is a
symptom of the shape, and only a shape change removes it.

### 4. 05's other two defects are real, fixed, and verified in both states

`compare-inactive-button.png` is the decisive shot. Shipping renders the
inactive `Next` as a **blank light rectangle with no label at all** — worse than
05's "invisible label" description suggests, because there is no text visible
whatsoever. The fix keeps the outline and the primary-coloured label, preserving
the deliberate shipping behaviour that the button stays **pressable** so it can
explain what is missing (`authors.tsx:37-43`). Both states verified.

The missing app header is fixed the same way in all four: back chevron, title,
and a step indicator where there are steps.

### 5. Variant C's structural cost: the pool duplicates the selection

One screen means the picked books appear **twice** — once in `IN THIS SERIES`,
once checked in `ADD BOOKS` (`11-C-two-picked-duplication.png`). At 8 books it
is untidy; at 350 it is a permanent doubled list. This is a decision C owes an
answer to, not an implementation slip: either the pool hides picked books (and
un-picking has to move back there), or the ordered section is not shown inline.

### 6. Variant D costs more screens than it saves, and inherits the wrong words

Two findings, both visible:

- **`Add books` has nowhere to go.** D's headline is that it deletes three
  screens, but `books.tsx` is **shared with the editor** (`isEdit` switches
  `Next`→`Done`, `books.tsx:93-101`). Deleting it forces the editor to grow its
  own picker — built here as an inline panel
  (`14-D-editor-grows-a-picker.png`). **The saving is two screens, not three**,
  and the editor gets busier.
- **The empty room** (`13-D-empty-room.png`). You land on a screen headed
  **`Edit series`**, reading *"This series has no books yet"*, offering
  **`Delete Series`** — for a series that does not exist. Reusing the editor
  means inheriting the editor's vocabulary, so D needs a create-mode wording
  pass on a surface ticket 10 has already loaded with artwork, numbers and
  `Sort by number`.

Also: **D's name prompt cannot be a dialog over the library** while 05's opaque
push stands. The prototype draws it over a black push, not over the library
(`12-D-name-prompt.png`), so the dim reads as nothing. A real D would put the
prompt on the library *before* navigating — which is a fifth surface, not a
free one.

### 7. Not modelled, deliberately — the create-then-edit write hazard

The naive D writes the series at the prompt so the editor has an id.
`createSeries` tolerates an empty membership array (`seriesQueries.ts:67`) and
**`deleteEmptySeries()` runs on every library scan** (`scanLibrary.ts:964`), so
a create abandoned before adding a book silently disappears — and `Cancel` and
`Delete` would both need cleanup paths. The prototype defers the write to
`Save`. **If D wins, the deferred write is the version that ships.**

### STATUS 2026-08-04 — all four REJECTED; hybrids are the next pass

**The driver flipped all four on device and ruled none of them fully correct.**
The next pass builds **hybrid variants combining elements across A/B/C/D** —
the prototype skill's expected outcome ("I want the header from B with the
sidebar from C"), not a failure of the lineup. Nothing above is retracted; the
findings stand and are what the hybrids get composed from.

**Ticket stays `claimed` and OPEN.** No shape is chosen, and *what the wizard is
for* is still unstated — the driver deferred it to the device session and the
session did not close it.

#### The parts menu, so a hybrid can be composed without re-deriving

| From | Part | Costs / notes |
| --- | --- | --- |
| A | Staged guidance + `n of m` indicator | The staging is the thing in question |
| A | Author list as an explicit surface | Provably a discarded filter (§1) |
| B | **Search field replacing the author gate** | Strongest single result of the session |
| B | Author group headings retained inside the pool | Serves the rescue reading at no cost |
| B | A dedicated arrange screen | Thin — 2 rows and a void (§2) |
| C | One screen, no steps | Pool duplicates the selection (§5) |
| C | Ordered section that **appears only when non-empty** | The cheapest answer to "is Order a step?" |
| C | Numbered rows with grip + remove | Works; drag verified inside the `ScrollView` |
| D | Editor reuse (one surface for create + edit) | Saves 2 screens, not 3 (§6) |
| D | Artwork slot, canonical `#` field, `Sort by number` | Ticket 10's growth; independent of shape |
| D | Inline `Add books` picker panel | The cost of deleting `books.tsx` |
| all | Fixed header (chevron + title) and the **outlined inactive button** | Keep regardless of shape (§4) |

#### Where the code is

- `src/prototypes/wizard/` — `wizardShared.tsx` (draft store, book pool,
  header/footer/fields, `useHardwareBack`), `VariantA..D.tsx`, `ProtoWizard.tsx`
  (dispatch + both pills).
- `src/app/seriesCreateProto.tsx` — the route (`null` outside `__DEV__`).
- Real-code footprint, all marked `THROWAWAY`: one `<Stack.Screen
  name='seriesCreateProto'>` in `src/app/_layout.tsx`; one `<ProtoWizardPill />`
  + its import in `src/app/(drawer)/(library)/index.tsx`; a `wizardVariant` knob
  in `src/prototypes/protoStore.ts`.
- Adding a hybrid = copy a variant file, add one row to `WIZARD_VARIANTS`.
  **Fast refresh is enough** — only the `Stack.Screen` needed a full reload, and
  that is already in place.

#### Device-ops for the next session

- The launcher pill is bottom-left on the **Series** view; it sits just under
  ticket 04's `proto · …` pill. The `‹ ›` pill inside the route cycles variants
  and **resets the draft on every switch** (deliberate — an A/B must not compare
  two shapes in two different states).
- Relaunch after a JS-only change: fast refresh. After a navigator change:
  `adb shell am start -a android.intent.action.VIEW -d "sonicbooks://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081"`,
  then verify with `adb shell dumpsys window | grep mCurrentFocus`.
- **A stray hardware/keypad press pops the route** and looks exactly like a
  crash. It happened once this session and was the driver's keypad, not a bug —
  check `adb logcat` for `ReactNativeJS` before believing otherwise.

---

## Variant E — 2026-08-04, second device session

The driver specified E directly out of the parts menu above, plus two rules that
were **not** in any of A–D and not among the options offered. E is built and
device-driven; it is a live proposal, not a decision.

**Shape.** D's single editor surface. `Add books` expands a panel that runs
`Authors → Books`; the panel then closes and **Order happens in the list**, which
is where the series lives. Two `Next` presses, then `Save`.

    Authors ─Next─▶ Books ─Next─▶ (panel closes) ─▶ Order in the list ─▶ Save

**Driver's decisions, recorded so they are not re-litigated:**

1. **No name prompt.** D's dialog is gone; the name field is in the identity row
   and the panel opens on Authors immediately. Naming can happen before or after
   picking. *(Answers "where does a fresh create start".)*
2. **The author picker returns, as a panel step** — reversing B's search field,
   which §1/§2 above had called the session's strongest single result. The stated
   reason is that the real use is scanning 50–100 authors, which is a BROWSE;
   search only helps someone who already knows the name.
3. **Order is the main list, not a third panel step.**
4. **No book totals anywhere** — "not additive, confusing". `ProtoAuthorHeading`'s
   `count` is now optional and E omits it; A–D still pass it, so their screenshots
   remain valid evidence.
5. **Author cells: 2 columns, 13px, ~50dp pitch, no big check bubble.** The tiny
   corner check was built rather than dropping the check entirely, because
   border-colour-alone is a colour-only state.

### The numbering rule — the driver's, and better than the three offered

Cascade / offset / pin-only were all rejected. The rule is:

- every row gets an **empty** number box;
- `Sort by number` orders by what was typed; **rows left blank fall to the end**,
  alphabetical among themselves;
- if **nothing** was typed, save assigns `1..n` from the final drag order.

It needs no cascade machinery and lands exactly on **ticket 07's schema**:
`canonical_number` is nullable, and blank means null rather than a guess.

**Consequence worth carrying:** this makes `Sort by number` a **manual action,
not a save-time rule**. 07 gave `position` sole sort authority, so what you
dragged is what gets written. Auto-sorting on save would have the app overrule
the gesture the whole screen is built around.

### Verified on device

| | |
| --- | --- |
| Author grid at ~100 entries | 2 cols, 13px, ~50dp pitch → **~20 authors/screen**, so 100 is ~5 screens |
| Selection signal | primary border + 12% tint + 14px corner check; all three read at a glance |
| Staging kills the jump | **measured** — see below |
| Already-added books | shown dimmed + checked + inert inside the picker |
| `Next` → `Save` switch | flips on panel close, both states correct |
| Blank + numbered sort | `5` rose, blank fell to the end; derived cover followed the new first book |
| Save summary | partial case prints `5 …` / `— …` + the rule; nothing written |
| Drag with a `TextInput` in the row | **works** — the field does not steal the handle's gesture |
| Back semantics | header chevron / hardware back = step back; panel `X` = dismiss panel |

### The jump is provably gone

One selection tap, pixels changed above the fold, same corpus and same crop:

| | pixels changed by one tap |
| --- | --- |
| **D** (commits on tap) | **547,334** — inserts a row, a sort header, a subtitle and a new cover; the panel drops ~150dp |
| **E** (stages until `Next`) | **28,488** — the tapped row's own border and bubble, and nothing else |

Region strictly above the panel in E: **0 differing pixels**.
Asset: `assets/15-wizard-flow-shape/hybrid-E/compare-selection-jump.png`.

The cause was structural, not cosmetic: in D the panel and the list share one
scroll view, so anything landing above the panel *must* move it. Staging is one
fix; a picker that **covers** the list (bottom sheet) is the other, and is
untested.

### Two finish defects found and fixed during the session

1. The disabled `Sort by number` did not look disabled — `textMuted` is bright in
   this theme, so a dead control read as live. This is **05 defect 1 recurring in
   a new place**. Fixed with `opacity: 0.4` on top of the colour change.
2. The empty-state numbering note ran to 61 chars and wrapped into the sort
   button on a 411dp screen. Shortened to ~36.

### Still open — the live list

- **What the wizard is FOR.** Still unstated, and it is now the SAME axis that
  separates E from F, so answering it very likely answers the shape too. Decision
  2 leaned rescue; the Favorites example is playlist. See "So what DOES decide
  E vs F".
- **E or F.** Both built, both driven, neither chosen.
- **A bottom-sheet picker** instead of an inline panel — the one presentation
  idea still standing. Ticket 13 proved sheet-over-sheet is clean in this app, so
  it is known-good, and it removes the jump *structurally* rather than by staging.
  Not built. **Note it is orthogonal to E vs F** — either panel could live in a
  sheet, so this is not a third candidate, it is a wrapper for whichever wins.
- **`Delete Series` is dropped from E's and F's create pass.** That resolves D's
  logged wording defect (§6) by making Delete a function of *editing* something —
  asserted here, not tested against a real edit.

### Closed — do not re-offer

- **A-Z fast-scroll rail.** Driver: a single flick reaches the bottom, so the
  scroll cost does not justify it.
- **Filter / search field over the authors.** Driver: it serialises multi-author
  selection into filter → select → clear → filter cycles. See "Density is NOT the
  deciding factor" — this also retroactively explains why B's search field lost.
- **Shrinking F's rows.** Built, driven, rejected as too small; reverted.

### Two driver fixes to E, applied and measured — 2026-08-04

**1. `Sort by number` is pinned right.** The note beside it vanishes once every
book is numbered, and `justify: space-between` let the button slide left into the
vacated space — a control that moved when nothing about it had changed. The
note's slot is now always rendered at `flex: 1`, empty or not, so the position is
a property of the row rather than of the note's content.
**Measured: 0 differing pixels** in the button's bounding box between
note-present and note-absent, with the button enabled in both. (The naive diff
shows ~8,500 px because the enabled/disabled repaint dominates — that is not
movement, and the two states must be compared at the same enablement.)

**2. Remove moved out of the row's tail.** `SeriesBookRow`'s own `onRemove` put a
`Minus` immediately left of the drag grip: it cost the title horizontal space and
sat one thumb-width from the handle you are meant to press and hold. It is now a
**`Trash2` badge at the card's top-left**, over the cover. Titles gained
noticeably — `Discworld 04 - Mort` now fits whole where it previously truncated.

`SeriesBookRow` itself is **untouched**. It is production code shared with the
real editor, and A–D are the comparison record; E and F wrap it instead.

Two sub-decisions inside fix 2, flagged because they are judgment not spec:
- the glyph carries its **own scrim** rather than darkening the artwork, which is
  ticket 13's house rule;
- it is **`textMuted`, not `danger`** — removing a book from a series does
  nothing to the book, and N rows of red trash cans would read as a warning the
  screen does not mean. One-line change if that reads wrong on device.

---

## Variant F — the author accordion

Built at the driver's request, same session. F keeps everything E settled and
challenges exactly one thing: **whether `Authors → Books` needs to be two steps
at all.**

    E   pick authors ─Next─▶ see their books ─Next─▶ Order ─▶ Save
    F   tap an author, their books unfold in place ─Next─▶ Order ─▶ Save

Everything from the identity row down is **literally the same code** —
`editorShell.tsx`, extracted from E for this purpose. That is what makes the pair
readable as an A/B rather than as two designs, and it is why both driver fixes
above landed on F for free.

**One author open at a time**, as specified. `expanded` is a single nullable
name, never a Set: with several open, the books you are choosing between get
separated by whatever the other open authors contribute, and the accordion stops
being a way to see one author's shelf.

**Row styling** follows the Android file-picker screenshot the driver supplied —
24px outline glyph in a gutter, name at reading size in the default weight, a
hairline rule **indented past the gutter**. Deliberately not a card: cards were
E's answer, and drawing F as cards too would hide the difference being tested
behind a shared skin.

**The folder became the circle-check, and the swap earned its place.** A folder
is decoration; the check reports whether that author is contributing anything to
the series. Verified on device: after collapsing Dennis E. Taylor to open Brandon
Sanderson, Taylor's collapsed row **still shows a filled check** — so a fully
collapsed list shows you where your picks are without opening anything.

### Verified on device

| | |
| --- | --- |
| Expand in place | author turns primary + semibold, books unfold indented to the gutter |
| One at a time | opening Sanderson collapsed Taylor, exactly once, no flicker |
| Collapsed-state signal | Taylor's row kept its filled check after collapsing |
| Staged selection | unchanged from E — inherited, not re-implemented |
| Breadcrumb | **two** crumbs (`Books › Order`), not three — the whole result of the variant |
| `Next` pressed | **once**, not twice |
| Order stage | pixel-identical to E's; both fixes present |
| Row metrics | `fontSize.base` name / 24px glyph / ~60dp pitch → 7 authors per screen |

**Note for anyone touching type in this repo: `fontSize.base` is 20, `sm` is 16,
`xs` is 12** (`src/constants/tokens.ts`) — `base` is not a 16px body size, and E's
compact 13px cells are a literal because no token sits below 16. F using `base`
was read as an oversight and "corrected" to 15; the driver reverted it, so **20
is deliberate**: single column earns bigger type.

### Density is NOT the deciding factor — driver's ruling, 2026-08-04

Two sessions of this ticket treated F's scroll cost as the trade that decides
E vs F. **The driver ruled that framing wrong, and the reasons generalise, so
they are recorded rather than the conclusion.**

**On scrolling:** "The scroll cost is not large here. A single flick can scroll
the list all the way to the bottom." A ~14-screen list is not fourteen
interactions — it is one or two flicks. Screens-of-content was the wrong unit; it
measures the list, not the effort. **No A-Z rail is needed and none should be
built.**

**On a filter field, which is the sharper point:** "If I want to create a
Favorites list that has books from 10 different authors, I can only filter on one
at a time. So filter → select their books → remove filter → filter on the next
author, etc. It seems unuseful at best."

A filter is **modal**: it re-scopes the whole surface, so a task spanning N
authors becomes N filter/clear cycles, and the authors you have not dealt with
are hidden while you work. That is worse than scrolling past them.

#### What that rules out, and what it retroactively explains

The argument is not about filters specifically — it is about **any device that
re-scopes the surface and loses your place**. Applied across the lineup:

| | re-scopes? | keeps selections across authors? | survives |
| --- | --- | --- | --- |
| Filter field | yes | you must clear and re-filter | ✘ ruled out |
| **B's search field** | yes | same problem | ✘ — and this **retroactively explains B** |
| E's author step | no — multi-select, then one merged list | yes | ✔ |
| F's accordion | one open at a time, but **staging persists** | yes | ✔ |

This gives the driver's earlier decision 2 — bringing the author picker back over
B's search field — a **reason it did not previously have**. The findings had
called B's search "the strongest single result of the session" and decision 2
overrode it on taste. It was not taste: search is a filter, and a filter
serialises multi-author selection. **Staging is what makes E and F immune** —
selections survive changing which author you are looking at.

#### The row-metric experiment still stands, just not as the deciding number

| | name / glyph / pitch | authors per screen | |
| --- | --- | --- | --- |
| E — 2 columns | 13px / — / ~50dp | ~18 | |
| **F — chosen** | **20px / 24px / ~60dp** | **7** | ✔ |
| F — tried | 15px / 20px / ~42dp | 10–11 | ✘ "too small" |

**Do not shrink F's rows again** — tested and rejected. But the reason is
legibility, not density, and density is no longer worth trading legibility for.

### So what DOES decide E vs F

With density retired, the pair separates on **how many authors a single create
involves** — and the two variants optimise opposite ends:

|  | one author (rescue a real series) | many authors (a Favorites list) |
| --- | --- | --- |
| **E** | tap author → `Next` → tick books | tap 10 authors → `Next` → **one merged list, all candidates visible at once** |
| **F** | tap author → tick books — **one press shorter** | 10 expand/collapse cycles; **never sees more than one author's books at a time** |

So: **F saves exactly one press, always — a constant, not a saving that grows.**
E's advantage is the opposite shape: it is the only one of the two that ever puts
all the candidate books on one surface.

**This is the axis the choice should be made on, and it is the same axis as the
ticket's unanswered question** — a Favorites list spanning 10 authors is the
*playlist* reading; rescuing one author's genuine series is the *rescue* reading.
The driver's Favorites example is the first concrete use case stated in this
ticket, and it is playlist-shaped, which points at E. That is **evidence, not a
resolution** — decision 2 was justified on the rescue reading, so the two are
still pulling in different directions and the driver has not said which wins.

Incidental confirmation from the same pass: both variants track the app theme —
driven under the amber accent, the panel border and `Next` followed correctly, so
nothing here hardcodes the blue.

Assets: `compare-E-vs-F.png`, `compare-F-row-metrics.png`.

### Where E's and F's code is

- **`src/prototypes/wizard/editorShell.tsx`** — everything E and F share:
  `useNumbering` (the driver's rule), `EditorIdentityRow`, `OrderedList` (which
  owns both fixes above), `AddBooksButton`. **Fixes go here, not in a variant** —
  a fix applied to only one of the pair makes the A/B compare a fixed screen
  against an unfixed one, which is the exact confound this ticket was warned
  about when the lineup was chosen.
- `VariantE.tsx` — the two-step panel + `AuthorCellView` + the 3-crumb breadcrumb.
- `VariantF.tsx` — the accordion + `AuthorAccordionRow` + the 2-crumb breadcrumb.
- `wizardShared.tsx` gained `useAuthorCells(pad)` + `clearAuthors`, and
  `ProtoAuthorHeading`'s `count` became optional.
- `protoStore.ts` gained `'authorFirst'` (the default landing variant),
  `'accordion'`, and `authorPad`.
- Gotcha: `scrollableRef` must be typed `AnimatedRef<Animated.ScrollView>` from
  reanimated, not `React.RefObject<...>` — `AnimatedRef` carries an `observe`
  member and `useAnimatedRef`'s `current` is a plain `ScrollView`, so the two
  are mutually unassignable and tsc rejects both directions.
- **`authorPad` is a harness knob, not a feature**: it pads the grid to ~100 with
  non-selectable dimmed synthetic authors, because the density question cannot be
  posed against an 8-book corpus. Toggle is the pink chip under the grid.

### Fidelity limits

- **Steps are component state, not routes**, so the push/pop animation and the
  edge-swipe between steps are not exercised. Deliberate: 05 settled the
  presentation and this ticket forbids reopening it, so four real route groups
  would have cost ten files to test nothing being asked. Hardware back is wired
  and maps to "previous step" in every variant.
- Variants C and E render their pools unvirtualized inside the sortable's
  `ScrollView`. Fine at the emulator's 8 books; a shipped version needs the pool
  as the `FlatList` with everything above it as `ListHeaderComponent`. At E's
  padded 100 authors that is ~50 rows of plain `View`s — fine to look at, not
  fine to ship, and it does not change what is being judged.
- Synthetic padded authors carry **no books**, so they are non-selectable by
  construction. Selecting one and pressing `Next` can never produce an empty
  book step.
- tsc 0 errors, eslint 0 errors (re-verified after E).
