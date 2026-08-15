# 30 — `scanLibrary` has no re-entrancy guard, and two callers invoke it unawaited

**Status:** resolved

**Source:** Raised by the **spec axis of ticket 27's code review**, 2026-08-15, while checking
whether moving `pruneOrphanedSeriesBooks`' fetch inside its writer was safe. It is not a series
defect — it sits under the whole scan — but a series write path is where it was first noticed,
which is why it was filed here.

**Triaged:** 2026-08-15. Category `bug`, state `ready-for-agent`. The original body asked for
device verification before deciding; triage traced the code instead and found the mechanism is
both reachable by three routes and worse than first written up. Body rewritten in place, brief
attached at the bottom. What changed and why is recorded under *Triage log*.

## The mechanism

`scanLibrary` (`src/helpers/scanLibrary.ts`, `export async function scanLibrary`) has **no guard
against a second call while one is running**. `useScanProgressStore.getState().startScan()` is a
progress indicator, not a lock — it sets UI state and returns. Two of the three callers do not
await:

| Caller | |
| --- | --- |
| `src/components/DrawerContent.tsx` — `Rescan Library` row | `scanLibrary();` — **unawaited** |
| `src/hooks/useScanExternalFileSystem.tsx` | `scanLibrary();` — **unawaited** |
| `src/helpers/directoryPicker.ts` | `await scanLibrary();` |

So a user who taps `Scan` twice, or taps it while an external-filesystem scan is starting, gets
two overlapping runs. Each holds its own snapshots and neither knows about the other.

## Reachability — three open routes, confirmed by reading

1. **Drawer double-tap.** The `Rescan Library` `DrawerRow` has **no `disabled` prop** and nothing
   gates it on `useScanProgressStore.isScanning`. The store's only consumer is `Header.tsx`, for
   rendering. The row closes the drawer on press, so this needs a quick double-tap — but a
   double-tap is one gesture, and the user can also reopen the drawer mid-scan and tap again,
   because the row shows no in-flight state.
2. **The external-filesystem hook's freshness window is blind to an in-flight scan.**
   `useScanExternalFileSystem` reads `getLastScanAt()` at entry and bails inside a 30-minute
   window — but `setLastScanAt` is written only at the **end** of `scanLibrary`. While a scan is
   running, `lastScanAt` still holds the *previous* scan's value, so the window does not see it.
   On a cold start (last scan > 30 min ago) any re-run of that effect starts a second scan.
3. **Cross-route, and the most likely in practice.** The hook defers its first scan to
   `requestIdleCallback` + 500 ms after audio permission is granted. A user who opens the drawer
   and taps `Rescan` inside that window gets two runs, having done nothing unusual.

`directoryPicker` awaits, but nothing stops the user tapping `Rescan` while a folder-add scan runs.

## Why it matters — three consequences, in severity order

**Every phase of a scan's cleanup reasons from a snapshot it took earlier**, and those snapshots
are stale with respect to a concurrent scan's inserts.

### 1. A just-imported book is permanently destroyed ⚠ worst, and not in the original write-up

`removeMissingFiles` derives orphans from **two separately-fetched snapshots**: `allChapters`
first, then `allBooks` roughly forty lines later, with `await`s in between. A book that scan B
inserts *between those two fetches* lands in scan A's `allBooks` but contributes no chapters to
A's `liveBookIds` — so A classifies it as orphaned and `prepareDestroyPermanently()` destroys it.

⚠ Note the asymmetry that makes this survive a casual read: the `fileSet.has(chapter.url)` guard
protects **chapters** from removal even when they came from another scan, but it does **nothing**
for the book-orphan derivation, which is a pure set-difference over the two snapshots. Reading
the chapter guard and concluding the function is safe against foreign inserts is the trap.

(Whether B's freshly-inserted chapters are cascaded with the book or left dangling depends on
WatermelonDB's `prepareDestroyPermanently` cascade semantics — worth confirming during the fix,
but the book loss holds either way and is the headline.)

### 2. Duplicate books

Each scan takes its own `existingUrls` snapshot *before* processing. Two scans starting close
together both see the same set, both conclude the same files are new, and both insert them.
⚠ **WatermelonDB has no unique constraints**, so nothing downstream catches it.

