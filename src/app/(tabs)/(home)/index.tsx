import { BookList } from '@/components/BooksList';
import { screenPadding } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';

import {
	SafeAreaView,
	useSafeAreaInsets,
} from 'react-native-safe-area-context';

const BookScreen = () => {
	const insets = useSafeAreaInsets();

	return (
		<View style={defaultStyles.container}>
			<SafeAreaView style={{ flex: 1 }}>
				<ScrollView
					contentContainerStyle={{ paddingTop: 60, paddingBottom: 60 }}
					// contentInsetAdjustmentBehavior='automatic' // iOS
					style={{
						paddingHorizontal: screenPadding.horizontal,
						// paddingTop: insets.top,
						// paddingBottom: insets.bottom,
					}}
				>
					<BookList scrollEnabled={false} />
				</ScrollView>
			</SafeAreaView>
		</View>
	);
};

export default BookScreen;
