import {
  Event,
  getActiveBookId,
  getActiveTrackIndex,
  getPlaybackState,
  getProgress,
  getQueue,
  getTrack,
  pause,
  play,
  seekBy,
  seekTo,
  skipToNext,
  State,
  stop,
  subscribe,
  updateMetadataForTrack,
} from '@/player/trackPlayer';
import type { AppEventPayloadByEvent } from '@/player/trackPlayer';
import RNShake from 'react-native-shake';
import * as Haptics from 'expo-haptics';
import { useLibraryStore } from '@/store/library';
import { useSettingsStore } from '@/store/settingsStore';
import { updateChapterProgressInDB } from '@/db/chapterQueries';
import { getBookById } from '@/db/bookQueries';
import { BookProgressState } from '@/helpers/handleBookPlay';
import { handleRemotePlayPause } from '@/helpers/remotePlayPause';
import {
  handleRemotePlayBook,
  isBookSwitchInProgress,
} from '@/helpers/remotePlayBook';
import { ensurePlayerSetup } from '@/helpers/playerSetup';
import { pressNext } from '@/helpers/nextPress';
import { markBookFinishedOnce } from '@/helpers/markBookFinishedOnce';
import { setChapterIndex } from '@/helpers/setChapterIndex';
import {
  rewindChapterTracking,
  singleFileChapterTracking,
} from '@/helpers/chapterTracking';
import { restoreLastActiveBook } from '@/helpers/restoreLastActiveBook';
import { queueShapeOf } from '@/helpers/queueShape';
import { rewindPlayerToBookStart } from '@/helpers/rewindPlayerToBookStart';
import { hasValidChapterData } from '@/helpers/singleFileBook';
import { locateInBook } from '@/helpers/bookLocation';
import { evaluateBookEnd } from '@/helpers/bookEndDetection';
import type {
  BookEndDecision,
  BookEndInput,
} from '@/helpers/bookEndDetection';
import { seekBack, seekForward } from '@/helpers/relativeSeek';
import { skipToPreviousChapter } from '@/helpers/chapterSkip';
import {
  recordActiveBookPlayFootprint,
  recordActiveBookSeekFootprint,
  recordPreviousPressFootprint,
} from '@/helpers/activeBookFootprints';
import type { Book } from '@/types/Book';
import * as sleepTimer from '@/setup/sleepTimer';
import { useSleepTimerStore } from '@/setup/sleepTimer';

const { setPlaybackProgress } = useLibraryStore.getState();

// SPIKE (Bug B): with clipped per-chapter queues, a Book stored as one file
// flows through the multi-item paths below (queue index == chapter index,
// positions are chapter-relative inside each clipped window). That bypass is
// no longer spelled out at each branch: `queueShapeOf` folds the memory gate
// in and answers 'multi-item' for a clipped Book, so every branch below asks
// the one question. Books the gate excludes from clipping (oversized sample
// tables — see shouldUseClippedChapters) load as ONE legacy track and answer
// 'one-item', exactly like when the spike is off.
/**
 * The library store's entry for a book, or `undefined` when it has none.
 *
 * ⚠ THE `book?.`s IN THIS FILE ARE LOAD-BEARING, AND THIS ACCESSOR IS WHAT
 * MAKES THE COMPILER AGREE WITH THEM. `books` is a `Record<string, Book>`
 * and `noUncheckedIndexedAccess` is off, so `books[bookId]` types as `Book`
 * — never `Book | undefined` — even though at runtime the lookup genuinely
 * misses. That miss is the whole point of the headless / cold-start path
 * `handleRemotePlayBook` and `restoreLastActiveBook` exist for, where this
 * service runs before the library store is populated.
 *
 * Reading the map directly would let the TypeScript conversion type that
 * miss out of existence, leaving every `book?.` below looking like
 * removable noise to the next reader. Routed through here they are
 * compiler-required instead.
 */
function getBookFromStore(bookId: string): Book | undefined {
  return useLibraryStore.getState().books[bookId];
}

