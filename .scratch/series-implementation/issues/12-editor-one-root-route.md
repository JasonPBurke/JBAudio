# 12 — The editor becomes one route, and the wizard stops being a wizard

**Blocked by:** [11](11-series-detail-sheet.md) — the `Edit series` row is what reaches it
once the browse row's pencil route is gone.

**Status:** resolved

**Spec:** [§E1, E5, E8, E11](../../series-ux-redesign/spec.md), §C2, §J, §K5, §D2.

## What to build

Creating a series and correcting one become **the same screen, on one route**. The
three-step wizard — the app's only opaque full-screen push — is deleted, and the editor is
presented as a root `transparentModal` from every launch context.

This is a structural ticket: it moves and deletes routes without changing what the editor
can do. The picker panel, numbering and artwork land on top of it in
[13](13-editor-picker-panel.md), [14](14-editor-numbers-and-ordering.md) and
[15](15-editor-series-artwork.md).

Closes user stories 59–60.

## Why one route, and why a modal

**E1/E11 — this does not reopen the wizard-presentation ruling.** What that ruling bought
was *full-screen opaque content with a Save/Cancel footer*, not a slide; the book editor is
already a `transparentModal` reading as a full takeover. **Only the transition and the
route's parent change.**

**J1 — the opaque push is the only presentation that misbehaves over a live sheet.** It
presents fine and returns with scroll offset pixel-exact, but popping the group reveals the
**library for ~165ms** and the sheet then **re-presents** with a full slide-up — a double
transition showing a screen the user did not ask for. Both shipped alternatives are clean.

**J2 — the series group owns no store lifetime.** Its layout is a bare stack and every
draft reset lives on a screen, so moving the editor to a root route **orphans nothing** and
simplifies the exit to a plain back-navigation — correct by construction rather than by
coincidence.

## Acceptance criteria

- [x] One route serves both create and edit, presented as a **root `transparentModal`** from
      every launch context.
- [x] **The three separate create screens are deleted**; their draft resets move onto the
      editor.
- [x] Both existing entry points — the library's create action and the editor's
      `Add books` — retarget to the single route. The "book picker shared between create and
      edit" problem **dissolves** rather than being solved.
- [x] **J3 — two dead call sites disappear**: the browse row's pencil route, and the
      separate create-flow entry.
- [x] **E5 — back is Cancel.** The header chevron and the hardware/gesture back both leave
      the editor, exactly as the footer's `Cancel` does. Neither steps back through
      anything.
      *A stage-walking version was built and rejected: it made one gesture mean "undo one
      step" three times and then "abandon everything" on the fourth, with nothing on screen
      marking which press you were on.*
- [x] **K5.2 — the editor is a `transparentModal` "matching the book editor", but do NOT
      copy its hardcoded dark literal.** Use a themed value. The route layout currently
      holds three different answers to this question; the book editor's is the wrong one,
      and it is a **live trap** that does not bite today only because the editor is still an
      opaque push.
- [x] **D2 — the destination is `Edit series` with a wrench glyph.** The glyph signals
      *correction*, the word signals *destination*. **`Fix this series` is retired** — it
      presumes breakage on the 98.3% of detected series that are correct, and on every
      hand-made playlist.
- [x] The existing duplicate-name validation is **untouched** and still holds — the edition
      ruling (identity is `name` alone) does not change it. Assert this rather than assume
      it.
- [x] **E6 — empty state copy: `Add books to get started.`**
- [x] No white flash on entry or exit, in either theme.
- [x] Device-verified: every route out of the screen means one thing, from both launch
      contexts.
- [x] `tsc` 0 errors · eslint 0 errors · jest green.

## What this surface is FOR

**E2 — hand-building playlists.** Rescue and delete-and-rebuild still work; they are simply
not what the shape is optimised for. Decided on the **asymmetry of being wrong**: choosing
this shape when the real case is rescue costs +1 press, constant, forever; choosing the
alternative when the real case is a playlist costs ten expand/collapse cycles *and* no
surface that ever shows all candidates at once. Corroborated by volume — the whole rescue
path is **≈7 books in a 350-title library, once**. Playlists are unbounded.

## Answer

