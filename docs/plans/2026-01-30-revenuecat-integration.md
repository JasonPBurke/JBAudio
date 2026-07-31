# RevenueCat Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Integrate RevenueCat SDK for subscription management with freemium model and 30-day Pro trial

**Architecture:** Zustand store manages subscription state via RevenueCat SDK. Feature gates check entitlements before allowing Pro features. Dedicated subscription screen handles upgrades/management.

**Tech Stack:** RevenueCat SDK, Zustand, React Native, Expo Router, TypeScript

---

## Task 1: Configure RevenueCat SDK Initialization

**Files:**
- Modify: `src/app/_layout.tsx:1-53`

**Step 1: Import RevenueCat SDK**

Add imports at the top of the file after existing imports:

```typescript
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { Platform } from 'react-native';
```

**Step 2: Configure SDK before TrackPlayer registration**

After Sentry.init() block (around line 44), add SDK configuration:

```typescript
// Configure RevenueCat
if (Platform.OS === 'ios') {
  Purchases.configure({
    apiKey: 'test_kGqwByiUqhKtkdznxrEMTYYpiqx',
  });
} else if (Platform.OS === 'android') {
  Purchases.configure({
    apiKey: 'test_kGqwByiUqhKtkdznxrEMTYYpiqx', // Same test key for both platforms
  });
}

// Set log level based on environment
Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
```

**Step 3: Verify changes compile**

Run: `npx expo start`
Expected: No TypeScript errors, app compiles successfully

**Step 4: Commit**

```bash
git add src/app/_layout.tsx
git commit -m "feat: configure RevenueCat SDK on app launch

Initialize RevenueCat with test API key for both platforms.
Set debug logging in development mode.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Create Subscription Store

**Files:**
- Create: `src/store/subscriptionStore.ts`

**Step 1: Create store file with imports and types**

```typescript
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
  restorePurchases: () => Promise<void>;
  presentPaywall: () => Promise<void>;
}
```

**Step 2: Implement store with actions**

```typescript
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
        const isProUser = paywallResult.customerInfo.entitlements.active['pro'] !== undefined;
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
```

**Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add src/store/subscriptionStore.ts
git commit -m "feat: create subscription store with RevenueCat integration

Add Zustand store to manage:
- Customer info and Pro entitlement status
- SDK initialization with listener for updates
- Paywall presentation
- Purchase restoration

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Initialize Subscription Store in App Layout

**Files:**
- Modify: `src/app/_layout.tsx:55-93`

**Step 1: Import subscription store**

Add import with other store imports (around line 19):

```typescript
import { useSubscriptionStore } from '@/store/subscriptionStore';
```

**Step 2: Initialize store in App component**

After the theme initialization effect (around line 89), add:

```typescript
// Initialize subscription store
const initSubscription = useSubscriptionStore((state) => state.initialize);

useEffect(() => {
  initSubscription();
}, [initSubscription]);
```

**Step 3: Verify app runs without errors**

Run: `npx expo start`
Expected: App loads, console shows RevenueCat debug logs initializing

**Step 4: Commit**

```bash
git add src/app/_layout.tsx
git commit -m "feat: initialize subscription store on app launch

Call store.initialize() to fetch customer info and set up
RevenueCat listener for automatic updates.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Create useRequiresPro Hook

**Files:**
- Create: `src/hooks/useRequiresPro.ts`

**Step 1: Create hook file**

```typescript
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

  return {
    isProUser,
    isLoading,
    presentPaywall,
  };
};
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/hooks/useRequiresPro.ts
git commit -m "feat: add useRequiresPro hook for feature gating

Simple hook to access Pro status and paywall presentation.
Use in components that need to gate Pro features.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Create Subscription Screen - Part 1 (Status Card)

**Files:**
- Create: `src/app/(settings)/subscription.tsx`

**Step 1: Create file with imports and basic structure**

```typescript
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

const SubscriptionScreen = () => {
  const { colors } = useTheme();
  const { customerInfo, isProUser, isLoading } = useSubscriptionStore();

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.modalBackground }]}>
        <SettingsHeader title='Subscription' />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size='large' color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.modalBackground }]}>
      <SettingsHeader title='Subscription' />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Card - to be implemented */}
        {/* Action Buttons - to be implemented */}
        {/* Feature List - to be implemented */}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
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
    padding: screenPadding,
    gap: 20,
  },
});

