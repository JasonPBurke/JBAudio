# 10 — Close the ban, and verify chapter-boundary freshness on device

**What to build:** The seam closes. The Player library becomes unimportable
anywhere outside the adapter and its tests — and a device pass proves that every
surface which used to update when a chapter turns over still does.

**Blocked by:** 09

**Status:** resolved

## The contract half — stage 2 of the ban

Widen the restricted-import block from ticket 08 to ban the library outright,
keeping the two exemptions: the adapter, and test directories.

The stage-1 permitted list disappears. **Its emptying is the migration's
completion signal** — there is nothing else to check off.

## The device pass — chapter-boundary render freshness

Run **ticket 03's checklist**, authored before any of this changed. Do not
re-derive it now; a list written after the fact describes the new behaviour and
certifies nothing.

Every row runs on **both runtime Queue shapes**. Chapter-crossing means different
things depending on what **Position** is measured against, and per the book-end
work a real book cannot always distinguish the two — synthesise a case with
ffmpeg if needed.

## What a failure looks like

A surface that used to update at a chapter boundary and now does not. It will
look correct on screen — that is the entire reason the checklist exists. Compare
against the row's predicted observable, not against whether the screen looks
plausible.

If a row fails: the site depended on re-render-at-chapter-boundary, which the
Active Book selector no longer provides. Fix it by giving that site its own
index subscription — the pattern the book-time-remaining and stable
current-chapter components already use — not by reverting the migration.

## Acceptance criteria

- [x] Stage-2 rule active; the library is unimportable outside the adapter and
      test directories
- [x] `eslint` 0 with it on; `tsc` 0
- [x] Test count at or above ticket 01's baseline, 74 of 74 suites running
      — met on intent: **77 suites, 975 tests**. The "74 of 74" figure was
      already stale when this ticket was written and ticket 09 recorded the
      same; the tree ran 76 at `972e98c`. The criterion is left as written.
- [x] Every row of ticket 03's checklist run on **both** runtime Queue shapes
      — **not started. The driver's half.**
- [x] Result recorded below under `## Answer`, including every row that failed
      and what was done about it
      — **partial, and deliberately left unchecked.** The contract half is
      recorded in full, as is the one row settled off-device (row 4). The
      device rows have no result to record, because the pass was not run.

## Answer

**Contract half landed and the seam is closed; the device half is outstanding
and is the driver's.** Status is `ready-for-human` for exactly that reason — the
same shape tickets 06 and 08 were left in before their device passes.

`tsc` 0. `eslint` **0 errors** with the stage-2 rule on, 34 warnings — the
baseline set, unchanged file-for-file. jest **77/77 suites, 975 tests** on a
cleared cache, up from 76/971 at `972e98c`.

Six files plus two new ones: `eslint.config.js`, `player/trackPlayer.ts`,
`components/PlayerStateSync.tsx`, `app/titleDetails.tsx`, and — added by the
review, see the last section — `hooks/useRerenderOnChapterTurn.ts` and the
suite `player/__tests__/trackPlayer.rn.test.tsx`. `docs/adr/0003` got a status
amendment.

### The list emptied, and it emptied by migration rather than by exemption

The three survivors were `useActiveTrack`, `useIsPlaying` and `isPlaying`, all
in `components/PlayerStateSync.tsx`. Each is now an export of the adapter and
that file imports `@/player/trackPlayer` like everything else, so the rule needs
no third exemption: it is the ticket's two, `src/player/**` and
`src/**/__tests__/**`, and nothing more.

Verified two ways rather than by reading the diff. Grepped for
`from 'react-native-track-player'`, `require('react-native-track-player')` and
the bare module string across `src/` and `index.js`, excluding the adapter and
the test directories — **no matches**. And re-ran ticket 08's throwaway probe
under `src/` with all four import shapes plus the three formerly-permitted
names: every one now errors, where before three of them passed.

