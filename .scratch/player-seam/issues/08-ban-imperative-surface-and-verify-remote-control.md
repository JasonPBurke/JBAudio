# 08 — Ban the imperative surface, and verify Remote control on device

**What to build:** The seam becomes real rather than agreed. A lint rule makes
the Player library unimportable outside the adapter for everything except the
React hooks — and a device pass proves the notification, the lock screen, the
headset and Android Auto all still drive playback exactly as they did.

**Blocked by:** 05, 06, 07

**Status:** resolved

## The contract half — stage 1 of the ban

A restricted-import rule in `eslint.config.js`, written in that file's house
style: a **narrow** block with a comment recording what was _measured_, not
assumed. That file already carries two such blocks; match them.

- Applies to source.
- **Exempts the adapter, and test directories.** The test exemption is
  deliberate and honest: the fake plugs in there, so the rule reads _"only the
  adapter and its tests."_
- Stage 1 bans the default export and the enums and types — all of which the
  adapter re-exports.
- Stage 1 still **permits** the four React hooks. Ticket 10 removes them.

⚠ **The permitted list is the migration tracker.** What remains allowed is
exactly what remains unmigrated, and it empties when ticket 10 lands. Do not add
a TODO comment or a tracking ticket to say the same thing worse.

⚠ The rule does not see `require()` or module-mock string literals. Both are
acceptable given the test exemption; note it in the block's comment so the next
reader does not think it was missed.

## Known incompleteness — do not "fix" it here

The persistence module still asks the Player where it is, and then decides what
**Position** is measured against. It goes through the adapter now, which changes
the colour of the coupling and not its direction. It is marked in place with a
rule-shaped comment that names no file path. Fixing it is the queue-shape work —
see `.scratch/queue-shape/spec.md`.

## The device pass — the Remote control surface

Both runtime Queue shapes. **Position** means different things in each.

- [x] Notification transport: play, pause, next, previous
- [x] Lock screen controls
- [x] Headset button: single press, double press
- [x] Android Auto: browse, select, transport, queue scroll
- [x] Remote seek from the notification scrubber
- [x] Remote jump forward and back land where they did before
- [x] Chapter skip across a boundary, both directions
- [x] Skip-previous restart threshold still behaves at the 15s line
- [x] Sleep timer: duck, fade, end-of-chapter option
- [x] Playback rate persists and applies
- [x] Book-end detection still marks a Book Finished before the credits
- [N/A] Cold start from a headset play, with no app UI ever opening

### Two rows in detail

Expanded on request after the contract half landed, in ticket 03's row format
(**Observable / Shape / Prediction / Watch for**) so one voice covers both device
passes. Derived by reading the handlers, not by running them — every prediction
here is falsifiable and the point of the pass is to falsify it.

**Producing each Queue shape: use ticket 03's recipe, do not re-derive it.**
`03-author-chapter-boundary-checklist.md` → `### Producing each shape on a
device`. In short: **multi-item** = any multi-file Book, or a single-file Book
with real embedded chapters that clears the heap gate; **one-item** = a
single-file Book that _fails_ `shouldUseClippedChapters`, and the only lever
reliable on demand is the auto-chapter exclusion (a single MP3 with no embedded
chapters, auto-chapters on). `CLIPPED_CHAPTERS_SPIKE` is `true`
(`constants/featureFlags.ts:12`), so a single-file Book with real chapters is
**multi-item**, not one-item — the trap is assuming "single file" means
"one-item queue". It does not.

⚠ **Run both rows on Android 12 as well as current.** The notification transport
was wholly broken there once — RNTP's `commandStarted` latch ate every custom
button — and the fix is a local patch, so it is only ever as alive as the last
`patch-package` run. There is an API 31 AVD for this.

---

#### Row 1 — Notification transport: play, pause, next, previous

