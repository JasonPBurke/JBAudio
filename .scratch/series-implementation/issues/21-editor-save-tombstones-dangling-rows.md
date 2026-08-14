# 21 — Editor Save must not tombstone rows the user could never see

**Status:** resolved — jest 721/721, tsc 0, eslint 0. Not yet device-verified.

**Source:** [Code review `d2195ed..HEAD`](../CODE-REVIEW-d2195ed.md), Finding 1 — CONFIRMED.

**⚠ Do this in the same pass as [23](23-tombstone-restore-slot-stale.md).** Both live in
`planEditorSave` and both turn on what "removed" means. Fixing them separately means fixing
the same function twice with two sets of tests, and 23's fix is only correct once 21's rule
is in place.

## The defect

Any editor Save writes an `'excluded'` tombstone over every `series_books` row whose
`bookKey` did not resolve against the live library — and detection then never puts the book
back. **Silent, permanent data loss.**

## Why it happens — all six links verified

1. `src/helpers/scanLibrary.ts:1000` — dangling rows are a **deliberate, expected** state.
   The prune is gated on `orphanedBooks.length > 0`, and the comment reads: *"A dangling row
   is harmless in the meantime — `assembleDerivedSeries` skips keys it cannot resolve — and
   this is deliberate... Do not 'fix' it by pruning unconditionally."*
2. `src/helpers/seriesAssembly.ts:96` — *"Membership keys that don't resolve against the
   live library are silently skipped (graceful skip)."*
3. `src/app/seriesEditor.tsx:440` seeds `orderedBookKeys` from `series.books` — the
   **post-skip resolved list**. A dangling book is not in it.
4. `src/db/seriesQueries.ts:178` passes **all** rows for the series as `existing`,
   unfiltered — dangling rows included.
5. `src/db/seriesEditorSave.ts:108` (`nextMembership`) returns `'excluded'` for any existing
   row not in `desired`.
6. `src/db/seriesReconcile.ts:353` builds `settledKeys` from `match.books` — **tombstones
   included** — and filters with `!settledKeys.has(...)`. Detection never re-inserts.

## The trigger

A book's file moves, so its row dangles. The scan-side prune does **not** run every scan (it
is gated on `orphanedBooks.length > 0`), so the row legitimately sits there. The user opens
that series in the editor, changes nothing or changes something unrelated, presses **Save** —
and the book is gone from the series forever, even after the file returns.

## What to build

Give `planEditorSave` the **visible universe** as an input, so it can tell *"the user removed
this"* from *"the user could never see this."*

The rule to encode: **you may only remove what you could see.** A row outside the visible set
must be left untouched (`nextMembership` returns `undefined`).

## Acceptance criteria

- [x] **Test first.** A failing test in `src/db/__tests__/seriesEditorSave.test.ts` showing
      a row absent from both the desired list *and* the visible set is **not** tombstoned.
      Watch it fail before writing the fix. The existing `save()` helper at the top of that
      file is the shape to extend.
- [x] A row absent from `desired` but **present** in the visible set is still tombstoned —
      the A11 behaviour in the existing `describe('A11 — a removed book leaves a tombstone')`
      block must not regress.
- [x] The plan still contains **no destructive verb** — `Save` may never delete a series and
      never emits `removeRows`. This is a standing driver ruling; the existing
      `describe('there is no verb here that destroys anything')` block guards it.
- [x] `src/app/seriesEditor.tsx` supplies the visible set from the same source it seeds
      `orderedBookKeys` from, so the two cannot disagree.
- [x] `updateSeries` stays **IO only** — it makes no decisions (its own header at
      `seriesQueries.ts:156` says so). Do **not** filter inside `updateSeries`: the DB layer
      has no access to the library book map, so that would be the wrong layer.
- [x] `planSeriesJoin` reads rows straight from the DB and does **not** have this bug —
      confirm the two doors now agree rather than assuming it.
- [x] jest green (**711/711** at review time — this ticket adds tests and must lose none).
- [x] `tsc` 0 errors · eslint 0 errors (~40 warnings is the pre-existing baseline).

## ⚠ Notes

- Do **not** "fix" this by pruning dangling rows eagerly. ADR 0001 and the scanLibrary
  comment both rule that out explicitly, and the prune's gating is load-bearing.
- Never run a formatter over this repo — there is no config file.

---

## Resolution

`planEditorSave` takes a fifth input, `visibleKeys` — the universe the caller's surface could
actually render. `nextMembership` now returns `undefined` for any row that is in neither
`desired` nor `visible`, so a dangling row is left **entirely** alone: no membership change, and
(per [23](23-tombstone-restore-slot-stale.md)) no position change either.

The set is threaded, never derived:

- `seriesEditor.tsx` — `visibleKeysOf(series)`, one module-level function, called **once** in the
  seeding effect. The array it returns is both what seeds `orderedBookKeys` and what is stored in
  the `visibleAtSeed` ref for `Save`, so the two are the same object and cannot drift.
- `seriesQueries.updateSeries` — a required 5th parameter, passed straight through. **No filtering
  was added there**; it still makes no decisions.
- `addBookToSeries` — from `planSeriesJoin`, which now returns the `visibleKeys` it already
  computed rather than letting the caller derive a second, disagreeing set.

### ⚠ The set is FROZEN at seed time, not re-read at save time

Re-reading the live `series` on `Save` reopens this very defect through a back door, in both
directions, and both were found while implementing rather than by the review:

- the moved file **comes back** mid-edit → the book re-enters `series.books` but was never in the
  user's draft, so it would be tombstoned for never having appeared in a list it was never offered
  in — this ticket's exact defect, one rescan later;
- a scan **drops** a book mid-edit that the user had just removed → it leaves the visible set, so
  their removal would be silently discarded.

The question `visibleKeys` answers is *what was the user shown*, and that was settled once.

### The two doors agree

Confirmed rather than assumed. `planSeriesJoin` builds `desiredKeysInOrder` from every non-excluded
row, so `desired ⊇ visible` and the join door **structurally cannot** tombstone anything — dangling
rows included. Pinned by `a join leaves the same rows an editor save of the same list would`.

### ⚠ Residual, out of scope and NOT introduced here

A scan that **adds** a book to the series mid-edit still has it tombstoned by the next `Save` (it
is in `visible` at seed time only if the seed ran after the scan). Pre-existing, unchanged by this
work, and the same shape as the two races above — worth its own ticket.
