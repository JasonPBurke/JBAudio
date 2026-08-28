# 03 — Author the chapter-boundary device checklist

**What to build:** A written list of everything that visibly changes on screen
when a chapter turns over inside one Book — derived by reading the code as it
behaves **today**, before anything is migrated. That list is the test ticket 10
runs on a device.

**Blocked by:** None — can start immediately.

**Status:** resolved

## ⚠ Why the ordering is the whole point

Ticket 09 replaces a hook that re-renders on **every active-track change**
(including chapter-to-chapter inside one Book) with a store selector that
re-renders only when the **Active Book** changes. Strictly fewer renders, and the
direction the player-state store's own docblock already argues for — but any
site that silently depended on re-render-at-chapter-boundary goes stale.

**A stale render is indistinguishable from a correct one** unless you already
know what should have moved. Written after the migration, this list describes
the new behaviour and certifies nothing.

## Method

For each of the twelve files named in ticket 09, read it and answer one
question:

> When a chapter turns over **within the same Book**, what does this file cause
> to change on screen?

Record each answer as an observable in the user's words — "the highlighted row
in the chapter list moves down one" — not as an implementation note. If the
answer is "nothing", record that: it is a prediction that the site is safe, and
it is far better to be wrong about it here than on a device.

Where a file already tracks the chapter index through its own event
subscription rather than through the hook, say so. Those are the sites expected
to be unaffected, and naming them is how a surprise gets noticed.

## Seed — incomplete and unverified, read the files

- chapter list screen — highlighted chapter row moves
- player screen — contents follow the chapter
- title details — active-Book state, play/pause glyph
- footprint list — likely nothing, the list is per-Book
- floating player — title and artwork
- player controls — transport state, chapter-dependent affordances
- player progress bar — bar resets, chapter label changes
- book time remaining — recomputes; ⚠ already tracks the index via its own
  active-track-changed subscription
- player state sync — the mirror writer itself, no UI of its own
- stable current-chapter hook — feeds the chapters modal and the progress bar;
  ⚠ already reads the index from the library store, with a cold-mount fallback
- last-active-track hook — deleted by ticket 09; check both consumers keep their
  sticky-last behaviour
- track-player state logger — logging only

## Both runtime Queue shapes

Every row runs twice. Chapter-crossing means different things depending on what
**Position** is measured against, and per the book-end work a real book cannot
always distinguish the two — synthesise a case with ffmpeg if the library lacks
one. See the queue-shape taxonomy in the book-end-detection notes.

## Acceptance criteria

- [x] One row per file from ticket 09's list, none omitted
- [x] Each row names an observable, in the user's words
- [x] Each row states which runtime Queue shape it applies to, or both
- [x] Sites that already track the index independently are marked as such
- [x] The checklist is recorded below under `## Answer`

## Answer

Authored 2026-08-26 against the tree at `36fe321`, **before** any part of ticket
09 was written. Derived by reading each of the twelve files as they behave
today. Nothing here was observed on a device; every row is a _prediction_ that
ticket 10 either confirms or falsifies.

### The mechanism this whole list turns on

`useActiveTrack()` is `useState` plus **one** subscription — `Event.PlaybackActiveTrackChanged`
(`node_modules/react-native-track-player/src/hooks/useActiveTrack.ts`). It sets a
**new object identity** on every delivery, so all eleven call sites re-render
whenever that event fires, whether or not the Book changed.

That gives the two runtime Queue shapes completely different exposure:

|                                            | **one-item queue**                             | **multi-item queue**                             |
| ------------------------------------------ | ---------------------------------------------- | ------------------------------------------------ |
| What the Player holds                      | the whole Book as one item                     | one item per Chapter                             |
| What Position measures                     | absolute offset into the Book                  | offset into the current Chapter                  |
| A chapter turn is…                         | Position crossing a `startMs`                  | a queue-item change                              |
| `PlaybackActiveTrackChanged` at a boundary | **never fires**                                | fires                                            |
| `useActiveTrack()` re-render at a boundary | **never happens**                              | happens, at all 11 sites                         |
| Who writes `playbackIndex`                 | `service.js` `PlaybackProgressUpdated` (~L232) | `service.js` `PlaybackActiveTrackChanged` (L693) |

**Consequence, and the single most useful thing on this page:** on the one-item
shape ticket 09 deletes a re-render that was never occurring, so every row is
trivially unaffected — it still has to be _run_, to confirm the things that do
move on that shape still move, but a failure there means something other than
ticket 09 broke. **On the multi-item shape, every "safe" verdict below is a
claim that some other subscription is doing the work, and each one is falsifiable.**

