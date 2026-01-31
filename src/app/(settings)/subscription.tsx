import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import { presentCustomerCenter } from 'react-native-purchases-ui';
import { useTheme } from '@/hooks/useTheme';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import SettingsHeader from '@/components/SettingsHeader';
import { screenPadding } from '@/constants/tokens';
import { Crown } from 'lucide-react-native';
import type { CustomerInfo } from 'react-native-purchases';

// Helper to get subscription status details
const getSubscriptionStatus = (
  customerInfo: CustomerInfo | null,
  isProUser: boolean
) => {
  if (!isProUser) {
    return {
      title: 'Free Plan',
      subtitle: 'Upgrade to unlock all features',
      badgeColor: '#6B7280',
      badgeText: 'FREE',
    };
  }

  const proEntitlement = customerInfo?.entitlements.active['pro'];

  if (
    proEntitlement?.willRenew === false &&
    proEntitlement?.periodType === 'trial'
  ) {
    // Trial period
    const expirationDate = new Date(proEntitlement.expirationDate ?? Date.now());
    const now = new Date();
    const daysRemaining = Math.ceil(
      (expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      title: 'Pro Trial',
      subtitle: `${daysRemaining} days remaining`,
      badgeColor: '#F59E0B',
      badgeText: 'TRIAL',
      showProgress: true,
      progress: daysRemaining / 30, // Assuming 30-day trial
    };
  }

  // Paid Pro user
  return {
    title: 'Pro Member',
    subtitle: 'All features unlocked',
    badgeColor: '#10B981',
    badgeText: 'PRO',
  };
};

// Status Card Component
const StatusCard = ({
  customerInfo,
  isProUser,
  colors,
}: {
  customerInfo: CustomerInfo | null;
  isProUser: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
}) => {
  const status = getSubscriptionStatus(customerInfo, isProUser);

  return (
    <View style={[styles.statusCard, { backgroundColor: colors.background }]}>
      <View style={styles.statusHeader}>
        <Crown size={32} color={status.badgeColor} />
        <View style={[styles.badge, { backgroundColor: status.badgeColor }]}>
          <Text style={styles.badgeText}>{status.badgeText}</Text>
        </View>
      </View>

      <Text style={[styles.statusTitle, { color: colors.text }]}>
        {status.title}
      </Text>
      <Text style={[styles.statusSubtitle, { color: colors.textMuted }]}>
        {status.subtitle}
      </Text>

      {status.showProgress && (
        <View style={styles.progressContainer}>
          <View style={[styles.progressBar, { backgroundColor: colors.divider }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: status.badgeColor,
                  width: `${(status.progress ?? 0) * 100}%`,
                },
              ]}
            />
          </View>
        </View>
      )}
    </View>
  );
};

// Action Buttons Component
const ActionButtons = ({
  isProUser,
  colors,
}: {
  isProUser: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
}) => {
  const { presentPaywall, restorePurchases, isLoading } = useSubscriptionStore();

  const handleUpgrade = async () => {
    await presentPaywall();
  };

  const handleManageSubscription = async () => {
    try {
      await presentCustomerCenter();
    } catch (error) {
      console.error('Failed to present customer center:', error);
      Alert.alert('Error', 'Could not open subscription management');
    }
  };

  const handleRestore = async () => {
    try {
      const customerInfo = await restorePurchases();
      const hasProAccess = customerInfo.entitlements.active['pro'] !== undefined;

      if (hasProAccess) {
        Alert.alert('Success', 'Your purchases have been restored!');
      } else {
        Alert.alert(
          'No Purchases Found',
          'We could not find any purchases to restore.'
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
    }
  };

  return (
    <View style={styles.actionsContainer}>
      {!isProUser ? (
        <Pressable
          style={[styles.primaryButton, { backgroundColor: colors.primary }]}
          onPress={handleUpgrade}
          disabled={isLoading}
        >
          <Crown size={20} color='#FFFFFF' />
          <Text style={styles.primaryButtonText}>Upgrade to Pro</Text>
        </Pressable>
      ) : (
        <Pressable
          style={[styles.secondaryButton, { borderColor: colors.divider }]}
          onPress={handleManageSubscription}
          disabled={isLoading}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
            Manage Subscription
          </Text>
        </Pressable>
      )}

      <Pressable
        style={[styles.secondaryButton, { borderColor: colors.divider }]}
        onPress={handleRestore}
        disabled={isLoading}
      >
        <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
          Restore Purchases
        </Text>
      </Pressable>
    </View>
  );
};

const SubscriptionScreen = () => {
  const { colors } = useTheme();
  const { customerInfo, isProUser, isLoading } = useSubscriptionStore();

  if (isLoading) {
    return (
      <View
        style={[styles.container, { backgroundColor: colors.modalBackground }]}
      >
        <SettingsHeader title='Subscription' />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size='large' color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View
      style={[styles.container, { backgroundColor: colors.modalBackground }]}
    >
      <SettingsHeader title='Subscription' />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <StatusCard
          customerInfo={customerInfo}
          isProUser={isProUser}
          colors={colors}
        />
        <ActionButtons isProUser={isProUser} colors={colors} />
        {/* Feature List - to be implemented */}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 50,
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: screenPadding.horizontal,
    paddingBottom: 20,
    gap: 20,
  },
  statusCard: {
    padding: 20,
    borderRadius: 16,
    gap: 12,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'Rubik-SemiBold',
  },
  statusTitle: {
    fontSize: 24,
    fontFamily: 'Rubik-SemiBold',
  },
  statusSubtitle: {
    fontSize: 16,
    fontFamily: 'Rubik',
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  actionsContainer: {
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Rubik-SemiBold',
  },
  secondaryButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontFamily: 'Rubik-Medium',
  },
});

export default SubscriptionScreen;
