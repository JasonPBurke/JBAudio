import { useSetupTrackPlayer } from '@/hooks/useSetupTrackPlayer';
import { Stack, SplashScreen } from 'expo-router';
import { SystemBars } from 'react-native-edge-to-edge';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
// import { useLogTrackPlayerState } from '@/hooks/useLogTrackPlayerState';
import { PlayerStateSync } from '@/components/PlayerStateSync';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';
import { DatabaseProvider } from '@nozbe/watermelondb/DatabaseProvider';
import database from '@/db';
import { PermissionProvider } from '@/contexts/PermissionContext';
import { useSettingsStore } from '@/store/settingsStore';
import { ensureSettingsRecord } from '@/db/settingsQueries';
import { useThemeStore } from '@/store/themeStore';
import { useLibraryStore } from '@/store/library';
import { useSeriesStore } from '@/store/seriesStore';
import { useUIReadyStore } from '@/store/uiReadyStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { useAppStateStore } from '@/store/appState';
import { useTheme } from '@/hooks/useTheme';
import { runTrialExpiredCleanup } from '@/helpers/trialCleanup';
import * as Sentry from '@sentry/react-native';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { AppState, AppStateStatus } from 'react-native';

Sentry.init({
  dsn: 'https://f560ec15a66fbab84326dc1d343ea729@o4510664873541632.ingest.us.sentry.io/4510664874590208',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: false,

  // Enable Logs
  enableLogs: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

// Configure RevenueCat
Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
const revenueCatApiKey = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY;
if (revenueCatApiKey) {
  Purchases.configure({ apiKey: revenueCatApiKey });
} else {
  // Missing key = RevenueCat never configures, so getCustomerInfo() throws and
  // every user falls back to non-pro. This happens silently when the build-time
  // env var isn't injected (e.g. a build profile without the key in eas.json, or
  // an EAS `secret` var that isn't available to `--local` builds). Surface it
  // loudly so "premium is locked" is a one-line diagnosis next time.
  const msg =
    'RevenueCat NOT configured: EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY is missing at build time. All users will be treated as non-pro.';
  console.error(msg);
  Sentry.captureMessage(msg, 'error');
}

SplashScreen.preventAutoHideAsync();

const App = () => {
  const initializeTheme = useThemeStore((state) => state.initializeTheme);
  const isThemeInitialized = useThemeStore((state) => state.isInitialized);
  const initializeSettings = useSettingsStore(
    (state) => state.initializeSettings,
  );
  const { activeColorScheme } = useTheme();

  // Hide splash only after: (1) theme has loaded so the user's accent color is
  // applied from the first paint, and (2) the library screen has reported its
  // first render (via useUIReadyStore) so we never dissolve into a gray gap.
  const isLibraryReady = useUIReadyStore(
    (s) => s.isLibraryFirstRenderDone,
  );

  useEffect(() => {
    if (!isThemeInitialized || !isLibraryReady) return;
    // requestIdleCallback waits for the JS thread to be idle (modern
    // replacement for InteractionManager.runAfterInteractions, which RN has
    // deprecated). This gives RN a moment to finish painting the library
    // before the splash dissolves.
    const handle = requestIdleCallback(() => {
      SplashScreen.hideAsync();
    });
    return () => cancelIdleCallback(handle);
  }, [isThemeInitialized, isLibraryReady]);

  // Ensure the Settings singleton row exists, then hydrate the settings store from DB
  useEffect(() => {
    (async () => {
      await ensureSettingsRecord();
      await initializeSettings();
    })();
  }, [initializeSettings]);

  // Initialize library store BEFORE useSetupTrackPlayer so book data is available
  const initLibraryStore = useLibraryStore((state) => state.init);
  useEffect(() => {
    const unsubscribe = initLibraryStore();
    return () => unsubscribe();
  }, [initLibraryStore]);

  // Initialize series store (depends on the library store's book map for
  // structural-key resolution; safe to init alongside it).
  const initSeriesStore = useSeriesStore((state) => state.init);
  useEffect(() => {
    const unsubscribe = initSeriesStore();
    return () => unsubscribe();
  }, [initSeriesStore]);

  // Initialize theme on app start
  useEffect(() => {
    initializeTheme();
  }, [initializeTheme]);

  // Initialize subscription store
  const initSubscription = useSubscriptionStore(
    (state) => state.initialize,
  );

  useEffect(() => {
    initSubscription();
  }, [initSubscription]);

  // Run trial-expired cleanup when subscription finishes loading and user is not pro
  useEffect(() => {
    const unsubscribe = useSubscriptionStore.subscribe(
      (state) => ({
        isLoading: state.isLoading,
        isProUser: state.isProUser,
      }),
      ({ isLoading, isProUser }) => {
        if (!isLoading && !isProUser) {
          runTrialExpiredCleanup();
        }
      },
      { fireImmediately: true },
    );
    return unsubscribe;
  }, []);

  // Refresh trial/subscription status when app returns from background
  const appState = useRef(AppState.currentState);
  const [isBackground, setIsBackground] = useState(false);

  useEffect(() => {
    // Reconcile the foreground flag from the authoritative currentState on
    // every (re)mount. On an Activity recreate (e.g. swipe-from-recents while a
    // foreground service keeps the process alive), the JS runtime — and the
    // appState store — survive, but the React tree is rebuilt and no 'change'
    // event fires (currentState is already 'active' when this listener
    // registers). Without this, the store keeps the stale `false` left over
    // from backgrounding and the dormancy guards freeze the visible screen.
    // `!== 'background'` (not `=== 'active'`) keeps a fresh cold start safe if
    // currentState is briefly reported as 'unknown'.
    useAppStateStore
      .getState()
      .setActive(AppState.currentState !== 'background');

    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        // Refresh trial/subscription status when returning from background.
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === 'active'
        ) {
          initSubscription();
        }
        // Single source of truth for foreground state — consumers gate their
        // per-tick work on this so the mounted-but-invisible player screen goes
        // dormant (see src/store/appState.ts). Go dormant ONLY on a confirmed
        // 'background' event; treat a transient 'inactive' as still-active so a
        // trailing 'inactive' in a wake burst can't leave the flag stuck false
        // and freeze the screen.
        useAppStateStore.getState().setActive(nextAppState !== 'background');
        setIsBackground(nextAppState === 'background');
        appState.current = nextAppState;
      },
    );

    return () => subscription.remove();
  }, [initSubscription]);

  useSetupTrackPlayer({});

  //* for debugging
  // useLogTrackPlayerState();

  // Wait for theme to load before rendering anything theme-dependent.
  // The splash stays visible until SplashScreen.hideAsync() fires in the effect above.
  if (!isThemeInitialized) return null;

  return (
    <>
      <ReducedMotionConfig
        mode={isBackground ? ReduceMotion.Always : ReduceMotion.System}
      />
      <PlayerStateSync />
      <GestureHandlerRootView>
        <DatabaseProvider database={database}>
          <RootNavigation />
        </DatabaseProvider>
        <SystemBars
          hidden={{ statusBar: false, navigationBar: false }}
          style={activeColorScheme === 'dark' ? 'light' : 'dark'}
        />
      </GestureHandlerRootView>
    </>
  );
};

