import { useSetupTrackPlayer } from '@/hooks/useSetupTrackPlayer';
import { Stack, SplashScreen } from 'expo-router';
import { SystemBars } from 'react-native-edge-to-edge';
import {
  SafeAreaProvider,
  initialWindowMetrics,
} from 'react-native-safe-area-context';
import { useEffect, useRef, useState } from 'react';
import TrackPlayer from 'react-native-track-player';
// import { useLogTrackPlayerState } from '@/hooks/useLogTrackPlayerState';
import { PlayerStateSync } from '@/components/PlayerStateSync';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ReducedMotionConfig, ReduceMotion } from 'react-native-reanimated';
import playbackService from '@/setup/service';
import { DatabaseProvider } from '@nozbe/watermelondb/DatabaseProvider';
import database from '@/db';
import { PermissionProvider } from '@/contexts/PermissionContext';
import { useSettingsStore } from '@/store/settingsStore';
import { ensureSettingsRecord } from '@/db/settingsQueries';
import { useThemeStore } from '@/store/themeStore';
import { useLibraryStore } from '@/store/library';
import { useUIReadyStore } from '@/store/uiReadyStore';
import { useSubscriptionStore } from '@/store/subscriptionStore';
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
}

TrackPlayer.registerPlaybackService(() => playbackService);

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
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        // Only refresh when coming back to active state from background
        if (
          appState.current.match(/inactive|background/) &&
          nextAppState === 'active'
        ) {
          initSubscription();
        }
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
