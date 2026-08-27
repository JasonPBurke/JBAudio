# 08 — Ban the imperative surface, and verify Remote control on device

**What to build:** The seam becomes real rather than agreed. A lint rule makes
the Player library unimportable outside the adapter for everything except the
React hooks — and a device pass proves the notification, the lock screen, the
headset and Android Auto all still drive playback exactly as they did.

**Blocked by:** 05, 06, 07

**Status:** ready-for-human

## The contract half — stage 1 of the ban

A restricted-import rule in `eslint.config.js`, written in that file's house
style: a **narrow** block with a comment recording what was *measured*, not
assumed. That file already carries two such blocks; match them.

- Applies to source.
- **Exempts the adapter, and test directories.** The test exemption is
  deliberate and honest: the fake plugs in there, so the rule reads *"only the
  adapter and its tests."*
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

- [ ] Notification transport: play, pause, next, previous
- [ ] Lock screen controls
- [ ] Headset button: single press, double press
- [ ] Android Auto: browse, select, transport, queue scroll
- [ ] Remote seek from the notification scrubber
- [ ] Remote jump forward and back land where they did before
- [ ] Chapter skip across a boundary, both directions
- [ ] Skip-previous restart threshold still behaves at the 15s line
- [ ] Sleep timer: duck, fade, end-of-chapter option
- [ ] Playback rate persists and applies
- [ ] Book-end detection still marks a Book Finished before the credits
- [ ] Cold start from a headset play, with no app UI ever opening

## Acceptance criteria

- [x] Stage-1 rule active; `eslint` 0 with it on
- [x] The only permitted library imports outside the adapter are the four hooks
      — **three hooks and one imperative read**; see `## Answer`
- [x] `tsc` 0, test count at or above ticket 01's baseline
- [ ] Every device row above run on **both** runtime Queue shapes, result
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

The ticket asked for the permitted names to *be* the migration tracker, and only
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
*three* library imports behind one waiver and quietly excused ticket 09's
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
which is precisely this ticket's last device row, *"Cold start from a headset
play, with no app UI ever opening"*. The ban would have been declared real while
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
nothing in jest touches `index.js` — no suite imports it. *"Android Auto: browse,
select, transport, queue scroll"* and *"Cold start from a headset play, with no
app UI ever opening"* are the only checks that exercise it at all. If the
registration were broken, every remote control would be dead and the app's own
UI would look perfectly fine.
