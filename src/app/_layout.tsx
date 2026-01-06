import { useSetupTrackPlayer } from '@/hooks/useSetupTrackPlayer';
import { Stack, SplashScreen } from 'expo-router';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useCallback } from 'react';
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
import { ensureMediaInfo } from '@/lib/mediainfoAdapter';
import { useSettingsStore } from '@/store/settingsStore';
import * as Sentry from '@sentry/react-native';

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

ensureMediaInfo(); //? load mediainfo.js once
TrackPlayer.registerPlaybackService(() => playbackService);
//! THIS IS TO TEMP SUPPRESS REANIMATED WARNINGS OF WRITING TO 'VALUE' DURING COMPONENT RERENDER
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false, // Reanimated runs in strict mode by default
});

SplashScreen.preventAutoHideAsync();

const App = () => {
  const handleTrackPlayerLoaded = useCallback(() => {
    SplashScreen.hideAsync();
  }, []);

  useSettingsStore();

  useSetupTrackPlayer({
    onLoad: handleTrackPlayerLoaded,
  });

  //* for debugging
  // useLogTrackPlayerState();

  return (
    <SafeAreaProvider>
      <PlayerStateSync />
      <GestureHandlerRootView>
        <DatabaseProvider database={database}>
          <RootNavigation />
        </DatabaseProvider>
        <SystemBars
          hidden={{ statusBar: false, navigationBar: false }}
          style={'auto'}
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
          animation: 'fade_from_bottom',
          headerShown: false,
        }}
      >
        <Stack.Screen name='(drawer)' />
        <Stack.Screen
          name='player'
          options={{
            presentation: 'formSheet',
            sheetCornerRadius: 15,
          }}
        />
        <Stack.Screen
          name='titleDetails'
          options={{
            sheetCornerRadius: 15,
            presentation: 'formSheet',
            animation: 'slide_from_bottom',
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
