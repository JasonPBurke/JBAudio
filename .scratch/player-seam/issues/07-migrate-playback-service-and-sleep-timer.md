# 07 — Migrate the playback service and sleep timer onto the adapter

**What to build:** The largest untested file in the repo, plus the sleep timer,
talk to the Player through the adapter. This is where the quirks that motivated
the whole seam actually live.

**Blocked by:** 04

**Status:** resolved

## Why this file is included at all, despite the risk

709 lines, zero tests, playback-critical, and it holds the `commandStarted`
latch, the foreground-service demote patch, and the options-replace-arrays
behaviour — every RNTP quirk this repo has paid to learn. Excluding it would
exclude the locality win that justifies the work, and would leave a lint
exemption that looks permanent.

What makes it defensible is that the change here is **mechanical and greppable**
and nothing else. If an edit in this ticket requires thought about behaviour, it
is in the wrong ticket.

## Scope

- The playback service: its imperative calls, and its event subscriptions
  moving to the adapter's subscribe.
- The sleep timer's Player calls: duck, fade, play, pause, read state.
- **The sibling batch: the four hook files that touch the Player's
  NON-hook surface.** Added on implementation — no other ticket claims them, 09
  already says the Reanimated progress hook "was migrated mechanically in ticket
  07's sibling batch", and 08's "only permitted library imports outside the
  adapter are the four hooks" is unreachable while these files still take an
  enum, a type or an imperative call from the library. Their React hooks are
  untouched; only enums, types and imperative calls move.

⚠ **The service stays JavaScript.** Converting it is ticket 12 and must not ride
along — a TypeScript conversion would swamp the diff and destroy the greppability
that makes including the file defensible. The cost is that the adapter's types do
not protect its handful of active-Book reads; ticket 08's device pass covers them
instead.

⚠ **The nine inbound remote handlers are `Remote control`** — the OS driving the
app, the opposite direction from everything else in the file. They move to the
adapter's subscribe like any other listener; the direction is not a code change
here, but it is why ticket 08's device pass is shaped the way it is. See
`CONTEXT.md`.

## Acceptance criteria

- [x] Neither file imports the Player library directly
- [x] All subscriptions go through the adapter — **21, not 24**; see `## Answer`
- [x] The service is still JavaScript; no types added
- [x] The active-Book reads are individually verified by eye — **six, not five**;
      there is no compiler helping here
- [x] `tsc` 0, `eslint` 0, test count at or above ticket 01's baseline

## Answer

Landed. `tsc` 0, `eslint` 0 errors (34 pre-existing warnings, unchanged), jest
**75/75 suites, 966 tests** on a cleared cache — exactly ticket 01's baseline, as
expected for a batch with no test diff.

### Two of this ticket's own numbers were wrong

Both were miscounts in the ticket, not gaps in the work. Recorded so ticket 08
does not re-derive them:

- **Subscriptions: 21, not 24.** Fifteen in `service.js` (matching all fifteen
  `TrackPlayer.addEventListener` at `c08a9e8`), three in
  `useCurrentChapterStable.ts`, three in `useProgressReanimated.ts`. Zero in
  `sleepTimer.ts` — its only `addEventListener` is `AppState`'s and was correctly
  left alone. 24 is reachable only by counting the three `Event` members in
  `useLogTrackPlayerState.tsx`'s `events` array, which are not subscriptions.
- **Active-Book reads: six, not five.** `service.js` 408/467/515/638 and
  `sleepTimer.ts` 303/527. Every one was `activeTrack?.bookId` behind a
  truthiness check and every one is now `getActiveBookId()` behind the same
  truthiness check.

### One latent divergence, deliberately not fixed

`getActiveBookId` narrows with `typeof bookId === 'string' ? bookId : null`
(`trackPlayer.ts:97-98`). A **non-string truthy** `bookId` — a number, say — used
to pass the old `if (activeTrack?.bookId)` and now reads as absent. It bites
hardest at `service.js:467` (`RemoteNext`), where it would turn a chapter-skip
into a bare `skipToNext()`.

Latent, not live: `Track.bookId` is written from `Book.bookId`, declared `string`
(`src/types/Book.ts:15`), at both construction sites in `handleBookPlay.ts`.
Fixing it would mean widening the adapter's one non-passthrough, which is ticket
04's ratified decision and the whole point of the collapse. Left as is.

### The contract escape is now written down

`service.js`'s `subscribe('remote-play-book', ...)` passes a string that is not an
`Event` member to a signature typed `T extends Event`. It compiles only because
the file is JavaScript. The adapter records its other holes in comments and this
one was silent, so it now carries a `⚠` comment at the call site naming ticket 12
— which is where the TypeScript conversion walks into it.

### Deliberately not done

- **The service stays JavaScript.** Ticket 12's, per this ticket's own warning.
- **The duplicated `timer_activation` footprint block.** `sleepTimer.ts:300` and
  `:524` are now byte-identical, and `helpers/remoteFootprints.ts` already exists
  as the home for that shape. The collapse made a pre-existing duplication
  visible; extracting it is a behaviour-bearing refactor and this ticket's whole
  defence is that it contains none. Same call ticket 06 made on the duplicated
  chapters-remaining block. **Worth its own ticket.**
- **No device pass.** This ticket's warning assigns the service's untyped
  active-Book reads to ticket 08's device pass, and every one of them is on the
  Remote control surface that pass already covers row by row.
- **No lint rule.** Ticket 08's. After this batch the only library imports left
  outside the adapter are `useActiveTrack` (×11), `useIsPlaying`,
  `useTrackPlayerEvents` and `PlayerStateSync.tsx`'s documented `isPlaying` hole
  — which is what ticket 08 stage 1 expects to find.
