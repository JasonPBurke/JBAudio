import { StackScreenWithSearchBar } from '@/constants/layout';
import { Stack } from 'expo-router';
import { View } from 'react-native';

const LibraryScreenLayout = () => {
  return (
    <View style={[{ backgroundColor: '#fff', flex: 1 }]}>
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
