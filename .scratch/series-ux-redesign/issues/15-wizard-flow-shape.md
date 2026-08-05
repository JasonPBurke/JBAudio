# 15 — Wizard flow shape: does the 3-step funnel survive as the fallback?

Type: prototype
Status: resolved — 2026-08-05. **Variant E**, one route, root `transparentModal`. See `## Answer`.
Blocked by: (none)
Parent: [map.md](../map.md)

> **RESOLVED 2026-08-05 — the answer is at the bottom, under `## Answer`.**
> Everything between here and there is the evidence trail, left intact and
> unedited. Where an earlier section contradicts the answer it has been marked,
> not rewritten — including this ticket's own "already settled" clause on
> presentation, which the answer overturns.

## Where this stands — 2026-08-04 *(superseded)*

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

> **The first bullet below is OVERTURNED by this ticket's own answer.** It was
> sound for a three-route wizard and dies with E, which merges create into the
> editor — see `## Answer`, decision 3. Left in place because the reasoning it
> records is why the overturn needed an argument rather than a preference.

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

---

## Session 2026-08-05 — four decisions taken, and variant G built

The driver settled the four open questions by grilling before anything was
built. Recorded here in the order they were asked, because each one narrowed the
next.

### 1. What the wizard is FOR — **hand-building playlists**

Answer (a) of three offered; the driver added *"with the understanding that C
collapses into A"*, so "serve both equally" is not a third position.

The ticket had left this unstated across three sessions. It was decided on
**asymmetry of being wrong**, not on a guess about habits:

| | picked E, real case is rescue | picked F, real case is playlist |
| --- | --- | --- |
| cost | **+1 press.** Constant, forever. | 10 expand/collapse cycles, and **no surface ever shows all candidates at once** |

Supported by volumetrics composed from 01 and 02, which nobody had put together:
~4% of in-series books are dark to every signal, and 02 emits 19 series / 179
books — so the rescue path covers **≈7 books across the whole 350-title library**,
once, and then only on newly-acquired dark books. Playlists are unbounded.

**Rescue and delete-and-rebuild still work. They are simply not what the shape
is optimised for.**

### 2. **Variant E wins. F is rejected.**

Follows from 1: F's saving is one press, a constant; E's advantage grows with
author count and it is the only shape that ever puts all candidate books on one
surface. F stays in the harness as the comparison record.

Also confirmed while checking, rather than assumed: **E needs no change under the
playlist reading.** The numbering rule (blank boxes → `1..n` from drag order) is
already playlist-shaped since a Favorites list has no published sequence; the
author multi-select is a **non-modal volume reducer** (10 authors turns ~350
books into ~50 rows) which is why it survives the closed filter/search ruling;
and `openPicker`'s `clearAuthors()` is right, because a second pass is a genuinely
new "which authors now?" question.

### 3. Presentation — **one route, root `transparentModal`, from everywhere**

**This AMENDS 05 and overturns this ticket's own "already settled" clause.**

That clause said the wizard is an opaque full-screen push and that
[13](13-detail-sheet-prototype.md)'s finding "does not touch it, because the
wizard is launched from the library, not from a sheet." **That reasoning was
sound for a three-route wizard and dies with E**, which merges create into the
editor — and 13 already moved `series/edit/[id]` to a root `transparentModal`
because an opaque push over a live sheet flashes the library ~165 ms and
re-presents the sheet. One surface, two launch contexts, two rulings.

Two options were put; the driver took (ii):

- (i) two routes sharing `editorShell`, create pushes / edit cross-fades
- **(ii) one route, `transparentModal` everywhere** ← chosen

**(ii) does not reopen 05.** What 05 bought was *full-screen opaque content with
a Save/Cancel footer* rather than a partial-height sheet you can see the library
behind — `editTitleDetails` is already a `transparentModal` at `#2c2c2cdc`
(`_layout.tsx:265`) and reads as a full takeover. Only the transition and the
route's parent change.

