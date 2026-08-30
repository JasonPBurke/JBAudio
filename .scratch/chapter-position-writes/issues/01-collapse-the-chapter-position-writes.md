# 01 — The store+DB chapter-**index** write is open-coded at four sites in `service.js`

**What to build:** Writing a Book's chapter index stops being an open-coded
store-write-then-DB-write pair. One home under `src/helpers/`, the way
`resetBookToStart` is now one home for the zero-valued case.

**Status:** resolved — code complete, `tsc` 0, `eslint` clean, suite
green at 85 suites / 1047 tests. Device pass complete (2026-08-28) — see
`### Device pass` below.

**Blocked by:** `.scratch/player-seam/issues/12-convert-playback-service-to-typescript.md`
— see `## Sequencing`.

**Found:** 2026-08-28, by the Standards axis of the two-axis review on ticket 02
(`.scratch/remote-noop-footprint/issues/02-remote-next-finish-branch-leaves-the-chapter-index-stale.md`).
Deliberately deferred there as wider than that ticket's "the shared reset has
one home". Pre-existing; no known user-visible defect — this is a
drift-prevention ticket, and the drift it prevents has already happened once.

**Scope note:** this ticket originally covered the chapter **progress** axis
too. It does not any more — see `## Considered and rejected: the progress axis`.
Do not re-widen it without reading that section.

## The problem

A Book's chapter index lives in **two places** that must agree:

```js
setPlaybackIndex(bookId, index); // Zustand — what the UI reads
await updateChapterIndexInDB(bookId, index); // WatermelonDB — what survives a restart
```

Those two lines are open-coded at four sites, and **ticket 02 exists because one
of them drifted**: the `RemoteNext` finish branch reset the position but never
wrote the index, so the chapter list highlighted the last chapter of a Book that
had just been rewound.

### Why the pairing is a real invariant

`src/app/chapterList.tsx:56` resolves the highlighted chapter as:

```ts
const index = storeIndex ?? book.bookProgress?.currentChapterIndex ?? -1;
```

The store is consulted **first** and the DB row is only a fallback for
`undefined`. A stale store entry therefore beats a correct DB row — which is why
"in-memory and persisted must move together" is a correctness property on this
axis and not a tidiness preference. (`BookDurationRow.tsx:42` reads
`playbackIndex[bookId]` the same way.)

## The four sites

Line numbers are as of `173f91e`; the handler names are the durable reference.

| #   | Site                                                            | Store | DB  | Value                 |
| --- | --------------------------------------------------------------- | ----- | --- | --------------------- |
| A   | `handleProgressUpdated`, single-file branch — `:250`, `:253`    | ✓     | ✓   | `currentChapterIndex` |
| B   | `Event.PlaybackQueueEnded`, multi-file branch — `:553`, `:556`  | ✓     | ✓   | `track`               |
| D   | `Event.PlaybackActiveTrackChanged`, multi-file — `:666`, `:668` | ✓     | ✓   | `event.index`         |
| E   | `helpers/resetBookToStart.ts` — `:46`, `:49`                    | ✓     | ✓   | `0`                   |

Site letters are kept from the original ticket so the ticket-02 review notes
still resolve. **C is deliberately absent**: `PlaybackQueueEnded`'s fallback
branch (`:559`–`:560`) writes progress only, on purpose — it is the
single-chapter / Book-not-in-Zustand case with no meaningful index. Under this
ticket's scope it is simply not a site.

### A fifth site, index-axis but store-less

| #   | Site                            | Store | DB  | Value                             |
| --- | ------------------------------- | ----- | --- | --------------------------------- |
| F   | `helpers/handleBookPlay.ts:147` | ✗     | ✓   | `0` (only when `restartFromZero`) |

`handleBookPlay` writes `updateChapterIndexInDB` with **no store write at all**
— it writes no store state anywhere in the file. Its comment says the zeroed
position is written back _before_ playback starts so the DB and queue agree, and
that a later write would race the first progress tick.

**Decide F explicitly rather than by omission.** Two readings, and the ticket
must pick one in writing:

1. It is correct as-is — the store entry is about to be written by site A or D
   on the first tick, and writing it here is what would race.
2. It is latent ticket-02 drift — if the first tick does not arrive (user pauses
   immediately, queue load fails), the store keeps a stale index that beats the
   freshly-zeroed DB row in `chapterList`.

