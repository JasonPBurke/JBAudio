import { useSetupTrackPlayer } from '@/hooks/useSetupTrackPlayer';
import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
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
// eslint-disable-next-line @typescript-eslint/no-require-imports
// TrackPlayer.registerPlaybackService(() => require('@/setup/service'));
TrackPlayer.registerPlaybackService(() => playbackService);

const App = () => {
  const handleTrackPlayerLoaded = useCallback(() => {
    SplashScreen.hideAsync();
  }, []);

  useSetupTrackPlayer({
    onLoad: handleTrackPlayerLoaded,
  });

  useLogTrackPlayerState();

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <RootNavigation />
        {/* StatusBar backgroundColor is not supported with edge-to-edge enabled. 
			Render a view under the status bar to change its background. */}
        {/* <StatusBar style='light' backgroundColor='#000000' /> */}
        <StatusBar style='light' />
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
          presentation: 'card',
          headerShown: false,

          // animation: 'slide_from_bottom',
        }}
      />
    </Stack>
  );
};

export default App;