**Before pressing anything, check the strip itself.** `helpers/playerSetup.ts:47`
declares `notificationCapabilities` as Play, JumpForward, JumpBackward,
SkipToNext, SkipToPrevious, Stop, SeekTo. ⚠ **`Capability.Pause` is commented out
of that list** (`playerSetup.ts:57`) while remaining in `capabilities` — so pause
must be reached through the play/pause _toggle_, and "the pause button is
missing" is the expected state, not a defect. If the toggle does not pause,
that is the defect.

**a. Play — `service.js:418`**

- **Observable:** audio resumes roughly **one second earlier** than where it
  paused. `RemotePlay` calls `seekBy(-1)` before `play()`, deliberately, to match
  the in-app button. A footprint of trigger `play` appears in the footprint list
  and `last_played_at` is stamped.
- **Shape:** both, but the rewind differs. `seekBy` is native and **clamps within
  the current queue item**, so on **multi-item**, pausing less than a second into
  a Chapter and pressing play must land at 0 of that Chapter — it must _not_ step
  back into the previous one. On **one-item** the same press rewinds across a
  Chapter boundary freely, because there is only one item to clamp inside.
- **Prediction:** safe on both.
- **Watch for:** _no_ rewind (the `state !== Playing && state !== Buffering`
  guard at `service.js:427` misfiring, which on Android Auto is what stops a
  redundant `play()` causing an audible skip-back); a _double_ rewind; or a
  footprint recorded against the wrong Book, which is what
  `isBookSwitchInProgress()` at `service.js:422` exists to prevent.

**b. Pause — `service.js:433`**

- **Observable:** audio stops, **the notification stays** and stays actionable,
  and the app leaves Android's _Active apps_ list promptly.
- **Shape:** both, no difference.
- **Prediction:** safe.
- **Watch for:** the notification disappearing on pause, or the app lingering in
  _Active apps_. Both are regressions of `stopForegroundGracePeriod: 0`
  (`playerSetup.ts:32`) and its accompanying RNTP patch, which hardcoded
  `startInForegroundRequired`. This is patch-borne behaviour: verify after any
  `npm ci`.

**c. Next — `service.js:466`. This is the row that earns the pass.**

The handler branches on the Queue shape and the two branches are barely alike:

- **one-item** (`treatAsSingleFile(book)` and more than one Chapter): reads
  `getProgress()`, computes `getNextChapterStartSeconds`, and issues a
  **`seekTo`** to that absolute offset. The queue item never changes.
- **multi-item** (everything else): a plain **`skipToNext()`**.

- **Observable:** on **one-item**, Position jumps to the next Chapter's absolute
  start and the Player is still on item 1 of 1. On **multi-item**, the queue item
  advances and Position resets to 0. A `chapter_change` footprint is written
  **before** the move, so it must point at where you _were_, not where you
  landed.
- **Shape:** both, and they must be checked separately — a pass on one says
  nothing about the other.
- **Also check the last Chapter, one-item only** (`service.js:488`): pressing
  next on the final Chapter marks the Book **Finished**, seeks to 0 and pauses.
  If the Book was _already_ Finished, the mark is skipped on purpose so
  `finished_at` is not dragged forward — press next twice on a finished Book and
  confirm the original timestamp survives.
- **Prediction:** safe, with one specific doubt below.
- ⚠ **Watch for the `getActiveBookId` narrowing, and know its signature.**
  `service.js:467` reads `getActiveBookId()`, and a `null` sends the press to a
  **bare `skipToNext()`** (`service.js:469`). The adapter narrows on `typeof
bookId === 'string'` (`player/trackPlayer.ts:99`), which is stricter than the
  `if (activeTrack?.bookId)` truthiness it replaced in ticket 07 — recorded there
  as latent, not live. **Its signature on the one-item shape is unmistakable: the
  next button does nothing at all**, because a bare `skipToNext()` on a one-item
  queue has nowhere to go. On multi-item the same fault is nearly invisible — it
  still advances an item; it merely skips the footprint and the Chapter logic. If
  next is dead on the one-item shape, this is the first thing to check, not the
  ban.

**d. Previous — `service.js:514`, via `helpers/chapterSkip.ts`**

