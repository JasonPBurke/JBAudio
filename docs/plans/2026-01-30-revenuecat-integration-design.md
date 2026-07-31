# RevenueCat Integration Design
**Date**: 2026-01-30
**App**: Sonicbooks
**Goal**: Integrate RevenueCat SDK for subscription management with freemium model and 30-day Pro trial

---

## Overview

### Business Model
- **Freemium** with 30-day Pro trial
- **Trial Type**: Standard App Store/Play Store subscription trial (requires payment info, no charge for 30 days)
- **Product**: Lifetime one-time purchase (technically a non-renewing subscription after trial)
- **Entitlement**: `pro` - unlocks all premium features

### Access Tiers

**Trial Period (First 30 days)**
- Full Pro access to all features
- Activated automatically on first app launch
- Requires payment info but no charge

**Free Tier (After trial, non-subscribers)**
- Basic playback controls
- Library browsing
- Standard theme only
- Basic fade-out timer

**Pro Tier (Paid subscribers)**
- Custom themes & colors
- Bedtime mode
- Footprint jumping (click to navigate)
- Auto-chapter generation

---

## Architecture

### State Management

**New Zustand Store**: `src/store/subscriptionStore.ts`

```typescript
interface SubscriptionStore {
  // State
  customerInfo: CustomerInfo | null;
  isProUser: boolean;
  isLoading: boolean;
  offerings: Offerings | null;

  // Actions
  initialize: () => Promise<void>;
  checkProStatus: () => boolean;
  restorePurchases: () => Promise<void>;
  presentPaywall: () => Promise<void>;
}
```

**Entitlement Logic**:
- `isProUser` computed from `customerInfo.entitlements.active['pro']`
- Covers both trial users and paid users
- Updates automatically via RevenueCat listener

### SDK Initialization

**Location**: `src/app/_layout.tsx`

**Sequence**:
1. Configure SDK with API key (after Sentry, before TrackPlayer)
2. Set log level (debug in dev, warn in prod)
3. Initialize subscription store
4. Set up customer info listener

**Error Handling**:
- Network failures: RevenueCat uses cached customer info from disk
- First launch + offline: Defaults to free tier, updates when online
- Invalid API key: Log to Sentry, continue as free user

### Feature Gates

**Pattern**:
```typescript
const { isProUser, presentPaywall } = useRequiresPro();

const handleProFeature = async () => {
  if (!isProUser) {
    await presentPaywall();
    return;
  }
  // Execute pro feature
};
```

**Gated Features**:
- Custom theme selection
- Bedtime mode toggle
- Footprint timestamp navigation
- Auto-chapter generation trigger

---

## User Interface

### Dedicated Subscription Screen

**Route**: `src/app/(settings)/subscription.tsx`

**Sections**:

1. **Status Card**
   - Current tier badge (Pro/Trial/Free)
   - Trial: Progress bar + days remaining
   - Pro: "Member since [date]"

2. **Action Buttons**
   - Not subscribed: "Upgrade to Pro" → `presentPaywall()`
   - Subscribed/Trial: "Manage Subscription" → `presentCustomerCenter()`
   - "Restore Purchases" (always visible)

3. **Feature List**
   - What's included in Pro
   - Visual checkmarks for each feature

**Navigation**:
- Add row in main settings screen
- Icon: Crown/star
- Badge shows current status
- Taps navigate to subscription screen

### Paywall Presentation

**Method**: `Purchases.presentPaywallIfNeeded()`
- Modal presentation
- Shows "Lifetime" offering with 30-day trial
- Handles purchase flow, loading, errors
- Auto-dismisses on success or cancel

### Customer Center

**Method**: `presentCustomerCenter()`
- Native modal from RevenueCat
- Shows subscription status
- Links to App Store/Play Store for management
- Restore purchases option

---

## RevenueCat Configuration

### Dashboard Setup

**Product**:
- ID: `lifetime`
- Type: Non-renewing subscription (one-time charge after trial)
- Platform: iOS App Store / Google Play Store
- Price: Set in store console
- Intro Offer: 30-day free trial

**Offering**:
- ID: `default`
- Package: Contains `lifetime` product
- Display: "Sonicbooks Pro"

**Entitlement**:
- ID: `pro`
- Products: `lifetime`
- Description: "Access to all premium features"

### API Keys

- Test: `test_kGqwByiUqhKtkdznxrEMTYYpiqx`
- Production: Separate keys for iOS/Android (to be added)

---

## Error Handling

### Purchase Errors
- User cancels → Silent dismissal
- Payment declined → Native error message, retry option
- Network timeout → "Try again later" message
- Already subscribed → Show restore option

### Restore Purchases
```typescript
restorePurchases: async () => {
  const customerInfo = await Purchases.restorePurchases();
  // Update store with restored info
  // Show success/failure message
}
```

**Use Cases**:
- Reinstalled app
- Switched devices
- New phone

### State Change Handling

**RevenueCat Listener**:
- Trial → Paid (automatic after 30 days)
- Refund issued (revoke Pro access)
- Purchase restored (grant Pro access)

**Offline Behavior**:
- Pro features remain accessible (cached info)
- New purchases require internet (platform limitation)
- Restoration requires internet

---

## Implementation Phases

### Phase 1: Core Setup
1. ✓ Install RevenueCat SDKs (`react-native-purchases`, `react-native-purchases-ui`)
2. Configure SDK in `_layout.tsx`
3. Create `subscriptionStore.ts`
4. Add customer info listener

### Phase 2: UI Integration
5. Create subscription screen
6. Add settings navigation
7. Implement feature gates on Pro features
8. Add upgrade prompts

### Phase 3: RevenueCat Dashboard
9. Configure product in App Store Connect/Play Console
10. Create entitlement in RevenueCat
11. Set up offering with trial
12. Test with sandbox accounts

### Phase 4: Testing
13. Test trial subscription flow
14. Test restore purchases
15. Test offline behavior
16. Add analytics (optional)

---

## Key Files

### New Files
- `src/store/subscriptionStore.ts` - Subscription state management
- `src/app/(settings)/subscription.tsx` - Dedicated subscription screen
- `src/hooks/useRequiresPro.ts` - Feature gate hook

### Modified Files
- `src/app/_layout.tsx` - SDK initialization
- `src/app/(settings)/general.tsx` - Add subscription navigation
- Pro feature components - Add entitlement checks

---

## Testing Checklist

- [ ] Trial starts on first app launch
- [ ] 30-day trial grants Pro access
- [ ] Payment info required but no charge during trial
- [ ] Free features work without subscription
- [ ] Pro features blocked for free users
- [ ] Paywall presents correctly
- [ ] Purchase completes and grants Pro access
- [ ] Restore purchases works on reinstall
- [ ] Customer center displays correctly
- [ ] Offline mode uses cached data
- [ ] Trial expiration transitions to free tier
- [ ] Subscription status updates automatically

---

## Notes

- RevenueCat handles trial expiration server-side (no local tracking needed)
- "Lifetime" product is implemented as non-renewing subscription
- Standard trial requires payment info upfront (Apple/Google requirement)
- Customer info cached locally by SDK for offline access
- Listener pattern ensures automatic state updates on purchase/expiration
