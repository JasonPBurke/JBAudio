# The MediaSession gets its own coordinates

**Status:** accepted (driver, 2026-09-02), built the same day. Diagnosed from a
`dumpsys media_session` reading on a physical Pixel 7 Pro and from the bytecode of
the media3 1.8.0 jar this app ships.

The Player publishes **whole-file** coordinates to everything, and the MediaSession
alone is shown a **chapter-scoped** view of them, applied in the patched
`InnerForwardingPlayer`. The window is decided in JS by
`helpers/chapterWindow.ts` and travels as two keys on the track metadata.

This ADR exists because the change looks, at first glance, like the thing ADR 0004
spent nine mechanisms getting rid of: a second answer to "what is a Position
measured against?". It is not one, and the distinction is the whole ruling.

## What was wrong

On a single-file Book whose chapters are **auto-generated**, the notification and
Android Auto seek bars showed the whole Book — an eight-hour bar for a thirty-minute
chapter — while the chapter *title* changed correctly at every boundary. Both other
shapes were already right.

Measured on device, mid-playback of "Track 05" (which starts two hours in):

```
queue size  : 1
metadata    : Track 05, Christopher Moore, Bite Me: A Love Story
position    : 7203811 ms  = 02:00:03
```

The session was advertising the **Book** position where the honest chapter reading
is `3811`. The same probe on a working (embedded-chapter) Book reports
`queue size : 81` — one clipped queue item per chapter.