**Built on `feature/series-styling`, no worktree.** `tsc` 0 errors · eslint **0 errors**, 35
warnings (baseline; **none in any file this ticket added or touched**) · jest **47 suites /
568 tests** green, up from 47/563. **All twelve criteria are closed**, both device ones on
the `Pixel_7_Pro` emulator (2026-08-10). Record:
`.scratch/series-implementation/DEVICE-CHECK-12.md`; screenshots + the two frame-analysed
recordings in `device-check/tk12-*`.

### Files

**New:** `src/app/seriesEditor.tsx` (the one route — create and edit),
`src/components/SeriesEditorPanel.tsx` (the Authors → Books picker, now a section of the
editor surface rather than two pushed screens).

**Deleted:** `src/app/series/` in its entirety — `_layout.tsx`, `create/authors.tsx`,
`create/books.tsx`, `create/order.tsx` and `edit/[id].tsx`. **The group went with them**, and
that removal is the ticket.

**Changed:** `src/app/_layout.tsx` (the `series` group's `Stack.Screen` replaced by
`seriesEditor`'s, K5's themed `contentStyle`), `src/app/(drawer)/(library)/index.tsx` (create
action retargeted, `handleEditSeries` deleted), `src/components/SeriesDetailSheet.tsx`
(wrench row retargeted), `src/helpers/seriesValidation.ts` + its tests,
`src/store/seriesDraftStore.ts` + its tests, `src/prototypes/SeriesProtoSlot.tsx`,
`src/prototypes/ProtoSeriesDetailSheet.tsx`, `src/prototypes/protoStore.ts`,
`src/prototypes/README.md`.

### What "one route" actually cost, and what it paid for

`id` present is an edit, `id` absent is a create. That single parameter is the whole
mode-switch — it is the route param, the duplicate-check's `excludeId`, the reason
`Delete Series` renders, and the reason the book requirement applies. **Nothing else in the
screen branches on mode.**

The three deleted screens were not three screens' worth of work: `order.tsx` was the
editor's own sortable list on a separate route, and `authors.tsx`/`books.tsx` were the
picker with a name field bolted onto step 2. Once the name lives on the editor, step 2 has
no reason to validate it, and **`seriesBookStepIssues`' `isEdit` flag — the flag that
existed only to decide whose name the picker was checking — deletes itself.** That flag was
the "picker shared between create and edit" problem in code form; §E8's claim that the
problem *dissolves* is literal.

### `seriesEditorIssues` — one gate, and the duplicate rule is asserted, not assumed

The ticket asks for the duplicate-name validation to be *asserted*. Create and edit used to
validate in two functions; they now call one, and the test file runs the same function twice
under headings that name the two passes. Pinned: the rule is case- and whitespace-
insensitive, a series may keep its own name through a rename, the sentence still comes from
the single `duplicateNameIssue` definition shared with `SeriesNameConflictError`, and
`createSeries`/`updateSeries` still call `assertSeriesNameAvailable` underneath — the UI gate
was never the only one.

**The one asymmetry, and it is deliberate:** a create requires ≥1 book, an edit does not.
`updateSeries([])` delegates to `deleteSeries`, which suppresses (A12), so emptying a series
is a real path and blocking it would disable `Save` on the only screen that can reach it.
There is a test whose failure means someone made the requirement unconditional.

**Mutation-proven, three ways.** Making the book requirement unconditional fails exactly 1 of
15; stopping `beginPicker` clearing the author filter fails exactly 1 of 8; making
`appendBookKeys` replace instead of union fails exactly 1 of 8.

### Back is Cancel because there is nothing to step back through

No `BackHandler` implements §E5. A root route has no stages behind it, so hardware back and
the edge gesture pop the editor and land on whatever launched it — the library for a create,
the detail sheet for an edit. The chevron and `Cancel` call the same `leaveEditor`. §J2 is
what makes this safe rather than lucky: the group's layout was a bare `<Stack>` and every
draft reset already lived on a screen, so moving off it orphaned nothing and `exitGroup()`
collapsed to a plain `router.back()`.

**One simplification followed from that.** The old edit screen seeded its draft by draft
IDENTITY rather than per-mount, specifically because the Add-books sub-flow pushed two
screens on top of it and returning must not re-seed over an in-progress draft. That flow no
longer exists, so seeding is a per-mount ref — the screen cannot be re-entered mid-draft any
more.