- **Observable:** more than **15 s** into a Chapter, the press **restarts** that
  Chapter; at or under 15 s it goes to the **previous** Chapter. The footprint is
  labelled by which of the two the press resolved to — `chapter_restart` or
  `chapter_change`.
- **Shape:** both. On **multi-item**, "restart" is `seekTo(0)` and Position is
  already Chapter-relative. On **one-item**, `getPreviousPressTarget` computes an
  absolute target from the Chapter table.
- **Test the line, not the middle:** press at ~10 s and at ~20 s into a Chapter.
  The threshold compares _playback_ Position, so **at 2× speed the 15 s window
  passes in about 7.5 s of wall clock** — check it at a non-1× rate too, because
  that is the reading most likely to feel wrong and be right.
- **Prediction:** safe.
- ⚠ **Watch for next and previous disagreeing about the shape.** They do not ask
  the same question. Next branches on `treatAsSingleFile(book)`
  (`service.js:479`) — derived from the DB/library store. Previous branches on
  **`queue.length === 1`** (`chapterSkip.ts:48`) — read from the live Player.
  They are meant to name the same shape and normally do, but a Book missing from
  the library store makes them disagree. **The check is cheap: at a settled spot,
  press next then previous and confirm you return to where you started.** If you
  do not, note which of the two moved wrongly — that identifies which reading is
  the stale one.
- ❌ **FAILED ON DEVICE, 2026-08-27 — and my prediction here was wrong.** I wrote
  that at the _first_ queue item `skipToPrevious()` throws and is caught into a
  `seekTo(0)`, so the press restarts the Book. It does not. The driver found that a
  multi-file Book does **not** restart, and tracing the native stack agrees: the
  bridge resolves unconditionally (`MusicModule.kt:380-389`) and
  `exoPlayer.seekToPreviousMediaItem()` is documented as _"Does nothing if there is
  no previous item"_ (`QueuedAudioPlayer.kt:191-194`). The `catch` at
  `chapterSkip.ts:80-82` is dead code and its comment is false. **TICKET FILED:**
  `.scratch/skip-previous-first-chapter/issues/01-restart-book-at-first-queue-item.md`
  — pre-existing, affects the in-app control too, and a green test
  (`chapterSkip.test.ts:121`) is guarding the dead branch by forcing a rejection the
  bridge never produces.

**Cheapest verification surface for this whole row is the footprint list.** Every
press writes one, and the seek/next/previous footprints are awaited _before_ the
action specifically so they capture the pre-press spot. A footprint that records
where you landed instead of where you were means an `await` was dropped.

---

#### Row 2 — "Cold start from a headset play" — ⚠ THE ROW ITSELF IS MIS-SPECIFIED

**Rewritten 2026-08-27 after the driver rejected the first version. Both the row
as ticket 08 wrote it and my expansion of it were wrong, in two separate ways.**

**Objection 1, and it is correct: no app can own a bare headset press.** The
driver has Audible, Sonicbooks and Smart Audiobook Player installed and asked
which app a cold play press is supposed to start. There is no good answer.
Android routes a media button to the app holding the active — or most recently
active — media session; with nothing playing and no session alive, there is no
defined winner, and an app that _did_ grab it would be the one behaving badly.
**This reads as a bug, not a feature, and the row should not have asserted it as
one.** What is verifiable on our side is only that the service is _reachable_:
RNTP's manifest declares `MEDIA_BUTTON`, `androidx.media3.session.MediaLibraryService`
and `android.media.browse.MediaBrowserService` on `MusicService`. Reachable is not
the same as chosen.

**Objection 2, and this one is my error alone: `force-stop` makes the test
impossible.** `adb shell am force-stop` puts the package in Android's _stopped_
state, and a stopped package receives no broadcasts or background starts until
the user manually launches it again. So the procedure I wrote guaranteed the
press could never arrive. "This does not work" is the correct outcome of those
steps, not evidence about the app.

##### What the code actually implements, and what is therefore testable

`service.js:544-547` names it in as many words — _"Android Auto reconnect /
Android 11+ media resumption"_. Two real headless entries, both **user-initiated,
both unambiguous about which app is meant**:

1. **Android Auto browse and select** — `remote-play-book` → `handleRemotePlayBook`
   → `ensurePlayerSetup()`. Already its own row in this checklist.
2. **Android 11+ media resumption** — the user taps _this app's_ resumable player
   in the system media area. The system binds the MediaBrowserService,
   `Event.PlaybackResume` fires (`service.js:549`), and `restoreLastActiveBook()`
   loads the last Book **paused** at its saved position so the system's follow-up
   `play()` has a queue to act on.

A headset press belongs **after** one of those, not before: once resumption or AA
has brought the session up, the headset button drives it. That is a real behaviour
worth checking and it is what the code supports.

##### Re-specified row — run this instead

- **Preparation:** play the Book briefly so `getLastActiveBook()` is set, then
  pause. Get a genuinely cold process **without** the stopped flag:
  `adb shell am kill com.fuzzylogic42.JBAudio` (kills the process; unlike
  `force-stop` it does not mark the package stopped), or reboot the device.
  Confirm with `adb shell pidof com.fuzzylogic42.JBAudio` → no output. Start
  `logcat` before the trigger.
- **Trigger:** tap the app's entry in the system's resumable-media controls —
  **not** a headset button, and without opening the app.
- **Observable:** `[entry] index.js evaluated, playback service registered`
  appears; the Book loads paused at its saved position; a following play command
  (system control or headset press) starts audio, with no app UI ever drawn.
- **Shape:** both, and the landing spot is the whole point.
  `restoreLastActiveBook` restores differently per shape
  (`helpers/restoreLastActiveBook.ts:56-67`): **multi-item** builds per-Chapter
  tracks, `skip(chapterIndex)` then `seekTo(Chapter-relative offset)`; **one-item**
  loads a single track and seeks to an **absolute** offset via
  `calculateAbsolutePosition`. Verify it resumes in the right Chapter _and_ at the
  right offset within it — a shape bug lands at the correct seconds in the wrong
  frame of reference, which no screen will show you.
- **Prediction:** safe. The registration is a mechanical passthrough and the
  restore path is untouched by this ticket.
- **Watch for:** the entry log line missing → the migration broke the
  registration; playback starting at **0** → `getLastActiveBook()` or the restore
  seek failed; **silence with no error** → the historical signature of "Player has
  not been initialized" being swallowed headlessly, which is why
  `ensurePlayerSetup` exists (`playerSetup.ts:93`); needing a second press → the
  synchronous-listener guarantee at `service.js:400` breaking.

##### Still true, and still the reason this row matters

**No jest suite imports `index.js`.** This row and the Android Auto row are the
only checks that execute the entry-point migration at all. A break there is total
— every Remote control dead — while the app's own UI looks perfectly normal.

⚠ **The checkbox above still reads "Cold start from a headset play, with no app UI
ever opening" and should be re-worded before the pass is recorded.** Left as
written rather than edited unilaterally: it is the driver's row, this is a change
to what the ticket _asks for_ rather than to how it is run, and the same objection
may apply to how the Android Auto row is worded.

---

## Acceptance criteria

- [x] Stage-1 rule active; `eslint` 0 with it on
- [x] The only permitted library imports outside the adapter are the four hooks
      — **three hooks and one imperative read**; see `## Answer`
- [x] `tsc` 0, test count at or above ticket 01's baseline
- [x] Every device row above run on **both** runtime Queue shapes, result
      recorded below under `## Answer` including anything that failed
      — **outstanding, the driver's half**

## Answer

**Contract half landed; the device half is outstanding and is the driver's.**
Status is `ready-for-human` for exactly that reason — the same shape ticket 06
was left in before its device pass.

`tsc` 0, `eslint` 0 errors with the rule on (34 pre-existing warnings, byte-for-
byte the baseline set), jest **75/75 suites, 966 tests** on a cleared cache —
ticket 01's baseline. Three files: `eslint.config.js`, one mechanical passthrough
added to `player/trackPlayer.ts`, and the two-line import swap in `index.js` that
passthrough exists for — see `### The app entry was outside the ban` below.

