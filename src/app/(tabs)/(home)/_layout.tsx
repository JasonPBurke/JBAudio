import { defaultStyles } from '@/styles';
import { Stack } from 'expo-router';
import React from 'react';
import { View } from 'react-native';

const SongsScreenLayout = () => {
	return (
		<View style={defaultStyles.container}>
			<Stack>
				<Stack.Screen
					name='index'
					options={{
						headerTitle: 'Home',
						headerTitleAlign: 'center',
					}}
				/>
			</Stack>
		</View>
	);
};

export default SongsScreenLayout;