// Periodic progress save interval (defense in depth for force-close scenarios)
const PROGRESS_SAVE_INTERVAL = 30000; // 30 seconds
let lastProgressSaveTime = 0;

// Saves at most every 30 seconds during playback to limit data loss.
// Used for both one-item (chapter-relative) and multi-item (track-relative)
// progress — the interval is shared since only one book plays at a time.
async function savePeriodicProgress(bookId: string, progress: number) {
  const now = Date.now();
  if (now - lastProgressSaveTime < PROGRESS_SAVE_INTERVAL) return;
  lastProgressSaveTime = now;
  await updateChapterProgressInDB(bookId, progress);
}

// ─── Progress-event coalescing ─────────────────────────────────────────────
// Android throttles the JS thread during long background (Doze — see the
// backup-timer machinery in sleepTimer.ts). Queued PlaybackProgressUpdated
// events (1/s) then replay in a burst on foreground; without coalescing,
// each runs the full handler below and an hour of backlog saturates the JS
// thread for seconds (stale UI, unresponsive touches). Latest-wins is safe:
// every write in the handler is final-state (chapter index, progress,
// notification metadata), savePeriodicProgress is wall-clock throttled, and
// sleepTimer.onProgressTick ignores position — it only needs a recent call.
// At the normal 1 Hz cadence the pending slot is always empty when an event
// arrives, so behavior is unchanged.
/**
 * The payload RNTP hands the 1 Hz progress event, named through the adapter
 * so this file still imports no RNTP type directly (ADR 0003).
 */
type ProgressUpdatedEvent =
  AppEventPayloadByEvent[Event.PlaybackProgressUpdated];

let pendingProgressEvent: ProgressUpdatedEvent | null = null;
let progressHandlerRunning = false;

function onProgressUpdatedCoalesced(event: ProgressUpdatedEvent) {
  pendingProgressEvent = event;
  if (progressHandlerRunning) return;
  progressHandlerRunning = true;
  (async () => {
    try {
      while (pendingProgressEvent) {
        const ev = pendingProgressEvent;
        pendingProgressEvent = null;
        await handleProgressUpdated(ev);
      }
    } finally {
      progressHandlerRunning = false;
    }
  })();
}

// The 1 Hz handler only ever reads bookId and url off the track, and a queue
// index can't map to a different track without the queue being rebuilt —
// which fires PlaybackActiveTrackChanged (where this cache is invalidated).
// Caching them removes a getTrack() bridge round-trip from every tick.
type ProgressTrackCache = {
  index: number;
  bookId: string | null;
  url: string | null;
};

let progressTrackCache: ProgressTrackCache = {
  index: -1,
  bookId: null,
  url: null,
};

function invalidateProgressTrackCache() {
  progressTrackCache = { index: -1, bookId: null, url: null };
}

// The book most recently marked finished by the lead-time check. The 1 Hz
// tick keeps firing for the whole lead window (~60 ticks), and every
// updateBookProgress(Finished) rewrites `finished_at = new Date()`, so
// without this the stored time would crawl forward to the true end. The
// store's bookProgressValue is the other half of the guard, but it only
// refreshes when the WatermelonDB observer fires — several ticks later.
// Cleared as soon as playback is known to be outside the window, so a book
// replayed from 0:00 (§C5's restart) can be marked again on its next pass.
//
// ⚠ THIS LATCH IS FOR THE 1 Hz TICK AND NOTHING ELSE. It is module state
// living for the whole process, and the only thing that releases it is a
// tick that can positively measure itself outside the window — so on a listen
// where the helper refuses to decide (queue/store disagreement, an index the
// store can no longer supply), it keeps whatever value an EARLIER listen left
// in it. The true-end fallbacks below must therefore never consult it: doing
// so would let a stale latch suppress their mark and lose the ✓ altogether,
// which is the very bug this ticket exists to fix. They read the store, which
// has had the whole lead window to catch up by the time they run.
let finishMarkedBookId: string | null = null;

