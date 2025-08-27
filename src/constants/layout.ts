import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { colors } from './tokens';

export const StackScreenWithSearchBar: NativeStackNavigationOptions = {
	// headerLargeTitle: true, // only on iOS
	// headerLargeStyle: {
	// 	backgroundColor: colors.background,
	// },
	// headerLargeTitleStyle: {
	// 	color: colors.text,
	// },
	// headerBlurEffect: 'prominent',

	headerTintColor: colors.text,
	headerTransparent: true,
	headerTitleStyle: {
		fontSize: 36,
	},
};