That is the whole cause. `shouldUseClippedChapters` excludes auto-generated
chapters, deliberately and correctly: their boundaries are synthetic 30-minute marks
with no seek point in an MP3, and clipping them audibly skips or repeats seconds of
audio at every boundary (see that gate's own docs). Those Books therefore load as
**one queue item spanning the file**, and every other shape gets a chapter-scoped
seek bar for free only because the Chapter *is* the Player's current item there.

## Why the fix that was already in the tree does nothing

Both `handleBookPlay`'s one-item builder and `service.ts`'s chapter-change update
have been sending `duration: chapterDuration` for exactly this purpose, and it has
never had any effect on the seek bar. media3 builds the legacy session metadata in
`MediaSessionLegacyStub$ControllerLegacyCbForBroadcast.updateMetadataIfChanged()`,
which takes duration from `PlayerWrapper.getDurationWithCommandCheck()` — the
player — and `LegacyConversions.convertToMediaMetadataCompat` consults the track
metadata's own `durationMs` **only** when the player's is `C.TIME_UNSET`:

```
314: lload_3                      // durationMs, from the player
315: ldc2_w  -9223372036854775807  // C.TIME_UNSET
319: ifne 337                     // player duration known -> ignore the metadata
323: getfield MediaMetadata.durationMs
```

The player's duration is always known here, so the fallback never fires. The title
lands from the same bundle because nothing on the player competes with it. **That
asymmetry — title yes, duration no — is the fingerprint of the precedence rule**,
and is why the bug reads as two unrelated behaviours.

## The ruling

**The window is applied at the session boundary, not in the app's coordinates.**

`InnerForwardingPlayer` is a `ForwardingPlayer` that already sits between the
MediaSession and ExoPlayer, intercepting every *command* to divert it to headless
JS. It overrode no *read*. It now overrides six, subtracting the window, and
translates an incoming `seekTo` back out of the window before emitting `remote-seek`.

Three facts make this a boundary adapter rather than a tenth coordinate system:

1. **The MediaSession is its only consumer.** `MusicService.onStartCommand` assigns
   `mediaSession.player = player.forwardingPlayer`, and nothing else reads it. Every
   in-app read — `getProgress`, the 1 Hz progress event, every seek RNTP performs —
   goes to `exoPlayer` directly via `BaseAudioPlayer.position`/`duration`.
2. **Nothing in JS learns about it.** The seek translation happens native-side, so
   `remoteSeekPress` keeps receiving whole-file positions exactly as every other
   shape sends them. No JS consumer branches on the window.
3. **It cannot change what is played.** No `ClippingConfiguration` is built from it;
   the source stays one continuous file. This is what keeps the MP3 boundary-seek
   defect out — the reason the exclusion exists in the first place.

So ADR 0004 still holds: `locateInBook` remains the single answer to what a Position
means *inside the app*. This is a presentation concern at the outermost edge, in the
one class whose entire job is already to be RNTP's face to the platform.

## What was rejected

**Turn clipping back on for auto-chapter Books** (optionally with
`Mp3Extractor.FLAG_ENABLE_INDEX_SEEKING`, the parked follow-up). It would restore
full parity including the Android Auto chapter queue, but it reintroduces a
device-confirmed audio glitch, and it changes what is played to fix what is
displayed. Left parked; this ADR does not close it.

**Return `C.TIME_UNSET` from `getDuration()`** so the metadata fallback above fires,
which would need no new plumbing at all. Rejected: `TIME_UNSET` reads as "live
stream" to controllers, and the *position* would still be absolute, leaving the
thumb far past the end. Position has to be translated regardless, and once it is,
translating duration honestly costs nothing.

**Decide the window natively.** It would need chapter rows in Kotlin, which only the
JS side holds. `helpers/chapterWindow.ts` decides; the native side only subtracts.

## The trap this design creates

⚠ **`windowEndMs` must always be sent explicitly.** The native `Track` only updates
a window key when the bundle *carries* it, so that a partial
`updateMetadataForTrack` cannot wipe a window already set — the same rule the clip
window follows. An omitted end therefore does not mean "to the end of the file"; it
means **"keep the previous chapter's end"**, which on the final chapter leaves `end`
behind `start`. `chapterPresentationWindow` never omits it, and the native side
declines any window it cannot make sense of, falling back to today's behaviour.

⚠ **A window on any other shape would subtract a chapter offset twice.** Both call
sites set one only on the one-item path with real chapter boundaries. Absent window
= previous behaviour, exactly.

⚠ **CHANGING WHAT WE REPORT IS NOT ENOUGH — SOMETHING HAS TO PUSH.** This was
missed in the first build and caught on device the same day: the scrubber pinned
itself to the end of the bar after every boundary and stayed there until the next
play/pause. Legacy controllers do not poll; they extrapolate position from the last
`PlaybackStateCompat`, and this session sets `setPeriodicPositionUpdateEnabled(false)`
(the Android Auto queue-scroll fix), so refreshes are purely event-driven. A chapter
boundary on a one-item Queue produces **no player event at all** — no transition, no
discontinuity, no timeline change — and in media3 1.8.0
`ControllerLegacyCbForBroadcast.onMediaMetadataChanged` calls only
`updateMetadataIfChanged()`, never `updateLegacySessionPlaybackState()`. So the new
duration was published while the position kept extrapolating in the previous
chapter's coordinates.

`InnerForwardingPlayer.refreshSessionPosition()` closes this by emitting
`onPlaybackParametersChanged` — the cheapest callback that does reach
`updateLegacySessionPlaybackState`, and a truthful one, unlike a synthetic
discontinuity that would assert a jump that never happened. It is called from
`MusicService.updateMetadataForTrack` **after** `replaceItem`, and is gated on the
item having a window, which is what keeps the queue-scroll fix intact: only a
one-item Queue is ever nudged, its Android Auto queue is a single row with nothing
to scroll, and it fires once per chapter rather than every three seconds.

⚠ **The title and the thumb therefore refresh in two separate broadcasts**, and land
a render apart. Known and currently accepted; the open ticket, with both candidate
causes and the reordering trap, is
`.scratch/chapter-presentation-window/issues/01-title-thumb-desync.md`.

⚠ **A chapter SKIP still corrects one tick late, by design.** The skip transports
(`chapterSkip`, `chapterJump`, `nextPress`) only `seekTo` on a one-item Queue — they
write no chapter index — so the 1 Hz progress tick is what notices the chapter
changed and moves the window. The seek's own discontinuity therefore publishes a
position against the *previous* window before the tick catches up. If that flash
ever needs closing, the principled fix is to send the whole chapter boundary list to
native once at queue-build time and let the window follow the playhead there, rather
than pushing a window update from each of the three transports.

⚠ **That is a fix for THIS lag only.** It does not address the title/thumb skew above
and would WIDEN it — the title is JS-supplied on the tick, so making the window
instant pulls the two further apart. It also introduces a second chapter-derivation
authority and a cache that goes stale when the auto-chapter interval setting rewrites
a Book's rows. The reasoning is recorded in full on the ticket; read it before
reaching for this.

⚠ **The Timeline still carries whole-file durations.** A pure media3
`MediaController` that derives duration from `getCurrentTimeline()` rather than
`getDuration()` would still see the Book. The notification and Android Auto both go
through the legacy path disassembled above, so both are covered.
