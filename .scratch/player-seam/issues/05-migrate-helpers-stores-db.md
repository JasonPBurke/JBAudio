# 05 — Migrate helpers, stores and db onto the adapter

**What to build:** The tested core of the app talks to the Player through the
adapter instead of reaching for the library by name. Seeking, chapter skip,
book play, restore, playback rate, remote play/pause, footprints and player
setup all behave exactly as before — proven by the 81 tests that already cover
them.

**Blocked by:** 02, 04

**Status:** resolved

## Why this batch first

It is the batch with the strongest safety net. Ten test files and 81 tests sit
directly on this code, and they assert on the **landing spot** — where playback
ends up — rather than on which calls were made. If a call moves rather than
being redirected, these tests say so.

CI stays green batch to batch because the old form still exists: files not yet
migrated keep importing the library directly until ticket 08 forbids it.

## The change — two mechanical edits, nothing else

- A direct library call becomes the same call imported from the adapter.
- Fetching the active item and reading `?.bookId` off it becomes a single
  active-Book read.

⚠ **The null shape changes** from `undefined` to `null` on that read. Truthiness
guards are unaffected; a strict `=== undefined` comparison is not. Grep for one
before assuming there are none.

## Test expectations

Expect **close to a zero-line diff** under `__tests__/`. The fake stays *below*
the adapter, so the existing module mock still intercepts and existing call
assertions still pass — the call now arrives one frame deeper.

⚠ **A test that breaks here is signal, not chores.** It means a call moved
rather than being redirected. Investigate before editing it.

Do **not** write a suite for the adapter. It is covered transitively by these
81 tests, and a suite asserting that a passthrough passes through would test the
implementation rather than any behaviour.

## Acceptance criteria

- [x] No file under helpers, stores or db imports the Player library directly
- [x] The active-Book read replaces every fetch-item-then-take-bookId in this
      batch
- [x] `__tests__/` diff is empty, or every changed line is explained in this
      file under `## Answer`
- [x] `tsc` 0, `eslint` 0, test count at or above ticket 01's baseline
- [x] The persistence module keeps asking the Player where it is — see ticket
      08's note; do not fix that here

## Answer

Thirteen files migrated, **zero lines changed under `__tests__/`**, every gate
green: `tsc` 0, `eslint` 0 errors, **75 suites / 966 tests** on a cleared cache —
identical to ticket 01's baseline, measured on this branch before the first edit.

Nothing under `src/helpers`, `src/store` or `src/db` imports
`react-native-track-player` any more, and no `TrackPlayer.` call site survives
there.

⚠ **An earlier draft of this section claimed "four surviving matches for the
word" and was wrong** — it counted two greps (`react-native-track-player`, and
`TrackPlayer` followed by a dot) and reported the total as a count of the word.
Both review axes caught it independently. The true figure: the bare word
`TrackPlayer` appears **13 times in prose** across eight files. Three were fixed
(below); the remaining **10** were each checked and each names a real thing —
six are the hook `useSetupTrackPlayer` (`restoreLastActiveBook.ts:29`,
`awaitPlayerReady.ts:8`, `playerSetup.ts:64`, `playerSetup.ts:87`,
`scanLibrary.ts:942`, `bookQueries.ts:12`), and four describe native RNTP
behaviour that is still true (`awaitPlayerReady.ts:4`, `awaitPlayerReady.ts:9`,
`defaultArtwork.ts:12`, `playerNavIntent.ts:7`).

### The zero test diff is structural, not luck

Every test still `jest.mock`s RNTP itself, so the fake stays *below* the adapter
and the real adapter runs on top of it. A call that was `caller → mock` is now
`caller → adapter → mock`: the spy is the same object, the assertion is the same
assertion, and the call simply arrives one frame deeper. No call moved.

### The five active-Book reads that collapsed

Each was a fetch-the-item-then-take-`?.bookId`, and each is now one
`getActiveBookId()`:

| Site | Was | Now |
|---|---|---|
| `chapterSkip.ts:50` | `activeTrack?.bookId` → library lookup | `activeBookId` → library lookup |
| `remoteFootprints.ts:24` | `getActiveTrack()` inside `Promise.all` | `getActiveBookId()` inside the same `Promise.all` |
| `remoteFootprints.ts:48` | `bookId ?? (await getActiveTrack())?.bookId` | `bookId ?? (await getActiveBookId())` |
| `relativeSeek.ts:189` | `activeTrack?.bookId` → `getBookById` | `activeBookId` → `getBookById` |
| `playBookFromRow.ts:89` | `activeTrack?.bookId === bookId` | `activeBookId === bookId` |