### The rule is an allow list, not a ban list

The ticket asked for the permitted names to _be_ the migration tracker, and only
an allow list can be that. `no-restricted-imports` offers both shapes;
`allowImportNames` was chosen because a deny list would have to enumerate every
enum and type RNTP exports, and would silently admit any new one the library
adds. The allow list inverts that: anything new is banned by default, and
ticket 10 closes the seam by deleting four strings rather than by auditing an
export list. The block sits at the bottom of `eslint.config.js` in the house
style the two blocks above it set — narrow, and commented with what was
measured.

Exemptions are the two the ticket named and no others: `src/player/**` and
`src/**/__tests__/**`. Both are load-bearing today rather than precautionary —
the adapter imports the default export, the enums and the types, and nine test
files import the default export to drive `jest.mock` — four of them an enum as
well.

The scope is `['src/**', 'index.js']`, and the second entry is the subject of
`### The app entry was outside the ban` below.

### Four import shapes fire; three are invisible. Measured, not assumed.

Run against a throwaway probe file under `src/`, deleted afterwards. The first
group is worth recording because every one of them is easy to believe is exempt:

- `import TrackPlayer from '...'` — fires, reported as the name `default`
- `import { Capability } from '...'` — fires
- `import type { Track } from '...'` — fires (the base rule, no
  `@typescript-eslint/no-restricted-imports` needed)
- `import * as TP from '...'` — fires, with its own `* import is invalid`
  wording

And a mixed `import { State, useIsPlaying }` fires on `State` alone, leaving the
permitted name unreported — so the rule is per-name, not per-statement.

The three it does not see: `require(...)`, the module-name string literal in
`jest.mock(...)`, and a bindingless `import 'react-native-track-player'`. The
first two occur only under the exempted test directories. The third is not a
hole at all — it binds nothing, so it cannot reach the library's surface; it
would only run the module for side effects, which is not what this rule exists
to stop. All three are recorded in the block's comment so the next reader does
not think they were missed.

### The ticket's "four React hooks" is three hooks and one imperative read

Not a gap in the work — a miscount in the ticket, the same way ticket 07 carried
two. Recorded here so ticket 09 does not re-derive it.

Measured by emptying `allowImportNames` and reading the census off `eslint`.
**15 sites across 12 files** — 15 and 12 differ because `titleDetails.tsx` and
`PlayerStateSync.tsx` each import more than one permitted name:

- `useActiveTrack` ×11 — `app/chapterList.tsx`, `app/footprintList.tsx`,
  `app/player.tsx`, `app/titleDetails.tsx`, `components/BookTimeRemaining.tsx`,
  `components/FloatingPlayer.tsx`, `components/PlayerControls.tsx`,
  `components/PlayerProgressBar.tsx`, `components/PlayerStateSync.tsx`,
  `hooks/useCurrentChapterStable.ts`, `hooks/useLastActiveTrack.tsx`
- `useIsPlaying` ×2 — `app/titleDetails.tsx`, `components/PlayerStateSync.tsx`
- `useTrackPlayerEvents` ×1 — `hooks/useLogTrackPlayerState.tsx`
- `isPlaying` ×1 — `components/PlayerStateSync.tsx:4`

The first three lines are ticket 09's census exactly (`×11`, `×2` both already
among the 11, `×1`). The fourth is **not a hook**: it is the imperative read
ticket 04 deliberately left standing, the `AppState`-foreground resync that
exists because `useIsPlaying()` is purely event-derived.

It is in the allow list rather than exempted by file, and that was the choice
worth making. Exempting `PlayerStateSync.tsx` wholesale would have hidden its
_three_ library imports behind one waiver and quietly excused ticket 09's
largest single file from the ban. Allowing the name keeps all four visible in
one list that ticket 10 empties. `isPlaying` is not re-exported by the adapter
today, so the list is honest about it being unmigrated rather than papering over
it.

