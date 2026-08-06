# 12 — The editor becomes one route, and the wizard stops being a wizard

**Blocked by:** [11](11-series-detail-sheet.md) — the `Edit series` row is what reaches it
once the browse row's pencil route is gone.

**Status:** ready-for-agent

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

- [ ] One route serves both create and edit, presented as a **root `transparentModal`** from
      every launch context.
- [ ] **The three separate create screens are deleted**; their draft resets move onto the
      editor.
- [ ] Both existing entry points — the library's create action and the editor's
      `Add books` — retarget to the single route. The "book picker shared between create and
      edit" problem **dissolves** rather than being solved.
- [ ] **J3 — two dead call sites disappear**: the browse row's pencil route, and the
      separate create-flow entry.
- [ ] **E5 — back is Cancel.** The header chevron and the hardware/gesture back both leave
      the editor, exactly as the footer's `Cancel` does. Neither steps back through
      anything.
      *A stage-walking version was built and rejected: it made one gesture mean "undo one
      step" three times and then "abandon everything" on the fourth, with nothing on screen
      marking which press you were on.*
- [ ] **K5.2 — the editor is a `transparentModal` "matching the book editor", but do NOT
      copy its hardcoded dark literal.** Use a themed value. The route layout currently
      holds three different answers to this question; the book editor's is the wrong one,
      and it is a **live trap** that does not bite today only because the editor is still an
      opaque push.
- [ ] **D2 — the destination is `Edit series` with a wrench glyph.** The glyph signals
      *correction*, the word signals *destination*. **`Fix this series` is retired** — it
      presumes breakage on the 98.3% of detected series that are correct, and on every
      hand-made playlist.
- [ ] The existing duplicate-name validation is **untouched** and still holds — the edition
      ruling (identity is `name` alone) does not change it. Assert this rather than assume
      it.
- [ ] **E6 — empty state copy: `Add books to get started.`**
- [ ] No white flash on entry or exit, in either theme.
- [ ] Device-verified: every route out of the screen means one thing, from both launch
      contexts.
- [ ] `tsc` 0 errors · eslint 0 errors · jest green.

## What this surface is FOR

**E2 — hand-building playlists.** Rescue and delete-and-rebuild still work; they are simply
not what the shape is optimised for. Decided on the **asymmetry of being wrong**: choosing
this shape when the real case is rescue costs +1 press, constant, forever; choosing the
alternative when the real case is a playlist costs ten expand/collapse cycles *and* no
surface that ever shows all candidates at once. Corroborated by volume — the whole rescue
path is **≈7 books in a 350-title library, once**. Playlists are unbounded.
