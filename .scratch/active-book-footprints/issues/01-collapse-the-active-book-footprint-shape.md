# 01 — Collapse the active-Book footprint shape into one helper

**What to build:** The four places that ask the Player which Book is loaded and
then write a footprint for it stop being four places. One of them already exists
as an extracted helper; the other three grew alongside it.

**Status:** resolved

## The shape

Read the Active Book, guard on it, write a footprint, swallow every failure:

```ts
try {
  const bookId = await getActiveBookId();
  if (bookId) {
    await recordFootprint(bookId, <trigger>);
  }
} catch {
  // silently fail
}
```

**Four sites, two pairs, plus the helper that already extracted it once.**
Measured across every `recordFootprint` call in `src/`, not sampled — the other
four calls (`titleDetails.tsx:270`, `chapterList.tsx:85`,
`playBookFromRow.ts:91`, and `remoteFootprints.ts`'s own) pass a `bookId` they
already hold and are **not** this shape.

| # | Site | Trigger | Extra |
|---|------|---------|-------|
| 1 | `setup/sleepTimer.ts:302-309` (`activate`) | `timer_activation` | — |
| 2 | `setup/sleepTimer.ts:526-533` (bedtime auto-activate) | `timer_activation` | — |
| 3 | `setup/service.js:407-415` (`recordRemotePlayFootprint`) | `play` | `stampLastPlayed` |
| 4 | `components/PlayerControls.tsx:139-147` (play/pause press) | `play` | `stampLastPlayed` |

Pair 1+2 is **identical modulo indentation** — verified by diffing the
whitespace-stripped bodies, not by eye.

Pair 3+4 is identical modulo **one local variable name** (`bookId` vs
`activeBookId`). That divergence is an artefact: ticket 07 renamed the service's
`activeTrack` read to `bookId` and `PlayerControls.tsx` kept `activeBookId` from
ticket 06. Nothing chose it.

`helpers/remoteFootprints.ts:40-55` is the same shape already extracted, for the
`chapter_change` / `chapter_restart` triggers, with a `bookId ?? await
getActiveBookId()` parameter so a caller that already knows the Book can skip
the read.

## ⚠ `remoteFootprints.ts` is the wrong home as it stands

The obvious move is "put it in `remoteFootprints.ts`, it's already there." Its
own header refuses that:

> Footprint recording for remote controls (notification player, Android Auto,
> Bluetooth). The in-app UI records footprints at each press site
> (PlayerProgressBar, chapterList, PlayerControls); remote presses arrive as
> `Remote*` events in the playback service instead, so these helpers give those
> handlers the same behavior.

Sites 1, 2 and 4 are **not** Remote control. Site 4 is literally one of the
in-app press sites that header names as the contrast case. Moving them in
without dealing with the header would make the file's stated scope false, which
is worse than the duplication — this repo's headers are load-bearing.

So the home is a real decision, not a mechanical one. Three honest options:

- **Rescope `remoteFootprints.ts`** to "footprints for presses that only know
  the Active Book", rename it, and rewrite the header. The `Remote*` framing
  becomes an example instead of the definition.
- **A new sibling** (`helpers/activeBookFootprints.ts`) that owns the shape, with
  `remoteFootprints.ts`'s two functions moving onto it. Leaves nothing behind.
- **Leave `remoteFootprints.ts` alone** and give the shape one small helper the
  four sites call. Smallest diff, but then two files own one shape.

**Recommendation: the second.** The Remote-control distinction is real and worth
keeping in prose, but it is a fact about *callers*, not about the shape, and the
current name is what made a reviewer file this against the wrong file.

## Three things that will bite

⚠ **The silent catch is load-bearing at every site.** A footprint is a
breadcrumb; failing to write one must never block playback or a timer
activation. Sites 1 and 2 sit inside `activate()` and `onPlaybackResumed()`,
both of which have already written DB state by the time they run. Whatever the
helper looks like, it swallows — and the test for that is worth writing, because
an extracted helper that rethrows would be a silent behaviour change with no
failing test today.

⚠ **`stampLastPlayed` is not part of the shape.** Only the `'play'` pair calls
it. Folding it into one helper behind an optional flag is exactly the
Speculative Generality the repo's smell baseline warns about; either give the
`'play'` pair its own two-line wrapper, or leave the stamp at the call sites and
let the helper do only the footprint. **Do not add a boolean parameter.**

⚠ **`recordFootprint` already early-returns.** `db/footprintQueries.ts:111-123`
calls `getCurrentChapterInfo(bookId)` and returns without writing when it is
null. The `if (bookId)` guard at each site is about the *adapter's* `null`, not
about the Book existing, so it cannot be dropped as redundant.

## Not in scope

- **Any change to what gets recorded, or when.** This is a locality ticket. If
  the extraction changes a single footprint's trigger, position or timing, it
  has gone wrong.
- **The `RemoteNext` no-op footprint guard.** `remoteFootprints.ts`'s
  `recordRemoteChapterChangeFootprint` — the instance this ticket calls "the
  same shape already extracted" — is about to gain a caller-side condition from
  `.scratch/remote-noop-footprint/issues/01-no-op-remote-next-records-a-chapter-change.md`,
  which stops a no-op press writing at all. That is a change to *when* a
  footprint is recorded, barred by the bullet above, so the two tickets do not
  merge. ⚠ They do collide on the same file: whichever lands second rebases its
  call sites onto the other.
- **`getActiveBookId`'s string narrowing.** Ticket 07's `## Answer` records a
  latent divergence there; it is ticket 04's ratified decision and not this
  ticket's business.
- **`service.js` staying JavaScript.** It calls the helper like any other
  import. Converting it is `.scratch/player-seam/issues/12-…`.

## Acceptance criteria

- [x] One helper owns the read-guard-record shape; all four sites call it
- [x] The home decision above is made explicitly and the reason recorded in an
      `## Answer`, including what happened to `remoteFootprints.ts`'s header
- [x] `stampLastPlayed` did not acquire a boolean parameter
- [x] A test asserts the helper swallows a `recordFootprint` rejection rather
      than propagating it — the one behaviour that is currently untested and
      that an extraction could silently break
- [x] Footprints written are unchanged in trigger, position and count
- [x] `tsc` 0, `eslint` 0, test count at or above baseline

## Answer

**Home: option 2 — a new sibling, `src/helpers/activeBookFootprints.ts`.**
`helpers/remoteFootprints.ts` is **gone**, not left behind: both of its
functions moved onto the new file, and its test suite moved with them to
`__tests__/activeBookFootprints.test.ts`. The test file registers as a git
rename; the helper does not — its header and internals changed enough that git
scores it as an add plus a delete, so follow it with `git log --follow` rather
than expecting the rename to show.

Why not option 1 (rescope in place) or option 3 (a second small helper):

- Option 3 was rejected outright by the ticket's own reasoning — two files
  owning one shape is the state we came to remove.
- Option 1 and option 2 differ only in whether the file keeps its name. Renaming
  is the point: the reviewer who filed this against the wrong file did so
  because the name said *Remote control*, and the shape is not about remote
  control. A rescoped `remoteFootprints.ts` would have the right header and the
  wrong name, which is the same trap one layer down.

**What happened to the header.** It was rewritten, not deleted. Its factual
content survives in two places on the new file:

- The **membership rule** is now the shape, not the transport: *presses that
  only know the Active Book*. The old header's contrast case (sites that hold a
  `bookId` already — `titleDetails`, `chapterList`, `playBookFromRow`) is kept
  verbatim in spirit, because it is what makes the rule decidable. Remote
  control is now named as one example of a caller alongside the in-app
  transport and the sleep timer, instead of as the definition.
