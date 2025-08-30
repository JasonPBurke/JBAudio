import Header from '@/components/Header';
import { StackScreenWithSearchBar } from '@/constants/layout';
import { defaultStyles } from '@/styles/index';
import { Stack } from 'expo-router';
import { View } from 'react-native';

const LibraryScreenLayout = () => {
	return (
		<View style={defaultStyles.container}>
			<Header />

			<Stack>
				<Stack.Screen
					name='index'
					options={{
						...StackScreenWithSearchBar,
						headerTitle: 'Library',
						headerShown: false,
					}}
				/>
			</Stack>
		</View>
	);
};

export default LibraryScreenLayout;
