import TrackPlayer, { Event, State } from 'react-native-track-player';
import RNShake from 'react-native-shake';
import * as Haptics from 'expo-haptics';
import { useLibraryStore } from '@/store/library';
import { useSettingsStore } from '@/store/settingsStore';
import {
  updateChapterProgressInDB,
  updateChapterIndexInDB,
} from '@/db/chapterQueries';
import { getBookById } from '@/db/bookQueries';
import { BookProgressState } from '@/helpers/handleBookPlay';
import { handleRemotePlayPause } from '@/helpers/remotePlayPause';
import {
  handleRemotePlayBook,
  isBookSwitchInProgress,
} from '@/helpers/remotePlayBook';
import { ensurePlayerSetup } from '@/helpers/playerSetup';
import { restoreLastActiveBook } from '@/helpers/restoreLastActiveBook';
import { CLIPPED_CHAPTERS_SPIKE } from '@/constants/featureFlags';
import { recordFootprint } from '@/db/footprintQueries';
import {
  findChapterIndexByPosition,
  calculateProgressWithinChapter,
  hasValidChapterData,
  getNextChapterStartSeconds,
  getPreviousChapterStartSeconds,
} from '@/helpers/singleFileBook';
import * as sleepTimer from '@/setup/sleepTimer';
import { useSleepTimerStore } from '@/setup/sleepTimer';

const { setPlaybackIndex, setPlaybackProgress } =
  useLibraryStore.getState();

// SPIKE (Bug B): with clipped per-chapter queues, single-file books flow
// through the multi-file code paths below (queue index == chapter index,
// positions are chapter-relative inside each clipped window), so the
// isSingleFile special-casing must be bypassed while the spike is on.
const treatAsSingleFile = (book) =>
  !CLIPPED_CHAPTERS_SPIKE && (book?.isSingleFile ?? false);

// Single-file book chapter tracking state (module-scope)
let singleFileChapterState = {
  lastChapterIndex: -1,
  bookId: null,
};

// Periodic progress save interval (defense in depth for force-close scenarios)
const PROGRESS_SAVE_INTERVAL = 30000; // 30 seconds
let lastProgressSaveTime = 0;

