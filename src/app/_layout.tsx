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
import { View } from 'react-native';

//! THIS IS TO TEMP SUPPRESS REANIMATED WARNINGS OF WRITING TO 'VALUE' DURING COMPONENT RERENDER
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false, // Reanimated runs in strict mode by default
});

// type Style = 'auto' | 'inverted' | 'light' | 'dark';

// type SystemBarsProps = {
//   // set the color of the system bar content (as no effect on semi-opaque navigation bar)
//   style?: Style | { statusBar?: Style; navigationBar?: Style };
//   // hide system bars (the navigation bar cannot be hidden on iOS)
//   hidden?: boolean | { statusBar?: boolean; navigationBar?: boolean };
// };

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
        <SystemBars hidden={false} style={'auto'} />
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
        }}
      />
      <Stack.Screen
        name='titleDetails'
        options={{
          presentation: 'pageSheet',
          headerShown: false,
          // animation: 'slide_from_right',
        }}
      />
    </Stack>
  );
};

export default App;