// Applies an evaluateBookEnd() decision. Marking is ALL it does: it never
// pauses, stops or seeks — see D2 in
// .scratch/book-end-detection/issues/01-mark-finished-before-the-credits.md.
async function applyBookEndDecision(
  bookId: string,
  decision: BookEndDecision,
) {
  if (decision === 'clear') {
    if (finishMarkedBookId === bookId) finishMarkedBookId = null;
    return;
  }
  if (decision !== 'mark') return;

  try {
    // Latch only AFTER the write lands. Latching first would silence every
    // remaining tick in the window if the write never happened, so a book
    // whose getBookById missed would go unmarked until the true end.
    const bookModel = await getBookById(bookId);
    if (!bookModel) return;
    await bookModel.updateBookProgress(BookProgressState.Finished);
    finishMarkedBookId = bookId;
  } catch (error) {
    // updateBookProgress is a raw WatermelonDB writer and throws if the row
    // was destroyed underneath us (a concurrent scan's removeMissingFiles).
    // This runs inside the progress tick, which is driven by an un-awaited
    // IIFE — an escaping rejection would be unhandled AND would skip the
    // sleep-timer tick that follows. The latch stays clear, so the next tick
    // simply tries again. demoteToStarted guards the same call the same way.
    console.error('[service] book end mark failed:', error);
  }
}

