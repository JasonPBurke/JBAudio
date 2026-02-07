/**
 * Trial Manager - Calculates local trial status from RevenueCat's firstSeen date.
 *
 * RevenueCat's firstSeen is tied to the anonymous user ID and persists
 * server-side, so trials survive app reinstalls.
 */

const TRIAL_DURATION_DAYS = 10;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface TrialStatus {
  isInTrial: boolean;
  daysRemaining: number;
  endDate: Date | null;
}

export const trialManager = {
  /**
   * Calculate trial status from RevenueCat's firstSeen date.
   * @param firstSeen - ISO8601 date string from CustomerInfo.firstSeen
   */
  getTrialStatus: (firstSeen: string | undefined): TrialStatus => {
    if (!firstSeen) {
      return { isInTrial: false, daysRemaining: 0, endDate: null };
    }

    const trialStart = new Date(firstSeen).getTime();
    const trialEnd = trialStart + TRIAL_DURATION_DAYS * MS_PER_DAY;
    const now = Date.now();

    const isInTrial = now < trialEnd;
    const remaining = trialEnd - now;
    const daysRemaining = Math.max(0, Math.ceil(remaining / MS_PER_DAY));
    const endDate = new Date(trialEnd);

    return { isInTrial, daysRemaining, endDate };
  },

  /**
   * Check if currently in trial period.
   */
  isInTrialPeriod: (firstSeen: string | undefined): boolean => {
    return trialManager.getTrialStatus(firstSeen).isInTrial;
  },

  /**
   * Get days remaining in trial (0 if expired).
   */
  getDaysRemaining: (firstSeen: string | undefined): number => {
    return trialManager.getTrialStatus(firstSeen).daysRemaining;
  },

  /**
   * Get trial end date for display.
   */
  getTrialEndDate: (firstSeen: string | undefined): Date | null => {
    return trialManager.getTrialStatus(firstSeen).endDate;
  },

  /**
   * Get the trial duration in days (for display purposes).
   */
  getTrialDurationDays: (): number => {
    return TRIAL_DURATION_DAYS;
  },
};