### 3. Series membership rows destroyed

⚠ **`liveKeys` is a BLOCKLIST (ticket 22): every gap in it is an order to DESTROY, not a harmless
miss.** A book inserted by scan B contributes no urls to scan A's `liveKeys`, so any `series_books`
row that exists for it when A's prune runs is an orphan as far as A is concerned — and is
destroyed.

Consequence 1 also *feeds* consequence 3: destroying B's book flips A's `orphanedBooks.length > 0`
gate to true, which is the scan's whole trigger for touching series at all. A scan that would
otherwise never have pruned now prunes, using a `liveKeys` set that has never heard of any of B's
books.

⚠ **Ticket 27 made consequence 3 reachable where it previously was not**, and knowingly:
`pruneOrphanedSeriesBooks` now fetches inside its writer, so it sees rows created after its
caller's snapshot. Within one scan that is exactly the fix (it closes a dangling-row gap). With
two scans it widens what a stale `liveKeys` can reach. The header comment on that function says
so in writing rather than claiming safety it cannot prove — see the `⚠ IT ASSUMES NO CONCURRENT
SCAN` block, which this ticket discharges.

## Confirming overlap on a device, if you want to see it

⚠ **The original body claimed the progress UI "will look like ONE scan either way — `startScan()`
is idempotent". That is wrong, and it inverts the cheapest available signal.** `startScan()` sets
`processedBooks: 0, totalBooks: 0` unconditionally. So:

- A second scan makes the visible progress counter **jump backwards to zero mid-scan**.
- Whichever run finishes first calls `endScan()` and **hides the indicator while the other is
  still writing to the database**.

Both are visible in the existing UI with zero instrumentation. That is a better probe than the
`booksWithCoverExtracted` idea, and the second bullet is itself a user-facing bug the guard fixes.

⚠ `booksWithCoverExtracted.clear()` at the top of `scanLibrary` is module-level state cleared on
entry, so a second scan already stamps on the first one's cover-dedupe set today, independent of
the DB question. The guard fixes this for free.

## ⚠ Do not

- ⚠ **Do NOT "fix" it by reverting ticket 27's prune change.** That closes one route to one
  consequence and leaves the cause — a concurrent scan's stale `orphanedBooks`, `existingUrls` and
  `liveKeys` are wrong regardless of where the prune reads.
- ⚠ **Do NOT tidy up the two guards above the prune in `removeMissingFiles`** (missing-root skip,
  empty-enumeration skip). Both are load-bearing and documented as such in place.
- Never run a formatter over this repo — there is no config file.
- `src/db/seriesQueries.ts` is plain text; `rg --text` is no longer needed.

---

## Agent Brief

> *This was generated by AI during triage.*

**Category:** bug
**Summary:** Serialize `scanLibrary` behind a single-flight guard so a second call while a scan is
running joins the in-flight run instead of starting a concurrent one.

**Current behavior:**
`scanLibrary` can run concurrently with itself. Two of its three call sites invoke it without
awaiting, and no call site checks whether a scan is already running. Each concurrent run holds its
own database snapshots (the set of existing chapter urls taken before processing; the chapter,
book and author fetches taken during cleanup) and reasons as though nothing else writes. The
result is three data defects — a book inserted by one run being permanently destroyed as an
"orphan" by the other, duplicate book rows, and `series_books` membership rows destroyed by a
blocklist that never saw the other run's books — plus a lying progress indicator, because the
progress store's start action resets its counters and its end action is called by whichever run
finishes first.

**Desired behavior:**
`scanLibrary` is single-flight. A call made while a scan is in progress returns the promise of the
run already underway rather than beginning a second one; it does not throw, and it does not need
its callers to change. When the in-flight run settles — resolving *or* rejecting — the module
returns to idle so a later call starts a genuinely new scan. Every existing caller keeps working
unchanged, including the two that do not await.

The maintainer has chosen **join-the-in-flight-promise** over queueing a trailing re-run. The
known and accepted cost: a user who adds files and then taps `Rescan` while a scan is already past
enumeration gets a no-op, and their new files appear only on the next scan. **Do not** add a
trailing/queued re-run to "improve" this — it was considered and declined.