Both shapes agree on one thing: the chapter index reaches the UI through
`useLibraryStore.playbackIndex[bookId]`, written by `service.js` on both paths.
Any site subscribed to that selector is immune to ticket 09 by construction.

### Producing each shape on a device

- **multi-item** — any multi-file Book (a folder of per-chapter files), or a
  single-file Book with _real_ embedded chapters that clears the heap gate in
  `shouldUseClippedChapters`. Fastest subject: two ~60 s files synthesised with
  ffmpeg, so the boundary lands a minute in.
- **one-item** — a single-file Book that _fails_ `shouldUseClippedChapters`.
  The only lever that is reliable on demand is the auto-chapter exclusion: a
  single MP3 with **no** embedded chapters, with auto-chapters on. The heap-gate
  route cannot be forced. Auto-chapter intervals are 30 or 60 minutes, so
  synthesise a ~90-minute MP3, seek to **29:50**, and the boundary arrives in
  ten seconds. Do not try to distinguish the shapes with a real book — per the
  book-end work, a real book generally cannot tell them apart.

### The checklist

Twelve rows, one per file in ticket 09's list, in ticket 09's order.

---

**1. Chapter list screen — `src/app/chapterList.tsx`**

- **Observable:** the filled/highlighted chapter row moves down one, from the
  chapter that just ended to the one that just started.
- **Shape:** both.
- **Tracks the index independently:** ⚠ **yes.** `activeIndex` comes from
  `storeIndex` — a `useLibraryStore` selector on `playbackIndex[bookId]`
  (L44–L50) — falling back to `book.bookProgress?.currentChapterIndex`.
  `activeTrack` is used only as a gate: _is the loaded Book this Book_
  (`activeTrack.bookId !== book.bookId → -1`).
- **Prediction:** **safe.** The store selector re-renders the screen on its own.
- **Watch for:** the screen going from highlighted to _no_ highlight at all
  rather than a stale highlight — that is the gate failing, not the index.

---

**2. Footprint list screen — `src/app/footprintList.tsx`**

- **Observable:** **nothing.** No row appears, moves or changes.
- **Shape:** both.
- **Tracks the index independently:** n/a — it never reads a chapter index.
- **Prediction:** **safe, because nothing was ever going to happen.** The list is
  fetched once, in an effect keyed on `[activeTrack?.bookId]` (L52–L78), and a
  chapter turn does not change `bookId`. Confirmed against the writers: a
  `'chapter_change'` footprint is only recorded by a _manual_ chapter selection
  (`chapterList.tsx:85`) or a remote prev/next (`service.js:509`). **A natural
  chapter turnover records no footprint at all.**
- **Watch for:** a row appearing. That would mean an automatic writer was added
  since this was authored, and the screen is stale _today_ as well as after — a
  pre-existing bug, not a ticket 09 regression.

---

**3. Player screen — `src/app/player.tsx`**

- **Observable:** the chapter title above the progress bar changes to the new
  chapter's name (rendered by `PlayerChaptersModal`); the cover art, mesh
  gradient and every control stay exactly as they are.
- **Shape:** both.
- **Tracks the index independently:** ⚠ **yes, via its child hook.** The screen
  calls `useCurrentChapterStable()` (L150) and broadcasts the result through
  `CurrentChapterContext`. That hook carries its own `playbackIndex` selector
  (row 10), so it re-renders `PlayerScreen` by itself. `activeTrack` supplies
  only `bookId → book` (artwork, gradient) and the `if (!activeTrack)` spinner
  gate (L203).
- **Prediction:** **safe.** Everything the screen draws from `activeTrack` is
  Book-level and cannot change inside one Book.
- **Watch for:** the chapter title going stale while the progress bar resets
  correctly, or vice versa. They come from the same Context value; a split
  between them means the Context is fine and one consumer memoised wrongly.

---

**4. Title details screen — `src/app/titleDetails.tsx`**

- **Observable:** ⚠ **the thin progress capsule under the play button advances,
  and the "N h M m left" text beside it ticks down.** The play/pause glyph, the
  cover, the chapter _count_ and everything else hold still.
- **Shape:** **multi-item only.** On the one-item shape the screen never
  re-rendered at a boundary in the first place, so the capsule is already only
  as fresh as the last unrelated re-render.
