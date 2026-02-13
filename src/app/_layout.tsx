import { useSetupTrackPlayer } from '@/hooks/useSetupTrackPlayer';
import { Stack, SplashScreen } from 'expo-router';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useCallback, useEffect, useRef } from 'react';
import TrackPlayer from 'react-native-track-player';
import { useLogTrackPlayerState } from '@/hooks/useLogTrackPlayerState';
import { PlayerStateSync } from '@/components/PlayerStateSync';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from 'react-native-reanimated';
import playbackService from '@/setup/service';
import { DatabaseProvider } from '@nozbe/watermelondb/DatabaseProvider';
import database from '@/db';
import { PermissionProvider } from '@/contexts/PermissionContext';
import { useSettingsStore } from '@/store/settingsStore';
import { useThemeStore } from '@/store/themeStore';
import { useLibraryStore } from '@/store/library';
import { useSubscriptionStore } from '@/store/subscriptionStore';
import { usePlayerScreenRestoration } from '@/hooks/usePlayerScreenRestoration';
import { useTheme } from '@/hooks/useTheme';
import { runTrialExpiredCleanup } from '@/helpers/trialCleanup';
import * as Sentry from '@sentry/react-native';
import { useFonts } from 'expo-font';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';
import { AppState, AppStateStatus, Platform } from 'react-native';

Sentry.init({
  dsn: 'https://f560ec15a66fbab84326dc1d343ea729@o4510664873541632.ingest.us.sentry.io/4510664874590208',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

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
//! THIS IS TO TEMP SUPPRESS REANIMATED WARNINGS OF WRITING TO 'VALUE' DURING COMPONENT RERENDER
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false, // Reanimated runs in strict mode by default
});

SplashScreen.preventAutoHideAsync();

const App = () => {
  const [fontsLoaded, fontError] = useFonts({
    Rubik: require('../../assets/fonts/rubik_regular.ttf'),
    'Rubik-Medium': require('../../assets/fonts/rubik_medium.ttf'),
    'Rubik-SemiBold': require('../../assets/fonts/rubik_semi_bold.ttf'),
  });

  const handleTrackPlayerLoaded = useCallback(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  const initializeTheme = useThemeStore((state) => state.initializeTheme);
  const { activeColorScheme } = useTheme();

  useSettingsStore();

  useEffect(() => {
    if (fontError) {
      console.error('Font loading error:', fontError);
    }
  }, [fontError]);

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
  const initSubscription = useSubscriptionStore((state) => state.initialize);

  useEffect(() => {
    initSubscription();
  }, [initSubscription]);

  // Run trial-expired cleanup when subscription finishes loading and user is not pro
  useEffect(() => {
    const unsubscribe = useSubscriptionStore.subscribe(
      (state) => ({ isLoading: state.isLoading, isProUser: state.isProUser }),
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
        appState.current = nextAppState;
      }
    );

    return () => subscription.remove();
  }, [initSubscription]);

  useSetupTrackPlayer({
    onLoad: handleTrackPlayerLoaded,
  });

  // Restore player screen when app returns from background
  usePlayerScreenRestoration();

  //* for debugging
  // useLogTrackPlayerState();

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
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
    </SafeAreaProvider>
  );
};

const RootNavigation = () => {
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
          }}
        />
        <Stack.Screen
          name='titleDetails'
          options={{
            presentation: 'formSheet',
            animation: 'slide_from_bottom',
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
    <PermissionProvider>
      <App />
    </PermissionProvider>
  );
}