Reading 2 is testable against `fakePlayer.ts`. If it holds, F is a **bug** and
should be split into its own ticket rather than smuggled into this refactor.

## ⚠ Site A's guard is not just a guard

Site A's index write sits inside:

```js
if (
  singleFileChapterState.bookId !== bookId ||
  singleFileChapterState.lastChapterIndex !== currentChapterIndex
) { … }
```

`singleFileChapterState` is not incidental bookkeeping next to the write — **it
is the change-detector for the write**, the thing that stops a 1 Hz progress
tick from re-writing an unchanged index to the DB every second. That is the
answer to the original ticket's open question, and it points one way:

> `singleFileChapterState` stays **outside** the extracted unit. It is site A's
> dedupe cache, not part of "write the index". E rewinds it because finishing a
> Book must forget the last chapter seen, which is a different job.

The agent may overturn this, but must argue it in writing.

⚠ **That same `if` also drives `sleepTimer.onChapterChanged()` and the
lock-screen `updateMetadataForTrack` call.** They are inside the block with the
index write. Do not let the extraction change how often they fire.

## The shape to build

Cheapest and most honest:

```ts
// src/helpers/setChapterIndex.ts
export const setChapterIndex = async (bookId: string, index: number) => {
  useLibraryStore.getState().setPlaybackIndex(bookId, index);
  await updateChapterIndexInDB(bookId, index);
};
```

Extract into `src/helpers/` — **not** into `service.js` — for the reason the
last three extractions cite: `setup/service.js` has no test lane, so anything
worth testing has to leave it. Follow `helpers/resetBookToStart.ts`.

`resetBookToStart` should call it for the index half rather than keep its own
copy. Do **not** fold `resetBookToStart` into this unit — it also zeroes
progress and rewinds `singleFileChapterState`, and it is the shared home ticket
02 just built. It becomes a caller, not a casualty.

The store-read style matters: `resetBookToStart` reads
`useLibraryStore.getState()` and its test mocks that. Match it, or the existing
helper-lane mocking pattern stops working.

### ⚠ One edit outside the four sites

`service.js:55` destructures at module scope, once, at import time:

```js
const { setPlaybackIndex, setPlaybackProgress } =
  useLibraryStore.getState();
```

**All three** `setPlaybackIndex` uses in the file — `:250` (A), `:553` (B) and
`:666` (D) — move into the new helper. That leaves the binding unused, so the
line must become:

```js
const { setPlaybackProgress } = useLibraryStore.getState();
```

`setPlaybackProgress` stays: `:230`, `:302`, `:552` and `:559` still use it, and
all four are out of scope per `## Considered and rejected`.

Named here because it is a real edit outside the site table, and because in a
`.ts` file lint will fail on the unused binding — which is how a "no behaviour
change" refactor acquires a surprise hunk mid-diff.

## Considered and rejected: the progress axis

The original ticket claimed _"four values always move together"_ — the index and
the progress, each in store and DB. **That premise is false**, which is why this
ticket no longer covers progress. The chapter-progress axis writes store and DB
on _deliberately different cadences_:

| Site                                                 | Store             | DB                                       |
| ---------------------------------------------------- | ----------------- | ---------------------------------------- |
| `handleProgressUpdated` single-file — `:230`, `:254` | every tick (1 Hz) | only on chapter change                   |
| `handleProgressUpdated` multi-file — `:302`          | every tick (1 Hz) | via `savePeriodicProgress`, ≤ every 30 s |
| `savePeriodicProgress` — `:86`                       | —                 | throttled to 30 s                        |
| `Event.PlaybackState` — `:621`, `:624`               | —                 | on state change only                     |
| `PlaybackQueueEnded` fallback — `:559`–`:560`        | ✓                 | ✓                                        |
| `handleBookPlay.ts:148`                              | —                 | ✓                                        |

A `setChapterProgress(bookId, p)` doing a store+DB pair cannot absorb any of the
first four without either destroying the 30 s throttle or absorbing the throttle
into the helper — which is a behaviour change wearing a refactor's clothes.

And there is no invariant to protect: unlike the index, nothing reads store
progress in a way that beats a DB row into a _wrong_ result. A ≤30 s-stale
progress row is the design, and it has never produced a defect.

