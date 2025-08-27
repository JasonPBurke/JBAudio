import { defaultStyles } from '@/styles';
import React from 'react';
import { Text, View } from 'react-native';

const HomeScreen = () => {
	return (
		<View style={defaultStyles.container}>
			<Text style={defaultStyles.text}>Home Screen</Text>
		</View>
	);
};

export default HomeScreen;
