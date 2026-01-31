import { create } from 'zustand';
import Purchases, {
  CustomerInfo,
  PurchasesOfferings,
} from 'react-native-purchases';
import { presentPaywall } from 'react-native-purchases-ui';
import * as Sentry from '@sentry/react-native';

interface SubscriptionState {
  // State
  customerInfo: CustomerInfo | null;
  isProUser: boolean;
  isLoading: boolean;
  offerings: PurchasesOfferings | null;

  // Actions
  initialize: () => Promise<void>;
  checkProStatus: () => boolean;
  restorePurchases: () => Promise<CustomerInfo>;
  presentPaywall: () => Promise<void>;
}

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  // Initial state
  customerInfo: null,
  isProUser: false,
  isLoading: true,
  offerings: null,

  // Initialize subscription system
  initialize: async () => {
    set({ isLoading: true });

    try {
      // Fetch customer info (uses cached data if offline)
      const customerInfo = await Purchases.getCustomerInfo();

      // Fetch available offerings
      const offerings = await Purchases.getOfferings();

      // Check if user has active Pro entitlement
      const isProUser = customerInfo.entitlements.active['pro'] !== undefined;

      set({
        customerInfo,
        offerings,
        isProUser,
        isLoading: false,
      });

      // Set up listener for customer info updates
      Purchases.addCustomerInfoUpdateListener((info) => {
        const isPro = info.entitlements.active['pro'] !== undefined;
        set({
          customerInfo: info,
          isProUser: isPro,
        });
      });
    } catch (error) {
      console.error('Failed to initialize RevenueCat:', error);
      Sentry.captureException(error);

      // Graceful fallback - user treated as free tier
      set({
        isLoading: false,
        isProUser: false,
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
      const isProUser = customerInfo.entitlements.active['pro'] !== undefined;

      set({
        customerInfo,
        isProUser,
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
        const isProUser =
          paywallResult.customerInfo.entitlements.active['pro'] !== undefined;
        set({
          customerInfo: paywallResult.customerInfo,
          isProUser,
        });
      }
    } catch (error) {
      // User dismissed paywall or error occurred
      console.log('Paywall dismissed or error:', error);
    }
  },
}));
