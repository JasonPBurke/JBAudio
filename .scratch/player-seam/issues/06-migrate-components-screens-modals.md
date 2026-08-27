# 06 — Migrate components, screens and modals onto the adapter

**What to build:** List rows, player surfaces, screens and modals stop importing
a native module. A grid card's dependencies start describing a grid card.

**Blocked by:** 02, 04

**Status:** resolved

## Scope

Every imperative Player call under components, app screens and modals.

⚠ **Hook usage is NOT in this ticket.** Files here that also call the library's
React hooks keep doing so for now — the hooks are still permitted until ticket
10 closes the ban, and moving them is ticket 09's job, with its own device pass.
A file can and often will appear in both tickets; migrate only its imperative
calls here.

⚠ Ticket 02 should already have collapsed the four duplicated play handlers into
one. If those four sites still each hold their own copy, stop and finish 02
first — migrating four copies and then deleting three is wasted review.

## The change

Same two mechanical edits as ticket 05: direct library calls become adapter
imports, and fetch-item-then-take-bookId becomes a single active-Book read. Mind
the `undefined` → `null` change on that read.

## Acceptance criteria

- [x] No component, screen or modal makes a direct imperative call to the
      Player library
- [x] Hook imports are left alone, untouched, in every file
- [x] `tsc` 0, `eslint` 0, test count at or above ticket 01's baseline
- [x] No behaviour change: play from every surface that offers it still works
      — **driver-verified on device 2026-08-27**

## Answer

Eight files under `src/app`, `src/components` and `src/modals` stop making
imperative Player calls. Two more files in scope were left completely untouched
because they only ever used the hooks: `app/player.tsx` and
`components/FloatingPlayer.tsx`.

⚠ `components/PlayerStateSync.tsx` is the third untouched file and is **NOT** in
that category — see `### The one imperative call still standing` below.

Ticket 02's precondition held — the four duplicated play handlers were already
one (`helpers/playBookFromRow.ts`), so nothing was migrated and then deleted.

### Ticket 05's mechanical rule covered all but one site

Direct library call becomes the same call from the adapter; fetch-item-then-take -`bookId` collapses to a single `getActiveBookId()`. **Five** active-Book reads
collapsed, one per file: `timer.tsx:171`, `titleDetails.tsx:268`,
`PlayerControls.tsx:140`, `PlayerProgressBar.tsx:191` and
`SleepTimerOptions.tsx:117`. `grep -rn 'getActiveBookId()' src/app src/components
src/modals` returns exactly those five.

The `PlayerProgressBar` one is the only interesting shape: the Track fetch was
one of two racing reads inside a `Promise.all`, so the collapse changes what the
tuple destructures rather than removing a statement.

The `undefined` → `null` shape change was checked rather than assumed. The two
strict-`undefined` comparisons left in these files — `timer.tsx:198` and
`SleepTimerOptions.tsx:133` — both sit on `getActiveTrackIndex()`, which the
adapter still declares as `number | undefined`. Neither is a Track read.

### `timer.tsx` asked the Track two questions, and that needed a decision

Every other site read `?.bookId` and nothing else. This one read the Track for
**existence** as well:

```ts
const activeTrack = await TrackPlayer.getActiveTrack();
setHasActiveTrack(activeTrack !== null && activeTrack !== undefined);
...
if (activeTrack?.bookId) { ... }
```

The adapter exports no `getActiveTrack`, deliberately and with no escape hatch,
so "is a Book loaded?" had to be answered some other way. Two candidates:

1. `(await getActiveTrackIndex()) !== undefined` — the literal translation of
   the existence question, independent of `bookId` entirely, at the cost of a
   second native call.
2. `(await getActiveBookId()) !== null` — one call, correct **iff** no queue
   item can exist without a string `bookId`.

Took (2) after verifying the premise across every track-construction shape, not
sampling. There are **six** `add()` calls in `src/` and **five** distinct shapes,
because two of the calls pass the same builder:

| Shape                 | Built at                       | `add()` call                                                  |
| --------------------- | ------------------------------ | ------------------------------------------------------------- |
| single-file           | `handleBookPlay.ts:181`        | `:184`                                                        |
| multi-file            | `handleBookPlay.ts:201`        | `:205`                                                        |
| clipped               | `clippedChapters.ts:102`       | `handleBookPlay.ts:164` **and** `restoreLastActiveBook.ts:58` |
| single-file (restore) | `restoreLastActiveBook.ts:86`  | `:86`                                                         |
| multi-file (restore)  | `restoreLastActiveBook.ts:148` | `:148`                                                        |

Every one sets `bookId: <string>` off `Book.bookId`, which is a non-optional
`string`. Nothing else in `src/` calls `add()`: `service.js` never adds, and
Android Auto plays through `remotePlayBook.ts` → `handleBookPlay`, so it builds
no queue shape of its own.