**Key interfaces:**
- The exported `scanLibrary` entry point — its signature stays `(): Promise<void>`. Callers must
  not need edits.
- The coalescing logic should be a **separately testable unit**, not logic buried inside the scan
  body. This repo already has that idiom: modules that reach RNFS/MediaStore have their reasoning
  split out so it can be unit-tested (see how the scan's grouping logic and its live-key
  derivation were extracted). A small generic single-flight helper taking an async thunk and
  returning a coalescing wrapper follows that pattern and is testable without mocking the scan.
- The scan-progress store's start/end actions — no API change required, but the guard must make
  the "end called while another run continues" case unreachable.

**Acceptance criteria:**
- [ ] A second call to `scanLibrary` while the first is still pending returns **the same promise
      instance** as the first, and the underlying scan body executes exactly once.
- [ ] After the in-flight promise **resolves**, a subsequent call starts a new run.
- [ ] After the in-flight promise **rejects**, a subsequent call starts a new run — the guard must
      not latch permanently on a failed scan. A rejection still propagates to every caller that
      joined.
- [ ] The unawaited call sites (`DrawerContent`'s `Rescan Library` row, `useScanExternalFileSystem`)
      and the awaited one (`directoryPicker`) are unchanged, or changed only to `void`-annotate the
      floating promise if lint requires it.
- [ ] Unit tests cover: coalescing two overlapping calls; a third call after resolution starting a
      fresh run; a third call after rejection starting a fresh run; and the rejection reaching all
      joined callers.
- [ ] `npx tsc --noEmit` is clean and `npx eslint` reports 0 errors — the repo's standing baseline.
- [ ] The full jest suite passes with no pre-existing test regressed. Current baseline is **778**
      passing (ticket 29, `71dcc8d`); the new tests should raise it.
- [ ] The `⚠ IT ASSUMES NO CONCURRENT SCAN` warning block on `pruneOrphanedSeriesBooks` is updated
      to record that the assumption is now **enforced**, and by what — do not delete the block, and
      do not weaken the surrounding ticket-22 blocklist warning.

**Out of scope:**
- Reverting or altering ticket 27's change that moved `pruneOrphanedSeriesBooks`' fetch inside its
  writer. That is explicitly not the fix.
- Any change to `removeMissingFiles`' orphan-derivation logic, its two load-bearing guards
  (missing-root skip, empty-enumeration skip), or the `orphanedBooks.length > 0` prune trigger.
  Serializing scans makes the existing single-scan reasoning sound; it does not need rewriting.
- Adding unique constraints to the WatermelonDB schema, or any schema migration. The duplicate-book
  consequence is fixed by serialization alone.
- Disabling the `Rescan Library` drawer row while a scan runs. It is a reasonable follow-up for UI
  feedback but is not needed for correctness once the guard exists, and it is not this ticket.
- Any queued/trailing re-run behavior (see *Desired behavior*).
- Device verification. Triage accepted the code trace as sufficient; the fix is safe regardless of
  how often the race fires, because serializing scans cannot regress anything that works today.

---

## Triage log

> *This was generated by AI during triage.*

**2026-08-15 — triaged `needs-triage` → `ready-for-agent`, category `bug`.**

Verified against the working tree at `5fd0067`:

- **Every claim in the original body holds.** No re-entrancy guard; the progress store's start
  action is an unconditional zustand setter, not a lock; the two unawaited callers and one awaited
  caller are as listed.
- **Question 2 of the original *What would settle it* is answered: no.** The drawer button does
  **not** disable itself while a scan is in flight — the `DrawerRow` has no `disabled` prop and
  nothing reads `isScanning` as a gate. That route is open.
- **Redundancy check.** Swept `src/` for `inFlight|isScanning|mutex|isRunning`. The only hit is
  the progress store's `isScanning`, consumed solely by `Header.tsx` for rendering. No
  serialization exists anywhere in the codebase. Not already implemented.
- **Prior-rejection check.** No `.out-of-scope/` directory exists in this repo; nothing to surface.

Three corrections were made to the body:

1. **Added consequence 1 (book destroyed) and consequence 2 (duplicate books).** The original
   framed the series prune as the sharpest consequence. It is the third-sharpest. The two-snapshot
   split inside `removeMissingFiles` destroys a freshly-imported book outright, and that
   destruction is *also* what flips the gate that triggers the series prune.
2. **Corrected "`startScan()` is idempotent".** It resets the counters, so overlap is visible in
   the existing UI as a backwards-jumping progress bar plus an indicator hidden by the first run to
   finish. The original body told a future reader the UI was not evidence; it is the best evidence
   available, and one of its symptoms is a bug in its own right.
3. **Dropped the stale line numbers.** The original cited `:1069`/`:1092`/`:916`/`:957`/`:1015`
   against a file that is now 1049 lines — ticket 29 (`71dcc8d`) landed in between. Anchors are now
   by symbol name, per the agent-brief durability rule.

**Device verification was waived deliberately.** The original body gated itself on reproducing the
race on hardware. Triage judged the trade wrong: three independent reachability routes with no
guard on any of them, against a permanent book-destroy path, versus a fix that is one module-level
variable and cannot regress anything that works today. Requiring a maintainer to double-tap a
drawer button on a real library to justify that is a worse use of a cycle than just fixing it.

---

## Resolution

> *This was generated by AI during triage.*

**RESOLVED 2026-08-15.** jest **778 → 783** (62 → 63 suites), `tsc --noEmit` clean, `eslint` 0 errors.

`scanLibrary`'s body became a module-private `runScan`, and the export is now a single-flight
wrapper over it. The exported signature is unchanged, so **no call site needed editing** — the two
unawaited callers and the awaited one all work as they did.

The coalescing logic went into its own small generic helper rather than inline in the scan body,
per the brief's seam requirement. That is the only part with tests, and it needs no mocks: the scan
itself still reaches RNFS/MediaStore and is still untestable, which is exactly why the reasoning
was pulled out of it — the same move this repo already made for `scannedBookGrouping` and
`collectLiveKeys`.

The `pruneOrphanedSeriesBooks` header block was rewritten in place to record the assumption as
ENFORCED and to warn that its safety proof now rests on the guard. The ticket-22 blocklist
paragraph and the ticket-27 fetch-inside-writer paragraph above it are untouched.

### One slice went red that the criteria did not ask for

A `run` that throws **synchronously** escaped past the `Promise<T>` the wrapper's own signature
advertises, landing in the caller's frame where an unawaited caller has no `try`/`catch` and an
attached `.catch()` never fires. Unreachable for `scanLibrary` itself (an `async function` always
returns a promise), but the helper is generic and a guard whose failure mode is *escaping the
abstraction it promises* is worth one line. `new Promise((resolve) => resolve(run()))` normalises
it while still invoking `run` synchronously — ⚠ `Promise.resolve().then(run)` would also work but
delays the scan by a microtask, and `async () => …` on the wrapper itself would return a NEW
promise per call and **break the same-instance criterion**.

### ⚠ Two review claims, one of which was wrong

- **Standards axis claimed the guard multiplies unhandled rejections** — "one failed scan can raise
  an unhandled rejection at every joined call site rather than one." **Refuted empirically.**
  Unhandled-rejection tracking is per PROMISE OBJECT, not per call site, and joined callers share
  one object. Measured: two unawaited calls to a throwing operation produce **2** unhandled
  rejections unguarded and **1** guarded. The guard strictly REDUCES them. ⚠ The claim read
  plausibly and was wrong in its premise, not its arithmetic.
- **Spec axis raised a real gap the brief missed.** The accepted no-op cost was written up around
  `Rescan`, but it also lands on `directoryPicker` — and that is the *less obvious* half, because
  `runScan` reads its library folders once at the top, so a folder added mid-scan joins a scan that
  enumerated before it existed and its books appear only on the next scan. Documented at the export.
  ⚠ **This is a behaviour CHANGE on that path**: before the guard, adding a folder mid-scan started
  a concurrent scan that *did* see the new folder — while corrupting data on the way past. Joining
  is the better of the two, not a free one. **Left as-is deliberately** (a trailing re-run is
  forbidden by the brief); if it needs fixing, fix it at the picker, never by weakening the guard.
  **Worth a driver decision — see the note in the topic memory.**

### Not done, and deliberately

Device verification. The guard cannot regress anything that works today, and the race it closes is
a data-corruption path, not a behaviour a tester can be asked to confirm.