- **Tracks the index independently:** **NO.**
- **Prediction:** ⚠⚠ **THE ONE ROW PREDICTED TO FAIL.** `BookDurationRow`
  (`src/components/BookDurationRow.tsx:39`) reads live progress with an
  **unsubscribed** `useLibraryStore.getState()` — deliberately, with `'use no
memo'` and a comment saying it "refreshes whenever the parent re-renders". Its
  parent is this screen. This screen's only chapter-boundary re-render source is
  `useActiveTrack()`, because `current_chapter_index` is **not** among the 21
  columns in the library store's `observeWithColumns` list
  (`src/store/library.tsx:281`), so `useBookById` does not fire either. Replace
  the hook with an Active-Book selector and the capsule freezes at whatever it
  showed when the screen mounted, while the Book keeps playing.
- **The fix if it fails** is ticket 10's stated one: give this site its own
  index subscription — a `useLibraryStore` selector on
  `playbackIndex[book.bookId]` in `titleDetails.tsx`, the pattern rows 1 and 10
  already use. **Do not** revert ticket 09, and **do not** add
  `current_chapter_index` to `observeWithColumns` — that column is written on
  every chapter turn for every Book and would re-fetch the whole library.
- **Also note, out of scope but adjacent:** `BookGridItem` and `BookListItem`
  render the same `BookDurationRow` and subscribe only to
  `queueStore.activeBookId`. Their capsules are **already** stale at chapter
  boundaries today. That is pre-existing and unchanged by ticket 09 — do not
  log it as a regression.

---

**5. Book time remaining — `src/components/BookTimeRemaining.tsx`**

- **Observable:** the "N h M m left" line keeps counting down across the
  boundary without jumping, freezing or resetting. On the multi-item shape it
  must not jump _upward_ at the turn.
- **Shape:** both, but only the multi-item shape actually exercises the
  index — `calculateRemainingBookTime` ignores `currentIndex` entirely on the
  one-item shape, where Position is already absolute.
- **Tracks the index independently:** ⚠ **yes.** The outer component holds its
  own `Event.PlaybackActiveTrackChanged` subscription (L190–L200) that
  re-reads `getActiveTrackIndex()` into `currentIndex` and passes it down as a
  prop. Its effect is keyed on `[displayedTrack?.bookId]`, so the subscription
  survives a chapter turn rather than being torn down and rebuilt.
- **Prediction:** **safe.**
- **Watch for:** the number jumping _up_ by roughly one chapter's length at the
  boundary and then settling. That is `currentIndex` arriving a beat after the
  chapter-relative Position — a race between two subscriptions, visible only on
  the multi-item shape, and it would be a _new_ symptom worth recording even
  though it is not what ticket 09 breaks.

---

**6. Floating player — `src/components/FloatingPlayer.tsx`**

- **Observable:** **nothing except the "N h M m left" line**, which belongs to
  its embedded `BookTimeRemaining` (row 5) and is that row's observable, not
  this one's. The artwork thumbnail and the scrolling title must **not** change:
  both are Book-level (`displayedBook.artwork`, `displayedBook.bookTitle`).
- **Shape:** both.
- **Tracks the index independently:** n/a — it never reads a chapter index.
- **Prediction:** **safe.**
- **Watch for:** the title or artwork flickering or blanking at the turn. Under
  ticket 09 `displayedTrack` becomes a sticky store field; a momentary `null`
  there would unmount the whole bar (`if (!isPlayerReady || !displayedTrack ||
!displayedBook) return null`, L77) and the `FadeIn` would replay. That is the
  sticky-last field failing, and it is the reason row 11 exists.

---

**7. Player controls — `src/components/PlayerControls.tsx`**

- **Observable:** **nothing.** No glyph changes, nothing enables or disables.
- **Shape:** both.
- **Tracks the index independently:** n/a.
- **Prediction:** **safe.** The single `useActiveTrack()` in this file is inside
  `SkipToNextButton` (L343) and feeds only `bookId → book.chapters`, consumed at
  **press time** inside `handlePress` — which also re-reads `getQueue()` and
  `getProgress()` live. Nothing chapter-dependent is rendered.
- **Watch for:** press **skip-forward immediately after** a boundary, on both
  shapes. If the button jumps two chapters, or does nothing at the last chapter
  when it should mark the Book finished and reset, `book` went stale — which
  would be a `useBookById` problem, still not a ticket 09 one.

---

**8. Player progress bar — `src/components/PlayerProgressBar.tsx`**

- **Observable:** the slider snaps back to the left edge, the elapsed time on
  the left resets to `0:00`, and the remaining time on the right jumps to minus
  the **new** chapter's length.
- **Shape:** both — but for different reasons, and both need running. On the
  multi-item shape native Position is already chapter-relative
  (`isChapterRelative` true, `chapterStart` forced to 0); on the one-item shape
  the bar is windowed by subtracting the chapter's `startMs`.
