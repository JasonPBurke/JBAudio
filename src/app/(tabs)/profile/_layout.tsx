import { StackScreenWithSearchBar } from '@/constants/layout';
import { defaultStyles } from '@/styles';
import { Stack } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

const ProfileScreenLayout = () => {
	return (
		<View style={defaultStyles.container}>
			<Stack>
				<Stack.Screen
					name='index'
					options={{
						...StackScreenWithSearchBar,
						headerTitle: 'Profile',
						// headerTitleAlign: 'center',
					}}
				/>
			</Stack>
		</View>
	);
};

export default ProfileScreenLayout;
