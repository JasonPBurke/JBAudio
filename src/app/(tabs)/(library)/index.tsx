import { BookList } from '@/components/BooksList';
import { screenPadding } from '@/constants/tokens';
import { defaultStyles } from '@/styles';
import React from 'react';
import { ScrollView, View } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';

const BookScreen = () => {
	return (
		<View style={defaultStyles.container}>
			<SafeAreaView style={{ flex: 1 }}>
				<ScrollView
					contentContainerStyle={{ paddingTop: 60, paddingBottom: 60 }}
					style={{
						paddingHorizontal: screenPadding.horizontal,
					}}
				>
					<BookList scrollEnabled={false} />
				</ScrollView>
			</SafeAreaView>
		</View>
	);
};

export default BookScreen;