- **Tracks the index independently:** ⚠ **yes, via Context.** The reset is
  driven entirely by `useCurrentChapter()` (L73) and the effect on L88 that
  writes `chapterStart` / `chapterDuration`. `activeTrack` (L79) supplies only
  `bookId → book → isChapterRelative`, which cannot change inside one Book.
- **Prediction:** **safe.**
- **Watch for:** the bar resetting but the two time labels holding the old
  chapter's figures for up to a second. The labels are written from a
  `useAnimatedReaction` on `Math.floor(position.value)` and re-primed by the
  chapter effect; a persistent mismatch means the effect did not run.

---

**9. Player state sync — `src/components/PlayerStateSync.tsx`**

- **Observable:** **nothing.** It renders `null`.
- **Shape:** both.
- **Tracks the index independently:** n/a — it never reads a chapter index, and
  must not start.
- **Prediction:** **safe, and it is the component doing the work after ticket 09.** Its `setActiveBookId` effect is keyed on `[activeTrack?.bookId, …]`
  (L31), so a chapter turn inside one Book **already** writes nothing today.
  That is precisely why the Active-Book selector cannot carry chapter-boundary
  freshness to anyone.
- **Watch for, indirectly:** it is mounted once in `src/app/_layout.tsx:218`.
  Every store selector added by ticket 09 is dead while it is unmounted — the
  mount invariant ticket 09 requires be written into the store's header.

---

**10. Stable current-chapter hook — `src/hooks/useCurrentChapterStable.ts`**

- **Observable (through its two consumers):** the chapter title in the player
  screen's chapter row changes, and the progress bar resets — rows 3 and 8. The
  hook draws nothing itself.
- **Shape:** both, through two different internal paths — multi-item takes the
  `chapterQueue` branch (index from the store), one-item takes the
  `positionIndex` branch (index re-derived from `PlaybackProgressUpdated`).
- **Tracks the index independently:** ⚠ **yes, on both branches.** Multi-item:
  a `useLibraryStore` selector on `playbackIndex[bookId]` (L69–L74). One-item:
  its own `PlaybackProgressUpdated` / `PlaybackState` /
  `PlaybackActiveTrackChanged` subscriptions (L137–L150). `activeTrack` gives
  only `bookId`.
- **Prediction:** **safe.** Ticket 09 explicitly leaves this hook's own
  subscriptions alone.
- **Watch for:** the chapter title stuck on chapter 1 for the whole listen with
  the bar still resetting. That is the cold-mount `getActiveTrackIndex()`
  fallback (L82–L98) winning permanently because `storeIndex` never became a
  number — a store-hydration failure, and it looks identical to a stale render.

---

**11. Last-active-track hook — `src/hooks/useLastActiveTrack.tsx`** _(deleted by
ticket 09)_

- **Observable at a chapter boundary:** **nothing.** Both consumers take
  `?.bookId` off it immediately and it is only consulted when `activeTrack` is
  null, which a chapter turn never causes.
- **Shape:** both.
- **Tracks the index independently:** n/a.
- **Prediction:** **safe at a boundary — but its replacement must be verified
  somewhere else**, because a chapter turn cannot exercise the behaviour it
  exists for. Its whole job is _stickiness_: `if (!activeTrack) return;` keeps
  the last non-null track forever.
- **Extra check, not at a chapter boundary, on both shapes:** play a Book to the
  very end and let `PlaybackQueueEnded` reset the queue. Both consumers must
  keep showing that Book, not vanish:
  - **Floating player** — the bar stays on screen with its artwork, title and
    "left" text; it must not disappear or fade back in.
  - **Book time remaining** — the text stays rendered rather than returning
    `null` (its guard is `if (!displayedTrack || !displayedBook) return null`).
    If ticket 09's new store field clears on null instead of sticking, both go
    blank at once — an unmissable failure, which is the good news.

---

**12. Track-player state logger — `src/hooks/useLogTrackPlayerState.tsx`**

- **Observable:** **nothing, on screen or in logcat.** It is **not mounted** —
  its only call site is commented out at `src/app/_layout.tsx:207`.
- **Shape:** both (vacuously).
- **Tracks the index independently:** n/a. It uses `useTrackPlayerEvents`
  directly and never calls `useActiveTrack`, so it is in ticket 09's list for
  the library import, not for a subscription that needs moving.
- **Prediction:** **safe.** Nothing to run on a device.
- **Watch for:** nothing. If it is re-enabled during the migration its
  `console.warn` per track change will fire once per chapter on the multi-item
  shape and never on the one-item shape — a cheap way to see the shapes apart in
  logcat, and it should be commented out again before ticket 10 closes.

