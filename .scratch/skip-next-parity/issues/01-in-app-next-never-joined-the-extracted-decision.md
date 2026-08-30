# 01 — The in-app next button never joined the extracted next-press decision

**What to build:** `SkipToNextButton` delegates to the same shared next-press
decision the notification player and Android Auto use, the way
`SkipToPreviousButton` already delegates to `skipToPreviousChapter`. Today it
carries a fourth, hand-rolled copy of that decision that has already drifted
from the extracted one in five separate ways.

**Status:** resolved

**Found:** 2026-08-29, in the whole-branch Standards review of the player seam
(branch `review/player-seam-full`, base `4b8fe75`), as finding 4. Pre-existing —
the seam work extracted the previous side and the remote next side, and left
this one behind.

**Not a live user-facing bug.** `SkipToNextButton` currently has **zero render
sites** (confirmed: `grep -rn SkipToNextButton src` returns only its own
definition and a comment in `remoteNext.ts:13` noting the fact). The driver has
ruled it is kept deliberately, for a future in-app skip-forward surface. That
ruling is what makes this worth fixing rather than deleting: the copy is
unrendered and untested, so it drifts silently and will be wrong on the day it
is finally wired up.

## The asymmetry

The previous side was extracted. `src/components/PlayerControls.tsx:323`:

```ts
export function SkipToPreviousButton({ iconSize = 30 }: PlayerButtonProps) {
  const handlePress = async () => {
    // Shared with the RemotePrevious handler in setup/service.ts: >15s into
    // a chapter restarts it, within the first 15s goes to the previous
    // chapter — notification, Android Auto and in-app behave identically.
    await skipToPreviousChapter();
  };
```

One line, one shared helper (`chapterSkip.ts:47`), an optional `onBeforeSkip`
callback that `service.ts:533` passes and the button deliberately does not.
That is the target shape.

The next side was not. `src/components/PlayerControls.tsx:343-383` still holds
the whole decision inline:

```ts
const queue = await getQueue();
const isSingleFile = queue.length === 1;

if (isSingleFile && book?.chapters && book.chapters.length > 1) {
  const { position } = await getProgress();
  const nextStart = getNextChapterStartSeconds(book.chapters, position);
  if (nextStart !== null) {
    await seekTo(nextStart);
  } else {
    // At last chapter: mark finished, reset and stop
    if (activeBookId) {
      const bookModel = await getBookById(activeBookId);
      if (bookModel) {
        await bookModel.updateBookProgress(BookProgressState.Finished);
      }
    }
    await seekTo(0);
    await pause();
  }
} else {
  await skipToNext();
}
```

Meanwhile the same decision lives, tested, in `chapterSkip.ts:166
resolveNextPress` (which returns `'chapter' | 'skip' | 'finish' | 'none'`) and
is executed by `remoteNext.ts:79 handleRemoteNextPress`, whose sole caller is
`service.ts:517`.

## How the copy has already drifted

Five differences, each traced against the extracted path:

1. **No `'none'` case.** `resolveNextPress` returns `{ kind: 'none' }` at the
   last queue item and `handleRemoteNextPress` returns early. The button calls
   `skipToNext()` unconditionally on that branch. Per the repo's own finding,
   `skipToNext()` at the queue edge is a **silent no-op that resolves** — so the
   button's else-branch cannot tell "moved" from "did nothing".

2. **It derives queue shape from `queue.length === 1`.** `resolveNextPress`
   takes `treatAsSingleFile` as a **parameter**, and `chapterSkip.ts:159`
   explains why at length: whether a single-file Book loads as one queue item or
   one item per chapter is the clipped-chapters memory gate's verdict, not the
   chapter list's. A clipped Book is single-file in the DB and a chapter queue at
   runtime. The button re-derives it from the one mechanism ADR 0003 explicitly
   defers to `.scratch/queue-shape/spec.md` as one of five competing answers.

3. **It records no footprints.** `handleRemoteNextPress` takes
   `onBeforeChapterChange` and `onBeforeLeaveBook`, awaited **before** the
   seek/skip, because a footprint is a breadcrumb to the spot the user left. An
   in-app next press would leave no breadcrumb while the identical notification
   press leaves one.

