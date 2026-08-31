import {
  getPlaybackState,
  pause,
  play,
  setVolume,
  State,
} from '@/player/trackPlayer';
import { AppState } from 'react-native';
import { create } from 'zustand';
import {
  getTimerSettings,
  updateSleepTime,
  updateTimerActive,
  updateChapterRemaining,
  updateFrozenRemaining,
} from '@/db/settingsQueries';
import { isWithinBedtimeWindow } from '@/helpers/bedtimeUtils';
import { recordActiveBookFootprint } from '@/helpers/activeBookFootprints';

// ─── Public Types ─────────────────────────────────────────────────────────────

export type TimerMode =
  | { kind: 'duration'; durationMs: number }
  | { kind: 'chapter'; chaptersRemaining: number };

export type SleepTimerStatus = {
  isActive: boolean;
  mode: 'duration' | 'chapter' | null;
  /** Absolute epoch ms when playback should stop. Set while playing in duration mode. */
  endTimeMs: number | null;
  /** Remaining ms frozen at pause time. Set while paused in duration mode. */
  frozenRemainingMs: number | null;
  /** Chapters remaining before stop. Set in chapter mode. */
  remainingChapters: number | null;
  isFading: boolean;
  /** Epoch ms when the timer last fired. Cleared after SHAKE_GRACE_MS or on activate/cancel/manual resume. */
  expiredAt: number | null;
};

// ─── Zustand Store ────────────────────────────────────────────────────────────

export const useSleepTimerStore = create<SleepTimerStatus>(() => ({
  isActive: false,
  mode: null,
  endTimeMs: null,
  frozenRemainingMs: null,
  remainingChapters: null,
  isFading: false,
  expiredAt: null,
}));

// ─── Internal Constants ───────────────────────────────────────────────────────

// Refresh cadence for re-reading timer settings from DB while a timer is
// running. All activation/cancellation flows through activate()/cancel() in
// this same JS runtime (RNTP's Android service shares the app's JS context),
// so the DB read is only a safety net + pickup for settings-screen changes
// (fadeoutDuration) made mid-timer — not the source of truth.
const SETTINGS_REFRESH_INTERVAL = 30_000;
const VOLUME_THROTTLE_MS = 100;
const BACKUP_TIMER_BUFFER_MS = 2000;
const SHAKE_GRACE_MS = 2 * 60 * 1000;
const SHAKE_COOLDOWN_MS = 1000;

// ─── Internal State ───────────────────────────────────────────────────────────

let fadeState = {
  isFading: false,
  baselineVolume: 1,
  lastAppliedVolume: 1,
  lastSetVolumeAt: 0,
};

let isTimerInitiatedPause = false;

let cachedTimer = {
  sleepTime: null as number | null,
  timerActive: false,
  fadeoutDuration: 0,
  lastRefreshedAt: 0,
  bedtimeModeEnabled: false,
  bedtimeStart: null as number | null,
  bedtimeEnd: null as number | null,
  timerDuration: null as number | null,
  // Chapters left before firing — the RUNNING count. Never the dialed one:
  // `settings.timerChapters` is the user's choice and this module may not
  // change it.
  chaptersRemaining: null as number | null,
};

// In-memory mirror of the persisted frozen remaining ms (duration timer while
// paused). This is a CACHE, not the source of truth: it dies with the JS
// runtime, and the app's runtime dies whenever the user swipes the task away
// (pausing demotes the foreground service, so nothing keeps the process up).
// The durable copy lives in settings.timer_frozen_remaining.
//
// INVARIANT, in memory and on disk alike: an armed duration timer is either
//   RUNNING — sleepTime = absolute end instant, frozen remaining null
//   FROZEN  — frozen remaining = ms left,      sleepTime null
// Never both. Leaving sleepTime set while frozen is what let a paused timer
// count down across a restart, and let the backup timer fire while paused.
let frozenRemainingMs: number | null = null;

let backupTimerId: ReturnType<typeof setTimeout> | null = null;
// Target sleepTime of the currently scheduled backup timer, so per-tick
// rescheduling with an unchanged target is a no-op instead of a
// clearTimeout/setTimeout churn every progress event.
let backupTimerTarget = 0;