The premise is written into the code as a comment, because it is the one place
in this ticket where the adapter's collapse is load-bearing rather than
cosmetic.

⚠ **The actual blast radius is zero, and finding out why turned up a dead
prop.** `hasActiveBook` is passed to `SleepTimerDurationCard`, which declares it
in its props type, destructures it in its signature, and **never references it
in its body** — `maxChapters` does all the gating (`chaptersToEnd >= maxChapters`
disables the plus button). ESLint does not flag it because destructured function
parameters are exempt under the default `args: after-used`. So if a sixth track
shape ever appeared without a `bookId`, the flag would go false while a Book was
loaded and nothing at all would change on screen.

Left in place rather than deleted: removing a dead prop is behaviour-neutral but
it is not an imperative Player call, and this ticket's scope is. **Follow-up:
delete `hasActiveBook` from `SleepTimerDurationCard` and stop computing it in
`timer.tsx`**, or wire it up if the gate was intended and got lost.

### `titleDetails.tsx` binds no local, on purpose

`activeBookId` is already taken in that file by the queue store's **Requested
Book** (`useQueueStore()` at line 70) — a different question from the Player's
**Active Book**, per `CONTEXT.md`. Rather than invent a third name or shadow the
existing one, the read stays inline:

```ts
if ((await getActiveBookId()) === book.bookId) {
  await stampLastPlayed(book.bookId);
  await recordFootprint(book.bookId, 'play');
}
```

Exactly equivalent — the guard proves the two are the same string — and it
leaves ticket 11's rename with one fewer site to reconcile rather than one more.

### `addEventListener` → `subscribe` in `BookTimeRemaining.tsx`

Three subscriptions (`PlaybackProgressUpdated`, `PlaybackState`,
`PlaybackActiveTrackChanged`). All three are typed `Event` members, so
`subscribe<T extends Event>` accepts them without a cast — the custom
`'remote-play-book'` string that ticket 12 has to answer for lives in
`service.js`, not here. `Event` and `State` moved to the adapter's re-exports
alongside them, per ticket 08's stage-one ban on named RNTP enum imports.

### Taking `State` and `Event` from the adapter is precedent, not ticket 08's job

Once the default `TrackPlayer` binding leaves a file, any named enum it also
imported has to come from somewhere. Ticket 05 already settled this: `State` in
`relativeSeek.ts` moved to the adapter in that commit, for the same reason. The
alternative — leaving `import { State } from 'react-native-track-player'` behind
— would strand an RNTP import that is neither a hook nor scheduled to move.

This is independent of ticket 08's lint rule, which bans the imports; the
adapter's re-exports are what make the ban _possible_, and they already exist.

⚠ The adapter's warning applies but bites nothing here: a `jest.mock` factory
that omits `State` re-exports `undefined` through the adapter. None of these
eight files has a test, so no mock is in play. It becomes ticket 08's problem the
moment one gets written.

### Hook imports were left alone, in every file

Nine RNTP imports survive under these three directories and every one is
hooks-only: `useActiveTrack` in seven files, plus `useIsPlaying` in
`titleDetails.tsx` and `PlayerStateSync.tsx`. Where a file had a combined
`import TrackPlayer, { useActiveTrack }`, only the default binding was removed.

⚠ `PlayerControls.tsx:363`'s `if (activeTrack?.bookId)` reads the **hook's**
track, not a fetched one, and was left exactly as it stands. It looks like the
sixth collapse candidate and is not one — that is ticket 09's.

### Vocabulary the migration falsified

Two comments named the library inside hunks being migrated off it —
`timer.tsx:162` and `PlayerProgressBar.tsx:188` — plus the two new explanatory
comments above. Same rule ticket 05 applied to `bookProgressState.ts:7`.

The same rule then applies to an **identifier**, which is why `hasActiveTrack`
became `hasActiveBook` (`timer.tsx` ×3, `SleepTimerDurationCard.tsx` ×2). Before
this change the name was honest: it held `activeTrack !== null && activeTrack
!== undefined`, literally "an active Track exists". After the collapse it holds
"a Book is loaded" — and `CONTEXT.md`'s **Active Book** entry lists _Avoid_:
"active track" by name. The migration made the name false, so the migration
fixes it.

⚠ This is the one edit in this ticket that touches a file with no Player call in
it (`components/settings/SleepTimerDurationCard.tsx`). It is a rename only.

### The one imperative call still standing

`components/PlayerStateSync.tsx:40` calls `isPlaying()`, imported by name from
RNTP. By the letter of this ticket's first acceptance criterion that is a direct
imperative call in a component, and it is still there.

