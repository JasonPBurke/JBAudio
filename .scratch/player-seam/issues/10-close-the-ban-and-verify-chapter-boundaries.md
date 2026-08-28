# 10 — Close the ban, and verify chapter-boundary freshness on device

**What to build:** The seam closes. The Player library becomes unimportable
anywhere outside the adapter and its tests — and a device pass proves that every
surface which used to update when a chapter turns over still does.

**Blocked by:** 09

**Status:** ready-for-human

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
- [ ] Every row of ticket 03's checklist run on **both** runtime Queue shapes
      — **not started. The driver's half.**
- [ ] Result recorded below under `## Answer`, including every row that failed
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

### The device pass — NOT RUN

None of ticket 03's twelve rows were run on hardware. No device or emulator was
driven in this session, and the checklist's entire premise is that a stale
render is indistinguishable from a correct one on screen — so nothing here
substitutes for it. **The full twelve rows on both runtime Queue shapes remain
owed**, and ticket 03's `### Producing each shape on a device` section has the
ffmpeg recipes for both (a ~90-minute chapterless MP3 seeked to 29:50 for the
one-item shape; two ~60 s files for the multi-item shape).

Carry ticket 09's `### Still owed` note into that pass as well: rows 5, 6, 7 and
11 are the ones exposed to the mirror's one-render latency, plus row 11's
off-boundary extra check (play a Book to the very end, let `PlaybackQueueEnded`
reset the queue, confirm the FloatingPlayer and its "N h M m left" text both
stay put rather than blanking).

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