// Snapshot of the most recent activation, used to re-arm on shake-reset
// (post-expiry chapter mode loses its remaining count from DB once decremented
// so we keep an in-memory copy of the original mode here).
let lastActivatedMode: TimerMode | null = null;

// Clears expiredAt from the store after the grace window passes.
let graceClearTimerId: ReturnType<typeof setTimeout> | null = null;

// Debounces back-to-back shake events from the package.
let lastShakeHandledAt = 0;

// ─── Private Helpers ──────────────────────────────────────────────────────────

function _setStore(patch: Partial<SleepTimerStatus>): void {
  useSleepTimerStore.setState(patch);
}

function _clearStore(): void {
  // Note: leaves expiredAt untouched so _fire() can set it after clearing.
  // Callers that want to invalidate the post-expiry grace (cancel, activate,
  // manual resume) clear it explicitly via _clearGrace().
  _setStore({
    isActive: false,
    mode: null,
    endTimeMs: null,
    frozenRemainingMs: null,
    remainingChapters: null,
    isFading: false,
  });
}

function _clearGrace(): void {
  if (graceClearTimerId !== null) {
    clearTimeout(graceClearTimerId);
    graceClearTimerId = null;
  }
  if (useSleepTimerStore.getState().expiredAt !== null) {
    _setStore({ expiredAt: null });
  }
}

function scheduleBackupTimer(sleepTimeMs: number): void {
  if (backupTimerId !== null && backupTimerTarget === sleepTimeMs) return;
  cancelBackupTimer();
  backupTimerTarget = sleepTimeMs;
  const delay = Math.max(0, sleepTimeMs - Date.now()) + BACKUP_TIMER_BUFFER_MS;
  backupTimerId = setTimeout(() => {
    backupTimerId = null;
    _fire();
  }, delay);
}

function cancelBackupTimer(): void {
  if (backupTimerId !== null) {
    clearTimeout(backupTimerId);
    backupTimerId = null;
  }
}

// Latch: the backup setTimeout and a progress tick can both reach _fire
// before either writes timerActive=false — both would pass the DB check and
// double-run the writes, interleaving setVolume(0)/setVolume(1).
let isFiring = false;

// Idempotent fire — re-reads DB to confirm timer still active before acting.
// Used by both the primary (progress event) and backup (setTimeout) paths.
async function _fire(): Promise<void> {
  if (isFiring) return;
  isFiring = true;
  try {
    await _fireInner();
  } finally {
    isFiring = false;
  }
}