⚠ **Forward risk for ticket 10, raised by the Spec review.** Ticket 09's scope is
"the library's React hooks", and `isPlaying` is not one — its `AppState`
foreground resync is not clearly covered by any ticket's text. Ticket 10 says
"the stage-1 permitted list disappears", which it cannot do while an import
survives with no adapter export behind it. **Either 09 removes the call or the
adapter gains `isPlaying` before 10 lands.** Deliberately not resolved here:
ticket 04 recorded that classifying it would be a guess, and ticket 09 may
restructure `PlayerStateSync.tsx` entirely.

### The app entry was outside the ban, and that was the real hole

Caught by the Standards review, not by the first pass, and it was the one finding
that mattered. `files: ['src/**']` reads as "all the source" and is not — the
Expo entry is the repo-root `index.js`, and it was doing:

```js
import TrackPlayer from 'react-native-track-player';
TrackPlayer.registerPlaybackService(() => playbackService);
```

Confirmed rather than argued: `npx eslint --print-config index.js` returned
`no-restricted-imports: None` while the same command on `src/app/player.tsx`
returned the rule.

That is the worst possible file to have missed. Its own comment says the
registration must live in the entry because a route module never executes on a
headless start — Android Auto or a headset connecting to a process with no UI —
which is precisely this ticket's last device row, _"Cold start from a headset
play, with no app UI ever opening"_. The ban would have been declared real while
exempting the file the Remote control surface depends on most.

Fixed rather than recorded as incompleteness, because "the only permitted
imports outside the adapter are the four hooks" is false while that file stands
and no amount of commentary makes it true:

- `registerPlaybackService` is now a mechanical passthrough on the adapter
  (`player/trackPlayer.ts`, Setup section) — a 23rd wrapper, no decision in it,
  carrying the entry's headless-start reason so the constraint is not only at
  the call site.
- `index.js` imports it by relative path (`./src/player/trackPlayer`), matching
  its existing `./src/setup/service` and asking nothing of the `@/` alias at the
  entry point.
- The rule's scope became `['src/**', 'index.js']`.

Adding to the adapter's surface here follows the precedent the adapter's own
re-export header sets: ticket 04 admitted two enums for exactly this reason,
"without them that file could not come off RNTP and the ban's stated premise
would simply be false". Allow-listing the name instead would have parked a fifth
unmigrated import in a list ticket 10 empties, with no adapter export behind it.

`index.js` is the only production file outside `src/` that imports the library —
measured across the tree, not assumed; the only other non-`src` hit is
`eslint.config.js` naming it in the rule. Coverage was then proved the same way
the gap was found: a default import planted in `index.js` fires, and the file
was restored.

### Known incompleteness — verified present, not re-added

The persistence module's rule-shaped comment already exists, at
`db/footprintQueries.ts:24-44`. It names no file path, states the rule in a form
that survives without a pointer ("NOTHING under `db/` may decide what Position is
measured against"), and says in as many words that the adapter pass changes the
colour of the coupling and not its direction. It was checked and left exactly as
it stands. Nothing was added.

### One observation, deliberately out of scope

`.eslintignore` is still in the repo and ESLint 9 no longer reads it — every run
prints `ESLintIgnoreWarning`. It has no bearing on this ticket (the new block
scopes to `src/**`, and the full-tree error and warning counts are unchanged
from baseline either way), so it was not touched. Filing it is a judgement call
for the driver, not this ticket's business.

### The device pass

Not run. Twelve rows across the notification, lock screen, headset, Android Auto
and cold-start surfaces, each on **both** runtime Queue shapes — a hardware pass,
and the same gate ticket 06 was held to. Checkboxes above are left unticked.

⚠ **Two rows now carry more weight than the ticket gave them.** The entry-point
migration above moved the headless-service registration onto the adapter, and
nothing in jest touches `index.js` — no suite imports it. _"Android Auto: browse,
select, transport, queue scroll"_ and _"Cold start from a headset play, with no
app UI ever opening"_ are the only checks that exercise it at all. If the
registration were broken, every remote control would be dead and the app's own
UI would look perfectly fine.
