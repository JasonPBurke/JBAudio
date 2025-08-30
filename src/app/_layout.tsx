import { useSetupTrackPlayer } from '@/hooks/useSetupTrackPlayer';
import { Stack, SplashScreen } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useCallback } from 'react';
import TrackPlayer from 'react-native-track-player';
import { useLogTrackPlayerState } from '@/hooks/useLogTrackPlayerState';

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

			<StatusBar style='light' />
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
