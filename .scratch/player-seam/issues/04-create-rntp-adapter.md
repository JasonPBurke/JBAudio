# 04 — Create the RNTP adapter beside RNTP

**What to build:** One module that owns the Player library. Nothing migrates to
it in this ticket and nothing breaks — it is purely additive, the expand half of
an expand–contract sequence. When it lands, the adapter exists, compiles, and
has no callers.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

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

- [ ] The adapter exists, exports exactly the surface above, and compiles
- [ ] Its header states the no-decisions rule
- [ ] It contains no branching on Book, Chapter or Queue shape — nothing that
      decides anything
- [ ] `getActiveTrack` is not exported
- [ ] Zero callers; no other file changes in this ticket
- [ ] `tsc` 0, `eslint` 0, test count unchanged from ticket 01's baseline
- [ ] No lint rule yet — that is ticket 08
