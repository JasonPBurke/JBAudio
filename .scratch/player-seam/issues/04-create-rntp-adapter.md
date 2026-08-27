# 04 — Create the RNTP adapter beside RNTP

**What to build:** One module that owns the Player library. Nothing migrates to
it in this ticket and nothing breaks — it is purely additive, the expand half of
an expand–contract sequence. When it lands, the adapter exists, compiles, and
has no callers.

**Blocked by:** None — can start immediately.

**Status:** resolved

## The contract

`src/player/trackPlayer.ts`. Named for the library it fronts, **not** for the
domain — "player" already denotes six things in this repo (a screen, three
components, a setup module, the engine) and the adapter does not get to take it.

Its header must state the rule the way `src/db/seriesQueries.ts` states its own:
**mechanical, RNTP's vocabulary, RNTP's semantics, no decisions.** Anything that
decides lives above it.

## The surface — ratified, do not extend without recording a reason here

Inlined because it is a type shape that encodes decisions prose would blur.

```
── Reads: active item collapses to bookId; queue stays structural
getActiveBookId():     Promise<string | null>       // replaces getActiveTrack, 20 sites
getActiveTrackIndex(): Promise<number | undefined>
getProgress():         Promise<Progress>
getPlaybackState():    Promise<{ state: State }>
getQueue():            Promise<Track[]>             // durations + length + queue[0].bookId
getTrack(i):           Promise<Track | undefined>   // playback service only, write-adjacent

── Commands
seekTo(s)  seekBy(s)  play()  pause()  stop()
skip(i)  skipToNext()  skipToPrevious()
setRate(r)  setVolume(v)  reset()
add(tracks)  updateMetadataForTrack(i, meta)  setRepeatMode(m)

── Setup
setupPlayer(opts)  updateOptions(opts)

── Events
subscribe(event, handler): Subscription

── Re-exports
export { State, Event, Capability, RepeatMode }
export type { Track, AddTrack, Progress }
```

## Three things that will look wrong later

⚠ **`getActiveTrack` is NOT exported. There is no escape hatch.** All 31 of its
call sites — 20 imperative, 11 through hooks — read `?.bookId` and nothing else.
Measured across every one, not sampled. An escape hatch with no user is how the
collapse gets quietly undone: the next person in a hurry reaches for the
familiar name. If a caller genuinely needs the whole item later, it gets added
then, with the reason written in this file.

⚠ **Reads collapse but the queue read stays structural.** That is deliberate,
not an inconsistency. Relative seek and chapter skip need **per-item durations**
to compute a landing spot, and the restore path needs the **first item's
bookId**. An active-item read answers a question and returns the answer; a queue
read exposes a structure and returns the structure.

⚠ **Enums are re-exported, never redefined.** Re-exports stay identity-equal to
RNTP's, so every existing `State.Playing` comparison keeps working untouched.
Redefining them would be a small vocabulary win and a generator of equality bugs
that present as logic bugs.

See `docs/adr/0003-only-the-rntp-adapter-imports-rntp.md` for why, and for the
four alternatives that were rejected.

## Acceptance criteria

- [x] The adapter exists, exports exactly the surface above, and compiles
- [x] Its header states the no-decisions rule
- [x] It contains no branching on Book, Chapter or Queue shape — nothing that
      decides anything
- [x] `getActiveTrack` is not exported
- [x] Zero callers; no other file changes in this ticket
- [x] `tsc` 0, `eslint` 0, test count unchanged from ticket 01's baseline
- [x] No lint rule yet — that is ticket 08

## Answer

`src/player/trackPlayer.ts` — 22 functions, one `subscribe`, four enum
re-exports and three type re-exports. Zero callers, one new file, nothing else
touched. Every gate green and every count unchanged.

### The mock shape dictates the import style, and it is load-bearing

Every existing test mocks RNTP as `{ __esModule: true, default: { … } }` — nine
files, eighty-one tests. So the adapter calls through RNTP's **default** export
(`TrackPlayer.seekTo(…)`), never a named import. A named import would resolve
past `default` and route around the fake, which is precisely the arrangement
tickets 05–07 depend on: the fake stays below the adapter, the real adapter runs
on top of it, and the migrated call sites need no test edits. Recorded in the
header so it is not "tidied" into named imports later.

### Three shapes inside the ratified surface that needed picking

None of these extends it; recorded because each is a place a future reader could
reasonably expect RNTP's own signature and find a narrower one.

1. **`add(tracks: AddTrack[])` is array-only.** RNTP overloads `add` on a bare
   item as well, and two call sites use that form (`restoreLastActiveBook.ts:79`,
   `handleBookPlay.ts:176`). The ratified surface names one shape, `add(tracks)`,
   so those two migrate as `add([track])`. RNTP wraps a single item into an array
   internally anyway — the semantics are identical, only the overload is gone.
2. **`getPlaybackState(): Promise<{ state: State }>` drops the error payload.**
   RNTP's real return is a discriminated union whose `State.Error` branch also
   carries `error`. All five callers destructure `{ state }` and none reads
   `error`. This is the ratified signature; widening it back is a one-line change
   if a caller ever needs the payload.
3. **`setupPlayer(options)` requires its argument.** RNTP defaults it to `{}`;
   the one caller (`playerSetup.ts:70`) always passes a full object.

### The `typeof` guard is the point of the whole file

```ts
const bookId = (await TrackPlayer.getActiveTrack())?.bookId;
return typeof bookId === 'string' ? bookId : null;
```

That guard is the single place `Track`'s `[key: string]: any` index signature is
converted into a checked read — 31 unchecked reads collapsing to one checked
one. A cast (`as string | undefined`) would have compiled identically and
verified nothing.

It is also the file's only conditional, which is what makes "does this module
decide anything?" a question with a one-word answer. It is not a decision: an
item without a usable `bookId` is indistinguishable from no active item to every
caller, and the declared `string | null` has to be honest either way.

### ⚠ `spec.md` says "nineteen functions"; the ratified list holds 22

The surface block in this file is the authority — six reads, fourteen commands,
two setup — and the adapter matches it exactly, name for name. The spec's
sentence under **The surface** is a miscount, not a smaller surface. Left in
place rather than edited, since the spec is a ratified document; noted here so
the discrepancy does not get read as the adapter having grown three functions.

### What is deliberately NOT here

- **No tests.** The adapter is covered by the existing suite once callers
  migrate (tickets 05–07), which is why the count gate is *unchanged* rather than
  *at or above*. Adding a passthrough-assertion suite now would test `jest.mock`.
- **No lint rule** — ticket 08.
- **No `Event` widening for `'remote-play-book'`.** `subscribe` is typed
  `T extends Event`, and `service.js:514` subscribes to a custom native event
  string that is not in RNTP's enum. That file is JavaScript, so nothing breaks
  today; ticket 12's TypeScript conversion is where it has to be answered, with a
  reason recorded above.

### Gates

```
tsc:     0 errors
eslint:  0 errors, 38 warnings (unchanged)
jest:    75 suites / 966 tests passed — unchanged
```

Measured from a clean tree and a cold cache, per ticket 01:

```
npm ci && npx jest --watchman=false --clearCache && npx jest --watchman=false
```
