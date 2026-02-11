import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import RevenueCatUI from 'react-native-purchases-ui';
import { useTheme } from '@/hooks/useTheme';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import SettingsHeader from '@/components/SettingsHeader';
import { screenPadding } from '@/constants/tokens';
import { Crown, Check } from 'lucide-react-native';
import type { CustomerInfo } from 'react-native-purchases';

// Helper to get subscription status details
const getSubscriptionStatus = (
  customerInfo: CustomerInfo | null,
  isInLocalTrial: boolean,
  trialDaysRemaining: number,
) => {
  // Check for paid subscription first
  if (customerInfo?.entitlements.active['pro']) {
    return {
      title: 'Pro Member',
      subtitle: 'All features unlocked',
      badgeColor: '#10B981',
      badgeText: 'PRO',
    };
  }

  // Check for local trial
  if (isInLocalTrial && trialDaysRemaining > 0) {
    return {
      title: 'Free Trial',
      subtitle: `${trialDaysRemaining} day${trialDaysRemaining !== 1 ? 's' : ''} remaining`,
      badgeColor: '#F59E0B',
      badgeText: 'TRIAL',
      showProgress: true,
      progress: trialDaysRemaining / 10, // 10-day trial
    };
  }

  // Trial expired, no subscription
  return {
    title: 'Free Plan',
    subtitle: 'Upgrade to unlock all features',
    badgeColor: '#6B7280',
    badgeText: 'FREE',
  };
};

// Status Card Component
const StatusCard = ({
  customerInfo,
  isInLocalTrial,
  trialDaysRemaining,
  colors,
}: {
  customerInfo: CustomerInfo | null;
  isInLocalTrial: boolean;
  trialDaysRemaining: number;
  colors: ReturnType<typeof useTheme>['colors'];
}) => {
  const status = getSubscriptionStatus(
    customerInfo,
    isInLocalTrial,
    trialDaysRemaining,
  );

  return (
    <View
      style={[styles.statusCard, { backgroundColor: colors.background }]}
    >
      <View style={styles.statusHeader}>
        <Crown size={32} color={status.badgeColor} />
        <View
          style={[styles.badge, { backgroundColor: status.badgeColor }]}
        >
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
          <View
            style={[
              styles.progressBar,
              { backgroundColor: colors.divider },
            ]}
          >
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
  customerInfo,
  colors,
}: {
  customerInfo: CustomerInfo | null;
  colors: ReturnType<typeof useTheme>['colors'];
}) => {
  const hasPaidPro = customerInfo?.entitlements.active['pro'] !== undefined;
  const { presentPaywall, restorePurchases, isLoading } =
    useSubscriptionStore();

  const handleUpgrade = async () => {
    await presentPaywall();
  };

  const handleManageSubscription = async () => {
    try {
      await RevenueCatUI.presentCustomerCenter();
    } catch (error) {
      console.error('Failed to present customer center:', error);
      Alert.alert('Error', 'Could not open subscription management');
    }
  };

  const handleRestore = async () => {
    try {
      const customerInfo = await restorePurchases();
      const hasProAccess =
        customerInfo.entitlements.active['pro'] !== undefined;

      if (hasProAccess) {
        Alert.alert('Success', 'Your purchases have been restored!');
      } else {
        Alert.alert(
          'No Purchases Found',
          'We could not find any purchases to restore.',
        );
      }
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to restore purchases. Please try again.',
      );
    }
  };

  return (
    <View style={styles.actionsContainer}>
      {!hasPaidPro ? (
        <Pressable
          style={[
            styles.primaryButton,
            { backgroundColor: colors.primary },
          ]}
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
          <Text
            style={[styles.secondaryButtonText, { color: colors.text }]}
          >
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

// Pro Features List
const PRO_FEATURES = [
  {
    title: 'Bedtime Mode',
    description: "Auto-timer sets itself so you don't have to",
  },
  {
    title: 'Extended Fade Timer',
    description: 'Fade-out durations beyond 1 minute',
  },
  {
    title: 'Auto-Chapter Generation',
    description: 'Detect no chapters and auto-generate them',
  },
  {
    title: 'Footprint Navigation',
    description: 'Jump to any timestamp by tapping footprints',
  },
  {
    title: 'Custom Themes',
    description: 'Personalize your app with custom colors',
  },
];

// Feature List Component
const FeatureList = ({
  colors,
}: {
  colors: ReturnType<typeof useTheme>['colors'];
}) => {
  return (
    <View style={styles.featureListContainer}>
      <Text style={[styles.featureListTitle, { color: colors.text }]}>
        What's Included in Pro
      </Text>

      {PRO_FEATURES.map((feature, index) => (
        <View
          key={index}
          style={[
            styles.featureItem,
            { backgroundColor: colors.background },
          ]}
        >
          <View
            style={[
              styles.checkCircle,
              { backgroundColor: colors.primary },
            ]}
          >
            <Check size={16} color='#FFFFFF' />
          </View>
          <View style={styles.featureText}>
            <Text style={[styles.featureTitle, { color: colors.text }]}>
              {feature.title}
            </Text>
            <Text
              style={[
                styles.featureDescription,
                { color: colors.textMuted },
              ]}
            >
              {feature.description}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
};

const SubscriptionScreen = () => {
  const { colors } = useTheme();
  const { customerInfo, isLoading, isInLocalTrial, trialDaysRemaining } =
    useSubscriptionStore();

  if (isLoading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.modalBackground },
        ]}
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
      style={[
        styles.container,
        { backgroundColor: colors.modalBackground },
      ]}
    >
      <SettingsHeader title='Subscription' />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <StatusCard
          customerInfo={customerInfo}
          isInLocalTrial={isInLocalTrial}
          trialDaysRemaining={trialDaysRemaining}
          colors={colors}
        />
        <ActionButtons customerInfo={customerInfo} colors={colors} />
        <FeatureList colors={colors} />
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
    paddingTop: 20,
  },
  scrollContent: {
    paddingHorizontal: screenPadding.horizontal,
    paddingBottom: 100,
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
  featureListContainer: {
    gap: 12,
  },
  featureListTitle: {
    fontSize: 20,
    fontFamily: 'Rubik-SemiBold',
    marginBottom: 8,
  },
  featureItem: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    alignItems: 'flex-start',
  },
  checkCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
    gap: 4,
  },
  featureTitle: {
    fontSize: 16,
    fontFamily: 'Rubik-Medium',
  },
  featureDescription: {
    fontSize: 14,
    fontFamily: 'Rubik',
  },
});

export default SubscriptionScreen;
