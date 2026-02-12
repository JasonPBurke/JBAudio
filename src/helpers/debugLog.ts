/**
 * Diagnostic logging for phantom pause investigation.
 * Set ENABLED = false to silence all output.
 *
 * Filter: adb logcat ReactNativeJS:W *:S | grep "\[JBA:"
 */

const ENABLED = true;

// Monotonic sequence counter — establishes absolute event ordering
// across the UI thread and headless service thread.
let seq = 0;

type ComponentTag =
  | 'SVC'   // service.js (headless)
  | 'CTL'   // PlayerControls
  | 'PLR'   // player screen
  | 'FP'    // footprintList
  | 'PB'    // PlayerProgressBar
  | 'SYNC'  // PlayerStateSync
  | 'HBP'   // handleBookPlay
  | 'CHL'   // chapterList
  | 'HOOK'; // useLogTrackPlayerState

/**
 * Structured diagnostic log.
 *
 * Output format:
 *   [JBA:<tag>] #<seq> @<ms-since-epoch> <action> | key=value …
 */
export function jbaLog(
  component: ComponentTag,
  action: string,
  data?: Record<string, unknown>,
) {
  if (!ENABLED) return;
  seq += 1;
  const ts = Date.now();
  const kvPairs = data
    ? ' | ' +
      Object.entries(data)
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
        .join(' ')
    : '';
  console.warn(`[JBA:${component}] #${seq} @${ts} ${action}${kvPairs}`);
}

/** Snapshot the module-scope fadeState for logging. */
export function formatFadeState(fadeState: {
  isFading: boolean;
  baselineVolume: number;
  lastAppliedVolume: number;
}) {
  return {
    isFading: fadeState.isFading,
    baselineVol: fadeState.baselineVolume,
    lastVol: fadeState.lastAppliedVolume,
  };
}

/** Snapshot cached timer state for logging. */
export function formatTimerState(cachedTimer: {
  sleepTime: number | null;
  timerActive: boolean;
  fadeoutDuration: number;
  bedtimeModeEnabled: boolean;
  timerDuration: number | null;
  timerChapters: number | null;
}) {
  return {
    sleepTime: cachedTimer.sleepTime,
    timerActive: cachedTimer.timerActive,
    fadeout: cachedTimer.fadeoutDuration,
    bedtime: cachedTimer.bedtimeModeEnabled,
    duration: cachedTimer.timerDuration,
    chapters: cachedTimer.timerChapters,
  };
}