// Extracted body of the PlaybackProgressUpdated listener; invoked only via
// onProgressUpdatedCoalesced above.
async function handleProgressUpdated({
  position,
  duration,
  track,
}: ProgressUpdatedEvent) {
  //? event {"buffered": 107.232, "duration": 4626.991, "position": 0.526, "track": 3}
  let bookId: string;
  let trackUrl: string | null;
  if (progressTrackCache.index === track && progressTrackCache.bookId) {
    bookId = progressTrackCache.bookId;
    trackUrl = progressTrackCache.url;
  } else {
    const trackToUpdate = await getTrack(track);

    // getTrack can return undefined mid-queue-transition (reset/book switch).
    // Still tick the sleep timer so a duration timer isn't starved of its
    // primary fire path during a transition.
    if (!trackToUpdate?.bookId) {
      await sleepTimer.onProgressTick(position);
      return;
    }
    bookId = trackToUpdate.bookId;
    trackUrl = trackToUpdate.url;
    progressTrackCache = { index: track, bookId, url: trackUrl };
  }

  const book = getBookFromStore(bookId);

  // ⚠ THIS VERDICT IS `evaluateBookEnd`'S PARAMETER, NOT A COORDINATE
  // DECISION. ADR 0004 leaves `queueShapeOf` three callers — the two queue
  // builders and book-end detection — and hands every reader the position
  // translator instead. What it selects below is not "what does this Position
  // mean" (that is `locateInBook`'s job now) but WHICH SUBSYSTEM OWNS CHAPTER
  // CHANGES: on a one-item Queue only the progress tick can see a boundary
  // cross, while a multi-item Queue gets one `PlaybackActiveTrackChanged` per
  // boundary and must not be counted twice.
  //
  // Asked of the BOOK's own chapters — not of `queue.length`, and no longer of
  // the persisted scan-time flag. The comment this replaces defended that flag
  // as race-immune ("the queue isn't ready after app restart"), but that
  // argument was against the QUEUE READ, not for the flag: the library store
  // hydrates a Book's chapters in the same conversion that reads the flag, so
  // the derived verdict is race-immune for exactly the same reason — and it
  // cannot go stale against a rescan the way a persisted boolean can.
  const oneItemQueue = queueShapeOf(book?.chapters) === 'one-item';

  // Which of the two RUNTIME QUEUE SHAPES this tick is in, set by whichever
  // branch below runs and consumed by the shared end-detection call after
  // them. The branch IS the shape: this one is the Book loaded as a single
  // queue item, so `duration` spans the whole Book. Everything else — one file
  // per Chapter, clipped per-chapter queues, and one-Chapter Books — is one
  // item per Chapter with a chapter-relative `duration`.
  let queueShape: BookEndInput['queueShape'] = 'multi-item';

  if (oneItemQueue && book && book.chapters && book.chapters.length > 1) {
    const chapters = book.chapters;

    // This book is ONE queue item spanning the whole book, so the payload's
    // `duration` is the book's duration and `position` is absolute. Recorded
    // before the writes below, which the translator can decline to authorise.
    queueShape = 'one-item';

    // ⚠ ONE TRANSLATOR CALL WHERE THERE WERE TWO SCANS. Both numbers below
    // came from separate walks of the same chapter array, each assuming the
    // Position was a Book Position — correct only because the branch above
    // had already established the shape. `locateInBook` answers in both
    // coordinates from the one Player reading this handler was given.
    const chapter = locateInBook(chapters, {
      from: 'queue',
      queueIndex: track,
      positionSeconds: position,
    })?.chapter;

    // ⚠ NO CHAPTER, NO WRITE — AND THIS TICK USED TO WRITE ANYWAY. The two
    // deleted scans fabricated an answer for the two Books that have no
    // boundaries to scan: rows that all sit at `startMs: 0` made the
    // backwards walk return the LAST chapter for every position, so a Book
    // reported itself in its final chapter from the first second; a playhead
    // inside a preamble before the first boundary was reported as chapter 0.
    // Both wrote a chapter index and a progress to the store AND the DB every
    // second. Declining is the honest tick: the Book keeps the last position
    // it could account for, and end detection below still runs.
    if (chapter) {
      const currentChapterIndex = chapter.index;
      const progressWithinChapter = chapter.positionSeconds;

      // Update progress in store using progress within chapter
      setPlaybackProgress(bookId, progressWithinChapter);

      // Check if chapter changed
      if (
        singleFileChapterTracking.bookId !== bookId ||
        singleFileChapterTracking.lastChapterIndex !== currentChapterIndex
      ) {
        const previousChapterIndex =
          singleFileChapterTracking.bookId === bookId
            ? singleFileChapterTracking.lastChapterIndex
            : -1;
        const wasChapterChange =
          previousChapterIndex !== -1 &&
          previousChapterIndex !== currentChapterIndex;

        // Update state
        singleFileChapterTracking.bookId = bookId;
        singleFileChapterTracking.lastChapterIndex = currentChapterIndex;

        // Store then DB, as one unit — see helpers/setChapterIndex. This is
        // guarded by the chapter-change check above, which is what stops the
        // 1 Hz tick from rewriting an unchanged index to the DB every second.
        await setChapterIndex(bookId, currentChapterIndex);
        // Progress is written alongside it so the two persist together, even if
        // the app is force-closed.
        await updateChapterProgressInDB(bookId, progressWithinChapter);

        // Update track metadata for lock screen/notification
        if (hasValidChapterData(chapters)) {
          const currentChapter = chapters[currentChapterIndex];
          if (currentChapter) {
            await updateMetadataForTrack(track, {
              title: currentChapter.chapterTitle,
              duration: currentChapter.chapterDuration,
              // Preserve existing metadata that shouldn't change
              artwork: book.artwork ?? undefined,
              artist: book.author,
              album: book.bookTitle,
            });
          }
        }

        // Handle sleep timer chapter countdown on chapter change
        if (wasChapterChange) {
          // Under burst coalescing one handler run can span several chapter
          // boundaries; a chapter-mode sleep timer must count each of them.
          // Backward jumps keep the single-call semantics (a backward seek
          // counted as one change before coalescing too). Capped defensively.
          const forwardBoundaries = Math.min(
            Math.max(currentChapterIndex - previousChapterIndex, 1),
            50,
          );
          for (let i = 0; i < forwardBoundaries; i++) {
            await sleepTimer.onChapterChanged();
          }
        }
      }

      // Periodic progress save (defense in depth for force-close scenarios)
      await savePeriodicProgress(bookId, progressWithinChapter);
    }

    // There used to be a 0.2s "book end" block here that marked the book
    // finished AND zeroed the stored progress AND seeked to 0 AND paused.
    // Those four jobs are now split: the lead-time check below owns the mark
    // and does nothing else, and PlaybackQueueEnded owns the resetting. The
    // early stop is gone on purpose — playing to the true end plays all of
    // it. See D3 in the ticket.
  } else {
    // One item per Chapter, or a Book with only one - update progress normally
    setPlaybackProgress(bookId, position);
    // Periodic save here too — without it, multi-file books persist progress
    // only on pause/stop/track-change, so a process kill mid-chapter loses
    // the whole chapter's position.
    await savePeriodicProgress(bookId, position);
  }

  // Book end detection: mark the book Finished once the audio remaining in
  // the WHOLE book is within the lead time. `position` and `duration` come
  // from the event payload — no getProgress() round-trip — and the later
  // items are summed from the chapter array the store already holds, so this
  // costs arithmetic over an array the handler has scanned twice already.
  //
  // MARKING ONLY: no seek, no pause. A book is finished a minute before its
  // credits and the credits still play through to the true end.
  //
  // ⚠ `track` is the QUEUE's index and `book.chapters` is the STORE's array.
  // They are separate producers (see CORRECTION 3 in the ticket); the helper
  // checks the playing url against the row at that index and refuses to
  // guess if they visibly disagree.
  await applyBookEndDecision(
    bookId,
    evaluateBookEnd({
      position,
      duration,
      queueShape,
      queueChapters: book?.chapters,
      currentIndex: track,
      currentTrackUrl: trackUrl ?? undefined,
      progressState: book?.bookProgressValue,
      alreadyMarked: finishMarkedBookId === bookId,
    }),
  );

  await sleepTimer.onProgressTick(position);
}