**Factual correction to the map**, which this ruling would otherwise inherit: the
map records the wizard as "the only opaque full-screen push in the app
(`_layout.tsx:288`)". **`(settings)` at `_layout.tsx:276` is also a bare
`slide_from_left` with no `presentation`, so it is one too.** Adopting (ii)
therefore leaves `(settings)` as the app's last opaque push, not zero.

### 4. **`Add to series…` is join-only** — no `New series…` row

10 and 14 both specify it only as *join another series* and neither says whether
its picker can create one. It never mattered before, because create was a
three-route push that could not launch from `titleDetails`' `formSheet`; under
(ii) it could. The driver ruled it out: book-first stays austere, consistent with
10's refusal of book-first remove.

### Consequences that follow necessarily

- **`src/app/series/create/{authors,books,order}.tsx` are all three deleted.**
  Their `seriesDraftStore` resets move onto the editor — 13 established
  `series/_layout.tsx` is a bare `<Stack>` owning no store lifetime, so nothing
  is orphaned.
- **The `books.tsx`-shared-with-edit problem dissolves rather than being solved.**
  The editor *is* the surface, so the panel serves both legs. That was §6's
  charge against D; E takes the benefit without the cost.
- `handleCreateSeries` (`(library)/index.tsx:250`) and the editor's `Add books`
  (`series/edit/[id].tsx:238`) — **both of which navigate to
  `/series/create/authors` today** — retarget to the one editor route.
- **05's three defects are discharged** in the winner: fixed header, outlined and
  labelled inactive button, and the dead vertical region dissolved by the shape
  change rather than by a layout fix (§3's correction stands).

---

## Variant G — E's flow with the picker in a bottom sheet

Built this session at the driver's request. **The driver's instruction was "I
want to build it and compare", against a recommendation to drop it** — so this is
an open comparison, not a formality.

G holds E's shape fixed (two steps, same staging, same `editorShell` from the
identity row down) and changes **one** thing: the picker is a presented
`BottomSheetModal` covering the editor rather than a panel inside it. Same
discipline F used — one variable, so it reads as an A/B.

### What G confirms

**The mode ambiguity is gone, structurally.** In E the footer's `Next` silently
becomes `Save` when the panel closes. In G the editor's footer reads **`Save` for
the entire flow** and the sheet carries its own `Next`; no label ever changes
meaning, because one surface is covering the other. Verified —
`03-G-editor-after-commit.png`.

The jump claim is **not** re-tested, because there is nothing left to test: E's
staging already measured it away (28,488 px vs D's 547,334, 0 differing pixels
above the panel). A covering sheet is a second solution to a solved problem.

### What G costs — the finding that matters

**The sheet hides the running list.** Asset:
`hybrid-G/compare-E-vs-G-second-pass.png`, shot at identical state — second pass,
Books step, one book already in, same corpus, same two authors selected.

- **E** — identity row, the ordered list, and the panel are all on one surface.
  You can see what you have assembled while adding to it.
- **G** — the sheet covers everything. The book already in the series is
  invisible; only the dimmed header shows above the sheet.

**This lands squarely on decision 1.** A multi-author Favorites list is built
*incrementally*, which is exactly when seeing the running list matters most — so
the presentation costs the most in the case the shape was just optimised for.

*(Reading note: `hybrid-E/16-E-already-in.png` predates the driver's fix 2, so it
still shows the old `Minus` in the row's tail. The trash badge at the card's
top-left IS present in G — see `03-G-editor-after-commit.png`. Not a difference
between the variants.)*

### One deliberate divergence, surfaced rather than hidden

**Back means dismiss, not step back.** `@gorhom/bottom-sheet` registers its own
back handler when the sheet opens, so making hardware back walk Books → Authors
would mean racing RN's `BackHandler` registration order. G puts stepping back
where a sheet puts it — a chevron in the sheet's own header — and lets back,
pan-down and backdrop-tap all mean dismiss. That is not separable from the
presentation, so judge it as part of G.

