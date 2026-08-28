# 01 — Collapse the active-Book footprint shape into one helper

**What to build:** The four places that ask the Player which Book is loaded and
then write a footprint for it stop being four places. One of them already exists
as an extracted helper; the other three grew alongside it.

**Status:** ready-for-agent

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

- [ ] One helper owns the read-guard-record shape; all four sites call it
- [ ] The home decision above is made explicitly and the reason recorded in an
      `## Answer`, including what happened to `remoteFootprints.ts`'s header
- [ ] `stampLastPlayed` did not acquire a boolean parameter
- [ ] A test asserts the helper swallows a `recordFootprint` rejection rather
      than propagating it — the one behaviour that is currently untested and
      that an extraction could silently break
- [ ] Footprints written are unchanged in trigger, position and count
- [ ] `tsc` 0, `eslint` 0, test count at or above baseline

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
