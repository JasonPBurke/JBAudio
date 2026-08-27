# 09 — Move the reactive surface onto the store mirror

**What to build:** One component subscribes to the Player's React hooks. Every
other file reads a selector. The app gets one answer to "which Book is playing?"
instead of twelve files each subscribing for the same single field.

**Blocked by:** 01, 03, 08

**Status:** resolved

## The twelve files

Active-track hook ×11, is-playing hook ×2 (both already among the 11),
track-player-events hook ×1: the chapter list, footprint list, player and title
details screens; the book-time-remaining, floating player, player controls,
player progress bar and player state sync components; the stable current-chapter
hook, the last-active-track hook, and the track-player state logger.

⚠ **The Reanimated progress hook is NOT in this list.** It uses event
subscription and a type, never a hook, and it writes Reanimated **shared values**
specifically to avoid React re-renders. Routing it through a store would
reintroduce the per-second re-render it exists to eliminate. It was migrated
mechanically in ticket 07's sibling batch and must stay event-driven.

## The change

The player-state sync component becomes the **only** caller of the library's
hooks. It writes the **Active Book**, the playing state, and a new sticky
last-active-Book field that does not clear on null — the field that replaces the
last-active-track hook, which is deleted. Both that hook's consumers already take
`bookId` off its result immediately.

Justified by measurement: all eleven active-track call sites use the item for
exactly one thing, `?.bookId`, plus a null check.

## Three things that will bite

⚠ **Do not touch the queue store.** Its `activeBookId` is the **Requested
Book** — a different concept, written by the play/restore/remote-play path,
leading a switch where the Active Book lags it. Merging them breaks
book-switching, and it will look correct in every test that does not switch
Books mid-playback. See `CONTEXT.md`.

⚠ **Five components read both concepts**, in one case four lines apart: the grid
card, the list row, the series detail sheet, the series browse row and title
details. Leave every Requested-Book read exactly as it is.

⚠ **A mount invariant is created here.** The library's hooks work in any
component; store selectors work only while the sync component is mounted. It is
in the root layout today. **Write that into the store's header** — it is
currently an accident and becomes load-bearing.

## Not permitted in this ticket

- Renaming `activeBookId` in either store — ticket 11.
- Converting the book-time-remaining or stable-current-chapter components to
  store-only reads. Both are perf-sensitive and both keep their own
  subscriptions deliberately. A follow-up once ticket 03's checklist has said
  what the mirror does to render timing — not before.
- Instrumentation. Render counters were considered and rejected: React Compiler
  makes render-count assertions unreliable here, and the last instrumentation
  teardown in this repo needed a byte-diff to verify because grep missed two
  hoisted locals.

## Acceptance criteria

- [x] Exactly one component calls the library's React hooks
- [x] The last-active-track hook is deleted and both consumers keep their
      sticky-last behaviour
- [x] The queue store is unmodified
- [x] The mount invariant is documented in the store's header
- [x] The Reanimated progress hook still subscribes to events directly
- [x] `tsc` 0, `eslint` 0, test count at or above ticket 01's baseline, with
      **74 of 74 suites running**

## Answer

Landed. `tsc` 0, `eslint` 0 errors (34 pre-existing warnings, an unchanged file
set — diffed against a stash of the branch), jest **76/76 suites, 971 tests** on
a cleared cache, up from 75/966.

`components/PlayerStateSync.tsx` is now the only file outside the adapter that
imports the Player library at all — grepped across `src/` and `index.js`, not
sampled. Ten of the eleven `useActiveTrack()` subscriptions are gone, along with
one of the two `useIsPlaying()` and the one `useTrackPlayerEvents()`.

### The acceptance criteria

- [x] Exactly one component calls the library's React hooks
- [x] The last-active-track hook is deleted and both consumers keep their
      sticky-last behaviour — **widened, see below**
- [x] The queue store is unmodified (empty diff, and all five Requested-Book
      readers untouched; `titleDetails` keeps its `useQueueStore()` line verbatim
      and gained only a comment saying which concept is which)
- [x] The mount invariant is documented in the store's header
- [x] The Reanimated progress hook still subscribes to events directly
      (`useProgressReanimated.ts` is absent from the diff)