So: `savePeriodicProgress` is **out**. `:302`, `:621`/`:624` and site C are
**out**. If a future ticket wants the progress axis, it is a cadence redesign,
not an extraction, and it needs its own argument.

## Sequencing — read before starting

⚠ **`.scratch/player-seam/issues/12-convert-playback-service-to-typescript.md`
converts this exact file and is `needs-triage`.** Two refactors of a 682-line
untested JS file will conflict on nearly every hunk. **12 goes first**: it gives
this work a type checker over the very signatures being introduced, and this
ticket's diff is small enough to rebase but too entangled to merge alongside.

### Branch plan

Ruled 2026-08-28, consistent with ticket 12's own branch plan.

**Its own branch, off `main`, after 12 has merged.** Not a shared branch with
12, and not commits appended to 12's branch.

The reason is device-pass attribution. Both tickets claim _behaviour
preservation_ in the same playback-critical handlers, and both need a device
pass. On a shared branch a Remote-control regression is unattributable — which
is exactly the property ticket 12 buys by branching off candidate 01 rather than
riding its branch.

The risk profile here is **different, not merely smaller**: the new helper lands
in `src/helpers/` as TypeScript with `helpers`-lane tests, so the risk
concentrates in the four call-site edits and in this ticket's own
device-observable claim — that `sleepTimer.onChapterChanged()` and
`updateMetadataForTrack` fire exactly as often as before, on the 1 Hz tick path.
Different verification target, so different branch.

The honest cost is two device passes over overlapping surfaces instead of one.

### A second-order reason 12 goes first

Ticket 12 now rules that the `.js` → `.ts` rename **normalizes CRLF → LF in its
own commit**. That retires this ticket's worst trap outright — see `## Traps`.
The typed call sites are the advertised benefit; losing the CRLF hazard is
probably the larger one.

### ⚠ If ticket 12 is stamped `wontfix`

This ticket does **not** automatically unblock — it needs re-triage, not
promotion.

Most of its value survives 12 being dropped: the extracted helper is TypeScript
and tested in the `helpers` lane either way, since it lands in `src/helpers/`.
What 12 contributes is narrower than "a type checker for this work" — it types
the four **call sites** inside the service, and it removes the CRLF trap. So
"12 is wontfix" implies neither "this is wontfix" nor "start immediately"; it
means re-costing this ticket with both of those benefits withdrawn.

## Acceptance criteria

- [x] The store+DB pairing for the chapter **index** has one home under
      `src/helpers/`, called by sites A, B, D and E
- [x] `resetBookToStart` calls it for the index half and is otherwise
      unchanged — with one recorded exception: its two DB writes swap order, so
      that both STORE writes stay synchronous and adjacent. Argued under
      `## Answer`; its tests pass unchanged.
- [x] Site F (`handleBookPlay`) is resolved in writing: correct-as-is, or filed
      as its own bug ticket with a `fakePlayer` repro — filed as `02`, reading 2,
      and the repro was **run**: DB index `0`, store index `1`. Output recorded
      in `02`; the probe itself was deleted rather than land red here.
- [x] `singleFileChapterState` stays outside the unit, or the ticket records why
      it moved in
- [x] No behaviour change: A's index write stays inside the chapter-changed
      guard, and `sleepTimer.onChapterChanged()` / `updateMetadataForTrack` fire
      exactly as often as before
- [x] The progress axis is untouched — no site in the rejected table above moves
- [x] `service.ts:62`'s module-scope destructure drops `setPlaybackIndex` and
      keeps `setPlaybackProgress` (the ticket said `service.js:55`; ticket 12
      renamed the file before this landed)
- [x] Covered by tests in the `helpers` lane

## Traps

- ⚠ **Line endings — check before editing.** `src/setup/service.js` is 682/682
  CRLF, the only such file in `src/`, and there is no `.gitattributes`. A
  scripted edit that reads and rewrites it in text mode silently converts the
  whole file to LF and produces a ~1400-line diff. This cost real time on
  ticket 02. Verify with `file src/setup/service.js` after editing;
  `sed -i 's/$/\r/'` restores it.
  **If ticket 12 landed first this trap is gone** — its rename commit
  normalizes the file to LF. Run `file src/setup/service.*` before assuming
  either way rather than trusting this bullet.
