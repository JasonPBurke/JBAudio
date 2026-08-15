# 30 — `scanLibrary` has no re-entrancy guard, and two callers invoke it unawaited

**Status:** needs-triage

**Source:** Raised by the **spec axis of ticket 27's code review**, 2026-08-15, while checking
whether moving `pruneOrphanedSeriesBooks`' fetch inside its writer was safe. It is not a series
defect — it sits under the whole scan — but a series write path is where it turns destructive,
which is why it was found here.

⚠ **No user report backs this.** It is a mechanism found by reading, and the triage question is
whether it is reachable often enough to be worth a lock. See *What would settle it*.

## The mechanism

`scanLibrary` (`src/helpers/scanLibrary.ts:1069`) has **no guard against a second call while one
is running**. `useScanProgressStore.getState().startScan()` at `:1092` is a progress indicator,
not a lock — it sets UI state and returns. Two of the three callers do not await:

| Caller | |
| --- | --- |
| `src/components/DrawerContent.tsx:126` | `scanLibrary();` — **unawaited** |
| `src/hooks/useScanExternalFileSystem.tsx:19` | `scanLibrary();` — **unawaited** |
| `src/helpers/directoryPicker.ts:38` | `await scanLibrary();` |

So a user who taps `Scan` twice, or taps it while an external-filesystem scan is starting, gets
two overlapping runs. Each holds its own snapshot and neither knows about the other.

## Why it matters, and where it bites hardest

**Every phase of a scan's cleanup reasons from a snapshot it took earlier.** `allChapters` is
fetched at `:916`, `liveKeys` is derived from it at `:1015`, and `orphanedBooks` at `:957`. All
of them are *stale with respect to a concurrent scan's inserts*, because scan B's
`processDirectoryFiles` is adding books that scan A's snapshot has never heard of.

The sharpest consequence is at the orphan prune. ⚠ **`liveKeys` is a BLOCKLIST (ticket 22): every
gap in it is an order to DESTROY, not a harmless miss.** A book inserted by scan B contributes
no urls to scan A's `liveKeys`, so any `series_books` row that exists for it when A's prune runs
is an orphan as far as A is concerned — and gets destroyed.

⚠ **Ticket 27 made that reachable where it previously was not**, and knowingly:
`pruneOrphanedSeriesBooks` now fetches inside its writer, so it sees rows created after its
caller's snapshot. Within one scan that is exactly the fix (it closes a dangling-row gap). With
two scans it widens what a stale `liveKeys` can reach. The header says so in writing rather than
claiming safety it cannot prove.

## What would settle it

1. **Is it reachable in practice?** Tap `Scan` in the drawer twice in quick succession on a real
   library and see whether two runs interleave, or whether something upstream already serialises
   them. ⚠ The progress UI will look like ONE scan either way — `startScan()` is idempotent —
   so the progress indicator is not evidence. Instrument the entry point.
2. **Does anything else already prevent it?** Check whether the drawer button disables itself
   while `useScanProgressStore` reports a scan in flight. If it does, the drawer route is closed
   and only the external-filesystem hook remains.

## The likely fix, if triage says yes

A module-level in-flight promise in `scanLibrary`: a second call returns the first's promise
rather than starting a run. That is one variable and it makes every snapshot argument in the
file true again.

⚠ **Do NOT "fix" it by reverting ticket 27's prune change.** That closes one route to one
consequence and leaves the cause — a concurrent scan's stale `orphanedBooks` and `liveKeys` are
wrong regardless of where the prune reads.

⚠ `booksWithCoverExtracted.clear()` at `:1070` is module-level state cleared on entry, so a
second scan already stamps on the first one's dedupe set today. Independent of the DB question
and probably the cheapest confirmation that overlap is real.

## ⚠ Notes

- Never run a formatter over this repo — there is no config file.
- `src/db/seriesQueries.ts` is plain text; `rg --text` is no longer needed.
