import { useSetupTrackPlayer } from '@/hooks/useSetupTrackPlayer';
import { Stack, SplashScreen } from 'expo-router';
import { SystemBars } from 'react-native-edge-to-edge';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useCallback } from 'react';
import TrackPlayer from 'react-native-track-player';
import { useLogTrackPlayerState } from '@/hooks/useLogTrackPlayerState';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  configureReanimatedLogger,
  ReanimatedLogLevel,
} from 'react-native-reanimated';
import playbackService from '@/setup/service';

//! THIS IS TO TEMP SUPPRESS REANIMATED WARNINGS OF WRITING TO 'VALUE' DURING COMPONENT RERENDER
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false, // Reanimated runs in strict mode by default
});

SplashScreen.preventAutoHideAsync();
TrackPlayer.registerPlaybackService(() => playbackService);

const App = () => {
  const handleTrackPlayerLoaded = useCallback(() => {
    SplashScreen.hideAsync();
  }, []);

  useSetupTrackPlayer({
    onLoad: handleTrackPlayerLoaded,
  });

  //* for debugging
  useLogTrackPlayerState();

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <RootNavigation />
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
    <Stack screenOptions={{ animation: 'fade_from_bottom' }}>
      <Stack.Screen name='(tabs)' options={{ headerShown: false }} />

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
  );
};

export default App;