const RootNavigation = () => {
  const { colors: themeColors } = useTheme();
  return (
    <BottomSheetModalProvider>
      <Stack
        screenOptions={{
          // animation: 'fade_from_bottom',
          headerShown: false,
        }}
      >
        <Stack.Screen name='(drawer)' />
        <Stack.Screen
          name='player'
          options={{
            presentation: 'formSheet',
            animation: 'slide_from_bottom',
            sheetCornerRadius: 15,
            sheetShouldOverflowTopInset: true,
            contentStyle: { backgroundColor: themeColors.background },
          }}
        />
        <Stack.Screen
          name='titleDetails'
          options={{
            presentation: 'formSheet',
            animation: 'slide_from_bottom',
            sheetCornerRadius: 15,
            sheetShouldOverflowTopInset: true,
          }}
        />
        <Stack.Screen
          name='coverArtSearch'
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
            sheetCornerRadius: 15,
          }}
        />
        <Stack.Screen
          name='editTitleDetails'
          options={{
            sheetCornerRadius: 15,
            presentation: 'transparentModal',
            animation: 'fade',
            contentStyle: { backgroundColor: '#2c2c2cdc' },
          }}
        />
        <Stack.Screen
          name='chapterList'
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
          }}
        />
        <Stack.Screen
          name='(settings)'
          options={{
            animation: 'slide_from_left',
          }}
        />
        <Stack.Screen
          name='footprintList'
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
          }}
        />
        {/*
          The Series create/edit editor — spec §E1/E11, §J, §K5.

          ONE ROUTE FOR BOTH, and a ROOT SIBLING rather than a `series/` group
          member. The group is gone with it: it held the three-step wizard, and
          §J2 established it owned no store lifetime (a bare `<Stack>`, every
          draft reset on a screen), so nothing was orphaned by leaving it.

          `transparentModal` + `fade` MATCHES THE BOOK EDITOR, which is the
          precedent §E11 rests on: what the wizard-presentation ruling bought
          was full-screen opaque content with a Save/Cancel footer, not a slide,
          and the book editor already reads as a full takeover. Only the
          transition and the parent change. What forced the change is §J1's
          measurement — the opaque push is the ONLY presentation that misbehaves
          over a live sheet: popping the group reveals the library for ~165ms
          and the detail sheet re-presents with a full slide-up.

          ⚠ AND THE ONE THING NOT TO COPY FROM THE BOOK EDITOR (K5.2): its
          `contentStyle` hardcodes `#2c2c2cdc`, a dark literal that ships the
          same near-black in both themes. That was a live trap the moment this
          screen stopped being an opaque push. The value here is THEMED, and it
          is opaque rather than the literal's ~86% alpha because this screen is
          a takeover, not a scrim over the library: any frame where the route
          body has not painted yet is the app's own background rather than a
          white flash.
        */}
        <Stack.Screen
          name='seriesEditor'
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
            sheetCornerRadius: 15,
            contentStyle: { backgroundColor: themeColors.background },
          }}
        />
        {/*
          The Series detail sheet — spec §C1.

          Options copied from `titleDetails` above, deliberately and exactly:
          §C1 chose `formSheet` BECAUSE `titleDetails` is the app's existing
          detail-screen-for-an-object, so a divergence here would ship a
          presentation nobody decided. The wizard's warning applies in reverse —
          `sheetShouldOverflowTopInset: true` yields a FULL-HEIGHT sheet, which
          for a task flow read as indistinguishable from a push and was wrong;
          for a container it is the point, because it is what `titleDetails`
          does.

          ⚠ AND ONE DELIBERATE DIVERGENCE: `contentStyle` (K5). Routes copying
          `titleDetails`' options inherit NO background colour — that screen
          gets away with it only because it always has content. This one has a
          real empty state (the editor deletes a series and pops back onto its
          sheet), and without a themed background that state renders as a
          FULL-SCREEN WHITE SHEET on a dark-theme app. Reproduced, not
          hypothetical. The player sets one; the book editor hardcodes a dark
          literal, which is the other half of the same trap — do not copy that.
        */}
        <Stack.Screen
          name='seriesDetail'
          options={{
            presentation: 'formSheet',
            animation: 'slide_from_bottom',
            sheetCornerRadius: 15,
            sheetShouldOverflowTopInset: true,
            contentStyle: { backgroundColor: themeColors.background },
          }}
        />
      </Stack>
    </BottomSheetModalProvider>
  );
};

export default function WrappedApp() {
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <PermissionProvider>
        <App />
      </PermissionProvider>
    </SafeAreaProvider>
  );
}