async function _fireInner(): Promise<void> {
  const settings = await getTimerSettings();
  if (!settings.timerActive || settings.sleepTime === null) return;
  if (settings.sleepTime > Date.now()) return;

  isTimerInitiatedPause = true;
  try {
    // Drop volume instantly (backup path skips gradual fade since events were throttled)
    await setVolume(0);
    await pause();
    await setVolume(1);

    fadeState.isFading = false;
    fadeState.lastAppliedVolume = 1;
    fadeState.baselineVolume = 1;

    await updateTimerActive(false);
    await updateSleepTime(null);
    await updateFrozenRemaining(null);

    frozenRemainingMs = null;
    cachedTimer.lastRefreshedAt = 0;
    _clearStore();

    // Open the post-expiry shake-grace window
    if (graceClearTimerId !== null) clearTimeout(graceClearTimerId);
    _setStore({ expiredAt: Date.now() });
    graceClearTimerId = setTimeout(() => {
      graceClearTimerId = null;
      _setStore({ expiredAt: null });
    }, SHAKE_GRACE_MS);
  } finally {
    isTimerInitiatedPause = false;
  }
  cancelBackupTimer();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Activate the sleep timer. Handles the playing/paused fork internally —
 * callers declare intent, the module figures out the correct DB writes.
 */
export async function activate(mode: TimerMode): Promise<void> {
  // Snapshot the activation so shake-reset knows what to re-arm with,
  // and clear any prior post-expiry grace window.
  lastActivatedMode = mode;
  _clearGrace();

  const playbackState = await getPlaybackState();
  const isPlaying = playbackState.state === State.Playing;

  if (mode.kind === 'duration') {
    if (isPlaying) {
      const endTimeMs = Date.now() + mode.durationMs;
      cachedTimer.sleepTime = endTimeMs;
      cachedTimer.timerActive = true;
      cachedTimer.timerDuration = mode.durationMs;
      cachedTimer.chaptersRemaining = null;
      frozenRemainingMs = null;
      _setStore({
        isActive: true,
        mode: 'duration',
        endTimeMs,
        frozenRemainingMs: null,
        remainingChapters: null,
        isFading: false,
      });
      await updateSleepTime(endTimeMs);
      await updateFrozenRemaining(null);
      scheduleBackupTimer(endTimeMs);
    } else {
      frozenRemainingMs = mode.durationMs;
      cachedTimer.sleepTime = null;
      cachedTimer.timerActive = true;
      cachedTimer.timerDuration = mode.durationMs;
      cachedTimer.chaptersRemaining = null;
      _setStore({
        isActive: true,
        mode: 'duration',
        endTimeMs: null,
        frozenRemainingMs: mode.durationMs,
        remainingChapters: null,
        isFading: false,
      });
      await updateSleepTime(null);
      await updateFrozenRemaining(mode.durationMs);
    }
    await updateTimerActive(true);
    // Writes NO selection. `timer_mode` and the dialed values belong to the
    // user and are written where the user presses; this function only arms.
    // It used to clear `timer_chapters` here, which was the sole enforcement of
    // "one option selected" — a rule three other writers then broke.
    await updateChapterRemaining(null);
  } else {
    // chapter mode
    cachedTimer.timerActive = true;
    cachedTimer.chaptersRemaining = mode.chaptersRemaining;
    cachedTimer.sleepTime = null;
    frozenRemainingMs = null;
    _setStore({
      isActive: true,
      mode: 'chapter',
      endTimeMs: null,
      frozenRemainingMs: null,
      remainingChapters: mode.chaptersRemaining,
      isFading: false,
    });
    await updateTimerActive(true);
    await updateSleepTime(null);
    await updateFrozenRemaining(null);
    // The count to COUNT DOWN, clamped by the caller to what this book can
    // deliver. The dialed `timer_chapters` is untouched, so a choice the
    // current book is too short for returns intact in a longer one.
    await updateChapterRemaining(mode.chaptersRemaining);
  }

  // Re-assert after the awaits above: a progress tick interleaving with the
  // DB writes can refresh cachedTimer from a half-written row and clobber the
  // active flag back to false, which would stall the tick-driven fire path.
  cachedTimer.timerActive = true;

  await recordActiveBookFootprint('timer_activation');
}

/**
 * Cancel the running timer. Resets volume, clears backup timer,
 * writes DB, clears store. Single call replaces the scattered deactivation logic.
 */
export async function cancel(): Promise<void> {
  cancelBackupTimer();
  frozenRemainingMs = null;
  fadeState.isFading = false;
  fadeState.lastAppliedVolume = 1;
  fadeState.baselineVolume = 1;
  cachedTimer.timerActive = false;
  cachedTimer.sleepTime = null;
  cachedTimer.lastRefreshedAt = 0;
  _clearStore();
  _clearGrace();

  await updateTimerActive(false);
  await updateSleepTime(null);
  await updateFrozenRemaining(null);
  await setVolume(1);
}

/**
 * Called on every PlaybackProgressUpdated tick.
 * Handles cache refresh, expiry check, backup timer scheduling, and fade.
 */
export async function onProgressTick(_position: number): Promise<void> {
  const nowTs = Date.now();
  // Refresh from DB only on the first tick after startup/foregrounding
  // (lastRefreshedAt === 0) or periodically while a timer is running. An idle
  // timer costs zero DB reads per tick — activation always lands in this
  // runtime via activate() or onPlaybackResumed. The store's isActive is
  // OR-ed in because activate() sets it synchronously before its DB writes
  // land, so a tick interleaving with activation still refreshes.
  const timerMayBeActive =
    cachedTimer.timerActive || useSleepTimerStore.getState().isActive;
  if (
    !cachedTimer.lastRefreshedAt ||
    (timerMayBeActive &&
      nowTs - cachedTimer.lastRefreshedAt >= SETTINGS_REFRESH_INTERVAL)
  ) {
    const timerSettings = await getTimerSettings();
    cachedTimer.sleepTime = timerSettings.sleepTime;
    cachedTimer.timerActive = !!timerSettings.timerActive;
    cachedTimer.fadeoutDuration =
      typeof timerSettings.fadeoutDuration === 'number'
        ? timerSettings.fadeoutDuration
        : 0;
    cachedTimer.bedtimeModeEnabled = !!timerSettings.bedtimeModeEnabled;
    cachedTimer.bedtimeStart = timerSettings.bedtimeStart;
    cachedTimer.bedtimeEnd = timerSettings.bedtimeEnd;
    cachedTimer.timerDuration = timerSettings.timerDuration;
    cachedTimer.chaptersRemaining = timerSettings.chaptersRemaining;
    cachedTimer.lastRefreshedAt = nowTs;
  }

  const { sleepTime, timerActive, fadeoutDuration, timerDuration } = cachedTimer;

  if (!timerActive) return;

  // Single source of truth for stopping at or after sleep time
  if (sleepTime !== null && sleepTime <= Date.now()) {
    await _fire();
    return;
  }

  // Schedule backup timer for when progress events may be throttled by Doze
  if (sleepTime !== null && sleepTime > Date.now()) {
    scheduleBackupTimer(sleepTime);
  }

  // Fadeout logic
  if (
    sleepTime !== null &&
    typeof fadeoutDuration === 'number' &&
    fadeoutDuration > 0
  ) {
    const now = Date.now();
    const effectiveFadeout =
      timerDuration !== null && timerDuration > 0
        ? Math.min(fadeoutDuration, timerDuration)
        : fadeoutDuration;
    const beginFadeout = sleepTime - effectiveFadeout;

    if (now < beginFadeout && fadeState.isFading) {
      await setVolume(1);
      fadeState.isFading = false;
      fadeState.lastAppliedVolume = 1;
      fadeState.baselineVolume = 1;
    }

    if (now < beginFadeout) {
      if (fadeState.isFading) {
        fadeState.isFading = false;
        fadeState.baselineVolume = 1;
      }
    } else if (now >= beginFadeout && now < sleepTime) {
      if (!fadeState.isFading) {
        fadeState.isFading = true;
        fadeState.baselineVolume = 1;
        fadeState.lastAppliedVolume = 1;
      }
      const t = Math.min(1, Math.max(0, (now - beginFadeout) / effectiveFadeout));
      const volume = Math.max(0, fadeState.baselineVolume * (1 - t));

      const nowSet = Date.now();
      if (
        Math.abs(volume - fadeState.lastAppliedVolume) >= 0.01 &&
        nowSet - fadeState.lastSetVolumeAt >= VOLUME_THROTTLE_MS
      ) {
        await setVolume(volume);
        fadeState.lastAppliedVolume = volume;
        fadeState.lastSetVolumeAt = nowSet;
      }
    }
  }

  // Sync isFading to store when it changes
  if (fadeState.isFading !== useSleepTimerStore.getState().isFading) {
    _setStore({ isFading: fadeState.isFading });
  }
}

/**
 * Called when playback pauses. Freezes the countdown by recording remaining ms.
 * No-op if the pause was timer-initiated.
 */
export async function onPlaybackPaused(): Promise<void> {
  if (isTimerInitiatedPause) return;

  const { sleepTime, timerActive } = await getTimerSettings();
  if (timerActive && sleepTime !== null) {
    const remaining = Math.max(0, sleepTime - Date.now());

    // The pending backup timer was scheduled against the RUNNING end instant.
    // Left armed it would fire mid-pause and stop a timer that is frozen.
    cancelBackupTimer();

    frozenRemainingMs = remaining;
    _setStore({ frozenRemainingMs: remaining, endTimeMs: null });

    // Persist the FROZEN form, and clear the RUNNING one in the same breath.
    // Both halves matter: without the write the freeze dies with the process;
    // without clearing sleepTime, a stale absolute end instant survives that
    // every other path (syncFromDB, _fire, the isExpired check in
    // onPlaybackResumed) reads as a countdown still in flight.
    cachedTimer.sleepTime = null;
    await updateFrozenRemaining(remaining);
    await updateSleepTime(null);
  }
}

/**
 * Called when playback resumes. Handles:
 * - expired timer cleanup (user pressed play after timer lapsed in background)
 * - resume from frozen time
 * - bedtime auto-activation
 */
export async function onPlaybackResumed(): Promise<void> {
  const settings = await getTimerSettings();

  // Clean up expired timer — user pressed play, honour their intent
  const isExpired =
    settings.timerActive &&
    settings.sleepTime !== null &&
    settings.sleepTime <= Date.now();

  if (isExpired) {
    cancelBackupTimer();
    await updateTimerActive(false);
    await updateSleepTime(null);
    await updateFrozenRemaining(null);
    await setVolume(1);
    fadeState.isFading = false;
    fadeState.lastAppliedVolume = 1;
    fadeState.baselineVolume = 1;
    frozenRemainingMs = null;
    cachedTimer.lastRefreshedAt = 0;
    _clearStore();
    // User manually resumed playback — they've taken control, end the grace.
    _clearGrace();
    return;
  }

  // Resume timer from frozen remaining time. The DB value is the fallback,
  // not a redundancy: after a swipe-away the in-memory mirror is gone, and
  // this is the path that turns the restored freeze back into a countdown.
  const frozen = frozenRemainingMs ?? settings.frozenRemainingMs;
  if (frozen !== null && frozen > 0) {
    const newSleepTime = Date.now() + frozen;
    await updateSleepTime(newSleepTime);
    await updateFrozenRemaining(null);
    cachedTimer.sleepTime = newSleepTime;
    cachedTimer.timerActive = true;
    _setStore({
      isActive: true,
      mode: 'duration',
      endTimeMs: newSleepTime,
      frozenRemainingMs: null,
    });
    frozenRemainingMs = null;
    scheduleBackupTimer(newSleepTime);
    return;
  }

  // Bedtime auto-activation
  const inBedtimeWindow = isWithinBedtimeWindow(
    settings.bedtimeStart,
    settings.bedtimeEnd,
  );
  const willActivateBedtime =
    settings.bedtimeModeEnabled && !settings.timerActive && inBedtimeWindow;

  if (willActivateBedtime) {
    await recordActiveBookFootprint('timer_activation');

    if (settings.timerMode === 'duration' && settings.timerDuration !== null) {
      // Bedtime activation: we know we're playing, so compute endTimeMs directly
      const bedtimeSleepTime = Date.now() + settings.timerDuration;
      cachedTimer.sleepTime = bedtimeSleepTime;
      cachedTimer.timerActive = true;
      cachedTimer.timerDuration = settings.timerDuration;
      _setStore({
        isActive: true,
        mode: 'duration',
        endTimeMs: bedtimeSleepTime,
        frozenRemainingMs: null,
        remainingChapters: null,
        isFading: false,
      });
      await updateTimerActive(true);
      await updateSleepTime(bedtimeSleepTime);
      scheduleBackupTimer(bedtimeSleepTime);
    } else if (settings.timerMode === 'chapter') {
      // Arms the DIALED count, not whatever a previous run left in the
      // remaining column. Bedtime honours a chapter selection now; before the
      // selection had its own field this branch was effectively unreachable,
      // because onPlaybackStopped nulled `timer_chapters` every night.
      const dialed = settings.timerChapters ?? 0;
      cachedTimer.timerActive = true;
      cachedTimer.chaptersRemaining = dialed;
      _setStore({
        isActive: true,
        mode: 'chapter',
        endTimeMs: null,
        frozenRemainingMs: null,
        remainingChapters: dialed,
        isFading: false,
      });
      await updateTimerActive(true);
      await updateChapterRemaining(dialed);
    }
  }
}

/**
 * Called when playback stops. Clears all timer state.
 */
export async function onPlaybackStopped(): Promise<void> {
  cancelBackupTimer();
  frozenRemainingMs = null;
  await updateFrozenRemaining(null);
  // Clears the RUNNING count only. It used to null `timer_chapters`, which
  // silently discarded the user's chapter selection every time playback
  // stopped — while a duration selection survived, an asymmetry nothing stated.
  await updateChapterRemaining(null);
  await updateTimerActive(false);
  _clearStore();
}

/**
 * Called when a chapter boundary is crossed (both single-file and multi-file books).
 * Decrements or fires the chapter timer.
 */
export async function onChapterChanged(): Promise<void> {
  const { chaptersRemaining, timerActive } = await getTimerSettings();
  if (!timerActive || chaptersRemaining === null) return;

  if (chaptersRemaining > 0) {
    const newCount = chaptersRemaining - 1;
    await updateChapterRemaining(newCount);
    _setStore({ remainingChapters: newCount });
  } else {
    // chaptersRemaining === 0: fire
    await pause();
    await setVolume(1);
    await updateTimerActive(false);
    _clearStore();

    // Open the post-expiry shake-grace window
    if (graceClearTimerId !== null) clearTimeout(graceClearTimerId);
    _setStore({ expiredAt: Date.now() });
    graceClearTimerId = setTimeout(() => {
      graceClearTimerId = null;
      _setStore({ expiredAt: null });
    }, SHAKE_GRACE_MS);
  }
}

/**
 * Re-arm the timer in response to a device shake. Caller (the shake hook)
 * already gated on (enabled && (isFading || inGrace)), but we re-validate
 * state here defensively — between event dispatch and this call the timer
 * could have been cancelled or expired-then-cleared.
 *
 * - During fade phase (duration mode only): cancel + re-activate at full duration.
 * - Within 2-min post-expiry grace: re-activate at full duration AND resume play.
 */
export async function resetFromShake(): Promise<boolean> {
  const now = Date.now();
  if (now - lastShakeHandledAt < SHAKE_COOLDOWN_MS) return false;
  lastShakeHandledAt = now;

  if (lastActivatedMode === null) return false;

  const status = useSleepTimerStore.getState();
  const inGrace = status.expiredAt !== null;

  // Fade-window reset: only meaningful for duration mode (chapter mode has no fade)
  if (
    status.isActive &&
    status.isFading &&
    lastActivatedMode.kind === 'duration'
  ) {
    const mode = lastActivatedMode;
    await cancel();
    await activate(mode);
    return true;
  }

  // Post-expiry: re-arm and resume playback
  if (inGrace) {
    const mode = lastActivatedMode;
    await activate(mode);
    await play();
    return true;
  }

  return false;
}

/**
 * Synchronous read of current timer status. No DB hit.
 */
export function getStatus(): SleepTimerStatus {
  return useSleepTimerStore.getState();
}

/**
 * Hydrate the Zustand store from DB on service start.
 * Call once in service.ts before registering event listeners.
 */
export async function syncFromDB(): Promise<void> {
  const settings = await getTimerSettings();
  cachedTimer.sleepTime = settings.sleepTime;
  cachedTimer.timerActive = !!settings.timerActive;
  cachedTimer.fadeoutDuration =
    typeof settings.fadeoutDuration === 'number' ? settings.fadeoutDuration : 0;
  cachedTimer.bedtimeModeEnabled = !!settings.bedtimeModeEnabled;
  cachedTimer.bedtimeStart = settings.bedtimeStart;
  cachedTimer.bedtimeEnd = settings.bedtimeEnd;
  cachedTimer.timerDuration = settings.timerDuration;
  cachedTimer.chaptersRemaining = settings.chaptersRemaining;
  cachedTimer.lastRefreshedAt = Date.now();

  frozenRemainingMs = settings.frozenRemainingMs;

  if (!settings.timerActive) return;

  // Checked BEFORE sleepTime. A duration timer has two armed shapes and only
  // one of them counts down; restoring the running shape for a timer that was
  // frozen is what made a paused timer lose the whole time the app was away.
  if (settings.frozenRemainingMs !== null && settings.frozenRemainingMs > 0) {
    _setStore({
      isActive: true,
      mode: 'duration',
      endTimeMs: null,
      frozenRemainingMs: settings.frozenRemainingMs,
      remainingChapters: null,
      isFading: false,
    });
  } else if (settings.sleepTime !== null) {
    _setStore({
      isActive: true,
      mode: 'duration',
      endTimeMs: settings.sleepTime,
      frozenRemainingMs: null,
      remainingChapters: null,
      isFading: false,
    });
  } else if (settings.chaptersRemaining !== null) {
    _setStore({
      isActive: true,
      mode: 'chapter',
      endTimeMs: null,
      frozenRemainingMs: null,
      remainingChapters: settings.chaptersRemaining,
      isFading: false,
    });
  }
}

// Invalidate cached settings when app returns to foreground
AppState.addEventListener('change', (nextAppState) => {
  if (nextAppState === 'active') {
    cachedTimer.lastRefreshedAt = 0;
  }
});
