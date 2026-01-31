import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
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
        {/* Action Buttons - to be implemented */}
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
});

export default SubscriptionScreen;
