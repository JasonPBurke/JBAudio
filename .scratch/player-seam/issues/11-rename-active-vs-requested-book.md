# 11 — Rename Active Book vs Requested Book

**What to build:** The two fields currently both called `activeBookId` say which
question each answers, so the next person to read one learns there are two of
them before merging them.

**Blocked by:** 10

**Status:** resolved

## The problem

Two stores hold a field called `activeBookId`. They are **not** duplicates.

| | queue store | player-state store |
| --- | --- | --- |
| Written by | the play / restore / remote-play path, when the user asks | the sync component, from what the Player reports |
| Means | **Requested Book** — intent | **Active Book** — observation |
| Timing | **leads** a switch | **lags** a switch |
| Also used as | an input, to tell "same Book" from "a switch" | read-only |

They agree during steady playback and diverge for the length of a switch. Five
components read **both**, in one case four lines apart, with no name to tell
them apart. Ticket 02 surfaced a live consequence: four callers of the same
helper pass different sources into the same argument position.

Both terms are now defined in `CONTEXT.md`. The glossary entries were the actual
fix, because the defect is conceptual. This ticket is the code catching up.

## Why it is worth doing

This is the third instance of the same failure in this repo, and the glossary's
`Keys and identity` cluster exists because of the first two — a key that looked
like a foreign key and was not, and a key that answered two questions and was
about to be edited for the wrong one. Both were about to cause a data-level
change while looking like a display-level one. The rule at the top of that
cluster: **name a key after the question it answers.** `activeBookId` is named
after neither.

## ⚠ Do not merge them

The switch path reads the intent one specifically. Merging breaks
book-switching, and it will look correct in every test that does not switch
Books mid-playback.

## Acceptance criteria

- [x] Both fields and their selectors renamed to carry the distinction —
      **as ruled, one field moved, not two.** See the driver ruling below.
- [x] The four callers from ticket 02 are reconciled, or their difference is
      recorded as deliberate with a reason — **recorded as deliberate**, with
      the reason now stated as a finding rather than a deferral, in
      `helpers/playBookFromRow`'s header.
- [x] No behaviour change — the divergence window stays exactly as it is; the
      point is that it becomes visible
- [x] `tsc` 0, `eslint` 0 errors (32 warnings, all pre-existing and unmoved),
      jest 78 suites / 981 tests, up from 77 / 975

## Driver ruling (2026-08-27)

**Rename the queue store's field only.** `store/playerState`'s `activeBookId`
already IS CONTEXT.md's `Active Book`, spelled exactly as the glossary spells
it; only `store/queue`'s was named after the wrong question, and the glossary
lists "active book" under _Avoid_ for the Requested Book. Renaming the correct
field as well would have churned ~14 files, including `themeStore` and six
screens, to make a right name different. Naming each field after its own
question is what AC 1 was asking for, and one rename achieves it.

Also ruled: this does NOT ride along with the queue-shape work. It landed on
its own.

## What changed

- `store/queue`: `activeBookId` → `requestedBookId`, `setActiveBookId` →
  `setRequestedBookId`, and a header stating the intent-vs-observation split.
- `useBookQueue` **deleted** — a selector for the renamed field with zero
  callers, found during the census.
- Propagated to the 9 consumers: `handleBookPlay`, `playBookFromRow`,
  `remotePlayBook`, `restoreLastActiveBook`, `BookGridItem`, `BookListItem`,
  `SeriesBrowseRow`, `SeriesDetailSheet`, `titleDetails`.
- `titleDetails`: local `playerActiveBookId` → `activeBookId`. The `player`
  prefix existed only to dodge the collision this ticket removed.
- `store/playerState`, `player/trackPlayer`, `CONTEXT.md`: comments that
  asserted the two fields were "identically named" are no longer true and were
  rewritten; the glossary entries now name the field each term lives in.

## Two things found on the way

1. **A stale claim, now fixed.** `helpers/playBookFromRow`'s header said
   `titleDetails` "reads a THIRD active-Book source — `activeTrack?.bookId`,
   straight off RNTP's hook". Ticket 10 ended that; there is no `activeTrack`
   in the file. It reads the mirror (`useActiveBookId`) and the live one-shot
   (`getActiveBookId()`) — same question, two freshnesses — plus the Requested
   Book. Prose asserting facts about *other* files has no compiler keeping it
   honest, which is the argument for doing this ticket in code.
2. **The merge hazard had zero test coverage.** `handleBookPlay.test.ts`
   contained no reference to the fourth argument at all: every case passed the
   `null` default, so the rebuild-vs-seek branch was selected by a default and
   never asserted. Two cases were added, plus `store/__tests__/queue.test.ts`.
   ⚠ They pin the BRANCH, not the CALL SITES — a caller that passes the Active
   Book here still type-checks and leaves both files green. That limit is
   stated in the test's own header. The guard at the call sites is the name.
3. **`src/store/playerState.ts` is CRLF** — a fourth CRLF file, alongside the
   three already known (`setup/service.js`, `components/PlayerControls.tsx`,
   `modals/SleepTimerOptions.tsx`). A scripted text-mode edit rewrote it to LF
   and turned a 12-line comment change into a 204-line whole-file diff. Caught
   from the commit stat and restored before the commit was finalised. Check
   line endings before scripting an edit to any file in this repo, not just the
   three on the known list.
