import { useSetupTrackPlayer } from '@/hooks/useSetupTrackPlayer';
import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useCallback } from 'react';
import TrackPlayer from 'react-native-track-player';
import { useLogTrackPlayerState } from '@/hooks/useLogTrackPlayerState';
import { View } from 'react-native';

SplashScreen.preventAutoHideAsync();

// eslint-disable-next-line @typescript-eslint/no-require-imports
TrackPlayer.registerPlaybackService(() => require('@/setup/service'));

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
			<RootNavigation />
			{/* StatusBar backgroundColor is not supported with edge-to-edge enabled. Render a view under the status bar to change its background. */}
			<StatusBar style='light' backgroundColor='#000000' />
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
