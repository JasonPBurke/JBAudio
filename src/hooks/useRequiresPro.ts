import { useSubscriptionStore } from '@/store/subscriptionStore';

/**
 * Hook for feature gating Pro functionality
 *
 * @returns Object with isProUser status and presentPaywall function
 *
 * @example
 * const { isProUser, presentPaywall } = useRequiresPro();
 *
 * const handleProFeature = async () => {
 *   if (!isProUser) {
 *     await presentPaywall();
 *     return;
 *   }
 *   // Execute pro feature
 * };
 */
export const useRequiresPro = () => {
  const isProUser = useSubscriptionStore((state) => state.isProUser);
  const isLoading = useSubscriptionStore((state) => state.isLoading);
  const presentPaywall = useSubscriptionStore((state) => state.presentPaywall);
  const hasPurchasedPro = useSubscriptionStore(
    (state) => state.customerInfo?.entitlements.active['pro'] !== undefined,
  );

  return {
    isProUser,
    isLoading,
    presentPaywall,
    /** True only for paid subscribers — false during trial and when free */
    hasPurchasedPro,
  };
};
