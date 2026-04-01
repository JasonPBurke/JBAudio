import TrackPlayer, { State } from 'react-native-track-player';
import { AppState } from 'react-native';
import { create } from 'zustand';
import {
  getTimerSettings,
  updateSleepTime,
  updateTimerActive,
  updateChapterTimer,
  updateTimerDuration,
} from '@/db/settingsQueries';
import { isWithinBedtimeWindow } from '@/helpers/bedtimeUtils';
import { recordFootprint } from '@/db/footprintQueries';
import { usePlayerStateStore } from '@/store/playerState';

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
};

// ─── Zustand Store ────────────────────────────────────────────────────────────

export const useSleepTimerStore = create<SleepTimerStatus>(() => ({
  isActive: false,
  mode: null,
  endTimeMs: null,
  frozenRemainingMs: null,
  remainingChapters: null,
  isFading: false,
}));

// ─── Internal Constants ───────────────────────────────────────────────────────

const SETTINGS_REFRESH_INTERVAL = 1000;
const VOLUME_THROTTLE_MS = 100;
const BACKUP_TIMER_BUFFER_MS = 2000;

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
  timerChapters: null as number | null,
};

// In-memory frozen remaining ms (duration timer while paused)
let frozenRemainingMs: number | null = null;

let backupTimerId: ReturnType<typeof setTimeout> | null = null;

// ─── Private Helpers ──────────────────────────────────────────────────────────

function _setStore(patch: Partial<SleepTimerStatus>): void {
  useSleepTimerStore.setState(patch);
}

function _clearStore(): void {
  _setStore({
    isActive: false,
    mode: null,
    endTimeMs: null,
    frozenRemainingMs: null,
    remainingChapters: null,
    isFading: false,
  });
}