4. **Its finish branch still carries a bug that was already found and fixed on
   the remote side.** `remoteNext.ts:115-140` does three things the button does
   not:
   - guards the mark with `book?.bookProgressValue !== BookProgressState.Finished`,
     so a press inside the lead window does not rewrite an already-set
     `finished_at`;
   - calls `resetBookToStart(bookId, chapterTracking)` last — **this is exactly
     `.scratch/remote-noop-footprint/issues/02-*.md`**, whose symptom was "the
     chapter list highlights the last chapter of a Book that had just been reset
     to 0". The button reproduces the pre-fix code verbatim;
   - documents the ordering (reset LAST, deliberately) that the fix depends on.

5. **No failure isolation.** `remoteNext.ts:69 withoutBlockingThePress` wraps
   every bookkeeping call so a DB failure cannot cost the user the press. In the
   button, a throw from `getBookById` or `updateBookProgress` escapes
   `handlePress` and skips the `seekTo(0)` and `pause()` below it.

## Decisions the driver must make

- **Which module owns the shared next press.** The previous side put it in
  `chapterSkip.ts`; the next side's executor is in `remoteNext.ts`, whose name
  says "remote" and would then have a non-remote caller. Renaming it (or moving
  it to `chapterSkip.ts` beside its sibling) is the CONTEXT.md rule — *name a
  key after the question it answers* — applied to a module. Deciding this is
  most of the ticket.

- **How the button gets `treatAsSingleFile` and `chapterTracking`.** Both are
  module-private in `service.ts` (`:89` and `:94`); `singleFileChapterState` is
  mutable module state the service owns. The button cannot reach either today,
  and exporting service state to a component is very likely the wrong answer.

- **Whether the in-app press should record a footprint at all.** The previous
  side's answer was *no* — `SkipToPreviousButton` passes no callback, because
  footprints exist for presses the user makes when they cannot see the app.
  Same answer here would be consistent; it should be stated, not defaulted.

## Acceptance criteria

- [ ] `SkipToNextButton` contains no queue-shape branch, no
      `getNextChapterStartSeconds` call, and no finished-marking of its own.
- [ ] The next press has exactly **one** implementation of the
      `chapter`/`skip`/`finish`/`none` decision. `relativeSeek.ts:188`'s
      finish-a-Book triple is reviewed in the same pass and either folded in or
      explicitly justified as distinct.
- [ ] The button's finish path performs the `Finished` guard and the
      `resetBookToStart` rewind, so ticket `remote-noop-footprint/02`'s bug
      cannot come back through this door.
- [ ] The three decisions above are recorded in this file under `## Answer`.
- [ ] Tests cover the button's press through the shared helper. `fakePlayer.ts`
      already simulates the native seek clamp and queue-edge no-op, so the
      queue-edge case is assertable without a device.
- [ ] `tsc` 0, `eslint` 0 errors, full suite green.

## Notes

- ⚠ **Do not delete `SkipToNextButton`.** Driver ruling, 2026-08-29: it is kept
  for a future in-app skip-forward surface.
- ⚠ **Do not "fix" the `queue.length === 1` question here.** That is
  `.scratch/queue-shape/spec.md`, still `needs-triage`, and ADR 0003 deliberately
  refuses to answer it inside the adapter. This ticket adopts whatever the
  extracted path already does and changes no verdicts.
- The device pass for this is cheap only once the button is rendered somewhere.
  Until then the acceptance gate is the test suite, not a device.

## Answer

Grilled with the driver 2026-08-30. All three open decisions settled, plus a
fourth the grilling surfaced. **The scope changed** — see *What the grilling
changed* below before reading the acceptance criteria.

### 0. The premise changed: both skip buttons are about to be rendered

Driver ruling, 2026-08-30: **`SkipToNextButton` AND `SkipToPreviousButton` are
both going into `player.tsx` in the near future.** The `## Notes` ruling above
("kept for a future in-app skip-forward surface") is now dated — that future is
next.

`SkipToPreviousButton` also has **zero render sites** today. The player row is
`PlaybackSpeed · SeekBack · PlayPause · SeekForward · SleepTimer`. That matters
because this file's third decision leaned on the previous side having *answered*
the footprint question. It did not. It carries an **unexercised default** in
code nobody has ever run, and that default is about to go live alongside this
one.

### 1. In-app skip presses DO record footprints, matching remote