### `beginPicker`, and why the picker cannot subtract

`+ Add books` clears the author filter (a second pass is a second question) and re-seeds the
staged books from the list you already have, so members read as selected rather than as
candidates. Combined with a union commit, **unticking a book in the picker cannot remove
it** — removal is the editor list's own affordance. That keeps `X` and `+ Add books` true
inverses no matter how many times you open the panel.

### Deliberately NOT done here — read before filing these as defects

1. **§E13 is not met, and 13 owns it.** The candidate pool renders as mapped rows inside the
   editor's `ScrollView`, exactly as the approved prototype did. It is bounded in practice —
   the author step is a volume reducer — but not in principle, and the shipping requirement
   (the pool as the surface's own virtualized list, everything above it a header component)
   is [13](13-editor-picker-panel.md)'s named criterion. This ticket ported the picker at its
   existing fidelity rather than redesigning it; a create against ~350 books will feel it.
2. **The delete exit is still wrong (§K7), and 16 owns it.** It still pops onto the detail
   sheet of the series it just deleted. It is no longer a *white* screen — 11 gave that route
   a themed background and a grab handle — but the destination is still a screen for
   something that does not exist, and popping past it ships with the detection-aware
   save/delete work.
3. **Numbering (14) and series artwork (15) are absent**, as scoped. The editor still has a
   plain name field and an un-numbered sortable list.

### Two small shape calls made during the build

- **A create opens ON the picker; an edit opens on the list.** A fresh create has nothing to
  order, so an editor with an empty list and one button would be a screen whose only move is
  the one it made you find. This is also what makes §E6's empty state reachable the way 13
  describes it — by pressing `X` on a fresh create.
- **One footer, whose right button commits the stage on screen** (`Next` / `Done` / `Save`),
  matching the approved prototype. The panel cannot carry its own commit button: the pool
  runs to tens of rows, so an inline `Next` is below the fold on every pass. `Cancel` on the
  left always means leave.

### Verification short of the device

Metro compiled the full app (`transform.routerRoot=src/app`): the built route table contains
`src/app/seriesEditor.tsx` and **zero** occurrences of `series/create` anywhere in the
26 MB bundle. `.expo/types/router.d.ts` regenerated on its own because a dev server was
running — worth knowing, because without one a new route is a `tsc` error until Metro has
booted once.

### The device run — what not to re-derive

Full record in `.scratch/series-implementation/DEVICE-CHECK-12.md`. Headlines:

- **Both launch contexts reach one route and back returns to the launcher, not through it** —
  library for a create, detail sheet for an edit. §J1's failure is gone: no library exposure,
  no re-presenting sheet. **No `BackHandler` implements this**; a root route has no stages
  behind it.
- **The white-flash check was measured, not eyeballed.** Dark: 44 distinct frames, brightest
  mean 0.1224. Light: 86 distinct frames, **zero flat fills** at σ < 0.03.
- ⚠ **IN LIGHT THEME BRIGHTNESS ALONE CANNOT ANSWER THIS.** The legitimate page measures
  0.876 and the `background` token `#eceff4` measures **0.940**, while an unthemed route
  paints **1.000**. The test is *flat AND brighter than 0.940*. Anyone re-running this with a
  naive "is it bright" check will either miss the bug or invent one.
- **K7's state was reached deliberately** (delete, in light theme) and measured at
  **0.93844 / σ 0.0277** — `#eceff4`, not white. 11's `MissingSeries` holds; the routing half
  of K7 is still 16's.
- ⚠ **K15 was seen immediately and is NOT a regression** — the disabled footer button is a
  blank light rectangle, the same defect the wizard's `Next` and the old `Save` both carried.
  **Ticket 14 owns it.** The enabled state is fine in both themes.
- **`adb pull` can beat `screenrecord` to the file** — the first light recording came back
  with no `moov` atom. Stop with `pkill -INT screenrecord` and sleep before pulling.
- **`cmd uimode night no` does not flip the app's theme**; `themeStore` persists an explicit
  mode and this emulator is saved as `dark`.