- [x] `tsc` 0, `eslint` 0, test count above baseline — **but "74 of 74 suites"
      was already stale when this ticket was written.** The tree ran 75 at
      `1a04fd7` (ticket 08 added one) and runs 76 now. The criterion is met on
      its intent, not checkable as written.

### `useTrackPlayerEvents` came off the eslint allow list

Ticket 08 built that list as the migration tracker — "what is still importable
is exactly what is still unmigrated". The state logger was its only importer and
now takes the adapter's `subscribe`, so leaving the name behind would have made
the tracker lie. Three names remain (`useActiveTrack`, `useIsPlaying`,
`isPlaying`), all in one file. `isPlaying` still has no adapter export and is
still unclassified — ticket 10 cannot empty the list until that is decided.

### Three divergences, all deliberate

**1. The stickiness widened, and in the direction ticket 03 asked for.**
`useLastActiveTrack` held `useState` *per component instance*, so a remount
while the Player was unloaded started at `undefined` and the FloatingPlayer
returned `null`. `lastActiveBookId` is store-global, so the bar now survives a
remount too. Ticket 03 row 11's extra check is "both consumers must keep showing
that Book, not vanish" — the old per-instance state failed that on any remount
and the non-remounted path already behaved the new way, so this removes an
inconsistency rather than adding one. Not a pure refactor; ruled on, not
overlooked.

**2. `player.tsx`'s loading guard moved from `!activeTrack` to `!activeBookId`.**
A queue item with a non-string `bookId` now pins the spinner where it used to
render the screen with `book` undefined. Unreachable in practice for the same
reason ticket 07 recorded: `Track.bookId` is written from `Book.bookId`,
declared `string`, at both construction sites in `handleBookPlay.ts`. Left as
is, matching ticket 07's call on the identical narrowing in `getActiveBookId`.

**3. The state logger's error branch now fires.** It subscribed to
`Event.PlayerError` while testing `event.type === Event.PlaybackError` — two
distinct RNTP enum members, so it never logged an error. Subscribing per event
types each payload individually and makes the mismatch unrepresentable. Beyond
what the ticket asked; kept because preserving a dead branch has no defence, and
free of risk because the one call site (`app/_layout.tsx:207`) is commented out.

`titleDetails`' `playing` narrowing from `boolean | undefined` to `boolean` is
**not** a fourth: `handleBookPlayInner` declares the parameter
`boolean | undefined` and only ever reads it as `isActiveBook && playing`.

### What the review caught that the implementation had missed

The Standards axis found the one real defect: `PlayerStateSync` fed the store
with a bare `activeTrack?.bookId ?? null`. RNTP declares `Track` with an
`[key: string]: any` index signature, so `.bookid` and `.bookID` compile and
yield `undefined`. Before this ticket a slip there cost one component; after it,
that line is the app's single answer to "which Book is playing?", so it would
null the Active Book everywhere with no error and no type change. It now narrows
on `typeof bookId === 'string'`, the same guard the adapter applies to the
imperative half of the same read (`player/trackPlayer.ts:97-99`).

### Deliberately not done

- **No RN-lane test.** The behaviour that needed proving is the sticky rule, and
  it is pure store logic — five cases in the fast `helpers` lane
  (`src/store/__tests__/playerState.test.ts`), including ticket 03 row 11's
  "must not clear on null". Driving it through RNTL would have bought a slower,
  more brittle restatement of the same assertions.
- **`useBookById(bookId ?? '')`.** The empty string as a "no Book" sentinel is a
  pre-existing shape this ticket propagated rather than introduced; giving it a
  type is a repo-wide change and not this ticket's.
- **Instrumentation**, per the ticket.

### Still owed

The mirror adds one render's latency between the library delivering a track
change and consumers seeing it, because `PlayerStateSync` writes the store from
a `useEffect`. Ticket 03's checklist is the instrument for that and its device
pass has not been run against this change — the rows to walk are 5, 6, 7 and
11, plus row 11's off-boundary extra check (play a Book to the end, let
`PlaybackQueueEnded` reset the queue, confirm the FloatingPlayer and its "left"
text both stay put).