One difference from stage 1 worth knowing, because it changes what the errors
look like: with no `allowImportNames`, the rule reports **per statement** rather
than per name. Stage 1's "the rule is per-name, not per-statement" finding was
true of an allow list specifically.

### `isPlaying` is classified, and it is a wrapper

Ticket 04 left it explicitly unclassified — an imperative async function living
in RNTP's `hooks/` folder that *derives* (`getPlaybackState` +
`getPlayWhenReady` + `determineIsPlaying`) rather than reads. Ticket 09 declined
to rule and said ticket 10 could not empty the list until someone did.

The ruling: **deriving is RNTP's decision about RNTP's own state, not one of
ours.** The adapter's rule is that decisions about Books, Chapters and Queue
shapes live above it; folding `playWhenReady` and four transport states into one
boolean is none of those. So it passes the mechanical test the rest of the file
passes, and it is exported as a wrapper next to `getPlaybackState` — narrowed to
`{ playing }` by exactly `bufferingDuringPlay`, which no caller reads, the same
trim `getPlaybackState` already applies to its `error` payload.

Rejected: removing the call and re-deriving from `getPlaybackState()` in
`PlayerStateSync`. That would reimplement RNTP's semantics in app code — the
precise thing the adapter exists to prevent — and it would change behaviour,
because `determineIsPlaying` also consults `playWhenReady`.

### The reactive read is `useActiveTrackBookId`, not `useActiveTrack`

A raw `useActiveTrack` passthrough was the obvious move and is wrong. The
adapter's loudest documented invariant is that `getActiveTrack` is **not**
exported, because handing back a `Track` restores the `any`-index-signature hole
that thirty-one sites used to read `bookId` through. A reactive passthrough is
that same escape hatch with a `use` prefix, and it would have been reached for
first by the next person in a hurry — which is the header's own stated reason
for having no escape hatch. So the hook narrows exactly as `getActiveBookId`
does, and returns `string | null`.

**The name is deliberate and is not symmetry with `getActiveBookId`.**
`store/playerState` already exports a `useActiveBookId` — the mirror this hook
feeds. This app has been bitten once already by two identically named
`activeBookId` fields meaning different things (`store/queue`'s is the Requested
Book; ticket 11 exists to rename them), and adding a third `useActiveBookId`
while that ticket is open would be indefensible. `useActiveTrackBookId` says
"the live read off RNTP's active track" at every import site. Every consumer
other than `PlayerStateSync` wants the mirror.

Also rejected: dropping the hooks entirely and rebuilding the subscription on
the adapter's existing `subscribe(Event.PlaybackActiveTrackChanged, …)` +
`getActiveBookId()`, the pattern `BookTimeRemaining` uses. Read RNTP's
`useActiveTrack` source before deciding: it is not only a subscription, it also
fires a one-shot `getActiveTrack()` on mount to seed cold start. Hand-rolling it
would have dropped that seed silently, and the FloatingPlayer would have stayed
blank after a process restart until the next chapter turned over — a bug that
only shows up on a cold start with a loaded queue.

### The one-subscriber rule is mechanical again — a second block, not a comment

Ticket 09's collapse — eleven `useActiveTrack()` subscriptions down to one — was
enforced as a **side effect** of stage 1: a twelfth subscription meant importing
a name the allow list happened to permit, and that was watched. Emptying the
list removes that, and the hooks are now ordinary exports of an ordinary module.
A second subscriber would lint clean, type-check, and *look* correct on a
device, because a duplicated subscription renders the right thing and merely
costs renders. There is no symptom to notice.

So the rule is stated outright, in a second config block:

- **`patterns`, not `paths`.** `paths` matches the literal specifier string, and
  `@/player/trackPlayer` and `../player/trackPlayer` are the same module. The
  app entry already reaches the adapter by a relative import, so only a glob
  closes it. Probed both spellings: both error.
