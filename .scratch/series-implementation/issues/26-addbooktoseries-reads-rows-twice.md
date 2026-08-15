# 26 — `addBookToSeries` writes back rows it read outside the transaction

**Status:** ready-for-agent

**Source:** [Code review of tickets 21+23](../CODE-REVIEW-d2195ed.md). Mechanism verified by
reading the code. **Pre-existing** — not introduced by 21/23, and the double read is
acknowledged in `addBookToSeries`' own header.

## The defect

`addBookToSeries` (`src/db/seriesQueries.ts`) reads this series' `series_books` rows **outside
any transaction**, hands them to `planSeriesJoin`, and then calls `updateSeries`, which re-reads
the same rows **inside** `database.write`.

Everything the join decided — `desiredKeysInOrder`, `canonicalNumbers`, and now `visibleKeys` —
comes from the **first** read. So a row that changed in the window between the two reads is
written back from stale state:

- a row **pruned** by `pruneOrphanedSeriesBooks` in that window is still in
  `desiredKeysInOrder` but absent from the second `existing`, so `computeMembershipDiff` emits
  it as `toCreate` — the book is **resurrected** with `membership: 'user'`, which reconcile will
  never reclaim (regeneration only takes a `'detected'` row back);
- a row **tombstoned** in that window is in `desired`, so `nextMembership` flips it back to
  `'user'` — the removal is **undone**.

The existing header comment frames the double read's risk as staleness only ("it is one series'
membership on a user tap"), not as write-back of stale rows. That framing is what makes this
easy to walk past.

## The window

A user tap racing a background scan. Small, but `pruneOrphanedSeriesBooks` and `reconcileSeries`
both run off scans, and a scan landing mid-tap is the exact race the header already contemplates.

## What to build

Close the window rather than narrow it: the read that feeds `planSeriesJoin` and the write that
applies its plan must see the same snapshot.

The header rejects "a second entry point into the write path that takes pre-read rows" on the
grounds that it can be handed stale ones — which is precisely the bug. The shape that satisfies
both is to plan **inside** the transaction, not to pass rows into it.

## Acceptance criteria

- [ ] **Test first.** A test showing a join that does not resurrect a row deleted between the
      two reads, and does not un-tombstone a row excluded between them. Watch it fail.
- [ ] `planSeriesJoin` and `planEditorSave` stay pure and stay the only decision-makers —
      `updateSeries` must still make no decisions.
- [ ] A join still restores a tombstone to its slot with its remembered number, and still
      carries every other book's number (tickets 17 and 23).
- [ ] The header comment at `addBookToSeries` is corrected: the risk is write-back, not
      staleness.
- [ ] jest green · `tsc` 0 errors · eslint 0 errors.

## ⚠ Notes

- ✅ **`src/db/seriesQueries.ts` is plain text again** — the two raw NUL bytes were replaced with
  the `\0` escape under finding 7 (2026-08-14). `grep`/`rg` read it normally; `--text` is no
  longer needed. This note previously said the opposite.
- See also **ticket 27**: three more write paths in this same file read outside their writer.
  `applyPlan`'s was closed under finding 11 and is the pattern to reuse here.
- Never run a formatter over this repo — there is no config file.
