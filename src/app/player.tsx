import { colors, screenPadding } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import {
	StyleSheet,
	View,
	Text,
	TouchableOpacity,
	TouchableHighlight,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const PlayerScreen = () => {
	return <View style={styles.overlayContainer}>{<DismissPlayerSymbol />}</View>;
};

export default PlayerScreen;

const DismissPlayerSymbol = () => {
	const router = useRouter();
	const { top } = useSafeAreaInsets();
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
	container: {
		flex: 1,
		backgroundColor: 'red',
	},
	contentContainer: {
		flex: 1,
		padding: 36,
		alignItems: 'center',
	},
});
