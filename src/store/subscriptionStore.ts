import { create } from 'zustand';
import Purchases, {
  CustomerInfo,
  PurchasesOfferings,
} from 'react-native-purchases';
import { presentPaywall } from 'react-native-purchases-ui';
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

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
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

    try {
      // Fetch customer info (uses cached data if offline)
      // RevenueCat's firstSeen date is used for trial calculation
      const customerInfo = await Purchases.getCustomerInfo();

      // Fetch available offerings
      const offerings = await Purchases.getOfferings();

      // Calculate subscription and trial status
      const status = getStatusFromCustomerInfo(customerInfo);

      set({
        customerInfo,
        offerings,
        isProUser: status.isProUser,
        isInLocalTrial: status.isInLocalTrial,
        trialDaysRemaining: status.trialDaysRemaining,
        trialEndDate: status.trialEndDate,
        isLoading: false,
      });

      // Set up listener for customer info updates
      Purchases.addCustomerInfoUpdateListener((info) => {
        const updatedStatus = getStatusFromCustomerInfo(info);

        set({
          customerInfo: info,
          isProUser: updatedStatus.isProUser,
          isInLocalTrial: updatedStatus.isInLocalTrial,
          trialDaysRemaining: updatedStatus.trialDaysRemaining,
          trialEndDate: updatedStatus.trialEndDate,
        });
      });
    } catch (error) {
      console.error('Failed to initialize RevenueCat:', error);
      Sentry.captureException(error);

      // Graceful fallback - no trial available if RevenueCat fails
      // (we need firstSeen from RevenueCat to calculate trial)
      set({
        isLoading: false,
        isProUser: false,
        isInLocalTrial: false,
        trialDaysRemaining: 0,
        trialEndDate: null,
      });
    }
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
      const paywallResult = await presentPaywall({
        offering: get().offerings?.current ?? undefined,
      });

      // If user made a purchase, paywallResult contains updated customerInfo
      if (paywallResult.customerInfo) {
        const status = getStatusFromCustomerInfo(paywallResult.customerInfo);

        set({
          customerInfo: paywallResult.customerInfo,
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
}));
