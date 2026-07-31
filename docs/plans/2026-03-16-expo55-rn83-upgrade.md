# Expo 55 / React Native 0.83 Upgrade Plan

**Goal:** Upgrade from Expo 53 / RN 0.79.6 to Expo 55 / RN 0.83 to gain Fabric scroll performance fixes that address systemic high CPU usage during list scrolling (56% JS thread on bare minimum text list, 39.7 FPS).

**Motivation:** Investigation on 2026-03-16 proved the scroll CPU overhead is NOT in app-level code — it's in the Fabric renderer. RN 0.80-0.83 shipped three key fixes:
1. `USE_COMMIT_HOOK_ONLY_FOR_REACT_COMMITS` — scroll state updates skip React reconciliation
2. `preventShadowTreeCommitExhaustion` — fixes excessive shadow tree commits from rapid scroll events
3. Hermes V1 (opt-in on SDK 55) — 10-15% execution improvement

**Current stack:** Expo 53, RN 0.79.6, React 19, Hermes, New Architecture, Reanimated 4.1.3, FlashList V2 (2.2.1)

**Target stack:** Expo 55, RN 0.83.x, React 19.2, Hermes (V1 opt-in), Reanimated 4.2+

---

## Pre-Upgrade: Preparation

### Step 0: Create upgrade branch and capture baseline
```bash
git checkout -b upgrade/expo55-rn83
```

Capture current Flashlight measurements for comparison:
- Bare minimum FlashList scroll test (already have: 56% JS, 39.7 FPS)
- Chapter list scroll
- Library list (BooksGrid) scroll

Save results for before/after comparison.

### Step 1: Review Expo upgrade helper
```bash
npx expo-doctor
```
Check for any pre-existing issues that should be fixed before upgrading.

---

## Phase 1: Core Framework Upgrade

### Step 2: Bump Expo SDK
```bash
# Install Expo 55
npx expo install expo@~55

# Auto-fix all Expo SDK package versions
npx expo install --fix
```

This will update:
- `expo` → ~55.0.x
- `react-native` → 0.83.x
- `react` → 19.2.x (minor bump from 19.0.0)
- All `expo-*` packages to SDK 55-compatible versions
- `expo-router` → ~6.x (major version bump — see breaking changes below)
- `babel-preset-expo` → matching version

### Step 3: Handle `newArchEnabled` removal

Expo 55 / RN 0.83 runs ONLY on New Architecture. The `newArchEnabled` config is removed.

**Files to update:**
- `android/gradle.properties` — remove `newArchEnabled=true` (no longer needed)
- `app.json` — remove any `newArchEnabled` references if present

### Step 4: Update React version handling

React bumps from 19.0.0 → 19.2.x. This is a minor version; no breaking API changes expected. But verify:
- `react-dom` (if used) matches
- `@types/react` matches (devDependency)

---

## Phase 2: Critical Native Dependencies

These need manual attention — `npx expo install --fix` may not handle them correctly.

### Step 5: react-native-reanimated → 4.2+ (or 5.x)

**Current:** 4.1.3
**Target:** 4.2.0+ (minimum for the 3x scroll perf improvement)

```bash
npx expo install react-native-reanimated@~4.2
```

**Why 4.2 matters:**
- Delivers 3x performance improvement for scroll-driven animations
- Fixes commit hook interaction with Fabric
- Supports `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS` for fast style updates during scroll

**Verify:** The Reanimated Babel plugin in `babel.config.js` does NOT need to change — it's still `react-native-worklets/plugin` (separate from reanimated plugin since Reanimated 4+).

**Test:** All Reanimated animations — SearchBar hide/show on scroll, FloatingPlayer, player screen animations.

### Step 6: react-native-worklets

**Current:** 0.6.1
**Action:** Check compatibility with Reanimated 4.2+ and RN 0.83.
```bash
npx expo install react-native-worklets
```

### Step 7: WatermelonDB — verify JSI compatibility

**Current:** @nozbe/watermelondb ^0.28.0
**Risk:** HIGH — WatermelonDB uses JSI for synchronous database access. The JSI layer changed between RN 0.79 and 0.83.

**Action:**
```bash
# Check latest version
npm view @nozbe/watermelondb versions --json | tail -5
```

**Test priority:** This is the #1 risk. If WatermelonDB's JSI bridge breaks, the app won't function. Test early:
1. App launches without crash
2. Library loads (observeWithColumns on 17 columns)
3. Books display correctly
4. Book progress updates persist

**Also update:** `@morrowdigital/watermelondb-expo-plugin` to matching version.

**Also check:** `android/settings.gradle` includes the WatermelonDB JSI line — verify it still works with RN 0.83's module structure.

### Step 8: react-native-track-player

