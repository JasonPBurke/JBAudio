# 27 — three more `seriesQueries` write paths read the rows they destroy outside the writer

**Status:** ready-for-agent

**Source:** Raised while fixing **finding 11** of the
[code review vs d2195ed](../CODE-REVIEW-d2195ed.md), 2026-08-14. The finding named `applyPlan`
alone and justified itself with *"Every other write path in the file reads inside its writer"* —
**that claim is false**, and checking it is what produced this ticket.

## The actual distribution

WatermelonDB serializes **writers**, not readers. A fetch outside `database.write` can therefore
be overtaken by another writer before the batch lands, and any model instance or decision derived
from it is stale by the time it is executed.

| Function | reads | writes | |
| --- | --- | --- | --- |
| `updateSeries:163` | `:187` | `:182` | inside ✓ |
| `deleteSeries:443` | `:451`, `:463` | `:445` | inside ✓ |
| `applyPlan:715` | `:778` | `:733` | **inside ✓ — fixed under finding 11** |
| `addBookToSeries:292` | `:300` | later | **outside** — ticket 26 |
| `restoreRemovedSeries:645` | `:653` | `:656` | **outside** |
| `pruneOrphanedSeriesBooks:820` | `:823` | `:826` | **outside** |
| `deleteEmptySeries:841` | `:842`, `:846` | `:856` | **outside** |

So reading outside was the file's *dominant* pattern for bulk work, not an outlier. Two sites are
now closed (`applyPlan` here, `addBookToSeries` under 26); **three remain**.

## Why this is not automatically a bug at each site

⚠ **Do not "fix" all three by reflex — verify each one has a victim first.** The three differ in
how much a stale read can cost:

- **`pruneOrphanedSeriesBooks`** — feeds `selectOrphanedMemberships`, whose input is a
  **superset** live-key set by design (ticket 22). A row created in the window is absent from the
  fetch and simply survives to the next scan. A row whose membership changed in the window,
  however, is destroyed on a decision taken before the change — the same shape finding 11 fixed,
  and the one to check hardest, because this is the site that already cost a cycle.
- **`deleteEmptySeries`** — decides emptiness from a snapshot. A series that gains its first
  membership row in the window is reaped as empty, taking its pinned artwork with it
  (`deleteArtworkFiles`). ⚠ §K8: the unlink runs after the commit, so it cannot be undone by the
  transaction.
- **`restoreRemovedSeries`** — operates on ids the user just chose off a list; the window is a
  user tap. Lowest risk of the three, and possibly not worth changing.

## What to build

Per site, in the order above. For each: establish whether a concurrent writer can change the
answer, and only then move the read.

The pattern finding 11 established, and the one to reuse:

1. Move the fetch **inside** `database.write`.
2. Where a decision predates the fetch, have the plan carry the state it was taken against and
   **compare before destroying** — see `PlannedRemoval.expectedMembership` and
   `selectPlannedRemovals` in `seriesReconcile.ts`.
3. Keep the rule in a **pure seam** so jest can watch it. `selectPlannedRemovals` and
   `selectOrphanedMemberships` are the precedent; the IO layer supplies rows and an accessor and
   executes the answer.

## Acceptance criteria

- [ ] **Test first**, per site, against the pure seam — the writer itself is not reachable from
      jest (no RN preset, no SQLite adapter).
- [ ] Each site either reads inside its writer, or carries a written justification for why a
      stale read cannot change its answer.
- [ ] `deleteEmptySeries` cannot reap a series that acquired a member in the window.
- [ ] No decision moves *into* the IO layer — `applyPlan`'s "IT MUST NOT MAKE DECISIONS"
      contract binds the whole file.
- [ ] jest green · `tsc` 0 errors · eslint 0 errors.

## ⚠ Notes

- ✅ **`src/db/seriesQueries.ts` is plain text again** — the two raw NUL bytes were replaced with
  the `\0` escape under finding 7. `grep`/`rg` read it normally; `--text` is no longer needed.
- ⚠ Opening a writer is not free. `applyPlan` keeps an early return so an unchanged library opens
  no writer and reads nothing; preserve that property wherever the fetch moves inside.
- Never run a formatter over this repo — there is no config file.
