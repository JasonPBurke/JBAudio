# 27 — three more `seriesQueries` write paths read the rows they destroy outside the writer

**Status:** resolved — 2026-08-15, jest 768/768 (61 suites, +5 new, none lost), tsc 0,
eslint 0 errors / 37 warnings (unchanged baseline). All three sites now read inside their
writer, so the file has none left. Not device-verified: no visual surface, and the windows
are races jest reaches and a device run cannot. See the resolution note at the bottom.

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

- [~] **Test first**, per site — **MET AT 2 OF 3 SITES, and the shortfall is recorded rather
      than argued away.** `restoreRemovedSeries` has no red available at all (nothing a
      competing writer can do changes its answer), so its two tests are guards on a
      behaviour-preserving change. The prune's first test was green before the fix and had to
      be repaired. ⚠ **AMENDED 2026-08-15 — the criterion's PREMISE also expired.** It said
      "against the pure seam — the writer itself is not reachable from jest", which was true
      when written and stopped being true under ticket 26's fake `@/db`. Tested at the WRITER
      instead, which is the only place the property exists: see the resolution note.
- [x] Each site either reads inside its writer, or carries a written justification for why a
      stale read cannot change its answer.
- [x] `deleteEmptySeries` cannot reap a series that acquired a member in the window.
- [x] No decision moves *into* the IO layer — `applyPlan`'s "IT MUST NOT MAKE DECISIONS"
      contract binds the whole file.
- [x] jest green · `tsc` 0 errors · eslint 0 errors.

## ⚠ Notes

- ✅ **`src/db/seriesQueries.ts` is plain text again** — the two raw NUL bytes were replaced with
  the `\0` escape under finding 7. `grep`/`rg` read it normally; `--text` is no longer needed.
- ⚠ Opening a writer is not free. `applyPlan` keeps an early return so an unchanged library opens
  no writer and reads nothing; preserve that property wherever the fetch moves inside.
- Never run a formatter over this repo — there is no config file.

---

## Resolution — 2026-08-15

**All three moved inside. Only ONE had a victim, and the ticket was right to demand the check
first — because at one site the move could have CREATED one.**

### `deleteEmptySeries` — the real defect

Both fetches now sit in one writer; `deleteArtworkFiles` stays outside and after, per §K8.