// Saves at most every 30 seconds during playback to limit data loss.
// Used for both single-file (chapter-relative) and multi-file (track-relative)
// progress — the interval is shared since only one book plays at a time.
async function savePeriodicProgress(bookId, progress) {
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
let pendingProgressEvent = null;
let progressHandlerRunning = false;

function onProgressUpdatedCoalesced(event) {
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

// The 1 Hz handler only ever reads bookId off the track, and a queue index
// can't map to a different bookId without the queue being rebuilt — which
// fires PlaybackActiveTrackChanged (where this cache is invalidated). Caching
// it removes a getTrack() bridge round-trip from every tick.
let progressTrackCache = { index: -1, bookId: null };

function invalidateProgressTrackCache() {
  progressTrackCache = { index: -1, bookId: null };
}

// Extracted body of the PlaybackProgressUpdated listener; invoked only via
// onProgressUpdatedCoalesced above.
async function handleProgressUpdated({ position, duration, track }) {
  //? event {"buffered": 107.232, "duration": 4626.991, "position": 0.526, "track": 3}
  let bookId;
  if (progressTrackCache.index === track && progressTrackCache.bookId) {
    bookId = progressTrackCache.bookId;
  } else {
    const trackToUpdate = await TrackPlayer.getTrack(track);

    // getTrack can return undefined mid-queue-transition (reset/book switch).
    // Still tick the sleep timer so a duration timer isn't starved of its
    // primary fire path during a transition.
    if (!trackToUpdate?.bookId) {
      await sleepTimer.onProgressTick(position);
      return;
    }
    bookId = trackToUpdate.bookId;
    progressTrackCache = { index: track, bookId };
  }

  // Get book data from library store - use isSingleFile from DB to avoid queue race condition
  const book = useLibraryStore.getState().books[bookId];

  // Use isSingleFile from database (set at scan time) instead of queue.length
  // This eliminates the race condition where queue isn't ready after app restart
  const isSingleFile = treatAsSingleFile(book);

  if (
    isSingleFile &&
    book &&
    book.chapters &&
    book.chapters.length > 1
  ) {
    const chapters = book.chapters;
    const currentChapterIndex = findChapterIndexByPosition(
      chapters,
      position,
    );
    const progressWithinChapter = calculateProgressWithinChapter(
      chapters,
      position,
    );

    // Update progress in store using progress within chapter
    setPlaybackProgress(bookId, progressWithinChapter);

    //! this was unstable and did not update the notification player w/chapter durations.
    // // Update now playing metadata with chapter-relative position for lock screen
    // // This makes the progress bar show chapter progress instead of full book progress
    // if (hasValidChapterData(chapters)) {
    //   const currentChapter = chapters[currentChapterIndex];
    //   if (currentChapter) {
    //     await TrackPlayer.updateNowPlayingMetadata({
    //       elapsedTime: progressWithinChapter,
    //       duration: currentChapter.chapterDuration,
    //     });
    //   }
    // }

    // Check if chapter changed
    if (
      singleFileChapterState.bookId !== bookId ||
      singleFileChapterState.lastChapterIndex !== currentChapterIndex
    ) {
      const previousChapterIndex =
        singleFileChapterState.bookId === bookId
          ? singleFileChapterState.lastChapterIndex
          : -1;
      const wasChapterChange =
        previousChapterIndex !== -1 &&
        previousChapterIndex !== currentChapterIndex;

      // Update state
      singleFileChapterState.bookId = bookId;
      singleFileChapterState.lastChapterIndex = currentChapterIndex;

      // Update Zustand store for UI reactivity
      setPlaybackIndex(bookId, currentChapterIndex);
      // Update database for persistence - save BOTH chapterIndex AND progress atomically
      // This ensures they're always in sync, even if app is force-closed
      await updateChapterIndexInDB(bookId, currentChapterIndex);
      await updateChapterProgressInDB(bookId, progressWithinChapter);

      // Update track metadata for lock screen/notification
      if (hasValidChapterData(chapters)) {
        const currentChapter = chapters[currentChapterIndex];
        if (currentChapter) {
          await TrackPlayer.updateMetadataForTrack(track, {
            title: currentChapter.chapterTitle,
            duration: currentChapter.chapterDuration,
            // Preserve existing metadata that shouldn't change
            artwork: book.artwork,
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

    // Book end detection: check if position is near end of book.
    // `duration` comes from the event payload — no getProgress() round-trip.
    const END_THRESHOLD = 0.2; // .2 seconds before end to trigger
    if (duration > 0 && position >= duration - END_THRESHOLD) {
      // Mark book as finished
      const bookModel = await getBookById(bookId);
      if (bookModel) {
        await bookModel.updateBookProgress(BookProgressState.Finished);
      }

      // Save final progress
      await updateChapterProgressInDB(bookId, 0);
      await updateChapterIndexInDB(bookId, 0);

      // Reset to beginning and stop
      await TrackPlayer.seekTo(0);
      await TrackPlayer.pause();

      // Reset chapter tracking state
      singleFileChapterState.lastChapterIndex = 0;

      return;
    }
  } else {
    // Multi-file book OR single-chapter book - just update progress normally
    setPlaybackProgress(bookId, position);
    // Periodic save here too — without it, multi-file books persist progress
    // only on pause/stop/track-change, so a process kill mid-chapter loses
    // the whole chapter's position.
    await savePeriodicProgress(bookId, position);
  }

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
let _shakeSubscription = null;

function _evaluateShakeListenerState() {
  const enabled = useSettingsStore.getState().shakeToResetEnabled;
  const { isFading, expiredAt } = useSleepTimerStore.getState();
  const shouldListen = enabled && (isFading || expiredAt !== null);

  if (shouldListen && _shakeSubscription === null) {
    _shakeSubscription = RNShake.addListener(() => {
      sleepTimer.resetFromShake().then((didReset) => {
        if (didReset) {
          Haptics.impactAsync(
            Haptics.ImpactFeedbackStyle.Medium,
          ).catch(() => {});
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
    console.log('[service] duplicate task start ignored (listeners already registered)');
    return;
  }
  serviceListenersRegistered = true;
  console.log('[service] playback service task started');

  // IMPORTANT: all addEventListener calls below must run in this function's
  // SYNCHRONOUS section (no `await` above them). Native buffers user-intent
  // events that arrive before the headless task starts and replays them
  // immediately after task dispatch (MusicService.onHeadlessTaskStarted) —
  // that replay is only received if the listeners are already registered.

  // Record footprint for remote play (lock screen, headphones, etc.)
  const recordRemotePlayFootprint = async () => {
    try {
      const activeTrack = await TrackPlayer.getActiveTrack();
      if (activeTrack?.bookId) {
        await recordFootprint(activeTrack.bookId, 'play');
      }
    } catch {
      // Silently fail if footprint recording fails
    }
  };

  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    // Android Auto follows a browse-item selection with a play() command;
    // acting on it here would resume the OLD queue (and record a footprint
    // for the wrong book) while remote-play-book is still loading the new one.
    if (isBookSwitchInProgress()) return;
    await recordRemotePlayFootprint();
    await TrackPlayer.play();
  });
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    TrackPlayer.pause();
  });
  // Single "toggle" media key (KEYCODE_MEDIA_PLAY_PAUSE) from steering-wheel
  // controls / Bluetooth AVRCP. Native consumes the key event and emits this;
  // without a listener the toggle is a silent no-op.
  TrackPlayer.addEventListener(Event.RemotePlayPause, () => {
    handleRemotePlayPause(recordRemotePlayFootprint);
  });
  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    const msSincePlaying = Date.now() - lastPlayingStateAt;
    if (msSincePlaying < REMOTE_STOP_GUARD_MS) {
      return;
    }
    TrackPlayer.stop();
  });
  TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) => {
    TrackPlayer.seekTo(position);
  });
  TrackPlayer.addEventListener(Event.RemoteJumpForward, () => {
    const { skipForwardDuration } = useSettingsStore.getState();
    TrackPlayer.seekBy(skipForwardDuration);
  });
  TrackPlayer.addEventListener(Event.RemoteJumpBackward, () => {
    const { skipBackDuration } = useSettingsStore.getState();
    TrackPlayer.seekBy(-skipBackDuration);
  });
  TrackPlayer.addEventListener(Event.RemoteNext, async () => {
    const activeTrack = await TrackPlayer.getActiveTrack();
    if (!activeTrack?.bookId) {
      await TrackPlayer.skipToNext();
      return;
    }

    const book = useLibraryStore.getState().books[activeTrack.bookId];
    if (treatAsSingleFile(book) && book.chapters && book.chapters.length > 1) {
      const { position } = await TrackPlayer.getProgress();
      const nextStart = getNextChapterStartSeconds(book.chapters, position);

      if (nextStart !== null) {
        await TrackPlayer.seekTo(nextStart);
      } else {
        // At last chapter: mark finished, reset and pause
        const bookModel = await getBookById(activeTrack.bookId);
        if (bookModel) {
          await bookModel.updateBookProgress(BookProgressState.Finished);
        }
        await TrackPlayer.seekTo(0);
        await TrackPlayer.pause();
      }
    } else {
      await TrackPlayer.skipToNext();
    }
  });
  TrackPlayer.addEventListener(Event.RemotePrevious, async () => {
    const activeTrack = await TrackPlayer.getActiveTrack();
    if (!activeTrack?.bookId) {
      await TrackPlayer.skipToPrevious();
      return;
    }

    const book = useLibraryStore.getState().books[activeTrack.bookId];
    if (treatAsSingleFile(book) && book.chapters && book.chapters.length > 1) {
      const { position } = await TrackPlayer.getProgress();
      const prevStart = getPreviousChapterStartSeconds(book.chapters, position);
      await TrackPlayer.seekTo(prevStart);
    } else {
      await TrackPlayer.skipToPrevious();
    }
  });
  TrackPlayer.addEventListener('remote-play-book', ({ bookId }) => {
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
  TrackPlayer.addEventListener(Event.PlaybackResume, async () => {
    if (resumptionInFlight) return;
    resumptionInFlight = true;
    try {
      await ensurePlayerSetup();
      const queue = await TrackPlayer.getQueue();
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
  TrackPlayer.addEventListener(
    Event.PlaybackProgressUpdated,
    onProgressUpdatedCoalesced,
  );

  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, async (event) => {
    const { track, position } = event;
    const trackToUpdate = await TrackPlayer.getTrack(track);
    if (!trackToUpdate?.bookId) return;

    // Get book data from library store - use isSingleFile from DB to avoid queue race condition
    const book = useLibraryStore.getState().books[trackToUpdate.bookId];

    // Use isSingleFile from database (set at scan time) instead of queue.length
    const isSingleFile = treatAsSingleFile(book);

    if (isSingleFile && book && book.chapters && book.chapters.length > 1) {
      // Single-file book with chapters: reset to beginning
      setPlaybackProgress(trackToUpdate.bookId, 0);
      setPlaybackIndex(trackToUpdate.bookId, 0);

      await updateChapterProgressInDB(trackToUpdate.bookId, 0);
      await updateChapterIndexInDB(trackToUpdate.bookId, 0);

      // Reset chapter tracking state
      singleFileChapterState.lastChapterIndex = 0;
      singleFileChapterState.bookId = trackToUpdate.bookId;
    } else if (!isSingleFile && book) {
      // Multi-file book: use track index as chapter index
      setPlaybackProgress(trackToUpdate.bookId, position);
      setPlaybackIndex(trackToUpdate.bookId, track);

      await updateChapterProgressInDB(trackToUpdate.bookId, position);
      await updateChapterIndexInDB(trackToUpdate.bookId, track);
    } else {
      // Single chapter book or book not in Zustand: just reset progress
      setPlaybackProgress(trackToUpdate.bookId, 0);
      await updateChapterProgressInDB(trackToUpdate.bookId, 0);
    }

    // Mark book as finished when queue ends
    const bookModel = await getBookById(trackToUpdate.bookId);
    if (bookModel) {
      await bookModel.updateBookProgress(BookProgressState.Finished);
    }

    // Reset to beginning and stop playback
    if (isSingleFile) {
      await TrackPlayer.seekTo(0);
    } else {
      await TrackPlayer.skip(0);
    }
    await TrackPlayer.stop();
  });

  TrackPlayer.addEventListener(Event.PlaybackState, async (event) => {
    if (
      event.state === State.Paused ||
      event.state === State.Stopped ||
      event.state === State.Buffering
    ) {
      const activeTrack = await TrackPlayer.getActiveTrack();
      if (!activeTrack?.bookId) return;

      const { position } = await TrackPlayer.getProgress();

      // Get book data from library store - use isSingleFile from DB to avoid queue race condition
      const book = useLibraryStore.getState().books[activeTrack.bookId];

      // Use isSingleFile from database (set at scan time) instead of queue.length
      // This eliminates the race condition where queue isn't ready after app restart
      const isSingleFile = treatAsSingleFile(book);

      if (
        isSingleFile &&
        book &&
        book.chapters &&
        book.chapters.length > 1
      ) {
        // Single-file book with chapters: save progress within chapter
        const progressWithinChapter = calculateProgressWithinChapter(
          book.chapters,
          position,
        );
        await updateChapterProgressInDB(
          activeTrack.bookId,
          progressWithinChapter,
        );
      } else if (book) {
        // Multi-file book OR single-chapter book: save progress directly
        await updateChapterProgressInDB(activeTrack.bookId, position);
      }
      // If book not in Zustand yet, skip saving to avoid corruption
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

  TrackPlayer.addEventListener(
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
      const trackAtIndex = await TrackPlayer.getTrack(event.index);
      if (!trackAtIndex?.bookId) return;

      // Skip chapter index updates for single-file books - handled in PlaybackProgressUpdated
      const queue = await TrackPlayer.getQueue();
      const isSingleFile = queue.length === 1;
      if (isSingleFile) return;

      // Multi-file book: Update Zustand store immediately for UI reactivity
      setPlaybackIndex(trackAtIndex.bookId, event.index);
      // Update database for persistence
      await updateChapterIndexInDB(trackAtIndex.bookId, event.index);

      // Handle sleep timer chapter countdown (multi-file books only)
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