G also **does not exit the flow on dismiss** the way E's `dismissPanel` does when
`ordered` is empty. In G the editor is not a dead end behind the sheet — it keeps
`Cancel`, `Save` and `Add books` — and making a pan-down abandon everything would
be a surprise.

### Two defects found and fixed during the build

1. **`BottomSheetView` sizes to its content**, so at a fixed 88% snap point the
   author grid ran past the sheet's bottom edge and pushed the footer entirely
   off-screen. A plain `flex: 1` `View` takes the sheet's height. (`BottomSheetView`
   exists for `enableDynamicSizing`; with fixed snap points it is the wrong
   component.)
2. Dismissing onto an empty list exited the route, which also made the variant
   unreachable in the harness — the switcher pill sits *under* the sheet's portal.

### Fidelity limit specific to G

The harness route is a plain push, so this does **not** reproduce the stack
decision 3 implies. Shipped, a sheet picker would be
**sheet → `transparentModal` → (library | `formSheet`)** — three deep, which
nothing in this app has ever built. 13 proved `formSheet` over `formSheet`, not
this. **A clean result here is not evidence that the three-deep stack behaves.**

### Where G's code is

- `src/prototypes/wizard/VariantG.tsx` — the only new file. Reuses `editorShell`
  untouched, and lifts E's `AuthorCellView` and breadcrumb verbatim (neither is
  what G tests).
- `protoStore.ts` gained `'sheetPicker'`; `ProtoWizard.tsx` gained one import and
  one dispatch line. Pill order is now **E · G · F · A · B · C · D**.
- Harness knob inside the sheet's Books step: **`staged` ⇄ `commit on tap`**. If
  the list is covered, committing on every tap cannot be seen, so staging may not
  survive the presentation change — that is testable rather than arguable. If
  `commit on tap` reads fine, the shipped version drops the staging buffer.
- Assets: `assets/15-wizard-flow-shape/hybrid-G/`.

tsc 0 errors, eslint 0 errors.

### G was driven, then REJECTED — the inline panel wins

The driver flipped between E and G on device and chose **E**. G's one confirmed
benefit (no label ever changes meaning) did not outweigh the cost the build
surfaced: **the sheet hides the running list**, and a playlist is built
incrementally, so the presentation costs most in exactly the case decision 1
optimises for.

G stays in the harness as the comparison record, exactly as A–D and F do.
`compare-E-vs-G-second-pass.png` is the shot that decided it.

**The bottom-sheet picker is now CLOSED — do not re-offer it.** It was the last
item on the "still open" list, it was built rather than argued away, and it lost
on evidence.

---

## Answer

**The wizard stops being a wizard.** It becomes the **editor with an on-demand
picker panel** — variant **E** — reached by **one route**, presented as a **root
`transparentModal`** from every launch context.

### 1. What it is FOR: hand-building playlists

Stated at last, after three sessions of being deferred. Rescue (the ~4% dark
books) and delete-and-rebuild still work; they are simply **not what the shape is
optimised for**.

Decided on **asymmetry of being wrong**, not on predicted habits: choosing E when
the real case is rescue costs **+1 press, constant, forever**; choosing F when
the real case is a playlist costs 10 expand/collapse cycles **and no surface that
ever shows all candidates at once**. Corroborated by volumes nobody had composed
before — 01's ~4%-dark against 02's 19 series / 179 books puts the rescue path at
**≈7 books across the whole 350-title library**, once. Playlists are unbounded.

*(Driver's exact framing: "A with the understanding that C collapses into A" —
so "serve both equally" is not a surviving third position.)*

### 2. The shape: variant E. F and G rejected

- **F** loses because its saving is **one press, a constant**, while E's
  advantage grows with author count.
- **G** loses because a covering sheet **hides the running list**.
- **E needs no change under the playlist reading** — verified, not assumed. The
  numbering rule is already playlist-shaped (a Favorites list has no published
  sequence, and blank → `1..n` from drag order is exactly right); the author
  multi-select is a **non-modal volume reducer** (10 authors turns ~350 books
  into ~50 rows), which is *why* it survives the closed filter/search ruling; and
  `clearAuthors()` on reopen is correct because a second pass is a new question.