The route is ordinary, not exotic: a scan prunes S's last row, this reads and marks S empty,
and the user taps `Add to series… → S` from a panel that **snapshots its list on tap**
(`AddToSeriesPanel`, ticket 17's device fix — so S stays tappable after the store drops it).
The join commits a row; the reaper destroys S anyway. Cost: the pinned cover is unlinked
**irreversibly** (that is *why* the unlink is after the commit), and the row the join just
created **outlives its series** — the prune keeps it because its book key is live, and
`selectEmptySeriesIds` only looks at series that exist. The user is told "Added to S."

It was also **two separate fetches**, i.e. a torn snapshot even with no competing writer.

### `pruneOrphanedSeriesBooks` — no victim, but a real gain, and one trap

⚠ **A stale read could not make it destroy the WRONG row.** Its only decision input is
`book_key`, written at three `prepareCreate` sites and **never updated**, and the rule is
provenance-blind by ADR 0001. Nothing a competing writer does changes the answer for a row it
already read. The ticket's predicted victim ("a row whose membership changed in the window")
**does not apply here** — that shape is `applyPlan`'s, where the decision *does* read
membership.

What the outside read cost was rows it could not **see**: a join lands a row with an
already-dead key behind the prune's back, and it then dangles until some later, unrelated scan
orphans another book — the trigger is `orphanedBooks.length > 0`, not every scan.

⚠ **AND THE TRAP, which is the reason the ticket's "verify first" rule cuts both ways:
widening what a BLOCKLIST can see is dangerous.** `liveKeys` gaps are orders to DESTROY
(ticket 22), so exposing newly-created rows to it would be a new defect if a row could appear
for a book whose urls are missing from the set. Checked, not assumed: `processDirectoryFiles`
finishes before `removeMissingFiles` fetches `allChapters`, and nothing but a scan inserts
books — so every book that can acquire a row during cleanup already contributed its urls.
**If book insertion ever moves after cleanup, this is what breaks first**, and the header says so.

### `restoreRemovedSeries` — no victim, no red, moved anyway

⚠ **NO RED WAS AVAILABLE, and that is recorded rather than papered over.** Row ids are
immutable and come from a list the user just read; the one thing a competing writer can do
(destroy a row first) leaves our destroy a no-op in both arrangements. The ticket's own
"possibly not worth changing" was correct on the merits. It moved because the alternative was
a standing comment resting on facts in other files with nothing to fail if one changed. Its
two tests are **guards on a behaviour-preserving change** and pass on both sides of it.

### The note about writers not being free

All three keep the property, and all three keep it the same way: **an outer gate that needs no
read.** `restoreRemovedSeries` has `rowIds.length === 0`; the prune and the reaper have their
caller's `orphanedBooks.length > 0` (`scanLibrary.ts:1014`), so an unchanged library never
reaches either. A cheap outside pre-check for `deleteEmptySeries` was considered and
**REJECTED** — a second snapshot is the defect, not the cure.

### Testing

⚠ **CRITERION 1'S PREMISE HAD EXPIRED** (amended above). "The writer itself is not reachable
from jest" stopped being true under ticket 26. It matters: the property here is **not
expressible at a pure seam** — `selectEmptySeriesIds` never sees a window, so no input to it
can distinguish a read taken before one from a read taken after. The defect lives in the
wiring, so the test has to.

Ticket 26's fake is now shared at **`src/db/__tests__/support/fakeDatabase.ts`**, with one
`testPathIgnorePatterns` line in `jest.config.js` (the default `testMatch` treats every file
under `__tests__` as a suite, and a support module holds no tests).

⚠ **A WINDOW TEST GOES VACUOUSLY GREEN IF THE EARLY RETURN FIRES BEFORE THE WRITER OPENS.**
The first prune test passed against the *unfixed* code: with no orphan predating the window,
`orphans.length === 0` returned before `database.write`, so the hook never ran and the row it
was supposed to create never existed. **The hook only fires if a writer actually opens** — the
fixture must guarantee one. Fixed and commented in place.

**2 of the 5 tests fail against the pre-fix source** (verified by stashing `seriesQueries.ts`);
the other 3 are guards and pass on both sides.

### Code review (two axes, 2026-08-15) — both axes found real things

⚠ **THE SPEC AXIS BROKE THE PRUNE'S SAFETY ARGUMENT, and it was right.** My header claimed the
widening is safe because "nothing but a scan inserts books" and a scan's inserts precede its
cleanup. The ordering is real (`scanLibrary.ts:1132` awaits the whole `processDirectoryFiles`
loop before `:1153 removeMissingFiles`), but the conclusion needed a premise I never checked:
**`scanLibrary` has NO re-entrancy guard.** `startScan()` is a progress-store call, not a lock,
and `DrawerContent.tsx:126` + `useScanExternalFileSystem.tsx:19` both invoke it **unawaited**.
Two overlapping scans break "nothing but a scan inserts books" outright. The header now states
the assumption instead of asserting the conclusion, and the hazard is raised as **ticket 30**.

⚠ **"Verify each one has a victim first" is a rule about the FIX as much as the defect.** Two
sites had no victim and were changed anyway — **a driver decision, taken before any code was
written**, on the grounds that a justification for reading outside must keep resting on facts
in other files while the move rests on nothing. The spec axis correctly logged it as scope
beyond what the ticket asked for.

⚠ **A SHARED FAKE'S GUARD MUST NOT LIVE IN A CONSUMER.** The clause-shape test sat in
`addBookToSeries.test.ts`; once a second suite used the fake, deleting that file would have
taken the harness's only defence with it, silently. Moved to `fakeDatabase.test.ts` — the same
ruling `harnessBoundary.test.ts` already encodes (*keep the rule inside the directory it
governs so the rule and its subject are removed together*), and it now also pins the two
`batch` guards and the double-prepare invariant. `matchesClauses` carries a pointer to it.

⚠ **THREE COPIES OF AN ARGUMENT HAD ALREADY DRIFTED BEFORE THE COMMIT.** Source header, test
header and this ticket each carried the blocklist and snapshot arguments; the test cited
`scanLibrary.ts:998-1007` (the comment ABOVE the gate) where the others cited the gate itself
at `:1014`. In a repo that cites `Model:104` precisely, that is the drift starting. The test
headers now state the claim in one line and point at the source header.

Also applied: `testPathIgnorePatterns` broadened from one directory to `/__tests__/support/`
(the next support module now just works, and the error it prevents names neither the file nor
the rule); `pinned` renamed `pinnedArtwork` to match `deleteSeries`' sibling idiom.

**Not changed:** `FakeRecord` stays exported — it is the return type of `seed()` and `rowsIn()`,
so it is public surface even though no consumer names it. **Confirmed by the spec axis:**
`settingsQueries.ts`'s inlined prune already fetches inside its writer (`:279`), so the
ticket was right to omit it; and §K8 still holds — if the writer throws, `deleteArtworkFiles`
never runs.