It cannot be migrated: **the adapter does not export `isPlaying`, deliberately.**
Ticket 04 ruled on it explicitly, listed this exact call site
(`04-create-rntp-adapter.md:151`, "1 (`PlayerStateSync.tsx:40`)"), marked it
"❌ **still a hole**", and handed it to **ticket 09** — because it is not a hook
despite living in RNTP's `hooks/` folder, because it _derives_ rather than reads
(`getPlaybackState` + `getPlayWhenReady` + `determineIsPlaying`, neither helper
on the ratified surface), and because ticket 09 moves this whole file onto the
store mirror anyway. Classifying it here would pre-empt a decision that ticket
deliberately deferred.

So this ticket leaves it, and ticket 08's stage-one ban still cannot be clean
without either adding `isPlaying` to the surface or exempting this one file —
exactly as ticket 04 recorded.

### ⚠ Two files in this repo are committed with CRLF

`components/PlayerControls.tsx` and `modals/SleepTimerOptions.tsx`. A scripted
edit that reads and writes them in text mode normalizes the whole file to LF and
turns a 20-line change into a 1500-line diff — the edits are correct, the file
is rewritten. Caught here by the diffstat and restored; worth knowing before any
future scripted pass over `src/`.

### Zero test diff, and zero test coverage

No test file changed, for the same structural reason as ticket 05: the fake sits
below the adapter, so existing call assertions hold one frame deeper. But none
of these eight files has a test at all — the only `*.rn.test.tsx` files in the
repo are the three ladder hooks. The suite passing proves the helpers layer
underneath is intact; it proves nothing about these screens.

Gates on a cleared cache: tsc 0, eslint 0 errors (32 warnings, all pre-existing),
75 suites / 966 tests — identical to ticket 01's baseline.

### Deliberately not done

- **No hook migration.** Ticket 09's, with its own device pass. Six of these
  files appear in both tickets; only their imperative calls moved.
- **No lint rule.** Ticket 08's. `src/hooks`, `src/setup` and the tests still
  import RNTP directly and must keep being able to.
- **`getActiveTrackIndex()` still returns `undefined`, not `null`.** It is a
  queue-index read, not a Track read, and the adapter declares it that way.
- **`PlayerStateSync.tsx`'s `isPlaying()` call**, per ticket 04's ruling above.
  Ticket 09's.
- **The duplicated chapters-remaining block.** `timer.tsx:165-200` and
  `SleepTimerOptions.tsx:109-140` are the same seven-call shape and are now in
  identical adapter vocabulary, which makes the duplication more obvious than it
  was. Extracting a `chaptersRemaining()` helper would also make it testable in
  the fast `helpers` lane. Not done here: it is a behaviour-bearing refactor, and
  this ticket's criterion is "no behaviour change". **Worth its own ticket.**

### Device verification — ✅ PASSED 2026-08-27

**Driver-verified on device; every surface on the checklist passes.** This was
the real gate for the ticket: the batch has no automated coverage at all, so the
jest run only ever proved the helpers layer underneath was intact.

Surfaces exercised: the chapter list, the footprint list, title details, the
player screen's play/pause and skip-to-next, the progress-bar scrub, the floating
player, and the sleep-timer chapter counts in both `(settings)/timer.tsx` and the
`SleepTimerOptions` modal.

⚠ **The sleep-timer surfaces make no `play` call at all.** That came up during the
pass and is worth writing down, because it changes what testing them means. They
are read-only: each computes one number, `maxChapters`, from the live queue, and
it is observable only through the chapter stepper — the `+` dims at the ceiling,
and the label flips to "End of Book" at exactly `chaptersToEnd === maxChapters`.

Two things about them that are non-obvious and cost time to rediscover:

1. **Only the legacy single-file branch exercises what this ticket changed.**
   `getActiveBookId()` is the one non-passthrough on the adapter, and the
   multi-file/clipped branch never calls it — it uses `getQueue()` +
   `getActiveTrackIndex()`, both passthroughs. A multi-file book therefore tests
   almost nothing here. To land on the legacy branch reliably, use an
   **auto-chaptered** single-file book: `shouldUseClippedChapters` returns false
   if any chapter is `isAutoGenerated` (`clippedChapters.ts:75`).
2. **The two surfaces refresh differently.** `timer.tsx` uses `useFocusEffect`,
   so it recomputes on every focus. `SleepTimerOptions` is rendered inside
   `PlayerControls` with `useEffect(..., [db])`, so it computes when the player
   screen mounts and **not** when the bottom sheet opens — the sheet has to be
   dismissed and the player reopened to get a fresh count. A stale count there is
   pre-existing behaviour, not a regression.

### Spawned a follow-up ticket

`.scratch/sleep-timer-stepper/issues/01-clamp-modal-chapter-stepper.md` — the
modal's chapter stepper persists counts it refuses to display. Both `disabled`
props are commented out (`SleepTimerOptions.tsx:468` and `:511`), so the buttons
only dim, and both handlers write the DB unclamped while clamping local state;
`SleepTimerDurationCard` guards correctly. Found while writing the device-test
guide for this ticket, and **not caused by it** — every line involved predates
`756cbec` and was untouched by it.