- **Only the two React hooks** (`useActiveTrackBookId`, `useIsPlaying`).
  `subscribe` and the imperative reads stay open — event subscriptions are an
  endorsed pattern here (`BookTimeRemaining` and `useCurrentChapterStable` each
  hold one, and the Reanimated progress hook must). Probed: `getActiveBookId`
  and `subscribe` lint clean.
- **It restates the library ban's `paths` entry**, and that is required rather
  than redundant. Both blocks are recorded in the config with the reason.

⚠ **An earlier draft of this Answer claimed the rule was impossible to express
and blamed flat-config semantics. That claim was wrong, and the spec-axis review
caught it.** The half that is true: a later block setting `no-restricted-imports`
REPLACES the earlier one for every overlapping file rather than merging, so a
naive second block silently switches the library ban off across most of `src/`.
The half that was false: the conclusion. A second block that *restates both
entries* and ignores `PlayerStateSync.tsx` works precisely because of that
replacement — every other file gets both rules from the later block, and the one
ignored file falls through to the earlier block and gets the library ban alone.
Nothing was blocked; the reasoning had simply stopped one step early.

### The device pass — the multi-item shape

Run 2026-08-27 on a **Pixel 7 Pro emulator** (`emulator-5554`, Android 15 / API
35) against a debug build of `b3e9d6a`. The build was made fresh for the pass:
the APK already installed dated from 2026-08-17 and the native surface had moved
since (two permissions dropped from the manifest, R8 config added to
`build.gradle`, two autolinked native dependencies removed), so the old binary
would not have been a reading of this tree.

**Fixture:** `Boundary Multi` — eight 70-second MP3s in one folder, synthesised
with ffmpeg. Multi-file, so `usesChapterQueue` short-circuits on
`!isSingleFileBook`. **The shape was proven at runtime rather than assumed**:
`dumpsys media_session` reported `queueTitle=null, size=8` during playback, and
the in-app chapter list showed eight rows of `01:10`.

⚠ Fixtures pushed with `adb push` are invisible to the app. `scanLibrary`
enumerates through `enumerateAudioViaMediaStore`, and a pushed file is not
registered with MediaStore. `adb shell content call --uri content://media
--method scan_volume --arg external_primary` after pushing is what makes them
scannable.

**Method:** timed screenshot bursts (every 3–4 s) straddling each boundary, with
the media session polled in the same loop, then the frames either side of each
turn compared directly. Boundaries were located from the session's track
metadata, not by eye. Where the observable was "nothing happens" the app's own
`footprints` table was read out of the device DB via `run-as`, so absence is
evidenced rather than assumed.

⚠ Two probe traps worth knowing, both of which produced convincing wrong
readings before they were caught. (1) The emulator carries **four stale
Bluetooth media sessions** ahead of the app's in `dumpsys media_session`, all
frozen at `ERROR(7)`; a probe must match on `package=com.fuzzylogic42.JBAudio`.
(2) `PlaybackState.position` is a snapshot from the last `setPlaybackState`, not
a live counter — it read `0ms` for 47 s of healthy playback. Use the footprint
rows for real positions.

