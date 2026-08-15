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

---

## Follow-up: the folder-picker path is fixed, not accepted

> *This was generated by AI during triage.*

**2026-08-15, driver decision.** The Resolution above left the picker's join cost documented and
unfixed, and flagged it for a decision. **The driver chose to fix it**, in this ticket rather than a
new one — the behaviour was a regression introduced by this ticket's own commit (`71763db`), so
filing it separately would have left a known regression open with its cause already merged. Amended
in place, per this repo's precedent of amending rather than reissuing.

jest **783 → 787**, `tsc` clean, `eslint` 0 errors.

`singleFlight` gained a companion, `afterCurrent()`: it waits for the run already in flight and
then starts a fresh one. `directoryPicker` now calls `scanLibrary.afterCurrent()`.

⚠ **THIS IS NOT THE TRAILING RE-RUN THE BRIEF DECLINED, and the distinction is the whole point.**
The declined design re-ran the scan for *any* second caller, buying nothing for callers who changed
nothing. This is scoped to the one caller that mutates what the scan reads **on entry** — and
`runScan` reads its library folders **once, at the top**, which is exactly why joining loses the
folder. `Rescan` still joins and is still a no-op mid-scan, as decided.

### Design notes worth keeping

- ⚠ **THE COMPOSITION LIVES IN THE TESTED HELPER, NOT IN `scanLibrary.ts`.** Putting the
  wait-then-rerun logic in the scan module would have parked the only interesting new logic in the
  one file that cannot be tested. `afterCurrent` is a method on the returned wrapper, so all four
  new tests run with no mocks.
- ⚠ **THE STALE RUN IS AWAITED BUT ITS OUTCOME IS DISCARDED, FAILURE INCLUDED.** It is answering a
  question this caller did not ask, and its failure says nothing about whether a fresh scan can
  succeed. Propagating it would fail the picker because an *unrelated* scan failed.
- ⚠ **CONCURRENT `afterCurrent` CALLERS COALESCE ONTO ONE FRESH RUN, and this falls out rather than
  being built.** Both wait on the same in-flight promise; the guard nulls itself before their
  continuations run; the first continuation starts run 2 and the second *joins* it. Correct because
  that run starts after both callers called, so it observes both their changes. Add two folders
  quickly and you get one extra scan, not two.
- **It costs nothing when idle** — with no scan running, `afterCurrent` goes straight to a single
  run. That is the overwhelmingly common case, and it is why this beats unconditionally scanning
  twice.
- ⚠ **THE RULE GENERALISES, and is written at the export:** any caller that mutates library
  configuration before scanning must use `afterCurrent`. A plain call is only correct when the
  caller changed nothing the scan reads at startup. A future caller getting this wrong is silent —
  no error, just missing books.

### ⚠ A test trap this hit

The first version of the `afterCurrent` test counted microtask ticks (`await Promise.resolve()`)
to assert that no second run starts early. It failed against **correct** code: Babel compiles
async/await to generators, so **the number of ticks a continuation takes is an artifact of the
transpiler, not behaviour**. Replaced with a `setTimeout(0)` flush. ⚠ Never assert on tick counts
in this repo — the test will encode the transpiler, and it will fail or pass for the wrong reason.

---

## DEVICE-VERIFIED 2026-08-15 — Pixel 7 Pro, Android 16, debug build

> *This was generated by AI during triage.*

Dev build (`expo run:android`), JS-only change so no native concern. Five scans observed via the
existing `[scan] …ms total` log line, which prints **once per actual run** and is therefore a direct
count of runs. Final state: **355 books**, in line with the standing corpus baseline of 354. No
errors or exceptions in `ReactNativeJS`/`AndroidRuntime` for the whole session.

### 1. Baseline — one folder, one scan
`1517ms · 23 files, 23 new`. Single folder added, single scan. Nothing anomalous.

### 2. The picker fix, and ⚠ THE FILE COUNTS ARE THE PROOF, not the timing

Terry Pratchett added, then **Brandon Sanderson added while Pratchett was still scanning**:

```
16:30:35.948  [scan]  57790ms · 1290 files, 1267 new     <- Pratchett
16:30:46.253  [scan]  10272ms · 1591 files,  301 new     <- fresh run, Sanderson
```

⚠ **The first scan saw 1290 files and the second saw 1591.** Sanderson's 301 files are ABSENT from
the first scan's enumeration and PRESENT in the second's — which is the defect stated as a
measurement: the run in flight enumerated before Sanderson's folder existed, so **joining it would
have lost all 301 files** until some later scan. `afterCurrent` produced the second run and picked
them up with no user action.

⚠ **The two runs are also provably NON-OVERLAPPING**: run 2 ended at `16:30:35.948`; run 3 lasted
10272ms and ended at `16:30:46.253`, so it began at `≈16:30:35.981` — **33 ms after** run 2
finished. That is the guard tracking `inFlight` correctly across a 58-second window.

### 3. The plain-join path — three taps inside a 115-second scan

The whole corpus root was added, giving a `115299ms · 3464 files, 1873 new` scan running
`16:34:11 → 16:36:07`. **Rescan Library was tapped three times inside it** (16:34:43, :45, :47),
with the header reading `Scanning` throughout.

**Result: exactly ONE `[scan]` line.** Waited a further 30 s past completion — no delayed second
run, so the taps genuinely returned the in-flight promise rather than queueing.

⚠ **The progress counter climbed 146 → 208 MONOTONICALLY across all three taps.** Pre-fix,
`startScan()` reset `processedBooks`/`totalBooks` to 0 on every call, so this is the visible symptom
of the old bug not occurring — and it is why the original ticket's claim that "the progress UI will
look like ONE scan either way" was wrong in both directions.

### ⚠ What could NOT be staged, and why it does not matter

An earlier attempt to double-tap Rescan with ~180 ms between taps was **inconclusive and is not
counted as evidence**: the scan it triggered began ~1.9 s after the first tap, so the second tap
landed before the run even started, making "the guard coalesced them" indistinguishable from "the
second tap missed the row". ⚠ A 934 ms no-op rescan is too short a window to stage a race in by
hand — **use a long scan (add a large folder) and tap inside it**, which is what test 3 does.