### 3. Presentation: ONE route, root `transparentModal` — **this AMENDS 05**

E merges create into the editor, and [13](13-detail-sheet-prototype.md) had
already moved `series/edit/[id]` to a root `transparentModal`. One surface, two
launch contexts, two conflicting rulings. Two options were put; the driver chose
**one route, one presentation, everywhere**.

**It does not reopen 05.** What 05 bought was *full-screen opaque content with a
Save/Cancel footer* rather than a partial-height sheet with the library visible
behind it — `editTitleDetails` is already a `transparentModal` at `#2c2c2cdc`
(`_layout.tsx:265`) and reads as a full takeover. Only the **transition and the
route's parent** change.

**Factual correction to the map:** it records the wizard as "the only opaque
full-screen push in the app (`_layout.tsx:288`)". **`(settings)` at
`_layout.tsx:276` is a bare `slide_from_left` with no `presentation`, so it is
one too.** This change leaves `(settings)` as the last opaque push, not zero.

### 4. `Add to series…` is join-only

No `New series…` row. 10 and 14 both specify it as *join another series* and
neither said whether its picker could create one; it never mattered while create
was an unreachable-from-a-sheet push. Book-first stays austere, consistent with
10's refusal of book-first remove.

### 5. `X` closes the panel and stays — driver's change, built and verified

**`X` and `+ Add books` are now inverses.** `X` no longer exits the flow when
nothing has been added; it always closes the panel onto the editor, which keeps
its own `Cancel`, `Save` and `+ Add books`. The old behaviour made one button
mean two different things depending on invisible state — dismiss, or abandon the
whole series — and picked the destructive reading exactly when the user has least
context.

Two things fell out of it, both fixed:

- **Back had to become a strict one-stage walk** — `Books → Authors → panel
  closed → leave`. Without that last leg, back on the Order stage calls
  `dismissPanel()` on an already-closed panel, does nothing visible, and **traps
  the user on a screen whose only exit is the footer**.
- **A new empty state became reachable** and read wrong: with a closed panel and
  no books, the subtitle instructed you to *"Drag to order. Number them if you
  want to."* over an empty list. That state was previously impossible. Now
  **`Add books to get started.`**

Verified on device (`emulator-5554`), all four legs: `X` on an empty list stays
in the editor; `+ Add books` reopens on Authors with the footer back to `Next`;
back closes the panel and stays; back again exits to the library.

### Consequences that follow necessarily

- **`src/app/series/create/{authors,books,order}.tsx` are all three deleted.**
  Their `seriesDraftStore` resets move onto the editor — 13 established
  `series/_layout.tsx` is a bare `<Stack>` owning no store lifetime, so nothing
  is orphaned.
- **`books.tsx`-shared-with-edit dissolves rather than being solved.** The editor
  *is* the surface, so the panel serves both legs — §6's charge against D, taken
  as a benefit without the cost. **This also closes the one leg 13 left
  untested**, since `Add books` no longer navigates anywhere.
- `handleCreateSeries` (`(library)/index.tsx:250`) and the editor's `Add books`
  (`series/edit/[id].tsx:238`) — **both navigate to `/series/create/authors`
  today** — retarget to the single editor route.
- **05's three defects are discharged**: fixed header, outlined-and-labelled
  inactive button, and the dead vertical region dissolved by the shape change
  rather than by a layout fix (§3's correction stands).
- **Carried unchanged, do not reopen:** staged selection, the blank-box numbering
  rule with `1..n` from drag order on save, `Sort by number` pinned right and a
  manual action only, the `Trash2` badge at the card's top-left in `textMuted`
  carrying its own scrim, no book totals, no name prompt, Order in the main list,
  `Delete Series` absent from the create pass.

### Costs no schema.

tsc 0 errors, eslint 0 errors. Unblocks [16](16-geometry-stress-tablet-fontscale.md),
[17](17-light-theme-pass.md) and [18](18-schema-consolidation.md).

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