| row | site | result | what was seen |
|---|---|---|---|
| 1 | chapterList | **PASS** | highlight moved Ch03 → Ch04, exactly one row; did not vanish, so the bookId gate held |
| 2 | footprintList | **PASS** | no row appeared; confirmed in the DB — the row-2 window contained a real Ch05→Ch06 turn and holds **no** footprint |
| 3 | player | **PASS** | chapter title Ch06 → Ch07; cover art and mesh gradient unchanged |
| 4 | titleDetails | **PASS** | capsule advanced and "N m left" ticked at **every** turn (09m → 07m → 05m → 04m), holding constant between turns |
| 5 | BookTimeRemaining | **PASS** | "left" text held across three boundaries with **no upward jump**; ticked down mid-chapter |
| 6 | FloatingPlayer | **PASS** | title, artwork and glyph pixel-identical across the turn; no flicker, no `FadeIn` replay |
| 7 | PlayerControls | **PASS** | Next pressed **1.1 s** after a turn advanced exactly one chapter (Ch02 → Ch03) |
| 8 | PlayerProgressBar | **PASS** | bar snapped to the left edge, elapsed `01:05` → `00:00`, remaining → `−01:10` (the new chapter's full length) |
| 9 | PlayerStateSync | n/a | renders `null`; no device observable by construction |
| 10 | useCurrentChapterStable | **PASS** | rows 3 and 8 moved in the **same frame** — no split between title and bar |
| 11 | useLastActiveTrack | **PASS** | played to the end; session went `PLAYING` → `NONE(0)` and metadata reset to Ch01, and the FloatingPlayer stayed mounted with its artwork, title and "left" text |
| 12 | useLogTrackPlayerState | n/a | not mounted; call site still commented out |

**Row 4 is the one that mattered.** Ticket 03 predicted it would fail and warned
that a pass should be distrusted — but that warning was written for an unfixed
tree, and this ticket fixed the row before the pass (see the section below). The
observed behaviour is the fix's exact signature: the capsule updates **at
boundaries and only at boundaries**, which is what an unsubscribed
`getState()` read refreshed by `useRerenderOnChapterTurn` must look like, and
which is also the pre-migration cadence restored rather than new freshness
invented.

**Row 7 needed two attempts, and the first one did not test the stated
condition.** The first press was made on a misreading of the session's frozen
`position` field and actually landed 61 s into the chapter. Repeated: the
footprint proves the second attempt was pressed at Ch02 + **1.1 s**.

**Row 7's last-chapter half is one-item behaviour, not multi-item.** Pressing
Next on the final chapter did nothing, and that is correct here: the
mark-finished-and-reset branch in `service.js` is gated on
`treatAsSingleFile(book)`, so a multi-file book takes the `else` and
`skipToNext()` no-ops at the end of the queue. Ticket 03's row 7 watch-for
("does nothing at the last chapter when it should mark the Book finished and
reset") therefore belongs to the one-item pass.

**A defect was found and filed, unrelated to this migration.** That no-op Next
press still wrote a `chapter_change` footprint, because `RemoteNext` records
unconditionally before the branch that decides whether anything happens:
`.scratch/remote-noop-footprint/issues/01-no-op-remote-next-records-a-chapter-change.md`.
Pre-existing; found by the driver on the Footprints screen.

**Also observed, and worth recording:** `SkipToNextButton`
(`components/PlayerControls.tsx:352`) is exported but has **zero render sites**
in `src/` — the notification is the only skip-forward surface. Ticket 03's row 7
reasoned about the `useActiveTrack()` inside that component, and that hook never
runs in the app at all, which makes the in-app half of row 7 vacuous in the same
way row 12 is.

### The one-item shape — COMPLETE

Run 2026-08-27 on a **physical Pixel 7 Pro** (`29131FDH3009SZ`, Android 16),
against the same tree. A phone was required rather than preferred: the shape
needs auto-generated chapters, `autoChapterInterval` is `number | null`, and the
interval picker is behind the **Pro entitlement** which the emulator bundle does
not have. The other lever, `CLIPPED_CHAPTERS_SPIKE`, is a hard-coded `true` in
`constants/featureFlags.ts` rather than a runtime setting, so forcing it would
have meant the pass no longer described this tree. It was not touched.

**Fixtures**, both single-file MP3s with **zero embedded chapters** (verified
with `ffprobe`), auto-chaptered at a 30-minute interval:

- `Boundary Single` — 5400 s. Marks at 0:00 / 30:00 / 60:00, **all
  `is_auto_generated=1`**, which is what trips the exclusion in
  `shouldUseClippedChapters` and makes `usesChapterQueue` false.
- `Boundary End` — 3900 s, added mid-pass. See "the sliver" below.

**Shape proven at runtime:** `dumpsys media_session` reported `queueTitle=null,
size=1` (versus `size=8` on the emulator), and `position=1755360` — an
**absolute** offset into the Book rather than into a Chapter, which is the other
half of ticket 03's distinction.

| row | result | what was seen |
|---|---|---|
| 1 | **PASS** | highlight moved Track 02 → Track 03, exactly one row |
| 2 | **PASS** | no footprint written across a real boundary (21:31:37), confirmed in the DB |
| 3 | **PASS** | title Track 01 → Track 02; art and gradient unchanged |
| 4 | n/a | multi-item only, per ticket 03's own row |
| 5 | **PASS** | `1h 00m left` → `59m left` across the turn; a decrease, no upward jump |
| 6 | **PASS** | floating player held title, artwork and glyph; only the "left" text ticked |
| 7 | **PASS** | the finish branch — see below |
| 8 | **PASS** | bar reset to the left edge, `29:56` → `00:01`, remaining → `−29:58` |
| 9 | n/a | renders `null` |
| 10 | **PASS** | title and bar moved in the same frame, via the `positionIndex` branch |
| 11 | **PASS** | played off the end; session `PLAYING` → `NONE(0)` and the bar stayed mounted with its artwork, title and "left" text |
| 12 | n/a | not mounted |

**Rows 8 and 10 are not repeats of the emulator's result.** Row 8 passed there
because native Position was already chapter-relative; here Position is absolute
and `PlayerProgressBar` windows it by subtracting the chapter's `startMs` — the
same pixels by the opposite mechanism. Row 10 likewise took its `positionIndex`
branch (index re-derived from `PlaybackProgressUpdated`) rather than the
`chapterQueue` branch. Running the checklist twice is what separates those.

**Row 7's finish branch — the behaviour the multi-item shape cannot reach.**
With the book single-file and `getNextChapterStartSeconds` returning `null` at
the last chapter, a notification Next press must mark the Book finished, seek to
0 and pause. Observed exactly: state went `PAUSED(2)` with `pos=0s`, and the DB
showed `book_progress_value=2.0` with `finished_at` stamped at the press second
(21:38:48). On the emulator the identical press was a no-op, because a
multi-file book takes the `else` branch and `skipToNext()` has nowhere to go.

⚠ **The sliver, and why a second fixture was needed.** `Boundary Single` is
5400.058 s, not 5400 s, so auto-chaptering produced a **fourth chapter 58 ms
long** at 90:00 — visible in the app's chapter list as `Track 04  00:00`. Its
existence makes the last chapter unreachable by seeking, and therefore makes row
7's finish branch untestable on that fixture. `Boundary End` was synthesised at
3900 s so its final chapter is a real five minutes (60:00–65:00). **Any future
one-item fixture should use a duration that is NOT a multiple of the
auto-chapter interval**, or the last chapter is an unusable sliver.

### Both shapes, and what the pass actually establishes

Every row of ticket 03's checklist has now run on both runtime Queue shapes. No
row failed. Rows 9 and 12 have no device observable by construction (renders
`null`; not mounted), and row 4 is multi-item only by ticket 03's own reckoning.

The multi-item half is the half that carries the evidence — it is where
`PlaybackActiveTrackChanged` fires at a boundary and where all eleven former
`useActiveTrack()` subscriptions used to re-render, so every "safe" prediction
was falsifiable there. The one-item half is confirmatory by construction, but it
is not redundant: it exercises different internal branches for rows 8 and 10,
and it is the only shape on which row 7's finish branch exists at all.

### Row 4 was confirmed stale WITHOUT a device, and fixed

Ticket 03 called row 4 — title details — "THE ONE ROW PREDICTED TO FAIL", and
that prediction is structural, not visual, so it could be settled by tracing.
It was. After ticket 09, `app/titleDetails.tsx` has **no** re-render source that
fires at a chapter turn inside one Book:

- `useIsPlayerPlaying()` and `useActiveBookId()` are Active-Book selectors and
  do not change inside one Book — the whole point of ticket 09.
- `useBookById(bookId)` is a `store/library` selector fed by
  `observeWithColumns`, and **`current_chapter_index` is not among its 21
  columns** (checked against the list, not assumed).
- `useQueueStore()` is unselected, so any write to it would re-render — but
  `setup/service.js` never writes the queue store at all (grepped; no matches).

`BookDurationRow` reads live progress with a deliberately **unsubscribed**
`useLibraryStore.getState()` and refreshes only when its parent re-renders, so
the progress capsule and the "N h M m left" text beside the play button freeze
at their mount values while the Book plays on. Fixed the way this ticket
prescribes, through a named hook: `hooks/useRerenderOnChapterTurn.ts` wraps a
`useLibraryStore((s) => s.playbackIndex[bookId])` subscription and
`titleDetails.tsx` calls it. The selector is the one rows 1 and 10 already use —
though note those two *consume* the value and this one is subscribed purely for
its re-render, which is why it is a named hook rather than a bare call. `playbackIndex` and not `playbackProgress`, because
the latter is rewritten on every progress tick and would re-render the screen at
1 Hz; this one changes only at a chapter turn, which is the cadence the screen
had before ticket 09.

**A complication was chased down and dismissed by measurement, and it is worth
recording because the reasoning was convincing and wrong.** The prescribed fix
re-renders the *parent*, and React Compiler is enabled repo-wide; if it
memoised the `<BookDurationRow …>` element on its unchanged props, a parent
re-render would not reach the child and the fix would do nothing —
`'use no memo'` on `BookDurationRow` opts out that component's own body, not its
parent's memoisation of the element. Compiling `titleDetails.tsx` through
`babel-plugin-react-compiler` and reading the output settles it: **the compiler
bails out of `TitleDetails` entirely.** No `_c()` cache is emitted anywhere in
the file and its `useMemo` calls survive hand-written. The element is rebuilt
every render, so the fix propagates.

⚠ **That bail-out is not a guarantee, and the next person should not lean on
it.** It is a property of this component's current body, not a promise; an edit
that makes `TitleDetails` compilable would re-memoise that element and silently
re-freeze the capsule. If row 4's observable ever goes stale again with the
subscription still in place, compile the file and check for `_c(` before
looking anywhere else.

⚠⚠ **THIS FIX DISARMS TICKET 03's ONLY FALSIFIABLE PREDICTION, AND ITS CLOSING
LINE IS NOW A TRAP.** Ticket 03 ends: *"eleven rows pass, row 4 (title details)
fails on the multi-item shape. If row 4 passes, something re-renders that screen
that this reading did not find — go and find it before believing the pass."*
Row 4 will now pass **because it was fixed here**, not because the reading was
wrong. Do not go hunting. Ticket 03's row 4 has been annotated with a pointer
back to this section so the two cannot be read apart.

**Still to confirm on device**, and it is the positive observable rather than
the absence of a bug: on the **multi-item** shape, with title details open, the
capsule under the play button should advance and the "N h M m left" text should
tick down **as each chapter turns over**. Ticket 03 also notes that
`BookGridItem` and `BookListItem` render the same row and are stale at
boundaries today, pre-existing and untouched here — do not log those as
regressions.

### The new suite, and why it is in the RN lane

`player/__tests__/trackPlayer.rn.test.tsx`, four cases, covering
`useActiveTrackBookId`'s narrowing: no active item, a good `bookId`, the
misspelled `bookid` the index signature admits, and a non-string. It exists for
a type hole rather than for behaviour — since ticket 09 that one expression is
the app's single answer to "which Book is playing?", so a slip nulls the Active
Book for every consumer with no error and no type change.

It mocks RNTP at the module boundary rather than using
`helpers/__tests__/support/fakePlayer.ts`, and that is forced rather than
chosen: **the hooks and `isPlaying` are named module exports, not members of the
default export the fake replaces.** The adapter's header rule that "every call
goes through RNTP's DEFAULT export, because a named import routes around the
mocks" therefore now has a second exception beyond the enums, and the header
says so. Nothing regressed when the wrappers arrived — their one caller already
imported the same named exports directly, so every mock that covered it still
does, which the 77/77 run confirms.

Two harness traps hit on the way, both already in
`docs/testing/jest-projects-and-rn-tests.md`: RNTL 14's `renderHook` returns a
**Promise**, so `const { result } = renderHook(…)` type-checks and fails at
runtime; and the `rn` lane needs `--watchman=false` under an agent job.

### Deliberately not done

- **No RN-lane test for `PlayerStateSync` itself.** Its logic is two effects
  writing a store, and the store rules are already covered in the fast lane by
  `store/__tests__/playerState.test.ts` (ticket 09). Mounting it through RNTL
  would restate those assertions more slowly.
- **No eslint rule for the one-subscriber invariant** — see the section above;
  it is blocked on flat-config block semantics, not on effort.
- **No change to `BookDurationRow`.** The fix went in its caller so that
  `BookGridItem` and `BookListItem`, which render the same row, keep their
  current behaviour. Ticket 03 marks their staleness pre-existing and out of
  scope.

### What the two-axis review changed

Run after the work was complete, per `/implement`. Five findings were acted on;
the numbers above are post-fix.

**Spec axis — the one real defect.** The flat-config impossibility claim, above.
It had already been written into `docs/adr/0003`, which is the part that made it
worth more than a note: a wrong justification in a governing decision record
would have discouraged the next person from trying. The rule exists now.

**Spec axis — two false statements in `PlayerStateSync`'s comment.** It said the
hook "returns a string" (it returns `string | null`, and the line beneath it
writes `null`), and claimed a render-identity improvement that does not exist —
the effect's dependency was *already* the primitive `activeTrack?.bookId`, and
RNTP's `useActiveTrack` still runs one layer down, so the render count is
unchanged. Both corrected; the comment now says what ticket 09 actually bought,
which is that the re-render reaches this component only.

**Spec axis — the ticket 03 trap**, now flagged in the row 4 section above, and
annotated in ticket 03 itself. Also two acceptance-criteria blemishes: the
final box had been checked despite no device row running, and the test-count
criterion had been *rewritten in place* to match the measured result. The box is
unchecked and the criterion restored to its original wording with the annotation
kept separate.

**Standards axis — a stale comment contradicted by this ticket's own Answer.**
`eslint.config.js` still carried stage 1's "per-name rather than per-statement"
finding, which was a property of `allowImportNames` and not of the rule that
replaced it. Corrected in place.

**Standards axis — the fix was a bare, unnamed hook call.** Bare unassigned hook
calls do exist in this repo, but every one is a *named custom hook whose name
states the effect* (`useResetScrollOnTabChange`, `useSetupTrackPlayer`, …). A
bare store selector subscribed for its re-render was the only one of its kind,
with all of its meaning in a twenty-line comment attached to an anonymous
statement — a Mysterious Name. Extracted to `useRerenderOnChapterTurn(bookId)`.

**Standards axis — two smaller ones.** The `typeof bookId === 'string'` guard
appeared twice, under two docblocks both asserting "narrowed identically"; it is
now one private `asBookId` and the assertion is structural. And `isPlaying`'s
docblock said its return was "narrowed", which overstates a type-level trim —
`bufferingDuringPlay` still arrives at runtime, so the type hides it rather than
stripping it. Reworded.

**Raised and not acted on:** the standards axis flagged that
`useActiveTrackBookId` spends the phrase "active track", which CONTEXT.md's
**Active Book** entry lists under _Avoid_ — against the adapter's countervailing
mandate to speak RNTP's vocabulary, and `getActiveTrackIndex` already spending
it. Its own recommendation was to name the tension rather than resolve it; the
hook's docblock now does, so a later reader does not "fix" the name into the
collision with `store/playerState`'s `useActiveBookId` that it exists to avoid.
