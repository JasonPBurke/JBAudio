/**
 * Checks if the current time is within the bedtime window.
 * Handles overnight spans (e.g., 10pm-8am crosses midnight).
 *
 * @param bedtimeStart - Start time in minutes since midnight (0-1439)
 * @param bedtimeEnd - End time in minutes since midnight (0-1439)
 * @returns true if current time is within the window
 */
export function isWithinBedtimeWindow(
  bedtimeStart: number | null,
  bedtimeEnd: number | null
): boolean {
  if (bedtimeStart === null || bedtimeEnd === null) {
    return false;
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Handle overnight spans (start > end means window crosses midnight)
  // e.g., start=1320 (10pm), end=480 (8am)
  if (bedtimeStart > bedtimeEnd) {
    // Overnight: current time should be >= start OR <= end
    return currentMinutes >= bedtimeStart || currentMinutes <= bedtimeEnd;
  } else {
    // Same day: current time should be >= start AND <= end
    return currentMinutes >= bedtimeStart && currentMinutes <= bedtimeEnd;
  }
}

/**
 * Converts a Date object to minutes since midnight.
 */
export function dateToMinutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Converts minutes since midnight to a Date object (today's date).
 */
export function minutesSinceMidnightToDate(minutes: number): Date {
  const date = new Date();
  date.setHours(Math.floor(minutes / 60));
  date.setMinutes(minutes % 60);
  date.setSeconds(0);
  date.setMilliseconds(0);
  return date;
}