export default SubscriptionScreen;
```

**Step 2: Add Status Card component**

After the imports, add helper function and status card:

```typescript
// Helper to get subscription status details
const getSubscriptionStatus = (customerInfo: any, isProUser: boolean) => {
  if (!isProUser) {
    return {
      title: 'Free Plan',
      subtitle: 'Upgrade to unlock all features',
      badgeColor: '#6B7280',
      badgeText: 'FREE',
    };
  }

  const proEntitlement = customerInfo?.entitlements.active['pro'];

  if (proEntitlement?.willRenew === false && proEntitlement?.periodType === 'trial') {
    // Trial period
    const expirationDate = new Date(proEntitlement.expirationDate);
    const now = new Date();
    const daysRemaining = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

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
const StatusCard = ({ customerInfo, isProUser, colors }: any) => {
  const status = getSubscriptionStatus(customerInfo, isProUser);

  return (
    <View style={[styles.statusCard, { backgroundColor: colors.surface }]}>
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
          <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: status.badgeColor,
                  width: `${status.progress * 100}%`,
                },
              ]}
            />
          </View>
        </View>
      )}
    </View>
  );
};
```

**Step 3: Add StatusCard to render**

Replace the status card comment in the ScrollView with:

```typescript
<StatusCard customerInfo={customerInfo} isProUser={isProUser} colors={colors} />
```

**Step 4: Add styles for status card**

Add to styles object:

```typescript
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
    fontWeight: '700',
  },
  statusTitle: {
    fontSize: 24,
    fontWeight: '700',
  },
  statusSubtitle: {
    fontSize: 16,
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
```

**Step 5: Verify screen renders**

Run: `npx expo start` and navigate to the subscription screen (manually via URL if route not linked yet)
Expected: Status card displays with correct status

**Step 6: Commit**

```bash
git add src/app/(settings)/subscription.tsx
git commit -m "feat: create subscription screen with status card

Add dedicated subscription screen showing:
- Current subscription tier (Free/Trial/Pro)
- Badge and status indicator
- Trial progress bar with days remaining

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Create Subscription Screen - Part 2 (Action Buttons)

**Files:**
- Modify: `src/app/(settings)/subscription.tsx`

**Step 1: Add imports for Alert and Customer Center**

Add to imports:

```typescript
import { Alert } from 'react-native';
import { presentCustomerCenter } from 'react-native-purchases-ui';
```

**Step 2: Add Action Buttons component**

After StatusCard component:

```typescript
// Action Buttons Component
const ActionButtons = ({ isProUser, colors }: any) => {
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
        Alert.alert('No Purchases Found', 'We could not find any purchases to restore.');
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
          style={[styles.secondaryButton, { borderColor: colors.border }]}
          onPress={handleManageSubscription}
          disabled={isLoading}
        >
          <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
            Manage Subscription
          </Text>
        </Pressable>
      )}

      <Pressable
        style={[styles.secondaryButton, { borderColor: colors.border }]}
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
```

**Step 3: Add Pressable import**

Add to imports at top:

```typescript
import { Pressable } from 'react-native';
```

**Step 4: Add ActionButtons to render**

Replace the action buttons comment with:

```typescript
<ActionButtons isProUser={isProUser} colors={colors} />
```

**Step 5: Add button styles**

Add to styles object:

```typescript
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
    fontWeight: '700',
  },
  secondaryButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
```

**Step 6: Test button functionality**

Run: `npx expo start`
Expected: Buttons appear, tapping "Upgrade to Pro" shows paywall, "Restore" shows alert

**Step 7: Commit**

```bash
git add src/app/(settings)/subscription.tsx
git commit -m "feat: add action buttons to subscription screen

Add buttons for:
- Upgrade to Pro (shows paywall)
- Manage Subscription (opens Customer Center)
- Restore Purchases (with success/error alerts)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Create Subscription Screen - Part 3 (Feature List)

**Files:**
- Modify: `src/app/(settings)/subscription.tsx`

**Step 1: Add more icons import**

Update lucide imports:

```typescript
import { Crown, Check } from 'lucide-react-native';
```

**Step 2: Add Feature List component**

After ActionButtons component:

```typescript
// Pro Features List
const PRO_FEATURES = [
  {
    title: 'Custom Themes',
    description: 'Personalize your app with custom colors',
  },
  {
    title: 'Bedtime Mode',
    description: 'Auto-shutoff timer for falling asleep',
  },
  {
    title: 'Footprint Navigation',
    description: 'Jump to any timestamp by tapping footprints',
  },
  {
    title: 'Auto-Chapter Generation',
    description: 'Automatically detect and create chapters',
  },
];

// Feature List Component
const FeatureList = ({ colors }: any) => {
  return (
    <View style={styles.featureListContainer}>
      <Text style={[styles.featureListTitle, { color: colors.text }]}>
        What's Included in Pro
      </Text>

      {PRO_FEATURES.map((feature, index) => (
        <View
          key={index}
          style={[styles.featureItem, { backgroundColor: colors.surface }]}
        >
          <View style={[styles.checkCircle, { backgroundColor: colors.primary }]}>
            <Check size={16} color='#FFFFFF' />
          </View>
          <View style={styles.featureText}>
            <Text style={[styles.featureTitle, { color: colors.text }]}>
              {feature.title}
            </Text>
            <Text style={[styles.featureDescription, { color: colors.textMuted }]}>
              {feature.description}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
};
```

**Step 3: Add FeatureList to render**

Replace feature list comment with:

```typescript
<FeatureList colors={colors} />
```

**Step 4: Add feature list styles**

Add to styles object:

```typescript
  featureListContainer: {
    gap: 12,
  },
  featureListTitle: {
    fontSize: 20,
    fontWeight: '700',
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
    fontWeight: '600',
  },
  featureDescription: {
    fontSize: 14,
  },
```

**Step 5: Test complete subscription screen**

Run: `npx expo start`
Expected: Full subscription screen with status, buttons, and feature list

**Step 6: Commit**

```bash
git add src/app/(settings)/subscription.tsx
git commit -m "feat: add Pro features list to subscription screen

Display all Pro features with:
- Feature titles and descriptions
- Check mark icons
- Clean card-based layout

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Add Subscription Navigation to Settings

**Files:**
- Modify: `src/app/(settings)/general.tsx`

**Step 1: Read current general.tsx structure**

First, examine the full file to understand the layout pattern.

**Step 2: Add Crown icon import**

Add to lucide imports:

```typescript
import { Settings, Palette, Crown } from 'lucide-react-native';
```

**Step 3: Add router import**

Add at top with other imports:

```typescript
import { router } from 'expo-router';
```

**Step 4: Add subscription store import**

```typescript
import { useSubscriptionStore } from '@/store/subscriptionStore';
```

**Step 5: Add subscription status in component**

Inside GeneralSettingsScreen component, after existing hooks:

```typescript
const { isProUser } = useSubscriptionStore();
```

**Step 6: Add subscription navigation handler**

```typescript
const navigateToSubscription = () => {
  router.push('/(settings)/subscription');
};
```

**Step 7: Add subscription card as first item in ScrollView**

Add before existing SettingsCard:

```typescript
<Pressable onPress={navigateToSubscription}>
  <SettingsCard
    title='Subscription'
    icon={Crown}
  >
    <View style={styles.subscriptionContent}>
      <View style={styles.subscriptionInfo}>
        <Text style={[styles.subscriptionTitle, { color: themeColors.text }]}>
          {isProUser ? 'Sonicbooks Pro' : 'Free Plan'}
        </Text>
        <Text style={[styles.subscriptionSubtitle, { color: themeColors.textMuted }]}>
          {isProUser ? 'All features unlocked' : 'Tap to upgrade'}
        </Text>
      </View>
      <View style={[
        styles.statusBadge,
        { backgroundColor: isProUser ? '#10B981' : '#6B7280' }
      ]}>
        <Text style={styles.statusBadgeText}>
          {isProUser ? 'PRO' : 'FREE'}
        </Text>
      </View>
    </View>
  </SettingsCard>
</Pressable>
```

**Step 8: Add subscription card styles**

Add to styles object:

```typescript
  subscriptionContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  subscriptionInfo: {
    flex: 1,
    gap: 4,
  },
  subscriptionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  subscriptionSubtitle: {
    fontSize: 14,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
```

**Step 9: Test navigation**

Run: `npx expo start`
Expected: Subscription card appears at top of settings, tapping navigates to subscription screen

**Step 10: Commit**

```bash
git add src/app/(settings)/general.tsx
git commit -m "feat: add subscription navigation to settings

Add prominent subscription card at top of settings showing:
- Current tier (Pro/Free)
- Status badge
- Navigation to subscription screen on tap

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Add Feature Gate to Custom Theme Picker

**Files:**
- Modify: `src/app/(settings)/general.tsx`

**Step 1: Import useRequiresPro hook**

Add to imports:

```typescript
import { useRequiresPro } from '@/hooks/useRequiresPro';
```

**Step 2: Use hook in component**

Inside GeneralSettingsScreen, after existing hooks:

```typescript
const { isProUser: hasProAccess, presentPaywall } = useRequiresPro();
```

**Step 3: Gate the color picker**

Find the showColorPicker function and modify it:

```typescript
const showColorPicker = async () => {
  if (!hasProAccess) {
    await presentPaywall();
    return;
  }
  setColorPickerVisible(true);
};
```

**Step 4: Test feature gate**

Run: `npx expo start`
Expected: Tapping custom theme button shows paywall for non-Pro users

**Step 5: Commit**

```bash
git add src/app/(settings)/general.tsx
git commit -m "feat: gate custom theme picker with Pro check

Custom theme selection now requires Pro subscription.
Shows paywall for free users when attempting to access.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Add Feature Gate to Bedtime Mode

**Files:**
- Modify: `src/app/(settings)/timer.tsx`

**Step 1: Read timer settings file**

Examine the file structure to understand bedtime mode implementation.

**Step 2: Import useRequiresPro hook**

Add to imports:

```typescript
import { useRequiresPro } from '@/hooks/useRequiresPro';
```

**Step 3: Use hook in component**

Add hook usage in the component:

```typescript
const { isProUser, presentPaywall } = useRequiresPro();
```

**Step 4: Find bedtime mode toggle and add gate**

Find the bedtime mode toggle handler and wrap it:

```typescript
const handleBedtimeModeToggle = async (value: boolean) => {
  if (!isProUser && value === true) {
    // Trying to enable bedtime mode without Pro
    await presentPaywall();
    return;
  }

  // Original toggle logic here
  // (keep existing implementation)
};
```

**Step 5: Test bedtime gate**

Run: `npx expo start`
Expected: Enabling bedtime mode shows paywall for free users

**Step 6: Commit**

```bash
git add src/app/(settings)/timer.tsx
git commit -m "feat: gate bedtime mode with Pro check

Bedtime mode now requires Pro subscription.
Shows paywall when free users try to enable it.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Add Feature Gate to Footprint Navigation

**Files:**
- Find and modify footprint component (likely in player or book details)

**Step 1: Locate footprint navigation component**

Search for footprint-related files:

Run: `find src -name "*footprint*" -o -name "*Footprint*" | grep -v node_modules`
Expected: Find the component that renders footprints

**Step 2: Import useRequiresPro hook**

Add to the footprint component imports:

```typescript
import { useRequiresPro } from '@/hooks/useRequiresPro';
```

**Step 3: Use hook in component**

```typescript
const { isProUser, presentPaywall } = useRequiresPro();
```

**Step 4: Gate the footprint tap handler**

Find the onPress handler for footprints and modify:

```typescript
const handleFootprintPress = async (timestamp: number) => {
  if (!isProUser) {
    await presentPaywall();
    return;
  }

  // Original navigation logic
  // seekToPosition(timestamp);
};
```

**Step 5: Test footprint gate**

Run: `npx expo start`
Expected: Tapping footprints shows paywall for free users, still visible but not clickable

**Step 6: Commit**

```bash
git add [footprint component file]
git commit -m "feat: gate footprint navigation with Pro check

Footprints remain visible but tapping to jump to timestamp
requires Pro subscription. Shows paywall for free users.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 12: Add Feature Gate to Auto-Chapter Generation

**Files:**
- Find and modify auto-chapter generation trigger

**Step 1: Locate auto-chapter generation component**

Search for auto-chapter files:

Run: `find src -name "*chapter*" | grep -i auto`
Expected: Find auto-chapter generation trigger (likely in book details or settings)

**Step 2: Import useRequiresPro hook**

Add to imports:

```typescript
import { useRequiresPro } from '@/hooks/useRequiresPro';
```

**Step 3: Use hook in component**

```typescript
const { isProUser, presentPaywall } = useRequiresPro();
```

**Step 4: Gate the auto-chapter trigger**

Find the handler for triggering auto-chapter generation:

```typescript
const handleAutoChapterGeneration = async () => {
  if (!isProUser) {
    await presentPaywall();
    return;
  }

  // Original auto-chapter logic
  // generateChapters();
};
```

**Step 5: Test auto-chapter gate**

Run: `npx expo start`
Expected: Attempting auto-chapter generation shows paywall for free users

**Step 6: Commit**

```bash
git add [auto-chapter component file]
git commit -m "feat: gate auto-chapter generation with Pro check

Auto-chapter generation now requires Pro subscription.
Shows paywall when free users try to use this feature.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 13: Update App Config for RevenueCat Plugins (iOS)

**Files:**
- Modify: `app.json`

**Step 1: Add RevenueCat plugin to iOS configuration**

In the plugins array, add after existing plugins:

```json
[
  "react-native-purchases",
  {
    "ios": {
      "entitlements": {
        "com.apple.developer.in-app-purchases": ["production"]
      }
    }
  }
]
```

**Step 2: Rebuild the app**

Run: `npx expo prebuild --clean`
Expected: iOS native project regenerated with RevenueCat configuration

**Step 3: Commit**

```bash
git add app.json ios/
git commit -m "chore: configure RevenueCat for iOS

Add RevenueCat plugin configuration for iOS entitlements.
Required for in-app purchase functionality.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 14: Add Android Permissions for RevenueCat

**Files:**
- Modify: `app.json`

**Step 1: Add billing permission to Android**

In android permissions array, add:

```json
"com.android.vending.BILLING"
```

**Step 2: Rebuild Android**

Run: `npx expo prebuild --platform android --clean`
Expected: Android manifest updated with billing permission

**Step 3: Commit**

```bash
git add app.json android/
git commit -m "chore: add billing permission for Android

Add BILLING permission required for Google Play in-app purchases.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 15: Add Visual Indicators for Pro Features

**Files:**
- Modify: Pro-gated components to show Pro badge

**Step 1: Create ProBadge component**

Create: `src/components/ProBadge.tsx`

```typescript
import { View, Text, StyleSheet } from 'react-native';
import { Crown } from 'lucide-react-native';
import { useTheme } from '@/hooks/useTheme';

interface ProBadgeProps {
  size?: 'small' | 'medium';
}

export const ProBadge = ({ size = 'small' }: ProBadgeProps) => {
  const { colors } = useTheme();

  const isSmall = size === 'small';

  return (
    <View style={[
      styles.badge,
      { backgroundColor: colors.primary },
      isSmall && styles.badgeSmall
    ]}>
      <Crown size={isSmall ? 12 : 16} color='#FFFFFF' />
      <Text style={[styles.badgeText, isSmall && styles.badgeTextSmall]}>
        PRO
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeSmall: {
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  badgeTextSmall: {
    fontSize: 10,
  },
});
```

**Step 2: Add ProBadge to theme picker button**

In `general.tsx`, import and add badge:

```typescript
import { ProBadge } from '@/components/ProBadge';

// In the color picker Pressable, add badge next to icon/text
{!hasProAccess && <ProBadge size='small' />}
```

**Step 3: Test Pro badge display**

Run: `npx expo start`
Expected: Pro badge appears next to gated features for free users

**Step 4: Commit**

```bash
git add src/components/ProBadge.tsx src/app/(settings)/general.tsx
git commit -m "feat: add ProBadge component for visual indication

Add visual Pro badge to indicate features requiring subscription.
Shows on gated features for free users.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 16: Test Complete Integration Flow

**Files:**
- None (testing only)

**Step 1: Test free user flow**

1. Clear app data/reinstall
2. Launch app (should start trial automatically)
3. Verify trial status shows in subscription screen
4. Verify all Pro features work during trial

**Step 2: Test paywall presentation**

1. Mock expired trial (or use expired sandbox account)
2. Attempt to use Pro feature
3. Verify paywall appears
4. Verify paywall shows correct offering

**Step 3: Test restore purchases**

1. Make sandbox purchase
2. Uninstall and reinstall app
3. Tap "Restore Purchases"
4. Verify Pro access restored

**Step 4: Test offline behavior**

1. Enable airplane mode
2. Launch app
3. Verify Pro status loads from cache
4. Verify Pro features still accessible

**Step 5: Document test results**

Create: `docs/testing/revenuecat-integration-tests.md`

```markdown
# RevenueCat Integration Test Results

## Test Date: [Current Date]

### Free User Flow
- [ ] Trial starts automatically on first launch
- [ ] Trial status displays correctly
- [ ] All Pro features accessible during trial
- [ ] Trial countdown shows days remaining

### Paywall Flow
- [ ] Paywall presents when accessing Pro features
- [ ] Paywall shows correct offering (Lifetime with 30-day trial)
- [ ] Paywall dismisses on cancel
- [ ] Purchase flow completes successfully

### Restore Flow
- [ ] Restore purchases finds existing purchases
- [ ] Pro access granted after restore
- [ ] Appropriate message shown if no purchases found

### Offline Behavior
- [ ] Pro status loads from cache when offline
- [ ] Pro features remain accessible offline
- [ ] Status syncs when back online

### Edge Cases
- [ ] App handles network errors gracefully
- [ ] Invalid API key logs to Sentry
- [ ] Subscription status updates automatically
```

**Step 6: Commit test documentation**

```bash
git add docs/testing/revenuecat-integration-tests.md
git commit -m "docs: add RevenueCat integration test checklist

Document testing procedure for subscription functionality.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Task 17: Final Review and Cleanup

**Files:**
- Review all modified files

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 2: Run linter**

Run: `npm run lint`
Expected: No linting errors (or only warnings)

**Step 3: Test build**

Run: `npx expo prebuild && npx expo run:android` (or ios)
Expected: App builds and runs successfully

**Step 4: Review console for warnings**

Check console for any RevenueCat warnings or errors
Expected: Clean initialization logs

**Step 5: Final commit**

```bash
git add .
git commit -m "chore: final cleanup and verification

RevenueCat integration complete with:
- SDK initialization and configuration
- Subscription state management
- Feature gating for Pro features
- Dedicated subscription screen
- Purchase and restore flows

All tests passing, ready for dashboard configuration.

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>"
```

---

## Next Steps: RevenueCat Dashboard Configuration

After code implementation is complete, configure RevenueCat dashboard:

1. **Create Products** in App Store Connect / Google Play Console
   - Product ID: `lifetime`
   - Type: Auto-renewable subscription (non-renewing)
   - Price: Set your price point
   - Introductory offer: 30-day free trial

2. **Configure RevenueCat Dashboard**
   - Log into RevenueCat dashboard
   - Add App Store Connect / Google Play credentials
   - Import `lifetime` product
   - Create `pro` entitlement
   - Attach `lifetime` product to `pro` entitlement
   - Create `default` offering with `lifetime` package

3. **Test with Sandbox Accounts**
   - Create sandbox test accounts in App Store Connect / Play Console
   - Test trial subscription flow
   - Test purchase completion
   - Test restore purchases
   - Verify entitlement access

4. **Replace Test API Key**
   - Update `src/app/_layout.tsx` with production API keys
   - Use separate keys for iOS and Android

5. **Submit for Review**
   - Ensure app metadata includes in-app purchase info
   - Submit app with subscription for review

---

## Implementation Complete

All code changes complete. App ready for:
- RevenueCat dashboard configuration
- Product setup in store consoles
- Sandbox testing
- Production deployment

**Total Files Created:** 3
**Total Files Modified:** 6
**Total Commits:** 17