- ⚠ **`service.js` has no test lane.** It is imported by nothing testable and
  imports RNTP; that is the whole reason for the `helpers/` pattern. Do not
  plan to "add a test for the service".
- ⚠ **Read `docs/testing/jest-projects-and-rn-tests.md` first** — the `helpers`
  lane is node with no preset, and its traps fail quietly.
- ⚠ Do not trust a grep for "all four writes adjacent" to find the sites. That
  is exactly how the original version of this ticket missed `:302`, `:621`,
  `:624` and `handleBookPlay.ts:147`. Search by symbol
  (`setPlaybackIndex`, `updateChapterIndexInDB`) across all of `src/`.

## Comments

> _This was generated by AI during triage._

**2026-08-28 — triaged, scoped down, moved to `ready-for-agent` blocked on 12.**

Verified against the codebase rather than against the original ticket's table.
What held up:

- The store-beats-DB invariant is real (`chapterList.tsx:56`), so the index-axis
  pairing is a correctness property.
- The CRLF trap and the ticket-12 sequencing conflict are both real.

What did not:

- The site census was incomplete. Searching by symbol instead of by the
  "four adjacent writes" shape found `service.js:302`, `service.js:621`/`:624`
  and `handleBookPlay.ts:147`–`148`.
- Those extra sites falsify the ticket's opening premise. The progress axis is
  _deliberately_ desynced between store and DB, so it is not duplication and
  cannot be collapsed without a cadence redesign. Moved to
  `## Considered and rejected`.
- The original ticket's preferred design — "two functions, one axis each" — is
  therefore half-unbuildable: `setChapterIndex` is honest, `setChapterProgress`
  is not.
- The open question "does `singleFileChapterState` belong inside?" is answered
  by reading site A's guard: it is the dedupe cache for the index write, so it
  stays outside.

Net effect: roughly a third of the original scope carries essentially all of the
value. The alternative considered and not taken was `wontfix` — one historical
drift, no open defect, and a playback-critical file touched twice. Rejected
because the index invariant is load-bearing and cheap to make explicit.

---

## Answer — 2026-08-28

Landed on `chapter-position-writes-01-collapse-index-writes`.

`src/helpers/setChapterIndex.ts` is the one home. Four callers: A
(`handleProgressUpdated`, single-file), B (`Event.PlaybackQueueEnded`,
multi-file), D (`Event.PlaybackActiveTrackChanged`, multi-file) and E
(`resetBookToStart`). Covered by
`src/helpers/__tests__/setChapterIndex.test.ts`, 4 tests in the `helpers` lane.

`tsc` 0 project-wide. `eslint` clean. Jest **85 suites / 1047 tests green**,
both lanes — up exactly one suite and four tests from ticket 12's 84/1043, so
nothing else moved.

### Branching — a deviation, recorded

The branch plan said _its own branch off `main`, after 12 has merged_. **12 has
not merged.** This branched off 12's tip instead.

Branching off `main` would have reintroduced the CRLF `service.js` — the exact
trap the sequencing exists to retire — and would have conflicted with 12 on
nearly every hunk. Both of the plan's stated reasons therefore argued _against_
`main` while 12 sits unmerged.

The property the plan actually bought is **device-pass attribution**, and that
is preserved: this is a separate branch with separate commits, so a
Remote-control regression is still attributable to one ticket or the other, and
it can be rebased onto `main` once 12 lands. What is lost is only that 12's own
device pass no longer sits on a merged base — and 12 is already
DEVICE-VERIFIED. Rebase this branch after 12 merges rather than merging it
first.

### Site F: reading 2, filed as `02`

**F is latent drift, not correct-as-is.** Reading 1 does not survive the file:
`handleBookPlay.ts` has **zero** references to `useLibraryStore`,
`setPlaybackIndex` or `setPlaybackProgress`, so there is no store write for the
first tick to race. The comment at `:143`–`:146` is about the **DB** write's
ordering against `play()`, which a synchronous store write does not disturb.

Filed as
`.scratch/chapter-position-writes/issues/02-handleBookPlay-zeroes-the-db-index-without-the-store.md`,
`needs-triage`, with the repro recipe and the one-line fix against
`setChapterIndex`. Two bounds the ticket did not know, both found here and both
severity-reducing:

- The store has **no `persist` middleware**, so the drift is same-session only
  and cannot survive a restart.
