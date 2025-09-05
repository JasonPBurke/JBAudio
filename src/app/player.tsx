import { colors, screenPadding } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import {
	StyleSheet,
	View,
	TouchableHighlight,
	ActivityIndicator,
	Pressable,
	ColorValue,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ionicons, Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useActiveTrack } from 'react-native-track-player';
import FastImage from '@d11/react-native-fast-image';
import { unknownBookImageUri } from '@/constants/images';
import { MovingText } from '@/components/MovingText';
import { PlayerControls } from '@/components/PlayerControls';
import { PlayerProgressBar } from '@/components/PlayerProgressBar';
import { usePlayerBackground } from '@/hooks/usePlayerBackground';
import { LinearGradient } from 'expo-linear-gradient';

const PlayerScreen = () => {
	const activeTrack = useActiveTrack();
	const { imageColors } = usePlayerBackground(
		activeTrack?.artwork ?? unknownBookImageUri
	);

	console.log('imageColors:', imageColors);

	const { top, bottom } = useSafeAreaInsets();

	if (!activeTrack) {
		return (
			<View style={[defaultStyles.container, { justifyContent: 'center' }]}>
				<ActivityIndicator color={colors.icon} />
			</View>
		);
	}

	return (
		<LinearGradient
			start={{ x: 0, y: 0 }}
			end={{ x: 0.5, y: 1 }}
			locations={[0, 0.35, 0.5, 1]} // First color at 0%, second at 50%, third at 100%
			style={{ flex: 1 }}
			colors={
				imageColors
					? ([
							imageColors.darkVibrant as ColorValue,
							imageColors.lightVibrant as ColorValue,
							imageColors.dominant as ColorValue,
							imageColors.darkMuted as ColorValue,
						] as const)
					: ([colors.primary as ColorValue, colors.background] as const)
			}
		>
			<View style={styles.overlayContainer}>
				<DismissPlayerSymbol />
				<View style={{ flex: 1, marginTop: top + 70, marginBottom: bottom }}>
					<View style={styles.artworkImageContainer}>
						<FastImage
							source={{
								uri: activeTrack.artwork ?? unknownBookImageUri,
								priority: FastImage.priority.high,
							}}
							resizeMode={FastImage.resizeMode.contain}
							style={styles.artworkImage}
						/>
					</View>

					<View style={{ flex: 1 }}>
						<View style={{ marginTop: 75 }}>
							<View style={{ height: 60 }}>
								{/* onPress load chapter list */}
								<Pressable
									// onPress={() => console.log('pressed')}
									style={{
										flexDirection: 'row',
										justifyContent: 'center',
										alignItems: 'center',
										gap: 8,
									}}
								>
									{/* track title */}
									<Feather
										style={{ transform: 'rotate(180deg)', marginLeft: 60 }}
										name='list'
										size={24}
										color={colors.icon}
									/>
									<View style={styles.trackTitleContainer}>
										<MovingText
											text={activeTrack.title ?? ''}
											animationThreshold={30}
											style={styles.trackTitleText}
										/>
									</View>
								</Pressable>
								<PlayerProgressBar style={{ marginTop: 32 }} />

								<PlayerControls style={{ marginTop: 40 }} />
							</View>
						</View>
					</View>
				</View>
			</View>
		</LinearGradient>
	);
};

export default PlayerScreen;

const DismissPlayerSymbol = () => {
	const { top } = useSafeAreaInsets();
	const router = useRouter();
	const handlePress = () => {
		router.back();
	};

	return (
		<TouchableHighlight
			style={{
				position: 'absolute',
				top: top + 8,
				left: 16,
				right: 0,
				flexDirection: 'row',
				justifyContent: 'flex-start',
			}}
		>
			<Ionicons
				name='chevron-down-outline'
				size={24}
				color={colors.icon}
				onPress={handlePress}
			/>
		</TouchableHighlight>
	);
};

const styles = StyleSheet.create({
	overlayContainer: {
		...defaultStyles.container,
		paddingHorizontal: screenPadding.horizontal,
		backgroundColor: 'rgba(0,0,0,0.5)',
	},
	// container: {
	// 	flex: 1,
	// 	backgroundColor: 'red',
	// },
	// contentContainer: {
	// 	flex: 1,
	// 	padding: 36,
	// 	alignItems: 'center',
	// },
	artworkImageContainer: {
		//! shadow effects not working
		shadowOffset: {
			width: 0,
			height: 8,
		},
		shadowOpacity: 0.44,
		shadowRadius: 11.0,
		flexDirection: 'row',
		justifyContent: 'center',
		height: '55%',
	},
	artworkImage: {
		width: '100%',
		height: '100%',
		borderRadius: 12,
	},
	trackTitleContainer: {
		flex: 1,
		overflow: 'hidden',
	},
	trackTitleText: {
		...defaultStyles.text,
		fontSize: 18,
		fontWeight: '500',
	},
});