function scheduleBackupTimer(sleepTimeMs: number): void {
  cancelBackupTimer();
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

// Idempotent fire — re-reads DB to confirm timer still active before acting.
// Used by both the primary (progress event) and backup (setTimeout) paths.
async function _fire(): Promise<void> {
  const settings = await getTimerSettings();
  if (!settings.timerActive || settings.sleepTime === null) return;
  if (settings.sleepTime > Date.now()) return;

  isTimerInitiatedPause = true;
  try {
    // Drop volume instantly (backup path skips gradual fade since events were throttled)
    await TrackPlayer.setVolume(0);
    await TrackPlayer.pause();
    await TrackPlayer.setVolume(1);

    fadeState.isFading = false;
    fadeState.lastAppliedVolume = 1;
    fadeState.baselineVolume = 1;

    await updateTimerActive(false);
    await updateSleepTime(null);

    frozenRemainingMs = null;
    cachedTimer.lastRefreshedAt = 0;
    _clearStore();
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
  const playbackState = await TrackPlayer.getPlaybackState();
  const isPlaying = playbackState.state === State.Playing;

  if (mode.kind === 'duration') {
    if (isPlaying) {
      const endTimeMs = Date.now() + mode.durationMs;
      cachedTimer.sleepTime = endTimeMs;
      cachedTimer.timerActive = true;
      cachedTimer.timerDuration = mode.durationMs;
      cachedTimer.timerChapters = null;
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
      scheduleBackupTimer(endTimeMs);
    } else {
      frozenRemainingMs = mode.durationMs;
      cachedTimer.sleepTime = null;
      cachedTimer.timerActive = true;
      cachedTimer.timerDuration = mode.durationMs;
      cachedTimer.timerChapters = null;
      _setStore({
        isActive: true,
        mode: 'duration',
        endTimeMs: null,
        frozenRemainingMs: mode.durationMs,
        remainingChapters: null,
        isFading: false,
      });
      await updateSleepTime(null);
    }
    await updateTimerActive(true);
    await updateTimerDuration(mode.durationMs);
    await updateChapterTimer(null);
  } else {
    // chapter mode
    cachedTimer.timerActive = true;
    cachedTimer.timerChapters = mode.chaptersRemaining;
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
    await updateTimerDuration(null);
    await updateSleepTime(null);
    await updateChapterTimer(mode.chaptersRemaining);
  }

  try {
    const activeTrack = await TrackPlayer.getActiveTrack();
    if (activeTrack?.bookId) {
      await recordFootprint(activeTrack.bookId, 'timer_activation');
    }
  } catch {
    // silently fail
  }
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

  await updateTimerActive(false);
  await updateSleepTime(null);
  await TrackPlayer.setVolume(1);
}

/**
 * Called on every PlaybackProgressUpdated tick.
 * Handles cache refresh, expiry check, backup timer scheduling, and fade.
 */
export async function onProgressTick(_position: number): Promise<void> {
  const nowTs = Date.now();
  const isBackground = usePlayerStateStore.getState().isBackground;
  if (
    !isBackground &&
    (!cachedTimer.lastRefreshedAt ||
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
    cachedTimer.timerChapters = timerSettings.timerChapters;
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
      await TrackPlayer.setVolume(1);
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
        await TrackPlayer.setVolume(volume);
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
    frozenRemainingMs = remaining;
    _setStore({ frozenRemainingMs: remaining, endTimeMs: null });
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
    await TrackPlayer.setVolume(1);
    fadeState.isFading = false;
    fadeState.lastAppliedVolume = 1;
    fadeState.baselineVolume = 1;
    frozenRemainingMs = null;
    cachedTimer.lastRefreshedAt = 0;
    _clearStore();
    return;
  }

  // Resume timer from frozen remaining time
  if (frozenRemainingMs !== null && frozenRemainingMs > 0) {
    const newSleepTime = Date.now() + frozenRemainingMs;
    await updateSleepTime(newSleepTime);
    cachedTimer.sleepTime = newSleepTime;
    _setStore({ endTimeMs: newSleepTime, frozenRemainingMs: null });
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
    try {
      const activeTrack = await TrackPlayer.getActiveTrack();
      if (activeTrack?.bookId) {
        await recordFootprint(activeTrack.bookId, 'timer_activation');
      }
    } catch {
      // silently fail
    }

    if (settings.timerDuration !== null) {
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
    } else if (settings.timerChapters !== null) {
      cachedTimer.timerActive = true;
      cachedTimer.timerChapters = settings.timerChapters;
      _setStore({
        isActive: true,
        mode: 'chapter',
        endTimeMs: null,
        frozenRemainingMs: null,
        remainingChapters: settings.timerChapters,
        isFading: false,
      });
      await updateTimerActive(true);
    }
  }
}

/**
 * Called when playback stops. Clears all timer state.
 */
export async function onPlaybackStopped(): Promise<void> {
  cancelBackupTimer();
  frozenRemainingMs = null;
  await updateChapterTimer(null);
  await updateTimerActive(false);
  _clearStore();
}

/**
 * Called when a chapter boundary is crossed (both single-file and multi-file books).
 * Decrements or fires the chapter timer.
 */
export async function onChapterChanged(): Promise<void> {
  const { timerChapters, timerActive } = await getTimerSettings();
  if (!timerActive || timerChapters === null) return;

  if (timerChapters > 0) {
    const newCount = timerChapters - 1;
    await updateChapterTimer(newCount);
    _setStore({ remainingChapters: newCount });
  } else {
    // timerChapters === 0: fire
    await TrackPlayer.pause();
    await TrackPlayer.setVolume(1);
    await updateTimerActive(false);
    _clearStore();
  }
}

/**
 * Synchronous read of current timer status. No DB hit.
 */
export function getStatus(): SleepTimerStatus {
  return useSleepTimerStore.getState();
}

/**
 * Hydrate the Zustand store from DB on service start.
 * Call once in service.js before registering event listeners.
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
  cachedTimer.timerChapters = settings.timerChapters;
  cachedTimer.lastRefreshedAt = Date.now();

  if (!settings.timerActive) return;

  if (settings.sleepTime !== null) {
    _setStore({
      isActive: true,
      mode: 'duration',
      endTimeMs: settings.sleepTime,
      frozenRemainingMs: null,
      remainingChapters: null,
      isFading: false,
    });
  } else if (settings.timerChapters !== null) {
    _setStore({
      isActive: true,
      mode: 'chapter',
      endTimeMs: null,
      frozenRemainingMs: null,
      remainingChapters: settings.timerChapters,
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