**Current:** 5.0.0-alpha (nightly: `nightly-359af5a12d...`)
**Risk:** MEDIUM — nightly build may or may not support RN 0.83.

**Action:** Check if a stable 5.0.0 release exists:
```bash
npm view react-native-track-player versions --json | tail -10
```

If stable exists, upgrade. If not, test the current nightly against RN 0.83. If it breaks, pin to the latest nightly that works.

**Test:** Play/pause, chapter navigation, background playback, notification controls, progress events.

### Step 9: @shopify/flash-list

**Current:** ^2.1.0 (installed: 2.2.1)
**Action:** Ensure latest 2.x for RN 0.83 compatibility:
```bash
npx expo install @shopify/flash-list@latest
```

### Step 10: @sentry/react-native

**Current:** ^7.8.0
**Target:** ^8.0.0+ (recommended for RN 0.83 / New Architecture stability)

```bash
npx expo install @sentry/react-native@~8
```

**Breaking changes in Sentry 8:** Check migration guide at https://docs.sentry.io/platforms/react-native/migration/v7-to-v8/

**Verify:** `Sentry.init()` configuration, `Sentry.wrap()`, `mobileReplayIntegration()`.

---

## Phase 3: Secondary Native Dependencies

These are lower risk but still need version bumps:

### Step 11: Update remaining native modules
```bash
npx expo install \
  react-native-gesture-handler \
  react-native-screens \
  react-native-svg \
  react-native-safe-area-context \
  react-native-edge-to-edge \
  @react-native-async-storage/async-storage \
  react-native-webview \
  react-native-purchases \
  react-native-purchases-ui \
  @gorhom/bottom-sheet \
  @d11/react-native-fast-image \
  @dr.pogodin/react-native-fs
```

`npx expo install` will resolve to Expo 55-compatible versions for each.

### Step 12: Verify community native modules

These may need individual attention:
- `@react-native-community/datetimepicker` — check RN 0.83 support
- `@react-native-documents/picker` — check RN 0.83 support
- `@react-native-picker/picker` — check RN 0.83 support
- `react-native-permissions` — check RN 0.83 support
- `@somesoap/react-native-image-palette` — check RN 0.83 support
- `react-native-fast-shadow` — check RN 0.83 support
- `react-native-loader-kit` — check RN 0.83 support

**Quick check approach:**
```bash
# For each package, check if latest version mentions RN 0.83 support
npm info <package> peerDependencies
```

---

## Phase 4: Custom Native Code

### Step 13: Verify TurboModule (NativeMediaInfo)

**Files:**
- `android/app/src/main/java/com/fuzzylogic42/JBAudio/mediainfo/NativeMediaInfoModule.kt`
- `android/app/src/main/java/com/fuzzylogic42/JBAudio/mediainfo/NativeMediaInfoPackage.kt`
- `specs/NativeMediaInfo.ts`

**Risk:** LOW — TurboModule API is stable across RN 0.79-0.83. The module uses standard patterns (ReactMethod, synchronous blocking methods).

**Test:** Scan a book, verify metadata extraction works, verify cover art base64 extraction.

### Step 14: Verify CustomGlideModule

**File:** `android/app/src/main/java/com/fuzzylogic42/JBAudio/CustomGlideModule.kt`

**Risk:** LOW — Glide v4.16.0 is independent of RN version.

**Test:** Book artwork loads correctly, memory cache behaves normally.

### Step 15: Verify PermissionModule

**File:** `android/app/src/main/java/com/fuzzylogic42/JBAudio/PermissionModule.kt`

**Risk:** VERY LOW — Simple Android intent launching.

**Test:** All-files-access permission flow works.

---

## Phase 5: Build Configuration

### Step 16: Update Android build config

**`android/gradle.properties`:**
- Remove `newArchEnabled=true` (no longer needed)
- Verify `hermesEnabled=true` (still needed)
- Check if `kotlinVersion=2.0.21` needs bumping for RN 0.83
- Verify `ndkVersion=27.2.12479018` is compatible

**`android/build.gradle`:**
- RN 0.83 may update the Gradle plugin version — check `com.facebook.react:react-native-gradle-plugin` version
- Verify `kotlin_version` matches

**`android/app/build.gradle`:**
- Verify `compileSdkVersion`, `targetSdkVersion`, `minSdkVersion` requirements

### Step 17: Update Metro config

**`metro.config.js`:**
- Check if any Metro config changes are needed for RN 0.83
- The WatermelonDB resolver (`resolveRequest`) should still work

### Step 18: Update EAS CLI if needed

**`eas.json`:**
- Verify `cli.version` supports Expo 55 builds
- May need: `npm install -g eas-cli@latest`

---

## Phase 6: Expo Router Migration (SDK 53 → 55)