**Decision: record, identically to the remote handlers.**

The rationale this file proposed — *"footprints exist for presses the user makes
when they cannot see the app"* — is **rejected**; it is not the rule the codebase
follows. `activeBookFootprints.ts`'s header already states the membership test,
and it names in-app transport controls explicitly. The in-app PlayPause resume
path already records one while the user is looking straight at the screen.

The real rule, surfaced by a driver correction during the grilling:

> **The press type decides, and both surfaces agree.**

Checked across every press in the app, and it already holds everywhere except
the two unrendered buttons:

| Press type | In-app | Remote | Symmetric? |
| --- | --- | --- | --- |
| Play / resume | records | records | ✅ |
| 30s jump fwd/back | never | never | ✅ *deliberate* |
| Progress-bar scrub | records | records | ✅ |
| Skip previous | **nothing** | `chapter_change` / `chapter_restart` | ❌ |
| Skip next | **nothing** | `chapter_change` | ❌ |

⚠ **The 30-second jumps must keep recording nothing, on BOTH surfaces.** They
are not an oversight. `Event.RemoteJumpForward`/`Backward` route through
`seekForward`/`seekBack`, which record nothing by design; `Event.RemoteSeek` is
the notification's **seek-bar drag**, which mirrors the in-app scrub and does
record. Do not "fix" the jumps into recording.

**Scope consequence:** `SkipToPreviousButton` must now pass the `onBeforeSkip`
callback it currently omits. That is new work this file did not originally ask
for.

`CONTEXT.md` gained a **Footprint** entry in this session carrying this rule.

### 2. `treatAsSingleFile` moves to `clippedChapters.ts`

**Decision: move it, beside the gate it wraps.**

This file's framing of the problem was wrong and should not be trusted on a
re-read. It says `treatAsSingleFile` and `chapterTracking` are both "module-private
service state" and that exporting them to a component "is very likely the wrong
answer." That is true of one and false of the other:

- `treatAsSingleFile(book)` is a **pure function of the Book** —
  `isSingleFile && !shouldUseClippedChapters(chapters)`. `shouldUseClippedChapters`
  documents its own purity as a *requirement* ("every call site … has to reach the
  same verdict"), and the heap limit it consults is read from native once and
  cached, constant for the process. There is no state to reach.
- Only `chapterTracking` is genuinely mutable state. See decision 3.

Moving it is what makes acceptance criterion "exactly one implementation" true,
and it **deletes one of the four `queue.length === 1` sites** that
`.scratch/queue-shape/spec.md` is chartered to fix.

⚠ **This is a waypoint, not a ruling.** Queue-shape is expected to supersede
`treatAsSingleFile` with a real shape resolver. Its new home in
`clippedChapters.ts` must not be read as having pre-empted that spec — it
deduplicates an existing answer and adopts no new verdict, exactly as the
`## Notes` warning requires. When queue-shape lands it updates one shared helper
instead of chasing this button separately.

### 3. The chapter-tracking singleton is extracted, behind a narrowed verb

**Decision: extract the instance to its own module. The executor keeps its
injected parameter. The rewind is exposed as a named verb, not field access.**

The constraint is that the button's finish path must rewind **the same object
instance** the progress handler mutates each tick — a fresh object leaves
`lastChapterIndex` at the final chapter, and the next tick after the user hits
play records a spurious `chapter_change`. Decision 1 makes that misfire *more*
visible, not less.

Two facts shaped this:

- The singleton has **two roles**. The playback service is a *cursor advancer*
  (reads both fields, derives `wasChapterChange` from the previous value, writes
  both). Every external caller is a *rewinder* — `resetBookToStart` blind-writes
  `{0, bookId}` and never reads. Only the trivial half needs to leave the
  service.
- **`service.ts` is a leaf module.** Nothing in `src/` imports it; every
  reference is a comment. Its only importer is `index.js`, via
  `registerPlaybackService`. It holds nine module-scope mutable `let`s. Making a
  React component its first real importer would invert that edge.

So: a module owns the instance and exports `rewindChapterTracking(bookId)` for
the rewind path, while the service keeps direct field access for its per-tick
read-modify-write. The `SingleFileChapterTracking` **type already lives outside
the service** (in `resetBookToStart.ts`); this finishes a move that was already
mostly done.

**Rejected alternative — keep the singleton service-private and route the
button's finish press back through the service via a registration slot.**
Because `service.ts` is a leaf, this needs a registry the service populates at
startup. It *hides the pointer but exports the power*: every caller of the
registered handler mutates the singleton transitively, so "only one module can
corrupt it" becomes true syntactically and false operationally. It also trades
one mutable module-scope singleton for another with worse failure modes — a
null-handler window on cold start that **drops the press silently**, which is the
same "resolves having done nothing" class this whole ticket exists to remove.
ADR 0003 rejected the same shape as its alternative C.

⚠ This decision assumes the playback service runs in the **same JS context** as
the UI, which it does today (`index.js` registers it). If that ever changes, a
shared module singleton silently becomes *two* instances and this must be
revisited — message-passing would then be the only correct shape.

### 4. Name the module after the question, not the caller

**Decision: rename. The module stays exactly where it is.**

- `remoteNext.ts` → `nextPress.ts`
- `handleRemoteNextPress` → `handleNextPress`
- `recordRemoteSeekFootprint` → `recordActiveBookSeekFootprint`
- `recordRemoteChapterChangeFootprint` → `recordActiveBookChapterChangeFootprint`

The module's *contents* are already right — the ordering rule, the failure
isolation, the `'none'` guard, the finish triple. The only thing wrong is that
its name encodes a caller that stops being the only one the moment decision 1
lands. That is ADR 0003's closing lesson applied a fifth time: **name a thing
after the question it answers.** The two footprint recorders are the same
problem, and their own module already has the right convention —
`recordActiveBookFootprint` and `recordActiveBookPlayFootprint` are correct; the
two `Remote*` ones are the outliers.

**Rejected — fold the executor into `chapterSkip.ts`** (this file's own
suggestion, and the option it called "most of the ticket"). `chapterSkip.ts` has
**zero `@/db/` imports**: it is decisions over the adapter and the store, nothing
persisted. The executor imports `getBookById` and pulls in `resetBookToStart` →
`updateChapterProgressInDB`. Merging would drag persistence into the one module
that has stayed free of it — the same line ADR 0003 decision 2 draws for the
adapter ("the IO half must not decide"). It would also make a ~340-line module
doing two jobs.

**Rejected — a new `transportPresses.ts` holding both executors.** It would move
working, device-verified code for symmetry's sake, and force the previous side's
*fused* decision+execution in beside next's *split* one. The decision/execution
split is the better shape; if anything the previous side should follow next here
eventually, not the reverse.

### 5. The `Finished` guard in `relativeSeek` is folded in here

**Decision: add the 3-line already-`Finished` guard to `seekForward`'s finish
branch as part of this ticket.** Everything else in that branch stays with
ticket `02`.

Marking a Book Finished is guarded at **three** of the four sites that can do
it — the 1 Hz lead-time tick (latch + store check), `PlaybackQueueEnded`, and
this ticket's own next-press finish branch. `seekForward` is the one hole.

⚠ **Be honest about why, because the obvious reason is wrong.** This was first
filed as a data-corruption fix: a jump inside the book-end lead window rewrites
`finished_at`, which orders the Finished tab. **That harm does not exist**, and
the ticket that claimed it has been corrected. `finished_at` has exactly one
consumer (the Finished-tab sort), and the two writes can only ever be seconds
apart, because:

- `restoreLastActiveBook` restores a single last-active Book id, so a Book
  parked in its credits is not what comes back days later; and
- playing a Finished Book from a card or titleDetails **restarts it at 0:00 and
  demotes it off `Finished`** (§C5's restart in `handleBookPlay`), which also
  nulls `finished_at`.

So for another Book's `finished_at` to land between the two writes the Active
Book must change — and changing back destroys the precondition. The window is
closed structurally, not just improbably.

**It is included anyway, for one reason: it completes an invariant three other
sites already pay for.** A fourth site that quietly violates D5 is how a future
reader concludes the guard is optional — which is precisely how the finish
triple became four copies. It is 3 lines and a store read, in a branch this
ticket's renames already touch. It is NOT justified by user-visible harm, and
this file should not be re-read as claiming otherwise.

It does **not** depend on decision 3's extraction: the guard reads the Book's
progress value from the library store, exactly as the next-press finish branch
does. Only the *rewind* needs `rewindChapterTracking`, and that stays in `02`.

### What the grilling changed

- **Scope grew**: `SkipToPreviousButton` is in scope now (decision 1).
- **Scope grew**: four renames (decision 4).
- **A premise was overturned**: `treatAsSingleFile` is not state (decision 2).
- **This file's preferred module answer was rejected** on dependency evidence
  (decision 4).
- **Two spin-offs filed**, deliberately not absorbed here — ticket `02` in this
  directory, and an addendum appended to `.scratch/queue-shape/spec.md`.
- **Scope grew by 3 lines** on 2026-08-30: the `Finished` guard from `02` moved
  here (decision 5), after its original justification was disproved and it was
  kept on invariant-consistency grounds alone.
- **Sequencing checked**: doing this before queue-shape was considered and
  chosen. This ticket is a net *subtraction* from that spec's surface area, and
  queue-shape's own "Not yet decided" section is still "everything else".

## Comments

> *This was generated by AI during triage.*

## Agent Brief

**Category:** bug
**Summary:** Make the in-app skip-next and skip-previous buttons behave
identically to the notification / Android Auto presses, by routing them through
the one shared next-press decision instead of a hand-rolled copy.

**Read `## Answer` above first.** It is the contract; the body above it is the
evidence that produced it. Where the two disagree, `## Answer` wins — several of
the body's premises were overturned during grilling.

**Current behavior:**
`SkipToNextButton` carries its own inline copy of the next-press decision. It
derives queue shape from the queue's length, has no case for a press at the last
queue item (where the native skip resolves having moved nothing), records no
footprint, has no failure isolation around its bookkeeping, and its finish
branch omits both the already-Finished guard and the rewind that a previously
fixed defect depends on. `SkipToPreviousButton` delegates correctly but records
no footprint. Neither button is rendered yet; both are about to be.

**Desired behavior:**
A skip-next press behaves the same whether it came from the app, the
notification, or Android Auto — same decision, same footprint, same finish
handling, same failure isolation. Likewise skip-previous. Pressing next at the
last queue item does nothing and records nothing. Pressing next on the last
chapter of a legacy single-file Book marks the Book Finished (only if it is not
already), rewinds it to the start, and pauses — leaving the Book in the same
state as playing it to its true end. No bookkeeping failure may cost the user
their press.

**Key interfaces:**
- The shared next-press executor (`handleRemoteNextPress`, renamed
  `handleNextPress`) gains a second, non-remote caller. Its module is renamed
  for the question it answers rather than the surface that calls it.
- `resolveNextPress` is unchanged. It stays the single owner of the
  `chapter` / `skip` / `finish` / `none` verdict, and keeps taking
  `treatAsSingleFile` as a **parameter** — it must not derive queue shape.
- `treatAsSingleFile` moves from the playback service to `clippedChapters.ts`
  unchanged, so both the service and the button reach the same verdict.
- The chapter-tracking singleton moves to its own module exposing a named
  rewind operation for external callers; the playback service keeps direct
  field access for its per-tick read-modify-write, and the executor keeps
  taking the tracking object as an injected parameter.
- The two `recordRemote*Footprint` helpers are renamed to the
  `recordActiveBook*` convention their own module already uses.

**Acceptance criteria:**
- [ ] `SkipToNextButton` contains no queue-shape branch, no next-chapter
      lookup, and no finished-marking of its own — it delegates to the shared
      executor.
- [ ] Exactly **one** implementation of the `chapter`/`skip`/`finish`/`none`
      decision exists in the codebase.
- [ ] A next press at the last queue item performs no transport call and
      records no footprint.
- [ ] The in-app next press records the same footprint the notification press
      records, on the same branches, written **before** the seek/skip.
- [ ] `SkipToPreviousButton` records `chapter_change` / `chapter_restart`
      matching the remote previous handler, labeled by the resolved kind.
- [ ] The in-app finish path applies the already-Finished guard and performs
      the rewind, so the chapter list cannot highlight the last chapter of a
      Book that was just reset to 0.
- [ ] A throw from any bookkeeping call cannot prevent the seek, skip or pause
      the press asked for.
- [ ] The 30-second jump buttons still record **no** footprint, on both
      surfaces. Add a regression test asserting this.
- [ ] `treatAsSingleFile` has one definition, in `clippedChapters.ts`, and the
      playback service consumes it from there.
- [ ] The renames in `## Answer` decision 4 are applied with no remaining
      references to the old names.
- [ ] Tests cover both buttons' presses through the shared helpers, including
      the queue-edge no-op. `fakePlayer.ts` simulates the native seek clamp and
      the queue-edge no-op, so no device is needed.
- [ ] `seekForward`'s finish branch guards its `Finished` mark on the Book's
      stored progress value, so a jump inside the book-end lead window cannot
      rewrite an already-set `finished_at`. This is the ONLY change to that
      branch in this ticket. A test covers it.
- [ ] `tsc` 0 errors, `eslint` 0 errors, full suite green.

**Out of scope:**
- **Do not delete `SkipToNextButton`.** Driver ruling; both skip buttons are
  being added to the player screen shortly.
- **Do not rewire the buttons into `player.tsx`.** The driver is doing that
  separately. This ticket makes them correct, not visible.
- **Do not answer the `queue.length === 1` question.** That is
  `.scratch/queue-shape/spec.md`. Adopt what the extracted path already does and
  change no verdicts. The other `queue.length === 1` sites (sleep-timer options,
  the timer settings screen, the playback service's own, and
  `skipToPreviousChapter`'s) stay as they are.
- **Do not make the 30-second jumps record footprints.**
- **In `relativeSeek`'s finish branch, add the `Finished` guard and NOTHING
  ELSE.** The Book rewind, the failure isolation and the duplicate finish triple
  are ticket `02` in this directory — they need the extracted rewind verb and
  their own device pass. See `## Answer` decision 5 for why the guard is split
  out from the rest.
- Do not restructure `skipToPreviousChapter` into a decision/execution split.

## Implementation

Landed 2026-08-30. Every decision in `## Answer` was implemented as written;
the two notes below are the only places the code had to choose something the
contract left open.

### What moved

| From | To |
| --- | --- |
| `helpers/remoteNext.ts` | `helpers/nextPress.ts` |
| `handleRemoteNextPress` | `handleNextPress` |
| `recordRemoteSeekFootprint` | `recordActiveBookSeekFootprint` |
| `recordRemoteChapterChangeFootprint` | `recordActiveBookChapterChangeFootprint` |
| `service.ts`'s `treatAsSingleFile` | `helpers/clippedChapters.ts` (exported) |
| `service.ts`'s `singleFileChapterState` | `helpers/chapterTracking.ts` as `singleFileChapterTracking`, plus `rewindChapterTracking(bookId)` |

`Event.RemoteNext` and `SkipToNextButton` are now two lines that both call
`pressNext(bookId, book)`. `Event.RemotePrevious` and `SkipToPreviousButton`
both call `skipToPreviousChapter((kind) => recordPreviousPressFootprint(...))`.

### Two choices the contract left open

**1. A composition root, `pressNext(bookId, book)`, sits between the press
sites and the executor.** Decision 3 keeps `handleNextPress`'s dependencies
injected, which means *someone* has to supply the queue-shape verdict, the
tracker and the two recorders. Leaving that at each press site would have
duplicated the wiring rather than the decision — a smaller version of the same
defect — and, more concretely, would have put it in a component, where trap 7
of `docs/testing/jest-projects-and-rn-tests.md` makes it expensive to test.
`pressNext` lives in the same module as the executor it wires, so the module
still answers exactly one question, and the wiring is covered in the 2-second
lane.

**2. `recordPreviousPressFootprint(bookId, kind)`** does the same job for the
previous side: it owns the `'restart' → chapter_restart` mapping so neither
surface can label a press itself. It went into `activeBookFootprints.ts`
rather than `chapterSkip.ts` for decision 4's reason — `chapterSkip.ts` has no
`@/db/` imports and keeps none.

**A behavioural difference that is deliberate, not drift.** With no Active
Book, `Event.RemoteNext` falls back to a bare `skipToNext()` and the button
returns without pressing. The remote fallback exists for the cold-start path
where a press arrives before any Book is active; a button the user can see
cannot be in that state. Commented at the button.

### Tests

- `helpers/__tests__/nextPress.test.ts` — the existing executor tests, plus
  five for `pressNext`. Two of those pin the shared queue-shape verdict with
  Books that differ **only** in `isAutoGenerated`: same chapter list, opposite
  queue shapes, opposite transport calls. That is the case
  `queue.length === 1` got wrong.
- `components/__tests__/PlayerControls.rn.test.tsx` — new, and the first
  component suite in the `rn` lane. Asserts delegation only. Its mock list is
  long because PlayerControls holds six buttons and a suite that wants two
  pays for all six; every mock names what it stands in for. It also carries a
  hand-rolled `react-native-reanimated` stub — `jest.rn-setup.js`'s
  `/mock` entry is lazy and breaks the moment a suite actually imports
  reanimated, which nothing had done before.
- `helpers/__tests__/relativeSeek.test.ts` — the already-`Finished` guard
  (both directions), and a `describe` asserting the 30-second jumps write no
  footprint. That one is a **regression guard, currently vacuous**: this
  module does not import a recorder at all. It is asserted against the DB
  writers rather than a helper, so any future route into recording trips it.
- `helpers/__tests__/activeBookFootprints.test.ts` — the previous-press label
  mapping, and that a null/undefined Book id records nothing.

### Gate

`tsc` 0 errors, `eslint` 0 errors (32 pre-existing warnings, none in a touched
file), and **86 suites / 1069 tests green from a cold transform cache**
(`--clearCache` first, per trap 9 — a warm cache can report a convincing false
green).

**Not device-verified, and cannot be**: neither button is rendered yet. Per
`## Notes`, the acceptance gate for this ticket is the suite. The device pass
belongs to whoever wires them into `player.tsx`.

### Left for ticket 02

`relativeSeek`'s finish branch still lacks the Book rewind and the failure
isolation; only the `Finished` guard came here, per decision 5. `02` also now
has `rewindChapterTracking(bookId)` waiting for it.

### Review (two-axis, 2026-08-30)

Reviewed against `1f48207` on both axes. **Spec: no missing requirements**, and
every item on `## Out of scope` verified untouched — the four other
`queue.length === 1` sites, `chapterSkip.ts`, the `player.tsx` wiring, and the
rest of `relativeSeek`'s finish branch. **Standards: no hard violations**; ADR
0003 holds (no new RNTP import outside the adapter) and the new `rn` suite is
clean against the lane's nine traps.

Three findings fixed in the same commit:

1. **`PlayerControls.tsx` had been reformatted CRLF → LF wholesale**, turning
   29/-37 lines of real change into a 1520-line diff. Restored to CRLF; the
   file's diff is now 66 lines. It was the only CRLF file in the touched set.
2. **Trap 3 in `docs/testing/jest-projects-and-rn-tests.md` was wrong, and
   nothing had caught it** — `jest.rn-setup.js`'s shared reanimated mock is
   lazy, so it had never been evaluated by any suite, and it does not work:
   `react-native-reanimated/mock` re-enters the real index and reaches
   worklets' native half anyway. The doc now records the counterexample and
   the in-file stub that works around it. This is the finding worth keeping.
3. A stale prose reference to `remoteNext.test.ts`, plus two formatting nits.

Declined, with reasons:

- **Rename `treatAsSingleFile` to something naming the question** (advisory,
  from CONTEXT.md's "name a key after the question it answers"). The Agent
  Brief says it moves *unchanged*; renaming it here would also collide with
  `.scratch/queue-shape/spec.md`, which owns the vocabulary for queue shape
  and is expected to supersede this helper outright.
- **`(bookId, book)` as a data clump.** They travel together because they can
  disagree: on the cold-start path the service has a `bookId` whose store
  entry does not exist yet, which is the case `getBookFromStore`'s header
  exists to keep visible.
- **The already-`Finished` guard now has two shapes** (injected in
  `nextPress`, read live in `relativeSeek`). Real, and it is ticket `02`.
- **No test drives a button press all the way to the queue edge.** Deliberate:
  the edge is pinned in `nextPress.test.ts`, and asserting it through the
  surface would tie the behaviour to the surface it must not be specific to.
  The component suite asserts delegation and nothing else.

**Spin-off worth filing, not filed here:** there is no `.gitattributes`, and
`store/library.tsx` and `store/playerState.ts` are still CRLF, so finding 1
will happen again to whoever edits them next.