- The **await-before-the-seek** requirement was narrowed rather than dropped. It
  is true of the two remote helpers and not of the timer or play sites, so it
  now sits on that pair explicitly instead of over the whole file, where it
  would have been false for half the contents.

**Shape.** One private `withActiveBook(bookId, record)` owns read → guard →
record → swallow. Public surface:

| Function | Callers |
|---|---|
| `recordActiveBookFootprint(trigger, bookId?)` | sites 1 + 2 (`timer_activation`) |
| `recordActiveBookPlayFootprint()` | sites 3 + 4 (`play` + `stampLastPlayed`) |
| `recordRemoteSeekFootprint(bookId?)` | service seek handlers (moved, body unchanged) |
| `recordRemoteChapterChangeFootprint(bookId?, trigger?)` | service / `remoteNext` (now a one-line delegate) |

**`stampLastPlayed` took the two-line-wrapper option, not a boolean.**
Leaving the stamp at the call sites was not actually available: sites 3 and 4
have no `bookId` in hand — reading it is the whole reason they call the helper —
so leaving the stamp behind would have left the read behind with it. The
wrapper is the only option that does not reintroduce the shape.

⚠ **`recordRemoteSeekFootprint` deliberately does NOT use `withActiveBook`.**
Its Book read is inside a `Promise.all` with `getProgress()`; routing it through
the shared shape would serialise them and put a second bridge round-trip in
front of the seek, moving the position the breadcrumb captures. That is a change
to a recorded footprint's *position*, which this ticket bars. It keeps its own
`try`/`catch` and its own comment saying why.

