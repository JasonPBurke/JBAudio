# 25 — A series whose files have all gone missing cannot be saved, only deleted

**Status:** needs-triage — **this asks the driver to revisit a driver ruling, so it is not
`ready-for-agent`.**

**Source:** [Code review of tickets 21+23](../CODE-REVIEW-d2195ed.md), reported while reviewing
the fix for [21](21-editor-save-tombstones-dangling-rows.md). Mechanism verified.

## The defect

`seriesEditorIssues` refuses a save with `bookCount === 0` and tells the user
*"Add at least one book, or use Delete Series to remove it."*

`bookCount` is `orderedBookKeys.length` (`seriesEditor.tsx`), seeded from `visibleKeysOf(series)`
— the books that **resolve against the live library**. So a series whose files are *all*
temporarily unresolvable reports zero books:

- an SD card unmounted,
- a folder mid-move,
- a rescan that has not caught up.

`scanLibrary` treats exactly that state as legitimate and expected — its orphan prune is gated
on `orphanedBooks.length > 0` precisely so a moved file's rows survive until a scan proves the
book is gone. Ticket 21 went to some length to stop `Save` destroying those rows.

**The result:** the user cannot even rename the series, and the only action the message names is
`Delete Series`, which permanently destroys every membership row and writes A12's suppression.
A fully recoverable state is being steered toward the irreversible action.

## ⚠ Why this is not `ready-for-agent`

**The unconditional book requirement is a DRIVER RULING made on device on 2026-08-13** (ticket
16). It replaced an edit-mode exemption under which emptying a series and pressing `Save`
performed an unconfirmed destroy — K7 through the other door. The rationale is written out at
`seriesValidation.ts:48`, and A14's *bulk creates, per-item destroys* stands behind it.

Any fix here re-opens that ruling, so it needs the driver, not an agent.

## Directions, for that conversation

1. **Distinguish the two empties.** The screen already knows: an empty draft where
   `series.books` is empty AND the series has membership rows is *"nothing resolves"*, not
   *"the user removed everything"*. Validation would need that fact threaded in.
2. **Or gate the message, not the save.** Allow a rename when the list is empty only because
   nothing resolved, and keep refusing a save that would empty a resolvable series.
3. **Or say something truer.** Even leaving the refusal in place, pointing a user at
   `Delete Series` when their SD card is unmounted is the wrong sentence.

Do **not** simply drop the `bookCount === 0` check — that restores the unconfirmed destroy.

## ⚠ Notes

- Never run a formatter over this repo — there is no config file.
