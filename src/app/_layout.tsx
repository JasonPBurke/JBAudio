import { useSetupTrackPlayer } from '@/hooks/useSetupTrackPlayer';
import { Stack, SplashScreen } from 'expo-router';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useCallback } from 'react';
import TrackPlayer from 'react-native-track-player';
import { useLogTrackPlayerState } from '@/hooks/useLogTrackPlayerState';
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
import settings from './settings';

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

  useSetupTrackPlayer({
    onLoad: handleTrackPlayerLoaded,
  });

  //* for debugging
  // useLogTrackPlayerState();

  return (
    <SafeAreaProvider>
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
      <Stack screenOptions={{ animation: 'fade_from_bottom' }}>
        <Stack.Screen name='(library)' options={{ headerShown: false }} />
        <Stack.Screen
          name='settings'
          options={{
            // headerShown: false,
            presentation: 'modal',
            animation: 'slide_from_left',
          }}
        />
        <Stack.Screen
          name='player'
          options={{
            presentation: 'formSheet',
            sheetCornerRadius: 15,

            headerShown: false,
          }}
        />
        <Stack.Screen
          name='titleDetails'
          options={{
            sheetCornerRadius: 15,
            presentation: 'formSheet',
            // sheetAllowedDetents: [0.9, 1],
            headerShown: false,
            animation: 'slide_from_bottom',
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
