# 26 — `addBookToSeries` writes back rows it read outside the transaction

**Status:** resolved — 2026-08-15, jest 763/763 (60 suites, +7 new in one new suite, none
lost), tsc 0, eslint 0 errors / 37 warnings (unchanged baseline). Not device-verified: the
fix has no visual surface and the window it closes is a race, so there is nothing a device
run could show that jest does not. See the resolution note at the bottom.

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

- [x] **Test first.** A test showing a join that does not resurrect a row deleted between the
      two reads, and does not un-tombstone a row excluded between them. Watch it fail.
- [x] `planSeriesJoin` and `planEditorSave` stay pure and stay the only decision-makers —
      `updateSeries` must still make no decisions.
- [x] A join still restores a tombstone to its slot with its remembered number, and still
      carries every other book's number (tickets 17 and 23).
- [x] The header comment at `addBookToSeries` is corrected: the risk is write-back, not
      staleness.
- [x] jest green · `tsc` 0 errors · eslint 0 errors.

## ⚠ Notes

- ✅ **`src/db/seriesQueries.ts` is plain text again** — the two raw NUL bytes were replaced with
  the `\0` escape under finding 7 (2026-08-14). `grep`/`rg` read it normally; `--text` is no
  longer needed. This note previously said the opposite.
- See also **ticket 27**: three more write paths in this same file read outside their writer.
  `applyPlan`'s was closed under finding 11 and is the pattern to reuse here.
- Never run a formatter over this repo — there is no config file.

---

## Resolution — 2026-08-15

**The shape: what goes into the writer is a DECIDER, not a set of rows.**

`writeSeriesSave(id, decide)` in `seriesQueries.ts` is the one writer. It opens `database.write`,
reads the series and its rows ONCE, and hands them to a caller-supplied pure function that
returns what the series should look like. `planEditorSave` then runs on the same rows. The
two doors are two deciders over that one writer:

- `updateSeries` ignores the rows and passes its arguments straight through — the editor's
  list IS the decision, made by a user looking at it.
- `addBookToSeries` calls `planSeriesJoin` on the rows the writer just read, and returns null
  when the book is already a member, which commits nothing.

The header's rejected alternative — "a second entry point into the write path that takes
pre-read rows" — is still rejected, and for the reason it gave. Passing a decider in is the
opposite direction: nothing crosses the boundary that could be stale.

**What jest holds.** `src/db/__tests__/addBookToSeries.test.ts`, over a fake `@/db`
(precedent: `seriesBackgroundsSetting.test.ts` — the LokiJS adapter leaves an interval alive
that stops jest exiting). The fake's `write()` fires a one-shot hook at writer-open, which is
exactly where a competing writer lands: WatermelonDB serializes writers, so a scan's prune
either commits before ours opens or after we commit. Both halves were watched failing against
the pre-fix source:

- a row pruned in the window came back as a `membership: 'user'` insert;
- a row tombstoned in the window had its `'excluded'` flipped back to `'user'`.

⚠ **The fake THROWS on any query clause it does not understand.** A fake that answers an
unrecognised query by returning everything is worse than no fake — `assertSeriesNameAvailable`
queries `series` by `sort_name`, and a fake that ignored that clause would have answered it
wrongly and silently. There is also a test pinning the clause shape against the real `Q`,
because a renamed `left`/`right` would filter everything out and turn every test in the file
green for the wrong reason.

⚠ **`addBookToSeries` no longer calls `assertSeriesNameAvailable`, deliberately.** A join
passes the stored name back unchanged, so there is no new name to claim — and asserting it
would mean a read outside the writer, which is the thing this door no longer does.

⚠ **The no-op is now a real one, not an incidental one.** Before, `planSeriesJoin` returning
null meant no writer ever opened. Now the writer opens first and the decider returns null
inside it, so "writes nothing" had to be made true and is pinned by a test (rows unchanged,
and the series' `updated_at` untouched).

⚠ **Ticket 27's three remaining sites are NOT fixed by this.** `writeSeriesSave` is the
pattern for them, alongside `applyPlan`'s.

### Code review (two axes, 2026-08-15) — 9 findings, 8 applied, 1 rejected

**Spec axis: clean.** All five criteria met; it re-ran the new suite at HEAD in a throwaway
worktree and independently confirmed 2 of 7 fail pre-fix. One item flagged as unrequested
scope: dropping `assertSeriesNameAvailable` from the join door (disclosed above, driver's eye
welcome).

**Standards axis: the fake was the finding.** Four fidelity gaps against the real
WatermelonDB, all verified in `node_modules` before being applied — ⚠ **a fake that guards
something the library PERMITS is exactly as wrong as one that lets through something it
forbids, and the failure points the other way** (green here, crash on device, or vice versa):

- `Model.prepareDestroyPermanently` invariants on `!_preparedState` (`Model:199`) and sets
  `_raw._status = 'deleted'` (`Model:201`) — the fake did neither.
- `Database.batch` throws on a record with no prepared state (`Database:93-95`) — the fake
  silently skipped it.
- `Database.batch` calls `_ensureInWriter` (`Database:83`) — the fake tracked no writer at all.
- `@text` SANITIZES on set (`value.trim()`, non-strings → null); `@field`/`@date` do not.

⚠ **The review cited `Model/index.js:199` and my first check said the invariant was not
there** — the grep window started at line 200, one line below it. The claim was right.
**Do not refute a cited line number with a grep whose window you did not verify covers it.**

⚠ **The real coverage gap it found: only ONE of the two deciders was driven.** The fix moved
`updateSeries`' whole body into `writeSeriesSave`, and nothing exercised the editor door
through it — so A13's suppression clear and the pre-writer name assertion were untested
across a refactor that moved them. Two tests added; both would have passed pre-fix, which is
the point.

**Rejected, with reason: "`SeriesSaveRequest` was born but not adopted at the public door"**
(Data Clumps — `updateSeries` still takes four positionals). Correct as an observation, but
changing that signature touches `seriesEditor.tsx`, and `visibleBookKeys` carries ticket 21's
load-bearing doc comment on the parameter. Real risk, no benefit to this ticket. If it is ever
done, do it with ticket 27, not here.
