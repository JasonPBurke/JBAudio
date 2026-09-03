# Chapter title and scrubber thumb do not refresh together

**Status:** needs-triage

Observed on device 2026-09-02 (Pixel 7 Pro, physical), immediately after the chapter
presentation window landed and both of its device defects were fixed. The driver's
words: *"there is an unsync between the chapter title refresh and the thumb reset.
This may be acceptable."*

**Not a regression.** Before this work the thumb never reset at all, so there was
nothing to be out of step with. This is a new, smaller artifact of the fix.

## Symptom

On a single-file Book with auto-generated chapters (one-item Queue), crossing a
chapter boundary updates the notification's chapter title and resets the scrubber
thumb to the start of the new chapter — but not in the same frame. One visibly lands
before the other.

⚠ **Which one leads has NOT been measured.** Both directions are plausible and they
have different causes; see below. Establishing the order is the first thing any
session picking this up should do, because it selects the fix.

## Why it happens at all

The title and the window travel in the *same* `updateMetadataForTrack` bundle, so
this is not a case of one being sent late. They are published to the controller as
**two separate broadcasts**, and the platform renders each as it arrives:

1. `MusicService.updateMetadataForTrack` → `player.replaceItem(...)` → media3 fires
   `onMediaMetadataChanged` → `updateMetadataIfChanged()` publishes **title +
   duration**.
2. Then `player.forwardingPlayer.refreshSessionPosition()` →
   `onPlaybackParametersChanged` → `updateLegacySessionPlaybackState()` publishes
   **position**.

Two broadcasts, two renders. See
`docs/adr/0005-the-media-session-gets-its-own-coordinates.md` for why step 2 has to
exist at all — without it the thumb never moved.

### If the THUMB leads (title arrives late)

The likely cause is already visible in the media3 1.8.0 bytecode.
`ControllerLegacyCbForBroadcast.updateMetadataIfChanged()` resolves artwork through a
`ListenableFuture<Bitmap>`: if the future `isDone()` it publishes synchronously,
otherwise it registers a `Futures.addCallback` and publishes **only when the bitmap
resolves**. Position has no such dependency and goes out immediately. So a cold or
slow artwork load would delay the title while the thumb resets at once.

Cheap check: whether the skew disappears once the cover is warm in the Coil cache
(`CacheBitmapLoader` wraps `CoilBitmapLoader` in `MusicService.onCreate`).

### If the TITLE leads (thumb arrives late)

Then it is simply broadcast ordering — step 1 before step 2, one render apart — and
the fix is to make the position push happen before or with the metadata publish
rather than after it. ⚠ **The current order is deliberate and must not simply be
swapped**: `refreshSessionPosition()` reads the window off the *active MediaItem's
tag*, so it must run **after** `replaceItem` or it will publish a position computed
against the previous chapter's window — which is the exact defect that made the
scrubber stick at the end of the bar. Any reordering has to keep "window is fresh
before position is read" true.

## Candidate fixes, cheapest first

1. **Accept it.** It is a sub-second cosmetic skew on a transition that happens once
   per chapter. This is the current disposition.
2. **Warm the artwork** so `updateMetadataIfChanged` never takes its async path at a
   boundary. Only helps if the thumb leads. The cover does not change within a Book,
   so the future should already be resolved after the first publish — which would
   make this hypothesis *unlikely* and point at ordering instead. Worth confirming
   before spending anything.
3. **Collapse the two broadcasts into one.** Would need the position refresh to ride
   the same publish as the metadata, which media3 does not offer through the session
   API — it would mean a deeper change to how RNTP drives the session.

## ⚠ The wrong tool: sending the chapter boundary list to native

The ADR mentions sending the whole boundary list to native at queue-build time so the
window tracks the playhead there. **That is a fix for the chapter-SKIP one-tick lag, and
it is the wrong tool for THIS ticket** — the question was asked and answered on
2026-09-02, so it is recorded here rather than re-derived.

It would probably make the skew **worse**. The skew is not caused by when the window
arrives; it is caused by title and position being two separate broadcasts. The chapter
TITLE is a JS-supplied string that arrives on the 1 Hz tick. A native boundary list makes
the WINDOW instant while leaving the TITLE on the tick, widening the gap from
milliseconds to as much as a second. Fixing sync that way would require moving chapter
titles natively too — and JS must keep its own chapter derivation regardless, because the
same tick also drives the DB writes and the chapter-mode sleep timer.

It is also brittle in two ways worth knowing before anyone reaches for it again:

- **Two chapter-derivation authorities.** JS derives the Chapter from `locateInBook`;
  native would derive it from a cached array. Same two-producer shape that forced
  `evaluateBookEnd`'s url assertion.
- **The cached list goes stale with no symptom.** The auto-chapter interval is a
  user-facing setting (`src/app/(settings)/library.tsx` →
  `applyAutoChaptersToExistingBooks`, and `trialCleanup.ts` sets it to `null`) that
  REWRITES every auto-chapter Book's rows. JS re-reads `book.chapters` from the store
  every tick and self-heals; a snapshot taken once at queue-build does not, and a stale
  boundary list is a well-formed answer nothing can assert against.

⚠ **Also note the skip lag it WOULD fix was reported working on device 2026-09-02**, so
that change currently has no open customer either.

## What NOT to do

⚠ **Do not re-enable `setPeriodicPositionUpdateEnabled(true)`** to paper over this.
It re-broadcasts `PlaybackStateCompat` every 3 seconds while playing, which makes
Android Auto's gearhead re-render its queue template and lose scroll position — a
device-verified regression this session's fix was specifically shaped to avoid.

## Comments

Nothing yet.
