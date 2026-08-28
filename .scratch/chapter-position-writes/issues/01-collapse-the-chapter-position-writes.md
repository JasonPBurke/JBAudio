# 01 — The store+DB chapter-**index** write is open-coded at four sites in `service.js`

**What to build:** Writing a Book's chapter index stops being an open-coded
store-write-then-DB-write pair. One home under `src/helpers/`, the way
`resetBookToStart` is now one home for the zero-valued case.

**Status:** ready-for-agent

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
setPlaybackIndex(bookId, index);              // Zustand — what the UI reads
await updateChapterIndexInDB(bookId, index);  // WatermelonDB — what survives a restart
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

| # | Site | Store | DB | Value |
|---|------|-------|----|-------|
| A | `handleProgressUpdated`, single-file branch — `:250`, `:253` | ✓ | ✓ | `currentChapterIndex` |
| B | `Event.PlaybackQueueEnded`, multi-file branch — `:553`, `:556` | ✓ | ✓ | `track` |
| D | `Event.PlaybackActiveTrackChanged`, multi-file — `:666`, `:668` | ✓ | ✓ | `event.index` |
| E | `helpers/resetBookToStart.ts` — `:46`, `:49` | ✓ | ✓ | `0` |

Site letters are kept from the original ticket so the ticket-02 review notes
still resolve. **C is deliberately absent**: `PlaybackQueueEnded`'s fallback
branch (`:559`–`:560`) writes progress only, on purpose — it is the
single-chapter / Book-not-in-Zustand case with no meaningful index. Under this
ticket's scope it is simply not a site.

### A fifth site, index-axis but store-less

| # | Site | Store | DB | Value |
|---|------|-------|----|-------|
| F | `helpers/handleBookPlay.ts:147` | ✗ | ✓ | `0` (only when `restartFromZero`) |

`handleBookPlay` writes `updateChapterIndexInDB` with **no store write at all**
— it writes no store state anywhere in the file. Its comment says the zeroed
position is written back *before* playback starts so the DB and queue agree, and
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
const { setPlaybackIndex, setPlaybackProgress } = useLibraryStore.getState();
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

The original ticket claimed *"four values always move together"* — the index and
the progress, each in store and DB. **That premise is false**, which is why this
ticket no longer covers progress. The chapter-progress axis writes store and DB
on *deliberately different cadences*:

| Site | Store | DB |
|---|---|---|
| `handleProgressUpdated` single-file — `:230`, `:254` | every tick (1 Hz) | only on chapter change |
| `handleProgressUpdated` multi-file — `:302` | every tick (1 Hz) | via `savePeriodicProgress`, ≤ every 30 s |
| `savePeriodicProgress` — `:86` | — | throttled to 30 s |
| `Event.PlaybackState` — `:621`, `:624` | — | on state change only |
| `PlaybackQueueEnded` fallback — `:559`–`:560` | ✓ | ✓ |
| `handleBookPlay.ts:148` | — | ✓ |

A `setChapterProgress(bookId, p)` doing a store+DB pair cannot absorb any of the
first four without either destroying the 30 s throttle or absorbing the throttle
into the helper — which is a behaviour change wearing a refactor's clothes.

And there is no invariant to protect: unlike the index, nothing reads store
progress in a way that beats a DB row into a *wrong* result. A ≤30 s-stale
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

The reason is device-pass attribution. Both tickets claim *behaviour
preservation* in the same playback-critical handlers, and both need a device
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

- [ ] The store+DB pairing for the chapter **index** has one home under
      `src/helpers/`, called by sites A, B, D and E
- [ ] `resetBookToStart` calls it for the index half and is otherwise unchanged
- [ ] Site F (`handleBookPlay`) is resolved in writing: correct-as-is, or filed
      as its own bug ticket with a `fakePlayer` repro
- [ ] `singleFileChapterState` stays outside the unit, or the ticket records why
      it moved in
- [ ] No behaviour change: A's index write stays inside the chapter-changed
      guard, and `sleepTimer.onChapterChanged()` / `updateMetadataForTrack` fire
      exactly as often as before
- [ ] The progress axis is untouched — no site in the rejected table above moves
- [ ] `service.js:55`'s module-scope destructure drops `setPlaybackIndex` and
      keeps `setPlaybackProgress`
- [ ] Covered by tests in the `helpers` lane

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

> *This was generated by AI during triage.*

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
  *deliberately* desynced between store and DB, so it is not duplication and
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