**The `undefined` → `null` shape change is safe here, and it was checked rather
than assumed.** Grepped every `=== undefined` and `!== undefined` under
`helpers/`, `store/` and `db/`: the only two hits in these files sit on
`progressInfo?.chapterIndex` (`restoreLastActiveBook.ts:151`,
`handleBookPlay.ts:132`), which is a DB read and not a Player read. All five
sites above are a truthiness guard or an equality against a `string`, and both
survive the change.

`restoreLastActiveBook.ts:50`'s `queue[0]?.bookId !== lastActiveBookId` is
deliberately NOT one of the five. It is a queue read, it stays structural, and
ADR 0003 names it explicitly as the read that is not one of the 31.

### `add([track])` in two places, exactly as ticket 04 pre-recorded

`restoreLastActiveBook.ts` and `handleBookPlay.ts` each had one
`TrackPlayer.add(track)` on RNTP's bare-item overload. The ratified surface
carries one shape, so both now pass `[track]`. RNTP wraps a single item into an
array internally, so the native semantics are identical — only the overload is
gone. No test asserted on `add`, so this cost nothing.

### Seven changed lines that are NOT one of the two mechanical edits

Recorded because a reviewer diffing for "imports only" will find them:

1–3. Prose in three doc comments naming a call expression that no longer exists
in the file — `applyPlaybackRate.ts` ("TrackPlayer.reset()" → "The Player's
reset()", "their TrackPlayer.add(...)" → "their add(...)") and
`restoreLastActiveBook.ts` ("the TrackPlayer queue" → "the Player's queue"). A
comment naming a call form the file no longer uses is how the `seriesProgress.ts`
pointer rotted; these are the same failure one scale smaller.

4. `Track` is imported as `type Track` in the two files that take it from the
adapter, matching `clippedChapters.ts`. The adapter re-exports it with
`export type`, so the binding does not exist at runtime; it compiled either way
because Babel elides bindings used only in type position, but the explicit form
is what stops a later edit from using `Track` in a value position.

5–7. Three more rotted comments, found by the Standards review after the first
four were written. **`bookProgressState.ts:7` was made false BY this diff** — it
said `handleBookPlay.ts` "imports TrackPlayer and the database", which stopped
being true the moment `handleBookPlay.ts` moved onto the adapter; it now says
"imports the Player adapter". `playerSetup.ts:17` and `:63` still named the
library the calls in those very hunks came off ("TrackPlayer options", "Core
TrackPlayer initialization") and now say "the Player's options" and "Core Player
initialization". The four references to `useSetupTrackPlayer` in the same file
are a hook's name and correctly stay.

⚠ `awaitPlayerReady.ts:9` names `TrackPlayer.reset()` and was deliberately NOT
touched: it describes NATIVE behaviour that is still true, the file is not in
this diff, and editing it would widen the batch for no correctness gain.

### ⚠ A latent test gap this surfaced — pre-existing, NOT introduced, not fixed here

`playerSetup.test.ts`'s `jest.mock` factory omits **`AppKilledPlaybackBehavior`**.
`applyPlayerOptions` reads `AppKilledPlaybackBehavior.ContinuePlayback`, so that
read throws — and `ensurePlayerSetup` swallows the throw from `setupPlayerCore()`
by design, so the suite stays green while `updateOptions` is never reached. The
test asserts only `setupPlayer` (called first) and `isPlayerReady`, and never
asserts on `updateOptions`, so nothing catches it.

This is unchanged by the migration: `AppKilledPlaybackBehavior` was a named RNTP
import before and is a named adapter re-export now, and the adapter's re-export
is a lazy getter, so it yields the same `undefined` at the same moment. It is
recorded because it is precisely the trap the adapter header predicts — "a test
whose `jest.mock` factory omits `State` therefore re-exports `undefined` through
this file" — and because `settingsStore.test.ts` exercises the same
`applyPlayerOptions` with a mock that DOES name the enum, which is why the
options builder has real coverage at all. Fixing the mock belongs with ticket 08,
which verifies remote control for real.

### Deliberately not done

- **`footprintQueries.ts` still asks the Player where it is**, and still decides
  what Position is measured against. Its ⚠ comment already says the adapter pass
  does not fix this and names no file path. Untouched, per the acceptance
  criteria and ADR 0003's *Known incompleteness*.
- **No lint rule.** The ban is ticket 08's, and until it lands the unmigrated
  files must keep importing RNTP directly.
- **No adapter test suite.** Covered transitively by the 81 tests that already
  sit on this code; a suite asserting a passthrough passes through would test the
  implementation and no behaviour.
- **Hooks, components, screens and modals** (ticket 06), **the playback service
  and sleep timer** (ticket 07) are untouched.

### Device verification

Not attempted — this batch has no device-only surface that the 81 tests do not
already cover on the landing spot. The chapter-boundary checklist from ticket 03
belongs to tickets 09 and 10.