### Step 19: expo-router v5 → v6

This is the most likely source of breaking changes in the Expo upgrade.

**Check:** https://expo.dev/changelog/sdk-55 for router-specific changes.

**Common breaking changes in major Expo Router bumps:**
- Import path changes
- Navigation option API changes
- Layout route behavior changes
- TypedRoutes interface changes

**Files to check:**
- `src/app/_layout.tsx` — root layout with Stack
- `src/app/(drawer)/_layout.tsx` — drawer layout
- `src/app/(drawer)/(library)/_layout.tsx` — library layout
- `src/app/(settings)/_layout.tsx` — settings layout
- All screen files for navigation API usage

**Action:** After install, run `npx expo start` and fix TypeScript errors iteratively.

---

## Phase 7: Enable Performance Flags

### Step 20: Enable Fabric scroll optimization flags

After the upgrade builds successfully, enable the performance flags that motivated this upgrade:

**Option A — via expo-build-properties (recommended):**
```json
// app.json or app.config.js
{
  "expo": {
    "plugins": [
      ["expo-build-properties", {
        "android": {
          "reactNativeReleaseLevel": "experimental"
        },
        "ios": {
          "reactNativeReleaseLevel": "experimental"
        }
      }]
    ]
  }
}
```

This enables `USE_COMMIT_HOOK_ONLY_FOR_REACT_COMMITS` and other performance flags.

**Option B — Hermes V1 (optional, adds build time):**
```json
["expo-build-properties", {
  "android": {
    "useHermesV1": true
  }
}]
```

Note: Hermes V1 requires building RN from source, which significantly increases build time. Test without it first; if scroll perf is already good, skip this.

### Step 21: Enable Reanimated performance flags

In `_layout.tsx` or app initialization:
```tsx
import { enableFeatureFlag } from 'react-native-reanimated';

enableFeatureFlag('ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS');
```

This enables the fast path for non-layout style updates (opacity, transform) during scroll.

---

## Phase 8: Verification

### Step 22: Smoke test checklist

Run through these after the upgrade builds:

- [ ] App launches without crash
- [ ] Library loads, books display with artwork
- [ ] Book scanning works (TurboModule)
- [ ] Book playback works (TrackPlayer)
- [ ] Chapter navigation works
- [ ] Background playback works
- [ ] Notification controls work
- [ ] Progress tracking works (WatermelonDB)
- [ ] Sleep timer works
- [ ] Settings persist (AsyncStorage)
- [ ] Theme switching works
- [ ] Search works
- [ ] Navigation animations work (Reanimated)
- [ ] SearchBar hide/show on scroll works
- [ ] FloatingPlayer works
- [ ] Drawer navigation works
- [ ] All modals work (chapter list, title details, etc.)
- [ ] RevenueCat subscription flow works

### Step 23: Performance verification

Re-run the exact same Flashlight tests from the investigation:

```bash
flashlight measure --bundleId com.fuzzylogic42.JBAudio --duration 10000
```

**Tests to run:**
1. Bare minimum scroll test (`scrollTest` screen) — compare to 56% JS / 39.7 FPS baseline
2. Chapter list scroll (readOnly mode) — compare to 59% JS / 46 FPS baseline
3. Library grid scroll (BooksGrid) — capture new baseline

**Expected improvement:** JS thread should drop significantly (target: <20% on bare minimum test) thanks to the Fabric commit hook fixes.

### Step 24: Clean up test artifacts

After verification:
- Remove `src/app/scrollTest.tsx`
- Remove the scrollTest Stack.Screen from `_layout.tsx`
- Remove the Debug card from `(settings)/general.tsx`

---

## Risk Mitigation

| Risk | Severity | Mitigation |
|------|----------|------------|
| WatermelonDB JSI breaks | HIGH | Test DB operations immediately after first successful build. If broken, check for 0.29+ release or open issue. |
| TrackPlayer nightly incompatible | MEDIUM | Test playback early. Fall back to pinning current nightly if no stable 5.0.0 exists. |
| Expo Router v6 breaking changes | MEDIUM | Fix iteratively using TypeScript errors as guide. Most changes are import/API renames. |
| Reanimated 4.2 breaks animations | LOW | Reanimated 4.x is designed for this RN range. If issues, check SWM's compatibility table. |
| Sentry 8 migration | LOW | Follow official migration guide. Changes are mostly config-level. |
| Custom TurboModule breaks | VERY LOW | TurboModule API is stable; unlikely to break. |

## Rollback Plan

If the upgrade is too broken to fix forward:
```bash
git checkout main
git branch -D upgrade/expo55-rn83  # or keep for future attempt
```

The upgrade branch keeps all changes isolated. No risk to the working main branch.