// Guard against spurious RemoteStop from Android MediaSession after Doze.
// After extended background, the OS can fire RemoteStop immediately after playback starts.
// We ignore RemoteStop if Playing state was reached within this window.
let lastPlayingStateAt = 0;
const REMOTE_STOP_GUARD_MS = 500;

// ─── Shake-to-reset listener ───────────────────────────────────────────────
// Lives at module scope (NOT inside a React component) so the subscription
// belongs to the playback-service JS runtime. On Android the foreground
// media service keeps that runtime warm even after the user swipes the app
// away, which is the only window in which React-tree subscriptions die but
// the timer keeps ticking.
//
// We only register the RNShake listener when the timer is in the fade
// window OR within the 2-minute post-expiry grace, AND the user has the
// setting enabled — driven by Zustand `subscribe` callbacks that re-evaluate
// on every store change. The accelerometer stays idle outside those windows.
let _shakeSubscription: ReturnType<typeof RNShake.addListener> | null = null;

function _evaluateShakeListenerState() {
  const enabled = useSettingsStore.getState().shakeToResetEnabled;
  const { isFading, expiredAt } = useSleepTimerStore.getState();
  const shouldListen = enabled && (isFading || expiredAt !== null);

  if (shouldListen && _shakeSubscription === null) {
    _shakeSubscription = RNShake.addListener(() => {
      sleepTimer.resetFromShake().then((didReset) => {
        if (didReset) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
            () => {},
          );
        }
      });
    });
  } else if (!shouldListen && _shakeSubscription !== null) {
    _shakeSubscription.remove();
    _shakeSubscription = null;
  }
}

useSleepTimerStore.subscribe(_evaluateShakeListenerState);
useSettingsStore.subscribe(_evaluateShakeListenerState);
_evaluateShakeListenerState();

// Module-level: persists across headless task invocations within one JS
// runtime. Native retries the task dispatch until JS confirms it ran (a
// dispatch during bundle load is silently dropped), so a slow first run
// could be dispatched twice — the guard keeps listeners from registering
// twice in the same runtime.
let serviceListenersRegistered = false;

