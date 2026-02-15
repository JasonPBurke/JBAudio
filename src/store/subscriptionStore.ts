import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import Purchases, {
  CustomerInfo,
  PurchasesOfferings,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import * as Sentry from '@sentry/react-native';
import { trialManager } from '@/utils/trialManager';

type SubscriptionTier = 'pro' | 'trial' | 'free';

interface SubscriptionState {
  // State
  customerInfo: CustomerInfo | null;
  isProUser: boolean;
  isLoading: boolean;
  offerings: PurchasesOfferings | null;

  // Local trial state
  isInLocalTrial: boolean;
  trialDaysRemaining: number;
  trialEndDate: Date | null;

  // Actions
  initialize: () => Promise<void>;
  checkProStatus: () => boolean;
  restorePurchases: () => Promise<CustomerInfo>;
  presentPaywall: () => Promise<void>;
  getSubscriptionTier: () => SubscriptionTier;
}

/**
 * Helper to calculate trial and pro status from CustomerInfo.
 * Uses RevenueCat's firstSeen date for trial calculation.
 */
const getStatusFromCustomerInfo = (customerInfo: CustomerInfo) => {
  const hasActiveSubscription =
    customerInfo.entitlements.active['pro'] !== undefined;

  // Calculate trial status from RevenueCat's firstSeen date
  const trialStatus = trialManager.getTrialStatus(customerInfo.firstSeen);

  return {
    hasActiveSubscription,
    isInLocalTrial: trialStatus.isInTrial,
    trialDaysRemaining: trialStatus.daysRemaining,
    trialEndDate: trialStatus.endDate,
    isProUser: hasActiveSubscription || trialStatus.isInTrial,
  };
};

// Track listener reference to prevent duplicates on re-initialization
let customerInfoListener: ((info: CustomerInfo) => void) | null = null;

export const useSubscriptionStore = create<SubscriptionState>()(subscribeWithSelector((set, get) => ({
  // Initial state
  customerInfo: null,
  isProUser: false,
  isLoading: true,
  offerings: null,

  // Local trial state
  isInLocalTrial: false,
  trialDaysRemaining: 0,
  trialEndDate: null,

  // Initialize subscription system
  initialize: async () => {
    set({ isLoading: true });

    // Remove previous listener if re-initializing (e.g. app foreground resume)
    if (customerInfoListener) {
      Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
      customerInfoListener = null;
    }

    // 1. Fetch customer info — critical for trial calculation
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      const status = getStatusFromCustomerInfo(customerInfo);

      set({
        customerInfo,
        isProUser: status.isProUser,
        isInLocalTrial: status.isInLocalTrial,
        trialDaysRemaining: status.trialDaysRemaining,
        trialEndDate: status.trialEndDate,
      });

      // Set up listener for customer info updates
      customerInfoListener = (info: CustomerInfo) => {
        const updatedStatus = getStatusFromCustomerInfo(info);

        set({
          customerInfo: info,
          isProUser: updatedStatus.isProUser,
          isInLocalTrial: updatedStatus.isInLocalTrial,
          trialDaysRemaining: updatedStatus.trialDaysRemaining,
          trialEndDate: updatedStatus.trialEndDate,
        });
      };
      Purchases.addCustomerInfoUpdateListener(customerInfoListener);
    } catch (error) {
      console.error('Failed to fetch customer info:', error);
      Sentry.captureException(error);

      // Graceful fallback — no trial available if RevenueCat fails
      // (we need firstSeen from RevenueCat to calculate trial)
      set({
        isProUser: false,
        isInLocalTrial: false,
        trialDaysRemaining: 0,
        trialEndDate: null,
      });
    }

    // 2. Fetch offerings independently — failure here shouldn't break trial
    try {
      const offerings = await Purchases.getOfferings();
      set({ offerings });
    } catch (error) {
      console.warn('Failed to fetch offerings (products may not be configured yet):', error);
    }

    set({ isLoading: false });
  },

  // Check Pro status
  checkProStatus: () => {
    return get().isProUser;
  },

  // Restore purchases (for reinstalls/device switches)
  restorePurchases: async () => {
    set({ isLoading: true });

    try {
      const customerInfo = await Purchases.restorePurchases();
      const status = getStatusFromCustomerInfo(customerInfo);

      set({
        customerInfo,
        isProUser: status.isProUser,
        isInLocalTrial: status.isInLocalTrial,
        trialDaysRemaining: status.trialDaysRemaining,
        trialEndDate: status.trialEndDate,
        isLoading: false,
      });

      return customerInfo;
    } catch (error) {
      console.error('Failed to restore purchases:', error);
      Sentry.captureException(error);
      set({ isLoading: false });
      throw error;
    }
  },

  // Present paywall modal
  presentPaywall: async () => {
    try {
      const result = await RevenueCatUI.presentPaywall({
        offering: get().offerings?.current ?? undefined,
      });

      // Re-fetch customer info after a purchase or restore for immediate UI update
      // (the customerInfoUpdateListener also fires, but this ensures synchronous resolution)
      if (
        result === PAYWALL_RESULT.PURCHASED ||
        result === PAYWALL_RESULT.RESTORED
      ) {
        const customerInfo = await Purchases.getCustomerInfo();
        const status = getStatusFromCustomerInfo(customerInfo);

        set({
          customerInfo,
          isProUser: status.isProUser,
          isInLocalTrial: status.isInLocalTrial,
          trialDaysRemaining: status.trialDaysRemaining,
          trialEndDate: status.trialEndDate,
        });
      }
    } catch (error) {
      // User dismissed paywall or error occurred
      console.log('Paywall dismissed or error:', error);
    }
  },

  // Determine which subscription tier the user is in
  getSubscriptionTier: (): SubscriptionTier => {
    const state = get();
    if (state.customerInfo?.entitlements.active['pro']) {
      return 'pro'; // Paid subscriber
    }
    if (state.isInLocalTrial) {
      return 'trial'; // In local trial
    }
    return 'free'; // Trial expired, not subscribed
  },
})));