- `chapterList`'s `activeIndex` is also gated on
  `activeBookId === book.bookId`, narrowing it to the loaded Book — though
  `restartFromZero` is the path that makes that Book active, so the gate is
  open when it fires.

Not fixed here, deliberately: this ticket claims _no behaviour change_ and buys
a device pass that says so. A new state write on the play path would spend that
claim.

### `singleFileChapterState` stayed outside — the ticket's reading confirmed

It is site A's dedupe cache: the guard is what stops the 1 Hz tick from
rewriting an unchanged index to WatermelonDB every second. The extraction sits
**inside** that guard untouched, so `sleepTimer.onChapterChanged()` and
`updateMetadataForTrack` fire on exactly the same edges. Nothing to overturn.

### One judgement call the ticket did not anticipate: DB write order

At sites B and E the original order was _store progress → store index → DB
progress → DB index_. A single `setChapterIndex` call cannot reproduce that,
because it owns one store write and one DB write.

The order chosen keeps **both store writes synchronous and adjacent**, and lets
the two DB writes swap:

```ts
setPlaybackProgress(bookId, 0);
await setChapterIndex(bookId, 0); // store half is sync, before it awaits
await updateChapterProgressInDB(bookId, 0);
```

The rejected alternative — awaiting the DB progress write first — would have
delayed the _store index_ write by a bridge round-trip, degrading the one
invariant this ticket exists to protect. The cost paid instead is that the two
independent DB writes swap order, observable only if the process dies between
them, which already left a half-written pair today. Site A needed no such
choice: its order was already index-then-progress and is byte-for-byte
preserved.

`resetBookToStart.test.ts` passes **unchanged**, which is the evidence that E's
externally visible behaviour did not move.

### Device pass — complete

This ticket's device-observable claim is narrower than 12's: the four call
sites, and the 1 Hz tick path firing `sleepTimer.onChapterChanged()` and
`updateMetadataForTrack` no more often than before.

- [x] Single-file Book with chapters: chapter list highlight follows playback
      across a chapter boundary (site A)
- [x] Single-file Book: lock-screen / notification title changes on the
      boundary exactly once, not repeatedly (A's `updateMetadataForTrack`)
- [x] Sleep timer set to end-of-chapter on a single-file Book fires on the
      boundary, once (A's `sleepTimer.onChapterChanged()`)
- [x] Multi-file Book: chapter list highlight follows track changes (site D)
- [x] Multi-file Book: sleep-timer end-of-chapter still fires on track change
      (D's `onChapterChanged()`)
- [x] Multi-file Book played to the true end: index and progress both persist,
      and the highlight lands correctly (site B)
- [x] Single-file Book played to the true end: rewinds to chapter 1 and the
      highlight follows (site E via `resetBookToStart`)
- [x] Kill and relaunch after each of the above: the restored chapter matches
      what the list showed

⚠ **One known non-regression can contaminate two of these rows.** Ticket `02`
(site F) is pre-existing on `main` and untouched by this branch, but it fires on
exactly the path a tester reaches next: **replaying a multi-file Book that was
just finished, in the same app session.**

At queue end `const { track } = event` is the LAST track index, so site B leaves
both the store and the DB at the last chapter, and the Book is then marked
Finished. Pressing play again takes `handleBookPlay`'s `restartFromZero` branch,
which zeroes the DB row and writes no store entry — so the chapter list
highlights the last chapter while playback starts at the first. **That looks
identical to this ticket breaking site B or D, and is not.**

Single-file Books are immune: they finish through `resetBookToStart`, which
zeroes both halves, so a replay finds the store already at `0`.

**2026-08-29 — this warning is now SPENT on this branch.** Ticket `02` has been
fixed and its commits sit on top of this one, so `handleBookPlay` writes both
halves and the contamination above cannot occur here any more. The device pass
that ran on 2026-08-28 predates the fix, and its observations stand as recorded.
A pass run from here should see the first chapter highlighted on that row; the
OLD chapter appearing now means ticket 02 regressed, not that this warning is
still live. The warning remains accurate for `main`, where site F is unfixed.

**Avoid it for free:** force-kill and relaunch _before_ replaying a
just-finished Book. The store has no `persist` middleware, so the entry is gone
and `chapterList` falls back to the correct DB row. If a wrong highlight
survives that relaunch, it IS a regression in this ticket and worth stopping
for.