⚠ **The extraction moved a test seam.** `sleepTimer` used to import
`@/db/footprintQueries` directly, and `sleepTimer.processDeath.test.ts` stubbed
that module. The new helper also imports `@/db/bookQueries` (for the play
wrapper's stamp), which pulls `@/db` and WatermelonDB's **node SQLite adapter**
onto `sleepTimer`'s module graph — the harness died with `Cannot find module
'better-sqlite3'`, six tests, entirely at import time. Fixed by stubbing
`@/helpers/activeBookFootprints` instead: the seam moved up, so the mock moved
up. **Any future test that loads `sleepTimer` or `service.js` must mock the
helper, not `footprintQueries`.**

**Verification.** `tsc` 0, `eslint` 0 errors (32 pre-existing warnings), jest
**83 suites / 1036 tests** on a cold cache — baseline was 83/1027, +9 from the
new cases (the swallow at both new entry points, the no-Book guard, the supplied
-`bookId` short-circuit, and the stamp-before-record ordering). No footprint
changed trigger, position or count: sites 1–4 call the helper at exactly the
point their inline block sat, and the recorded arguments are identical.

⚠ **Collision with `.scratch/remote-noop-footprint/` landed the other way.**
That ticket went first (`a2a5241`), so this one rebased onto it: its
`handleRemoteNextPress` extraction injects the chapter-change recorder rather
than importing it, so nothing there needed touching beyond `service.js`'s import
line.

## Provenance

Surfaced by the Standards axis of the `mattpocock-skills:code-review` run on
`.scratch/player-seam/issues/07-migrate-playback-service-and-sleep-timer.md`
(`0c2e8ff`), which flagged sites 1 and 2 as newly byte-identical.

**Not caused by ticket 07.** All four sites predate it; what ticket 07 changed is
that each one's `const activeTrack = await TrackPlayer.getActiveTrack(); if
(activeTrack?.bookId)` became `const bookId = await getActiveBookId(); if
(bookId)`, which collapsed four superficially different reads into one visibly
repeated shape. The duplication was always there — the seam is what made it
legible.

⚠ The review reported **two** duplicated blocks in `sleepTimer.ts` and named
`remoteFootprints.ts` as the home. Both were narrowed on tracing: the census
above found **four** sites in two pairs, and the header quoted above rules that
file out as-is. Ticket 07's `## Answer` was amended to match.