export default module.exports = async function () {
  if (serviceListenersRegistered) {
    console.log(
      '[service] duplicate task start ignored (listeners already registered)',
    );
    return;
  }
  serviceListenersRegistered = true;
  console.log('[service] playback service task started');

  // IMPORTANT: all addEventListener calls below must run in this function's
  // SYNCHRONOUS section (no `await` above them). Native buffers user-intent
  // events that arrive before the headless task starts and replays them
  // immediately after task dispatch (MusicService.onHeadlessTaskStarted) —
  // that replay is only received if the listeners are already registered.

  subscribe(Event.RemotePlay, async () => {
    // Android Auto follows a browse-item selection with a play() command;
    // acting on it here would resume the OLD queue (and record a footprint
    // for the wrong book) while remote-play-book is still loading the new one.
    if (isBookSwitchInProgress()) return;
    // Footprint for remote play (lock screen, headphones, etc.)
    await recordActiveBookPlayFootprint();
    // QoL: repeat 1s of audio on resume, matching the in-app play button.
    // State-guarded because AA can send redundant play() commands while
    // already playing — rewinding then would cause an audible skip-back.
    const { state } = await getPlaybackState();
    if (state !== State.Playing && state !== State.Buffering) {
      await seekBy(-1);
    }
    await play();
  });
  subscribe(Event.RemotePause, () => {
    pause();
  });
  // Single "toggle" media key (KEYCODE_MEDIA_PLAY_PAUSE) from steering-wheel
  // controls / Bluetooth AVRCP. Native consumes the key event and emits this;
  // without a listener the toggle is a silent no-op.
  subscribe(Event.RemotePlayPause, () => {
    handleRemotePlayPause(recordActiveBookPlayFootprint);
  });
  subscribe(Event.RemoteStop, () => {
    const msSincePlaying = Date.now() - lastPlayingStateAt;
    if (msSincePlaying < REMOTE_STOP_GUARD_MS) {
      return;
    }
    stop();
  });
  subscribe(Event.RemoteSeek, async ({ position }) => {
    // Notification / AA seek-bar drag: mirror the in-app seek bar's
    // footprint. Awaited first so it captures the pre-seek position.
    await recordActiveBookSeekFootprint();
    seekTo(position);
  });
  // seekBack/seekForward (not native seekBy, which clamps within the current
  // queue item) so jumps from the notification / Android Auto cross chapter
  // boundaries exactly like the in-app buttons.
  subscribe(Event.RemoteJumpForward, () => {
    const { skipForwardDuration } = useSettingsStore.getState();
    seekForward(skipForwardDuration);
  });
  subscribe(Event.RemoteJumpBackward, () => {
    const { skipBackDuration } = useSettingsStore.getState();
    seekBack(skipBackDuration);
  });
  subscribe(Event.RemoteNext, async () => {
    const bookId = await getActiveBookId();
    if (!bookId) {
      await skipToNext();
      return;
    }

    // The press itself lives in helpers/nextPress.ts, where it can be
    // tested and where the in-app SkipToNextButton reaches the same code:
    // the footprint must be written BEFORE the seek/skip and ONLY on a branch
    // that moves, and neither property is visible from a "was it recorded?"
    // assertion. See .scratch/remote-noop-footprint/issues/01-*.md.
    await pressNext(bookId, getBookFromStore(bookId));
  });
  subscribe(Event.RemotePrevious, async () => {
    const bookId = await getActiveBookId();

    // Shared with the in-app SkipToPreviousButton: >15s into a chapter
    // restarts it, within the first 15s goes to the previous chapter. The
    // callback mirrors RemoteNext's footprint (awaited pre-seek), labeled
    // by which action the press resolved to.
    await skipToPreviousChapter((kind) =>
      recordPreviousPressFootprint(bookId, kind),
    );
  });
  // ⚠ NOT an Event member. Native emits this custom string from the
  // Android Auto browse path — our own patch, not RNTP. It type-checks
  // because the adapter declares it in `AppEventPayloadByEvent`, which is
  // also where the two casts it costs now live. Ticket 12 answered this;
  // the call site is cast-free on purpose, so if a second custom event
  // appears, teach the adapter rather than casting here.
  subscribe('remote-play-book', ({ bookId }) => {
    console.log('[service] remote-play-book received:', bookId);
    // Queue is about to be rebuilt — old index→bookId mappings are invalid.
    invalidateProgressTrackCache();
    // Handles headless runtimes too: sets up the player if the UI never did
    // and falls back to the DB when the library store is empty.
    handleRemotePlayBook(bookId);
  });

  // Android Auto reconnect / Android 11+ media resumption: load the last
  // active book (paused, at its saved position) so the system's follow-up
  // play() command has a queue to act on. Works headlessly. Native re-emits
  // this event while it waits for the queue, so guard against re-entry.
  let resumptionInFlight = false;
  subscribe(Event.PlaybackResume, async () => {
    if (resumptionInFlight) return;
    resumptionInFlight = true;
    try {
      await ensurePlayerSetup();
      const queue = await getQueue();
      if (queue.length === 0) {
        await restoreLastActiveBook();
      }
    } catch (error) {
      console.error('Playback resumption failed:', error);
    } finally {
      resumptionInFlight = false;
    }
  });

  // Coalesced: see onProgressUpdatedCoalesced / handleProgressUpdated at
  // module scope. Bursts of queued events after long background collapse to
  // the newest event instead of replaying one handler run per queued second.
  subscribe(Event.PlaybackProgressUpdated, onProgressUpdatedCoalesced);

  subscribe(Event.PlaybackQueueEnded, async (event) => {
    const { track, position } = event;
    const trackToUpdate = await getTrack(track);
    if (!trackToUpdate?.bookId) return;

    const book = getBookFromStore(trackToUpdate.bookId);

    // The shape of the Queue that just ended — see the note in
    // `handleProgressUpdated` for why this is derived from the Book's chapters
    // rather than read off the persisted scan-time flag.
    const queueShape = queueShapeOf(book?.chapters);

    if (
      queueShape === 'one-item' &&
      book &&
      book.chapters &&
      book.chapters.length > 1
    ) {
      // A one-item Queue with real Chapters: reset to the first one. Shared with
      // RemoteNext's finish branch — the two paths that finish a Book have
      // to leave it in the same state, and they did not while each kept its
      // own copy of this reset.
      await rewindChapterTracking(trackToUpdate.bookId);
    } else if (queueShape !== 'one-item' && book) {
      // One item per Chapter: the queue index IS the chapter index.
      // `setChapterIndex` writes its store half synchronously before it
      // awaits, so both in-memory writes still land in this one block. That
      // costs the two independent DB writes their old order — index now
      // persists before progress — which is the trade taken deliberately:
      // the alternative delayed the STORE index write by a bridge round-trip,
      // and the store is what `chapterList` reads first.
      setPlaybackProgress(trackToUpdate.bookId, position);
      await setChapterIndex(trackToUpdate.bookId, track);

      await updateChapterProgressInDB(trackToUpdate.bookId, position);
    } else {
      // A Book with one Chapter, or one absent from Zustand: just reset
      // progress. A one-item Queue lands here too when it has nothing to
      // rewind THROUGH — which is the arm a one-chapter Book takes.
      setPlaybackProgress(trackToUpdate.bookId, 0);
      await updateChapterProgressInDB(trackToUpdate.bookId, 0);
    }

    // Mark book as finished when queue ends — unless the lead-time check in
    // handleProgressUpdated already did it a minute ago. The verb owns that
    // guard; D5's `finished_at` is what it protects.
    //
    // ⚠ Position is load-bearing: AFTER the chapter-index writes and BEFORE
    // the transport calls. Moving the mark earlier changes what a concurrent
    // progress tick can observe.
    await markBookFinishedOnce(trackToUpdate.bookId, book);

    // Reset to beginning and stop playback. Which transport does that is the
    // one place the Queue's shape is observable at the end of a Book, and it
    // is deliberately NOT guarded by a chapter count the way the branches
    // above are: a Book with exactly one chapter is one Queue item, and the
    // seek is the honest call on a Queue that has nothing to skip to.
    await rewindPlayerToBookStart(queueShape);
    await stop();
  });

  subscribe(Event.PlaybackState, async (event) => {
    if (
      event.state === State.Paused ||
      event.state === State.Stopped ||
      event.state === State.Buffering
    ) {
      const bookId = await getActiveBookId();
      if (!bookId) return;

      // ⚠ ONE PLAYER READ, BOTH NUMBERS. The Queue index used to be absent
      // here and the handler branched on Queue shape to decide what the
      // Position meant. The translator needs both to answer, and answers for
      // either shape — so this pause/stop path no longer knows what shape it
      // is looking at.
      const [{ position }, queueIndex] = await Promise.all([
        getProgress(),
        getActiveTrackIndex(),
      ]);

      const book = getBookFromStore(bookId);
      if (!book) return; // Not in Zustand yet — skip saving to avoid corruption

      const location = locateInBook(book.chapters, {
        from: 'queue',
        queueIndex,
        positionSeconds: position,
      });

      if (location?.chapter) {
        await updateChapterProgressInDB(
          bookId,
          location.chapter.positionSeconds,
        );
      } else if (location?.bookPositionSeconds == null) {
        // ⚠ WHICH COORDINATE SURVIVED TELLS YOU WHICH READ FAILED, and this
        // is the site that needs the distinction. Reaching here means no
        // Chapter AND no exact Book Position, which is the shape where the
        // Position IS the Chapter Position already: one Queue item per
        // Chapter, with an index the Player could not report. Nothing is
        // fabricated by writing it — the column means "seconds into the
        // Chapter" and that is exactly the number the Player just gave.
        //
        // ⚠ DO NOT "SIMPLIFY" THIS INTO THE BRANCH ABOVE. Requiring a Chapter
        // here is what silently DROPPED the pause write on a chapter Queue
        // whose index read failed, costing the user their position on pause —
        // a write the old shape-branching code never needed an index for.
        // A `null` result (no chapter rows at all) lands here too, and always
        // stored the raw Position.
        await updateChapterProgressInDB(bookId, position);
      }
      // The remaining case is an exact Book Position with no Chapter: ONE
      // Queue item whose rows carry no usable boundaries. That is the only
      // arm where writing `position` would store a BOOK Position in a column
      // meaning seconds into a Chapter — the mix-up the deleted conversion
      // pair invited — so it declines, and the Book keeps the last position
      // it could account for.
    }

    if (event.state === State.Paused) {
      await sleepTimer.onPlaybackPaused();
    }

    if (event.state === State.Stopped) {
      await sleepTimer.onPlaybackStopped();
    }

    // On play: resume timer from saved remaining time (if any), or bedtime auto-activate
    if (event.state === State.Playing) {
      lastPlayingStateAt = Date.now();
      await sleepTimer.onPlaybackResumed();
    }
  });

  subscribe(
    Event.PlaybackActiveTrackChanged,
    async (event) => {
      // Track or queue changed (index can be undefined mid-reset) — either
      // way the progress handler's index→bookId cache may be stale.
      invalidateProgressTrackCache();

      // CRITICAL FIX: Only process valid track indices (>= 0)
      // The event.index can be undefined during queue reset, which would corrupt chapter index
      if (typeof event.index !== 'number' || event.index < 0) return;

      // CRITICAL FIX: Use getTrack(index) instead of getActiveTrack()
      // getActiveTrack() can return stale data during queue transitions
      const trackAtIndex = await getTrack(event.index);
      if (!trackAtIndex?.bookId) return;

      // Skip chapter index updates on a ONE-ITEM Queue — there the index is
      // always 0 and the Chapter comes from the position, which
      // PlaybackProgressUpdated handles.
      //
      // Asked of the BOOK, not of `queue.length`: a Queue read answers about
      // whichever Book happens to be loaded, which is the Book this event is
      // about only once the switch it announces has settled — and it marshals
      // the whole track list across the bridge to learn one boolean.
      const trackBook = getBookFromStore(trackAtIndex.bookId);
      if (queueShapeOf(trackBook?.chapters) === 'one-item') return;

      // MULTI-ITEM Queue: store then DB, as one unit — see
      // helpers/setChapterIndex.
      await setChapterIndex(trackAtIndex.bookId, event.index);

      // Handle sleep timer chapter countdown (multi-item Queues only)
      await sleepTimer.onChapterChanged();
    },
  );

  // Hydrate sleep timer store from DB so UI shows correct state on start.
  // Runs AFTER listener registration — see the ordering note at the top.
  try {
    await sleepTimer.syncFromDB();
  } catch {
    // Non-critical — store will be populated on first progress tick
  }
};