### Two observables not owned by any of the twelve

Recorded so they are not mistaken for regressions when they _do_ keep working:

- **The notification / lock-screen title** changes to the new chapter at a
  boundary on the one-item shape, written by `TrackPlayer.updateMetadataForTrack`
  in `service.js` (~L241). Pure native, no React, unaffected by ticket 09.
- **The sleep timer's "end of chapter" countdown** is advanced by
  `sleepTimer.onChapterChanged()` from the `PlaybackActiveTrackChanged` handler
  (`service.js:698`) — **multi-item only**, and also outside React.

### Acceptance criteria

- [x] One row per file from ticket 09's list, none omitted — twelve rows, in
      ticket 09's order
- [x] Each row names an observable, in the user's words
- [x] Each row states which runtime Queue shape it applies to, or both
- [x] Sites that already track the index independently are marked as such —
      rows 1, 3, 5, 8, 10 (⚠-flagged); rows 2, 6, 7, 9, 11, 12 marked n/a
- [x] The checklist is recorded above under `## Answer`

**Predicted result for ticket 10: eleven rows pass, row 4 (title details) fails
on the multi-item shape.** If row 4 passes, something re-renders that screen
that this reading did not find — go and find it before believing the pass.

---

⚠ **AMENDED 2026-08-27 BY TICKET 10 — READ THIS BEFORE RUNNING THE PASS.** The
paragraph directly above is now a trap. Row 4's staleness was confirmed by
tracing rather than on a device (no re-render source survives on that screen at
a chapter turn: `current_chapter_index` is absent from the library store's
observed columns, `service.js` never writes the queue store, and the remaining
selectors are Active-Book selectors), and **it was fixed** — `titleDetails.tsx`
now calls `hooks/useRerenderOnChapterTurn`. So row 4 will pass, and passing is
no longer evidence that this reading missed something. **Do not go hunting.**

What to run instead, on the **multi-item** shape, is the positive observable:
with title details open, the capsule under the play button advances and the
"N h M m left" text ticks down as each chapter turns over. The other eleven rows
are unchanged and unrun. See ticket 10's `## Answer`.

⚠ **ROW 7 AMENDED 2026-08-27 BY TICKET 10's MULTI-ITEM PASS.** Two corrections
before this row is run on the one-item shape.

1. **The in-app half of row 7 is vacuous.** `SkipToNextButton`
   (`components/PlayerControls.tsx:352`) is exported but has **zero render
   sites** in `src/`, so the `useActiveTrack()` this row reasoned about never
   runs in the app — the same situation as row 12. The notification / Android
   Auto is the only skip-forward surface, handled by `Event.RemoteNext`
   (`service.js:466`).
2. **"Does nothing at the last chapter" is CORRECT on multi-item.** The
   mark-finished-and-reset branch is gated on `treatAsSingleFile(book)`, so a
   multi-file book takes the `else` and `skipToNext()` no-ops at the end of the
   queue. This row's last-chapter watch-for is therefore a **one-item-shape**
   test, and it is the one still owed.

Also filed from this row: a no-op remote Next still writes a `chapter_change`
footprint — `.scratch/remote-noop-footprint/issues/01-no-op-remote-next-records-a-chapter-change.md`.
Pre-existing, unrelated to the migration.

⚠ **FIXTURE RECIPE AMENDED 2026-08-27 — the one-item recipe above has a trap.**
Synthesising a "~90-minute MP3" produces 5400.058 s, not 5400 s, and
auto-chaptering at a 30-minute interval then yields a **fourth chapter 58 ms
long** at 90:00 (shown in the app as `Track 04  00:00`). That sliver is the last
chapter, it cannot be reached by seeking, and it makes row 7's finish branch
untestable on that fixture.

**Give a one-item fixture a duration that is NOT a multiple of the auto-chapter
interval.** 3900 s (65 min) at a 30-minute interval gives three chapters with a
real five-minute last chapter — long enough to seek into and short enough to play
to the end quickly. Two other things a one-item fixture needs: **zero embedded
chapters** (verify with `ffprobe -show_chapters`), and the interval set, which is
**Pro-gated** — so this shape needs a Pro build, not an emulator.

⚠ And the fixture must be registered with MediaStore or the app cannot see it at
all: `scanLibrary` enumerates via `enumerateAudioViaMediaStore`, so after
`adb push` run `adb shell content call --uri content://media --method scan_volume
--arg external_primary`.
