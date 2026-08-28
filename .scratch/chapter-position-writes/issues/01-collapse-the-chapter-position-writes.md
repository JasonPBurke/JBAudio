# 01 — The four-write "where is this Book" shape is copied across five sites in `service.js`

**What to build:** The store-and-persist pair for a Book's chapter index and
chapter progress stops being open-coded in `src/setup/service.js`. One home,
the way `resetBookToStart` is now one home for the zero-valued case.

**Status:** needs-triage

**Found:** 2026-08-28, by the Standards axis of the two-axis review on ticket 02
(`.scratch/remote-noop-footprint/issues/02-remote-next-finish-branch-leaves-the-chapter-index-stale.md`).
Deliberately deferred there as wider than that ticket's "the shared reset has
one home". Pre-existing; no known user-visible defect — this is a
drift-prevention ticket, and the drift it prevents has already happened once.

## The problem

Four values always move together — the chapter index and the chapter progress,
each in **two places**: the Zustand store (what the UI reads) and the DB (what
survives a restart):

```js
setPlaybackIndex(bookId, index);            // in-memory
setPlaybackProgress(bookId, progress);      // in-memory
await updateChapterIndexInDB(bookId, index);       // persisted
await updateChapterProgressInDB(bookId, progress); // persisted
```

That shape is open-coded at five sites. **Ticket 02 exists because two of them
drifted**: the `RemoteNext` finish branch wrote the playback half and not the
index half, so the chapter list highlighted the last chapter of a Book that had
just been rewound. `chapterList` reads the STORE's `playbackIndex[bookId]` and
only falls back to the DB row when that selector is `undefined`, so a stale
store entry beats a correct DB row — which is why "in-memory and persisted must
move together" is a real invariant and not a tidiness preference.

## The five sites

Line numbers are as of `173f91e`; the handler names are the durable reference.

| # | Site | Writes | Values |
|---|------|--------|--------|
| A | `handleProgressUpdated`, single-file chapter-change branch — `:230`, `:250`–`:254` | progress→store **every tick**; index→store + **both** DB writes only inside the `chapter changed` guard | `currentChapterIndex` / `progressWithinChapter` |
| B | `Event.PlaybackQueueEnded`, multi-file branch — `:552`–`:556` | all four | `track` / `position` |
| C | `Event.PlaybackQueueEnded`, fallback branch — `:559`–`:560` | progress only (store + DB) | `0` |
| D | `Event.PlaybackActiveTrackChanged` — `:666`, `:668` | index only (store + DB) | `event.index` |
| E | `helpers/resetBookToStart.ts` | all four **+ the `singleFileChapterState` rewind** | `0` / `0` |

`savePeriodicProgress` (`:86`) is a sixth partial — progress to the DB only,
throttled to 30 s. Probably out of scope; decide explicitly rather than by
omission.

## ⚠ Why this is NOT a mechanical extraction

A naive `setChapterPosition(bookId, index, position)` **absorbs A, B and E and
breaks C and D**. C and D each write half the shape *on purpose*:

- **C** is the single-chapter Book / Book-not-in-Zustand fallback. It has no
  meaningful index to write, and the existing comment says so: *"If book not in
  Zustand yet, skip saving to avoid corruption."*
- **D** fires on a queue transition. The position for the new track is whatever
  the player is about to report; writing one here would be inventing a value.

So the design question the ticket has to answer first is **what the unit is**.
Three candidates, in the order I'd try them:

1. **Two functions, one axis each** — `setChapterIndex(bookId, index)` and
   `setChapterProgress(bookId, progress)`, each doing its own store+DB pair, and
   a `setChapterPosition` that calls both. Every site then says exactly which
   axes it means, and C/D stop looking like bugs. Cheapest and most honest.
2. **One function with optional halves** — `setChapterPosition(bookId, { index?,
   progress? })`. Fewer names, but an optional field is how "we forgot the
   index" gets to look identical to "we meant to skip the index", which is the
   exact failure mode this ticket is about. Probably the wrong trade.
3. **Leave C and D alone**, absorb only A/B/E. Smallest diff; leaves two
   open-coded half-shapes next to a helper, which is where drift starts.

Second question: **does `singleFileChapterState` belong inside?** Only E rewinds
it and only A advances it; B, C and D never touch it. If the extracted unit
owns it, B/C/D would start to — that is a behaviour change, not a refactor, and
needs its own argument. See the note in ticket 02's `## Comments`.

## Sequencing — read before starting

⚠ **`.scratch/player-seam/issues/12-convert-playback-service-to-typescript.md`
converts this exact file and is `needs-triage`.** Two refactors of a 685-line
untested JS file will conflict on nearly every hunk. Decide the order first;
the argument for doing 12 first is that it gives this work a type checker over
the very signatures being introduced.

## The fix, roughly

Extract into `src/helpers/` — **not** into `service.js` — for the reason the
last three extractions cite: `setup/service.js` has no test lane, so anything
worth testing has to leave it. Follow `helpers/resetBookToStart.ts`, which
should become a caller of whatever this ticket lands (its zero-valued case) or
be folded into it entirely.

## Acceptance criteria

- [ ] The store+DB pairing for chapter index and chapter progress has one home
      under `src/helpers/`, called by every site that writes it
- [ ] C and D still write only the half they mean to, and the code says which
      half deliberately rather than by omission
- [ ] `resetBookToStart` is expressed in terms of the new unit, or absorbed
- [ ] The `singleFileChapterState` question is answered in writing, either way
- [ ] No behaviour change: A's per-tick progress write stays per-tick and its
      index write stays inside the chapter-changed guard
- [ ] Covered by tests in the `helpers` lane
- [ ] `savePeriodicProgress` is explicitly in or out, with a reason

## Traps

- ⚠ **`src/setup/service.js` is CRLF** — the only file in this area that is. A
  scripted edit that reads and rewrites it in text mode silently converts the
  whole file to LF and produces a ~1400-line diff. Check `file src/setup/service.js`
  after editing; `sed -i 's/$/\r/'` restores it. This cost real time on ticket 02.
- ⚠ **`service.js` has no test lane.** It is imported by nothing testable and
  imports RNTP; that is the whole reason for the `helpers/` pattern. Do not
  plan to "add a test for the service".
- ⚠ **Read `docs/testing/jest-projects-and-rn-tests.md` first** — the `helpers`
  lane is node with no preset, and eight traps in there fail quietly.
- ⚠ Site A's guard also drives `sleepTimer.onChapterChanged()` and the lock-screen
  `updateMetadataForTrack` call. Those are inside the same `if` as the four
  writes; do not let an extraction change how often they fire.
