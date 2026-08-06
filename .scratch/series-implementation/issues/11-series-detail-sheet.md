# 11 — The series detail sheet

**Blocked by:** [01](01-schema-v33.md), [10](10-browse-row.md).

**Status:** ready-for-agent

**Spec:** [§C](../../series-ux-redesign/spec.md), §J, §K5, §K11, §Out of Scope.

## What to build

Tapping a series row's text opens the series as a **bottom sheet** — a detail view of the
row you tapped, not a departure from the library. It lists every book in order; **tapping a
cover plays it, tapping the text opens that book's details.**

Closes user stories 31–39, and pays a carried commitment (see below).

## Presentation

- **C1 — a `formSheet`**, matching the book details screen — the app's existing
  detail-screen-for-an-object — with the same overflow-top-inset and corner radius. The
  wizard's opaque-push ruling explicitly does **not** transfer: the wizard is a task flow,
  this is a container.
- **C2 — a root-sibling route, not a member of the series group.** This is **forced, not
  chosen**: a screen inside the group cannot be a root-level sheet. It also makes the
  editor's `Save`/`Cancel` exits correct by construction.
- **C3 — the header is a grab handle only.** No nav row, no back chevron, no ⋮. A back
  chevron on a bottom sheet is a mixed metaphor — the sheet dismisses downward, the arrow
  points left. The handle is itself pressable and dismisses.

## The rows split, and that is what the prototype bought

**C4 — the cover plays, the text opens the book's details.** The play target is the whole
leading half (number plus the full height of the artwork), so the glyph **advertises the
target without being it**. This restores the app-wide rule that a book card is tappable to
its details — this screen was the only place that broke it — and it is the arrangement the
library grid already uses.

**Sheet-over-sheet is measured clean in both directions**, twice, from each end. That
measurement is what licenses this split.

## Acceptance criteria

- [ ] The sheet presents from the browse row's text, as a root-sibling `formSheet` with a
      grab-handle-only header.
- [ ] Rows split: cover plays, text opens book details.
- [ ] **Presenting the book details sheet from a series row requires setting the app's
      existing navigation intent flag**, or that screen dismisses itself on mount.
- [ ] **C5 — a finished row restarts from zero.** Landing thirty seconds from the end of a
      finished book is a poor outcome whether or not there is an escape hatch, and the
      finished check mark is already the "you've read this" signal, so the tap has nothing
      to disambiguate.
- [ ] **Fix it in the shared play helper, not at this call site.** The helper has **no
      `Finished` case**, so a finished book resumes at its last few seconds *everywhere
      else in the app*. This was recorded as an accepted inconsistency and that is
      **reversed** — the argument is no longer "this screen is special", it is "this is the
      better behaviour", which applies everywhere. Fixing the helper pays the library grid
      for free.
- [ ] **C6 — the active book reuses the grid's treatment**: animated bars while playing,
      the same title colour. Reused, not reinvented.
- [ ] **C7 — the hero is the browse backdrop and honours `Series Backgrounds`.** Both states
      were already designed (ON = the browse treatment, OFF = a flat hero), so this is a
      conditional, not a design. **It needs a bottom fade** — without one, the backdrop's
      lower edge is a hard seam across the middle of the sheet.
- [ ] **C8 — pinned art rides the fan's front card**, replacing card 0 rather than
      prepending, so the cluster's width and peek stay constant. The backdrop follows it.
- [ ] **C9 carried from the browse work unchanged:** the fanned cluster · the name, capped
      with tap-to-expand and no label, with overflow **measured** rather than inferred
      (K14) · the meta line with the canonical range · the completion bar · a
      `Start`/`Continue`/`Restart` button that **keeps its word here**, because a
      full-width hero button does not have the browse row's width constraint · one row per
      book showing `#canonical` or a blank.
- [ ] **C10 — one route to the editor: a wrench row reading `Edit series`**, under the play
      button. No ⋮ — a menu holding a single item that duplicates a visible row two inches
      below it is not worth its pixels.
- [ ] **H6 — the finished check mark travels with the title.** It is an *indicator*, not a
      target, so the row's text shrinks rather than filling — closing a measured **416dp**
      gulf between a title and its tick.
- [ ] **H2 — the 600dp content cap is NOT applied here.** It was built on this page and
      reverted on sight.
- [ ] **K5 — the route gets a themed background.** Routes copying the book-details screen's
      options inherit **no background colour**, so any state where the route renders nothing
      is a **full-screen white sheet** on a dark-theme app. This is not hypothetical — it
      was reproduced.
- [ ] **K11 — a book cell can only render a book that is in the library store.** An
      unresolvable id renders a size-accurate **blank**. Resolve from the store, or render
      from the book objects the assembled series already carries.
- [ ] Device-verified in both themes, both backdrop states, at font scale 2.0.
- [ ] `tsc` 0 errors · eslint 0 errors · jest green.

## Dropped, not deferred

**C11 — the series description does not ship.** It was the only item that added a *feature*
rather than deciding a presentation, and it dragged a column, a provenance companion and an
editor field behind it.
