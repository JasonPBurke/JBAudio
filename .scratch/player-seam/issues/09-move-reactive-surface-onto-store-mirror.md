# 09 — Move the reactive surface onto the store mirror

**What to build:** One component subscribes to the Player's React hooks. Every
other file reads a selector. The app gets one answer to "which Book is playing?"
instead of twelve files each subscribing for the same single field.

**Blocked by:** 01, 03, 08

**Status:** ready-for-agent

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

- [ ] Exactly one component calls the library's React hooks
- [ ] The last-active-track hook is deleted and both consumers keep their
      sticky-last behaviour
- [ ] The queue store is unmodified
- [ ] The mount invariant is documented in the store's header
- [ ] The Reanimated progress hook still subscribes to events directly
- [ ] `tsc` 0, `eslint` 0, test count at or above ticket 01's baseline, with
      **74 of 74 suites running**
